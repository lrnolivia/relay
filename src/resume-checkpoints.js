import { readSourceRecoveryHints } from '../packages/runner/src/jobs.mjs';
import { readPendingFeedback } from "./feedback-control.js";
import { retired } from "./coordination-engine.js";
import { createHash } from "node:crypto";
import { githubApiRequest } from "./source.js";
import { callProgress } from "./progress-api.js";
import { callRunnerControlCore } from "./runner-control-core.js";

export const RESUME_CONTRACT_VERSION = "1.9.3";

const ACTIVE_CADENCE_MS = 5 * 60 * 1000;
const EXTERNAL_CADENCE_MS = 10 * 60 * 1000;
const HUMAN_CADENCE_MS = 30 * 60 * 1000;
const MAX_CHANGED_PATHS = 200;
const MAX_RECENT_COMMITS = 5;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 24);
}

function time(value) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function compactCommit(commit) {
  const message = String(commit?.commit?.message || "").split("\n")[0].slice(0, 180);
  return {
    sha: commit?.sha || null,
    at: time(commit?.commit?.committer?.date || commit?.commit?.author?.date),
    message: message || null
  };
}

function successfulEvent(events = []) {
  for (const event of events) {
    if (!event?.type) continue;
    if (event.type === "check-completed" && !["success", "neutral", "skipped"].includes(event.conclusion)) continue;
    if (["source-commit", "pull-request-opened", "pull-request-updated", "check-completed", "cloud-deployment"].includes(event.type)) {
      return event;
    }
  }
  return null;
}

function cadence(progress) {
  if (!progress || progress.state === "complete" || retired(progress)) return null;
  if (progress.state === "waiting-for-human") return HUMAN_CADENCE_MS;
  if (progress.state === "waiting-on-external-system") return EXTERNAL_CADENCE_MS;
  return ACTIVE_CADENCE_MS;
}

function qaContext(progress, assignment) {
  if (retired(assignment) || retired(progress)) return { required: false };
  const text = [progress?.waiting_reason, progress?.next_action, assignment?.next_action].filter(Boolean).join(" ");
  if (progress?.state === "waiting-for-human" || /\b(qa|review|visual|preview|human|approve|approval)\b/i.test(text)) {
    return {
      required: true,
      reason: progress?.waiting_reason || null,
      next_action: progress?.next_action || assignment?.next_action || null,
      evidence_identity: progress?.identities || {}
    };
  }
  return { required: false };
}

