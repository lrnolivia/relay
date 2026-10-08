import {
  callRunnerControlCore,
  ControlError,
  DEFAULT_RUNNER_CONTROL_REPOSITORY,
  RUNNER_ENGINE_SHA,
  runnerControlBase,
  runnerControlRepository
} from './runner-control-core.js';
import { callProgress } from './progress-api.js';
import { callResume } from './resume-checkpoints.js';
import { feedbackToolDefinitions, callFeedbackControl } from './feedback-control.js';
import { callAssignmentUpdates } from './amendment-sync.js';
import { projectCloudStatus, deployProjectCloudVersion } from './project-cloud.js';
import { githubApiRequest } from './source.js';

const MUTATIONS = ['queue', 'claim', 'amend', 'rescope', 'heartbeat', 'hold', 'handoff', 'complete', 'retire', 'reconcile'];
const text = (max = 500) => ({ type: 'string', minLength: 1, maxLength: max });
const identity = { ...text(100), pattern: '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$' };
const projectSchema = { ...text(80), pattern: '^[a-z0-9-]+$' };
const shaSchema = { type: 'string', pattern: '^[a-f0-9]{40}$' };
const checkpointSchema = { type: 'string', pattern: '^[a-f0-9]{24}$' };
const pathsSchema = { type: 'array', minItems: 1, maxItems: 200, items: text(500), uniqueItems: true };
const resourcesSchema = { type: 'array', maxItems: 100, items: text(200), uniqueItems: true };
const ledgerRefsSchema = { type: 'array', maxItems: 50, items: identity, uniqueItems: true };
const taskClassSchema = { type: 'string', enum: ['design', 'architecture', 'maintenance'] };
const categorySchema = { type: 'string', enum: ['architecture', 'design', 'implementation', 'research', 'qa-verification', 'maintenance', 'release', 'coordination'] };
const labelSchema = {
  type: 'object',
  properties: {
    key: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z][a-z0-9.-]{0,63}$' },
    value: text(120)
  },
  required: ['key', 'value'],
  additionalProperties: false
};
const labelsSchema = { type: 'array', maxItems: 32, items: labelSchema };
const tagsSchema = { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z0-9][a-z0-9._-]{0,63}$' } };
const roleSchema = { type: 'string', minLength: 0, maxLength: 64, pattern: '^(?:|[a-z][a-z0-9-]{0,63})$' };
const supportingRolesSchema = { type: 'array', maxItems: 8, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z][a-z0-9-]{0,63}$' } };
const requestProperties = {
  id: identity,
  owner: identity,
  expected_queue_owner: identity,
  branch: text(200),
  paths: pathsSchema,
  resources: resourcesSchema,
  goal: text(2000),
  acceptance: text(4000),
  next_action: text(2000),
  reason: text(1000),
  task_class: taskClassSchema,
  ledger_refs: ledgerRefsSchema,
  category: categorySchema,
  labels: labelsSchema,
  tags: tagsSchema,
  primary_role: roleSchema,
  supporting_roles: supportingRolesSchema,
  primary_team: { type: ["string", "null"], enum: ["inspector","runner","night-shift","source","cloud","release","skills",null] },
  supporting_teams: { type: "array", maxItems: 6, uniqueItems: true, items: {type:"string",enum:["inspector","runner","night-shift","source","cloud","release","skills"]} },
  primary_staff: { type: ["string", "null"], maxLength: 80 },
  supporting_staff: { type: "array", maxItems: 8, uniqueItems: true, items: text(80) },
  successor: identity,
  disposition: { type: 'string', enum: ['cancelled', 'superseded'] },
  superseded_by: identity,
  operation_id: identity,
  expected_head_sha: { type: ['string', 'null'], pattern: '^[a-f0-9]{40}$', description: 'Retire only: exact branch head, or explicit null when the claimed branch is absent. Omit for queued work.' },
  pr: { type: 'integer', minimum: 1, maximum: 1000000 },
  work_accounted: { type: 'boolean' },
  evidence: text(4000)
};
const schema = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false
});

