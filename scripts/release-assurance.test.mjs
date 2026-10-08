import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {releaseEvent,runReleaseAssurance,runFailedReleaseRecovery} from './release-assurance.mjs';
import {callAutonomyControl} from '../src/project-cloud.js';
import {releaseRecoveryResponse} from '../src/release-recovery.js';
import {autonomyState,transitionAutonomy,autonomyRequest} from '../src/autonomy-control.js';
import {recoveryVersionFixture} from '../test/fixtures/recovery-archive.mjs';

const source='a'.repeat(40),version='11111111-2222-3333-4444-555555555555',hash=x=>createHash('sha256').update(x).digest('hex');
function fixture(){
 const bytes=Buffer.from('synthetic opaque archive'),objects=new Map(),logs=[],calls=[];
 const run={id:7,head_sha:source,run_attempt:1,path:'.github/workflows/ci.yml',event:'push',head_branch:'main',head_repository:{full_name:'lrnolivia/relay',id:99},repository:{full_name:'lrnolivia/relay',id:99},status:'completed',conclusion:'success'};
 const artifact={id:8,name:'relay-worker-runtime-'+source+'-7-1',expired:false,size_in_bytes:bytes.length,digest:'sha256:'+hash(bytes),workflow_run:{id:7,head_sha:source,head_branch:'main',repository_id:99,head_repository_id:99}};
 const event={repository:{full_name:'lrnolivia/relay'},workflow_run:run};
 let state={...autonomyState('relay'),last_user_approved:{source_sha:'b'.repeat(40),approval:{text:'Synthetic approved release'}}};
 const bucket={async get(key){if(!objects.has(key))return null;const bytes=objects.get(key);return {size:bytes.length,arrayBuffer:async()=>bytes};},async put(key,bytes){objects.set(key,Buffer.from(bytes));}};
 const api=async path=>path.endsWith('/runs/7')?run:path.endsWith('/artifacts/8')?artifact:path.includes('/jobs?')?{total_count:1,jobs:[{name:'quality',status:'completed',conclusion:'success',steps:['Run workspace, contract, API, browser and React tests','Verify bundled Worker in local workerd','Verify exact live source and capture actual website pages','Retain and verify exact interactive sample build'].map(name=>({name,status:'completed',conclusion:'success'}))}]}:{type:'file',encoding:'base64',size:2,content:'e30='};
 const env={CF_ACCESS_CLIENT_ID:'synthetic-service-id',CF_ACCESS_CLIENT_SECRET:'synthetic-service-secret'};
 const f={bytes,objects,logs,calls,run,artifact,event,env,get state(){return state;},hold:false,raceHold:false,corruptReadback:false};
 f.github=async(path,binary)=>binary?bytes:path.includes('/artifacts?')?{total_count:1,artifacts:[artifact]}:run;
 f.restore=async(_bytes,sha,digest)=>({schema:1,source_sha:sha,archive_sha256:digest,file_count:5,host_restore_verified:true,compiled_ci_runtime_evidence_verified:true,runtime_reexecuted:false,production_rollback_performed:false,files:['bundle/README.md','bundle/index.js','bundle/index.js.map','probe.json','result.json'].map(path=>({path,bytes:2,sha256:'c'.repeat(64)}))});
 f.request=async(url,options)=>{
  assert.ok(url.startsWith('https://relay.loew.fi/'));assert.equal(options.redirect,'manual');assert.equal(options.headers['CF-Access-Client-Secret'],env.CF_ACCESS_CLIENT_SECRET);
  if(url.includes('/mcp')){
   const message=JSON.parse(options.body);let result;
   if(message.method==='tools/list')result={tools:[{name:'relay_autonomy',inputSchema:{properties:{target:{properties:{recovery:{}}}}}}]};
   else{const input=message.params.arguments;calls.push(input);
    if(input.action==='status')result={structuredContent:{ok:true,state:input.scope==='global'?{...autonomyState('global'),held:f.hold}:state}};
    else{if(f.raceHold)state=transitionAutonomy(state,{action:'hold',scope:'relay',expected_revision:state.revision,operation_id:'concurrent-stop-fixture',reason:'Synthetic concurrent user stop'}).state;
     try{state=transitionAutonomy(state,input).state;result={structuredContent:{ok:true,state}};}catch{result={isError:true};}
    }
   }
   return Response.json({jsonrpc:'2.0',id:message.id,result});
  }
  if(f.corruptReadback&&options.method==='GET')return new Response('changed',{headers:{'Content-Type':'application/zip'}});
  return releaseRecoveryResponse(new Request(url,options),{EVIDENCE:bucket},{api,resolveTarget:async()=>({worker:'relay',version_id:version,source_sha:source,compatibility_id:'relay-autonomy-v1',evidence:'Synthetic fixture'}),resolveConfiguration:async()=>recoveryVersionFixture(version)});
 };
 f.execute=()=>runReleaseAssurance({...f,log:value=>logs.push(value)});return f;
}

