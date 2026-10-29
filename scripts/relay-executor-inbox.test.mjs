import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createExecutionInbox, createFeedbackAcknowledgements } from './relay-executor-inbox.mjs';
import { createHash } from 'node:crypto';
import { callContext } from '../packages/runner/src/context-service.mjs';

const emptyFeedback = () => ({ ok: true, feedback: { available: true, events: [], conflicts: [] } });
const readInbox = async inbox => JSON.parse(await fs.readFile(inbox.filename, 'utf8'));

test('staff-only refreshes replace relationship context and missing context clears previous notes', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-staff-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const context = { ok: true, revision: 7, entries: [{ content: 'Unchanged project decision' }] };
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === 'relay_context') return structuredClone(context);
    assert.equal(name, 'relay_runner_feedback_peek');
    return emptyFeedback();
  };
  const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
  const relationships = [
    { staff_id: 'ellis', display_name: 'Ellis', notes: [{ topic: 'communication', note: 'Use concise updates.' }] },
    { staff_id: 'ellis', display_name: 'Ellis', notes: [{ topic: 'communication', note: 'Include exact evidence.' }] },
    { staff_id: 'julian', display_name: 'Julian', notes: [] },
    null,
    { staff_id: 'ellis', display_name: 'Ellis', notes: [{ topic: 'workflow', note: 'Keep review evidence.' }] },
    undefined
  ];
  let digest;
  for (const relationship of relationships) {
    if (relationship === undefined) delete context.staff_relationship;
    else context.staff_relationship = relationship;
    const result = await inbox.refresh();
    assert.equal(result.available, true);
    assert.notEqual(result.digest, digest, 'relationship-only changes must publish even at the same context revision');
    const saved = await readInbox(inbox);
    assert.deepEqual(saved.context.staff_relationship, relationship ?? null);
    assert.equal(saved.context.revision, 7);
    assert.deepEqual(saved.context.entries, context.entries);
    assert.equal(saved.acknowledged, false);
    assert.equal(saved.consumption_verified, false);
    const copy = inbox.snapshot();
    copy.context.staff_relationship = { staff_id: 'another', notes: [] };
    copy.context.entries[0].content = 'Consumer edit';
    assert.deepEqual(inbox.snapshot(), saved, 'consumer edits cannot change the retained snapshot');
    digest = result.digest;
  }
  assert.ok(calls.every(({ args }) => args.project === 'fixture' && args.assignment === 'one'));
  assert.ok(calls.filter(({ name }) => name === 'relay_context').every(({ args }) => args.action === 'read'));
});

test('missing or unavailable initial context publishes no invented staff data or provider errors', async t => {
  for (const response of [undefined, null, { ok: false }, { ok: true, entries: null }, 'throw']) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-unavailable-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const calls = [];
    const inbox = createExecutionInbox({ directory, project: 'fixture', assignment: 'one', rpc: async name => {
      calls.push(name);
      if (response === 'throw') throw Error('private provider diagnostic');
      return response;
    } });
    assert.equal((await inbox.refresh()).available, false);
    const saved = await readInbox(inbox);
    assert.equal(saved.context, null);
    assert.equal(saved.feedback, null);
    assert.equal(saved.project, 'fixture');
    assert.equal(saved.assignment, 'one');
    assert.equal(saved.acknowledged, false);
    assert.equal(saved.consumption_verified, false);
    assert.deepEqual(inbox.snapshot(), saved);
    assert.doesNotMatch(JSON.stringify(saved), /private provider diagnostic/);
    assert.deepEqual(calls, ['relay_context']);
  }
});

