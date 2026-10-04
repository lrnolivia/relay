import { createHash } from 'node:crypto';
import { validateControlArguments } from '../../../src/runner-control.js';
import { callRunnerControlCore } from '../../../src/runner-control-core.js';
import { githubApiRequest } from '../../../src/source.js';
import { operateJob } from './jobs.mjs';
import { callJobs } from './job-control.mjs';
const text=(maxLength,pattern)=>({type:'string',minLength:1,maxLength,...(pattern?{pattern}:{})});
const id=text(100,'^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'),sha=text(40,'^[a-f0-9]{40}$');
const object=(properties,required=[])=>({type:'object',additionalProperties:false,properties,required});
export const nightShiftTool={name:'relay_night_shift',title:'Account for away work and request Shift',description:'QUERY / COMMAND — read or explicitly classify an existing execution receipt within a declared away window; bind an existing oversight assignment; promote one recorded item into an already admitted assignment. Source existence is verified independently, process receipts remain attributed. A Shift request is queued work, never proof that an executor or additional worker started.',inputSchema:object({
 action:{type:'string',enum:['read','record','shift','oversight']},project:text(80,'^[a-z0-9-]+$'),assignment:id,expected_owner:id,expected_branch:text(240),expected_revision:{type:'integer',minimum:0},operation_id:id,
 job_id:text(68,'^job_[a-f0-9]{64}$'),source_assignment:id,item_id:text(67,'^ns_[a-f0-9]{64}$'),summary:text(2000),
 away_window:object({start:text(40),end:text(40)},['start','end']),
 recipient:object({assignment:id,owner:id,branch:text(240),head_sha:sha},['assignment','owner','branch','head_sha']),
 oversight:object({assignment:id,owner:id,branch:text(240)},['assignment','owner','branch']),cursor:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:20}
 },['action','project','assignment']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const storageKey=project=>`night-shift/v1/${project}.json`;
export async function readNightShift(bucket,project){
 if(!bucket?.get||!bucket?.put)throw Error('Night Shift durable storage unavailable');
 const stored=await bucket.get(storageKey(project));
 const record=stored?await stored.json():{schema:1,revision:0,items:[],operations:[],oversight:null};
 if(record.schema!==1||!Array.isArray(record.items)||!Array.isArray(record.operations))throw Error('Invalid Night Shift ledger');
 return {stored,record};
}
export function oversightView(record,claims,now=Date.now()){
 const binding=record.oversight,claim=binding&&claims.find(x=>x.id===binding.assignment);
 const available=Boolean(claim&&claim.owner===binding.owner&&claim.branch===binding.branch&&claim.state==='active'&&Date.parse(claim.lease_until)>now);
 return {binding,available,worker_online_verified:false,reason:available?'Canonical assignment bound; worker activity remains unverified.':binding?'Oversight assignment changed or expired; reconcile.':'No oversight assignment bound.'};
}
export async function operateNightShift(bucket,args,{claims,sourceJob,verifyCommit,submitJob},now=Date.now()){
 let writeStarted=null;
 try{
 const {stored,record}=await readNightShift(bucket,args.project);
 writeStarted=Boolean(record.operations.find(x=>x.id===args.operation_id));
 if(args.action==='read'){
  const start=args.cursor||0,limit=args.limit||20;
  return {ok:true,revision:record.revision,items:record.items.slice(start,start+limit),next_cursor:start+limit<record.items.length?start+limit:null,oversight:oversightView(record,claims,now),process_verified:false,away_verified:false};
 }
 const actor=claims.find(x=>x.id===args.assignment);
 const owned=(claim,owner,branch)=>{if(!claim||claim.state!=='active'||claim.owner!==owner||claim.branch!==branch||Date.parse(claim.lease_until)<=now)throw Error('Current active assignment ownership is required');};
 owned(actor,args.expected_owner,args.expected_branch);
 if(!args.operation_id)throw Error('Night Shift write requires operation_id');
 const intent=hash(args),prior=record.operations.find(x=>x.id===args.operation_id);
 if(prior&&prior.intent!==intent)throw Error('Operation ID has different Night Shift intent');
 if(prior?.state==='complete')return {ok:true,replayed:true,revision:record.revision,...prior.result};
 if(!prior&&record.revision!==args.expected_revision)throw Error('Night Shift revision changed; read before writing');
 if(!prior&&record.operations.length>=600)throw Error('Night Shift operation capacity reached; preserve history before archival');
 const save=async(currentObject)=>{
  record.revision++;
  writeStarted=true;
  const written=await bucket.put(storageKey(args.project),JSON.stringify(record),{onlyIf:currentObject?{etagMatches:currentObject.etag}:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});
  if(!written)throw Error('Night Shift ledger changed; re-read and retry the exact operation');
 };
 if(args.action==='shift'){
  const item=record.items.find(x=>x.id===args.item_id);if(!item)throw Error('Night Shift item not found');
  if(!args.recipient||!args.summary)throw Error('Shift requires an explicit existing recipient and bounded request');
  const recipient=claims.find(x=>x.id===args.recipient.assignment);owned(recipient,args.recipient.owner,args.recipient.branch);
  let operation=prior;
  if(!operation){
   if(item.shift)throw Error('Item already has a Shift request; inspect its exact receipt');
   if(record.operations.some(x=>x.item_id===item.id&&x.state==='prepared'))throw Error('Item has an uncertain Shift request; reconcile its exact operation');
   const jobArgs={action:'submit',project:args.project,assignment:recipient.id,expected_owner:recipient.owner,expected_branch:recipient.branch,expected_head_sha:args.recipient.head_sha,
    operation_id:'ns-shift-'+hash({project:args.project,operation:args.operation_id}).slice(0,64),prompt:args.summary,
    origin:{kind:'night-shift',item_id:item.id,source_assignment:item.source.assignment,source_job_id:item.source.job_id,repository:item.source.repository,commit_sha:item.source.commit_sha,summary:item.summary}};
   operation={id:args.operation_id,intent,state:'prepared',item_id:item.id,job_args:jobArgs};record.operations.push(operation);await save(stored);
  }
  // A prepared operation survives a crash between stores. Replay only its exact
  // job operation; never replace it with a fresh request after an uncertain write.
  const submitted=await submitJob(operation.job_args);
  if(submitted.ok!==true||!submitted.job?.id)throw Error('Shift job outcome unconfirmed; retain prepared operation and inspect execution status');
  const latest=await readNightShift(bucket,args.project);
  const savedOperation=latest.record.operations.find(x=>x.id===args.operation_id);
  if(savedOperation?.state==='complete')return {ok:true,replayed:true,revision:latest.record.revision,...savedOperation.result};
  if(!savedOperation||savedOperation.intent!==intent)throw Error('Prepared Shift operation unavailable; inspect retained job receipt');
  const latestItem=latest.record.items.find(x=>x.id===item.id);
  const shift={job_id:submitted.job.id,assignment:recipient.id,owner:recipient.owner,branch:recipient.branch,requested_at:new Date(now).toISOString(),initial_state:submitted.job.state,executor_started:false,recipient_acknowledged:false};
  latestItem.shift=shift;savedOperation.state='complete';savedOperation.result={item:latestItem,shift};latest.record.revision++;
  writeStarted=true;
  const written=await bucket.put(storageKey(args.project),JSON.stringify(latest.record),{onlyIf:{etagMatches:latest.stored.etag},httpMetadata:{contentType:'application/json'}});
  if(!written)throw Error('Shift job retained; final ledger write raced. Retry the same operation after reading both receipts');
  return {ok:true,replayed:false,revision:latest.record.revision,item:latestItem,shift};
 }
 let result;
 if(args.action==='oversight'){
  if(!args.oversight)throw Error('Oversight requires an existing assignment identity');
  owned(claims.find(x=>x.id===args.oversight.assignment),args.oversight.owner,args.oversight.branch);
  record.oversight={...args.oversight,bound_by:actor.id,bound_at:new Date(now).toISOString()};result={oversight:oversightView(record,claims,now)};
 }else if(args.action==='record'){
  if(record.items.length>=200)throw Error('Night Shift item capacity reached; preserve history before archival');
  if(!args.summary||!args.away_window||!sourceJob)throw Error('Record requires a summary, declared away window and exact existing execution');
  const start=Date.parse(args.away_window.start),end=Date.parse(args.away_window.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end>now)throw Error('Away window must be a finite completed interval');
  if(!['succeeded','failed','cancelled'].includes(sourceJob.state)||!sourceJob.process||!sourceJob.started_at||!sourceJob.finished_at||!sourceJob.result?.head_sha||!sourceJob.result?.evidence)throw Error('Existing job needs concrete process, exit, source and evidence receipts');
  const processStart=Date.parse(sourceJob.started_at),processEnd=Date.parse(sourceJob.finished_at);
  if(!Number.isFinite(processStart)||!Number.isFinite(processEnd)||processStart<start||processEnd>end||processEnd<processStart)throw Error('Execution receipts must fit the declared away window');
  if(sourceJob.id!==args.job_id||sourceJob.assignment!==args.source_assignment||sourceJob.project!==args.project)throw Error('Execution identity differs from the requested source');
  if(record.items.some(x=>x.source.job_id===sourceJob.id))throw Error('Execution already classified; inspect its existing item');
  if(!await verifyCommit(sourceJob.repository,sourceJob.result.head_sha))throw Error('Execution source artifact could not be verified');
  const item={id:'ns_'+hash({project:args.project,operation:args.operation_id}),summary:args.summary,declared_away_window:args.away_window,away_verified:false,recorded_by:{assignment:actor.id,owner:actor.owner,branch:actor.branch},recorded_at:new Date(now).toISOString(),
   source:{assignment:sourceJob.assignment,job_id:sourceJob.id,owner:sourceJob.owner,branch:sourceJob.branch,repository:sourceJob.repository,commit_sha:sourceJob.result.head_sha,source_exists:true,job_revision:sourceJob.revision,execution_state:sourceJob.state,started_at:sourceJob.started_at,finished_at:sourceJob.finished_at,evidence:sourceJob.result.evidence},
   process_verified:false,objective_completed:false,recipient_acknowledged:false,shift:null};
  record.items.push(item);result={item};
 }else throw Error('Unsupported Night Shift action');
 record.operations.push({id:args.operation_id,intent,state:'complete',result});await save(stored);
 return {ok:true,replayed:false,revision:record.revision,...result};
 }catch(error){error.write_started=writeStarted;error.response_class=error.message.startsWith('Night Shift revision changed')?'revision':writeStarted===true?'retained_or_uncertain':'rejected';throw error;}
}
export async function callNightShift(args,env,apiOverride){
 validateControlArguments(args,nightShiftTool.inputSchema);
 const api=apiOverride||((route,options)=>githubApiRequest(env,route,options));
 const project=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api);
 if(!project.coordination.claims.some(x=>x.id===args.assignment))throw Error('Night Shift requires an existing assignment');
 const sourceJob=args.action==='record'?(await operateJob(env.EVIDENCE,{action:'status',project:args.project,assignment:args.source_assignment,job_id:args.job_id},null)).job:null;
 if(sourceJob&&sourceJob.repository!==project.registration.repository)throw Error('Execution repository differs from the registered project');
 const result=await operateNightShift(env.EVIDENCE,args,{claims:project.coordination.claims,sourceJob,
  verifyCommit:async(repository,commit)=>(await api(`/repos/${repository}/commits/${commit}`))?.sha===commit,
  submitJob:jobArgs=>callJobs(jobArgs,env,api)});
 if(args.action!=='read'){
  const current=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api);
  const actual=current.coordination.claims.find(x=>x.id===args.assignment);
  if(!actual||actual.owner!==args.expected_owner||actual.branch!==args.expected_branch||actual.state!=='active')return {...result,ok:false,reconcile_required:true,error:{message:'Night Shift receipt retained; caller assignment changed during write. Reconcile before acting.'}};
 }
 return {...result,record_sha:project.record_sha};
}
