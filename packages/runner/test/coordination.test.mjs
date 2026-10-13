import test from 'node:test';
import assert from 'node:assert/strict';
import { transition, evaluate, overlaps, covered } from '../src/coordination.mjs';

const now = new Date('2026-09-30T15:00:00Z');
const policy = { repository: 'lrnolivia/field', max_active_branches: 2, lease_hours: 12, branch_prefixes: ['field/'], excluded_branches: ['main', 'field/control'] };
const empty = () => ({ claims: [], queue: [], legacy_branches: ['old-recovery'] });
const request = (id, paths = [`src/${id}/`]) => ({ action: 'claim', id, owner: id, branch: `field/${id}`, paths, resources: [], goal: 'Fix behavior', acceptance: 'Preserve behavior', next_action: 'Inspect', base_sha: 'abc' });
const claim = (record, id, paths) => transition(record, request(id, paths), policy, now);

test('atomic admission rules leave the input revision unchanged', () => {
  const record = empty();
  const result = claim(record, 'a');
  assert.equal(record.claims.length, 0);
  assert.equal(result.claims[0].lease_until, '2026-10-01T03:00:00.000Z');
});
test('cap includes held and expired claims', () => {
  let record = claim(claim(empty(), 'a'), 'b');
  record = transition(record, { action: 'hold', id: 'a', owner: 'a', next_action: 'Recover' }, policy, now);
  assert.throws(() => transition(record, request('c'), policy, new Date('2026-10-05')), /budget/);
});
test('file/directory intersections block writers without false sibling matches', () => {
  assert.equal(overlaps('src/a/', 'src/a/file.ts'), true);
  assert.equal(overlaps('src/a/', 'src/another/file.ts'), false);
  assert.equal(covered('src/a/file.ts', ['src/a/']), true);
  assert.equal(covered('src/a/file.ts', ['src/a']), false);
  assert.throws(() => claim(claim(empty(), 'a', ['src/canvas/']), 'b', ['src/canvas/Camera.ts']), /overlaps/);
});
test('shared semantic resources block even across disjoint paths', () => {
  const record = transition(empty(), { ...request('a'), resources: ['camera'] }, policy, now);
  assert.throws(() => transition(record, { ...request('b'), resources: ['camera'] }, policy, now), /overlaps/);
});
test('same task, branch and owner cannot acquire duplicate work', () => {
  const record = claim(empty(), 'a');
  assert.throws(() => claim(record, 'a'), /already exists/);
  assert.throws(() => transition(record, { ...request('b'), owner: 'a' }, policy, now), /Owner already/);
  assert.throws(() => transition(record, { ...request('b'), branch: 'field/a' }, policy, now), /Branch already/);
});
test('expired claim stays reserved and only its owner can renew', () => {
  const record = claim(empty(), 'a');
  assert.throws(() => transition(record, { action: 'heartbeat', id: 'a', owner: 'b', next_action: 'Steal' }, policy, now), /another owner/);
  assert.throws(() => claim(record, 'b', ['src/a/']), /overlaps/);
  const renewed = transition(record, { action: 'heartbeat', id: 'a', owner: 'a', next_action: 'Resume' }, policy, new Date('2026-10-05'));
  assert.equal(renewed.claims.length, 1);
});
test('handoff retains branch and assignment while rejecting busy successors', () => {
  const record = claim(empty(), 'a');
  const result = transition(record, { action: 'handoff', id: 'a', owner: 'a', successor: 'c', next_action: 'Continue' }, policy, now);
  assert.equal(result.claims[0].branch, 'field/a');
  assert.equal(result.claims[0].owner, 'c');
  assert.throws(() => transition(claim(record, 'b'), { action: 'handoff', id: 'a', owner: 'a', successor: 'b', next_action: 'Continue' }, policy, now), /already owns/);
});
test('rescope checks conflicts and preserves task identity', () => {
  const record = claim(claim(empty(), 'a'), 'b');
  assert.throws(() => transition(record, { action: 'rescope', id: 'a', owner: 'a', paths: ['src/b/'], resources: [] }, policy, now), /overlaps/);
  assert.throws(() => transition(record, { action: 'rescope', id: 'a', owner: 'a', branch: 'field/continuation', paths: ['src/c/'], resources: [] }, policy, now), /cannot replace/);
  assert.equal(transition(record, { action: 'rescope', id: 'a', owner: 'a', paths: ['src/c/'], resources: [] }, policy, now).claims.length, 2);
});
test('queue consumes no slot and rejects duplicate task IDs', () => {
  const record = transition(empty(), { ...request('a'), action: 'queue' }, policy, now);
  assert.equal(record.claims.length, 0);
  assert.equal(record.queue[0].branch, undefined);
  assert.throws(() => transition(record, { ...request('a'), action: 'queue' }, policy, now), /already exists/);
  assert.equal(claim(record, 'a').queue[0].state, 'claimed');
});
test('completion requires proof and a true boolean disposition', () => {
  const record = claim(empty(), 'a');
  assert.throws(() => transition(record, { action: 'complete', id: 'a', owner: 'a' }, policy, now), /Completion requires/);
  const proof = { action: 'complete', id: 'a', owner: 'a', pr: 1, merged_head_sha: 'abc', merge_commit_sha: 'def', evidence: 'docs/field/completion.md', work_accounted: true };
  assert.throws(() => transition(record, { ...proof, work_accounted: 'false' }, policy, now), /Completion requires/);
  assert.equal(claim(transition(record, proof, policy, now), 'b').claims.length, 2);
});
test('invalid scope traversal and unsupported globs fail admission', () => {
  for (const path of ['/tmp/file', '../src', 'src/../file', 'src/./file', 'src//file', 'src/*']) assert.throws(() => claim(empty(), 'a', [path]), /Scopes must/);
});
test('audit distinguishes frozen legacy from unregistered new work and scope drift', () => {
  const record = claim(empty(), 'a');
  const findings = evaluate(record, policy, [{ name: 'main' }, { name: 'old-recovery' }, { name: 'field/a' }, { name: 'field/new' }],
    [{ number: 12, head: { ref: 'field/a', repo: { full_name: 'lrnolivia/field' } }, files: ['src/outside.ts'] }], new Date('2026-10-05'));
  assert.deepEqual(findings.map((f) => f.type), ['expired', 'unregistered_branch', 'scope_drift']);
  assert.equal(findings[1].branch, 'field/new');
});

