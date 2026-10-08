import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {releaseRecoveryResponse,verifyRetainedReleaseArchive,verifiedReleaseArtifact,releaseArchiveQuery} from './release-recovery.js';
import {validateAutonomyInput} from './autonomy-control.js';
import {recoveryVersionFixture} from '../test/fixtures/recovery-archive.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const source='a'.repeat(40),version='11111111-2222-3333-4444-555555555555';
const gates=['Run workspace, contract, API, browser and React tests','Verify bundled Worker in local workerd','Verify exact live source and capture actual website pages','Retain and verify exact interactive sample build'];
function fixture(){
 const bytes=Buffer.from('synthetic opaque CI zip'),objects=new Map(),puts=[];
 const run={id:7,repository:{full_name:'lrnolivia/relay',id:99},head_repository:{full_name:'lrnolivia/relay',id:99},event:'push',head_branch:'main',head_sha:source,path:'.github/workflows/ci.yml',status:'completed',conclusion:'success',run_attempt:1};
 const artifact={id:8,name:'relay-worker-runtime-'+source+'-7-1',expired:false,workflow_run:{id:7,head_sha:source,head_branch:'main',repository_id:99,head_repository_id:99},size_in_bytes:bytes.length,digest:'sha256:'+hash(bytes)};
 const jobs={total_count:1,jobs:[{name:'quality',status:'completed',conclusion:'success',steps:gates.map(name=>({name,status:'completed',conclusion:'success'}))}]};
 const api=async path=>{if(path.endsWith('/runs/7'))return run;if(path.endsWith('/artifacts/8'))return artifact;if(path.includes('/jobs?'))return jobs;if(path.includes('/contents/')){const data=Buffer.from('{}');return {type:'file',encoding:'base64',size:data.length,content:data.toString('base64')};}throw Error('Unexpected GitHub path');};
 const bucket={async get(key){if(!objects.has(key))return null;const bytes=Buffer.from(objects.get(key));return {size:bytes.length,arrayBuffer:async()=>bytes};},async put(key,bytes,options){assert.equal(options.onlyIf.etagDoesNotMatch,'*');puts.push(key);if(!objects.has(key))objects.set(key,Buffer.from(bytes));if(bucket.loseOnce){bucket.loseOnce=false;throw Error('Synthetic lost provider response');}return {};}};
 const target={worker:'relay',version_id:version,source_sha:source,compatibility_id:'relay-autonomy-v1',evidence:'Synthetic release'};
 const url='https://relay.loew.fi/api/release-recovery?source_sha='+source+'&run_id=7&artifact_id=8';
 const send=(body=bytes,type='application/zip')=>releaseRecoveryResponse(new Request(url,{method:'POST',headers:{'Content-Type':type},body}),{EVIDENCE:bucket},{api,resolveTarget:async sha=>{assert.equal(sha,source);return target;},resolveConfiguration:async()=>recoveryVersionFixture(version)});
 return {bytes,objects,puts,run,artifact,jobs,api,bucket,target,url,send};
}
function restoreReceipt(digest){return {schema:1,source_sha:source,archive_sha256:digest,file_count:5,host_restore_verified:true,compiled_ci_runtime_evidence_verified:true,runtime_reexecuted:false,production_rollback_performed:false,files:['bundle/README.md','bundle/index.js','bundle/index.js.map','probe.json','result.json'].map(path=>({path,bytes:2,sha256:'b'.repeat(64)}))};}