test('failed context or feedback refresh retains one whole stale page and recovers from the first cursors', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-stale-staff-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let failure = null, now = '2026-10-20T20:00:00Z';
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === failure) throw Error('private provider diagnostic');
    if (name === 'relay_context') return { ok: true, revision: 7, entries: [{ content: failure ? 'Unpublished partial refresh' : 'Last good decision' }], staff_relationship: { staff_id: failure ? 'julian' : 'ellis', notes: [] }, next_cursor: 20 };
    assert.equal(name, 'relay_runner_feedback_peek');
    return { ok: true, feedback: { available: true, events: [{ report_id: 'retained', original_text: 'Last good feedback' }], conflicts: [], next_cursor: 'feedback-next', truncated: true } };
  };
  const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one', clock: () => now });
  await inbox.refresh();
  const good = await readInbox(inbox);
  for (const failedMethod of ['relay_context', 'relay_runner_feedback_peek']) {
    failure = failedMethod;
    now = '2026-10-20T20:01:00Z';
    assert.equal((await inbox.refresh()).available, false);
    const stale = await readInbox(inbox);
    assert.equal(stale.available, false);
    assert.equal(stale.checked_at, now);
    assert.equal(stale.digest, good.digest);
    assert.deepEqual(stale.context, good.context);
    assert.deepEqual(stale.feedback, good.feedback);
    assert.match(stale.reason, /may be stale/);
    assert.equal(stale.acknowledged, false);
    assert.equal(stale.consumption_verified, false);
    assert.deepEqual(inbox.snapshot(), stale);
    assert.doesNotMatch(JSON.stringify(stale), /private provider diagnostic|Unpublished partial refresh|julian/);
    failure = null;
    now = '2026-10-20T20:02:00Z';
    const start = calls.length;
    assert.equal((await inbox.refresh()).available, true);
    assert.ok(calls.slice(start).every(({ args }) => !('cursor' in args)));
    const recovered = await readInbox(inbox);
    assert.equal(recovered.available, true);
    assert.equal(recovered.digest, good.digest);
    assert.equal(recovered.checked_at, now);
    assert.equal('reason' in recovered, false);
    assert.deepEqual(recovered.context.staff_relationship, good.context.staff_relationship);
    assert.deepEqual(inbox.snapshot(), recovered);
  }
});

test('unchanged successful refresh publishes the latest check time for file readers', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-freshness-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let now = '2026-10-20T20:00:00Z';
  const rpc = async name => name === 'relay_context' ? { ok: true, revision: 1, entries: [], staff_relationship: { staff_id: 'ellis', notes: [] } } : emptyFeedback();
  const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one', clock: () => now });
  const first = await inbox.refresh();
  now = '2026-10-20T20:05:00Z';
  const refreshed = await inbox.refresh();
  assert.equal(refreshed.available, true);
  assert.equal(refreshed.digest, first.digest, 'unchanged content keeps its digest');
  assert.equal(inbox.snapshot().checked_at, now);
  const saved = await readInbox(inbox);
  assert.equal(saved.checked_at, now, 'the process reads the file, so its freshness must match the successful check');
  assert.deepEqual(saved, inbox.snapshot());
});

