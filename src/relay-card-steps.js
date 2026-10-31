import {STAFF} from './staff-registry.js';
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

// The write contract is deliberately narrower than the tolerant display reader.
// It carries owner-recorded verifier digests, never private journal contents or
// a claim that a routed staff member actually contributed.
const digestSchema={type:'string',pattern:'^[a-f0-9]{64}$'};
const stableSchema={type:'string',pattern:'^[a-z][a-z0-9-]{0,63}$'};
export const cardStepsPublicationSchema={type:'object',additionalProperties:false,required:['schema','assignment','revision','objective_digest','publisher','sequence','complete','steps'],properties:{
 schema:{const:CARD_STEPS_SCHEMA},assignment:{type:'string',pattern:ID.source},revision:digestSchema,objective_digest:digestSchema,
 publisher:{type:'object',additionalProperties:false,required:['owner','branch'],properties:{owner:{type:'string',minLength:1,maxLength:100},branch:{type:'string',minLength:1,maxLength:200}}},
 sequence:{type:'integer',minimum:1,maximum:1000000},complete:{type:'boolean'},
 steps:{type:'array',minItems:1,maxItems:32,items:{type:'object',additionalProperties:false,required:['id','label','depends_on','state','receipt'],properties:{
  id:stableSchema,label:{type:'string',minLength:1,maxLength:160},depends_on:{type:'array',maxItems:32,uniqueItems:true,items:stableSchema},state:{enum:['pending','unknown','running','passed','failed','blocked','cancelled','stale','skipped']},
  receipt:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['id','assignment','step_id','plan_revision','input_digest','evidence','source_sha','observed_at'],properties:{id:{type:'string',pattern:ID.source},assignment:{type:'string',pattern:ID.source},step_id:stableSchema,plan_revision:digestSchema,input_digest:digestSchema,evidence:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'},source_sha:{type:'string',pattern:'^[a-f0-9]{40}$'},observed_at:{type:'string',maxLength:40},phase:{type:'string',enum:['awaiting-verification']},owner:{type:'object',additionalProperties:false,required:['staff','team'],properties:{staff:{type:['string','null'],maxLength:80},team:{type:'string',enum:['runner','inspector','night-shift','source','cloud','release','skills']}}}}}]}
 }}}
}};
const exactKeys=(value,keys)=>object(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
export function validateCardStepsPublication(value,record,objectiveDigest,now=new Date()) {
 const fail=()=>{throw Error('Checklist publication requires bounded matching plan, owner and verifier evidence');};
 if(!exactKeys(value,cardStepsPublicationSchema.required)||JSON.stringify(value).length>32768||value.schema!==CARD_STEPS_SCHEMA||value.assignment!==record.id||!ID.test(value.assignment)||!/^[a-f0-9]{64}$/.test(value.revision)||value.objective_digest!==objectiveDigest||!exactKeys(value.publisher,['owner','branch'])||value.publisher.owner!==record.owner||value.publisher.branch!==record.branch||record.state!=='active'||!(Date.parse(record.lease_until)>+now)||typeof value.complete!=='boolean'||!Number.isSafeInteger(value.sequence)||value.sequence<1||value.sequence>1000000||!Array.isArray(value.steps)||!value.steps.length||value.steps.length>32)fail();
 const previous=record.card_steps;
 if(value.sequence!==(previous?.sequence||0)+1||previous&&(previous.revision!==value.revision||previous.objective_digest!==value.objective_digest))fail();
 const ids=new Map();
 for(const step of value.steps){
  if(!exactKeys(step,['id','label','depends_on','state','receipt'])||! /^[a-z][a-z0-9-]{0,63}$/.test(step.id)||ids.has(step.id)||typeof step.label!=='string'||!step.label.trim()||step.label.length>160||/[\x00-\x1f<>]/.test(step.label)||!Array.isArray(step.depends_on)||new Set(step.depends_on).size!==step.depends_on.length||step.depends_on.some(id=>!ids.has(id))||!STATES.has(step.state))fail();
  const r=step.receipt;
  if(!['pending','unknown'].includes(step.state)){
   if(!exactKeys(r,['id','assignment','step_id','plan_revision','input_digest','evidence','source_sha','observed_at',...(r&&Object.hasOwn(r,'owner')?['owner']:[]),...(r&&Object.hasOwn(r,'phase')?['phase']:[])])||!ID.test(r.id)||r.assignment!==record.id||r.step_id!==step.id||r.plan_revision!==value.revision||!/^[a-f0-9]{64}$/.test(r.input_digest)||!/^sha256:[a-f0-9]{64}$/.test(r.evidence)||!/^[a-f0-9]{40}$/.test(r.source_sha)||typeof r.observed_at!=='string'||r.observed_at.length>40||!Number.isFinite(Date.parse(r.observed_at))||Date.parse(r.observed_at)>+now+60000||(step.state==='passed'||step.state==='running')&&step.depends_on.some(id=>ids.get(id).state!=='passed'))fail();
   if(r.phase!==undefined&&(r.phase!=='awaiting-verification'||step.state!=='blocked'))fail();
   if(r.owner!==undefined&&!validCardOwner(r.owner,record))fail();
  }else if(r!==null)fail();
  ids.set(step.id,step);
 }
 // An old journal cannot erase subsequently admitted priorities or dependencies.
 if(previous?.steps.some(old=>!ids.has(old.id)||ids.get(old.id).label!==old.label||old.depends_on.some(id=>!ids.get(old.id).depends_on.includes(id))))fail();
 if(value.complete&&(record.acceptance_additions||[]).some(addition=>!ids.has('add-'+addition.proposal.id)))fail();
 return structuredClone(value);
}

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
      owner,receipt:bound ? {id:receipt.id,evidence:text(receipt.evidence),observed_at:receipt.observed_at,source_sha:/^[a-f0-9]{40}$/.test(receipt.source_sha || '')?receipt.source_sha:null,...(state==='blocked'&&receipt.phase==='awaiting-verification'?{phase:'awaiting-verification'}:{})} : null,
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

// An observation may name only an explicitly routed canonical persona/team.
// This bounds attribution; routing by itself still creates no observation.
export function validCardOwner(owner,record){
 if(!exactKeys(owner,['staff','team']))return false;
 const teams=[record.primary_team,...(record.supporting_teams||[])];
 if(owner.staff===null)return teams.includes(owner.team);
 const person=STAFF.find(p=>p.id===owner.staff&&p.status!=='retired');
 return !!person&&person.home_team===owner.team&&[record.primary_staff,...(record.supporting_staff||[])].includes(owner.staff);
}