test('exact successful main artifact is immutable, read back, restored and bound to a healthy target',async()=>{
 const f=fixture(),initial=await (await f.send()).json();assert.equal(initial.host_restore_verified,false);assert.equal(f.puts.length,2);
 const read=await releaseRecoveryResponse(new Request(f.url),{EVIDENCE:f.bucket},{api:f.api});assert.deepEqual(Buffer.from(await read.arrayBuffer()),f.bytes);
 const restored=await (await f.send(JSON.stringify({action:'restore',target:initial.target,receipt:restoreReceipt(hash(f.bytes))}),'application/json')).json();
 assert.equal(restored.evidence_source,'authenticated-ci-restoration-receipt');assert.equal(restored.host_restore_receipt_retained,true);
 await verifyRetainedReleaseArchive({EVIDENCE:f.bucket},restored.target);
 validateAutonomyInput({action:'healthy',scope:'relay',expected_revision:0,operation_id:'synthetic-healthy-release',reason:'Synthetic',target:restored.target});
 assert.throws(()=>validateAutonomyInput({action:'healthy',scope:'relay',expected_revision:0,operation_id:'synthetic-healthy-release',reason:'Synthetic',target:initial.target}),/restore digests/);
 await f.send();assert.equal(f.puts.length,3,'Content-addressed retry must not replay successful writes');
 const manifestKey=[...f.objects.keys()].find(k=>k.endsWith(initial.target.recovery.manifest_sha256+'.json'));
 f.objects.set(manifestKey,Buffer.from('corrupt'));
 await assert.rejects(verifyRetainedReleaseArchive({EVIDENCE:f.bucket},restored.target),/manifest digest/);
});
test('fork, PR, failed/incomplete gates and mismatched artifact never write recovery objects',async t=>{
 const mutations=[f=>f.run.head_repository.id=100,f=>f.run.head_repository.full_name='fork/relay',f=>f.run.event='pull_request',f=>f.run.conclusion='failure',f=>f.run.status='in_progress',f=>f.run.head_sha='c'.repeat(40),f=>f.run.path='.github/workflows/other.yml',f=>f.artifact.expired=true,f=>f.artifact.workflow_run.head_repository_id=100,f=>f.artifact.name+='-wrong',f=>f.artifact.digest='sha256:invalid',f=>f.artifact.size_in_bytes=9*1024*1024,f=>f.jobs.total_count=101,f=>f.jobs.jobs[0].steps[2].conclusion='skipped'];
 for(const [i,mutate] of mutations.entries())await t.test(String(i),async()=>{const f=fixture();mutate(f);await assert.rejects(f.send());assert.equal(f.puts.length,0);});
});
test('byte mismatch, immutable corruption and a lost write response never produce a verified receipt',async()=>{
 const f=fixture();await assert.rejects(f.send(Buffer.from('changed')),/GitHub artifact digest/);assert.equal(f.puts.length,0);
 f.bucket.loseOnce=true;await assert.rejects(f.send(),/lost provider response/);assert.equal(f.puts.length,1);
 const receipt=await (await f.send()).json();assert.equal(receipt.remote_readback_verified,true);assert.equal(f.puts.length,2,'Retry reconciles the already-written archive');
 f.objects.set(receipt.archive_key,Buffer.from('corrupt'));await assert.rejects(f.send(),/conflicts/);
});
test('malformed query, oversized body and incomplete restore are rejected',async()=>{
 for(const query of ['source_sha='+source+'&run_id=7&artifact_id=8&extra=1','source_sha='+source+'&run_id=7&run_id=7&artifact_id=8','source_sha=bad&run_id=7&artifact_id=8'])assert.throws(()=>releaseArchiveQuery(new URL('https://relay.loew.fi/?'+query)));
 const f=fixture();await assert.rejects(f.send(Buffer.alloc(8*1024*1024+1)),/8 MiB/);assert.equal(f.puts.length,0);
 const initial=await (await f.send()).json(),receipt=restoreReceipt(hash(f.bytes));receipt.files.pop();
 await assert.rejects(f.send(JSON.stringify({action:'restore',target:initial.target,receipt}),'application/json'),/restoration receipt/);assert.equal(f.puts.length,2);
 await assert.rejects(verifyRetainedReleaseArchive({EVIDENCE:f.bucket},{...initial.target,version_id:'22222222-2222-3333-4444-555555555555'}),/bind this exact release/);
});
test('archive retention and recovery readback run against actual pinned workerd and R2', {timeout:30000},async()=>{
 const {createTestHarness}=await import('wrangler'),directory=await mkdtemp(join(tmpdir(),'relay-archive-runtime-'));
 const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8')),main=join(directory,'worker.mjs');
 await writeFile(main,`import {releaseRecoveryResponse} from ${JSON.stringify(new URL('./release-recovery.js',import.meta.url).pathname)};
 export default {async fetch(request,env){try{
 const source='a'.repeat(40),bytes=new TextEncoder().encode('runtime fixture'),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const run={id:7,repository:{full_name:'lrnolivia/relay',id:99},head_repository:{full_name:'lrnolivia/relay',id:99},event:'push',head_branch:'main',head_sha:source,path:'.github/workflows/ci.yml',status:'completed',conclusion:'success',run_attempt:1};
 const artifact={id:8,name:'relay-worker-runtime-'+source+'-7-1',expired:false,workflow_run:{id:7,head_sha:source,head_branch:'main',repository_id:99,head_repository_id:99},size_in_bytes:bytes.length,digest:'sha256:'+digest};
 const api=async path=>path.endsWith('/runs/7')?run:path.endsWith('/artifacts/8')?artifact:path.includes('/jobs?')?{total_count:1,jobs:[{name:'quality',status:'completed',conclusion:'success',steps:${JSON.stringify(gates)}.map(name=>({name,status:'completed',conclusion:'success'}))}]}:{type:'file',encoding:'base64',size:2,content:'e30='};
 const url='https://relay.loew.fi/api/release-recovery?source_sha='+source+'&run_id=7&artifact_id=8';
 const deps={api,resolveTarget:async()=>({worker:'relay',version_id:'${version}',source_sha:source,compatibility_id:'relay-autonomy-v1',evidence:'Synthetic runtime'}),resolveConfiguration:async()=>(${JSON.stringify(recoveryVersionFixture(version))})};
 const posted=await releaseRecoveryResponse(new Request(url,{method:'POST',headers:{'Content-Type':'application/zip'},body:bytes}),env,deps),receipt=await posted.json();
 const read=await releaseRecoveryResponse(new Request(url),env,deps);return Response.json({receipt,bytes:Array.from(new Uint8Array(await read.arrayBuffer()))});
 }catch(error){return Response.json({error:error.message},{status:500});}}};`);
 const harness=createTestHarness({root:directory,workers:[{config:{name:'relay-archive-runtime',main,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags,r2_buckets:[{binding:'EVIDENCE',bucket_name:'fixture'}]}}]});
 try{await harness.listen();const response=await harness.fetch('/'),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.receipt.remote_readback_verified,true);assert.equal(Buffer.from(body.bytes).toString(),'runtime fixture');}finally{await harness.close();await rm(directory,{recursive:true,force:true});}
});
