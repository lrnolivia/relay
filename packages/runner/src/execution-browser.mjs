import { operateJob } from './jobs.mjs';
import { callJobs } from './job-control.mjs';
import { callRunnerControlCore } from '../../../src/runner-control-core.js';
import { githubApiRequest } from '../../../src/source.js';
import { readNightShift, oversightView } from './night-shift.mjs';
// Access/OAuth authentication is established by the gateway, never by a body field.
export async function executionBrowser(request,env,{authenticated=false,api,run}={}) {
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/execution/'))return null;
 if(!authenticated)return Response.json({error:'Authenticated execution controls required'},{status:403});
 try {
  if(request.method==='GET'&&url.pathname==='/api/execution/jobs') {
   const project=url.searchParams.get('project');if(!/^[a-z0-9-]{1,80}$/.test(project||''))throw Error('Choose one registered project');
   const source=api||((path,options)=>githubApiRequest(env,path,options));
   const state=await callRunnerControlCore('relay_runner_project',{project},env,source);
   const claims=state.coordination.claims;
   const cursor=Number(url.searchParams.get('cursor')||0);if(!Number.isSafeInteger(cursor)||cursor<0)throw Error('Invalid execution cursor');
   const rows=[];
   // A bounded page includes terminal assignments: historical execution stays visible.
   for(const claim of claims.slice(cursor,cursor+20)) {
    const statusArgs={action:'status',project,assignment:claim.id};
    const job=(await (run?run(statusArgs,env,source):operateJob(env.EVIDENCE,statusArgs,null))).job;
    if(job||['active','held'].includes(claim.state))rows.push({assignment:claim.id,owner:claim.owner,branch:claim.branch,goal:claim.goal,state:claim.state,lease_until:claim.lease_until,job});
   }
   const {record}=await readNightShift(env.EVIDENCE,project),oversight=oversightView(record,claims);
   return Response.json({ok:true,rows,record_sha:state.record_sha,next_cursor:cursor+20<claims.length?cursor+20:null,checked_at:new Date().toISOString(),executor_online_verified:false,oversight_assignment:oversight.available?oversight.binding.assignment:null,oversight},{headers:{'Cache-Control':'no-store'}});
  }
  if(request.method!=='POST'||url.pathname!=='/api/execution/request')return Response.json({error:'Execution route not found'},{status:404});
  if(request.headers.get('Origin')!==url.origin)return Response.json({error:'Same-origin execution request required'},{status:403});
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return Response.json({error:'JSON required'},{status:415});
  const reader=request.body?.getReader();let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>16384){await reader.cancel();return Response.json({error:'Execution request exceeds 16 KiB'},{status:413});}text+=decoder.decode(part.value,{stream:true});}
  text+=decoder.decode();const args=JSON.parse(text);
  if(!['submit','cancel'].includes(args.action))throw Error('Browser controls may request or cancel, never report executor activity');
  const result=await (run||callJobs)(args,env,api);
  return Response.json(result,{status:result.ok===false?409:200,headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error.message},{status:409,headers:{'Cache-Control':'no-store'}});}
}
