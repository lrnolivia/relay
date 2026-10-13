import { createHash } from 'node:crypto';
import { callRunnerControlCore, ControlError } from './runner-control-core.js';
import { githubApiRequest } from './source.js';
import { submitTextFeedback, getTextFeedback, acknowledgeTextFeedback, peekFeedback } from '../packages/runner/src/qa-feedback.mjs';

const string = (maxLength, pattern) => ({ type: 'string', minLength: 1, maxLength, ...(pattern ? { pattern } : {}) });
const identifier = string(100, '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$');
const sha = string(40, '^[a-f0-9]{40}$');
const object = (properties, required) => ({ type: 'object', properties, required, additionalProperties: false });
const scope = { project: string(80, '^[a-z0-9-]+$'), assignment: identifier };
const reportId = string(68, '^fbr_[a-f0-9]{64}$');
const artifact = object({ repository: string(160, '^lrnolivia/[A-Za-z0-9_.-]+$'), commit_sha: sha,
  kind: { type: 'string', enum: ['source', 'runtime'], description: 'source: observations about the source at this SHA; runtime: observations about a tested running artifact. Omission remains unverified. A source SHA alone never identifies a tested runtime.' },
  pr: { type: 'integer', minimum: 1, maximum: 1000000 }, deployment_id: string(128),
  runtime_sha256: string(64, '^[a-f0-9]{64}$') }, ['repository', 'commit_sha']);
const reviewMode = { review_mode: { type: 'string', enum: ['current', 'historical'], description: 'Historical preserves review of a verified completed claim; never reopens or routes new implementation.' } };
const expected = { expected_owner: identifier, expected_branch: string(240) };

export const feedbackToolDefinitions = [
  { name: 'relay_runner_feedback_submit', mutation: true, idempotent: true,
    description: 'COMMAND — durably save verbatim text feedback for an explicit assignment and tested artifact using an operation id. Declare artifact.kind source or runtime; omitted kind and runtime without independently matched identity remain unverified. Identical retries reuse the receipt; changed intent conflicts. Does not wake, message or prove delivery to a native worker.',
    inputSchema: object({ ...scope, ...reviewMode, ...expected, operation_id: identifier, original_text: string(8192), artifact,
      related_report_id: reportId }, [...Object.keys(scope), ...Object.keys(expected), 'operation_id', 'original_text', 'artifact']) },
  { name: 'relay_runner_feedback_peek', description: 'QUERY — read one bounded pending-feedback page for an explicit assignment. Never acknowledges or marks delivered. Follow next_cursor while truncated; restart completed scans to catch new reports.',
    inputSchema: object({ ...scope, ...reviewMode, cursor: string(8192), limit: { type: 'integer', minimum: 1, maximum: 20 } }, Object.keys(scope)) },
  { name: 'relay_runner_feedback_status', description: 'QUERY — inspect one exact text report and receipt history without writing. Saved, queued, delivered, seen, incorporated, fixed and verified are distinct facts; absent evidence stays unknown.',
    inputSchema: object({ ...scope, ...reviewMode, report_id: reportId }, [...Object.keys(scope), 'report_id']) },
  { name: 'relay_runner_feedback_ack', mutation: true, idempotent: true,
    description: 'COMMAND — explicitly record an authenticated caller acknowledgement for an exact report revision and current assignment owner/artifact. This reports seen only; it does not prove native delivery, incorporation, a fix or verification. Read status before acknowledging.',
    inputSchema: object({ ...scope, ...reviewMode, ...expected, report_id: reportId, operation_id: identifier,
      expected_revision: { type: 'integer', minimum: 1, maximum: 1000000 }, expected_head_sha: sha },
    [...Object.keys(scope), ...Object.keys(expected), 'report_id', 'operation_id', 'expected_revision', 'expected_head_sha']) }
];

export function feedbackActor(access) {
  // Only the already verified access object is accepted here, never tool args.
  const subject = access?.claims?.sub;
  return typeof subject === 'string' && subject.length <= 1000
    ? 'access-sub-sha256:' + createHash('sha256').update(subject).digest('hex')
    : 'authenticated-mcp-caller-unattributed';
}

export async function resolveFeedbackTarget(args, env = {}, apiOverride) {
  const api = apiOverride || ((path, options) => githubApiRequest(env, path, options));
  const project = await callRunnerControlCore('relay_runner_project', { project: args.project }, env, api);
  const claim = project.coordination.claims.find(item => item.id === args.assignment);
  if (!claim) throw new ControlError('not_found', 'Feedback requires an explicit existing assignment claim');
  const repository = project.registration.repository;
  const terminal = ['completed', 'cancelled', 'superseded'].includes(claim.state);
  if (args.review_mode === 'historical') {
    if (claim.state !== 'completed' || !claim.work_accounted || !Number.isInteger(claim.pr))
      throw new ControlError('conflict', 'Historical feedback requires a verified completed claim');
    const pr = await api(`/repos/${repository}/pulls/${claim.pr}`);
    if (!pr.merged || pr.base?.ref !== project.registration.default_branch || pr.base?.repo?.full_name !== repository ||
        pr.head?.repo?.full_name !== repository || pr.head?.ref !== claim.branch ||
        pr.head?.sha !== claim.merged_head_sha || pr.merge_commit_sha !== claim.merge_commit_sha ||
        !/^[a-f0-9]{40}$/.test(claim.merged_head_sha || '') || !/^[a-f0-9]{40}$/.test(claim.merge_commit_sha || ''))
      throw new ControlError('conflict', 'Historical merged artifact identity could not be verified');
    return { project: args.project, assignment: claim.id, owner: claim.owner, branch: claim.branch,
      repository, commit_sha: claim.merged_head_sha, historical: true,
      completed_commits: [claim.merged_head_sha, claim.merge_commit_sha], pr: claim.pr,
      terminal: true, claim_state: claim.state, record_sha: project.record_sha };
  }
  let head = null;
  try { head = (await api(`/repos/${repository}/git/ref/heads/${encodeURIComponent(claim.branch)}`))?.object?.sha; }
  catch (error) { if (!(terminal && error.status === 404)) throw error; }
  if (!terminal && !/^[a-f0-9]{40}$/.test(head || '')) throw new ControlError('provider', 'Current assignment head is unavailable');
  return { project: args.project, assignment: claim.id, owner: claim.owner, branch: claim.branch,
    repository, commit_sha: head, terminal, claim_state: claim.state, record_sha: project.record_sha };
}