test('assignment-bound context reads keep staff notes and directed messages isolated between inboxes', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-isolation-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const claims = ['ellis-work', 'julian-work', 'unassigned-work'].map((id, index) => ({ id, owner: 'owner-' + index, branch: 'fixture/' + id, state: 'active', primary_staff: ['ellis', 'julian', null][index], lease_until: '2099-01-01T00:00:00Z' }));
  const entries = ['ellis', 'julian'].flatMap(staff_id => [
    { id: 'signal-' + staff_id, kind: 'relationship-signal' },
    { id: 'note-' + staff_id, kind: 'relationship-note', source_entry_id: 'signal-' + staff_id, relationship: { staff_id, durable: true, topic: 'workflow', note: staff_id + ' curated note', source: 'explicit-feedback', evidence_refs: ['synthetic:user-feedback'] } },
    { id: 'message-' + staff_id, kind: 'message', assignment: staff_id + '-work', recipient_assignment: staff_id + '-work', recipient_owner: staff_id === 'ellis' ? 'owner-0' : 'owner-1', recipient_branch: 'fixture/' + staff_id + '-work', content: staff_id + ' directed message' }
  ]);
  const file = value => ({ type: 'file', sha: 'b'.repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') });
  const api = async route => route.includes('projects/fixture.json') ? file({ id: 'fixture', managed: true, repository: 'lrnolivia/fixture', default_branch: 'main', coordination: { status: 'enabled', record: 'coordination/fixture.json', max_active_branches: 4, lease_hours: 12 }, implementation: { branch_prefixes: ['fixture/'], excluded_branches: ['main'] } }) : route.includes('coordination/fixture.json') ? file({ project: 'fixture', queue: [], legacy_branches: [], claims }) : { sha: 'a'.repeat(40) };
  const env = { EVIDENCE: { get: async () => ({ json: async () => ({ schema: 1, revision: 7, entries: structuredClone(entries), operations: [] }) }), put: async () => { throw Error('Unexpected context mutation'); } } };
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === 'relay_context') return callContext(args, env, api);
    assert.equal(name, 'relay_runner_feedback_peek');
    return emptyFeedback();
  };
  const inboxes = [];
  for (const claim of claims) {
    const directory = path.join(root, claim.id);
    await fs.mkdir(directory);
    const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: claim.id });
    assert.equal((await inbox.refresh()).available, true);
    inboxes.push(inbox);
  }
  for (let i = 0; i < inboxes.length; i++) {
    const saved = await readInbox(inboxes[i]);
    const staff = claims[i].primary_staff;
    assert.equal(saved.assignment, claims[i].id);
    assert.equal(saved.context.staff_relationship.staff_id, staff);
    assert.deepEqual(saved.context.staff_relationship.notes.map(note => note.note), staff ? [staff + ' curated note'] : []);
    // Approved lifecycle separation moves directed work out of general context;
    // preserve the original cross-assignment isolation assertion in the inbox.
    assert.deepEqual(saved.context.entries.filter(entry => entry.kind === 'message'), []);
    assert.equal(saved.inbox_supported, true);
    assert.deepEqual(saved.inbox.entries.map(entry => entry.content), staff ? [staff + ' directed message'] : []);
  }
  // Reassigning one assignment's staff must replace its notes without touching another inbox.
  const julianBefore = await fs.readFile(inboxes[1].filename, 'utf8');
  claims[0].primary_staff = 'julian';
  await inboxes[0].refresh();
  assert.deepEqual((await readInbox(inboxes[0])).context.staff_relationship.notes.map(note => note.note), ['julian curated note']);
  assert.equal(await fs.readFile(inboxes[1].filename, 'utf8'), julianBefore);
  // A successor must still see old-binding blockers, but cannot treat them as
  // addressed/actionable until canonical reconciliation resolves ownership.
  claims[0].owner = 'successor';
  assert.equal((await inboxes[0].refresh()).available, true);
  const successor = await readInbox(inboxes[0]);
  assert.equal(successor.inbox.entries[0].content, 'ellis directed message');
  assert.equal(successor.inbox.entries[0].reconciliation_required, true);
  assert.equal(successor.acknowledged, false);
  assert.equal(await fs.readFile(inboxes[1].filename, 'utf8'), julianBefore);
  assert.ok(calls.every(({ name, args }) => ['relay_context', 'relay_runner_feedback_peek'].includes(name) && args.project === 'fixture' && claims.some(claim => claim.id === args.assignment)));
});

