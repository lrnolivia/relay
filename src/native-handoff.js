import {createHash} from 'node:crypto';
import {publicCardUpdateSchema,validPublicCardUpdate} from './relay-card-updates.js';
import {stageSpecialist} from './specialist-workflow.js';
import {validateCardStepsPublication} from './relay-card-steps.js';
import {continuityObjectiveDigest} from '../packages/runner/src/continuity-expansion.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scope=assignment=>hash({paths:assignment.paths,resources:assignment.resources||[]});
const fail=message=>{throw Error('Native handoff: '+message);};
const id={type:'string',minLength:1,maxLength:100,pattern:'^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'};
const sha={type:'string',pattern:'^[a-f0-9]{40}$'};
const digest={type:'string',pattern:'^[a-f0-9]{64}$'};
const text=max=>({type:'string',minLength:1,maxLength:max});
export const nativeHandoffSchema={type:'object',additionalProperties:false,required:['project','assignment','owner','action','operation_id'],properties:{
  project:{...id,pattern:'^[a-z0-9-]+$'},assignment:id,owner:id,operation_id:id,
  action:{type:'string',enum:['prepare','read','started','result']},expected_record_sha:sha,
  source_sha:sha,objective_digest:digest,step_id:{...id,maxLength:64,pattern:'^[a-z][a-z0-9-]{0,63}$'},
  label:text(160),role:{...id,maxLength:64,pattern:'^[a-z][a-z0-9-]{0,63}$'},
  host_tool:{...text(160),pattern:'^[a-zA-Z0-9_.:-]+$'},host_available:{type:'boolean'},intent_digest:digest,
  request_digest:digest,agent_id:{...text(240),pattern:'^[-a-zA-Z0-9_/.]+$'},observed_at:text(40),
  state:{type:'string',enum:['succeeded','failed','blocked','cancelled']},result_digest:digest,
  update:{...publicCardUpdateSchema,description:'Optional explicitly authored public update on started/result only. Never copy private prompts, transcripts or diagnostic logs. Visual references must bind this assignment and exact source.'}
}};
const fields={read:[],prepare:['source_sha','objective_digest','step_id','label','role','host_tool','host_available','intent_digest'],started:['request_digest','source_sha','agent_id','observed_at'],result:['request_digest','source_sha','agent_id','observed_at','state','result_digest']};
export function nativeIntent(args){
  if(!args||typeof args!=='object'||Array.isArray(args))fail('bounded action required');
  for(const [key,value] of Object.entries(args)){
    const rule=nativeHandoffSchema.properties[key];
    if(!rule||typeof value!==rule.type||rule.type==='string'&&(value.length<(rule.minLength||0)||value.length>(rule.maxLength||1000)||rule.pattern&&!new RegExp(rule.pattern).test(value))||rule.enum&&!rule.enum.includes(value))fail('invalid '+key);
  }
  const selected=fields[args.action];if(!selected)fail('unknown action');
  const optional=['started','result'].includes(args.action)?['update']:[];
  if(args.update!==undefined&&!validPublicCardUpdate(args.update,{source_sha:args.source_sha}))fail('invalid public update');
  const common=['project','assignment','owner','action','operation_id',...(args.action==='read'?[]:['expected_record_sha'])];
  if([...common,...selected].some(k=>args[k]===undefined)||Object.keys(args).some(k=>![...common,...selected,...optional].includes(k)))fail('exact action fields are required');
  return Object.fromEntries([...selected,...optional.filter(k=>args[k]!==undefined)].map(k=>[k,args[k]]));
}
export function nativeHandoffView(row,{source_sha,assignment,launch=false}={}){
  const current=Boolean(row&&assignment?.state==='active'&&Date.parse(assignment.lease_until)>Date.now()&&row.owner===assignment.owner&&row.branch===assignment.branch&&row.source_sha===source_sha&&row.scope_digest===scope(assignment)&&row.objective_digest===continuityObjectiveDigest(assignment.goal,assignment.acceptance));
  return {schema:1,receipt:row||null,source_current:current,launch_required:Boolean(launch&&current),
    state:!row?'absent':!current?'reconciliation-needed':row.state==='prepared'&&!launch?'reconciliation-needed':row.state,
    next_action:!row?'Prepare one bounded task only if this coordinator has an actual authorized host delegation tool.':!current?'Preserve historical evidence; reconcile changed source, ownership, lease or objective. Do not launch.':row.state==='prepared'?(launch?'Persist this packet locally, invoke the actual host tool exactly once, then report started with its returned agent ID.':'A launch may already have happened. Recover its exact ID through this task’s authorized host receipt; never relaunch or expire the intent into a retry.') :row.state==='started'?'Wait for the exact recorded agent, then report its actual result digest. Do not create another agent.':'Result is recorded; successful execution awaits separate task-specific verification and is not an acceptance pass.',
    ...(launch&&current?{delegation:{host_tool:row.prepare.host_tool,operation_id:row.operation_id,request_digest:row.request_digest,source_sha:row.source_sha,step_id:row.step_id,role:row.specialist.role,staff:row.specialist.owner,paths:assignment.paths,intent_digest:row.prepare.intent_digest,instructions:'Immediately before the actual host call, refresh current control/owner/source and stop on change or uncertainty. This protocol is read-only snapshot review/research/inspection: inspect exactly source_sha; do not edit source, commit, or treat uncommitted work as that snapshot. Perform only the locally retained bounded task matching intent_digest under this assignment and source. Do not create agents, reassign, modify credentials, merge or deploy. Return actual findings. The coordinator should author a concise explicitly public update with started/result; never copy the private result automatically. At actual design submission include preview attached with a real design artifact or preview unavailable with a specific reason; kickoff preview is pending. Attach only existing Inspector visuals bound to this assignment and exact source. The staff label is fictional; no Git identity is granted.'}}:{}),
    attestation:'Coordinator-reported actual host invocation; not independently verified or cryptographic proof. Raw prompts, transcripts and secrets stay private.',objective_completed:false};
}