function assertExpected(args, target) {
  if (target.terminal && !target.historical) throw new ControlError('conflict', 'Assignment is terminal; preserve history and reconcile before writing');
  if (!target.historical && !['active', 'held'].includes(target.claim_state)) throw new ControlError('conflict', 'Assignment state is not supported for feedback writes');
  if (args.expected_owner !== target.owner || args.expected_branch !== target.branch)
    throw new ControlError('conflict', 'Assignment owner or branch changed; refresh before writing feedback');
}

export async function readPendingFeedback(args, env = {}, apiOverride) {
  if (!args.assignment) return { available: false, events: [], conflicts: [], reason: 'explicit-assignment-required', next_cursor: null, truncated: false };
  try {
    const target = await resolveFeedbackTarget(args, env, apiOverride);
    return { ...await peekFeedback(env.EVIDENCE, target, { cursor: args.feedback_cursor, limit: 10 }), target };
  } catch (error) {
    return { available: false, events: [], conflicts: [], reason: error.code || 'provider-unavailable', next_cursor: null, truncated: false };
  }
}

export async function callFeedbackControl(name, args, env = {}, apiOverride) {
  const api = apiOverride || ((path, options) => githubApiRequest(env, path, options));
  const target = await resolveFeedbackTarget(args, env, api);
  const actor = env.RELAY_FEEDBACK_ACTOR || 'authenticated-caller-unattributed';
  let result;
  if (name === 'relay_runner_feedback_peek') {
    result = await peekFeedback(env.EVIDENCE, target, args);
  } else if (name === 'relay_runner_feedback_status') {
    result = await getTextFeedback(env.EVIDENCE, target, args.report_id);
  } else {
    assertExpected(args, target);
    if (name === 'relay_runner_feedback_submit') {
      if (!args.original_text.trim()) throw new ControlError('validation', 'Feedback text must not be blank');
      if (args.artifact.repository !== target.repository) throw new ControlError('conflict', 'Tested repository does not match the registered assignment');
      if (target.historical && (!target.completed_commits.includes(args.artifact.commit_sha) || (args.artifact.pr && args.artifact.pr !== target.pr))) throw new ControlError('conflict', 'Historical feedback must name the exact completed artifact');
      if (args.artifact.pr) {
        const pr = await api(`/repos/${target.repository}/pulls/${args.artifact.pr}`);
        if (pr.head?.repo?.full_name !== target.repository || pr.head?.ref !== target.branch)
          throw new ControlError('conflict', 'Pull request does not match the assignment repository and branch');
        target.pr = args.artifact.pr;
      }
      if (target.historical && (!target.completed_commits.includes(args.artifact.commit_sha) || (args.artifact.pr && args.artifact.pr !== target.pr))) throw new ControlError('conflict', 'Historical feedback must name the exact completed artifact');
      const identity = { ...(target.historical ? { review_mode: 'historical' } : {}), project: target.project, assignment: target.assignment, owner: target.owner, branch: target.branch, ...args.artifact };
      result = await submitTextFeedback(env.EVIDENCE, { target, identity, actor, operation_id: args.operation_id,
        original_text: args.original_text, related_report_id: args.related_report_id });
    } else {
      if (target.historical ? !target.completed_commits.includes(args.expected_head_sha) : args.expected_head_sha !== target.commit_sha) throw new ControlError('conflict', 'Assignment head changed before acknowledgement');
      const report = await getTextFeedback(env.EVIDENCE, target, args.report_id);
      if (target.historical && report.identity.commit_sha !== args.expected_head_sha) throw new ControlError('conflict', 'Historical acknowledgement must name the report artifact');
      if (report.identity.pr) {
        const pr = await api(`/repos/${target.repository}/pulls/${report.identity.pr}`);
        if (pr.head?.repo?.full_name !== target.repository || pr.head?.ref !== target.branch)
          throw new ControlError('conflict', 'Report pull request no longer matches the assignment');
        target.pr = report.identity.pr;
      }
      result = await acknowledgeTextFeedback(env.EVIDENCE, { target, actor, ...args });
    }
    // Provider identity reads and storage are not an atomic cross-system write.
    // Preserve any report already written, and report a raced handoff honestly.
    try {
      const current = await resolveFeedbackTarget(args, env, api);
      const changed = ['owner', 'branch', 'repository', 'commit_sha', 'terminal'].some(key => current[key] !== target[key]);
      if (changed) return { ok: false, namespace: 'relay.RUNNER', report: result, reconcile_required: true,
        error: { class: 'identity_changed_after_write', message: 'Write retained; canonical identity changed. Inspect status before further action.' } };
    } catch {
      return { ok: false, namespace: 'relay.RUNNER', report: result, reconcile_required: true,
        error: { class: 'identity_recheck_unavailable', message: 'Write retained; canonical identity recheck unavailable. Inspect status.' } };
    }
  }
  return { ok: true, namespace: 'relay.RUNNER', project: target.project, assignment: target.assignment,
    record_sha: target.record_sha, feedback: result };
}
