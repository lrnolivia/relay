import { normalizeAssignmentStaff } from "./staff-registry.js";
// Deterministic admission rules; expired leases retain ownership until reconciliation.
export const retired = (claim) => ['cancelled', 'superseded'].includes(claim?.state);
export const occupying = (claim) => claim.state !== 'completed' && !retired(claim);

export function normalizeScope(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') || value.split('/').some((p, i, parts) => p === '..' || p === '.' || (!p && i < parts.length - 1)) || value.includes('*')) {
    throw new Error('Scopes must be repository-relative files or directory prefixes ending in /. Globs are not supported.');
  }
  return value;
}

export function overlaps(a, b) {
  return a === b || (a.endsWith('/') && b.startsWith(a)) || (b.endsWith('/') && a.startsWith(b));
}

export function covered(file, scopes) {
  return scopes.some((scope) => file === scope || (scope.endsWith('/') && file.startsWith(scope)));
}

const TASK_CLASSES = new Set(['design', 'architecture', 'maintenance']);
const CATEGORIES = new Set(['architecture', 'design', 'implementation', 'research', 'qa-verification', 'maintenance', 'release', 'coordination']);
const ROLE_ID = /^[a-z][a-z0-9-]{0,63}$/;
const TAG_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const LABEL_KEY = /^[a-z][a-z0-9.-]{0,63}$/;
const AMENDABLE_FIELDS = ['goal', 'acceptance', 'next_action', 'paths', 'resources', 'task_class', 'ledger_refs', 'category', 'labels', 'tags', 'primary_role', 'supporting_roles', 'primary_staff', 'supporting_staff', 'primary_team', 'supporting_teams'];

function normalizeResources(values) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !value)) throw new Error('Resources must be a valid string array.');
  return [...new Set(values)];
}
function normalizeTaskClass(value) {
  if (value === undefined) return undefined;
  if (!TASK_CLASSES.has(value)) throw new Error('Task class must be design, architecture, or maintenance.');
  return value;
}
function normalizeLedgerRefs(values) {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length > 50 || values.some((value) => typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(value))) throw new Error('Ledger refs must be stable identifiers.');
  return [...new Set(values)];
}
function normalizeCategory(value) {
  if (value === undefined) return undefined;
  if (!CATEGORIES.has(value)) throw new Error('Invalid assignment category.');
  return value;
}
function normalizeLabels(values) {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length > 32) throw new Error('Assignment labels must be a bounded array.');
  const seen = new Set();
  return values.map((label) => {
    if (!label || typeof label !== 'object' || Array.isArray(label) || !LABEL_KEY.test(label.key || '') || typeof label.value !== 'string' || !label.value.trim() || label.value.length > 120) throw new Error('Invalid assignment label.');
    const key = label.key + '=' + label.value;
    if (seen.has(key)) throw new Error('Duplicate assignment label.');
    seen.add(key);
    return { key: label.key, value: label.value };
  });
}
function normalizeTags(values) {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length > 32) throw new Error('Assignment tags must be a bounded array.');
  const tags = values.map((value) => String(value).toLowerCase());
  if (tags.some((value) => !TAG_ID.test(value)) || new Set(tags).size !== tags.length) throw new Error('Invalid or duplicate assignment tag.');
  return tags;
}
function normalizePrimaryRole(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !ROLE_ID.test(value)) throw new Error('Invalid primary role.');
  return value;
}
function normalizeSupportingRoles(values) {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length > 8 || values.some((value) => typeof value !== 'string' || !ROLE_ID.test(value)) || new Set(values).size !== values.length) throw new Error('Invalid supporting roles.');
  return [...values];
}
function validateRoleMetadata(primary, supporting) {
  if (primary && Array.isArray(supporting) && supporting.includes(primary)) throw new Error('Primary role cannot also be supporting.');
}
function metadataFields(request) {
  const metadata = {};
  if ('category' in request) metadata.category = normalizeCategory(request.category);
  if ('labels' in request) metadata.labels = normalizeLabels(request.labels);
  if ('tags' in request) metadata.tags = normalizeTags(request.tags);
  if ('primary_role' in request) metadata.primary_role = normalizePrimaryRole(request.primary_role);
  if ('supporting_roles' in request) metadata.supporting_roles = normalizeSupportingRoles(request.supporting_roles);
  validateRoleMetadata(metadata.primary_role, metadata.supporting_roles);
  return metadata;
}
function preserveObjective(target, now, source='first-observed-current-record') {
  if(target.objective_history)return;
  target.objective_history={baseline:{goal:target.goal,acceptance:target.acceptance,at:now.toISOString(),source},
    acceptance_versions:[{id:target.id+':acceptance:0',text:target.acceptance,at:now.toISOString()}]};
}
function appendAmendment(target, request, fields, before, now) {
  const entry = {
    at: now.toISOString(), by: request.owner, reason: request.reason, fields,
    before: Object.fromEntries(fields.map((field) => [field, structuredClone(before[field] ?? null)])),
    after: Object.fromEntries(fields.map((field) => [field, structuredClone(target[field] ?? null)]))
  };
  target.amendment_count = Number(target.amendment_count || 0) + 1;
  target.amendments = [...(Array.isArray(target.amendments) ? target.amendments : []), entry];
  if(fields.includes('acceptance'))target.objective_history.acceptance_versions.push({id:target.id+':acceptance:'+target.amendment_count,text:target.acceptance,at:now.toISOString(),reason:request.reason});
}

