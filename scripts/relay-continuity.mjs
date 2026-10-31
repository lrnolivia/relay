import {stageSpecialist} from '../src/specialist-workflow.js';
import {createHash} from 'node:crypto';
import {validateContinuityAdditions,validateExpansionPolicy,expandedContinuityPlan,expansionDigest,insideExpansionScope} from '../packages/runner/src/continuity-expansion.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {CARD_STEPS_SCHEMA,validateCardStepsPublication,validCardOwner} from '../src/relay-card-steps.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const terminal=new Set(['succeeded','failed','cancelled']);

export function validateContinuityPlan(plan){
 if(plan?.completion_scope!==undefined&&!['objective','subobjective'].includes(plan.completion_scope))throw Error('Declare objective or subobjective completion scope');
 if(plan?.schema!==1||typeof plan.authorization!=='string'||!plan.authorization.trim()||!Array.isArray(plan.criteria)||!plan.criteria.length||!Array.isArray(plan.stages)||!plan.stages.length||plan.stages.length>32)throw Error('Continuity requires explicit authorization and complete finite acceptance');
 if(!/^[a-f0-9]{64}$/.test(plan.objective_digest||'')||new Set(plan.criteria).size!==plan.criteria.length)throw Error('Bind the full objective and unique acceptance criteria');
 validateExpansionPolicy(plan);
 const ids=new Set(),covered=new Set();
 if(!plan.environment||typeof plan.environment!=='object')throw Error('Record the verifier environment identity');
 for(const stage of plan.stages){
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(stage.id||'')||ids.has(stage.id)||!['implementation','test','review','ship','runtime'].includes(stage.kind)||typeof stage.prompt!=='string'||!stage.prompt.trim()||!Array.isArray(stage.criteria)||!stage.criteria.length||stage.criteria.some(id=>!plan.criteria.includes(id))||!Array.isArray(stage.depends_on)||stage.depends_on.some(id=>!ids.has(id)))throw Error('Stages must cover authorized acceptance with ordered dependencies');
  if(!Array.isArray(stage.verify)||!stage.verify.length||stage.verify.some(x=>typeof x!=='string'||!x)||!Array.isArray(stage.inputs)||!stage.inputs.length||stage.inputs.some(x=>!x||x.startsWith('/')||x.split('/').includes('..')))throw Error('Declare each verifier and all its relevant source/config inputs');
  if(stage.specialist_role!==undefined&&(typeof stage.specialist_role!=='string'||!/^[-a-z][a-z0-9-]{0,63}$/.test(stage.specialist_role)||stage.command))throw Error('Specialist responsibility requires a bounded role and actual worker stage');
  if(stage.command&&(!Array.isArray(stage.command)||!stage.command.length||stage.command.some(x=>typeof x!=='string'||!x)))throw Error('Publication actions require an explicit trusted command');
  ids.add(stage.id);stage.criteria.forEach(id=>covered.add(id));
 }
 if(plan.criteria.some(id=>!covered.has(id)))throw Error('Continuity plan drops acceptance criteria');
 return plan;
}