// Called only by the canonical coordination transition. Handoff and card data
// are returned as one patch, then committed/read back by the existing CAS path.
export function transitionNativeHandoff(assignment,args,verifiedSource,now=new Date()){
  const intent=nativeIntent(args), rows=structuredClone(assignment.native_handoffs||[]);
  if(assignment.owner!==args.owner||assignment.id!==args.assignment)fail('current owner required');
  const row=rows.find(x=>x.operation_id===args.operation_id);
  if(row&&row.project!==args.project)fail('project binding changed');
  const phase=args.action==='prepare'?'prepare':args.action==='started'?'start':'result';
  if(row?.[phase]){
    if(hash(row[phase])!==hash(intent))fail('conflicting operation reuse');
    return {native_handoffs:rows,replayed:true};
  }
  if(assignment.state!=='active'||Date.parse(assignment.lease_until)<=+now)fail('active unexpired assignment required');
  if(args.source_sha!==verifiedSource)fail('source changed; preserve original receipt');
  const objective=continuityObjectiveDigest(assignment.goal,assignment.acceptance);
  let target=row;
  if(args.action==='prepare'){
    if(rows.length>=16)fail('bounded handoff capacity reached');
    if(!args.host_available)fail('current coordinator has no authorized host delegation capability');
    if(args.objective_digest!==objective)fail('objective changed');
    if(/[\x00-\x1f<>]/.test(args.label))fail('plain bounded step label required');
    if(rows.some(x=>x.step_id===args.step_id))fail('step already has a handoff; reconcile it');
    const existing=assignment.card_steps?.steps.find(x=>x.id===args.step_id);
    if(existing&&(!['pending','unknown'].includes(existing.state)||existing.label!==args.label))fail('existing step evidence or label cannot be replaced');
    if(existing?.depends_on.some(id=>assignment.card_steps.steps.find(x=>x.id===id)?.state!=='passed'))fail('prerequisites must be verified before launch');
    if(assignment.card_steps&&!existing&&assignment.card_steps.revision!==hash({assignment:assignment.id,objective,native:1}))fail('preserve the existing plan; prepare one of its already recorded steps');
    const specialist=stageSpecialist({id:args.step_id,specialist_role:args.role},assignment);
    target={schema:1,project:args.project,operation_id:args.operation_id,assignment:assignment.id,owner:assignment.owner,branch:assignment.branch,source_sha:args.source_sha,objective_digest:objective,scope_digest:scope(assignment),step_id:args.step_id,specialist,prepare:intent,state:'prepared',prepared_at:now.toISOString()};
    target.request_digest=hash(target);rows.push(target);
  }else{
    if(!row||args.request_digest!==row.request_digest||row.source_sha!==args.source_sha||row.branch!==assignment.branch||row.owner!==assignment.owner||row.objective_digest!==objective||row.scope_digest!==scope(assignment))fail('missing or stale prepared binding');
    if(hash(stageSpecialist({id:row.step_id,specialist_role:row.specialist.role},assignment))!==hash(row.specialist))fail('staff routing changed');
    const at=Date.parse(args.observed_at);
    if(!Number.isFinite(at)||at>+now+5000||+now-at>300000||at<Date.parse(row.prepared_at))fail('stale observation');
    if(args.agent_id===assignment.owner)fail('host agent must be distinct from coordinator');
    if(args.action==='started'){
      if(row.state!=='prepared'||rows.some(x=>x.start?.agent_id===args.agent_id))fail('agent identity already bound');
      row.start=intent;row.state='started';row.started_at=now.toISOString();
    }else{
      if(row.state!=='started'||row.start.agent_id!==args.agent_id||at<Date.parse(row.start.observed_at))fail('result requires exact started agent');
      row.result=intent;row.state='reported';row.reported_at=now.toISOString();
    }
  }
  const previous=assignment.card_steps;
  const projection=previous?structuredClone(previous):{schema:'relay-card-steps/v1',assignment:assignment.id,revision:hash({assignment:assignment.id,objective,native:1}),objective_digest:objective,publisher:{owner:assignment.owner,branch:assignment.branch},sequence:0,complete:false,steps:[]};
  const old=projection.steps.find(x=>x.id===target.step_id);
  if(args.action!=='prepare'&&(!old||hash(old)!==target.step_digest))fail('canonical step changed; preserve its evidence');
  const step=old||{id:target.step_id,label:target.prepare.label,depends_on:[],state:'pending',receipt:null};
  if(!old){projection.steps.push(step);projection.complete=false;}
  if(args.action!=='prepare'){
    step.state=args.action==='started'?'running':args.state==='succeeded'?'blocked':args.state;
    step.receipt={id:target.operation_id+':'+args.action,assignment:assignment.id,step_id:step.id,plan_revision:projection.revision,input_digest:target.request_digest,evidence:'sha256:'+hash(intent),source_sha:target.source_sha,observed_at:args.observed_at,owner:target.specialist.owner,...(args.update?{update:args.update}:{}),...(args.action==='result'&&args.state==='succeeded'?{phase:'awaiting-verification'}:{})};
  }
  projection.publisher={owner:assignment.owner,branch:assignment.branch};projection.sequence++;
  target.step_digest=hash(step);
  return {native_handoffs:rows,card_steps:validateCardStepsPublication(projection,assignment,objective,now),replayed:false};
}
