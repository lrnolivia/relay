import test from "node:test";
import assert from "node:assert/strict";
import { deriveResumeCheckpoint, sameCheckpoint, RESUME_CONTRACT_VERSION } from "./resume-checkpoints.js";

test('team reassignment invalidates a checkpoint while preserving staff and machine identity',()=>{
  const input={project:'relay',assignment:{id:'team-task',owner:'machine-owner',primary_team:'runner',supporting_teams:['inspector'],primary_staff:'nico',supporting_staff:['roman']},progress:{state:'working'},recordSha:'a'.repeat(40),policySha:'b'.repeat(40)};
  const first=deriveResumeCheckpoint(input);
  const next=deriveResumeCheckpoint({...input,assignment:{...input.assignment,supporting_teams:['inspector','release']}});
  assert.equal(first.assignment.primary_team,'runner');
  assert.equal(next.assignment.owner,'machine-owner');
  assert.equal(next.assignment.primary_staff,'nico');
  assert.equal(sameCheckpoint(first,next),false);
});

const assignment = {
  id: "relay-1.9.3-resume-checkpoints-20260930",
  owner: "relay-1.9.3-resume-checkpoints-20260930",
  task_class: "architecture",
  category: "architecture",
  labels: [{ key: "area", value: "Runner" }],
  tags: ["recovery"],
  primary_role: "architect",
  supporting_roles: ["verifier"],
  ledger_refs: ["RFS-020"],
  base_sha: "a".repeat(40),
  branch: "relay/1.9.3-resume-checkpoints-20260930",
  next_action: "Continue checkpoint implementation."
};

function progress(extra = {}) {
  return {
    assignment: assignment.id,
    state: "working",
    stage: "implementation",
    identities: {
      base_sha: assignment.base_sha,
      branch: assignment.branch,
      head_sha: "b".repeat(40),
      pr: null,
      pr_head_sha: null,
      merge_commit_sha: null,
      cloud_worker: "relay",
      cloud_version_id: null,
      cloud_deployment_id: null
    },
    worker: {
      heartbeat_at: "2026-10-01T00:00:00.000Z",
      freshness: "fresh",
      age_ms: 60000
    },
    external: { active: false, system: null, detail: null },
    last_meaningful_progress_at: "2026-10-01T00:00:00.000Z",
    progress_freshness: "fresh",
    latest_event: {
      id: "evt-1",
      type: "source-commit",
      at: "2026-10-01T00:00:00.000Z",
      head_sha: "b".repeat(40)
    },
    events: [
      {
        id: "evt-1",
        type: "source-commit",
        at: "2026-10-01T00:00:00.000Z",
        head_sha: "b".repeat(40)
      }
    ],
    waiting_reason: null,
    recovery_action: null,
    next_action: "Continue checkpoint implementation.",
    ...extra
  };
}

function checkpoint(p = progress(), now = new Date("2026-10-01T00:01:00.000Z")) {
  return deriveResumeCheckpoint({
    project: "relay",
    assignment,
    progress: p,
    changedPaths: ["src/resume-checkpoints.js"],
    changedPathsTruncated: false,
    recentCommits: [{
      sha: "b".repeat(40),
      at: "2026-10-01T00:00:00.000Z",
      message: "resume: checkpoint"
    }],
    recordSha: "c".repeat(40),
    policySha: "d".repeat(40)
  }, now);
}

test("checkpoint contract is compact canonical resume state", () => {
  const got = checkpoint();
  assert.equal(got.contract_version, RESUME_CONTRACT_VERSION);
  assert.equal(got.durability, "derived-from-canonical-evidence");
  assert.equal(got.assignment.task_class, "architecture");
  assert.equal(got.assignment.category, "architecture");
  assert.deepEqual(got.assignment.labels, [{ key: "area", value: "Runner" }]);
  assert.deepEqual(got.assignment.tags, ["recovery"]);
  assert.equal(got.assignment.primary_role, "architect");
  assert.deepEqual(got.assignment.supporting_roles, ["verifier"]);
  assert.deepEqual(got.assignment.ledger_refs, ["RFS-020"]);
  assert.equal(got.identities.head_sha, "b".repeat(40));
  assert.deepEqual(got.source.changed_paths, ["src/resume-checkpoints.js"]);
  assert.equal(got.resume.instruction, "Continue checkpoint implementation.");
  assert.equal(got.resume.reconstruct_chat_history, false);
  assert.equal(got.cadence.target_ms, 5 * 60 * 1000);
});