// Proposal text is task data. Only the coordinator's trusted semantic review,
// scope admission and verifier profiles can turn it into executable work.
export async function admitContinuityAdditions({plan,state,items=[],persist,gate,reviewAddition,admitScope}){
 validateContinuityAdditions(items);const policy=validateExpansionPolicy(plan);
 if(!policy&&items.length)throw Error('Goal-preserving expansion has no recorded authorization');
 if(!policy)return false;
 state.additions ||= [];let changed=false;
 for(const proposal of items){
  const digest=expansionDigest(proposal),prior=state.additions.find(x=>x.proposal.id===proposal.id);
  if(prior){if(prior.digest!==digest)throw Error('Expansion identity changed; preserve its original proposal and reconcile');continue;}
  if(state.additions.length>=policy.max_proposals){state.expansion_overflow={digest,reason:'Proposal budget exhausted; coordinator review required'};await persist(state);break;}
  state.additions.push({digest,proposal:structuredClone(proposal),status:'proposed'});await persist(state);
 }
 const settled=new Set(['admitted','rejected','duplicate','authority-required','budget-wait']);
 // Detect a batch cycle before any member is admitted or run.
 const pending=state.additions.filter(x=>!settled.has(x.status));
 try{expandedContinuityPlan(plan,state.additions.filter(x=>x.status==='admitted').concat(pending.map(x=>({...x,status:'admitted',goal_digest:policy.goal_digest,depth:1}))));}
 catch(error){if(error.cycle)for(const row of pending)if(error.cycle.includes('add-'+row.proposal.id)){row.status='rejected';row.reason='Dependency cycle rejected: '+error.cycle.join(' -> ');await persist(state);}}
 for(const row of state.additions){
  if(settled.has(row.status))continue;
  const p=row.proposal,effective=expandedContinuityPlan(plan,state.additions),target=plan.stages.find(x=>x.id===p.target_stage);
  if(p.goal_digest!==policy.goal_digest||p.supports.some(id=>!plan.criteria.includes(id))||!target||!['implementation','test'].includes(target.kind)||!policy.profiles[p.profile]){row.status='rejected';row.reason='Addition must support original acceptance and an existing feature using a trusted profile';await persist(state);continue;}
  if(p.depends_on.some(id=>!effective.stages.some(s=>s.id===id))){row.status='dependency-wait';row.reason='A declared dependency is not admitted yet';await persist(state);continue;}
  const parents=p.depends_on.map(id=>state.additions.find(x=>x.status==='admitted'&&'add-'+x.proposal.id===id)?.depth||0),depth=1+Math.max(0,...parents);
  if(depth>policy.max_depth||state.additions.filter(x=>x.status==='admitted').length>=policy.max_additions||effective.stages.length>=32){row.status='budget-wait';row.reason='Expansion depth or cumulative stage/addition budget exhausted';await persist(state);continue;}
  const before=await gate(),context=hash({source:before.source_sha,revision:before.revision,global_revision:before.global_revision});
  if(row.review_context!==context){row.review_context=context;row.review_attempts=0;delete row.review;}
  if(!row.review){
   if((row.review_attempts||0)>=2){row.status='authority-required';row.reason='Bounded coordinator review unavailable';await persist(state);continue;}
   row.status='reviewing';row.review_attempts=(row.review_attempts||0)+1;await persist(state);
   let decision;try{decision=await reviewAddition?.(p,{original_goal:policy.original_goal,original_criteria:plan.criteria,goal_digest:policy.goal_digest,authorization:policy.authorization});}catch{}
   const after=await gate();if(after.revision!==before.revision||after.global_revision!==before.global_revision||after.source_sha!==before.source_sha){row.status='review-wait';row.reason='Control/source changed during review';await persist(state);continue;}
   if(!decision||typeof decision!=='object'||Array.isArray(decision)){row.status='review-wait';row.reason='Coordinator semantic review is unavailable; no supporting work was launched';await persist(state);continue;}
   row.review=Object.fromEntries(['verdict','preserves_goal','goal_digest','within_authority','sensitive_permissions','paid_services','canonical_key','reason'].filter(k=>k in decision).map(k=>[k,decision[k]]));await persist(state);
  }
  const d=row.review;
  if(d.verdict==='reject'){row.status='rejected';row.reason=String(d.reason||'Coordinator rejected the relationship').slice(0,1000);await persist(state);continue;}
  if(d.verdict!=='admit'||d.preserves_goal!==true||d.goal_digest!==policy.goal_digest||d.within_authority!==true||d.sensitive_permissions!==false||d.paid_services!==false||typeof d.reason!=='string'||!d.reason.trim()||d.reason.length>1000||!/^[-a-z0-9]{1,64}$/.test(d.canonical_key||'')){row.status='authority-required';row.reason='New goal, sensitive permission, spending, unavailable authority or unverified relationship requires handling';await persist(state);continue;}
  const duplicate=state.additions.find(x=>x!==row&&x.status==='admitted'&&x.review?.canonical_key===d.canonical_key);
  if(duplicate){row.status='duplicate';row.duplicate_of=duplicate.proposal.id;row.reason='Coordinator identified the same supporting feature';await persist(state);continue;}
  const candidate={...row,status:'admitted',depth,goal_digest:policy.goal_digest};
  try{expandedContinuityPlan(plan,state.additions.map(x=>x===row?candidate:x));}catch(error){row.status='rejected';row.reason=String(error.message).slice(0,1000);await persist(state);continue;}
  const fresh=await gate();if(fresh.revision!==before.revision||fresh.global_revision!==before.global_revision||fresh.source_sha!==before.source_sha){row.status='review-wait';delete row.review;await persist(state);continue;}
  row.status='scope-wait';await persist(state);
  let scope;try{scope=await admitScope?.(p,row);}catch{scope=null;}
  if(scope?.admitted!==true){row.reason=scope?.reason||'Canonical path admission is unconfirmed; reconcile the original scope request';await persist(state);continue;}
  row.scope_receipt=scope;if(scope.objective_digest)state.canonical_objective_digest=scope.objective_digest;await persist(state);
  await gate();row.status='admitted';row.depth=depth;row.goal_digest=policy.goal_digest;row.reason=d.reason;changed=true;
  state.effective_plan=expandedContinuityPlan(plan,state.additions);state.expansion_revision=(state.expansion_revision||0)+1;state.objective_completed=false;await persist(state);
 }
 return changed;
}
const unresolvedAdditions=state=>Boolean(state.expansion_overflow)||state.additions?.some(x=>!['admitted','rejected','duplicate'].includes(x.status));