export function transition(record, request, policy, now = new Date()) {
  if (record.migration_frozen) throw new Error("Control authority migrated to " + record.migration_frozen.canonical_repository + "; refresh canonical Relay state before writing.");
  const next = structuredClone(record);
  const claims = next.claims;
  const current = claims.find((c) => c.id === request.id);
  const queued = next.queue.find((q) => q.id === request.id);
  if (!request.id || !request.owner) throw new Error('Stable assignment id and owner id are required.');
  if (request.action === 'reconcile') {
    if (!current || current.state !== 'completed' || !queued) throw new Error('Reconciliation requires a completed claim and its queue row.');
    if (current.owner !== request.owner) throw new Error('Reconciliation requires current claim ownership.');
    const historicalOwner = queued.owner !== current.owner;
    if(historicalOwner && (request.expected_queue_owner !== queued.owner || typeof request.reason !== 'string' || !request.reason.trim())) throw new Error('Historical queue ownership requires its exact expected owner and an explicit reconciliation reason.');
    if(request.expected_queue_owner && request.expected_queue_owner !== queued.owner)throw new Error('Queue ownership changed; refresh before reconciliation.');
    if (!['claimed', 'completed'].includes(queued.state)) throw new Error('Reconciliation cannot replace a queued or retired disposition.');
    if (current.work_accounted !== true || !current.evidence?.trim() || !current.completed_at ||
        !Number.isInteger(current.pr) || current.pr < 1 || request.pr !== current.pr ||
        !/^[a-f0-9]{40}$/.test(current.merged_head_sha || '') || !/^[a-f0-9]{40}$/.test(current.merge_commit_sha || '') ||
        request.merged_head_sha !== current.merged_head_sha || request.merge_commit_sha !== current.merge_commit_sha) {
      throw new Error('Reconciliation requires the original completion and server-verified merged PR identity.');
    }
    if (queued.state === 'completed') return next;
    // Only mirror lifecycle metadata. Neither copy's acceptance or historical evidence is rewritten.
    Object.assign(queued, { state: 'completed', completed_at: current.completed_at, updated_at: now.toISOString() });
    if(historicalOwner)queued.completion_reconciliation={at:now.toISOString(),queue_owner:queued.owner,completion_owner:current.owner,reason:request.reason,pr:current.pr,merged_head_sha:current.merged_head_sha,merge_commit_sha:current.merge_commit_sha,ownership_transferred:false};
    next.updated_at = now.toISOString();
    return next;
  }
  if (request.action === 'handoff' && !current) {
    if (!queued || queued.state !== 'queued') throw new Error('Queued handoff requires a queued-only assignment.');
    if (queued.owner !== request.owner) throw new Error('Queued assignment belongs to another owner.');
    if (!request.successor || request.successor === request.owner || !request.next_action) throw new Error('A handoff requires a distinct successor and next action.');
    queued.handoffs = [...(queued.handoffs || []), { at: now.toISOString(), from: request.owner, to: request.successor, next_action: request.next_action }];
    Object.assign(queued, { owner: request.successor, next_action: request.next_action, updated_at: now.toISOString() });
    next.updated_at = now.toISOString();
    return next;
  }
  if (request.action === 'retire') {
    const target = current || queued;
    if (!target || target.owner !== request.owner) throw new Error('Retirement requires the current assignment owner.');
    if (!['cancelled', 'superseded'].includes(request.disposition)) throw new Error('Retirement requires cancelled or superseded disposition.');
    for (const [key, max] of [['reason', 1000], ['evidence', 4000], ['operation_id', 100]]) {
      if (typeof request[key] !== 'string' || !request[key].trim() || request[key].length > max) throw new Error(`Retirement requires bounded ${key}.`);
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(request.operation_id)) throw new Error('Invalid retirement operation identity.');
    if (request.disposition === 'cancelled' && request.superseded_by !== undefined) throw new Error('Cancellation cannot name a successor.');
    if (request.disposition === 'superseded' && (!request.superseded_by || request.superseded_by === request.id)) throw new Error('Supersession requires a distinct successor assignment.');
    if (current) {
      if (!Object.hasOwn(request, 'expected_head_sha') || (request.expected_head_sha !== null && !/^[a-f0-9]{40}$/.test(request.expected_head_sha))) throw new Error('Retirement requires an expected branch head or explicit null for a missing branch.');
    } else if (Object.hasOwn(request, 'expected_head_sha')) throw new Error('Queued retirement has no branch head.');
    const intent = { operation_id: request.operation_id, owner: request.owner, disposition: request.disposition,
      reason: request.reason, evidence: request.evidence, superseded_by: request.superseded_by || null,
      branch: current?.branch || null, head_sha: current ? request.expected_head_sha : null };
    const previous = [...claims, ...next.queue].find(item => item.retirement?.intent?.operation_id === request.operation_id);
    if (previous) {
      if (previous.id !== request.id || JSON.stringify(previous.retirement.intent) !== JSON.stringify(intent)) throw new Error('Retirement operation identity already has different intent.');
      if (!retired(target) || target.state !== request.disposition) throw new Error('Retirement receipt conflicts with assignment state.');
      return next;
    }
    if ((current && !occupying(current)) || (!current && queued.state !== 'queued')) throw new Error('Only reserved claims or queued assignments can be retired.');
    if (current && (!Object.hasOwn(request, 'verified_head_sha') || request.verified_head_sha !== request.expected_head_sha)) throw new Error('Retirement requires server-verified current branch identity.');
    if (request.disposition === 'superseded') {
      const successor = claims.find(item => item.id === request.superseded_by) || next.queue.find(item => item.id === request.superseded_by);
      if (!successor || !occupying(successor) || (!claims.includes(successor) && successor.state !== 'queued')) throw new Error('Supersession requires an existing nonterminal successor assignment.');
    }
    target.retirement = { at: now.toISOString(), intent };
    target.state = request.disposition;
    target.updated_at = now.toISOString();
    if (current && queued) {
      queued.state = request.disposition;
      queued.updated_at = target.updated_at;
      queued.retirement = structuredClone(target.retirement);
    }
    next.updated_at = now.toISOString();
    return next;
  }
  if (request.action === 'queue') {
    if (current || queued) throw new Error('Assignment already exists; resume it.');
    if (!request.goal || !request.acceptance || !request.next_action || !request.paths?.length) throw new Error('Queue requires goal, acceptance, next action and proposed paths.');
    next.queue.push({ id: request.id, owner: request.owner, goal: request.goal, acceptance: request.acceptance,
      next_action: request.next_action, paths: request.paths.map(normalizeScope), resources: normalizeResources(request.resources ?? []),
      ...(request.task_class ? { task_class: normalizeTaskClass(request.task_class) } : {}),
      ...(request.ledger_refs ? { ledger_refs: normalizeLedgerRefs(request.ledger_refs) } : {}),
      ...metadataFields(request),
      ...normalizeAssignmentStaff(request),
      state: 'queued', created_at: now.toISOString() });
    preserveObjective(next.queue.at(-1),now,'assignment-created');
    next.updated_at = now.toISOString();
    return next;
  }
  if (request.action === 'amend') {
    if (typeof request.reason !== 'string' || !request.reason.trim() || request.reason.length > 1000) throw new Error('Amendment requires a concise reason.');
    if (current && !occupying(current)) throw new Error(current.state === 'completed' ? 'Completed assignments cannot be amended.' : 'Retired assignments cannot be amended.');
    const target = current || (queued?.state === 'queued' ? queued : null);
    if (!target) throw new Error('Amendment requires a queued or active assignment.');
    if (target.owner !== request.owner) throw new Error('Assignment belongs to another owner; use an authorized handoff.');
    const supplied = AMENDABLE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(request, field));
    if (!supplied.length) throw new Error('Amendment requires at least one mutable assignment field.');
    const patch = {};
    if ('goal' in request) { if (typeof request.goal !== 'string' || !request.goal.trim()) throw new Error('Goal cannot be empty.'); patch.goal = request.goal; }
    if ('acceptance' in request) { if (typeof request.acceptance !== 'string' || !request.acceptance.trim()) throw new Error('Acceptance cannot be empty.'); patch.acceptance = request.acceptance; }
    if ('next_action' in request) { if (typeof request.next_action !== 'string' || !request.next_action.trim()) throw new Error('Next action cannot be empty.'); patch.next_action = request.next_action; }
    if ('paths' in request) { if (!Array.isArray(request.paths) || !request.paths.length) throw new Error('Assignment paths cannot be empty.'); patch.paths = request.paths.map(normalizeScope); }
    if ('resources' in request) patch.resources = normalizeResources(request.resources);
    if ('task_class' in request) patch.task_class = normalizeTaskClass(request.task_class);
    if ('ledger_refs' in request) patch.ledger_refs = normalizeLedgerRefs(request.ledger_refs);
    Object.assign(patch, metadataFields(request));
    const before = Object.fromEntries(supplied.map((field) => [field, target[field]]));
    const staffPatch = Object.fromEntries(["primary_staff", "supporting_staff", "primary_team", "supporting_teams"].filter(key => key in request).map(key => [key, request[key]]));
    const preview = { ...target, ...patch, ...staffPatch };
    if (["category", "primary_role", "supporting_roles", "primary_staff", "supporting_staff", "primary_team", "supporting_teams"].some(key => key in request)) Object.assign(patch, normalizeAssignmentStaff(preview));
    Object.assign(preview, patch);
    if (!supplied.some(field => JSON.stringify(before[field]) !== JSON.stringify(preview[field]))) throw new Error("Amendment does not change assignment state.");
    for (const field of ["primary_staff", "supporting_staff", "primary_team", "supporting_teams"]) {
      if (!supplied.includes(field) && JSON.stringify(target[field]) !== JSON.stringify(preview[field])) {
        supplied.push(field); before[field] = target[field];
      }
    }
    validateRoleMetadata(preview.primary_role, preview.supporting_roles);
    const changed = supplied.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(preview[field]));
    if (!changed.length) throw new Error('Amendment does not change assignment state.');
    if (current) {
      for (const claim of claims.filter((claim) => claim.id !== current.id && occupying(claim))) {
        if (preview.paths.some((a) => claim.paths.some((b) => overlaps(a, b))) || preview.resources.some((resource) => claim.resources.includes(resource))) {
          throw new Error(`Amendment overlaps ${claim.id}. Split or defer the scope instead.`);
        }
      }
    }
    preserveObjective(target,now);
    if(queued && current)preserveObjective(queued,now);
    Object.assign(target, patch);
    appendAmendment(target, request, changed, before, now);
    target.updated_at = now.toISOString();
    if (current) {
      target.lease_until = new Date(now.getTime() + policy.lease_hours * 3600000).toISOString();
      if (queued) {
        for (const field of changed) queued[field] = structuredClone(target[field]);
        queued.updated_at = now.toISOString();
        appendAmendment(queued, request, changed, before, now);
      }
    }
    next.updated_at = now.toISOString();
    return next;
  }

  if (current && current.owner !== request.owner) throw new Error('Claim belongs to another owner; use an authorized handoff.');
  if (request.action === 'rescope') {
    if (!current || !occupying(current) || !request.paths || !request.resources) throw new Error('Rescope requires the current owner, full paths and full resources.');
    if ((request.branch && request.branch !== current.branch) || (request.base_sha && request.base_sha !== current.base_sha)) throw new Error('Rescope cannot replace the existing task branch or baseline.');
    const reduced = { ...next, claims: claims.filter((c) => c.id !== current.id), queue: next.queue.filter(q => q.id !== current.id) };
    const admitted = transition(reduced, { ...current, ...request, action: 'claim' }, policy, now);
    const resized=admitted.claims.find((c) => c.id === current.id);
    Object.assign(resized,{...current,paths:resized.paths,resources:resized.resources,next_action:resized.next_action,updated_at:resized.updated_at,lease_until:resized.lease_until});
    admitted.queue = next.queue;
    return admitted;
  }
  if (request.action === 'claim') {
    if (current) throw new Error('Assignment already exists. Resume/heartbeat the existing claim instead of making another branch.');
    if (queued && queued.state !== 'queued') throw new Error('Terminal or claimed queue identities cannot be reused.');
    if (claims.some(c => retired(c) && c.branch === request.branch)) throw new Error('Retired branch remains preserved for recovery and cannot be reused.');
    if (!request.branch || !policy.branch_prefixes.some((prefix) => request.branch.startsWith(prefix)) || policy.excluded_branches.includes(request.branch)) throw new Error('Branch is not an allowed implementation branch.');
    if (!request.goal || !request.acceptance || !request.next_action || !request.base_sha) throw new Error('Goal, acceptance, next action and live main SHA are required.');
    const paths = (request.paths ?? []).map(normalizeScope);
    const resources = normalizeResources(request.resources ?? []);
    if (!paths.length || resources.some((r) => typeof r !== 'string' || !r)) throw new Error('Explicit paths and valid resource names are required.');
    const active = claims.filter(occupying);
    if (active.length >= policy.max_active_branches) throw new Error('Active branch budget reached. Finish or reconcile existing work before starting another implementation.');
    for (const c of active) {
      if (c.owner === request.owner) throw new Error('Owner already has an active implementation. Finish it or hand it off first.');
      if (c.branch === request.branch) throw new Error('Branch already has an owner.');
      if (paths.some((a) => c.paths.some((b) => overlaps(a, b))) || resources.some((r) => c.resources.includes(r))) throw new Error(`Ownership overlaps ${c.id}. Queue or split the scope; do not create a competing branch.`);
    }
    claims.push({ id: request.id, owner: request.owner, branch: request.branch, paths, resources,
      goal: request.goal, acceptance: request.acceptance, next_action: request.next_action,
      ...(request.task_class ? { task_class: normalizeTaskClass(request.task_class) } : {}),
      ...(request.ledger_refs ? { ledger_refs: normalizeLedgerRefs(request.ledger_refs) } : {}),
      ...metadataFields({ ...queued, ...request }),
      ...normalizeAssignmentStaff({ ...queued, ...request }),
      base_sha: request.base_sha, state: 'active', created_at: now.toISOString() });
    if(queued){for(const field of ['objective_history','amendments','amendment_count','handoffs'])if(queued[field]!==undefined)claims.at(-1)[field]=structuredClone(queued[field]);}
    preserveObjective(claims.at(-1),now,queued?'queued-assignment':'assignment-created');
    if (queued && queued.owner !== request.owner) throw new Error('Queued assignment belongs to another owner.');
    if (queued) queued.state = 'claimed';
  } else {
    if (!current || !occupying(current)) throw new Error('An active claim is required.');
    if (['handoff', 'complete'].includes(request.action) && queued && (queued.owner !== current.owner || queued.state !== 'claimed')) throw new Error('Queue lifecycle or owner conflicts with the active claim.');
    if (request.action === 'heartbeat') {
      if (!request.next_action) throw new Error('Persist the next action when renewing.');
      current.next_action = request.next_action;
      current.state = 'active';
    } else if (request.action === 'hold') {
      if (!request.next_action) throw new Error('A hold requires a recovery action.');
      current.state = 'held';
      current.next_action = request.next_action;
    } else if (request.action === 'handoff') {
      if (!request.successor || !request.next_action) throw new Error('A handoff requires a successor and next action.');
      if (claims.some((c) => occupying(c) && c.owner === request.successor)) throw new Error('Successor already owns an active implementation.');
      if (request.successor === request.owner) throw new Error('A handoff requires a distinct successor.');
      current.handoffs = [...(current.handoffs || []), { at: now.toISOString(), from: request.owner, to: request.successor, next_action: request.next_action }];
      if (queued) {
        queued.handoffs = [...(queued.handoffs || []), structuredClone(current.handoffs.at(-1))];
        Object.assign(queued, { owner: request.successor, next_action: request.next_action, updated_at: now.toISOString() });
      }
      current.owner = request.successor;
      current.next_action = request.next_action;
    } else if (request.action === 'complete') {
      if (request.work_accounted !== true || typeof request.evidence !== 'string' || !request.evidence.trim() || !Number.isInteger(request.pr) || request.pr < 1 || !request.merged_head_sha || !request.merge_commit_sha) throw new Error('Completion requires a verified merged PR, durable disposition of all work/intent/QA, and evidence.');
      Object.assign(current, { state: 'completed', pr: request.pr, merged_head_sha: request.merged_head_sha,
        merge_commit_sha: request.merge_commit_sha, evidence: request.evidence, work_accounted: true, completed_at: now.toISOString() });
      if (queued) Object.assign(queued, { state: 'completed', completed_at: current.completed_at, updated_at: now.toISOString() });
    } else throw new Error('Unknown coordination action.');
  }
  const updated = claims.find((c) => c.id === request.id);
  updated.updated_at = now.toISOString();
  updated.lease_until = new Date(now.getTime() + policy.lease_hours * 3600000).toISOString();
  next.updated_at = now.toISOString();
  return next;
}

