import {getStaff, normalizeAssignmentStaff, staffMatchesRole} from './staff-registry.js';
import {validCardOwner} from './relay-card-steps.js';

// These are stage responsibilities, not evidence that anyone has contributed.
const roles = Object.freeze({implementation:'builder', test:'verifier', review:'verifier', runtime:'reliability-lead', ship:'release-captain'});
export function stageSpecialist(stage, assignment) {
  if (stage.command) return null;
  const role = stage.specialist_role || roles[stage.kind];
  if (!role) return null;
  const routed = [assignment.primary_staff, ...(assignment.supporting_staff || [])].map(id => getStaff(id)).filter(Boolean);
  const person = routed.filter(p => p.status !== 'retired' && staffMatchesRole(p, role)).sort((a,b) => Number(b.role.id === role)-Number(a.role.id === role))[0];
  if (!person) {
    const proposed = normalizeAssignmentStaff({primary_role:role}).primary_staff;
    throw Error(`Specialist staffing required before ${stage.id}: admit supporting role ${role}${proposed ? ' ('+proposed+')' : ''}; routing alone is not execution`);
  }
  return {role, owner:{staff:person.id, team:person.home_team}, instruction:'Perform only this bounded stage. The staff name is a fictional presentation identity, not a real employee or Git identity. Do not create agents or reassign work. Return actual findings and evidence; a successful process is not verified acceptance.'};
}

export function specialistWorkflow(assignment = {}) {
  return {schema:1, coordinator_only:true, participation:'routing', canonical:'docs/relay/SPECIALIST_DELIVERY_20261031.md',
    required:assignment.state === 'active', available_staff:[assignment.primary_staff,...(assignment.supporting_staff || [])].filter(Boolean),
    steps:[
      'Before ordinary implementation, the coordinator records the complete authorized acceptance plan with real stage-specific verifiers. Reuse a matching private plan; reconcile any pending execution before creating work.',
      'Choose relevant bounded specialist roles for the plan, including independent verification when required. Canonically admit missing supporting roles and read them back before launch; team membership alone is not staffing.',
      'Run the native continuity coordinator in the current Codex task, or the configured CLI continuity coordinator. For native specialist work: persist begin, invoke an actual authorized host subagent, attach its exact returned identity using delegate, then publish its actual result. Never substitute a persona label for a launched worker.',
      'The adapter automatically publishes observed running/terminal states and verified acceptance. A missing host invocation capability or missing complete plan is an explicit coordinator blocker, never permission for workers to create agents.',
      'Ordinary single-job CLI execution does not itself orchestrate specialists. Return that gap to the coordinator; preserve its worker no-delegation boundary.'
    ]};
}

export function validateDelegationReceipt(receipt, request, now = Date.now()) {
  const {pending, context, specialist} = request.data;
  const fields = ['schema','adapter','agent_id','request_digest','operation_id','source_sha','record_sha','owner','launched_at'];
  if (!specialist || !receipt || Object.keys(receipt).sort().join() !== fields.sort().join() || receipt.schema !== 1 || receipt.adapter !== 'codex-native-subagent' ||
      typeof receipt.agent_id !== 'string' || !/^[-a-zA-Z0-9_/.]{1,240}$/.test(receipt.agent_id) || receipt.agent_id === request.binding.owner ||
      receipt.request_digest !== request.id || receipt.operation_id !== pending.operation_id || receipt.source_sha !== context.source_sha || receipt.record_sha !== context.canonical_record_sha ||
      !/^[a-f0-9]{40}$/.test(receipt.source_sha || '') || !/^[a-f0-9]{40}$/.test(receipt.record_sha || '') ||
      !validCardOwner(receipt.owner, context.card_attribution) || JSON.stringify(receipt.owner) !== JSON.stringify(specialist.owner) ||
      !Number.isFinite(Date.parse(receipt.launched_at)) || Date.parse(receipt.launched_at)>now+5000 || now-Date.parse(receipt.launched_at)>300000) throw Error('Delegation receipt does not match the admitted specialist execution');
  return receipt;
}