// The immutable base binds the original goal. Accepted additions are an
// append-only ledger and become part of the actual execution/verification DAG.
export async function reconcileContinuity({plan,journal,persist,readControl,inputs,verify,execute,reconcile,maxActions=16,discover=async()=>[],reviewAddition,admitScope,observe=async()=>{},prepare=async()=>{}}){
 validateContinuityPlan(plan);
 const state=journal||{schema:1,plan_digest:hash(plan),stages:{},objective_completed:false};
 if(state.schema!==1)throw Error('Invalid continuity journal');
 if(state.plan_digest!==hash(plan)){
  const original={...plan};delete original.expansion;
  if(!plan.expansion||state.plan_digest!==hash(original)||state.additions?.length)throw Error('Acceptance or plan changed; explicitly reconcile the saved checkpoint');
  state.policy_history=[...(state.policy_history||[]),{previous:state.plan_digest,current:hash(plan),reason:'Explicitly enable authorized goal-preserving expansion without changing original acceptance'}];state.plan_digest=hash(plan);await persist(state);
 }
 state.objective_completed=false;state.acceptance_completed=false;state.subobjective_completed=false;let actions=0;
 const gate=async()=>{
  const control=await readControl(),policy=validateExpansionPolicy(plan);
  if(control.held||control.global_held||control.security_stop||control.assignment_active!==true||control.objective_digest!==(state.canonical_objective_digest||plan.objective_digest)||(policy&&control.original_goal_digest!==policy.goal_digest))throw Error('Current authority stops continuity; preserve checkpoints');
  return control;
 };
 const intake=items=>admitContinuityAdditions({plan,state,items,persist,gate,reviewAddition,admitScope});
 const identity=async stage=>hash({inputs:await inputs(stage),verifier:stage.verify,environment:plan.environment,objective:plan.objective_digest,dependencies:stage.depends_on.map(id=>state.stages[id]?.receipt?.input_digest)});
 for(let pass=0;pass<64;pass++){
  await gate();await intake(await discover(state));let effective=expandedContinuityPlan(plan,state.additions||[]),restart=false;
  validateContinuityPlan(effective);
  // Revalidate saved input identities before displaying resumed checkpoints.
  // A source/environment change must never briefly republish an old pass.
  for(const stage of effective.stages){const row=state.stages[stage.id],currentInput=await identity(stage);if(row?.state==='passed'&&row.receipt?.input_digest!==currentInput){row.state='ready';row.receipt=null;}if(row?.observation&&row.observation.input_digest!==currentInput)row.observation=null;}
  await observe(state);
  for(const stage of effective.stages){
   if(stage.depends_on.some(id=>state.stages[id]?.state!=='passed'))continue;
   if(unresolvedAdditions(state)&&(['review','ship','runtime'].includes(stage.kind)||state.additions?.some(x=>x.status!=='admitted'&&x.status!=='rejected'&&x.status!=='duplicate'&&x.proposal.kind==='necessary'&&x.proposal.target_stage===stage.id)))continue;
   let control=await gate(),row=state.stages[stage.id] ||= {state:'ready',attempts:0};
   if(row.pending){
    const result=await reconcile(row.pending);
    if(result?.state==='queued'){
     const fresh=await gate();if(fresh.revision!==row.pending.control_revision||fresh.global_revision!==row.pending.global_revision)throw Error('Control revision changed before queued continuation');
     try{const started=await execute(row.pending,stage,async observation=>{row.observation={...observation,input_digest:await identity(stage)};await persist(state);await observe(state);});if(!terminal.has(started?.state))throw Error('Uncertain queued execution');row.last_job=started;row.pending=null;row.execution_input_digest=started.specialist_execution&&started.state==='succeeded'?await identity(stage):null;await persist(state);}catch{row.state='reconciliation-required';await persist(state);continue;}
    }else{
     if(!result||!terminal.has(result.state)){row.state='reconciliation-required';await persist(state);continue;}
     row.last_job=result;row.pending=null;
     const currentInput=await identity(stage),currentControl=await gate(),candidate=result.observation||row.observation;
     // A terminal receipt is not proof that the current bytes were its work.
     // Preserve real times; never rebase an old owner onto changed source.
     const currentEvidence=candidate&&result.head_sha===currentControl.source_sha&&(result.source_current===true||candidate.input_digest===currentInput);
     row.observation=currentEvidence?{...candidate,input_digest:currentInput,state:result.state==='failed'?'failed':result.state==='cancelled'?'cancelled':'blocked'}:null;
     row.execution_input_digest=result.specialist_execution&&result.state==='succeeded'&&currentEvidence?currentInput:null;
     await persist(state);await observe(state);
    }
    if(await intake(row.last_job?.continuity_additions||[])){restart=true;break;}
   }
   let input=await identity(stage);
   if(row.receipt?.input_digest===input&&row.state==='passed'&&['implementation','test'].includes(stage.kind)&&(!stage.specialist_role||row.execution_input_digest===input))continue;
   while(true){
    control=await gate();const proof=stage.specialist_role&&(!row.last_job?.specialist_execution||row.execution_input_digest!==input)?{passed:false,fingerprint:'specialist-execution-required'}:await verify(stage),after=await identity(stage);
    if(proof?.passed===true&&typeof proof.evidence==='string'&&proof.evidence&&after===input){row.state='passed';row.receipt={input_digest:after,evidence:proof.evidence,source_sha:control.source_sha,...(row.observation?.input_digest===after?{owner:row.observation.owner}:{} )};await persist(state);await observe(state);break;}
    row.state='repair-required';row.receipt=null;
    if(row.observation&&row.observation.input_digest!==after)row.observation=null;
    await persist(state);await observe(state);
    const fingerprint=hash({input:after,diagnostic:proof?.fingerprint||'verification-failed'});
    if(row.failure!==fingerprint){row.failure=fingerprint;row.attempts=0;}
    if(row.attempts>=2||actions>=maxActions){row.state='parked';await persist(state);break;}
    const fresh=await gate();if(fresh.revision!==control.revision||fresh.global_revision!==control.global_revision)throw Error('Control revision changed before continuation; refresh without launching');
    await prepare(stage,fresh); // known pre-launch blockers must not create uncertain intent
    row.pending={operation_id:'continuity-'+hash({plan:state.plan_digest,stage:stage.id,input:after,attempt:row.attempts}),stage:stage.id,prompt:stage.prompt,control_revision:fresh.revision,global_revision:fresh.global_revision,scope_revision:fresh.canonical_record_sha||null,provider:fresh.provider||null};
    row.attempts++;actions++;row.state='dispatching';await persist(state);
    let result;try{result=await execute(row.pending,stage,async observation=>{row.observation={...observation,input_digest:await identity(stage)};await persist(state);await observe(state);});}catch{row.state='reconciliation-required';if(row.observation)row.observation.state='stale';await persist(state);await observe(state);break;}
    if(!result||!terminal.has(result.state)){row.state='reconciliation-required';if(row.observation)row.observation.state='stale';await persist(state);await observe(state);break;}
    row.last_job=result;row.pending=null;row.execution_input_digest=result.specialist_execution&&result.state==='succeeded'?await identity(stage):null;await persist(state);await gate();
    if(await intake(result.continuity_additions||[])){restart=true;break;}
    input=await identity(stage);
   }
   if(restart)break;
  }
  if(restart)continue;
  if(await intake(await discover(state)))continue;
  effective=expandedContinuityPlan(plan,state.additions||[]);let invalid=false;
  for(const stage of effective.stages){const row=state.stages[stage.id];if(row?.state==='passed'&&row.receipt?.input_digest!==await identity(stage)){row.state='ready';invalid=true;}}
  if(!invalid)break;
 }
 state.effective_plan=expandedContinuityPlan(plan,state.additions||[]);
 state.acceptance_completed=!unresolvedAdditions(state)&&state.effective_plan.stages.every(stage=>state.stages[stage.id]?.state==='passed');
 const finalControl=await gate();
 const missing=(finalControl.acceptance_additions||[]).filter(x=>!state.additions?.some(row=>row.status==='admitted'&&row.digest===expansionDigest(x.proposal)));
 if(missing.length){state.acceptance_completed=false;state.pending_canonical_additions=missing.map(x=>x.proposal.id);}
 state.completion_scope=plan.completion_scope||'objective';state.objective_completed=state.completion_scope==='objective'&&state.acceptance_completed;state.subobjective_completed=state.completion_scope==='subobjective'&&state.acceptance_completed;
 await persist(state);await observe(state);return state;
}