test('completed release uses the same artifact through retained restoration and exact CAS healthy registration',async()=>{
 const f=fixture(),approval=structuredClone(f.state.last_user_approved),result=await f.execute();
 assert.equal(result.state.last_healthy.source_sha,source);assert.equal(result.state.revision,1);assert.deepEqual(result.state.last_user_approved,approval);
 assert.equal(f.objects.size,3);assert.ok(result.state.last_healthy.recovery.restore_sha256);assert.equal(f.calls.filter(c=>c.action==='healthy').length,1);
 await f.execute();assert.equal(f.calls.filter(c=>c.action==='healthy').length,1,'Successful healthy operation must not replay');assert.equal(f.state.revision,1);
 assert.doesNotMatch(f.logs.join('\n'),/synthetic-service-id|synthetic-service-secret/);
});
test('global stop preserves archives without promotion; a concurrent project stop wins CAS',async()=>{
 const held=fixture();held.hold=true;const result=await held.execute();assert.equal(result.held,true);assert.equal(held.objects.size,3);assert.equal(held.calls.filter(c=>c.action==='healthy').length,0);
 const race=fixture();race.raceHold=true;await assert.rejects(race.execute(),/reconcile before retrying/);assert.equal(race.state.held,true);assert.equal(race.state.last_healthy,null);assert.equal(race.state.operations.length,1);
});
test('artifact, storage or restoration mismatch cannot advance healthy',async()=>{
 const corrupt=fixture();corrupt.corruptReadback=true;await assert.rejects(corrupt.execute());assert.equal(corrupt.calls.filter(c=>c.action==='healthy').length,0);
 const restore=fixture();restore.restore=async()=>({host_restore_verified:false});await assert.rejects(restore.execute(),/restoration/);assert.equal(restore.objects.size,2);assert.equal(restore.calls.filter(c=>c.action==='healthy').length,0);
 const digest=fixture();digest.artifact.digest='sha256:'+'d'.repeat(64);await assert.rejects(digest.execute());assert.equal(digest.objects.size,0);
 const failed=fixture();failed.run.conclusion='failure';await assert.rejects(failed.execute());assert.equal(failed.objects.size,0);
});
test('fork, PR, other branch and unsuccessful events are rejected before authenticated requests',()=>{
 for(const mutate of [x=>x.repository.full_name='fork/relay',x=>x.workflow_run.head_repository.full_name='fork/relay',x=>x.workflow_run.event='pull_request',x=>x.workflow_run.head_branch='feature',x=>x.workflow_run.conclusion='cancelled']){const e=structuredClone(fixture().event);mutate(e);assert.throws(()=>releaseEvent(e));}
});
test('isolated Python restore checks actual ZIP entries and compiled CI hashes without executing the bundle',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'relay-restore-contract-'));
 try{
  const bundle={'README.md':Buffer.from('fixture'),'index.js':Buffer.from('throw Error("must never execute archived code")'),'index.js.map':Buffer.from('{}')};
  const checks=[{criterion:'worker-health',status:200},{criterion:'website-source',status:200,source_sha:source},...['/mcp','/api/panel'].map(path=>({criterion:'unauthenticated-rejection',path,status:401})),...['global','relay'].map(scope=>({criterion:'durable-safety-status',scope,held:false}))];
  const result={schema:1,kind:'relay-worker-runtime',state:'passed',stage:'complete',runtime:'local-workerd',identity:{source_sha:source},bundle:{status:'passed',exit_code:0},artifacts:Object.entries(bundle).map(([path,bytes])=>({path,bytes:bytes.length,sha256:hash(bytes)})),checks};
  const files={...Object.fromEntries(Object.entries(bundle).map(([p,b])=>['bundle/'+p,b.toString()])), 'result.json':JSON.stringify(result),'probe.json':JSON.stringify({checks})};
  const input=join(directory,'files.json'),archive=join(directory,'fixture.zip');await writeFile(input,JSON.stringify(files));
  const zip="import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as z:\n for name,data in json.load(open(sys.argv[1])).items(): z.writestr(name,data)\n";
  execFileSync('python3',['-c',zip,input,archive]);const digest=hash(await readFile(archive));
  const restored=JSON.parse(execFileSync('python3',['scripts/restore-release-archive.py',archive,join(directory,'restore'),source,digest],{encoding:'utf8'}));assert.equal(restored.host_restore_verified,true);assert.equal(restored.runtime_reexecuted,false);assert.equal(restored.file_count,5);
  files['../escape']='hostile';await writeFile(input,JSON.stringify(files));execFileSync('python3',['-c',zip,input,archive]);
  assert.throws(()=>execFileSync('python3',['scripts/restore-release-archive.py',archive,join(directory,'invalid'),source,hash(Buffer.from('wrong'))],{stdio:'pipe'}));
  const hostileDigest=hash(await readFile(archive));assert.throws(()=>execFileSync('python3',['scripts/restore-release-archive.py',archive,join(directory,'hostile'),source,hostileDigest],{stdio:'pipe'}));await assert.rejects(access(join(directory,'escape')));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('follow-up has read-only permissions, protected main code, event guards and no duplicate build pipeline',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/release-assurance.yml',import.meta.url),'utf8');
 assert.match(workflow,/workflow_run:/);assert.match(workflow,/types: \[completed\]/);assert.match(workflow,/contents: read\n  actions: read/);assert.match(workflow,/ref: main\n          persist-credentials: false/);
 for(const field of ['event','head_branch','head_repository.full_name','conclusion'])assert.ok(workflow.includes('github.event.workflow_run.'+field));
 assert.doesNotMatch(workflow,/npm (ci|test|run build)|download-artifact|exec.*bundle|contents: write|actions: write/);
});

