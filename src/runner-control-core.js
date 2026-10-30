import { githubApiRequest } from './source.js';
import { createHash } from 'node:crypto';
import { transition, evaluate, occupying, normalizeScope, branchBudget } from './coordination-engine.js';
import { projectCiPolicy, projectCiRoute } from './ci-routing.js';
import { guardAutonomy } from './autonomy-control.js';
import { attributedCommitBody, verifyAttributedCommit, reconcileAttributedContentsCommit } from './commit-attribution.js';
import { testMaintenanceGuidance } from './test-maintenance.js';

export const RUNNER_ENGINE_SHA = 'f5c729666a0189726377b0a977c7ef78c22b3022';
export const DEFAULT_RUNNER_CONTROL_REPOSITORY = 'lrnolivia/relay';

export class ControlError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

export function runnerControlRepository(env = {}) {
  const value = String(env?.RELAY_RUNNER_CONTROL_REPOSITORY || DEFAULT_RUNNER_CONTROL_REPOSITORY).trim();
  if (!/^lrnolivia\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new ControlError('policy', 'Invalid Runner control repository binding');
  }
  return value;
}

export function runnerControlBase(env = {}) {
  return `/repos/${runnerControlRepository(env)}`;
}

const decode = content => Buffer.from(String(content || '').replace(/\s/g, ''), 'base64').toString('utf8');

async function read(api, control, path, ref = 'main') {
  let file = await api(`${control}/contents/${path}?ref=${encodeURIComponent(ref)}`);
  // GitHub's Contents endpoint omits bytes for files above 1 MiB. Resolve
  // that exact immutable blob, retaining the original CAS identity.
  if (file?.type === 'file' && file.encoding === 'none' && !file.truncated &&
      /^[a-f0-9]{40}$/.test(file.sha) && Number.isSafeInteger(file.size) &&
      file.size > 0 && file.size <= 8 * 1024 * 1024) {
    const blob = await api(`${control}/git/blobs/${file.sha}`);
    if (blob?.encoding !== 'base64' || blob.sha !== file.sha || blob.truncated ||
        typeof blob.content !== 'string' || blob.content.length > 12 * 1024 * 1024) {
      throw new ControlError('provider', 'Runner blob response is incomplete');
    }
    const bytes = Buffer.from(blob.content.replace(/\s/g, ''), 'base64');
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (bytes.length !== file.size || blob.size !== file.size || hash !== file.sha) {
      throw new ControlError('provider', 'Runner blob identity verification failed');
    }
    file = { ...file, encoding: 'base64', content: blob.content };
  }
  if (file?.type !== 'file' || file.encoding !== 'base64' || !file.sha || file.truncated) {
    throw new ControlError('provider', 'Runner file response is incomplete');
  }
  return { sha: file.sha, content: decode(file.content) };
}

async function jsonFile(api, control, path, ref) {
  const file = await read(api, control, path, ref);
  return { ...file, value: JSON.parse(file.content) };
}

// CLI observers use the same bounded, blob-verified Contents fallback as MCP.
export { jsonFile as readRunnerJsonFile };

async function pages(api, path) {
  const items = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(result)) throw new ControlError('provider', 'Incomplete paginated inventory');
    items.push(...result);
    if (result.length < 100) return items;
  }
  throw new ControlError('capacity', 'Inventory exceeds bounded pagination; no partial admission');
}

