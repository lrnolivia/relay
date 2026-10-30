import { safePresentationText } from './human-presentation.js';

// A presentation contract, never an execution or authority contract. Producers
// must supply the ordered plan and observations; the card does not parse prose,
// turn routing into participation, or remember a previous assignment's progress.
export const CARD_STEPS_SCHEMA = 'relay-card-steps/v1';
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const STATES = new Set(['pending','running','passed','failed','skipped','blocked','cancelled','stale','unknown']);
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const text = (x, n = 2000) => typeof x === 'string' ? safePresentationText(x, n) : null;
const absent = (reason = 'No ordered plan has been recorded.') => ({schema:CARD_STEPS_SCHEMA,availability:'unknown',reason,steps:[],total:null,passed:null,current:null});

export function normalizeCardSteps(input, assignment) {
  if (!input) return absent();
  if (!object(input) || input.schema !== CARD_STEPS_SCHEMA || !ID.test(assignment || '') || input.assignment !== assignment || !ID.test(input.revision || '') || !Array.isArray(input.steps) || !input.steps.length || input.steps.length > 32) return absent('The ordered plan could not be verified.');
  const ids = new Set();
  const steps = [];
  for (const row of input.steps) {
    if (!object(row) || !ID.test(row.id || '') || ids.has(row.id) || typeof row.label !== 'string' || !row.label.trim() || row.label.length > 2000 || !Array.isArray(row.depends_on) || row.depends_on.some(id => !ids.has(id))) return absent('The ordered plan could not be verified.');
    ids.add(row.id);
    const receipt = row.receipt;
    const bound = object(receipt) && receipt.assignment === assignment && receipt.step_id === row.id && receipt.plan_revision === input.revision && ID.test(receipt.id || '') && typeof receipt.evidence === 'string' && receipt.evidence.trim() && receipt.evidence.length <= 2000 && Number.isFinite(Date.parse(receipt.observed_at));
    // Even a claimed pass stays unknown without an observation bound to this
    // exact assignment, step and plan revision. Skips remain distinct from passes.
    const state = row.state === 'pending' ? 'pending' : bound && STATES.has(row.state) ? row.state : 'unknown';
    const owner = bound && object(receipt.owner) ? {
      staff:ID.test(receipt.owner.staff || '') ? receipt.owner.staff : null,
      team:ID.test(receipt.owner.team || '') ? receipt.owner.team : null
    } : null;
    steps.push({id:row.id,label:text(row.label),depends_on:[...row.depends_on],state,
      owner,receipt:bound ? {id:receipt.id,evidence:text(receipt.evidence),observed_at:receipt.observed_at,source_sha:/^[a-f0-9]{40}$/.test(receipt.source_sha || '')?receipt.source_sha:null} : null,
      detail:text(row.detail),reason:row.state !== state ? 'No matching step receipt.' : null});
  }
  // A contradictory dependency cannot claim verification of a dependent step.
  for (const step of steps) if (step.state === 'passed' && step.depends_on.some(id => steps.find(s => s.id === id)?.state !== 'passed')) {
    step.state='unknown';step.reason='A prerequisite is not verified.';
  }
  const complete = input.complete === true;
  return {schema:CARD_STEPS_SCHEMA,assignment,revision:input.revision,availability:complete?'recorded':'partial',reason:complete?null:'Only part of the plan is recorded.',steps,total:complete?steps.length:null,passed:steps.filter(s=>s.state==='passed').length,current:steps.find(s=>['running','failed','blocked','stale'].includes(s.state))?.id || null};
}

// Canonical acceptance additions are explicit records, but admission is not
// completion. They are a partial checklist, not a reconstructed original plan.
export function assignmentCardSteps(record = {}) {
  const assignment = record.id || record.assignment;
  if (record.card_steps) return normalizeCardSteps(record.card_steps, assignment);
  const additions = record.acceptance_additions;
  if (!Array.isArray(additions) || !additions.length || additions.length > 32) return absent();
  const admitted = additions.filter(x => x?.schema===1 && x.review?.verdict==='admit' && x.review?.preserves_goal===true && x.review?.goal_digest===x.goal_digest && x.proposal?.goal_digest===x.goal_digest && /^[a-f0-9]{64}$/.test(x.goal_digest || ''));
  if (admitted.length !== additions.length) return absent('The acceptance records could not be verified.');
  const steps = admitted.map(x=>({id:'add-'+x.proposal.id,label:x.proposal.description,depends_on:[],state:'unknown',detail:Array.isArray(x.proposal.acceptance)?x.proposal.acceptance.join('\n'):null}));
  return normalizeCardSteps({schema:CARD_STEPS_SCHEMA,assignment,revision:'acceptance-additions',complete:false,steps},assignment);
}