// Only digests and stable public stage IDs cross this boundary. The execution
// journal, verifier argv/output, prompts and routing roster remain private.
export function continuityCardProjection({plan,journal,assignment,observed_at=new Date().toISOString()}) {
 validateContinuityPlan(plan);
 if(journal?.schema!==1||journal.plan_digest!==hash(plan))throw Error('Checklist journal belongs to a different plan');
 const effective=expandedContinuityPlan(plan,journal.additions||[]),previous=assignment.card_steps;
 const revision=hash({objective_digest:plan.objective_digest,criteria:plan.criteria,stages:plan.stages.map(({id,kind,criteria,depends_on})=>({id,kind,criteria,depends_on}))});
 const steps=effective.stages.map(stage=>{
  const row=journal.stages?.[stage.id],proof=row?.receipt;
  const passed=row?.state==='passed'&&/^[a-f0-9]{64}$/.test(proof?.input_digest||'')&&/^sha256:[a-f0-9]{64}$/.test(proof?.evidence||'')&&/^[a-f0-9]{40}$/.test(proof?.source_sha||'');
  if(row?.state==='passed'&&!passed)throw Error('Checklist pass lacks matching verifier evidence');
  const observation=row?.observation;
  if(observation&&(!validCardOwner(observation.owner,assignment)||!['running','failed','blocked','cancelled','stale','skipped'].includes(observation.state)||!/^sha256:[a-f0-9]{64}$/.test(observation.evidence||'')||!/^[a-f0-9]{64}$/.test(observation.input_digest||'')||!/^[a-f0-9]{40}$/.test(observation.source_sha||'')||!Number.isFinite(Date.parse(observation.observed_at))))throw Error('Invalid bounded execution observation');
  const active=!passed&&observation;
  const old=previous?.steps.find(s=>s.id===stage.id)?.receipt;
  return {id:stage.id,label:stage.id.replaceAll('-',' '),depends_on:stage.depends_on,state:passed?'passed':active?active.state:!row||row.state==='ready'?'pending':'unknown',receipt:passed?{
   id:stage.id+':'+proof.input_digest.slice(0,32),assignment:assignment.id,step_id:stage.id,plan_revision:revision,input_digest:proof.input_digest,evidence:proof.evidence,source_sha:proof.source_sha,...(proof.owner?{owner:proof.owner}:{}),
   observed_at:old?.input_digest===proof.input_digest&&old?.evidence===proof.evidence&&old?.source_sha===proof.source_sha?old.observed_at:observed_at
  }:active?{id:stage.id+':'+active.input_digest.slice(0,32),assignment:assignment.id,step_id:stage.id,plan_revision:revision,input_digest:active.input_digest,evidence:active.evidence,source_sha:active.source_sha,observed_at:active.observed_at,owner:active.owner}:null};
 });
 // Invalidated prerequisites also invalidate dependent display receipts until
 // their own verifiers run again. A previous pass is not current completion.
 for(const step of steps)if(step.state==='passed'&&step.depends_on.some(id=>steps.find(s=>s.id===id)?.state!=='passed')){step.state='unknown';step.receipt=null;}
 const accounted=(assignment.acceptance_additions||[]).every(a=>journal.additions?.some(row=>row.status==='admitted'&&row.digest===expansionDigest(a.proposal)));
 return {schema:CARD_STEPS_SCHEMA,assignment:assignment.id,revision,objective_digest:plan.objective_digest,publisher:{owner:assignment.owner,branch:assignment.branch},sequence:(previous?.sequence||0)+1,complete:plan.completion_scope!=='subobjective'&&!unresolvedAdditions(journal)&&accounted,steps};
}
const milestone=value=>{if(!value)return null;const copy=structuredClone(value);delete copy.sequence;return hash(copy);};