// Integrate the controller with the actual durable transition and rollback
// orchestration. Provider responses are synthetic; no production is changed.
function failedFixture(){
 const failed='d'.repeat(40),failedVersion='66666666-7777-8888-9999-aaaaaaaaaaaa';
 const healthy={worker:'relay',version_id:version,source_sha:source,compatibility_id:'relay-autonomy-v1',evidence:'Synthetic prior verified release',recovery:{archive_sha256:'a'.repeat(64),manifest_sha256:'b'.repeat(64),restore_sha256:'c'.repeat(64),artifact_id:1,ci_run:2}};
 const approval={...healthy,source_sha:'b'.repeat(40),approval:{text:'Synthetic explicit approval',source:'Synthetic user message'}};
 let state={...autonomyState('relay'),last_healthy:healthy,last_user_approved:approval},active={source_sha:failed,version_id:failedVersion,compatibility_id:healthy.compatibility_id};
 const run={id:9,head_sha:failed,run_attempt:1,path:'.github/workflows/ci.yml',event:'push',head_branch:'main',head_repository:{full_name:'lrnolivia/relay'},repository:{full_name:'lrnolivia/relay'},status:'completed',conclusion:'failure'};
 const production={name:'Verify exact live source and capture actual website pages',status:'completed',conclusion:'failure'};
 const jobs={total_count:1,jobs:[{name:'quality',status:'completed',conclusion:'failure',steps:[production]}]},calls=[],logs=[];
 const env={RELAY_AUTONOMY_GUARD:'enforced',RELAY_CLOUDFLARE_WRITE_SCRIPTS:'relay',CF_ACCESS_CLIENT_ID:'synthetic-service-id',CF_ACCESS_CLIENT_SECRET:'synthetic-service-secret',RELAY_EVENTS:{idFromName:x=>x,get:name=>({fetch:async(_url,options)=>{
  try{const input=JSON.parse(options.body);if(name==='autonomy:global')return Response.json({ok:true,state:{...autonomyState('global'),held:f.globalHold}});state=transitionAutonomy(state,input).state;return Response.json({ok:true,state});}
  catch(error){return Response.json({error:error.message},{status:error.status||409});}
 }})}};
 const snapshot=async()=>({ok:true,script:'relay',deployments:{deployments:[{id:'synthetic-deployment',versions:[{version_id:active.version_id,percentage:100}]}]},versions:{items:[{id:version},{id:active.version_id}]},domains:[{service:'relay',hostname:'relay.loew.fi',enabled:true}]});
 const profile={identity_url:'https://relay.loew.fi/',health_url:'https://relay.loew.fi/health',source_header:'X-Relay-Source-Sha',compatibility_header:'X-Relay-Release-Compatibility',compatibility_id:healthy.compatibility_id};
 const f={run,jobs,production,calls,logs,env,event:{repository:{full_name:'lrnolivia/relay'},workflow_run:run},get state(){return state;},get active(){return active;},globalHold:false,raceHold:false,loseResponse:false,loseBeforeCommit:false,compiled:false,identityLag:0,waits:[],writes:0};
 f.github=async path=>path.endsWith('/runs/9')?run:jobs;
 const deps={github:async()=>({type:'file',encoding:'base64',content:Buffer.from(JSON.stringify({id:'relay',managed:true,repository:'lrnolivia/relay',cloud:{provider:'cloudflare',worker:'relay',write:true,rollback:profile}})).toString('base64')}),snapshot,active:async()=>({version_id:active.version_id,deployment_id:'synthetic-deployment'}),fetch:async url=>{if(url.endsWith('/health'))return Response.json({ok:true,service:'relay'});const source=active.source_sha===healthy.source_sha&&f.identityLag-->0?failed:active.source_sha;return new Response('fixture',{headers:{'X-Relay-Source-Sha':source,'X-Relay-Release-Compatibility':active.compatibility_id}});},recover:async()=>{
  if(f.loseBeforeCommit)throw Error('Synthetic unconfirmed provider write');
  if(f.compiled){
   if(!state.rollback.restoration){
    const hashes={module_sha256:'e'.repeat(64),configuration_sha256:'f'.repeat(64)};
    await autonomyRequest(env,{action:'prepare_restore_upload',scope:'relay',expected_revision:state.revision,operation_id:state.rollback.operation_id+'-upload',reason:state.reason,result:hashes});
    await autonomyRequest(env,{action:'finish_restore_upload',scope:'relay',expected_revision:state.revision,operation_id:state.rollback.operation_id+'-record',reason:state.reason,result:{...hashes,version_id:'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'}});
   }
   if(active.version_id!==state.rollback.target.version_id){f.writes++;active={...state.rollback.target};if(f.loseResponse){f.loseResponse=false;throw Error('Synthetic provider response lost');}}
   return {ok:true,effective_target:state.rollback.target};
  }
  if(active.version_id!==healthy.version_id){assert.equal(active.version_id,failedVersion);f.writes++;active={...healthy};if(f.loseResponse){f.loseResponse=false;throw Error('Synthetic provider response lost');}}return {ok:true};
 }};
 f.request=async(url,options)=>{
  if(url==='https://relay.loew.fi/')return deps.fetch(url);
  const message=JSON.parse(options.body),args=message.params.arguments;calls.push({name:message.params.name,...args});
  let result;
  try{
   if(message.params.name==='relay_cloud_worker')result=await snapshot();
   else{if(args.action==='rollback'&&f.raceHold)state=transitionAutonomy(state,{action:'hold',scope:'relay',expected_revision:state.revision,operation_id:'synthetic-concurrent-hold',reason:'Concurrent user stop'}).state;result=await callAutonomyControl(env,args,deps);}
   return Response.json({jsonrpc:'2.0',id:message.id,result:{structuredContent:result}});
  }catch{return Response.json({jsonrpc:'2.0',id:message.id,result:{isError:true}});}
 };
 f.execute=()=>runFailedReleaseRecovery({...f,log:value=>logs.push(value),wait:async ms=>{f.waits.push(ms);await f.onWait?.();}});
 f.stopDuringWait=()=>{state=transitionAutonomy(state,{action:'hold',scope:'relay',expected_revision:state.revision,operation_id:'synthetic-wait-stop',reason:'Concurrent user stop'}).state;};f.changeSource=sha=>{active.source_sha=sha;};f.keepHealthyLive=()=>{active={...healthy};};f.removeHealthy=()=>{state.last_healthy=null;};return f;
}