function checkpointCore({ project, assignment, progress, changedPaths, changedPathsTruncated, recentCommits, recordSha, policySha, pendingFeedback, sourceCheckpoints }) {
  const terminal = retired(assignment) || retired(progress);
  return {
    contract_version: RESUME_CONTRACT_VERSION,
    project,
    assignment: {
      id: assignment?.id || progress?.assignment || null,
      goal: assignment?.goal || null,
      acceptance: assignment?.acceptance || null,
      paths: assignment?.paths || [],
      resources: assignment?.resources || [],
      objective_history: assignment?.objective_history || null,
      amendments: assignment?.amendments || [],
      amendment_count: assignment?.amendment_count || 0,
      history_complete: Boolean(assignment?.objective_history) && (assignment?.amendments || []).length === (assignment?.amendment_count || 0),
      handoffs: assignment?.handoffs || [],
      owner: assignment?.owner || null,
      task_class: assignment?.task_class || null,
      category: assignment?.category || null,
      labels: Array.isArray(assignment?.labels) ? assignment.labels : [],
      tags: Array.isArray(assignment?.tags) ? assignment.tags : [],
      primary_team: assignment?.primary_team || null,
      supporting_teams: assignment?.supporting_teams || [],
      primary_staff: assignment?.primary_staff || null,
      supporting_staff: Array.isArray(assignment?.supporting_staff) ? assignment.supporting_staff : [],
      primary_role: assignment?.primary_role || null,
      supporting_roles: Array.isArray(assignment?.supporting_roles) ? assignment.supporting_roles : [],
      ledger_refs: Array.isArray(assignment?.ledger_refs) ? assignment.ledger_refs : []
    },
    state: retired(assignment) ? assignment.state : progress?.state || assignment?.state || "unknown",
    retirement: assignment?.retirement || progress?.retirement || null,
    stage: terminal ? "retired" : progress?.stage || "unknown",
    identities: progress?.identities || {
      base_sha: assignment?.base_sha || null,
      branch: assignment?.branch || null
    },
    source: {
      changed_paths: changedPaths || [],
      changed_paths_truncated: Boolean(changedPathsTruncated),
      recent_commits: recentCommits || [],
      checkpoints: sourceCheckpoints || {available:false,state:"unavailable",reason:"not-observed"}
    },
    activity: {
      worker: progress?.worker ? {
        heartbeat_at: progress.worker.heartbeat_at || null,
        freshness: progress.worker.freshness || null
      } : null,
      external: progress?.external || null,
      last_meaningful_progress_at: progress?.last_meaningful_progress_at || null,
      progress_freshness: progress?.progress_freshness || null,
      latest_event: progress?.latest_event || null,
      last_successful_action: successfulEvent(progress?.events || [])
    },
    wait: {
      reason: terminal ? null : progress?.waiting_reason || null,
      recovery_action: terminal ? null : progress?.recovery_action || null
    },
    next_action: terminal ? null : progress?.next_action || assignment?.next_action || null,
    qa_context: qaContext(progress, assignment),
    pending_feedback: pendingFeedback || { available: false, reason: "explicit-assignment-required" },
    canonical_record_sha: recordSha || null,
    policy_sha: policySha || null
  };
}

export function deriveResumeCheckpoint(input, now = new Date()) {
  const core = checkpointCore(input);
  const checkpointId = hash(core);
  const target = retired(core) ? null : cadence(input.progress);
  const generatedAt = now.toISOString();
  return {
    ...core,
    checkpoint_id: checkpointId,
    generated_at: generatedAt,
    durability: "derived-from-canonical-evidence",
    dedupe: {
      unchanged_state_reuses_checkpoint_id: true,
      key: checkpointId
    },
    observation: {
      worker_age_ms: input.progress?.worker?.age_ms ?? null
    },
    cadence: {
      target_ms: target,
      next_refresh_at: target === null ? null : new Date(now.getTime() + target).toISOString()
    },
    resume: {
      instruction: retired(core) ? "Assignment retired. Preserve its evidence; do not renew or resume it. Any future work requires fresh admission." : core.next_action || "Reconcile current canonical evidence before choosing the next action.",
      reconstruct_chat_history: false
    }
  };
}

export function sameCheckpoint(a, b) {
  return Boolean(a?.checkpoint_id && b?.checkpoint_id && a.checkpoint_id === b.checkpoint_id);
}

async function boundedPages(api, path, maxPages = 2) {
  const out = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const join = path.includes("?") ? "&" : "?";
    const part = await api(`${path}${join}per_page=100&page=${page}`);
    if (!Array.isArray(part)) return { items: out, truncated: true };
    out.push(...part);
    if (part.length < 100) return { items: out, truncated: false };
  }
  return { items: out, truncated: true };
}

async function changedPaths(api, repoBase, claim, progress) {
  const pr = progress?.identities?.pr;
  if (Number.isInteger(pr) && pr > 0) {
    try {
      const files = await boundedPages(api, `${repoBase}/pulls/${pr}/files`);
      return {
        paths: files.items.map(item => item?.filename).filter(Boolean).slice(0, MAX_CHANGED_PATHS),
        truncated: files.truncated || files.items.length > MAX_CHANGED_PATHS
      };
    } catch {}
  }
  const base = claim?.base_sha;
  const head = progress?.identities?.head_sha;
  if (base && head && base !== head) {
    try {
      const compare = await api(`${repoBase}/compare/${base}...${head}`);
      const files = Array.isArray(compare?.files) ? compare.files : [];
      return {
        paths: files.map(item => item?.filename).filter(Boolean).slice(0, MAX_CHANGED_PATHS),
        truncated: files.length > MAX_CHANGED_PATHS
      };
    } catch {}
  }
  return { paths: [], truncated: false };
}