export async function publishContinuityCard({config,plan,journal,rpc,readControl,readIntent,saveIntent}) {
 const control=await readControl();
 if(control.held||control.global_held||control.security_stop||!control.assignment_active||control.objective_digest!==plan.objective_digest)throw Error('Current authority stops checklist publication');
 const snapshot=await rpc('relay_runner_assignments',{project:config.project,assignment:config.assignment});
 const claim=snapshot.ok===true?snapshot.claims?.find(a=>a.id===config.assignment):null;
 if(!claim||claim.owner!==config.owner||claim.branch!==config.branch||claim.state!=='active'||!(Date.parse(claim.lease_until)>Date.now())||!/^[a-f0-9]{40}$/.test(snapshot.record_sha||'')||snapshot.record_sha!==control.canonical_record_sha)throw Error('Checklist ownership or revision changed before publication');
 const pending=await readIntent();
 if(pending){
  if(snapshot.record_sha===pending.request.expected_record_sha||JSON.stringify(claim.card_steps)!==JSON.stringify(pending.request.request.card_steps))throw Error('Checklist publication is unresolved; inspect the original transaction before another write');
  await saveIntent(null);
 }
 const projection=continuityCardProjection({plan,journal,assignment:claim});
 if(milestone(projection)===milestone(claim.card_steps))return {published:false,unchanged:true,record_sha:snapshot.record_sha};
 validateCardStepsPublication(projection,claim,control.objective_digest);
 const fresh=await readControl();
 if(fresh.held||fresh.global_held||fresh.security_stop||!fresh.assignment_active||fresh.objective_digest!==control.objective_digest||fresh.canonical_record_sha!==snapshot.record_sha||fresh.revision!==control.revision||fresh.global_revision!==control.global_revision||fresh.source_sha!==control.source_sha)throw Error('Control changed before checklist publication');
 const request={action:'amend',project:config.project,expected_record_sha:snapshot.record_sha,request:{id:config.assignment,owner:config.owner,card_steps:projection,reason:'Publish verified continuity checklist milestone'}};
 await saveIntent({request});
 // Even a failed/lost response is reconciled by an independent exact readback.
 // Never replay a mutation merely because the transport did not answer.
 let outcome;try{outcome=await rpc('relay_runner_coordinate',request);}catch(error){if(['conflict','validation','ownership','policy','policy_drift'].includes(error.code))outcome={ok:false,error:{class:error.code}};}
 const readback=await rpc('relay_runner_assignments',{project:config.project,assignment:config.assignment});
 const latest=readback.ok===true?readback.claims?.find(a=>a.id===config.assignment):null;
 const confirmed=latest&&latest.owner===config.owner&&latest.branch===config.branch&&latest.state==='active'&&Date.parse(latest.lease_until)>Date.now()&&/^[a-f0-9]{40}$/.test(readback.record_sha||'')&&readback.record_sha!==snapshot.record_sha&&JSON.stringify(latest.card_steps)===JSON.stringify(projection);
 if(!confirmed){
  // A structured authoritative rejection before application is not an unknown
  // write. Stop this run, but let a later fresh control/CAS attempt proceed.
  if(outcome?.ok===false&&['conflict','validation','ownership','policy','policy_drift'].includes(outcome.error?.class)&&readback.ok===true&&/^[a-f0-9]{40}$/.test(readback.record_sha||'')&&JSON.stringify(latest?.card_steps)!==JSON.stringify(projection)){
   await saveIntent(null);throw Error('Checklist publication rejected without application: '+outcome.error.class+'; refresh before another attempt');
  }
  throw Error('Checklist publication readback is stale or mismatched; preserve its pending intent');
 }
 await saveIntent(null);
 return {published:true,record_sha:readback.record_sha,reconciled:outcome?.ok!==true};
}

// Observe only acknowledged canonical process receipts. No routing event emits work.
export function specialistExecutionRpc({rpc,config,jobId,specialist,sourceSha,onObservation,onReceipt=async()=>{},terminalReadback=false}){
 return async(name,args)=>{
  const result=await rpc(name,args);
  if(!specialist||name!=='relay_execution'||!['start','finish'].includes(args.action))return result;
  const job=result?.job,process=job?.process;
  if(result.ok!==true||job?.id!==jobId||args.job_id!==jobId||job.assignment!==config.assignment||job.project!==config.project||job.owner!==config.owner||job.branch!==config.branch||job.initial_head_sha!==sourceSha||
     job.executor_id!==args.executor_id||job.revision!==args.expected_revision+1||!Number.isSafeInteger(job.attempt)||job.attempt<1||!Number.isInteger(process?.pid)||process.pid<1||!process.host||process.adapter!==(config.provider||'codex')+'-cli'||
     args.action==='start'&&(job.state!=='running'||JSON.stringify(process)!==JSON.stringify(args.process))||
     args.action==='finish'&&(!terminal.has(job.state)||JSON.stringify(job.result)!==JSON.stringify(args.result)))throw Error('Specialist observation requires the exact acknowledged execution receipt');
  const at=args.action==='start'?job.started_at:job.finished_at,head=args.action==='start'?sourceSha:job.result.head_sha;
  if(!Number.isFinite(Date.parse(at))||(!terminalReadback||args.action!=='finish')&&Date.now()-Date.parse(at)>300000||Date.parse(at)>Date.now()+5000||!/^[a-f0-9]{40}$/.test(head||''))throw Error('Specialist execution observation is stale or has unknown source');
  const observation={owner:specialist.owner,state:args.action==='start'?'running':job.state==='succeeded'?'blocked':job.state,source_sha:head,observed_at:at,
   evidence:'sha256:'+hash({job_id:job.id,attempt:job.attempt,revision:job.revision,executor_id:job.executor_id,process,at,result:job.result||null})};
  await onObservation(observation);await onReceipt(job,observation);
  return result;
 };
}

