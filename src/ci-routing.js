// A route plan is advisory. The job-start hook must recheck approval/capacity;
// discovery never registers a runner, reserves it, or dispatches a second run.
const sha = value => /^[a-f0-9]{40}$/.test(value || '');
const id = value => /^[a-z0-9][a-z0-9-]{0,79}$/.test(value || '');
const workflow = value => /^[a-zA-Z0-9_-]+\.ya?ml$/.test(value || '');
export const CI_MODES = ['auto', 'pc', 'hosted'];

export function projectCiPolicy(registration) {
  return {
    available: registration.managed === true,
    default_mode: 'auto', modes: CI_MODES,
    pc_configured: Boolean(registration.ci?.pc),
    explicit_pc_fallback: false,
    required_gates_unchanged: true,
    dispatches_work: false
  };
}

export function planCiRoute({ registration, request, receipt, runner, now = Date.now(), blocked = null }) {
  const mode = request.mode || 'auto';
  if (!CI_MODES.includes(mode) || !sha(request.source_sha) || typeof request.source_ref !== 'string' || !request.source_ref || request.source_ref.length > 240) throw Error('CI plan requires a supported mode and exact source SHA/ref');
  const result = (route, reason, extra = {}) => ({
    mode, route, reason, project: registration.id, repository: registration.repository,
    source_sha: request.source_sha, source_ref: request.source_ref,
    advisory: true, dispatched: false, reservation_required: true,
    ...extra
  });
  // A stop or unresolved dispatch can never become a hosted fallback.
  if (blocked) return result('blocked', blocked);
  if (receipt?.dispatch_state && receipt.dispatch_state !== 'not-dispatched') return result('reconcile', 'Existing PC dispatch must be reconciled before selecting another route');
  if (registration.managed !== true) return result('blocked', 'Project is not managed');
  if (mode === 'hosted') return result('hosted', 'Explicit hosted CI request');
  const unavailable = reason => result(mode === 'pc' ? 'waiting' : 'hosted', reason);
  const pc = registration.ci?.pc;
  if (!pc) return unavailable('PC CI profile is not configured');
  if (!id(pc.host) || !id(pc.label) || !workflow(pc.workflow) || !Array.isArray(pc.source_refs) || !pc.source_refs.includes(request.source_ref) || pc.isolation !== 'ephemeral-vm') return unavailable('PC CI profile does not admit this source or isolation');
  if (!receipt || receipt.schema !== 1 || receipt.project !== registration.id || receipt.repository !== registration.repository || receipt.host !== pc.host || receipt.workflow !== pc.workflow || receipt.label !== pc.label || receipt.source_sha !== request.source_sha || receipt.source_ref !== request.source_ref || !sha(receipt.workflow_sha)) return unavailable('No matching host admission receipt');
  const age = now - Date.parse(receipt.checked_at);
  if (!Number.isFinite(age) || age < 0 || age > 60000) return unavailable('PC availability receipt is stale');
  if (receipt.isolation !== 'ephemeral-vm' || receipt.approved !== true || receipt.online !== true || receipt.gaming !== false || receipt.busy !== false || receipt.capacity_available !== true || receipt.dispatch_state !== 'not-dispatched') return unavailable('PC is offline, busy, gaming, at capacity, or not admitted');
  if (!Array.isArray(pc.required_capabilities) || !pc.required_capabilities.length || !Array.isArray(receipt.capabilities) || pc.required_capabilities.some(value => !receipt.capabilities.includes(value))) return unavailable('PC lacks required runtime capabilities');
  if (!runner || runner.name !== receipt.runner_name || runner.status !== 'online' || runner.busy !== false || !runner.labels?.some(value => value.name === pc.label)) return unavailable('Admitted GitHub runner is unavailable');
  return result('pc', 'Fresh isolated PC admission and idle runner match the exact candidate', {
    workflow: pc.workflow, workflow_sha: receipt.workflow_sha,
    runner_name: runner.name, runs_on: ['self-hosted', pc.label],
    receipt_checked_at: receipt.checked_at
  });
}

export async function projectCiRoute(registration, request, env, api, { now = Date.now(), blocked = null } = {}) {
  const policy = projectCiPolicy(registration);
  if (!request) return policy;
  let receipt = null, runner = null;
  const pc = registration.ci?.pc;
  if (id(pc?.host) && !blocked) {
    // Private host receipts are control-plane evidence, never user tool input.
    const object = await env.EVIDENCE?.get(`ci-host/v1/${pc.host}/${registration.id}.json`);
    if (object) receipt = await object.json();
    if (request.mode !== 'hosted' && receipt && sha(receipt.workflow_sha) && receipt.dispatch_state === 'not-dispatched') {
      const ref = await api(`/repos/${registration.repository}/git/ref/heads/${encodeURIComponent(registration.default_branch)}`);
      if (ref?.object?.sha !== receipt.workflow_sha) return { ...policy, plan: planCiRoute({ registration, request, receipt, now, blocked: 'Trusted workflow head changed; refresh PC admission' }) };
      const response = await api(`/repos/${registration.repository}/actions/runners?per_page=100`);
      if (!Number.isInteger(response?.total_count) || !Array.isArray(response.runners) || response.total_count !== response.runners.length) throw Error('PC runner inventory is incomplete');
      runner = response.runners.find(value => value.name === receipt.runner_name);
    }
  }
  return { ...policy, plan: planCiRoute({ registration, request, receipt, runner, now, blocked }) };
}