test('inbox size limit covers the actual serialized bytes and preserves the previous page',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'relay-inbox-wire-size-'));let large=false;
 const entries=()=>large?Array.from({length:20},()=>({content:'x'.repeat(4000),evidence:Array(100).fill(0)})):[{content:'last good page'}];
 const rpc=async name=>name==='relay_context'?{ok:true,revision:1,entries:entries()}:{ok:true,feedback:{available:true,events:[],conflicts:[]}};
 try{
  const inbox=createExecutionInbox({directory,rpc,project:'fixture',assignment:'one'});assert.equal((await inbox.refresh()).available,true);large=true;
  assert.ok(Buffer.byteLength(JSON.stringify(entries()))<98304,'compact payload fits but pretty-printed payload does not');
  const result=await inbox.refresh();assert.equal(result.available,false);
  const bytes=await fs.readFile(inbox.filename);assert.ok(bytes.length<=98304);const saved=JSON.parse(bytes);assert.equal(saved.context.entries[0].content,'last good page');assert.equal(saved.acknowledged,false);assert.equal(saved.consumption_verified,false);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

function acknowledgementFixture() {
 const config={project:'relay',assignment:'one',owner:'worker',branch:'work'};
 const report={report_id:'fbr_'+'a'.repeat(64),revision:1,original_text:'Please check the actual preview.',identity:{...config,commit_sha:'b'.repeat(40)},receipts:[],status:{applicability:{routing_matches:true}}};
 const page={available:true,feedback:{events:[structuredClone(report)]}};
 const state={receipts:[],pending:null},calls=[],saved=[];
 const request={type:'relay_feedback_seen',nonce:'fixture-nonce',report_id:report.report_id,expected_revision:1,text_sha256:createHash('sha256').update(report.original_text).digest('hex')};
 const event={type:'item.completed',item:{type:'agent_message',text:JSON.stringify(request)}};
 let failWrite=false,failSave=false;
 const rpc=async(name,args)=>{
  calls.push({name,args:structuredClone(args)});
  if(name==='relay_runner_feedback_status')return {ok:true,feedback:structuredClone(report)};
  assert.equal(name,'relay_runner_feedback_ack');assert.deepEqual(saved.at(-1).pending,args,'intent persisted before mutation');
  report.receipts.push({kind:'seen',operation_id:args.operation_id,expected_revision:args.expected_revision,represented_owner:config.owner,provenance:'authenticated-caller-reported',native_delivery_verified:false});report.revision++;
  if(failWrite)throw Error('private provider token');
  return {ok:true,feedback:structuredClone(report)};
 };
 const handler=createFeedbackAcknowledgements({rpc,config,jobId:'job-one',snapshot:()=>page,getHead:()=> 'b'.repeat(40),state,persist:async()=>{if(failSave)throw Error('disk unavailable');saved.push(structuredClone(state));},nonce:request.nonce});
 return {handler,event,request,page,report,state,calls,saved,setFailWrite:()=>{failWrite=true;},setFailSave:()=>{failSave=true;}};
}

test('only an explicit exact agent acknowledgement reads fresh status and persists seen intent before mutation',async()=>{
 const f=acknowledgementFixture();
 assert.equal(await f.handler.consume(f.event),true);
 assert.deepEqual(f.calls.map(x=>x.name),['relay_runner_feedback_status','relay_runner_feedback_ack']);
 assert.equal(f.state.pending,null);assert.equal(f.state.receipts[0].state,'seen');assert.equal(f.state.receipts[0].fixed,false);assert.equal(f.state.receipts[0].native_delivery_verified,false);
 assert.equal(await f.handler.consume(f.event),false);assert.equal(f.calls.length,2);
});

test('tool output, quoted requests, wrong nonce or digest and stale/unpublished feedback never acknowledge',async()=>{
 const mutations=[f=>{f.event.item.type='command_execution';},f=>{f.event.type='item.updated';},f=>{f.event.item.text='Quoted: '+f.event.item.text;},f=>{f.request.nonce='other';f.event.item.text=JSON.stringify(f.request);},f=>{f.request.text_sha256='c'.repeat(64);f.event.item.text=JSON.stringify(f.request);},f=>{f.page.available=false;},f=>{f.page.feedback.events=[];},f=>{f.page.feedback.events[0].revision=2;},f=>{f.page.feedback.events[0].identity.owner='other';},f=>{f.page.feedback.events[0].identity.commit_sha='c'.repeat(40);}];
 for(const mutate of mutations){const f=acknowledgementFixture();mutate(f);assert.equal(await f.handler.consume(f.event),false);assert.equal(f.calls.length,0);}
});

test('fresh revision, text, ownership, source or routing drift rejects a previously displayed report',async()=>{
 for(const mutate of [r=>{r.revision++;},r=>{r.original_text+='changed';},r=>{r.identity.owner='other';},r=>{r.identity.commit_sha='c'.repeat(40);},r=>{r.status.applicability.routing_matches=false;}]){
  const f=acknowledgementFixture();mutate(f.report);assert.equal(await f.handler.consume(f.event),false);assert.deepEqual(f.calls.map(x=>x.name),['relay_runner_feedback_status']);assert.equal(f.state.pending,null);
 }
});

test('feedback for another project, assignment or branch cannot acknowledge at either identity check', async () => {
  for (const field of ['project', 'assignment', 'branch']) {
    for (const stage of ['published', 'fresh']) {
      const f = acknowledgementFixture();
      const report = stage === 'published' ? f.page.feedback.events[0] : f.report;
      report.identity[field] = 'another-' + field;
      assert.equal(await f.handler.consume(f.event), false, stage + ' ' + field + ' mismatch');
      assert.deepEqual(f.calls.map(call => call.name), stage === 'published' ? [] : ['relay_runner_feedback_status']);
      assert.equal(f.state.pending, null);
      assert.deepEqual(f.state.receipts, []);
      assert.deepEqual(f.saved, []);
    }
  }
});

test('uncertain acknowledgement is reconciled read-only from its exact persisted receipt without replay',async()=>{
 const f=acknowledgementFixture();f.setFailWrite();assert.equal(await f.handler.consume(f.event),false);
 const pending=structuredClone(f.state.pending);assert.ok(pending);assert.equal(f.state.receipts.length,0);
 assert.equal(await f.handler.consume(f.event),false);assert.equal(f.calls.length,2);
 await f.handler.reconcile();assert.equal(f.calls.length,3);assert.equal(f.calls.at(-1).name,'relay_runner_feedback_status');assert.equal(f.state.pending,null);assert.equal(f.state.receipts[0].operation_id,pending.operation_id);
 assert.doesNotMatch(JSON.stringify(f.state),/private provider token/);
});

test('a journal at 32 receipts blocks a new report without dispatching or evicting evidence',async()=>{
 const f=acknowledgementFixture();
 f.state.receipts=Array.from({length:31},(_,i)=>({report_id:'fbr_'+i.toString(16).padStart(64,'0'),operation_id:'previous-seen-'+i,expected_revision:1,state:'seen',native_delivery_verified:false,fixed:false}));
 // The last available slot accepts a valid acknowledgement before the limit is reached.
 assert.equal(await f.handler.consume(f.event),true);assert.equal(f.state.receipts.length,32);
 assert.deepEqual(f.calls.map(x=>x.name),['relay_runner_feedback_status','relay_runner_feedback_ack']);
 assert.equal(f.state.pending,null);assert.equal(f.state.receipts.at(-1).report_id,f.request.report_id);
 // Publish a distinct, otherwise valid report so duplicate suppression cannot satisfy the test.
 Object.assign(f.report,{report_id:'fbr_'+'c'.repeat(64),revision:1,receipts:[]});
 f.page.feedback.events=[structuredClone(f.report)];
 f.request.report_id=f.report.report_id;f.event.item.text=JSON.stringify(f.request);
 const before=structuredClone({state:f.state,calls:f.calls,saved:f.saved});
 assert.equal(await f.handler.consume(f.event),false);
 assert.deepEqual({state:f.state,calls:f.calls,saved:f.saved},before,'full journal must not send, persist, replace or evict receipts');
});

test('an uncertain pending acknowledgement blocks a distinct valid report without replacing intent',async()=>{
 const f=acknowledgementFixture();f.setFailWrite();
 assert.equal(await f.handler.consume(f.event),false);
 assert.deepEqual(f.calls.map(x=>x.name),['relay_runner_feedback_status','relay_runner_feedback_ack']);
 assert.equal(f.state.pending.report_id,f.request.report_id);assert.equal(f.state.receipts.length,0);
 assert.deepEqual(f.saved.at(-1).pending,f.state.pending,'uncertain write retains its durable intent');
 Object.assign(f.report,{report_id:'fbr_'+'c'.repeat(64),revision:1,receipts:[]});
 f.page.feedback.events=[structuredClone(f.report)];
 f.request.report_id=f.report.report_id;f.event.item.text=JSON.stringify(f.request);
 assert.notEqual(f.request.report_id,f.state.pending.report_id);
 const before=structuredClone({state:f.state,calls:f.calls,saved:f.saved});
 assert.equal(await f.handler.consume(f.event),false);
 assert.deepEqual({state:f.state,calls:f.calls,saved:f.saved},before,'another report must not dispatch or overwrite the unresolved operation');
});

test('unconfirmed receipt stays pending and a failed durable save never dispatches an acknowledgement',async()=>{
 const f=acknowledgementFixture();f.setFailWrite();await f.handler.consume(f.event);f.report.receipts[0].represented_owner='other';await f.handler.reconcile();assert.ok(f.state.pending);assert.equal(f.state.receipts.length,0);
 const g=acknowledgementFixture();g.setFailSave();assert.equal(await g.handler.consume(g.event),false);assert.deepEqual(g.calls.map(x=>x.name),['relay_runner_feedback_status']);assert.ok(g.state.pending);
});

test('in-run inbox exposes exact full text and backlog without acknowledgment, and retains data on a failed refresh', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-'));
  let failing = false, content = 'First decision';
  const calls = [], fullText = 'Original feedback '.repeat(100);
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (failing) throw Error('provider secret should not appear');
    if (name === 'relay_context') return { ok: true, revision: 1, entries: [{ content }], next_cursor: 20 };
    if (name === 'relay_runner_feedback_peek') return { ok: true, feedback: { available: true, events: [{ report_id: 'one', original_text: fullText.slice(0, 1000), text_truncated: true }], conflicts: [{ report_id: 'old', reason: 'stale head' }], truncated: true, next_cursor: 'next' } };
    if (name === 'relay_runner_feedback_status') return { ok: true, feedback: { report_id: 'one', original_text: fullText, status: { applicability: { conflicts: [] } } } };
    throw Error('Unexpected mutation');
  };
  try {
    const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
    const first = await inbox.refresh();
    assert.equal(first.available, true); assert.equal(first.backlog, true);
    let snapshot = JSON.parse(await fs.readFile(inbox.filename));
    assert.equal(snapshot.feedback.events[0].original_text, fullText);
    assert.equal(snapshot.feedback.conflicts[0].report_id, 'old');
    assert.equal(snapshot.acknowledged, false); assert.equal(snapshot.consumption_verified, false);
    assert.equal((await fs.stat(inbox.filename)).mode & 0o777, 0o600);
    content = 'New decision while process runs';
    const second = await inbox.refresh(); assert.notEqual(second.digest, first.digest);
    assert.equal(calls.filter(x=>x.name==='relay_context')[1].args.cursor,20);
    assert.equal(calls.filter(x=>x.name==='relay_runner_feedback_peek')[1].args.cursor,'next');
    failing = true; assert.equal((await inbox.refresh()).available, false);
    const text = await fs.readFile(inbox.filename, 'utf8'); snapshot = JSON.parse(text);
    assert.equal(snapshot.context.entries[0].content, content);
    assert.doesNotMatch(text, /provider secret/);
    failing = false; assert.equal((await inbox.refresh()).available, true);
    assert.equal(calls.filter(x=>x.name==='relay_context').at(-1).args.cursor,undefined);
    assert.ok(calls.every(x => ['relay_context', 'relay_runner_feedback_peek', 'relay_runner_feedback_status'].includes(x.name)));
    assert.ok(calls.filter(x => x.name === 'relay_context').every(x => x.args.action === 'read'));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('report applicability race is retained as a conflict and oversized refresh cannot replace a usable snapshot', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-'));
  let oversized = false;
  const rpc = async name => name === 'relay_context' ? { ok: true, revision: 1, entries: [{ content: oversized ? 'X'.repeat(100000) : 'safe' }] }
    : name === 'relay_runner_feedback_peek' ? { ok: true, feedback: { available: true, events: [{ report_id: 'race', text_truncated: true }], conflicts: [] } }
      : { ok: true, feedback: { report_id: 'race', original_text: 'exact report', status: { applicability: { conflicts: ['head-changed'] } } } };
  try {
    const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
    await inbox.refresh();
    let snapshot = JSON.parse(await fs.readFile(inbox.filename));
    assert.equal(snapshot.feedback.events.length, 0); assert.equal(snapshot.feedback.conflicts[0].report_id, 'race');
    oversized = true; assert.equal((await inbox.refresh()).available, false);
    snapshot = JSON.parse(await fs.readFile(inbox.filename)); assert.equal(snapshot.context.entries[0].content, 'safe');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});


test('lifecycle pending pages stay separate, retain acknowledged work, and use opaque tokens without mutations', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-lifecycle-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name !== 'relay_context') { assert.equal(name, 'relay_runner_feedback_peek'); return emptyFeedback(); }
    assert.equal(args.action, 'read');
    if (args.view === 'inbox') return { ok: true, inbox_lifecycle: true, revision: 8,
      entries: [{ id: args.page_token ? 'next' : 'pending', kind: 'message', content: 'Still unresolved', inbox_state: 'acknowledged' }],
      next_page_token: args.page_token ? null : 'opaque-page-2' };
    return { ok: true, inbox_lifecycle: true, revision: 8, entries: [{ kind: 'decision', content: 'Project context' }, { kind: 'message', content: 'Not general context' }] };
  };
  const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
  assert.equal((await inbox.refresh()).backlog, true);
  const first = await readInbox(inbox);
  assert.equal(first.inbox_supported, true);
  assert.equal(first.inbox.entries[0].inbox_state, 'acknowledged');
  assert.deepEqual(first.context.entries, [{ kind: 'decision', content: 'Project context' }]);
  assert.equal(first.acknowledged, false); assert.equal(first.consumption_verified, false);
  assert.equal(first.inbox.page_token, null);
  assert.equal((await inbox.refresh()).backlog, false);
  assert.equal((await readInbox(inbox)).inbox.entries[0].id, 'next');
  assert.equal(calls.filter(x => x.args.view === 'inbox')[1].args.page_token, 'opaque-page-2');
  assert.ok(calls.filter(x => x.name === 'relay_context').every(x => x.args.action === 'read'));
});

