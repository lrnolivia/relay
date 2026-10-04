import test from "node:test";
import assert from "node:assert/strict";
import { deriveObservedProgress } from "./progress-observation.js";
const now = new Date("2026-09-30T22:00:00Z");
const claim = { id:"x", state:"active", branch:"relay/x", base_sha:"a".repeat(40), created_at:"2026-09-30T21:59:00Z", updated_at:"2026-09-30T21:59:00Z", next_action:"implement" };
test("reserved claim is not confused with observed work", () => {
  const p=deriveObservedProgress({project:"relay",claim,branch:{name:"relay/x",commit:{sha:claim.base_sha}},checks:[],now});
  assert.equal(p.state,"reserved-but-idle");
});
test("running GitHub check is external wait, not frozen worker", () => {
  const p=deriveObservedProgress({project:"relay",claim,branch:{name:"relay/x",commit:{sha:"b".repeat(40)}},commit:{commit:{committer:{date:"2026-09-30T21:58:00Z"}}},checks:[{name:"test",status:"in_progress",started_at:"2026-09-30T21:59:30Z"}],now});
  assert.equal(p.state,"waiting-on-external-system"); assert.equal(p.external.system,"github");
});
test("stale work becomes officially stale without external activity", () => {
  const old={...claim,created_at:"2026-09-30T21:30:00Z",updated_at:"2026-09-30T21:30:00Z"};
  const p=deriveObservedProgress({project:"relay",claim:old,branch:{name:"relay/x",commit:{sha:"b".repeat(40)}},commit:{commit:{committer:{date:"2026-09-30T21:30:00Z"}}},checks:[],now});
  assert.equal(p.state,"officially-stale");
});
test('fresh heartbeat preserves stale progress and its exact source receipt', () => {
  const p=deriveObservedProgress({project:'relay',claim:{...claim,created_at:'2026-09-30T21:00:00Z'},branch:{commit:{sha:'b'.repeat(40)}},commit:{commit:{committer:{date:'2026-09-30T21:30:00Z'}}},now});
  assert.equal(p.worker.freshness,'fresh');
  assert.equal(p.progress_freshness,'stale');
  assert.equal(p.state,'officially-stale');
  assert.equal(p.last_meaningful_progress_at,'2026-09-30T21:30:00.000Z');
  assert.equal(p.latest_event.type,'source-commit');
  assert.equal(p.receipt.last_meaningful_progress_at,p.last_meaningful_progress_at);
});
test('a reservation and heartbeat alone never create a meaningful-progress receipt', () => {
  const p=deriveObservedProgress({project:'relay',claim,branch:{commit:{sha:claim.base_sha}},now});
  assert.equal(p.last_meaningful_progress_at,null);
  assert.equal(p.latest_event,null);
  assert.equal(p.state,'reserved-but-idle');
});

test("cloud identity ignores unrelated newer Relay deployments", () => {
  const merge="c".repeat(40), prHead="b".repeat(40);
  const cloud={
    script:"relay",
    versions:{items:[
      {id:"newer",annotations:{"workers/commit_sha":"d".repeat(40)}},
      {id:"mine",annotations:{"workers/commit_sha":merge}}
    ]},
    deployments:{deployments:[
      {id:"deploy-newer",created_on:"2026-09-30T22:01:00Z",versions:[{version_id:"newer"}]},
      {id:"deploy-mine",created_on:"2026-09-30T21:59:30Z",versions:[{version_id:"mine"}]}
    ]}
  };
  const p=deriveObservedProgress({
    project:"relay",claim,
    pullRequest:{number:60,head:{sha:prHead},merge_commit_sha:merge,created_at:"2026-09-30T21:58:30Z",updated_at:"2026-09-30T21:59:20Z"},
    checks:[],cloud,now
  });
  assert.equal(p.identities.head_sha,prHead);
  assert.equal(p.identities.merge_commit_sha,merge);
  assert.equal(p.identities.cloud_version_id,"mine");
  assert.equal(p.identities.cloud_deployment_id,"deploy-mine");
  assert.equal(p.events.some(event=>event.deployment_id==="deploy-newer"),false);
});
test('retirement dominates stale leases, failed checks and branch drift without claiming delivery', () => {
  for (const state of ['cancelled', 'superseded']) {
    const retirement = { at: '2026-09-30T21:00:00Z', intent: { reason: 'Abandoned', evidence: 'Preserved' } };
    const p = deriveObservedProgress({ project: 'relay', claim: { ...claim, state, retirement, updated_at: '2020-01-01', next_action: 'Renew and ask for QA' }, checks: [{ name: 'tests', status: 'completed', conclusion: 'failure' }, { name: 'external', status: 'in_progress' }], findings: [{ type: 'missing_branch', assignment: 'x' }], now });
    assert.equal(p.state, state);
    assert.equal(p.stage, 'retired');
    assert.equal(p.next_action, null);
    assert.equal(p.recovery_action, null);
    assert.equal(p.waiting_reason, null);
    assert.deepEqual(p.retirement, retirement);
    assert.equal(p.external.active, true); // Observed external work is not cancelled by a ledger change.
    assert.equal(p.events.some(event => event.type === 'runner-heartbeat'), false);
  }
});
