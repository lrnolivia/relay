import test from 'node:test';
import assert from 'node:assert/strict';
import { transition } from './coordination-engine.js';
import { runnerControlTools } from './runner-control.js';

const policy = {
  repository: 'lrnolivia/relay',
  branch_prefixes: ['relay/'],
  excluded_branches: ['main'],
  max_active_branches: 4,
  lease_hours: 12
};
const now = new Date('2026-09-30T23:00:00.000Z');
const baseClaim = (extra = {}) => ({
  id: 'task',
  owner: 'worker',
  branch: 'relay/task',
  paths: ['src/'],
  resources: ['relay-control'],
  goal: 'old goal',
  acceptance: 'old acceptance',
  next_action: 'old next',
  base_sha: 'a'.repeat(40),
  state: 'active',
  created_at: now.toISOString(),
  lease_until: new Date(now.getTime() + 3600000).toISOString(),
  ...extra
});
const record = (claims = [], queue = []) => ({
  schema: 1,
  project: 'relay',
  claims,
  queue,
  legacy_branches: ['main']
});

test('Runner coordinate schema exposes canonical amend inputs', () => {
  const tool = runnerControlTools.find((item) => item.name === 'relay_runner_coordinate');
  assert.ok(tool.inputSchema.properties.action.enum.includes('amend'));
  assert.ok(tool.inputSchema.properties.request.properties.reason);
  assert.deepEqual(tool.inputSchema.properties.request.properties.task_class.enum, ['design', 'architecture', 'maintenance']);
});

test('queued assignment amends in place and records bounded human-readable audit', () => {
  const queued = {
    id: 'task', owner: 'worker', goal: 'old goal', acceptance: 'old acceptance',
    next_action: 'old next', paths: ['src/'], resources: [], state: 'queued',
    created_at: now.toISOString()
  };
  const next = transition(record([], [queued]), {
    action: 'amend',
    id: 'task',
    owner: 'worker',
    acceptance: 'new acceptance',
    next_action: 'new next',
    task_class: 'architecture',
    ledger_refs: ['RFS-018', 'RFS-022'],
    reason: 'Fold discovered architecture requirements into the existing assignment.'
  }, policy, now);

  const item = next.queue[0];
  assert.equal(item.acceptance, 'new acceptance');
  assert.equal(item.task_class, 'architecture');
  assert.deepEqual(item.ledger_refs, ['RFS-018', 'RFS-022']);
  assert.equal(item.amendment_count, 1);
  assert.equal(item.amendments[0].by, 'worker');
  assert.equal(item.amendments[0].reason, 'Fold discovered architecture requirements into the existing assignment.');
  assert.deepEqual(item.amendments[0].fields, ['acceptance', 'next_action', 'task_class', 'ledger_refs']);
});

test('claimed assignment keeps branch/base identity and rejects ownership overlap', () => {
  const current = baseClaim();
  const other = baseClaim({
    id: 'other', owner: 'other', branch: 'relay/other',
    paths: ['docs/'], resources: ['docs'], base_sha: 'b'.repeat(40)
  });
  const next = transition(record([current, other]), {
    action: 'amend',
    id: 'task',
    owner: 'worker',
    acceptance: 'expanded acceptance',
    paths: ['src/', 'test/'],
    resources: ['relay-control'],
    reason: 'Add covered tests.'
  }, policy, now);

  const amended = next.claims.find((item) => item.id === 'task');
  assert.equal(amended.branch, 'relay/task');
  assert.equal(amended.base_sha, 'a'.repeat(40));
  assert.deepEqual(amended.paths, ['src/', 'test/']);

  assert.throws(() => transition(record([current, other]), {
    action: 'amend',
    id: 'task',
    owner: 'worker',
    paths: ['docs/'],
    reason: 'Unsafe overlap.'
  }, policy, now), /overlaps other/);
});

test('amend rejects wrong owner, completed work, no-op changes, and missing reason', () => {
  assert.throws(() => transition(record([baseClaim()]), {
    action: 'amend', id: 'task', owner: 'other', goal: 'x', reason: 'x'
  }, policy, now), /another owner/);

  assert.throws(() => transition(record([baseClaim({ state: 'completed' })]), {
    action: 'amend', id: 'task', owner: 'worker', goal: 'x', reason: 'x'
  }, policy, now), /Completed assignments/);

  assert.throws(() => transition(record([baseClaim()]), {
    action: 'amend', id: 'task', owner: 'worker', goal: 'old goal', reason: 'same'
  }, policy, now), /does not change/);

  assert.throws(() => transition(record([baseClaim()]), {
    action: 'amend', id: 'task', owner: 'worker', goal: 'new goal'
  }, policy, now), /reason/);
});

test('amendment audit retains all entries and total count', () => {
  let next = record([baseClaim()]);
  for (let i = 1; i <= 25; i += 1) {
    next = transition(next, {
      action: 'amend',
      id: 'task',
      owner: 'worker',
      next_action: `step ${i}`,
      reason: `checkpoint ${i}`
    }, policy, new Date(now.getTime() + i * 1000));
  }
  const item = next.claims[0];
  assert.equal(item.amendment_count, 25);
  assert.equal(item.amendments.length, 25);
  assert.equal(item.amendments[0].reason, 'checkpoint 1');
  assert.equal(item.amendments[24].reason, 'checkpoint 25');
});
