import {verifyAccessJwt} from './access-verification.js';
import {callAutonomyControl,projectCloudStatus,verifyProviderBuildVersion,RELAY_GUARDED_DEPLOY_COMMAND} from './project-cloud.js';
import {cloudWorkerSummary,activeCloudVersion} from './cloud.js';

export const RECOVERY_CONTROLLER_BUILD='20261008.1';
const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','X-Relay-Recovery-Build':RECOVERY_CONTROLLER_BUILD};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function boundedInput(request){
 const reader=request.body?.getReader();if(!reader)throw Error('Missing request');let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw Error('Request too large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

// This entrypoint is deployed and versioned separately from Relay. It has no
// source publication, arbitrary provider API, healthy promotion or approval
// operations. Existing safety atoms are reached directly through their binding.
export async function recoveryControllerResponse(request,env,{verify=verifyAccessJwt,control=callAutonomyControl,snapshot=cloudWorkerSummary,active=activeCloudVersion,registration=projectCloudStatus,providerSource=verifyProviderBuildVersion}={}){
 if(new URL(request.url).pathname!=='/recovery-control')return json({ok:false,error:'Not found'},404);
 if(request.method!=='POST'||!request.headers.get('content-type')?.startsWith('application/json'))return json({ok:false,error:'Use an authenticated JSON POST'},405);
 const access=await verify(request);if(!access)return json({ok:false,error:'Verified Relay Access identity required'},401);
 let input;try{input=await boundedInput(request);}catch{return json({ok:false,error:'Bounded JSON safety input required'},400);}
 if(!input||!['status','hold','resume','rollback','cloud_status','inspect_release'].includes(input.action)||!['global','relay'].includes(input.scope)||(['rollback','cloud_status','inspect_release'].includes(input.action)&&input.scope!=='relay'))return json({ok:false,error:'Only existing Relay safety and recorded rollback operations are available'},400);
 if(env.RELAY_AUTONOMY_GUARD!=='enforced'||!env.RELAY_EVENTS||env.RELAY_CANONICAL_REPOSITORY!=='lrnolivia/relay'||env.RELAY_CLOUDFLARE_WRITE_SCRIPTS!=='relay')return json({ok:false,error:'Recovery binding and guard configuration unavailable'},503);
 if(['rollback','cloud_status','inspect_release'].includes(input.action)&&(!env.CLOUDFLARE_API_TOKEN||env.CLOUDFLARE_ACCOUNT_ID!=='8df30cd302a4d4a4c01db9863c712166'||!env.EVIDENCE))return json({ok:false,error:'Recovery provider identity or retention binding unavailable'},503);
 if(input.action==='cloud_status'&&Object.keys(input).sort().join(',')!=='action,scope')return json({ok:false,error:'Exact provider status input required'},400);
 if(input.action==='inspect_release'&&(Object.keys(input).sort().join(',')!=='action,scope,source_sha,version_id'||!/^[a-f0-9]{40}$/.test(input.source_sha||'')||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.version_id||'')))return json({ok:false,error:'Exact source/version inspection input required'},400);
 try{
  if(input.action==='cloud_status'){
   const value=await snapshot(env,'relay');
   return json({ok:true,script:'relay',deployments:value.deployments,versions:{items:(value.versions?.items||value.versions||[]).map(v=>({id:v.id}))},domains:value.domains.map(d=>({hostname:d.hostname,service:d.service,enabled:d.enabled}))});
  }
  if(input.action==='inspect_release'){
   if(!env.CLOUDFLARE_BUILDS_API_TOKEN)throw Error('Provider source read identity unavailable');
   const profile=await registration(env,'relay');
   if(profile.repository!=='lrnolivia/relay'||profile.worker!=='relay'||profile.transport!=='workers-builds'||profile.production_branch!=='main'||!profile.writable||profile.rollback?.compatibility_id!=='relay-autonomy-v1')throw Error('Canonical recovery profile changed');
   const before=await active(env,'relay');if(before.version_id!==input.version_id)throw Error('Active candidate changed');
   const build=await providerSource(env,{worker:'relay',source_sha:input.source_sha,version_id:input.version_id},{branch:'main',deploy_command:RELAY_GUARDED_DEPLOY_COMMAND});
   const after=await active(env,'relay');if(JSON.stringify(after)!==JSON.stringify(before))throw Error('Active candidate changed during provider proof');
   return json({ok:true,source_sha:input.source_sha,version_id:input.version_id,deployment_id:after.deployment_id,build_id:build,verification:'canonical-provider-build+active-deployment'});
  }
  return json(await control(env,input,{accessJwt:access.token}));
 }
 catch(error){return json({ok:false,error:'Safety operation did not complete; refresh the exact durable operation before retrying',code:error.code==='safety_control'?'safety_control':'recovery_unavailable'},Number.isInteger(error.status)&&error.status>=400&&error.status<500?error.status:503);}
}
export default {fetch:recoveryControllerResponse};