async function registration(api, control, project) {
  const registered = await jsonFile(api, control, `projects/${project}.json`);
  const r = registered.value;
  if (
    r.id !== project ||
    r.managed !== true ||
    !/^lrnolivia\/[A-Za-z0-9_.-]+$/.test(r.repository || '') ||
    !r.default_branch
  ) {
    throw new ControlError('policy', 'Invalid managed project registration');
  }
  if (
    r.coordination?.status !== 'enabled' ||
    r.coordination.record !== `coordination/${project}.json` ||
    !Number.isInteger(r.coordination.max_active_branches) ||
    !(r.coordination.lease_hours > 0) ||
    !Array.isArray(r.implementation?.branch_prefixes) ||
    !Array.isArray(r.implementation?.excluded_branches)
  ) {
    throw new ControlError('policy', 'Project coordination is not enabled');
  }
  const record = await jsonFile(api, control, r.coordination.record);
  if (
    record.value.project !== project ||
    !Array.isArray(record.value.claims) ||
    !Array.isArray(record.value.queue) ||
    !Array.isArray(record.value.legacy_branches)
  ) {
    throw new ControlError('policy', 'Invalid coordination record');
  }
  return {
    registration: r,
    registrationSha: registered.sha,
    record,
    policy: {
      ...r.coordination,
      repository: r.repository,
      branch_prefixes: r.implementation.branch_prefixes,
      excluded_branches: r.implementation.excluded_branches
    }
  };
}

async function engineGuard(api, control) {
  const engine = await read(api, control, 'src/coordination.mjs');
  if (engine.sha !== RUNNER_ENGINE_SHA) {
    throw new ControlError('policy_drift', 'Runner engine changed; sync the exact canonical module before coordination');
  }
}

async function inventory(api, context) {
  const base = `/repos/${context.registration.repository}`;
  const branches = await pages(api, `${base}/branches`);
  const prs = await pages(api, `${base}/pulls?state=open`);
  for (const pr of prs) {
    const files = await pages(api, `${base}/pulls/${pr.number}/files`);
    pr.files = files.flatMap(file => file.previous_filename ? [file.filename, file.previous_filename] : [file.filename]);
  }
  return {
    branches,
    prs,
    findings: evaluate(context.record.value, context.policy, branches, prs)
  };
}

function preflight(context, request, data, phase = 'publication') {
  const claim = context.record.value.claims.find(
    item => item.id === request.id && item.owner === request.owner && occupying(item)
  );
  if (!claim || claim.state !== 'active' || !(Date.parse(claim.lease_until) > Date.now())) {
    throw new ControlError('ownership', 'A live active owner claim is required; held/expired reservations cannot be taken over');
  }
  request.paths.forEach(normalizeScope);
  if (request.paths.some(path => !claim.paths.some(scope => path === scope || (scope.endsWith('/') && path.startsWith(scope))))) {
    throw new ControlError('scope', 'Changed paths exceed the claim');
  }
  const blockingFindings = data.findings.filter(finding => finding.type === 'budget' || finding.assignment === claim.id || finding.assignments?.includes(claim.id));
  // A missing remote branch is expected during explicitly local preparation.
  // Every other owner, lease, scope, budget and drift finding still blocks it.
  const blockers = phase === 'local'
    ? blockingFindings.filter(finding => !(finding.type === 'missing_branch' && finding.assignment === claim.id))
    : blockingFindings;
  if (phase === 'publication' && !data.branches.some(branch => branch.name === claim.branch) && !blockers.some(finding => finding.type === 'missing_branch')) {
    blockers.push({type:'missing_branch', assignment:claim.id, branch:claim.branch});
  }
  if (blockers.length) {
    throw new ControlError('conflict', 'Coordination preflight failed', { reason: 'coordination_admission', findings: blockers });
  }
  return claim;
}

function result(context, extra) {
  return {
    ok: true,
    namespace: 'relay.RUNNER',
    project: context.registration.id,
    checked_at: new Date().toISOString(),
    record_sha: context.record.sha,
    policy_sha: context.registrationSha,
    engine_sha: RUNNER_ENGINE_SHA,
    ...extra
  };
}