export function evaluate(record, policy, branches, prs, now = new Date()) {
  const findings = [];
  const active = record.claims.filter(occupying);
  const legacy = new Set(record.legacy_branches);
  if (active.length > policy.max_active_branches) findings.push({ type: 'budget', count: active.length });
  for (const c of active) {
    if (new Date(c.lease_until) <= now) findings.push({ type: 'expired', assignment: c.id, branch: c.branch, action: 'Reconcile or renew; ownership is retained.' });
    if (!branches.some((b) => b.name === c.branch) && now - new Date(c.created_at) > 3600000) findings.push({ type: 'missing_branch', assignment: c.id, branch: c.branch });
  }
  for (let i = 0; i < active.length; i++) for (const b of active.slice(i + 1)) {
    const a = active[i];
    if (a.paths.some((p) => b.paths.some((q) => overlaps(p, q))) || a.resources.some((r) => b.resources.includes(r))) findings.push({ type: 'overlap', assignments: [a.id, b.id] });
  }
  for (const b of branches) {
    if (policy.excluded_branches.includes(b.name)) continue;
    if (!record.claims.some((c) => c.branch === b.name) && !legacy.has(b.name)) findings.push({ type: 'unregistered_branch', branch: b.name });
  }
  for (const pr of prs) {
    if (pr.head.repo?.full_name !== policy.repository) continue;
    const c = active.find((c) => c.branch === pr.head.ref);
    if (!c) continue;
    const outside = pr.files.filter((p) => !covered(p, c.paths));
    if (outside.length) findings.push({ type: 'scope_drift', assignment: c.id, branch: c.branch, pr: pr.number, paths: outside });
  }
  return findings;
}
