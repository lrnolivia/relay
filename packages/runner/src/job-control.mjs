import { callRunnerControlCore } from '../../../src/runner-control-core.js';
import { validateControlArguments } from '../../../src/runner-control.js';
import { githubApiRequest } from '../../../src/source.js';
import { operateJob } from './jobs.mjs';
const string=(maxLength,pattern)=>({type:'string',minLength:1,maxLength,...(pattern?{pattern}:{})});
const id=string(100,'^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$'),sha=string(40,'^[a-f0-9]{40}$');
const object=(properties,required=[])=>({type:'object',additionalProperties:false,properties,required});
const strings={type:'array',maxItems:32,uniqueItems:true,items:string(120)};
const checkpoint=object({session_id:string(100),head_sha:sha,summary:string(2000),changed_paths:strings,evidence:string(1000)},['summary']);
export const jobsTool={name:'relay_execution',title:'Manage durable coding execution',description:'COMMAND / QUERY — request, inspect, cancel, or report an admitted coding job. A queued request is not a running process. Executor start/checkpoint/exit receipts remain attributed reports, never automatic proof of objective completion, deployment or native chat delivery. Expired leases require explicit recovery after the old process has stopped.',
  inputSchema:object({action:{type:'string',enum:['submit','status','cancel','lease','start','checkpoint','finish','recover']},project:string(80,'^[a-z0-9-]+$'),assignment:id,job_id:string(68,'^job_[a-f0-9]{64}$'),
    operation_id:id,expected_owner:id,expected_branch:string(240),expected_head_sha:sha,expected_revision:{type:'integer',minimum:0},prompt:string(12000),required_capabilities:strings,capabilities:strings,executor_id:id,lease_token:string(100),previous_process_stopped:{type:'boolean'},checkpoint,
    origin:object({kind:{type:'string',enum:['night-shift']},item_id:string(67,'^ns_[a-f0-9]{64}$'),source_assignment:id,source_job_id:string(68,'^job_[a-f0-9]{64}$'),repository:string(200),commit_sha:sha,summary:string(2000)},['kind','item_id','source_assignment','source_job_id','repository','commit_sha','summary']),
    process:object({pid:{type:'integer',minimum:1},host:string(200),version:string(200),adapter:{type:'string',enum:['codex-cli']}},['pid','host','version','adapter']),
    result:object({state:{type:'string',enum:['succeeded','failed','cancelled']},exit_code:{type:['integer','null']},session_id:string(100),head_sha:sha,summary:string(2000),evidence:string(1000)},['state','exit_code','summary'])
  },['action','project','assignment']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
export async function callJobs(args,env,apiOverride){
  validateControlArguments(args,jobsTool.inputSchema);
  if(args.action==='submit'&&!args.prompt)throw Error('Execution request requires prompt');
  if(args.origin){
    if(args.action!=='submit')throw Error('Execution origin is immutable submit context');
    const stored=await env.EVIDENCE?.get(`night-shift/v1/${args.project}.json`),ledger=stored?await stored.json():null;
    const prepared=ledger?.operations?.find(x=>x.job_args?.operation_id===args.operation_id);
    if(!prepared||Object.keys(prepared.job_args).some(key=>JSON.stringify(prepared.job_args[key])!==JSON.stringify(args[key])))throw Error('Night Shift origin requires its exact prepared ledger request');
  }
  if(!['submit','status'].includes(args.action)&&!args.job_id)throw Error('Execution mutation requires an exact job_id');
  const api=apiOverride||((path,options)=>githubApiRequest(env,path,options));
  const project=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api);
  const claim=project.coordination.claims.find(c=>c.id===args.assignment);
  if(!claim)throw Error('Execution requires an existing assignment');
  let head=null;
  if(!['status','cancel'].includes(args.action))head=(await api(`/repos/${project.registration.repository}/git/ref/heads/${encodeURIComponent(claim.branch)}`))?.object?.sha;
  const target={...claim,repository:project.registration.repository,head_sha:head};
  const result=await operateJob(env.EVIDENCE,args,target);
  if(!['status','cancel'].includes(args.action)){
    const current=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api);
    const actual=current.coordination.claims.find(c=>c.id===args.assignment);
    if(!actual||actual.owner!==claim.owner||actual.branch!==claim.branch||actual.state!==claim.state)return {...result,ok:false,reconcile_required:true,error:{message:'Execution receipt retained; assignment changed during the write. Stop and reconcile.'}};
  }
  return {...result,record_sha:project.record_sha};
}