const DEFINITIONS = [
  ...feedbackToolDefinitions,
  {
    name: 'relay_runner_projects',
    description: 'DISCOVERY QUERY — list canonical Runner project registrations. Safe to retry. Use this when the project id is unknown; do not infer projects from chat history or fabricate runtime state.',
    inputSchema: schema({})
  },
  {
    name: 'relay_runner_project',
    description: 'QUERY — resolve one registered project with current policy, ownership, queue and record revision. Safe to retry. Read this before a managed-project mutation when policy/record revision is not already current.',
    inputSchema: schema({ project: projectSchema }, ['project'])
  },
  {
    name: 'relay_runner_assignments',
    description: 'QUERY — read canonical claims and queued assignments, including held and expired reservations. Safe to retry. Use this before relay_runner_coordinate to refresh ownership and expected_record_sha after any conflict or handoff.',
    inputSchema: schema({ project: projectSchema, assignment: identity }, ['project'])
  },
  {
    name: 'relay_runner_progress',
    description: 'QUERY — read evidence-derived execution progress for current work. Safe to retry. Progress comes from Runner/GitHub/configured Cloud evidence; claim state and next_action prose are context, not proof. Use for human status instead of inferring execution from assignment text.',
    inputSchema: schema({ project: projectSchema, assignment: identity }, ['project'])
  },
  {
    name: 'relay_runner_resume',
    description: 'QUERY — read compact deterministic resume checkpoints from canonical Runner/GitHub/Cloud evidence. Safe to retry. Call this first when resuming interrupted work; unchanged evidence reuses the checkpoint id so chat-history reconstruction is unnecessary.',
    inputSchema: schema({ project: projectSchema, assignment: identity, feedback_cursor: text(8192) }, ['project'])
  },
  {
    name: 'relay_runner_updates',
    description: 'QUERY — read only amendments newer than a monotonic cursor plus bounded caught-up recovery evidence. Safe to retry. Call at synchronization points after resume/external waits; no-change reads add no context, while history gaps or scope-changing updates require canonical reconciliation.',
    inputSchema: schema({
      project: projectSchema,
      assignment: identity,
      cursor: { type: 'integer', minimum: 0, maximum: 1000000 },
      feedback_cursor: text(8192),
      checkpoint_id: checkpointSchema,
      recovery_attempts: { type: 'integer', minimum: 0, maximum: 2 }
    }, ['project', 'assignment', 'cursor'])
  },
  {
    name: 'relay_cloud_project',
    description: 'DISCOVERY / PERMISSION QUERY — resolve canonical project-to-Cloudflare Worker authority. Safe to retry. Call before project-scoped deploys when authority is not already current; writes require both project registration and Relay\'s runtime allowlist.',
    inputSchema: schema({ project: projectSchema }, ['project'])
  },
  {
    name: 'relay_cloud_deploy_project_version',
    description: 'COMMAND — deploy an existing Cloudflare Worker version by canonical Relay project identity. Call relay_cloud_project first when authority is not already current. This changes production deployment state; it does not prove runtime correctness, so verify afterward. Project registration and the runtime allowlist must both authorize the mutation.',
    inputSchema: schema({ project: projectSchema, version_id: text(128), message: text(1000) }, ['project', 'version_id']),
    mutation: true
  },
  {
    name: 'relay_runner_preflight',
    description: 'QUERY / ADMISSION CHECK — validate live ownership, declared paths, branch/PR inventory and canonical policy before source work. Safe to retry. Call after claim/rescope and before implementation/PR publication. A pass is admission evidence only, not proof of tests or runtime correctness.',
    inputSchema: schema({ project: projectSchema, id: identity, owner: identity, paths: pathsSchema }, ['project', 'id', 'owner', 'paths'])
  },
  {
    name: 'relay_runner_audit',
    description: 'Audit branch budget, ownership overlap, expiry, registration and PR scope against Runner policy.',
    inputSchema: schema({ project: projectSchema }, ['project'])
  },
  {
    name: 'relay_runner_coordinate',
    description: 'COMMAND / TRANSACTION — perform one CAS-protected Runner queue, claim, amend, rescope, heartbeat, hold, handoff, complete, retire, or reconcile mutation. Read relay_runner_assignments/project first to obtain the current expected_record_sha and ownership. Claim resolves base_sha server-side; callers must omit it. Completion requires a verified merged PR and synchronizes its queue row. Action-specific request fields are strict: rescope requires only id, owner, paths, resources and next_action; complete requires only id, owner, pr, work_accounted=true and evidence. reason is accepted only by amend, reconcile and retire. Do not pass next_action to complete. Handoff supports queued-only assignments without starting execution. Reconcile repairs only the claimed queue row of a completed claim with matching owner and original pr; it re-verifies the merged identity, preserves acceptance, and is idempotent. Retirement records cancelled/superseded work without delivery or deletion: require current owner, disposition, reason, evidence, operation_id and expected_head_sha for claims (null only for an absent branch); superseded also requires superseded_by. Stop writers and account for retained work before retiring. On conflict/uncertain outcome, refresh canonical state before retrying; never replay blindly or take over ownership implicitly.',
    inputSchema: schema({
      project: projectSchema,
      action: { type: 'string', enum: MUTATIONS },
      expected_record_sha: shaSchema,
      request: schema(requestProperties, ['id', 'owner'])
    }, ['project', 'action', 'expected_record_sha', 'request']),
    mutation: true
  }
];

