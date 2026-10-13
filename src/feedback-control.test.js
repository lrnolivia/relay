import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { callRunnerControl, runnerControlTools } from './runner-control.js';
import { readPendingFeedback, feedbackActor } from './feedback-control.js';
import { callAssignmentUpdates } from './amendment-sync.js';
import { callResume } from './resume-checkpoints.js';

function fixture() {
  const state = { owner: 'native-fixture-owner', head: 'a'.repeat(40), branch: 'fixture/task', revision: 0, puts: 0 };
  const objects = new Map();
  const bucket = {
    async get(key) { const x = objects.get(key); return x ? { etag: x.etag, json: async () => JSON.parse(x.text) } : null; },
    async put(key, value, options) {
      const old = objects.get(key), condition = options?.onlyIf;
      if (condition instanceof Headers && condition.get('if-none-match') === '*' && old) return null;
      if (condition?.etagMatches && condition.etagMatches !== old?.etag) return null;
      state.puts++;
      const etag = createHash('sha256').update(value).digest('hex'); objects.set(key, { text: value, etag });
      if (state.lostResponse) { state.lostResponse = false; throw new Error('synthetic post-write timeout'); }
      if (state.handoffOnWrite) { state.owner = 'successor-fixture-owner'; state.handoffOnWrite = false; }
      return { etag };
    },
    async list({ prefix, limit, cursor }) {
      const keys = [...objects.keys()].filter(x => x.startsWith(prefix)).sort();
      const at = Number(cursor || 0), page = keys.slice(at, at + Math.min(limit, state.pageSize || limit));
      return { objects: page.map(key => ({ key })), truncated: at + page.length < keys.length,
        cursor: String(at + page.length) };
    }
  };
  const file = value => ({ type: 'file', sha: String(state.revision).padStart(40, 'b'), encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') });
  const registration = { id: 'fixture', repository: 'lrnolivia/fixture', managed: true, default_branch: 'main',
    implementation: { branch_prefixes: ['fixture/'], excluded_branches: ['main'] },
    coordination: { status: 'enabled', record: 'coordination/fixture.json', max_active_branches: 4, lease_hours: 12 } };
  const api = async path => {
    if (path.includes('projects/fixture.json')) return file(registration);
    if (path.includes('coordination/fixture.json')) return file({ project: 'fixture', claims: [{ id: 'fixture-task', owner: state.owner,
      branch: state.branch, ...(state.completed || {}), state: state.claimState || 'active', base_sha: state.head, lease_until: '2099-01-01T00:00:00Z' }], queue: [], legacy_branches: [] });
    if (path.includes('/git/ref/heads/')) { if (state.headUnavailable) throw new Error('synthetic GitHub outage'); return { object: { sha: state.head } }; }
    if (path.endsWith('/pulls/5')) return { ...(state.pr || {}), head: { repo: { full_name: 'lrnolivia/fixture' }, ref: state.branch, sha: state.head } };
    if (path.includes('/contents/workers/')) return file({ workers: [] });
    if (path.includes('/branches?')) return [{ name: state.branch, commit: { sha: state.head } }];
    if (path.includes('/pulls?') || path.includes('/commits?') || path.includes('/actions/runs?') || path.includes('/check-runs')) return [];
    throw new Error('synthetic unsupported read: ' + path);
  };
  const args = { project: 'fixture', assignment: 'fixture-task', expected_owner: state.owner, expected_branch: state.branch,
    operation_id: 'fixture-operation', original_text: 'Synthetic fixture only.', artifact: { repository: 'lrnolivia/fixture', commit_sha: state.head } };
  const env = { EVIDENCE: bucket, RELAY_FEEDBACK_ACTOR: 'synthetic-authenticated-actor' };
  const call = (suffix, value) => callRunnerControl('relay_runner_feedback_' + suffix, value, env, api);
  return { state, bucket, objects, api, args, env, call, scope: { project: args.project, assignment: args.assignment } };
}

test('full flow preserves text and separates read, acknowledgement and verification', async () => {
  const f = fixture(); const created = (await f.call('submit', f.args)).feedback;
  assert.equal(created.original_text, f.args.original_text); assert.equal(created.status.queued, true);
  assert.equal(created.status.delivered, null);
  const before = f.state.puts;
  for (let i = 0; i < 2; i++) {
    assert.equal((await f.call('peek', f.scope)).feedback.events[0].report_id, created.report_id);
    assert.equal((await f.call('status', { ...f.scope, report_id: created.report_id })).feedback.status.seen, null);
    const updates = await callAssignmentUpdates({ ...f.scope, cursor: 0 }, f.env, f.api);
    assert.deepEqual(updates.feedback_acknowledged, []); assert.equal(updates.feedback.length, 1);
    assert.equal(updates.feedback_scan_complete, false); assert.equal(updates.context_injection, true);
  }
  assert.equal(f.state.puts, before);
  const ack = { ...f.scope, expected_owner: f.state.owner, expected_branch: f.state.branch,
    expected_head_sha: f.state.head, report_id: created.report_id, operation_id: 'fixture-ack', expected_revision: 1 };
  const seen = (await f.call('ack', ack)).feedback;
  assert.equal(seen.revision, 2); assert.equal(seen.status.seen.native_delivery_verified, false);
  for (const key of ['delivered', 'incorporated', 'fixed', 'verified']) assert.equal(seen.status[key], null);
  assert.equal((await f.call('ack', ack)).feedback.replayed, true);
  assert.equal((await f.call('peek', f.scope)).feedback.events.length, 0);
  assert.equal((await f.call('status', { ...f.scope, report_id: created.report_id })).feedback.original_text, f.args.original_text);
  await assert.rejects(f.call('ack', { ...ack, operation_id: 'different-ack' }), /revision changed/);
});

test('concurrent submit, idempotent retry, conflict and lost response are explicit', async () => {
  const f = fixture();
  const pair = await Promise.all([f.call('submit', f.args), f.call('submit', f.args)]);
  assert.equal(pair[0].feedback.report_id, pair[1].feedback.report_id); assert.equal(f.state.puts, 1);
  await assert.rejects(f.call('submit', { ...f.args, original_text: 'Changed synthetic intent' }), /different feedback/);
  await Promise.all([f.call('submit', { ...f.args, operation_id: 'another-a' }), f.call('submit', { ...f.args, operation_id: 'another-b' })]);
  assert.equal((await f.call('peek', f.scope)).feedback.events.length, 3);
  f.state.lostResponse = true;
  assert.equal((await f.call('submit', { ...f.args, operation_id: 'lost-response' })).feedback.replayed, true);
  assert.equal((await f.call('peek', f.scope)).feedback.events.length, 4);
});

test('handoff, changed head, wrong repository and terminal scope cannot silently redirect reports', async () => {
  const f = fixture(); const created = (await f.call('submit', f.args)).feedback;
  f.state.head = 'b'.repeat(40);
  const page = (await f.call('peek', f.scope)).feedback;
  assert.equal(page.events.length, 0); assert.ok(page.conflicts[0].status.applicability.conflicts.includes('commit_sha'));
  await assert.rejects(f.call('ack', { ...f.scope, expected_owner: f.state.owner, expected_branch: f.state.branch,
    expected_head_sha: f.state.head, report_id: created.report_id, operation_id: 'fixture-ack', expected_revision: 1 }), /identity changed/);
  f.state.owner = 'new-native-owner';
  await assert.rejects(f.call('submit', { ...f.args, operation_id: 'handoff' }), /owner or branch changed/);
  await assert.rejects(f.call('submit', { ...f.args, expected_owner: f.state.owner, artifact: { ...f.args.artifact, repository: 'lrnolivia/wrong' } }), /repository/);
  await assert.rejects(f.call('status', { ...f.scope, assignment: 'wrong-task', report_id: created.report_id }), /explicit existing/);
});

test('pagination returns all 105 reports through short pages without writes or cursor scope drift', async () => {
  const f = fixture(); f.state.pageSize = 3;
  for (let i = 0; i < 105; i++) await f.call('submit', { ...f.args, operation_id: 'page-' + i });
  const writes = f.state.puts; const ids = new Set(); let cursor;
  do {
    const page = (await f.call('peek', { ...f.scope, ...(cursor ? { cursor } : {}), limit: 20 })).feedback;
    page.events.forEach(x => ids.add(x.report_id)); cursor = page.next_cursor;
  } while (cursor);
  assert.equal(ids.size, 105); assert.equal(f.state.puts, writes);
  const first = (await f.call('peek', f.scope)).feedback;
  f.state.revision++;
  assert.equal((await f.call('peek', { ...f.scope, cursor: first.next_cursor })).feedback.available, true);
  f.state.owner = 'new-owner';
  await assert.rejects(f.call('peek', { ...f.scope, cursor: first.next_cursor }), /target changed/);
});

test('identity changes after storage are reported with retained receipt, never clean success', async () => {
  const f = fixture(); f.state.handoffOnWrite = true;
  const result = await f.call('submit', f.args);
  assert.equal(result.ok, false); assert.equal(result.reconcile_required, true); assert.ok(result.report.report_id);
});

test('unavailable storage/provider and unscoped lookup do not claim an empty inbox', async () => {
  const f = fixture();
  assert.equal((await readPendingFeedback({ project: 'fixture' }, f.env, f.api)).reason, 'explicit-assignment-required');
  assert.equal((await readPendingFeedback(f.scope, {}, f.api)).available, false);
  const unavailableUpdates = await callAssignmentUpdates({ ...f.scope, cursor: 0 }, {}, f.api);
  assert.equal(unavailableUpdates.reconcile_required, true);
  assert.equal(unavailableUpdates.context_injection, true);
  assert.equal(unavailableUpdates.feedback_scan_complete, false);
  f.state.headUnavailable = true;
  assert.equal((await readPendingFeedback(f.scope, f.env, f.api)).available, false);
  await assert.rejects(f.call('submit', f.args), /GitHub outage/);
  assert.equal(f.state.puts, 0);
});

test('schemas validate runtime arguments and retain authenticated actor provenance without claims of native identity', async () => {
  const f = fixture();
  await assert.rejects(f.call('submit', { ...f.args, original_text: ' ' }), /blank/);
  await assert.rejects(f.call('submit', { ...f.args, spoofed_owner: 'another' }), /Unsupported|unsupported/);
  await assert.rejects(f.call('submit', { ...f.args, ...JSON.parse('{"__proto__":{"owner":"spoof"}}') }), /unsupported/);
  await assert.rejects(f.call('peek', { ...f.scope, limit: 1000 }), /invalid/);
  for (const name of ['submit', 'ack']) {
    const tool = runnerControlTools.find(x => x.name === 'relay_runner_feedback_' + name);
    assert.equal(tool.annotations.readOnlyHint, false); assert.equal(tool.annotations.idempotentHint, true);
  }
  assert.match(feedbackActor({ claims: { sub: 'synthetic-subject' } }), /^access-sub-sha256:/);
  assert.doesNotMatch(feedbackActor({ claims: { sub: 'synthetic-subject' } }), /synthetic-subject/);
});

test('resume includes pending feedback for an explicit assignment without acknowledgement', async () => {
  const f = fixture(); const created = (await f.call('submit', f.args)).feedback;
  const writes = f.state.puts;
  const resumed = await callResume(f.scope, f.env, f.api);
  assert.equal(resumed.latest.pending_feedback.events[0].report_id, created.report_id);
  assert.equal(f.state.puts, writes);
});

test('MCP report classification preserves unknown runtime across submit, peek, status and acknowledgement', async () => {
  const f = fixture();
  const unspecified = (await f.call('submit', f.args)).feedback;
  assert.equal(unspecified.status.applicability.safe_to_apply, false);
  assert.deepEqual(unspecified.status.applicability.unverified, ['artifact_kind']);
  const runtime = (await f.call('submit', { ...f.args, operation_id: 'runtime-report',
    artifact: { ...f.args.artifact, kind: 'runtime' } })).feedback;
  assert.deepEqual(runtime.status.applicability.unverified, ['runtime_identity']);
  const source = (await f.call('submit', { ...f.args, operation_id: 'source-report',
    artifact: { ...f.args.artifact, kind: 'source' } })).feedback;
  assert.equal(source.status.applicability.safe_to_apply, true);
  const peek = (await f.call('peek', f.scope)).feedback;
  assert.equal(peek.events.find(x => x.report_id === runtime.report_id).status.applicability.safe_to_apply, false);
  const seen = (await f.call('ack', { ...f.scope, expected_owner: f.state.owner, expected_branch: f.state.branch,
    expected_head_sha: f.state.head, report_id: runtime.report_id, operation_id: 'runtime-seen', expected_revision: 1 })).feedback;
  assert.ok(seen.status.seen);
  assert.equal(seen.status.applicability.safe_to_apply, false);
  assert.equal((await f.call('status', { ...f.scope, report_id: runtime.report_id })).feedback.status.verified, null);
  await assert.rejects(f.call('submit', { ...f.args, artifact: { ...f.args.artifact, kind: 'invented' } }), /unsupported/);
});

test('terminal and unknown assignment states reject writes; historical reports remain readable', async () => {
  const f = fixture(); const created = (await f.call('submit', f.args)).feedback;
  for (const state of ['completed', 'cancelled', 'superseded', 'unexpected']) {
    f.state.claimState = state;
    await assert.rejects(f.call('submit', { ...f.args, operation_id: state }), /terminal|state/);
    assert.equal((await f.call('status', { ...f.scope, report_id: created.report_id })).feedback.original_text, f.args.original_text);
  }
});

test('competing acknowledgements cannot overwrite receipts, and a lost reply is recovered', async () => {
  const f = fixture(); const created = (await f.call('submit', f.args)).feedback;
  const args = { ...f.scope, expected_owner: f.state.owner, expected_branch: f.state.branch,
    expected_head_sha: f.state.head, report_id: created.report_id, expected_revision: 1 };
  const results = await Promise.allSettled(['first', 'second'].map(operation_id => f.call('ack', { ...args, operation_id })));
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await f.call('status', { ...f.scope, report_id: created.report_id })).feedback.receipts.length, 1);
  const second = (await f.call('submit', { ...f.args, operation_id: 'second-report' })).feedback;
  f.state.lostResponse = true;
  const recovered = (await f.call('ack', { ...args, report_id: second.report_id, operation_id: 'lost-ack' })).feedback;
  assert.equal(recovered.replayed, true);
  assert.equal(recovered.receipts.length, 1);
});