async function recentCommits(api, repoBase, claim) {
  if (!claim?.branch) return [];
  try {
    const got = await api(`${repoBase}/commits?sha=${encodeURIComponent(claim.branch)}&per_page=${MAX_RECENT_COMMITS}`);
    return Array.isArray(got) ? got.slice(0, MAX_RECENT_COMMITS).map(compactCommit) : [];
  } catch {
    return [];
  }
}

function queuedCheckpoint(project, assignment, recordSha, policySha, now = new Date()) {
  const progress = {
    assignment: assignment.id,
    state: assignment.state,
    stage: retired(assignment) ? "retired" : "queued",
    identities: {},
    events: [],
    next_action: assignment.next_action || null
  };
  return deriveResumeCheckpoint({
    project,
    assignment,
    progress,
    changedPaths: [],
    changedPathsTruncated: false,
    recentCommits: [],
    recordSha,
    policySha
  }, now);
}

export async function callResume(args, env = {}, apiOverride, cloudOverride, now = new Date()) {
  const api = apiOverride || ((path, options) => githubApiRequest(env, path, options));
  const [project, assignments, observed] = await Promise.all([
    callRunnerControlCore("relay_runner_project", { project: args.project }, env, api),
    callRunnerControlCore("relay_runner_assignments", { project: args.project, ...(args.assignment ? { assignment: args.assignment } : {}) }, env, api),
    callProgress(args, env, api, cloudOverride)
  ]);

  const repository = project?.registration?.repository;
  if (!repository) throw new Error("Resume checkpoint cannot resolve the registered repository");
  const repoBase = `/repos/${repository}`;
  const checkpoints = [];
  const pendingFeedback = await readPendingFeedback(args, env, api);

  for (const claim of assignments.claims || []) {
    const progress = (observed.progress || []).find(item => item.assignment === claim.id) || null;
    const [paths, commits, sourceCheckpoints] = await Promise.all([
      changedPaths(api, repoBase, claim, progress),
      recentCommits(api, repoBase, claim),
      readSourceRecoveryHints(env.EVIDENCE, args.project, claim)
    ]);
    checkpoints.push(deriveResumeCheckpoint({
      project: args.project,
      assignment: claim,
      progress,
      changedPaths: paths.paths,
      changedPathsTruncated: paths.truncated,
      recentCommits: commits,
      sourceCheckpoints,
      recordSha: assignments.record_sha,
      policySha: assignments.policy_sha,
      pendingFeedback
    }, now));
  }

  for (const item of assignments.queue || []) {
    if (item.state !== "queued" && !retired(item)) continue;
    if ((assignments.claims || []).some(claim => claim.id === item.id)) continue;
    if (args.assignment && item.id !== args.assignment) continue;
    checkpoints.push(queuedCheckpoint(args.project, item, assignments.record_sha, assignments.policy_sha, now));
  }

  checkpoints.sort((a, b) => {
    const aa = Date.parse(a.activity?.last_meaningful_progress_at || a.generated_at || 0);
    const bb = Date.parse(b.activity?.last_meaningful_progress_at || b.generated_at || 0);
    return bb - aa;
  });

  return {
    ok: true,
    namespace: "relay.RUNNER",
    contract_version: RESUME_CONTRACT_VERSION,
    project: args.project,
    generated_at: now.toISOString(),
    snapshot_policy: {
      materialization: "derived-on-read",
      persistence: "canonical Runner/GitHub/Cloud evidence",
      active_target_ms: ACTIVE_CADENCE_MS,
      external_wait_target_ms: EXTERNAL_CADENCE_MS,
      human_wait_target_ms: HUMAN_CADENCE_MS,
      unchanged_state: "same checkpoint_id"
    },
    latest: checkpoints[0] || null,
    checkpoints
  };
}