export {
  ControlError,
  DEFAULT_RUNNER_CONTROL_REPOSITORY,
  RUNNER_ENGINE_SHA,
  runnerControlBase,
  runnerControlRepository
};

export const runnerControlTools = DEFINITIONS.map(({ mutation, idempotent, ...definition }) => ({
  ...definition,
  annotations: {
    readOnlyHint: !mutation,
    destructiveHint: Boolean(mutation),
    idempotentHint: Boolean(idempotent) || !mutation,
    openWorldHint: true
  }
}));

export function validateControlArguments(value, spec, path = 'arguments') {
  if (Array.isArray(spec.type)) {
    if (value === null && spec.type.includes('null')) return;
    return validateControlArguments(value, { ...spec, type: spec.type.find(t => t !== 'null') }, path);
  }
  if (spec.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ControlError('validation', `${path} must be an object`);
    }
    for (const key of spec.required || []) {
      if (!(key in value)) throw new ControlError('validation', `${path}.${key} is required`);
    }
    for (const [key, item] of Object.entries(value)) {
      if (!Object.hasOwn(spec.properties, key)) {
        if (key === 'base_sha' && path.endsWith('.request')) {
          throw new ControlError('validation', 'base_sha is resolved automatically from live main during claim; omit request.base_sha');
        }
        throw new ControlError('validation', `${path}.${key} is unsupported`);
      }
      validateControlArguments(item, spec.properties[key], `${path}.${key}`);
    }
  } else if (spec.type === 'array') {
    if (
      !Array.isArray(value) ||
      value.length < (spec.minItems || 0) ||
      value.length > spec.maxItems ||
      (spec.uniqueItems && new Set(value).size !== value.length)
    ) {
      throw new ControlError('validation', `${path} has invalid items`);
    }
    value.forEach(item => validateControlArguments(item, spec.items, path));
  } else if (spec.type === 'string') {
    if (
      typeof value !== 'string' ||
      value.length < (spec.minLength || 0) ||
      value.length > (spec.maxLength || Infinity) ||
      (spec.pattern && !new RegExp(spec.pattern).test(value))
    ) {
      throw new ControlError('validation', `${path} is invalid`);
    }
  } else if (spec.type === 'integer') {
    if (!Number.isInteger(value) || value < spec.minimum || value > spec.maximum) {
      throw new ControlError('validation', `${path} is invalid`);
    }
  } else if (spec.type === 'boolean' && typeof value !== 'boolean') {
    throw new ControlError('validation', `${path} must be boolean`);
  }
  if (spec.enum && !spec.enum.includes(value)) {
    throw new ControlError('validation', `${path} is unsupported`);
  }
}