test('older context runtime is explicitly unsupported rather than an empty pending inbox', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-legacy-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === 'relay_context') { assert.equal('view' in args, false); assert.equal('page_token' in args, false); return { ok: true, revision: 1, entries: [{ kind: 'message', content: 'Legacy retained message' }] }; }
    return emptyFeedback();
  };
  const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
  assert.equal((await inbox.refresh()).available, true);
  const saved = await readInbox(inbox);
  assert.equal(saved.inbox_supported, false); assert.equal(saved.inbox, null);
  assert.equal(saved.context.entries[0].content, 'Legacy retained message');
  assert.equal(calls.filter(x => x.name === 'relay_context').length, 1);
});

test('failed pending page preserves complete prior snapshot and restarts token without legacy downgrade', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-token-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let fail = false; const tokens = [];
  const rpc = async (name, args) => {
    if (name !== 'relay_context') return emptyFeedback();
    if (!args.view) return { ok: true, inbox_lifecycle: true, revision: 9, entries: [] };
    tokens.push(args.page_token ?? null);
    if (fail) throw Error('private token binding failure');
    return { ok: true, inbox_lifecycle: true, revision: 9, entries: [{ kind: 'message', content: 'Pending blocker' }], next_page_token: 'bound-token' };
  };
  const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
  await inbox.refresh(); const good = await readInbox(inbox);
  fail = true; assert.equal((await inbox.refresh()).available, false);
  const stale = await readInbox(inbox);
  assert.deepEqual(stale.inbox, good.inbox); assert.equal(stale.inbox_supported, true);
  assert.doesNotMatch(JSON.stringify(stale), /private token binding failure/);
  fail = false; assert.equal((await inbox.refresh()).available, true);
  assert.deepEqual(tokens, [null, 'bound-token', null]);
});