async function mutate(api, control, controlRepository, context, args) {
  if (context.record.sha !== args.expected_record_sha) {
    throw new ControlError('conflict', 'Record changed; refresh ownership before resubmitting', {
      record_sha: context.record.sha
    });
  }

  const allowed = {
    queue: ['id', 'owner', 'paths', 'resources', 'goal', 'acceptance', 'next_action', 'task_class', 'ledger_refs', 'category', 'labels', 'tags', 'primary_role', 'supporting_roles', 'primary_staff', 'supporting_staff', 'primary_team', 'supporting_teams'],
    claim: ['id', 'owner', 'branch', 'paths', 'resources', 'goal', 'acceptance', 'next_action', 'task_class', 'ledger_refs', 'category', 'labels', 'tags', 'primary_role', 'supporting_roles', 'primary_staff', 'supporting_staff', 'primary_team', 'supporting_teams', 'expected_head_sha', 'reason'],
    amend: ['id', 'owner', 'card_steps', 'paths', 'resources', 'goal', 'acceptance', 'acceptance_additions', 'next_action', 'task_class', 'ledger_refs', 'category', 'labels', 'tags', 'primary_role', 'supporting_roles', 'primary_staff', 'supporting_staff', 'primary_team', 'supporting_teams', 'reason'],
    rescope: ['id', 'owner', 'paths', 'resources', 'next_action'],
    heartbeat: ['id', 'owner', 'next_action'],
    hold: ['id', 'owner', 'next_action'],
    handoff: ['id', 'owner', 'successor', 'next_action'],
    complete: ['id', 'owner', 'pr', 'work_accounted', 'evidence'],
    reconcile: ['id', 'owner', 'pr', 'expected_queue_owner', 'reason'],
    retire: ['id', 'owner', 'disposition', 'reason', 'evidence', 'operation_id', 'expected_head_sha', 'superseded_by']
  }[args.action];
  const unsupported = Object.keys(args.request).filter(key => !allowed.includes(key));

  const required = {
    queue: ['paths', 'goal', 'acceptance', 'next_action'],
    claim: ['branch', 'paths', 'goal', 'acceptance', 'next_action'],
    amend: ['reason'],
    rescope: ['paths', 'resources', 'next_action'],
    heartbeat: ['next_action'],
    hold: ['next_action'],
    handoff: ['successor', 'next_action'],
    complete: ['pr', 'work_accounted', 'evidence'],
    reconcile: ['pr'],
    retire: ['disposition', 'reason', 'evidence', 'operation_id']
  }[args.action];
  const missing = required.filter(key => !(key in args.request));
  // Report every problem at once, with the action's whole contract, so a caller fixes it in one retry.
  if (unsupported.length || missing.length) {
    const problems = [
      ...(unsupported.length ? [`${unsupported.map(key => `request.${key}`).join(', ')} ${unsupported.length === 1 ? 'is' : 'are'} unsupported for ${args.action}`] : []),
      ...(missing.length ? [`${missing.map(key => `request.${key}`).join(', ')} ${missing.length === 1 ? 'is' : 'are'} required for ${args.action}`] : [])
    ];
    const contract = `${args.action} requires id, owner${required.length ? ', ' + required.join(', ') : ''}; it also accepts ${allowed.filter(key => !['id', 'owner', ...required].includes(key)).join(', ') || 'nothing else'}`;
    throw new ControlError('validation', `${problems.join('; ')}. ${contract}.`);
  }
  if (args.action === 'claim' && ('expected_head_sha' in args.request) !== ('reason' in args.request)) {
    throw new ControlError('validation', 'Adopting an existing branch needs both request.expected_head_sha (its exact live head) and request.reason.');
  }

  const request = { ...args.request, action: args.action };
  const base = `/repos/${context.registration.repository}`;
  if (request.paths) request.paths.forEach(normalizeScope);

  if (args.action === 'claim') {
    if (context.record.value.legacy_branches.includes(request.branch)) {
      throw new ControlError('ownership', 'Legacy branch remains reserved for recovery');
    }
    const existing = (await pages(api, `${base}/branches`)).find(branch => branch.name === request.branch);
    if (existing && !('expected_head_sha' in request)) {
      throw new ControlError('ownership', 'Admission must precede branch creation. To adopt this existing branch, pass request.expected_head_sha (its exact live head) and request.reason.');
    }
    if ('expected_head_sha' in request) {
      // Adoption with evidence: only the exact live head of an existing branch, never a new or moved one.
      if (!/^[a-f0-9]{40}$/.test(request.expected_head_sha || '')) throw new ControlError('validation', 'request.expected_head_sha must be the branch\'s exact 40-character head SHA to adopt it');
      if (!existing) throw new ControlError('ownership', 'There is no existing branch to adopt; omit expected_head_sha and reason so Relay admits a new branch');
      const head = (await api(`${base}/git/ref/heads/${encodeURIComponent(request.branch)}`))?.object?.sha;
      if (head !== request.expected_head_sha) throw new ControlError('conflict', 'Branch head moved since it was read; read it again before adopting', { branch_head_sha: head || null });
      request.adopted_branch = { head_sha: head, reason: request.reason };
    }
    delete request.expected_head_sha;
    delete request.reason;
    const head = await api(`${base}/git/ref/heads/${encodeURIComponent(context.registration.default_branch)}`);
    request.base_sha = head.object.sha;
  }

  if (args.action === 'complete' || args.action === 'reconcile') {
    const claim = context.record.value.claims.find(item => item.id === request.id);
    if (!claim) throw new ControlError('ownership', 'Assignment is missing');
    if (args.action === 'reconcile' && (claim.state !== 'completed' || claim.owner !== request.owner || claim.pr !== request.pr)) throw new ControlError('ownership', 'Reconciliation requires the completed claim owner and original PR');
    const pr = await api(`${base}/pulls/${request.pr}`);
    if (
      !pr.merged ||
      !/^[a-f0-9]{40}$/.test(pr.head?.sha || '') || !/^[a-f0-9]{40}$/.test(pr.merge_commit_sha || '') ||
      pr.base.ref !== context.registration.default_branch ||
      pr.base.repo.full_name !== context.registration.repository ||
      pr.head.repo?.full_name !== context.registration.repository ||
      pr.head.ref !== claim.branch
    ) {
      throw new ControlError('policy', 'Completion requires the claimed same-repository PR merged into registered main');
    }
    request.merged_head_sha = pr.head.sha;
    request.merge_commit_sha = pr.merge_commit_sha;
  }

  if (args.action === 'retire') {
    const claim = context.record.value.claims.find(item => item.id === request.id);
    if (claim) {
      if (claim.owner !== request.owner) throw new ControlError('ownership', 'Retirement requires the current assignment owner');
      let head;
      try {
        head = (await api(`${base}/git/ref/heads/${encodeURIComponent(claim.branch)}`, { requireAuthenticated: true }))?.object?.sha;
        if (!/^[a-f0-9]{40}$/.test(head || '')) throw new ControlError('provider', 'Branch head response is incomplete');
      } catch (error) {
        if (error.status !== 404 || (error.github &&
          (error.github.phase !== 'resource_request' || error.github.auth_mode === 'public_read' || error.github.auth_mode === 'none'))) throw error;
        head = null;
      }
      // A replay returns its retained receipt even if later external activity changed the branch.
      // It still passes intent/owner validation below and never performs another write.
      request.verified_head_sha = head;
    }
  }

  let next;
  try {
    next = transition(context.record.value, request, context.policy);
  } catch (error) {
    throw new ControlError('policy', error.message);
  }

  const policy = await read(api, control, `projects/${args.project}.json`);
  if (policy.sha !== context.registrationSha) {
    throw new ControlError('policy_drift', 'Project policy changed; refresh before writing');
  }
  await engineGuard(api, control);

  const content = `${JSON.stringify(next, null, 2)}\n`;
  if (['retire', 'reconcile'].includes(args.action) && JSON.stringify(next) === JSON.stringify(context.record.value)) {
    const assignment = next.claims.find(item => item.id === request.id) || next.queue.find(item => item.id === request.id);
    return result(context, { action: args.action, claim: assignment, assignment,
      receipt: { repository: controlRepository, path: `coordination/${args.project}.json`, record_sha: context.record.sha,
        replayed: true, ...(args.action === 'retire' ? { retirement: assignment.retirement } : {}) } });
  }
  let saved;
  let writeError;
  try {
    saved = await api(`${control}/contents/coordination/${args.project}.json`, {
      method: 'PUT',
      body: attributedCommitBody({
        branch: 'main',
        sha: context.record.sha,
        message: `coordination: ${args.action} ${args.project}`,
        content: Buffer.from(content).toString('base64')
      })
    });
  } catch (error) {
    writeError = error;
  }

  let verified;
  try {
    verified = await jsonFile(api, control, `coordination/${args.project}.json`);
  } catch {
    throw new ControlError('uncertain_write', 'Write outcome cannot be verified. Read the record before retrying.', {
      expected_record_sha: context.record.sha
    });
  }

  if (verified.content !== content) {
    if (writeError?.status === 409 || writeError?.status === 422) {
      throw new ControlError('conflict', 'Concurrent transaction won; refresh before resubmitting', {
        record_sha: verified.sha
      });
    }
    throw new ControlError('uncertain_write', 'Readback differs from the proposed transaction. Reconcile current record before retrying.', {
      record_sha: verified.sha
    });
  }

  const metadata = attributedCommitBody({message: `coordination: ${args.action} ${args.project}`, branch: 'main', sha: context.record.sha});
  let attribution;
  try {
    attribution = saved?.commit?.sha
      ? await verifyAttributedCommit(api, control, saved.commit.sha, metadata)
      : await reconcileAttributedContentsCommit(api, control, `coordination/${args.project}.json`, metadata, verified.sha);
  } catch {
    throw new ControlError('uncertain_attribution', 'Record content matches but exact compliant commit metadata cannot be verified; reconcile before retrying', {record_sha: verified.sha});
  }
  const activeClaim = verified.value.claims.find(item => item.id === request.id && occupying(item));
  const queuedItem = verified.value.queue.find(item => item.id === request.id);
  const assignment = args.action === 'queue'
    ? queuedItem
    : ['amend', 'retire', 'handoff', 'reconcile'].includes(args.action)
      ? (verified.value.claims.find(item => item.id === request.id) || activeClaim || queuedItem)
      : verified.value.claims.find(item => item.id === request.id);
  return result({ ...context, record: verified }, {
    action: args.action,
    claim: assignment,
    assignment,
    receipt: {
      repository: controlRepository,
      path: `coordination/${args.project}.json`,
      previous_record_sha: context.record.sha,
      record_sha: verified.sha,
      commit_sha: attribution.sha,
      attribution,
      reconciled_after_transport_error: Boolean(writeError),
      recovery: 'Read relay_runner_assignments before another mutation; do not replay a stale revision.'
    }
  });
}

