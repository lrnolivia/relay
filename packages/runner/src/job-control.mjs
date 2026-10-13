import { callRunnerControlCore } from '../../../src/runner-control-core.js';
import { validateControlArguments } from '../../../src/runner-control.js';
import { githubApiRequest } from '../../../src/source.js';
import { operateJob } from './jobs.mjs';
import { guardAutonomy } from '../../../src/autonomy-control.js';
const string=(maxLength,pattern)=>({type:'string',minLength:1,maxLength,...(pattern?{pattern}:{})});
const id=string(100,'^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'),sha=string(40,'^[a-f0-9]{40}$');
const object=(properties,required=[])=>({type:'object',additionalProperties:false,properties,required});
const strings={type:'array',maxItems:32,uniqueItems:true,items:string(120)};
const sourceDigest=string(64,'^[a-f0-9]{64}$');
const sourcePath=string(500);
const sourceBundle=object({schema:{type:'integer',enum:[1]},repository:string(200),branch:string(240),head_sha:sha,
  scope:{type:'array',minItems:1,maxItems:64,uniqueItems:true,items:sourcePath},
  files:{type:'array',maxItems:64,items:object({path:sourcePath,kind:{type:'string',enum:['file','deleted']},mode:{type:'integer',enum:[420,493]},size:{type:'integer',minimum:0,maximum:131072},sha256:sourceDigest,data:{type:'string',maxLength:174764}},['path','kind'])}
},['schema','repository','branch','head_sha','scope','files']);
const sourceRestore=object({digest:sourceDigest,restored_digest:sourceDigest,restored_file_count:{type:'integer',minimum:0,maximum:64}},['digest','restored_digest','restored_file_count']);
const checkpoint=object({session_id:string(100),head_sha:sha,summary:string(2000),changed_paths:strings,evidence:string(1000),source_bundle:sourceBundle,source_restore:sourceRestore},['summary']);
export const jobsTool={name:'relay_execution',title:'Manage durable coding execution',description:'COMMAND / QUERY — request, inspect, cancel, or report an admitted coding job. A queued request is not a running process. Executor start/checkpoint/exit receipts remain attributed reports, never automatic proof of objective completion, deployment or native chat delivery. Expired leases require explicit recovery after the old process has stopped. Optional checkpoint.source_bundle privately saves complete bounded admitted-scope source bytes (192 KiB serialized, 128 KiB decoded, 64 entries, capture at initial head only); metadata alone is local_only. Source protection is an explicitly enabled bounded executor capability. source_read requires the current owner, original executor token and exact revision; read-only recovery also works after completion/expiry. restore_verified is an authenticated executor restoration receipt, not independently verified host execution.',
  inputSchema:object({action:{type:'string',enum:['submit','status','cancel','lease','start','checkpoint','source_read','finish','recover']},project:string(80,'^[a-z0-9-]+$'),assignment:id,job_id:string(68,'^job_[a-f0-9]{64}$'),
    operation_id:id,expected_owner:id,expected_branch:string(240),expected_head_sha:sha,expected_revision:{type:'integer',minimum:0},prompt:string(12000),required_capabilities:strings,capabilities:strings,executor_id:id,lease_token:string(100),previous_process_stopped:{type:'boolean'},checkpoint,
    origin:object({kind:{type:'string',enum:['night-shift']},item_id:string(67,'^ns_[a-f0-9]{64}$'),source_assignment:id,source_job_id:string(68,'^job_[a-f0-9]{64}$'),source_pr:{type:'integer',minimum:1},repository:string(200),commit_sha:sha,summary:string(2000)},['kind','item_id','source_assignment','repository','commit_sha','summary']),
    process:object({pid:{type:'integer',minimum:1},host:string(200),version:string(200),adapter:{type:'string',enum:['codex-cli']}},['pid','host','version','adapter']),
    result:object({state:{type:'string',enum:['succeeded','failed','cancelled']},exit_code:{type:['integer','null']},session_id:string(100),head_sha:sha,summary:string(2000),evidence:string(1000)},['state','exit_code','summary'])
  },['action','project','assignment']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
export async function callJobs(args,env,apiOverride){
  validateControlArguments(args,jobsTool.inputSchema);
  if(['submit','lease','start','recover'].includes(args.action)) await guardAutonomy(env,[args.project]);
  if(args.action==='submit'&&!args.prompt)throw Error('Execution request requires prompt');
  if(args.origin){
    if(args.action!=='submit')throw Error('Execution origin is immutable submit context');
    const stored=await env.EVIDENCE?.get(`night-shift/v1/${args.project}.json`),ledger=stored?await stored.json():null;
    const prepared=ledger?.operations?.find(x=>x.job_args?.operation_id===args.operation_id);
    if(!prepared||Object.keys(prepared.job_args).some(key=>JSON.stringify(prepared.job_args[key])!==JSON.stringify(args[key])))throw Error('Night Shift origin requires its exact prepared ledger request');
  }
  if(!['submit','status'].includes(args.action)&&!args.job_id)throw Error('Execution access requires an exact job_id');
  const api=apiOverride||((path,options)=>githubApiRequest(env,path,options));
  const project=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api);
  const claim=project.coordination.claims.find(c=>c.id===args.assignment);
  if(!claim)throw Error('Execution requires an existing assignment');
  let head=null;
  if(!['status','cancel'].includes(args.action))head=(await api(`/repos/${project.registration.repository}/git/ref/heads/${encodeURIComponent(claim.branch)}`))?.object?.sha;
  const target={...claim,repository:project.registration.repository,head_sha:head};
  let result=await operateJob(env.EVIDENCE,args,target);
  if(args.action==='checkpoint'&&result.job?.state==='running'){
    try {await guardAutonomy(env,[args.project]);}
    catch(error){
      if(error.code!=='safety_control')throw error;
      result=await operateJob(env.EVIDENCE,{action:'cancel',project:args.project,assignment:args.assignment,job_id:args.job_id,
        expected_revision:result.job.revision,expected_owner:claim.owner,expected_branch:claim.branch,
        operation_id:String(args.operation_id).slice(0,80)+':safety-stop'},target);
      result={...result,safety_stop:{requested:true,reason:error.message,process_exit_verified:false}};
    }
  }
  if(!['status','cancel'].includes(args.action)){
    const current=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api);
    const actual=current.coordination.claims.find(c=>c.id===args.assignment);
    const changed=!actual||actual.owner!==claim.owner||actual.branch!==claim.branch||actual.state!==claim.state||JSON.stringify([...(actual.paths||[])].sort())!==JSON.stringify([...(claim.paths||[])].sort())||current.registration.repository!==project.registration.repository;
    if(args.action==='source_read'){
      if(changed||actual.state!=='active'||!Number.isFinite(Date.parse(actual.lease_until))||Date.parse(actual.lease_until)<=Date.now())throw Error('Assignment changed during private source read; no bytes returned');
      const currentHead=(await api(`/repos/${current.registration.repository}/git/ref/heads/${encodeURIComponent(actual.branch)}`))?.object?.sha;
      if(currentHead!==head)throw Error('Source head changed during private source read; no bytes returned');
    }else if(changed)return {...result,ok:false,reconcile_required:true,error:{message:'Execution receipt retained; assignment changed during the write. Stop and reconcile.'}};
  }
  return {...result,record_sha:project.record_sha};
}