test('failed production restores the durable healthy target once and preserves the user approval and hold',async()=>{
 const f=failedFixture(),approval=structuredClone(f.state.last_user_approved),healthy=structuredClone(f.state.last_healthy);
 const result=await f.execute();assert.equal(result.recovered,true);assert.equal(f.writes,1);assert.equal(f.active.source_sha,healthy.source_sha);assert.equal(f.state.held,true);assert.equal(f.state.rollback.state,'verified');assert.deepEqual(f.state.last_user_approved,approval);assert.deepEqual(f.state.last_healthy,healthy);
 await f.execute();assert.equal(f.writes,1,'Successful recovery must reconcile without another provider write');assert.equal(f.calls.filter(x=>x.action==='resume').length,0);assert.doesNotMatch(f.logs.join('\n'),/synthetic-service-id|synthetic-service-secret/);
});
test('failed-event recovery rejects stale run identities and never rolls back a newer observed release',async()=>{
 const f=failedFixture();f.changeSource('e'.repeat(40));assert.equal((await f.execute()).superseded,true);assert.equal(f.writes,0);assert.equal(f.state.revision,0);
 const invalid=failedFixture();invalid.run.path='.github/workflows/untrusted.yml';await assert.rejects(invalid.execute());assert.equal(invalid.calls.length,0);
 const unrelated=failedFixture();unrelated.production.conclusion='skipped';assert.equal((await unrelated.execute()).eligible,false);assert.equal(unrelated.calls.length,0);
 const delayed=failedFixture();delayed.keepHealthyLive();assert.equal((await delayed.execute()).pendingPublication,true);assert.equal(delayed.state.held,true);assert.equal(delayed.writes,0);
});
test('global/project stops and concurrent CAS loss prevent new recovery; missing target holds only',async()=>{
 const global=failedFixture();global.globalHold=true;assert.equal((await global.execute()).held,true);assert.equal(global.writes,0);
 const race=failedFixture();race.raceHold=true;await assert.rejects(race.execute(),/reconcile before retrying/);assert.equal(race.writes,0);assert.equal(race.state.held,true);
 const missing=failedFixture();missing.removeHealthy();await assert.rejects(missing.execute(),/distinct compatible/);assert.equal(missing.state.held,true);assert.equal(missing.writes,0);
 assert.equal((await missing.execute()).held,true);
});
test('uncertain provider response reconciles automatically with one provider write and no resume',async()=>{
 const f=failedFixture();f.loseResponse=true;assert.equal((await f.execute()).recovered,true);assert.equal(f.state.held,true);assert.equal(f.state.rollback.state,'verified');assert.equal(f.writes,1);assert.deepEqual(f.waits,[2000]);assert.equal(f.calls.filter(x=>x.action==='rollback').length,2);assert.equal(f.calls.filter(x=>x.action==='resume').length,0);
});
test('post-deployment identity lag reconciles through a fresh invocation; persistent mismatch stays held after one retry',async()=>{
 const f=failedFixture();f.identityLag=1;assert.equal((await f.execute()).recovered,true);assert.equal(f.writes,1);assert.deepEqual(f.waits,[2000]);assert.equal(f.state.rollback.state,'verified');
 const stuck=failedFixture();stuck.identityLag=10;await assert.rejects(stuck.execute(),/reconcile before retrying/);assert.equal(stuck.state.held,true);assert.equal(stuck.state.rollback.state,'pending');assert.equal(stuck.writes,1);assert.deepEqual(stuck.waits,[2000]);assert.equal(stuck.calls.filter(x=>x.action==='rollback').length,2);
});
test('a concurrent project or global stop during reconciliation prevents another invocation',async()=>{
 for(const scope of ['global','relay']){
  const f=failedFixture();f.identityLag=1;f.onWait=()=>{if(scope==='global')f.globalHold=true;else f.stopDuringWait();};
  await assert.rejects(f.execute());assert.equal(f.calls.filter(x=>x.action==='rollback').length,1);assert.equal(f.state.held,true);assert.equal(f.writes,1);
 }
});
test('an uncertain write without the exact target active is never replayed automatically',async()=>{
 const f=failedFixture();f.loseBeforeCommit=true;await assert.rejects(f.execute());assert.equal(f.state.held,true);assert.equal(f.state.rollback.state,'pending');assert.equal(f.writes,0);assert.equal(f.calls.filter(x=>x.action==='rollback').length,1);assert.deepEqual(f.waits,[]);
});

test('compiled fallback verifies the new provider UUID while preserving original release/approval across uncertain reconciliation',async()=>{
 for(const lost of [false,true]){
  const f=failedFixture();f.compiled=true;f.loseResponse=lost;const healthy=structuredClone(f.state.last_healthy),approval=structuredClone(f.state.last_user_approved);
  assert.equal((await f.execute()).recovered,true);assert.equal(f.writes,1);assert.equal(f.state.rollback.state,'verified');assert.equal(f.state.revision,5);assert.equal(f.state.held,true);assert.notEqual(f.active.version_id,healthy.version_id);assert.deepEqual(f.state.rollback.original_target,healthy);assert.deepEqual(f.state.last_healthy,healthy);assert.deepEqual(f.state.last_user_approved,approval);
  await f.execute();assert.equal(f.writes,1);
 }
});
