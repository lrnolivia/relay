import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {recoveryArchiveFixture,fixtureSource,fixtureVersion} from '../test/fixtures/recovery-archive.mjs';

test('compiled archive validation and bounded decompression run in the pinned edge runtime',{timeout:30000},async()=>{
 const {createTestHarness}=await import('wrangler');const f=recoveryArchiveFixture();
 const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8')),directory=await mkdtemp(join(tmpdir(),'relay-compiled-recovery-')),main=join(directory,'worker.mjs');
 await writeFile(main,`import {readCompiledRecoveryArchive} from ${JSON.stringify(new URL('./compiled-recovery.js',import.meta.url).pathname)};
 export default {async fetch(request){try{const archive=new Uint8Array(await request.arrayBuffer()),result=readCompiledRecoveryArchive(archive,${JSON.stringify(fixtureSource)},${JSON.stringify(f.receipt)});return Response.json({ok:true,files:result.files,module_sha256:result.module_sha256});}catch(error){return Response.json({error:error.message},{status:400});}}};`);
 const harness=createTestHarness({root:directory,workers:[{config:{name:'relay-compiled-recovery-runtime',main,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags}}]});
 try{await harness.listen();const response=await harness.fetch('/',{method:'POST',body:f.archive}),result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.files.length,5);assert.equal(result.module_sha256,f.receipt.files.find(x=>x.path==='bundle/index.js').sha256);
  const corrupt=Buffer.from(f.archive);corrupt[40]^=0xff;assert.equal((await harness.fetch('/',{method:'POST',body:corrupt})).status,400);
 }finally{await harness.close();await rm(directory,{recursive:true,force:true});}
});

test('expired-version rollback uses actual edge Durable Object/R2 storage and reconciles a lost synthetic provider reply once',{timeout:30000},async()=>{
 const {createTestHarness}=await import('wrangler');
 const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8')),directory=await mkdtemp(join(tmpdir(),'relay-recovery-orchestration-')),main=join(directory,'worker.mjs');
 const source=`import {recoverCloudVersion} from ${JSON.stringify(new URL('./cloud.js',import.meta.url).pathname)};
 import {autonomyRequest} from ${JSON.stringify(new URL('./autonomy-control.js',import.meta.url).pathname)};
 import {retainedRecoveryFixture,recoveryVersionFixture,fixtureVersion} from ${JSON.stringify(new URL('../test/fixtures/recovery-archive.mjs',import.meta.url).pathname)};
 import {recoveryHash} from ${JSON.stringify(new URL('./compiled-recovery.js',import.meta.url).pathname)};
 export {RelayEvents} from ${JSON.stringify(new URL('./relay-events.js',import.meta.url).pathname)};
 export default {async fetch(request,env){try{
  const fixture=retainedRecoveryFixture(),from='66666666-7777-8888-9999-aaaaaaaaaaaa',restored='bbbbbbbb-cccc-dddd-eeee-ffffffffffff',operation='runtime-expired-recovery';
  for(const [key,bytes] of fixture.objects)await env.EVIDENCE.put(key,bytes);
  await autonomyRequest(env,{action:'healthy',scope:'relay',expected_revision:0,operation_id:'runtime-register-healthy',reason:'Synthetic fixture',target:fixture.target});
  await autonomyRequest(env,{action:'approve',scope:'relay',expected_revision:1,operation_id:'runtime-register-approval',reason:'Synthetic fixture',target:fixture.target,approval:{text:'Synthetic approval',source:'Runtime fixture'}});
  await autonomyRequest(env,{action:'prepare_rollback',scope:'relay',expected_revision:2,operation_id:operation,reason:'Synthetic expired provider UUID',kind:'healthy',expected_current_version:from});
  let active=from,uploaded,uploads=0,deploys=0,strict=false,bytesMatch=false,firstError;
  globalThis.fetch=async(url,options={})=>{
   const path=new URL(url).pathname;
   if(path.endsWith('/versions/'+fixtureVersion))return Response.json({success:false,errors:[{message:'Synthetic provider history expiry'}]},{status:404});
   if(path.endsWith('/versions/'+from))return Response.json({success:true,result:recoveryVersionFixture(from)});
   if(path.endsWith('/versions/'+restored))return Response.json({success:true,result:recoveryVersionFixture(restored)});
   if(path.endsWith('/versions')&&options.method==='POST'){
    uploads++;strict=new URL(url).searchParams.get('bindings_inherit')==='strict';const metadata=JSON.parse(await options.body.get('metadata').text());
    bytesMatch=recoveryHash(new Uint8Array(await options.body.get('index.js').arrayBuffer()))===fixture.receipt.files.find(f=>f.path==='bundle/index.js').sha256;
    if(!metadata.bindings.every(b=>b.type==='inherit'&&b.version_id===from))throw Error('Unpinned binding');
    uploaded={id:restored,annotations:metadata.annotations};throw Error('Synthetic reply lost after provider commit');
   }
   if(path.endsWith('/versions'))return Response.json({success:true,result:{items:uploaded?[uploaded]:[]}});
   if(path.endsWith('/deployments')){
    if(options.method==='POST'){deploys++;active=JSON.parse(options.body).versions[0].version_id;return Response.json({success:true,result:{id:'synthetic-restored-deployment'}});}
    return Response.json({success:true,result:{deployments:[{id:'synthetic-deployment-'+active,versions:[{version_id:active,percentage:100}]}]}});
   }
   throw Error('Unexpected synthetic provider request');
  };
  try{await recoverCloudVersion(env,'relay',operation);}catch(error){firstError=error.message;}
  const result=await recoverCloudVersion(env,'relay',operation),state=(await autonomyRequest(env,{action:'status',scope:'relay'})).state;
  const reconciled=await recoverCloudVersion(env,'relay',operation);
  return Response.json({result,state,reconciled,uploads,deploys,strict,bytesMatch,firstError,provider:'synthetic',storage:'actual-workerd-DO-R2'});
 }catch(error){return Response.json({error:error.message,stack:error.stack},{status:500});}}};`;
 await writeFile(main,source);
 const harness=createTestHarness({root:directory,workers:[{config:{name:'relay-recovery-orchestration',main,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags,vars:{CLOUDFLARE_ACCOUNT_ID:'synthetic-account',CLOUDFLARE_API_TOKEN:'synthetic-token',RELAY_CLOUDFLARE_WRITE_SCRIPTS:'relay'},r2_buckets:[{binding:'EVIDENCE',bucket_name:'fixture'}],durable_objects:{bindings:[{name:'RELAY_EVENTS',class_name:'RelayEvents'}]},migrations:[{tag:'test-v1',new_sqlite_classes:['RelayEvents']}]}}]});
 try{await harness.listen();const response=await harness.fetch('/'),result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.uploads,1);assert.equal(result.deploys,1);assert.equal(result.strict,true);assert.equal(result.bytesMatch,true);assert.match(result.firstError,/uncertain/);assert.equal(result.reconciled.reconciled,true);assert.equal(result.state.held,true);assert.equal(result.state.rollback.restoration.state,'uploaded');assert.deepEqual(result.state.last_healthy,result.state.rollback.original_target);assert.equal(result.state.last_user_approved.version_id,fixtureVersion);
 }finally{await harness.close();await rm(directory,{recursive:true,force:true});}
});