// Keep the transport small without stripping the only blocker/deadline or the
// identity and evidence required to render a shared assignment across handoffs.
export function assignmentCardContext(record = {}) {
  const out = {};
  for (const key of ['id','assignment','owner','state','primary_staff','primary_team','branch','updated_at','created_at','completed_at','last_meaningful_progress_at']) if (typeof record[key] === 'string') out[key] = record[key].slice(0,180);
  for (const key of ['goal','next_action','waiting_reason','recovery_action']) if (typeof record[key] === 'string') out[key] = text(record[key],12000);
  for (const key of ['supporting_staff','supporting_teams']) if (Array.isArray(record[key])) out[key]=record[key].filter(x=>typeof x==='string'&&ID.test(x)).slice(0,32);
  if (record.lease_expired === true) out.lease_expired=true;
  const plan=assignmentCardSteps(record);
  if (plan.steps.length) out.card_steps={schema:CARD_STEPS_SCHEMA,assignment:plan.assignment,revision:plan.revision,complete:plan.total!==null,steps:plan.steps.map(s=>({...s,receipt:s.receipt?{...s.receipt,assignment:plan.assignment,step_id:s.id,plan_revision:plan.revision,owner:s.owner}:null}))};
  return out;
}

// Read-only adapter for an existing native continuity plan/journal pair. Its
// observed_at is the time the producer read the snapshot, never a fabricated
// completion time. Local journals are not fetched or published by this helper.
export async function continuityCardSteps({assignment,plan,journal,observed_at} = {}) {
  const hex = /^[a-f0-9]{64}$/;
  if (!ID.test(assignment || '') || !Number.isFinite(Date.parse(observed_at)) || plan?.schema!==1 || journal?.schema!==1 || !hex.test(plan.objective_digest || '') || !Array.isArray(plan.criteria) || !plan.criteria.length || new Set(plan.criteria).size!==plan.criteria.length || !Array.isArray(plan.stages) || !plan.stages.length || plan.stages.length>32 || !object(journal.stages)) return absent('The continuity snapshot could not be verified.');
  const encoded=new TextEncoder().encode(JSON.stringify(plan));
  if(encoded.length>512*1024)return absent('The continuity snapshot exceeds the card bound.');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded)),b=>b.toString(16).padStart(2,'0')).join('');
  if(journal.plan_digest!==digest)return absent('The journal belongs to a different plan.');
  const ids=new Set(),covered=new Set();
  for(const stage of plan.stages){
    if(!/^[a-z][a-z0-9-]{0,63}$/.test(stage?.id || '') || ids.has(stage.id) || !['implementation','test','review','ship','runtime'].includes(stage.kind) || typeof stage.prompt!=='string' || !stage.prompt.trim() || !Array.isArray(stage.criteria) || !stage.criteria.length || stage.criteria.some(c=>!plan.criteria.includes(c)) || !Array.isArray(stage.depends_on) || stage.depends_on.some(id=>!ids.has(id)))return absent('The continuity plan is not an ordered acceptance plan.');
    ids.add(stage.id);stage.criteria.forEach(c=>covered.add(c));
  }
  if(plan.criteria.some(c=>!covered.has(c)))return absent('The continuity plan omits acceptance criteria.');
  const complete=(!journal.effective_plan || JSON.stringify(journal.effective_plan)===JSON.stringify(plan)) && !journal.pending_canonical_additions?.length && !journal.expansion_overflow;
  const steps=plan.stages.map(stage=>{
    const row=journal.stages[stage.id],proof=row?.receipt;
    const verified=row?.state==='passed' && hex.test(proof?.input_digest || '') && typeof proof?.evidence==='string' && proof.evidence.length>0 && proof.evidence.length<=2000 && /^[a-f0-9]{40}$/.test(proof?.source_sha || '');
    return {id:stage.id,label:stage.id.replaceAll('-',' '),depends_on:stage.depends_on,state:verified?'passed':!row || row.state==='ready'?'pending':'unknown',detail:stage.prompt,
      receipt:verified?{id:stage.id+':'+proof.input_digest.slice(0,32),assignment,step_id:stage.id,plan_revision:digest,evidence:proof.evidence,source_sha:proof.source_sha,observed_at}:null};
  });
  return normalizeCardSteps({schema:CARD_STEPS_SCHEMA,assignment,revision:digest,complete,steps},assignment);
}
