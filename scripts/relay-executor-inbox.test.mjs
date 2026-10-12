import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createExecutionInbox, createFeedbackAcknowledgements } from './relay-executor-inbox.mjs';
import { createHash } from 'node:crypto';

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

test('uncertain acknowledgement is reconciled read-only from its exact persisted receipt without replay',async()=>{
 const f=acknowledgementFixture();f.setFailWrite();assert.equal(await f.handler.consume(f.event),false);
 const pending=structuredClone(f.state.pending);assert.ok(pending);assert.equal(f.state.receipts.length,0);
 assert.equal(await f.handler.consume(f.event),false);assert.equal(f.calls.length,2);
 await f.handler.reconcile();assert.equal(f.calls.length,3);assert.equal(f.calls.at(-1).name,'relay_runner_feedback_status');assert.equal(f.state.pending,null);assert.equal(f.state.receipts[0].operation_id,pending.operation_id);
 assert.doesNotMatch(JSON.stringify(f.state),/private provider token/);
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