test('oversized lifecycle page preserves previous pending evidence within the 96KiB publication limit', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-pending-size-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let oversized = false;
  const rpc = async (name, args) => name !== 'relay_context' ? emptyFeedback() : !args.view
    ? { ok: true, inbox_lifecycle: true, revision: 1, entries: [] }
    : { ok: true, inbox_lifecycle: true, revision: 1, entries: [{ kind: 'message', content: oversized ? 'x'.repeat(100000) : 'Do not lose this blocker' }], next_page_token: null };
  const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
  await inbox.refresh(); oversized = true;
  assert.equal((await inbox.refresh()).available, false);
  const saved = await fs.readFile(inbox.filename);
  assert.ok(saved.length <= 98304);
  assert.equal(JSON.parse(saved).inbox.entries[0].content, 'Do not lose this blocker');
});

test('context and pending tokens advance independently, including empty scanned pages', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-two-tokens-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const calls = [];
  const rpc = async (name, args) => {
    if (name !== 'relay_context') return emptyFeedback();
    calls.push(args);
    return { ok: true, inbox_lifecycle: true, revision: 1, entries: [], next_page_token: args.page_token ? null : args.view === 'inbox' ? 'pending-next' : 'context-next' };
  };
  const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
  assert.equal((await inbox.refresh()).backlog, true);
  assert.equal((await inbox.refresh()).backlog, false);
  assert.equal(calls[2].page_token, 'context-next');
  assert.equal(calls[3].page_token, 'pending-next');
  assert.ok(calls.every(args => !('cursor' in args)));
});

test('rollback to a legacy runtime retains the last page on token rejection then reports unsupported', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-rollback-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let legacy = false;
  const rpc = async (name, args) => {
    if (name !== 'relay_context') return emptyFeedback();
    if (legacy) {
      if ('page_token' in args || 'view' in args) throw Error('unsupported argument');
      return { ok: true, revision: 1, entries: [] };
    }
    return { ok: true, inbox_lifecycle: true, revision: 1, entries: [], next_page_token: 'next' };
  };
  const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
  await inbox.refresh(); legacy = true;
  assert.equal((await inbox.refresh()).available, false);
  assert.equal((await readInbox(inbox)).inbox_supported, true);
  assert.equal((await inbox.refresh()).available, true);
  const saved = await readInbox(inbox);
  assert.equal(saved.inbox_supported, false); assert.equal(saved.inbox, null);
  assert.equal(saved.context.page_token, null);
});