const retireRequest = (extra = {}) => ({ action: 'retire', id: 'a', owner: 'a', disposition: 'cancelled', reason: 'Abandoned experiment', evidence: 'Writers stopped; branch and PR retained for inspection', operation_id: 'retire-a-1', expected_head_sha: 'a'.repeat(40), verified_head_sha: 'a'.repeat(40), ...extra });
test('retirement releases budget, scope and owner while retaining all work and intent', () => {
  const original = claim(claim(empty(), 'a'), 'b');
  Object.assign(original.claims[0], { state: 'held', pr: 92, amendments: [{ reason: 'Original feedback' }] });
  const result = transition(original, retireRequest(), policy, now);
  const { state, updated_at, retirement, ...preserved } = result.claims[0];
  const { state: oldState, updated_at: oldUpdated, ...before } = original.claims[0];
  assert.deepEqual(preserved, before);
  assert.equal(state, 'cancelled');
  assert.equal(original.claims[0].state, 'held');
  assert.equal(retirement.intent.head_sha, 'a'.repeat(40));
  const fresh = transition(result, { ...request('c', ['src/a/']), owner: 'a' }, policy, now);
  assert.equal(fresh.claims.length, 3);
  assert.deepEqual(evaluate(result, policy, [{ name: 'field/a' }, { name: 'field/b' }], [], now), []);
  for (const action of ['heartbeat', 'hold', 'handoff', 'rescope', 'complete', 'amend']) {
    assert.throws(() => transition(result, { ...request('a'), action, reason: 'Try restoring', successor: 'x' }, policy, now));
  }
  assert.throws(() => transition(result, request('a'), policy, now), /already exists/);
  assert.throws(() => transition(result, { ...request('c'), branch: 'field/a' }, policy, now), /Retired branch/);
});
test('retirement fails closed for owner, head, evidence and successor errors', () => {
  const record = claim(empty(), 'a');
  for (const patch of [{ owner: 'other' }, { verified_head_sha: 'b'.repeat(40) }, { expected_head_sha: undefined }, { evidence: ' ' }, { reason: 'x'.repeat(1001) }, { operation_id: 'bad id' }, { disposition: 'completed' }, { superseded_by: 'b' }, { disposition: 'superseded', superseded_by: 'a' }, { disposition: 'superseded', superseded_by: 'missing' }]) {
    assert.throws(() => transition(record, retireRequest(patch), policy, now));
  }
  assert.throws(() => transition({ ...record, migration_frozen: { canonical_repository: 'new' } }, retireRequest(), policy, now), /migrated/);
  const completed = structuredClone(record); completed.claims[0].state = 'completed';
  assert.throws(() => transition(completed, retireRequest(), policy, now), /Only reserved/);
  assert.equal(transition(record, retireRequest({ expected_head_sha: null, verified_head_sha: null }), policy, now).claims[0].state, 'cancelled');
});
test('retirement replay preserves timestamps and rejects operation-id reuse with different intent', () => {
  const record = transition(claim(empty(), 'a'), retireRequest(), policy, now);
  assert.deepEqual(transition(record, retireRequest({ verified_head_sha: 'b'.repeat(40) }), policy, new Date('2030-01-01')), record);
  assert.throws(() => transition(record, retireRequest({ reason: 'Changed' }), policy, now), /different intent/);
  assert.throws(() => transition(record, retireRequest({ operation_id: 'new-id' }), policy, now), /Only reserved/);
});
test('queued cancellation and supersession remain terminal and supersession requires a live successor', () => {
  let record = transition(empty(), { ...request('a'), action: 'queue' }, policy, now);
  record = transition(record, { ...request('b'), action: 'queue' }, policy, now);
  const { expected_head_sha, verified_head_sha, ...requestWithoutHead } = retireRequest({ disposition: 'superseded', superseded_by: 'b' });
  const retired = transition(record, requestWithoutHead, policy, now);
  assert.equal(retired.queue[0].state, 'superseded');
  assert.equal(retired.queue[1].state, 'queued');
  assert.throws(() => claim(retired, 'a'), /Terminal/);
  assert.deepEqual(transition(retired, requestWithoutHead, policy, now), retired);
  assert.throws(() => transition(record, retireRequest(), policy, now), /no branch head/);
  retired.queue[1].state = 'cancelled';
  assert.throws(() => transition({ ...retired, queue: [record.queue[0], retired.queue[1]] }, requestWithoutHead, policy, now), /nonterminal successor/);
});
test('claimed queue mirrors retire atomically and retain queue history through rescope', () => {
  let record = transition(empty(), { ...request('a'), action: 'queue' }, policy, now);
  record = claim(record, 'a');
  record = transition(record, { ...request('a'), action: 'rescope', resources: [], paths: ['src/new/'] }, policy, now);
  assert.equal(record.queue[0].state, 'claimed');
  const result = transition(record, retireRequest(), policy, now);
  assert.equal(result.queue[0].state, 'cancelled');
  assert.deepEqual(result.queue[0].retirement, result.claims[0].retirement);
});

