import { retired } from "./coordination-engine.js";
import { PROGRESS_POLICY, freshness } from "./operations.js";
import { progressEvent, dedupeProgressEvents } from "./operation-events.js";
import { progressReceipt } from "./operation-receipts.js";
import { reconcileExecution } from "./progress-reconciliation.js";

const ts = value => { const ms = Date.parse(value || ""); return Number.isFinite(ms) ? new Date(ms).toISOString() : null; };
const deployments = cloud => Array.isArray(cloud?.deployments) ? cloud.deployments : Array.isArray(cloud?.deployments?.deployments) ? cloud.deployments.deployments : [];
const versions = cloud => Array.isArray(cloud?.versions) ? cloud.versions : Array.isArray(cloud?.versions?.items) ? cloud.versions.items : [];

export function deriveObservedProgress({ project, claim, branch, commit, pullRequest, checks = [], cloud, findings = [], now = new Date(), policy = PROGRESS_POLICY }) {
  const events = [];
  if (claim?.created_at) events.push(progressEvent("claim-created", claim.created_at, { branch: claim.branch }));
  if (claim?.retirement?.at) events.push(progressEvent("assignment-retired", claim.retirement.at, { state: claim.state }));
  if (claim?.updated_at && !retired(claim)) events.push(progressEvent("runner-heartbeat", claim.updated_at, { state: claim.state }));
  const commitAt = ts(commit?.commit?.committer?.date || commit?.commit?.author?.date);
  if (branch?.commit?.sha && commitAt) events.push(progressEvent("source-commit", commitAt, { head_sha: branch.commit.sha }));
  if (pullRequest?.created_at) events.push(progressEvent("pull-request-opened", pullRequest.created_at, { pr: pullRequest.number }));
  if (pullRequest?.updated_at && pullRequest.updated_at !== pullRequest.created_at) events.push(progressEvent("pull-request-updated", pullRequest.updated_at, { pr: pullRequest.number, state: pullRequest.state }));
  for (const check of checks) {
    if (check?.started_at) events.push(progressEvent("check-started", check.started_at, { check: check.name, status: check.status }));
    if (check?.completed_at) events.push(progressEvent("check-completed", check.completed_at, { check: check.name, conclusion: check.conclusion }));
  }
  const cloudDeployments = deployments(cloud);
  const cloudVersions = versions(cloud);
  const sourceIdentity = pullRequest?.merge_commit_sha || claim?.merge_commit_sha || branch?.commit?.sha || claim?.merged_head_sha || null;
  const matchedVersion = sourceIdentity
    ? cloudVersions.find(version => version?.annotations?.["workers/commit_sha"] === sourceIdentity) || null
    : null;
  const matchedDeployment = matchedVersion
    ? cloudDeployments.find(deployment => Array.isArray(deployment?.versions) && deployment.versions.some(item => item?.version_id === matchedVersion.id)) || null
    : null;
  if (matchedDeployment?.created_on) events.push(progressEvent("cloud-deployment", matchedDeployment.created_on, { deployment_id: matchedDeployment.id }));
  const ordered = dedupeProgressEvents(events);
  // A lease renewal proves worker liveness, not source or delivery progress.
  const latest = ordered.find(event => !["runner-heartbeat", "claim-created"].includes(event.type)) || null;
  const workerFreshness = freshness(claim?.updated_at || claim?.created_at, now, policy);
  const progressFreshness = freshness(latest?.at || claim?.created_at, now, policy);
  const runningCheck = checks.find(check => check?.status && check.status !== "completed");
  const failedCheck = checks.find(check => check?.status === "completed" && !["success","neutral","skipped"].includes(check?.conclusion));
  const reconciliation = reconcileExecution(claim, findings);
  let state = "working", stage = "implementation", waiting_reason = null, recovery_action = null;
  if (retired(claim)) { state = claim.state; stage = "retired"; }
  else if (claim?.state === "completed") { state = "complete"; stage = "complete"; }
  else if (claim?.state === "held") {
    state = /human|approval|review|await/i.test(claim?.next_action || "") ? "waiting-for-human" : "blocked";
    stage = "held"; waiting_reason = claim?.next_action || "Runner claim is held"; recovery_action = claim?.next_action || null;
  } else if (failedCheck) {
    state = "failed"; stage = "checks"; waiting_reason = `${failedCheck.name || "check"} failed`;
    recovery_action = "Inspect the failed check, repair on the claimed branch, and rerun validation.";
  } else if (runningCheck) {
    state = "waiting-on-external-system"; stage = "checks"; waiting_reason = `${runningCheck.name || "GitHub check"} is ${runningCheck.status}`;
  } else if (progressFreshness.state === "stale") {
    state = "officially-stale"; stage = "stale"; recovery_action = "Reconcile worker heartbeat and current GitHub/Cloud evidence before resuming.";
  } else if (progressFreshness.state === "possibly-stale") {
    state = "possibly-stale"; stage = "liveness-check"; recovery_action = "Check external activity; otherwise renew or recover the worker.";
  } else if (branch?.commit?.sha === claim?.base_sha && !pullRequest) {
    state = "reserved-but-idle"; stage = "reserved";
  } else if (pullRequest) stage = "pull-request";
  if (reconciliation.disposition === "reconciliation-required" && !["complete","failed"].includes(state)) {
    state = "blocked"; stage = "reconciliation"; recovery_action = "Reconcile Runner ownership with live branch/PR inventory.";
  }
  const identities = {
    base_sha: claim?.base_sha || null, branch: claim?.branch || null,
    head_sha: branch?.commit?.sha || pullRequest?.head?.sha || claim?.merged_head_sha || null,
    pr: pullRequest?.number || claim?.pr || null,
    pr_head_sha: pullRequest?.head?.sha || claim?.merged_head_sha || null,
    merge_commit_sha: pullRequest?.merge_commit_sha || claim?.merge_commit_sha || null,
    cloud_worker: cloud?.script || null, cloud_version_id: matchedVersion?.id || null,
    cloud_deployment_id: matchedDeployment?.id || null
  };
  const receipt = progressReceipt({ project, assignment: claim?.id, stage, state, last_meaningful_progress_at: latest?.at || null, identities, latest_event: latest });
  return {
    assignment: claim?.id, observed: true, state, stage,
    worker: { heartbeat_at: ts(claim?.updated_at || claim?.created_at), freshness: workerFreshness.state, age_ms: workerFreshness.age_ms },
    external: { active: Boolean(runningCheck), system: runningCheck ? "github" : null, detail: waiting_reason },
    last_meaningful_progress_at: latest?.at || null, progress_freshness: progressFreshness.state,
    latest_event: latest, events: ordered, identities, waiting_reason, recovery_action, reconciliation, receipt,
    retirement: claim?.retirement || null,
    next_action: retired(claim) ? null : claim?.next_action || null
  };
}