test('unscoped resume does not choose a feedback recipient', async () => {
  const f = fixture(); await f.call('submit', f.args);
  const before = f.state.puts;
  const resumed = await callResume({ project: 'fixture' }, f.env, f.api);
  assert.equal(resumed.latest.pending_feedback.reason, 'explicit-assignment-required');
  assert.equal(f.state.puts, before);
});


test('historical review verifies merged identity, preserves completion and never queues execution',async()=>{
  const f=fixture();f.state.claimState='completed';
  f.state.completed={work_accounted:true,pr:5,merged_head_sha:f.state.head,merge_commit_sha:'c'.repeat(40)};
  f.state.pr={merged:true,merge_commit_sha:'c'.repeat(40),base:{ref:'main',repo:{full_name:'lrnolivia/fixture'}}};
  f.state.headUnavailable=true;
  const args={...f.args,review_mode:'historical',artifact:{...f.args.artifact,pr:5,kind:'source'}};
  const created=(await f.call('submit',args)).feedback;
  assert.equal(created.status.queued,false);assert.equal(created.status.historical_review,true);
  const seen=(await f.call('ack',{...f.scope,review_mode:'historical',expected_owner:f.state.owner,expected_branch:f.state.branch,expected_head_sha:f.state.head,expected_revision:1,report_id:created.report_id,operation_id:'historical-ack'})).feedback;
  assert.ok(seen.status.seen);assert.equal(seen.status.queued,false);
  assert.equal(f.state.claimState,'completed');
  await assert.rejects(f.call('submit',{...args,artifact:{...args.artifact,commit_sha:'d'.repeat(40)}}),/exact completed artifact/);
  f.state.pr.merged=false;
  await assert.rejects(f.call('submit',args),/could not be verified/);
});