const lifecycleProof = { action: 'complete', id: 'a', owner: 'a', pr: 9, merged_head_sha: 'a'.repeat(40), merge_commit_sha: 'b'.repeat(40), evidence: 'Exact merged implementation; consumer QA remains deferred', work_accounted: true };
const queuedClaim = () => claim(transition(empty(), { ...request('a'), action: 'queue' }, policy, now), 'a');
test('completion mirrors terminal state while preserving independent queue acceptance and claim proof', () => {
  const original = queuedClaim();
  original.queue[0].acceptance = 'Original complete program acceptance';
  original.queue[0].amendments = [{ reason: 'Keep original scope' }];
  const result = transition(original, lifecycleProof, policy, now);
  assert.equal(result.queue[0].state, 'completed');
  assert.equal(result.queue[0].completed_at, result.claims[0].completed_at);
  assert.equal(result.queue[0].acceptance, original.queue[0].acceptance);
  assert.deepEqual(result.queue[0].amendments, original.queue[0].amendments);
  assert.equal(result.claims[0].evidence, lifecycleProof.evidence);
  assert.equal(original.queue[0].state, 'claimed');
});
test('completed queue reconciliation is narrowly terminal, proof-bound, immutable and idempotent', () => {
  const record = transition(queuedClaim(), lifecycleProof, policy, now);
  record.queue[0].state = 'claimed';
  const reconcile = { ...lifecycleProof, action: 'reconcile' };
  const result = transition(record, reconcile, policy, new Date('2026-10-03'));
  assert.deepEqual(result.claims, record.claims);
  const { state, updated_at, completed_at, ...after } = result.queue[0];
  const { state: beforeState, updated_at: beforeUpdated, completed_at: beforeCompleted, ...before } = record.queue[0];
  assert.deepEqual(after, before);
  assert.equal(state, 'completed');
  assert.equal(completed_at, record.claims[0].completed_at);
  assert.deepEqual(transition(result, reconcile, policy, new Date('2026-10-04')), result);
  for (const patch of [{ owner: 'other' }, { pr: 10 }, { merged_head_sha: 'c'.repeat(40) }, { merge_commit_sha: undefined }]) {
    assert.throws(() => transition(record, { ...reconcile, ...patch }, policy, now));
  }
  for (const target of ['claims', 'queue']) {
    for (const state of ['active', 'held', 'queued', 'cancelled', 'superseded']) {
      const conflict = structuredClone(record); conflict[target][0].state = state;
      assert.throws(() => transition(conflict, reconcile, policy, now));
    }
  }
  const ownerMismatch = structuredClone(record); ownerMismatch.queue[0].owner = 'previous-owner';
  assert.throws(() => transition(ownerMismatch, reconcile, policy, now), /ownership/);
  const missingQueue = { ...record, queue: [] };
  assert.throws(() => transition(missingQueue, reconcile, policy, now), /queue row/);
});
test('queued handoff preserves full task and does not reserve capacity or start execution', () => {
  const original = transition(claim(empty(), 'busy'), { ...request('a'), action: 'queue' }, policy, now);
  original.queue[0].acceptance = 'All original acceptance '.repeat(400);
  const result = transition(original, { action: 'handoff', id: 'a', owner: 'a', successor: 'busy', next_action: 'Receive and await admission' }, policy, now);
  assert.deepEqual(result.claims, original.claims);
  assert.equal(result.queue[0].state, 'queued');
  assert.equal(result.queue[0].owner, 'busy');
  assert.equal(result.queue[0].acceptance, original.queue[0].acceptance);
  assert.deepEqual(result.queue[0].handoffs[0], { at: now.toISOString(), from: 'a', to: 'busy', next_action: 'Receive and await admission' });
  assert.throws(() => transition(result, { ...request('a'), owner: 'busy' }, policy, now), /Owner already/);
  for (const state of ['claimed', 'completed', 'cancelled', 'superseded']) {
    const conflict = structuredClone(original); conflict.queue[0].state = state;
    assert.throws(() => transition(conflict, { action: 'handoff', id: 'a', owner: 'a', successor: 'c', next_action: 'Continue' }, policy, now));
  }
  assert.throws(() => transition(original, { action: 'handoff', id: 'a', owner: 'stranger', successor: 'c', next_action: 'Continue' }, policy, now), /owner/);
});
test('active handoff synchronizes queue ownership and prevents terminal or mismatched queue overwrites', () => {
  const record = queuedClaim();
  const transfer = { action: 'handoff', id: 'a', owner: 'a', successor: 'c', next_action: 'Continue same work' };
  const result = transition(record, transfer, policy, now);
  assert.equal(result.queue[0].owner, 'c');
  assert.equal(result.queue[0].state, 'claimed');
  assert.deepEqual(result.queue[0].handoffs, result.claims[0].handoffs);
  for (const patch of [{ owner: 'other' }, { state: 'cancelled' }]) {
    const conflict = structuredClone(record); Object.assign(conflict.queue[0], patch);
    for (const mutation of [transfer, lifecycleProof]) assert.throws(() => transition(conflict, mutation, policy, now), /conflicts/);
  }
});