export async function callRunnerControl(name, args, env, apiOverride) {
  const definition = DEFINITIONS.find(item => item.name === name);
  if (!definition) return null;
  validateControlArguments(args, definition.inputSchema);
  if (name === 'relay_runner_progress') {
    const progress = await callProgress(args, env, apiOverride);
    const canonical = await callRunnerControlCore('relay_runner_assignments', args, env, apiOverride);
    const assignments = [...canonical.claims, ...canonical.queue];
    return { ...progress, progress: (progress.progress || []).map(item => {
      const assignment = assignments.find(a => a.id === item.assignment);
      return { ...item, primary_team: assignment?.primary_team || null, supporting_teams: assignment?.supporting_teams || [], primary_staff: assignment?.primary_staff || null, supporting_staff: assignment?.supporting_staff || [], goal: assignment?.goal || null };
    }) };
  }
  if (feedbackToolDefinitions.some(item => item.name === name)) return callFeedbackControl(name, args, env, apiOverride);
  if (name === 'relay_runner_resume') return callResume(args, env, apiOverride);
  if (name === 'relay_runner_updates') return callAssignmentUpdates(args, env, apiOverride);
  if (name === 'relay_cloud_project') return projectCloudStatus(env, args.project, apiOverride);
  if (name === 'relay_cloud_deploy_project_version') {
    return deployProjectCloudVersion(env, args.project, args.version_id, args.message, { github: apiOverride });
  }
  if (name === 'relay_runner_coordinate') {
    const api = apiOverride || ((path, options) => githubApiRequest(env, path, options));
    const control = runnerControlBase(env);
    const project = control === '/repos/lrnolivia/relay' && ['loew-inspector', 'loew-runner'].includes(args.project) ? 'relay' : args.project;
    const writePath = `${control}/contents/coordination/${project}.json`;
    let writeFailure = null;
    const observedApi = async (path, options) => {
      try { return await api(path, options); }
      catch (error) {
        if (path === writePath && options?.method === 'PUT') writeFailure = safeGithubFailure(error?.github);
        throw error;
      }
    };
    try { return await callRunnerControlCore(name, args, env, observedApi); }
    catch (error) {
      // Exact readback still owns the outcome. Retain only existing allowlisted
      // transport facts when the core cannot confirm the proposed transaction.
      if (error?.code === 'uncertain_write' && !error.github && writeFailure) error.github = writeFailure;
      throw error;
    }
  }
  return callRunnerControlCore(name, args, env, apiOverride);
}

export function runnerControlError(error) {
  const admission = error instanceof ControlError && error.code === 'conflict' && error.reason === 'coordination_admission';
  const status = error?.status;
  const code =
    error?.code ||
    (status === 401 ? 'auth' :
      status === 403 ? 'permission' :
      status === 429 ? 'capacity' :
      status >= 500 ? 'provider' :
      error?.name === 'TimeoutError' ? 'timeout' :
      'provider');
  return {
    ok: false,
    namespace: 'relay.RUNNER',
    ...(admission ? { mutation: 'not_attempted' } : {}),
    error: {
      class: code,
      ...(admission ? { reason: 'coordination_admission', ...safeAdmissionFindings(error.findings) } : {}),
      message: error instanceof ControlError ? error.message : 'Runner provider request failed',
      ...(safeGithubFailure(error?.github) ? { upstream: safeGithubFailure(error.github) } : {}),
      ...(error?.record_sha ? { record_sha: error.record_sha } : {}),
      retryable: code === 'capacity',
      requires_auth: code === 'auth',
      requires_user: false,
      recovery: admission
        ? 'Review the blocking findings and reconcile the current assignment before trying again; do not reclaim or overwrite another owner.'
        : code === 'uncertain_write'
        ? 'Inspect the current record and claim; never replay blindly.'
        : code === 'rate_limit'
          ? 'Respect this connection\'s recorded GitHub rate-limit window. On an authorized Codex machine, existing local Git/gh or another already-authorized transport may refresh canonical policy, ownership and admission and update the same Relay record through its supported CAS operation. Reconcile uncertain writes first; do not bypass authentication, permission or approval denials, create credentials, use unauthorized identities or evade an account-wide quota.'
        : code === 'capacity'
          ? 'Retry after provider capacity clears; refresh canonical state first if a mutation may have started.'
          : code === 'auth'
            ? 'Refresh the authorized Relay connection, then retry.'
            : code === 'permission'
              ? 'Refresh project policy/ownership and do not substitute an unauthorized control path.'
              : 'Refresh project policy, record revision and ownership before retrying.'
    },
    checked_at: new Date().toISOString()
  };
}

