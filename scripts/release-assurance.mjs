import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const ORIGIN='https://relay.loew.fi',MAX=8*1024*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
export function releaseEvent(event,conclusion='success'){
 const r=event?.workflow_run;
 assert.equal(event?.repository?.full_name,'lrnolivia/relay','Canonical repository is required');
 assert.ok(['success','failure'].includes(conclusion)&&r&&r.event==='push'&&r.head_branch==='main'&&r.head_repository?.full_name==='lrnolivia/relay'&&r.status==='completed'&&r.conclusion===conclusion,'Only completed first-party main CI with the exact conclusion is eligible');
 assert.ok(Number.isSafeInteger(r.id)&&r.id>0&&Number.isSafeInteger(r.run_attempt)&&r.run_attempt>0&&/^[a-f0-9]{40}$/.test(r.head_sha||''),'Exact completed source/run is required');
 return {run_id:r.id,source_sha:r.head_sha,attempt:r.run_attempt};
}
async function verifiedRun(github,identity,conclusion){
 const run=await github('repos/lrnolivia/relay/actions/runs/'+identity.run_id);
 assert.equal(run.head_sha,identity.source_sha);assert.equal(run.run_attempt,identity.attempt);assert.equal(run.path,'.github/workflows/ci.yml');assert.equal(run.event,'push');assert.equal(run.head_branch,'main');assert.equal(run.status,'completed');assert.equal(run.conclusion,conclusion);assert.equal(run.repository?.full_name,'lrnolivia/relay');assert.equal(run.head_repository?.full_name,'lrnolivia/relay');
 return run;
}
async function bounded(response,limit){
 const reader=response.body?.getReader();assert.ok(reader,'Response body is required');let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Response exceeds bound');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
 return Buffer.concat(chunks);
}
function gh(path,binary=false){
 assert.ok(/^repos\/lrnolivia\/relay\/actions\//.test(path),'Canonical Actions read is required');
 try{const bytes=execFileSync('gh',['api',path],{stdio:['ignore','pipe','pipe'],timeout:20000,maxBuffer:binary?MAX:1048576});return binary?bytes:JSON.parse(bytes.toString());}
 catch{throw Error('Authenticated GitHub artifact read failed; no retry was made');}
}
function safetyTransport(env,request){
 const id=env.CF_ACCESS_CLIENT_ID,secret=env.CF_ACCESS_CLIENT_SECRET;
 assert.ok(id&&secret,'Existing authenticated CI identity is required');
 const headers={Authorization:JSON.stringify({'cf-access-client-id':id,'cf-access-client-secret':secret}),'CF-Access-Client-Id':id,'CF-Access-Client-Secret':secret};
 let sequence=0;
 async function rpc(method,params){
  const rpcId=++sequence,response=await request(ORIGIN+'/mcp',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{...headers,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:rpcId,method,params})});
  assert.ok(response.ok,'Authenticated safety transport failed');const text=(await bounded(response,1048576)).toString();
  const messages=response.headers.get('content-type')?.includes('text/event-stream')?text.split(/\r?\n\r?\n/).map(block=>block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('\n')).filter(Boolean).map(line=>JSON.parse(line)):[JSON.parse(text)];
  const message=messages.find(item=>item.id===rpcId);assert.ok(message&&!message.error&&message.result&&!message.result.isError,'Safety request failed; reconcile before retrying');return message.result;
 }
 const tool=async(name,input)=>{const result=await rpc('tools/call',{name,arguments:input});assert.ok(result.structuredContent?.ok===true,'Complete authenticated control receipt is required');return result.structuredContent;};
 return {headers,rpc,tool,call:input=>tool('relay_autonomy',input)};
}
export async function runReleaseAssurance({event,env=process.env,request=fetch,github=gh,restore,log=console.log}={}){
 const identity=releaseEvent(event),transport=safetyTransport(env,request);
 const inventory=await transport.rpc('tools/list',{});
 assert.ok(inventory.tools?.find(x=>x.name==='relay_autonomy')?.inputSchema?.properties?.target?.properties?.recovery,'Deployed archive-aware safety contract is required');
 await verifiedRun(github,identity,'success');
 const listing=await github('repos/lrnolivia/relay/actions/runs/'+identity.run_id+'/artifacts?per_page=100');
 assert.ok(listing.total_count<=100&&listing.artifacts.length===listing.total_count,'Complete artifact inventory is required');
 const artifacts=listing.artifacts.filter(x=>x.name==='relay-worker-runtime-'+identity.source_sha+'-'+identity.run_id+'-'+identity.attempt);
 assert.equal(artifacts.length,1,'One exact runtime archive is required');const artifact=artifacts[0];
 assert.ok(Number.isSafeInteger(artifact.id)&&artifact.id>0&&artifact.expired===false&&artifact.size_in_bytes>0&&artifact.size_in_bytes<=MAX&&/^sha256:[a-f0-9]{64}$/.test(artifact.digest||''),'Artifact digest and size are required');
 const bytes=await github('repos/lrnolivia/relay/actions/artifacts/'+artifact.id+'/zip',true);
 assert.equal(bytes.length,artifact.size_in_bytes);assert.equal(hash(bytes),artifact.digest.slice(7));
 const url=ORIGIN+'/api/release-recovery?'+new URLSearchParams({source_sha:identity.source_sha,run_id:String(identity.run_id),artifact_id:String(artifact.id)});
 const response=await request(url,{method:'POST',redirect:'manual',headers:{...transport.headers,'Content-Type':'application/zip'},body:bytes,signal:AbortSignal.timeout(30000)});
 assert.ok(response.ok,'Release retention failed; reconcile source, provider and storage before retrying');
 const receipt=JSON.parse((await bounded(response,65536)).toString());
 assert.ok(receipt.ok&&receipt.remote_readback_verified&&receipt.host_restore_verified===false,'Verified storage receipt is required');
 assert.equal(receipt.target?.source_sha,identity.source_sha);assert.equal(receipt.target?.worker,'relay');assert.equal(receipt.target?.recovery?.archive_sha256,artifact.digest.slice(7));assert.equal(receipt.target?.recovery?.artifact_id,artifact.id);assert.equal(receipt.target?.recovery?.ci_run,identity.run_id);
 assert.match(receipt.target.version_id,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);assert.equal(receipt.target.compatibility_id,'relay-autonomy-v1');assert.match(receipt.target.recovery.manifest_sha256,/^[a-f0-9]{64}$/);
 const downloaded=await request(url,{method:'GET',redirect:'manual',headers:transport.headers,signal:AbortSignal.timeout(20000)});assert.ok(downloaded.ok&&downloaded.headers.get('content-type')==='application/zip','Retained archive readback is required');
 const remote=await bounded(downloaded,MAX);assert.equal(remote.length,bytes.length);assert.equal(hash(remote),artifact.digest.slice(7));
 const restored=await restore(remote,identity.source_sha,artifact.digest.slice(7));
 assert.ok(restored.host_restore_verified===true&&restored.file_count===5&&restored.runtime_reexecuted===false,'Complete isolated archive restoration is required');assert.equal(restored.source_sha,identity.source_sha);assert.equal(restored.archive_sha256,artifact.digest.slice(7));
 const restoreResponse=await request(url,{method:'POST',redirect:'manual',headers:{...transport.headers,'Content-Type':'application/json'},body:JSON.stringify({action:'restore',target:receipt.target,receipt:restored}),signal:AbortSignal.timeout(20000)});
 assert.ok(restoreResponse.ok,'Host restoration receipt could not be retained; healthy target was not advanced');
 const retained=JSON.parse((await bounded(restoreResponse,65536)).toString());
 assert.ok(retained.ok&&retained.host_restore_receipt_retained&&retained.evidence_source==='authenticated-ci-restoration-receipt','Retained restoration receipt is required');
 assert.deepEqual({...retained.target,recovery:receipt.target.recovery},receipt.target,'Restoration must preserve the exact release target');
 assert.deepEqual({...retained.target.recovery,restore_sha256:undefined},{...receipt.target.recovery,restore_sha256:undefined});
 assert.match(retained.target.recovery.restore_sha256,/^[a-f0-9]{64}$/);receipt.target=retained.target;
 const global=await transport.call({action:'status',scope:'global'}),current=await transport.call({action:'status',scope:'relay'});
 if(global.state.held||current.state.held){log(JSON.stringify({ok:true,source_sha:identity.source_sha,archive_retained:true,host_restore_verified:true,healthy_advanced:false,reason:'Autonomous work is held'}));return {held:true,receipt,restored};}
 const operation='relay-release-healthy-'+identity.run_id+'-'+identity.attempt;
 const target={...receipt.target,evidence:'Completed canonical main CI '+identity.run_id+'; exact GitHub runtime archive '+artifact.id+' digest '+artifact.digest+' retained/readback/isolated5-file restoration verified; CI compiled artifact hashes and local-workerd evidence preserved. Manifest '+receipt.target.recovery.manifest_sha256+'. No user approval or production rollback inferred.'};
 const previous=current.state.operations?.find(x=>x.id===operation);
 if(previous){assert.deepEqual(Object.fromEntries(Object.entries(current.state.last_healthy||{}).filter(([key])=>key!=='recorded_at')),target,'Prior healthy operation no longer matches this release; reconcile');log(JSON.stringify({ok:true,source_sha:identity.source_sha,duplicate:true,healthy_advanced:false}));return {duplicate:true,receipt,restored};}
 const approval=current.state.last_user_approved;
 const result=await transport.call({action:'healthy',scope:'relay',expected_revision:current.state.revision,operation_id:operation,reason:'Automatically register the exact fully verified and restore-verified main release as healthy',target});
 const readback=await transport.call({action:'status',scope:'relay'});assert.deepEqual(result.state,readback.state,'Safety changed before readback; reconcile');assert.deepEqual(readback.state.last_user_approved,approval,'User-approved target must remain unchanged');
 log(JSON.stringify({ok:true,source_sha:identity.source_sha,ci_run:identity.run_id,artifact_id:artifact.id,archive_sha256:artifact.digest.slice(7),manifest_sha256:target.recovery.manifest_sha256,restore_sha256:target.recovery.restore_sha256,host_restore_verified:true,safety_revision:readback.state.revision,healthy_advanced:true}));
 return {receipt,restored,state:readback.state};
}
// Failure recovery uses the already verified durable target and existing
// rollback operation. It never executes archived code or resumes a hold.
export async function runFailedReleaseRecovery({event,env=process.env,request=fetch,github=gh,log=console.log}={}){
 const identity=releaseEvent(event,'failure'),transport=safetyTransport(env,request);
 await verifiedRun(github,identity,'failure');
 const jobs=await github('repos/lrnolivia/relay/actions/runs/'+identity.run_id+'/jobs?filter=latest&per_page=100');
 assert.ok(Number.isSafeInteger(jobs.total_count)&&jobs.total_count<=100&&jobs.jobs?.length===jobs.total_count,'Complete failed-run job evidence is required');
 const quality=jobs.jobs.filter(j=>j.name==='quality');assert.equal(quality.length,1);assert.equal(quality[0].status,'completed');assert.equal(quality[0].conclusion,'failure');
 const production=quality[0].steps?.filter(s=>s.name==='Verify exact live source and capture actual website pages');
 if(production?.length!==1||production[0].status!=='completed'||production[0].conclusion!=='failure'){
  log(JSON.stringify({ok:true,source_sha:identity.source_sha,recovered:false,reason:'Production verification did not report a failure; no provider write'}));return {eligible:false};
 }
 const global=await transport.call({action:'status',scope:'global'}),current=await transport.call({action:'status',scope:'relay'});
 const operation='relay-release-recover-'+identity.run_id+'-'+identity.attempt,reason='Canonical main CI '+identity.run_id+' failed production verification for '+identity.source_sha;
 const prior=current.state.rollback?.operation_id===operation?current.state.rollback:null;
 if(global.state.held||(current.state.held&&!prior)){
  log(JSON.stringify({ok:true,source_sha:identity.source_sha,recovered:false,reason:'Existing autonomous hold preserved'}));return {held:true};
 }
 let revision=current.state.revision,expectedVersion;
 if(prior){
  const hold=current.state.operations?.find(x=>x.id===operation+'-hold');assert.ok(hold,'Existing recovery requires its durable original hold receipt');
  const intent=JSON.parse(hold.intent);assert.equal(intent.action,'hold');assert.equal(intent.scope,'relay');assert.equal(intent.operation_id,operation+'-hold');assert.equal(intent.reason,reason);
  revision=intent.expected_revision;expectedVersion=prior.expected_current_version;
 }else{
  const snapshot=await transport.tool('relay_cloud_worker',{script:'relay'});
  const deployments=Array.isArray(snapshot.deployments)?snapshot.deployments:snapshot.deployments?.deployments;
  const active=deployments?.[0];assert.ok(active?.versions?.length===1&&active.versions[0].percentage===100,'Exact active deployment is required');expectedVersion=active.versions[0].version_id;
  assert.match(expectedVersion,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  const page=await request(ORIGIN+'/',{method:'GET',redirect:'manual',headers:transport.headers,signal:AbortSignal.timeout(10000)});
  const source=page.headers.get('X-Relay-Source-Sha'),compatibility=page.headers.get('X-Relay-Release-Compatibility');await page.body?.cancel();
  if(source&&source!==identity.source_sha){
   // If the old healthy build is still live, stop the failed candidate from
   // publishing late. A different newer source is left untouched.
   if(page.ok&&source===current.state.last_healthy?.source_sha&&expectedVersion===current.state.last_healthy.version_id){
    await transport.call({action:'hold',scope:'relay',expected_revision:revision,operation_id:operation+'-pending',reason});
    log(JSON.stringify({ok:true,source_sha:identity.source_sha,recovered:false,held:true,reason:'Failed candidate has not replaced healthy production; late publication stopped'}));return {held:true,pendingPublication:true};
   }
   log(JSON.stringify({ok:true,source_sha:identity.source_sha,recovered:false,reason:'Production source changed; superseded CI event ignored'}));return {superseded:true};
  }
  assert.ok(page.ok&&!page.redirected&&source===identity.source_sha&&compatibility==='relay-autonomy-v1','Production identity is ambiguous; no automatic provider write');
  const target=current.state.last_healthy;
  if(!target||target.compatibility_id!==compatibility||target.source_sha===source||target.version_id===expectedVersion){
   await transport.call({action:'hold',scope:'relay',expected_revision:revision,operation_id:operation+'-unavailable',reason});
   throw Error('Failed production is held; a distinct compatible healthy recovery target is unavailable');
  }
 }
 const approval=current.state.last_user_approved,healthy=current.state.last_healthy;
 const result=await transport.call({action:'rollback',scope:'relay',kind:'healthy',expected_revision:revision,expected_current_version:expectedVersion,operation_id:operation,reason});
 const readback=await transport.call({action:'status',scope:'relay'});
 assert.deepEqual(result.state,readback.state,'Recovery state changed before readback; reconcile');
 assert.ok(readback.state.held&&readback.state.rollback?.state==='verified'&&readback.state.rollback.operation_id===operation,'Verified held recovery receipt is required');
 assert.deepEqual(readback.state.last_user_approved,approval);assert.deepEqual(readback.state.last_healthy,healthy);
 assert.equal(result.verified_release?.source_sha,healthy.source_sha);assert.equal(result.verified_release?.version_id,healthy.version_id);
 log(JSON.stringify({ok:true,failed_source_sha:identity.source_sha,ci_run:identity.run_id,recovered:true,source_sha:healthy.source_sha,version_id:healthy.version_id,safety_revision:readback.state.revision,held:true}));
 return {recovered:true,state:readback.state};
}
async function main(){
 const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
 if(event.workflow_run?.conclusion==='failure'){await runFailedReleaseRecovery({event});return;}
 const directory=await mkdtemp(join(tmpdir(),'relay-release-restore-'));
 try{await runReleaseAssurance({event,restore:async(bytes,source,digest)=>{
  const archive=join(directory,'archive.zip');await writeFile(archive,bytes,{mode:0o600});
  let result;try{result=execFileSync('python3',[resolve('scripts/restore-release-archive.py'),archive,join(directory,'restored'),source,digest],{stdio:['ignore','pipe','pipe'],timeout:20000,maxBuffer:65536});}catch{throw Error('Isolated release restoration failed; healthy target was not advanced');}
  const receipt=JSON.parse(result.toString());await writeFile(join(directory,'restore-receipt.json'),JSON.stringify(receipt)+'\n',{mode:0o600});return receipt;
 }});}finally{await rm(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{let message=String(error.message);for(const key of ['CF_ACCESS_CLIENT_ID','CF_ACCESS_CLIENT_SECRET','GH_TOKEN'])if(process.env[key])message=message.replaceAll(process.env[key],'[redacted]');console.error('Release assurance stopped: '+message.slice(0,1000));process.exitCode=1;});