test('full objective and stable acceptance history survive over twenty amendments and rescope',()=>{
  const original='Original acceptance '+ 'x'.repeat(1800);
  let record=transition(empty(),{...request('history'),acceptance:original},policy,now);
  for(let i=0;i<25;i++)record=transition(record,{action:'amend',id:'history',owner:'history',acceptance:'Acceptance amendment '+i+' '+ 'y'.repeat(1900),reason:'Explicit additive requirement '+i},policy,new Date(now.getTime()+i*1000));
  const before=structuredClone(record.claims[0]);
  assert.equal(before.amendments.length,25);assert.equal(before.amendments[0].before.acceptance,original);
  assert.equal(before.objective_history.baseline.acceptance,original);assert.equal(before.objective_history.acceptance_versions.length,26);
  assert.equal(new Set(before.objective_history.acceptance_versions.map(x=>x.id)).size,26);
  record=transition(record,{action:'rescope',id:'history',owner:'history',paths:['src/history/','tests/history/'],resources:[],next_action:'Continue'},policy,now);
  assert.deepEqual(record.claims[0].amendments,before.amendments);
  assert.deepEqual(record.claims[0].objective_history,before.objective_history);
});

test('explicit historical queue reconciliation preserves both owners and never invents a handoff',()=>{
 const record=transition(queuedClaim(),lifecycleProof,policy,now);record.queue[0].state='claimed';record.queue[0].owner='original-owner';
 const request={...lifecycleProof,action:'reconcile',expected_queue_owner:'original-owner',reason:'Exact same completed artifact; preserve original queue owner and completion owner separately.'};
 const result=transition(record,request,policy,now);
 assert.equal(result.queue[0].state,'completed');assert.equal(result.queue[0].owner,'original-owner');
 assert.equal(result.queue[0].completion_reconciliation.ownership_transferred,false);assert.deepEqual(result.claims,record.claims);
 assert.deepEqual(transition(result,request,policy,now),result);
 assert.throws(()=>transition(record,{...request,expected_queue_owner:'unrelated'},policy,now),/ownership/);
});