// Only canonical admission failures may expose these bounded coordination facts.
function safeAdmissionFindings(value) {
  const rows = Array.isArray(value) ? value : [];
  const safeText = (text, pattern) => typeof text === 'string' && pattern.test(text) ? text : null;
  const id = text => safeText(text, /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/);
  const branch = text => safeText(text, /^[A-Za-z0-9_.\/-]{1,200}$/);
  const path = text => safeText(text, /^[A-Za-z0-9_. \/-]{1,200}$/);
  const findings = [];
  for (const row of rows.slice(0,8)) {
    if (!row || !['budget','expired','missing_branch','overlap','scope_drift'].includes(row.type)) continue;
    const clean = {type: row.type};
    if (id(row.assignment)) clean.assignment = row.assignment;
    if (branch(row.branch)) clean.branch = row.branch;
    for (const key of ['count','pr']) if (Number.isSafeInteger(row[key]) && row[key] >= 0) clean[key] = row[key];
    if (Array.isArray(row.assignments)) clean.assignments = row.assignments.slice(0,8).filter(id);
    if (Array.isArray(row.paths)) {
      clean.paths = row.paths.slice(0,8).filter(path);
      if (clean.paths.length !== row.paths.length) clean.paths_truncated = true;
    }
    findings.push(clean);
    if (findings.length === 8) break;
  }
  return {findings, findings_count: rows.length, findings_truncated: findings.length !== rows.length};
}

function safeGithubFailure(value) {
  if (value?.provider !== 'github') return null;
  const result = { provider: 'github' };
  if (Number.isInteger(value.status) && value.status >= 100 && value.status <= 599) result.status = value.status;
  if (['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(value.method)) result.method = value.method;
  if (typeof value.endpoint === 'string' && value.endpoint.length <= 500 &&
      /^\/[A-Za-z0-9._%\/-]+$/.test(value.endpoint)) result.endpoint = value.endpoint;
  if (['resource_request', 'installation_discovery', 'token_mint', 'auth_selection'].includes(value.phase)) result.phase = value.phase;
  if (['github_app_installation', 'github_app_jwt', 'legacy_token', 'authenticated', 'public_read', 'none'].includes(value.auth_mode)) result.auth_mode = value.auth_mode;
  for (const key of ['rate_limit_limit', 'rate_limit_used', 'rate_limit_remaining', 'rate_limit_reset', 'retry_after_seconds','installation_id']) {
    if (Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 9999999999) result[key] = value[key];
  }
  if(/^[a-z_]{1,40}$/.test(value.rate_limit_resource||''))result.rate_limit_resource=value.rate_limit_resource;
  if(typeof value.retry_at==='string'&&value.retry_at.length<=30&&Number.isFinite(Date.parse(value.retry_at)))result.retry_at=new Date(Date.parse(value.retry_at)).toISOString();
  if(value.request_attempted===false)result.request_attempted=false;
  return result;
}