test('pending feedback and acknowledgement change checkpoint identity without becoming completion', () => {
  const input = { project: 'relay', assignment, progress: progress(), changedPaths: [], recentCommits: [] };
  const pending = deriveResumeCheckpoint({ ...input, pendingFeedback: { available: true, events: [{ report_id: 'fixture', revision: 1 }], conflicts: [] } });
  const acknowledged = deriveResumeCheckpoint({ ...input, pendingFeedback: { available: true, events: [], conflicts: [] } });
  assert.notEqual(pending.checkpoint_id, acknowledged.checkpoint_id);
  assert.equal(acknowledged.state, pending.state);
  assert.equal(acknowledged.pending_feedback.events.length, 0);
});

test("unchanged evidence dedupes across later read times and worker age ticks", () => {
  const first = checkpoint(progress({ worker: {
    heartbeat_at: "2026-10-01T00:00:00.000Z",
    freshness: "fresh",
    age_ms: 60000
  }}), new Date("2026-10-01T00:01:00.000Z"));
  const later = checkpoint(progress({ worker: {
    heartbeat_at: "2026-10-01T00:00:00.000Z",
    freshness: "fresh",
    age_ms: 299000
  }}), new Date("2026-10-01T00:04:59.000Z"));
  assert.equal(first.checkpoint_id, later.checkpoint_id);
  assert.equal(first.dedupe.key, later.dedupe.key);
  assert.equal(sameCheckpoint(first, later), true);
  assert.notEqual(first.generated_at, later.generated_at);
  assert.notEqual(first.observation.worker_age_ms, later.observation.worker_age_ms);
});

test("source identity change creates a new checkpoint", () => {
  const before = checkpoint();
  const changed = checkpoint(progress({
    identities: {
      ...progress().identities,
      head_sha: "e".repeat(40)
    },
    latest_event: {
      id: "evt-2",
      type: "source-commit",
      at: "2026-10-01T00:02:00.000Z",
      head_sha: "e".repeat(40)
    },
    events: [{
      id: "evt-2",
      type: "source-commit",
      at: "2026-10-01T00:02:00.000Z",
      head_sha: "e".repeat(40)
    }]
  }));
  assert.notEqual(before.checkpoint_id, changed.checkpoint_id);
  assert.equal(sameCheckpoint(before, changed), false);
});

test("external check wait uses slower passive cadence without calling worker stale", () => {
  const got = checkpoint(progress({
    state: "waiting-on-external-system",
    stage: "checks",
    external: {
      active: true,
      system: "github",
      detail: "Workspace checks are in_progress"
    },
    waiting_reason: "Workspace checks are in_progress",
    events: [{
      id: "evt-check",
      type: "check-started",
      at: "2026-10-01T00:00:30.000Z",
      check: "Workspace checks",
      status: "in_progress"
    }]
  }));
  assert.equal(got.state, "waiting-on-external-system");
  assert.equal(got.activity.external.active, true);
  assert.equal(got.activity.external.system, "github");
  assert.equal(got.cadence.target_ms, 10 * 60 * 1000);
  assert.equal(got.wait.reason, "Workspace checks are in_progress");
});

test("human QA wait carries exact evidence identity and avoids busy snapshots", () => {
  const got = checkpoint(progress({
    state: "waiting-for-human",
    stage: "held",
    waiting_reason: "Review live preview",
    next_action: "Human QA: verify the live preview.",
    events: []
  }));
  assert.equal(got.qa_context.required, true);
  assert.equal(got.qa_context.evidence_identity.head_sha, "b".repeat(40));
  assert.equal(got.cadence.target_ms, 30 * 60 * 1000);
});

test("successful action ignores mere check-start and selects completed success", () => {
  const got = checkpoint(progress({
    events: [
      {
        id: "start",
        type: "check-started",
        at: "2026-10-01T00:03:00.000Z",
        check: "test",
        status: "in_progress"
      },
      {
        id: "done",
        type: "check-completed",
        at: "2026-10-01T00:02:00.000Z",
        check: "admission",
        conclusion: "success"
      }
    ]
  }));
  assert.equal(got.activity.last_successful_action.id, "done");
});