async function runnerControlQuery(name, args, env = {}, apiOverride, phase = 'publication') {
  const api = apiOverride || ((path, options) => githubApiRequest(env, path, options));
  const controlRepository = runnerControlRepository(env);
  const control = runnerControlBase(env);
  if (controlRepository === "lrnolivia/relay" && ["loew-inspector", "loew-runner"].includes(args.project)) args = { ...args, project: "relay" };

  if (name === 'relay_runner_projects') {
    const files = await api(`${control}/contents/projects?ref=main`);
    if (!Array.isArray(files) || files.length >= 1000) {
      throw new ControlError('provider', 'Project listing is incomplete');
    }
    const projects = [];
    for (const file of files.filter(item => item.type === 'file' && /^[a-z0-9-]+\.json$/.test(item.name))) {
      const project = await jsonFile(api, control, `projects/${file.name}`);
      if (project.value.alias_of) continue;
      projects.push({
        id: project.value.id,
        name: project.value.name,
        repository: project.value.repository,
        managed: project.value.managed,
        coordination: project.value.coordination?.status || 'unavailable',
        ci: projectCiPolicy(project.value),
        policy_sha: project.sha
      });
    }
    return { ok: true, checked_at: new Date().toISOString(), projects };
  }

  const context = await registration(api, control, args.project);
  if (name === 'relay_runner_project') {
    let blocked = null;
    if (args.ci) {
      try { await guardAutonomy(env, [args.project]); }
      catch (error) { if (error.code !== 'safety_control') throw error; blocked = error.message; }
    }
    const ci = await projectCiRoute(context.registration, args.ci, env, api, { blocked });
    return result(context, { registration: context.registration, coordination: context.record.value, ci });
  }
  if (name === 'relay_runner_assignments') {
    const claims = context.record.value.claims
      .filter(item => !args.assignment || item.id === args.assignment)
      .map(item => ({
        ...item,
        reserved: occupying(item),
        lease_expired: occupying(item) && !(Date.parse(item.lease_until) > Date.now())
      }));
    const queue = context.record.value.queue.filter(item => !args.assignment || item.id === args.assignment);
    return result(context, { claims, queue });
  }

  await engineGuard(api, control);
  if (name === 'relay_runner_coordinate') {
    return mutate(api, control, controlRepository, context, args);
  }

  const data = await inventory(api, context);
  if (name === 'relay_runner_preflight') {
    const claim = preflight(context, args, data, phase);
    if (phase === 'local') return result(context, {
      phase:'local-preparation', local_work_admitted:claim.id, publication_admitted:false,
      limitation:'Local preparation evidence only; no remote write, publication or host permission is granted',
      owner:claim.owner, branch:claim.branch,
      publication_blockers: data.branches.some(branch => branch.name === claim.branch) ? [] : [{type:'missing_branch',assignment:claim.id,branch:claim.branch}],
      findings:data.findings,
      test_maintenance: testMaintenanceGuidance({ category: claim.category || null })
    });
    return result(context, {
      admitted: claim.id,
      owner: claim.owner,
      branch: claim.branch,
      findings: data.findings,
      // Preflight is the start-of-work admission step for every host.
      test_maintenance: testMaintenanceGuidance({ category: claim.category || null })
    });
  }
  if (name === 'relay_runner_audit') {
    return result(context, {
      active: context.record.value.claims.filter(occupying).length,
      budget: branchBudget(context.record.value.claims, context.policy).limit,
      total_branches: data.branches.length,
      findings: data.findings,
      clean: data.findings.length === 0
    });
  }
  return null;
}

// Public MCP/remote admission remains publication-only. Local mode is a
// separate read-only native entrypoint, never a caller-controlled MCP flag.
export async function callRunnerControlCore(name, args, env = {}, apiOverride) {
  return runnerControlQuery(name, args, env, apiOverride);
}
export async function localWorkPreflight(args, env = {}, apiOverride) {
  const identity = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(value);
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !['project','id','owner','paths'].includes(key)) || !/^[a-z0-9-]+$/.test(args.project || '') || !identity(args.id) || !identity(args.owner) || !Array.isArray(args.paths) || !args.paths.length || args.paths.length > 200) throw new ControlError('validation','Local preparation requires exact project, assignment, owner and changed paths');
  const readOnly = async (path, options = {}) => {
    if (options.method && options.method !== 'GET') throw new ControlError('policy','Local preparation cannot write remote state');
    return apiOverride ? apiOverride(path, options) : githubApiRequest(env, path, options);
  };
  return runnerControlQuery('relay_runner_preflight', args, env, readOnly, 'local');
}

// Share the same verified transport across read-only consumers.
export { read as readRunnerFile };