export async function runContinuityExecution({config,workspace,stateDir,rpc,runExecution,nativeHost,verifyStage}){
 workspace=await fs.realpath(workspace);
 const plan=validateContinuityPlan(config.continuity),directory=path.resolve(stateDir);
 if(directory===workspace||directory.startsWith(workspace+path.sep))throw Error('Continuity receipts must live outside the checkout');
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 const lock=path.join(directory,'continuity.lock');await fs.mkdir(lock,{mode:0o700});
 const filename=path.join(directory,'continuity.json');let journal;
 const publicationFile=path.join(directory,'card-publication.json');
 const readIntent=async()=>{try{return JSON.parse(await fs.readFile(publicationFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;return null;}};
 const saveIntent=async value=>{await fs.writeFile(publicationFile+'.tmp',JSON.stringify(value)+'\n',{mode:0o600});await fs.rename(publicationFile+'.tmp',publicationFile);};
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
 const persist=async value=>{await fs.writeFile(filename+'.tmp',JSON.stringify(value)+'\n',{mode:0o600});await fs.rename(filename+'.tmp',filename);};
 let assignmentRecord=null;
 const assignment=async()=>{
  const result=await rpc('relay_runner_assignments',{project:config.project,assignment:config.assignment});
  assignmentRecord=result.record_sha||null;const a=result.ok===true?result.claims?.find(x=>x.id===config.assignment):null;if(!a||a.id!==config.assignment||a.owner!==config.owner||a.branch!==config.branch)throw Error('Current assignment identity unavailable');return a;
 };
 const readControl=async()=>{
  const global=await rpc('relay_autonomy',{action:'status',scope:'global'}),project=await rpc('relay_autonomy',{action:'status',scope:config.project}),a=await assignment();
  if(global.ok!==true||project.ok!==true||!Number.isSafeInteger(global.state?.revision)||!Number.isSafeInteger(project.state?.revision))throw Error('Authoritative control unavailable');
  return {global_held:global.state.held,held:project.state.held,revision:project.state.revision,global_revision:global.state.revision,assignment_active:a.state==='active'&&Date.parse(a.lease_until)>Date.now(),objective_digest:hash({goal:a.goal,acceptance:a.acceptance}),original_goal_digest:hash(a.goal),provider:config.provider||'codex',canonical_record_sha:assignmentRecord,card_attribution:{primary_staff:a.primary_staff,primary_team:a.primary_team,supporting_staff:a.supporting_staff||[],supporting_teams:a.supporting_teams||[]},paths:a.paths||[],acceptance_additions:a.acceptance_additions||[],source_sha:git(['rev-parse','HEAD'])};
 };
 const jobStatus=async job_id=>{const result=await rpc('relay_execution',{action:'status',project:config.project,assignment:config.assignment,...(job_id?{job_id}:{})});if(result.ok!==true)throw Error('Authoritative execution status unavailable');return result.job;};
 const outsideScope=async paths=>{const files=[...new Set([...git(['diff','--name-only','-z','HEAD']).split('\0'),...git(['ls-files','--others','--exclude-standard','-z']).split('\0')])].filter(x=>x&&!x.startsWith('qa-evidence/')&&!insideExpansionScope(x,paths)).sort(),snapshot=[];for(const file of files){try{const st=await fs.lstat(path.join(workspace,file));if(!st.isFile()||st.isSymbolicLink()||st.size>16*1024*1024)throw Error('Unbounded outside-scope source');snapshot.push([file,hash(await fs.readFile(path.join(workspace,file)))]);}catch(e){if(e.code!=='ENOENT')throw e;snapshot.push([file,'deleted']);}}return hash(snapshot);};
 const reconcile=async pending=>{
  const saved=JSON.parse(await fs.readFile(filename,'utf8')),stage=expandedContinuityPlan(plan,saved.additions||[]).stages.find(s=>s.id===pending.stage);
  if(nativeHost&&!stage.command)return nativeHost.reconcile(pending,stage);
  if(stage.command){const proof=await verify(stage);return proof.passed?{state:'succeeded',evidence:proof.evidence}:null;}
  const job=await jobStatus(pending.job_id||(stage.id===config.initial_stage?config.initial_job?.id:null)||'job_'+hash({project:config.project,assignment:config.assignment,operation:pending.operation_id}));
  if(!job||job.request!==(pending.execution_prompt||pending.prompt))return null;
  const proof=pending.specialist_receipt;
  const sourceCurrent=proof&&proof.job_digest===hash(job)&&proof.source_fingerprint===await sourceFingerprint(workspace);
  return {state:job.state,job_id:job.id,head_sha:job.result?.head_sha,specialist_execution:Boolean(sourceCurrent),source_current:Boolean(sourceCurrent),...(sourceCurrent?{observation:proof.observation}:{}),...(job.result?.continuity_additions?{continuity_additions:job.result.continuity_additions}:{})};
 };
 const verify=async stage=>{
  if(verifyStage)return verifyStage(stage);
  const r=spawnSync(stage.verify[0],stage.verify.slice(1),{cwd:workspace,env:process.env,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
  return {passed:r.status===0,evidence:'sha256:'+hash({command:stage.verify,stdout:r.stdout,stderr:r.stderr,status:r.status}),fingerprint:hash({status:r.status,signal:r.signal})};
 };
 try{
  try{journal=JSON.parse(await fs.readFile(filename,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  return await reconcileContinuity({plan,journal,persist,readControl,
   observe:journal=>publishContinuityCard({config,plan,journal,rpc,readControl,readIntent,saveIntent}),
   discover:async()=>{const a=await assignment();return [...(config.continuity_additions||[]),...(a.acceptance_additions||[]).map(x=>x.proposal)];},
   reviewAddition:async(proposal,context)=>{
    const a=await assignment(),recorded=a.acceptance_additions?.find(x=>x.base_objective_digest===plan.objective_digest&&expansionDigest(x.proposal)===expansionDigest(proposal)&&x.goal_digest===hash(plan.expansion.original_goal)&&x.profile_digest===hash(plan.expansion.profiles[proposal.profile]));
    if(recorded)return recorded.review;
    if(nativeHost)return nativeHost.review(proposal,context);
    const review=plan.expansion?.review;if(!review)return null;
    const result=spawnSync(review[0],review.slice(1),{cwd:workspace,env:process.env,input:JSON.stringify({schema:1,proposal,context}),encoding:'utf8',timeout:120000,maxBuffer:32768,stdio:['pipe','pipe','pipe']});
    if(result.status!==0)return null;try{return JSON.parse(result.stdout);}catch{return null;}
   },
   admitScope:async(proposal,row)=>{
    const snapshot=await rpc('relay_runner_assignments',{project:config.project,assignment:config.assignment}),a=snapshot.ok===true?snapshot.claims?.find(x=>x.id===config.assignment):null,record=snapshot.record_sha;
    if(!a||a.id!==config.assignment||a.owner!==config.owner||a.branch!==config.branch||a.state!=='active')throw Error('Current scope ownership unavailable');
    const envelope=plan.expansion?.allowed_paths||a.paths;
    if(!Array.isArray(envelope)||proposal.paths.some(p=>!insideExpansionScope(p,envelope)))return {admitted:false,reason:'Supporting paths require authority outside the configured expansion envelope'};
    const control=await readControl();if(control.held||control.global_held)throw Error('Scope admission stopped');
    // The existing atomic amendment preserves the original goal/history and
    // makes supporting acceptance canonical, not merely a local suggestion.
    const recorded=a.acceptance_additions?.find(x=>x.base_objective_digest===plan.objective_digest&&expansionDigest(x.proposal)===expansionDigest(proposal)&&x.profile_digest===hash(plan.expansion.profiles[proposal.profile])&&x.goal_digest===hash(plan.expansion.original_goal));
    if(recorded&&proposal.paths.every(p=>insideExpansionScope(p,a.paths||[])))return {admitted:true,record_sha:record,paths:proposal.paths,canonical_addition_digest:expansionDigest(recorded),readback_verified:true};
    if(row.scope_request&&row.scope_request.expected_record_sha!==record)return {admitted:false,reason:'Scope/acceptance changed after an uncertain admission; reconcile without replay'};
    if((row.scope_attempts||0)>=2)return {admitted:false,reason:'Bounded scope admission exhausted'};
    const receipt={schema:1,base_objective_digest:plan.objective_digest,goal_digest:hash(plan.expansion.original_goal),proposal,review:row.review,profile_digest:hash(plan.expansion.profiles[proposal.profile])};
    row.scope_request ||= {action:'amend',project:config.project,expected_record_sha:record,request:{id:config.assignment,owner:config.owner,paths:[...new Set([...a.paths,...proposal.paths])],acceptance_additions:[...(a.acceptance_additions||[]),receipt],reason:'Goal-preserving '+proposal.kind+' feature '+proposal.id+': '+proposal.reason,next_action:'Complete original goal and admitted supporting feature '+proposal.id+': '+proposal.reason}};
    row.scope_attempts=(row.scope_attempts||0)+1;
    const saved=JSON.parse(await fs.readFile(filename,'utf8'));saved.additions.find(x=>x.digest===row.digest).scope_request=row.scope_request;saved.additions.find(x=>x.digest===row.digest).scope_attempts=row.scope_attempts;await persist(saved);
    try{await rpc('relay_runner_coordinate',row.scope_request);}catch{}
    const latest=await assignment(),accepted=latest.acceptance_additions?.find(x=>expansionDigest(x)===expansionDigest(receipt)),admitted=latest.state==='active'&&latest.goal===a.goal&&latest.acceptance===a.acceptance&&Boolean(accepted)&&proposal.paths.every(p=>insideExpansionScope(p,latest.paths||[]));
    return {admitted,paths:proposal.paths,...(admitted?{canonical_addition_digest:expansionDigest(accepted)}:{}),readback_verified:true};
   },
   inputs:async stage=>{
    const files=git(['ls-files','--cached','--others','--exclude-standard','-z','--',...stage.inputs]).split('\0').filter(Boolean).sort();
    const environment={node:process.version,platform:process.platform,arch:process.arch,variables:Object.fromEntries(['PATH','NODE_OPTIONS','TZ','LANG','PLAYWRIGHT_BROWSERS_PATH'].map(key=>[key,process.env[key]||null])),toolchain:[]};
    for(const file of ['package.json','package-lock.json','.node-version','node_modules/.package-lock.json']){try{environment.toolchain.push([file,hash(await fs.readFile(path.join(workspace,file)))]);}catch(e){if(e.code!=='ENOENT')throw e;environment.toolchain.push([file,'absent']);}}
    const bytes=[];for(const file of files){const full=path.resolve(workspace,file);if(!full.startsWith(path.resolve(workspace)+path.sep))throw Error('Input escapes workspace');let st;try{st=await fs.lstat(full);}catch(e){if(e.code==='ENOENT'){bytes.push([file,'deleted']);continue;}throw e;}if(!st.isFile()||st.isSymbolicLink()||st.size>16*1024*1024)throw Error('Input is not bounded source');bytes.push([file,hash(await fs.readFile(full))]);}return {bytes,environment};
   },
   verify,reconcile,
   prepare:async(stage,c)=>{if(stage.id===config.initial_stage&&(await jobStatus(config.initial_job.id))?.state!=='queued')throw Error('Original execution is terminal but current source proof is unverified; reconcile without another launch');if(stage.specialist_role||c.card_attribution.primary_staff||c.card_attribution.supporting_staff.length)stageSpecialist(stage,c.card_attribution);},
   execute:async (pending,stage,onObservation)=>{
    const c=await readControl();if(c.held||c.global_held||!c.assignment_active||c.revision!==pending.control_revision||c.global_revision!==pending.global_revision||(pending.scope_revision&&c.canonical_record_sha!==pending.scope_revision)||(pending.provider&&pending.provider!==(config.provider||'codex'))||(stage.addition&&stage.addition.paths.some(p=>!insideExpansionScope(p,c.paths))))throw Error('Stop/revision changed before submit');
    if(stage.command){
     const result=spawnSync(stage.command[0],stage.command.slice(1),{cwd:workspace,env:process.env,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
     if(result.error||result.signal)return {state:'unknown'};
     return {state:result.status===0?'succeeded':'failed',exit_code:result.status,evidence:'sha256:'+hash({command:stage.command,stdout:result.stdout,stderr:result.stderr,status:result.status})};
    }
    if(nativeHost){
     pending.adapter='codex-native-tools';const saved=JSON.parse(await fs.readFile(filename,'utf8'));saved.stages[pending.stage].pending=pending;await persist(saved);
     const broker=await jobStatus();if(broker&&!terminal.has(broker.state))throw Error('Unreconciled coding execution occupies this assignment');
     const before=await outsideScope(c.paths),result=await nativeHost.execute(pending,stage,{original_goal:plan.expansion?.original_goal,original_criteria:plan.criteria,profiles:Object.keys(plan.expansion?.profiles||{}),card_attribution:c.card_attribution,paths:c.paths,source_sha:c.source_sha,canonical_record_sha:c.canonical_record_sha},onObservation);
     if(result.head_sha!==git(['rev-parse','HEAD'])||before!==await outsideScope(c.paths))throw Error('Native source report or admitted scope changed; preserve work for reconciliation');return result;
    }
    const specialist=stage.specialist_role||c.card_attribution.primary_staff||c.card_attribution.supporting_staff.length?stageSpecialist(stage,c.card_attribution):null;
    const adopted=stage.id===config.initial_stage?config.initial_job:null;
    const executionPrompt=adopted?adopted.request:pending.prompt+(specialist?'\n\nBounded responsibility: '+specialist.role+'. '+specialist.instruction:'');
    if(pending.execution_prompt&&pending.execution_prompt!==executionPrompt)throw Error('Specialist execution responsibility changed; reconcile original intent');
    pending.execution_prompt=executionPrompt;pending.specialist=specialist;
    const intent=JSON.parse(await fs.readFile(filename,'utf8'));intent.stages[pending.stage].pending=pending;await persist(intent);
    let job=await jobStatus();
    const expectedJob=adopted?.id||'job_'+hash({project:config.project,assignment:config.assignment,operation:pending.operation_id});
    if(adopted){job=await jobStatus(expectedJob);if(!job||job.id!==adopted.id||job.request!==adopted.request||job.initial_head_sha!==adopted.initial_head_sha||job.owner!==config.owner||job.branch!==config.branch||job.state!=='queued')throw Error('Original execution is no longer safely queued; reconcile its exact receipt');}
    if(job?.id!==expectedJob){
     if(job&&!terminal.has(job.state))throw Error('An unreconciled execution occupies the assignment');
     const result=await rpc('relay_execution',{action:'submit',project:config.project,assignment:config.assignment,expected_owner:config.owner,expected_branch:config.branch,expected_head_sha:c.source_sha,operation_id:pending.operation_id,prompt:executionPrompt,required_capabilities:[(config.provider||'codex')+'-cli',...(config.source_checkpoints?['source-byte-checkpoints-v1']:[])]});job=result.job;
    }
    pending.job_id=job.id;
    // Persist binding before starting a process; a crash can reconcile this job.
    const saved=JSON.parse(await fs.readFile(filename,'utf8'));saved.stages[pending.stage].pending=pending;await persist(saved);
    const result=await runExecution({config:{...config,job_id:job.id,continuity:undefined,resume:false,coordinator_stage:stage.id,coordinator_specialist:specialist,...(plan.expansion?{continuity_discovery:{goal_digest:hash(plan.expansion.original_goal),profiles:Object.keys(plan.expansion.profiles),original_criteria:plan.criteria}}:{})},workspace,stateDir:path.join(directory,job.id),rpc:specialistExecutionRpc({rpc,config,jobId:job.id,specialist,sourceSha:c.source_sha,onObservation,onReceipt:async(job,observation)=>{
     if(!terminal.has(job.state))return;
     pending.specialist_receipt={job_digest:hash(job),source_fingerprint:await sourceFingerprint(workspace),observation};
     const saved=JSON.parse(await fs.readFile(filename,'utf8'));saved.stages[pending.stage].pending=pending;await persist(saved);
    }}),admittedContinuation:await sourceFingerprint(workspace)});
    return {...result,job_id:job.id,specialist_execution:Boolean(specialist)};
   }
  });
 }finally{await fs.rm(lock,{recursive:true});}
}
export async function sourceFingerprint(workspace){
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
 const files=git(['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean).sort(),extra=[];
 for(const file of files){const full=path.join(workspace,file),st=await fs.lstat(full);if(!st.isFile()||st.isSymbolicLink()||st.size>16*1024*1024)throw Error('Unbounded or redirected continuation source');extra.push([file,hash(await fs.readFile(full))]);}
 return hash({head:git(['rev-parse','HEAD']).trim(),diff:git(['diff','--binary','HEAD']),extra});
}