test("completed work has no periodic refresh target", () => {
  const got = checkpoint(progress({
    state: "complete",
    stage: "complete",
    next_action: null
  }));
  assert.equal(got.cadence.target_ms, null);
  assert.equal(got.cadence.next_refresh_at, null);
});

test('resume binds durable staff and team changes invalidate the checkpoint',()=>{
  const input={project:'relay',assignment:{...assignment,primary_staff:'julian',supporting_staff:['roman']},progress:progress(),changedPaths:[],recentCommits:[]};
  const first=deriveResumeCheckpoint(input);
  assert.equal(first.assignment.primary_staff,'julian');
  assert.deepEqual(first.assignment.supporting_staff,['roman']);
  const next=deriveResumeCheckpoint({...input,assignment:{...input.assignment,supporting_staff:[]}});
  assert.notEqual(next.checkpoint_id,first.checkpoint_id);
});
test('retirement suppresses stale resume instructions, QA and cadence while retaining evidence', () => {
  for (const state of ['cancelled', 'superseded']) {
    const retirement = { at: '2026-10-01T00:00:00Z', intent: { evidence: 'Branch retained' } };
    const result = deriveResumeCheckpoint({ project: 'relay', assignment: { ...assignment, state, retirement, next_action: 'Renew and ask for QA' }, progress: progress({ state: 'waiting-for-human', waiting_reason: 'Approve', recovery_action: 'Renew', next_action: 'Resume old work' }) });
    assert.equal(result.state, state);
    assert.equal(result.stage, 'retired');
    assert.equal(result.next_action, null);
    assert.equal(result.cadence.next_refresh_at, null);
    assert.equal(result.cadence.target_ms, null);
    assert.equal(result.qa_context.required, false);
    assert.deepEqual(result.wait, { reason: null, recovery_action: null });
    assert.deepEqual(result.retirement, retirement);
    assert.match(result.resume.instruction, /do not renew or resume/);
  }
});
test('live resume route returns terminal queue-only work once and does not duplicate retired claim mirrors', async () => {
  const { callResume } = await import('./resume-checkpoints.js');
  const retired = { id: 'old', owner: 'worker', state: 'cancelled', branch: 'relay/old', next_action: 'Resume obsolete work', retirement: { at: '2026-10-01T00:00:00Z', intent: { evidence: 'Preserved' } } };
  const queued = { ...retired, id: 'queue-only', branch: undefined, state: 'superseded' };
  const registration = { id: 'relay', repository: 'lrnolivia/relay', managed: true, default_branch: 'main', implementation: { branch_prefixes: ['relay/'], excluded_branches: ['main'] }, coordination: { status: 'enabled', record: 'coordination/relay.json', max_active_branches: 4, lease_hours: 12 } };
  const record = { project: 'relay', claims: [retired], queue: [retired, queued], legacy_branches: ['main'] };
  const api = async path => {
    if (path.includes('/contents/')) return { type: 'file', encoding: 'base64', sha: 'a'.repeat(40), content: Buffer.from(JSON.stringify(path.includes('projects/') ? registration : record)).toString('base64') };
    if (path.includes('/branches?') || path.includes('/pulls?') || path.includes('/commits?')) return [];
    throw new Error(`Unexpected request ${path}`);
  };
  const result = await callResume({ project: 'relay' }, {}, api);
  assert.equal(result.checkpoints.length, 2);
  for (const checkpoint of result.checkpoints) {
    assert.equal(checkpoint.next_action, null);
    assert.equal(checkpoint.cadence.target_ms, null);
    assert.equal(checkpoint.retirement.intent.evidence, 'Preserved');
  }
  assert.equal(result.checkpoints.find(item => item.assignment.id === 'queue-only').state, 'superseded');
});

test('source proof changes invalidate resume identity without implying objective completion',()=>{
 const input={project:'relay',assignment,progress:progress(),recordSha:'a',policySha:'b'};
 const a=deriveResumeCheckpoint({...input,sourceCheckpoints:{available:true,state:'local_only',snapshots:[]}});
 const b=deriveResumeCheckpoint({...input,sourceCheckpoints:{available:true,state:'restore_verified',snapshots:[{job_id:'job_fixture',source:{state:'restore_verified',host_execution_verified:false}}]}});
 assert.equal(sameCheckpoint(a,b),false);assert.equal(b.source.checkpoints.state,'restore_verified');assert.equal(b.state,a.state);assert.equal(b.source.checkpoints.snapshots[0].source.host_execution_verified,false);
});
