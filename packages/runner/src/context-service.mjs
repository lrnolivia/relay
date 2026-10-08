import { createHash } from 'node:crypto';
import { callRunnerControlCore } from '../../../src/runner-control-core.js';
import { validateControlArguments } from '../../../src/runner-control.js';
import { githubApiRequest } from '../../../src/source.js';
const text=(maxLength,pattern)=>({type:'string',minLength:1,maxLength,...(pattern?{pattern}:{})});
const id=text(100,'^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$');
export const contextTool={name:'relay_context',title:'Preserve project context and worker messages',description:'QUERY / COMMAND — read or append artifact-bound project decisions, lessons and assignment messages with CAS and operation IDs. Read pages use entry-offset cursor (not revision), limit at most 20. Writes require operation_id, current expected_revision, expected_owner and expected_branch. Record requires kind, content at most 2000 characters and exact commit_sha. A message additionally requires recipient_assignment naming an active or held assignment in this project; decisions and lessons cannot name a recipient. Ack/retract require entry_id. Messages are durable inbox records; recording or reading never claims a native chat was notified or an executor started. Lessons remain attributed observations until independently verified. Original objectives remain authoritative.',inputSchema:{type:'object',additionalProperties:false,required:['action','project','assignment'],properties:{
 action:{type:'string',enum:['read','record','ack','retract']},project:text(80,'^[a-z0-9-]+$'),assignment:id,expected_owner:id,expected_branch:text(240),expected_revision:{type:'integer',minimum:0},operation_id:id,
 kind:{type:'string',enum:['decision','lesson','message']},content:text(2000),recipient_assignment:id,entry_id:text(68,'^ctx_[a-f0-9]{64}$'),commit_sha:text(40,'^[a-f0-9]{40}$'),cursor:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:20}
}},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function callContext(args,env,apiOverride){
 validateControlArguments(args,contextTool.inputSchema);
 const api=apiOverride||((path,options)=>githubApiRequest(env,path,options));
 const project=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api);
 const claim=project.coordination.claims.find(c=>c.id===args.assignment);if(!claim)throw Error('Project context requires an explicit assignment');
 const bucket=env.EVIDENCE;if(!bucket?.get||!bucket?.put)throw Error('Durable context storage unavailable');
 const key=`context/v1/${args.project}.json`,object=await bucket.get(key),record=object?await object.json():{schema:1,revision:0,entries:[],operations:[]};
 if(record.schema!==1||!Array.isArray(record.entries)||!Array.isArray(record.operations))throw Error('Invalid durable context');
 if(args.action==='read'){
  const visible=record.entries.filter(x=>!x.retracted_at&&(x.kind!=='message'||x.assignment===args.assignment||x.recipient_assignment===args.assignment));
  const start=args.cursor||0,limit=args.limit||20;
  return {ok:true,revision:record.revision,entries:visible.slice(start,start+limit),next_cursor:start+limit<visible.length?start+limit:null,native_delivery_verified:false};
 }
 if(!args.operation_id)throw Error('Context write requires operation_id');
 const prior=record.operations.find(x=>x.id===args.operation_id);if(prior){if(prior.intent!==hash(args))throw Error('Operation ID has different context intent');return {ok:true,replayed:true,revision:record.revision,entry:record.entries.find(x=>x.id===prior.entry_id),native_delivery_verified:false};}
 if(record.revision!==args.expected_revision)throw Error('Context revision changed; refresh before writing');
 if(claim.state!=='active'||claim.owner!==args.expected_owner||claim.branch!==args.expected_branch||Date.parse(claim.lease_until)<=Date.now())throw Error('Context write requires current admitted assignment ownership');
 if((args.action==='record'&&record.entries.length>=200)||record.operations.length>=600)throw Error('Context capacity reached; preserve history before archival');
 let entry;
 if(args.action==='record'){
  if(!args.kind||!args.content||!args.commit_sha)throw Error('Context record requires kind, content and exact source artifact');
  const commit=await api(`/repos/${project.registration.repository}/commits/${args.commit_sha}`);
  if(commit.sha!==args.commit_sha)throw Error('Context source artifact could not be verified');
  let recipient=null;
  if(args.kind==='message'){
   recipient=project.coordination.claims.find(c=>c.id===args.recipient_assignment);
   if(!recipient||!['active','held'].includes(recipient.state))throw Error('Message requires an explicit current recipient assignment');
  }else if(args.recipient_assignment)throw Error('Only a message can name a recipient');
  entry={id:'ctx_'+hash({project:args.project,operation:args.operation_id}),kind:args.kind,project:args.project,assignment:args.assignment,owner:claim.owner,branch:claim.branch,content:args.content,
   repository:project.registration.repository,commit_sha:args.commit_sha,source_exists:true,conclusion_verified:false,created_at:new Date().toISOString(),
   ...(recipient?{recipient_assignment:recipient.id,recipient_owner:recipient.owner,recipient_branch:recipient.branch}:{}),acknowledgements:[]};
  record.entries.push(entry);
 }else{
  entry=record.entries.find(x=>x.id===args.entry_id);if(!entry)throw Error('Context entry not found');
  if(args.action==='retract'){
   if(entry.assignment!==claim.id||entry.owner!==claim.owner)throw Error('Only the originating assignment owner can retract its note');
   entry.retracted_at=new Date().toISOString();
  }else{
   if(entry.kind!=='message'||entry.recipient_assignment!==claim.id||entry.recipient_owner!==claim.owner||entry.recipient_branch!==claim.branch)throw Error('Message recipient changed; preserve the message for reconciliation');
   entry.acknowledgements.push({at:new Date().toISOString(),owner:claim.owner,operation_id:args.operation_id,kind:'explicit-caller-acknowledgement'});
  }
 }
 record.revision++;record.operations.push({id:args.operation_id,intent:hash(args),entry_id:entry.id});
 const written=await bucket.put(key,JSON.stringify(record),{onlyIf:object?{etagMatches:object.etag}:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});
 if(!written)throw Error('Context storage changed; re-read before retrying');
 const current=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api);
 const actual=current.coordination.claims.find(c=>c.id===args.assignment);
 const stable=actual&&actual.owner===claim.owner&&actual.branch===claim.branch&&actual.state===claim.state;
 return {ok:Boolean(stable),replayed:false,revision:record.revision,entry,native_delivery_verified:false,executor_started:false,...(!stable?{reconcile_required:true,error:{message:'Context receipt retained; assignment changed during the write. Reconcile before acting on it.'}}:{})};
}
