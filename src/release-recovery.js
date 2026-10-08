import {createHash} from 'node:crypto';
import {githubApiRequest} from './source.js';

export const RELEASE_ARCHIVE_LIMIT=8*1024*1024;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const SHA=/^[a-f0-9]{40}$/,DIGEST=/^[a-f0-9]{64}$/;
const prefix=source=>'release-recovery/v1/relay/'+source+'/';
export class ReleaseRecoveryError extends Error {
 constructor(code,message,status=409){super(message);Object.assign(this,{code,status});}
}
const requireValue=(value,code,message,status)=>{if(!value)throw new ReleaseRecoveryError(code,message,status);};
export function recoveryPointer(value){
 return value&&typeof value==='object'&&!Array.isArray(value)&&[4,5].includes(Object.keys(value).length)&&Object.keys(value).every(k=>['archive_sha256','manifest_sha256','artifact_id','ci_run','restore_sha256'].includes(k))&&DIGEST.test(value.archive_sha256)&&DIGEST.test(value.manifest_sha256)&&(!('restore_sha256' in value)||DIGEST.test(value.restore_sha256))&&Number.isSafeInteger(value.artifact_id)&&value.artifact_id>0&&Number.isSafeInteger(value.ci_run)&&value.ci_run>0;
}
function validRestore(receipt,source,digest){
 const paths=['bundle/README.md','bundle/index.js','bundle/index.js.map','probe.json','result.json'];
 return receipt?.schema===1&&receipt.source_sha===source&&receipt.archive_sha256===digest&&receipt.file_count===5&&receipt.host_restore_verified===true&&receipt.compiled_ci_runtime_evidence_verified===true&&receipt.runtime_reexecuted===false&&receipt.production_rollback_performed===false&&Array.isArray(receipt.files)&&receipt.files.length===5&&paths.every(path=>receipt.files.filter(f=>f.path===path&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&DIGEST.test(f.sha256)).length===1)&&receipt.files.reduce((n,f)=>n+f.bytes,0)<=16*1024*1024;
}
export function releaseArchiveQuery(url){
 const keys=['source_sha','run_id','artifact_id'];
 requireValue([...url.searchParams.keys()].length===3&&keys.every(k=>url.searchParams.getAll(k).length===1),'invalid_query','Exact source, run and artifact are required',400);
 const source=url.searchParams.get('source_sha'),run=Number(url.searchParams.get('run_id')),artifact=Number(url.searchParams.get('artifact_id'));
 requireValue(SHA.test(source)&&/^[1-9]\d{0,15}$/.test(url.searchParams.get('run_id'))&&/^[1-9]\d{0,15}$/.test(url.searchParams.get('artifact_id'))&&Number.isSafeInteger(run)&&Number.isSafeInteger(artifact),'invalid_query','Invalid release archive identity',400);
 return {source_sha:source,run_id:run,artifact_id:artifact};
}
export async function verifiedReleaseArtifact(env,identity,api=(path,options)=>githubApiRequest(env,path,options)){
 const root='/repos/lrnolivia/relay',options={requireAuthenticated:true,readCache:'none'};
 const run=await api(root+'/actions/runs/'+identity.run_id,options);
 requireValue(run?.id===identity.run_id&&run.repository?.full_name==='lrnolivia/relay'&&run.head_repository?.full_name==='lrnolivia/relay'&&run.repository.id===run.head_repository.id&&run.event==='push'&&run.head_branch==='main'&&run.head_sha===identity.source_sha&&run.path==='.github/workflows/ci.yml'&&run.status==='completed'&&run.conclusion==='success'&&Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0,'invalid_run','Only completed successful canonical main CI can retain a release');
 const [artifact,jobs]=await Promise.all([api(root+'/actions/artifacts/'+identity.artifact_id,options),api(root+'/actions/runs/'+identity.run_id+'/jobs?filter=latest&per_page=100',options)]);
 const expected='relay-worker-runtime-'+identity.source_sha+'-'+identity.run_id+'-'+run.run_attempt;
 requireValue(artifact?.id===identity.artifact_id&&artifact.name===expected&&artifact.expired===false&&artifact.workflow_run?.id===run.id&&artifact.workflow_run.head_sha===run.head_sha&&artifact.workflow_run.head_branch==='main'&&artifact.workflow_run.repository_id===run.repository.id&&artifact.workflow_run.head_repository_id===run.repository.id&&Number.isSafeInteger(artifact.size_in_bytes)&&artifact.size_in_bytes>0&&artifact.size_in_bytes<=RELEASE_ARCHIVE_LIMIT&&/^sha256:[a-f0-9]{64}$/.test(artifact.digest||''),'invalid_artifact','Runtime artifact identity or GitHub digest is incomplete');
 const quality=jobs?.jobs?.filter(j=>j.name==='quality');
 requireValue(Number.isSafeInteger(jobs?.total_count)&&jobs.total_count<=100&&jobs.jobs?.length===jobs.total_count&&quality?.length===1&&quality[0].status==='completed'&&quality[0].conclusion==='success','incomplete_gates','Complete canonical quality evidence is required');
 for(const name of ['Run workspace, contract, API, browser and React tests','Verify bundled Worker in local workerd','Verify exact live source and capture actual website pages','Retain and verify exact interactive sample build']){
  const steps=quality[0].steps?.filter(s=>s.name===name);
  requireValue(steps?.length===1&&steps[0].status==='completed'&&steps[0].conclusion==='success','incomplete_gates','Required release gate is not verified: '+name);
 }
 return {artifact,run};
}
async function objectBytes(bucket,key,limit){
 const object=await bucket.get(key);
 requireValue(object,'missing_archive','Retained recovery object is missing');
 requireValue(Number.isSafeInteger(object.size)&&object.size>=0&&object.size<=limit,'archive_limit','Retained object exceeds its bound');
 const bytes=new Uint8Array(await object.arrayBuffer());
 requireValue(bytes.length===object.size,'archive_readback','Retained object length changed');return bytes;
}
async function immutableObject(bucket,key,bytes){
 const before=await bucket.get(key);
 if(before){requireValue(before.size===bytes.length&&hash(new Uint8Array(await before.arrayBuffer()))===hash(bytes),'archive_conflict','Immutable recovery object conflicts');return;}
 // A lost response is not replayed here; callers can reconcile by reading the
 // content-addressed object. The condition also protects concurrent writers.
 await bucket.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'}});
 const read=await objectBytes(bucket,key,RELEASE_ARCHIVE_LIMIT);
 requireValue(read.length===bytes.length&&hash(read)===hash(bytes),'archive_readback','Recovery object readback failed');
}
async function boundedBody(request){
 const reader=request.body?.getReader();requireValue(reader,'invalid_archive','Archive bytes are required',400);
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>RELEASE_ARCHIVE_LIMIT){await reader.cancel();throw new ReleaseRecoveryError('archive_limit','Release archive exceeds 8 MiB',413);}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function verifyRetainedReleaseArchive(env,target){
 requireValue(recoveryPointer(target?.recovery)&&SHA.test(target.source_sha),'invalid_pointer','Exact recovery archive pointer is required');
 requireValue(env.EVIDENCE,'archive_unavailable','Recovery storage is unavailable',503);
 const pointer=target.recovery,root=prefix(target.source_sha),bytes=await objectBytes(env.EVIDENCE,root+pointer.manifest_sha256+'.json',65536);
 requireValue(hash(bytes)===pointer.manifest_sha256,'archive_readback','Recovery manifest digest does not match');
 let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ReleaseRecoveryError('invalid_manifest','Recovery manifest is invalid');}
 requireValue(manifest?.schema===1&&manifest.kind==='relay-release-recovery-archive'&&manifest.repository==='lrnolivia/relay'&&manifest.source_sha===target.source_sha&&manifest.worker===target.worker&&manifest.retained_provider_version===target.version_id&&manifest.compatibility_id===target.compatibility_id&&manifest.zip_sha256===pointer.archive_sha256&&manifest.artifact_id===pointer.artifact_id&&manifest.ci_run===pointer.ci_run&&manifest.archive_key===root+pointer.archive_sha256+'.zip'&&manifest.required_release_gates_verified===true,'invalid_manifest','Recovery manifest does not bind this exact release');
 const archive=await objectBytes(env.EVIDENCE,manifest.archive_key,RELEASE_ARCHIVE_LIMIT);
 requireValue(archive.length===manifest.zip_bytes&&hash(archive)===pointer.archive_sha256,'archive_readback','Recovery archive digest does not match');
 if(pointer.restore_sha256){
  const bytes=await objectBytes(env.EVIDENCE,root+'host-restore-'+pointer.restore_sha256+'.json',65536);
  requireValue(hash(bytes)===pointer.restore_sha256,'archive_readback','Host restoration receipt digest does not match');
  let restored;try{restored=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ReleaseRecoveryError('invalid_restore','Host restoration receipt is invalid');}
  requireValue(restored?.schema===1&&restored.kind==='relay-release-host-restore'&&restored.evidence_source==='authenticated-ci-restoration-receipt'&&restored.manifest_sha256===pointer.manifest_sha256&&restored.version_id===target.version_id&&restored.ci_run===pointer.ci_run&&restored.artifact_id===pointer.artifact_id&&validRestore(restored.receipt,target.source_sha,pointer.archive_sha256),'invalid_restore','Host restoration receipt does not bind this exact release');
 }
 return {manifest,archive};
}
// Authentication is enforced by the entrypoint before this handler. The only
// storage namespace is the existing Relay recovery prefix; no caller URL/key.
export async function releaseRecoveryResponse(request,env,{api,resolveTarget}={}){
 requireValue(['GET','POST'].includes(request.method),'invalid_method','Use GET or POST',405);
 const identity=releaseArchiveQuery(new URL(request.url));
 const {artifact,run}=await verifiedReleaseArtifact(env,identity,api);
 requireValue(env.EVIDENCE,'archive_unavailable','Recovery storage is unavailable',503);
 const root=prefix(identity.source_sha),archiveKey=root+artifact.digest.slice(7)+'.zip';
 if(request.method==='GET'){
  const bytes=await objectBytes(env.EVIDENCE,archiveKey,RELEASE_ARCHIVE_LIMIT);
  requireValue(bytes.length===artifact.size_in_bytes&&hash(bytes)===artifact.digest.slice(7),'archive_readback','Recovery archive digest does not match');
  return new Response(bytes,{headers:{'Content-Type':'application/zip','Content-Length':String(bytes.length),'Cache-Control':'no-store','X-Content-Sha256':artifact.digest.slice(7)}});
 }
 if(request.headers.get('content-type')==='application/json'){
  const bytes=await boundedBody(request);requireValue(bytes.length<=65536,'archive_limit','Host restore receipt exceeds 64 KiB',413);
  let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ReleaseRecoveryError('invalid_restore','Invalid host restoration request',400);}
  const target=input?.target;
  requireValue(input?.action==='restore'&&Object.keys(input).length===3&&target?.worker==='relay'&&target.source_sha===identity.source_sha&&target.recovery?.artifact_id===artifact.id&&target.recovery.ci_run===run.id&&target.recovery.archive_sha256===artifact.digest.slice(7)&&!target.recovery.restore_sha256&&validRestore(input.receipt,identity.source_sha,artifact.digest.slice(7)),'invalid_restore','Exact authenticated CI restoration receipt is required',400);
  await verifyRetainedReleaseArchive(env,target);
  const record={schema:1,kind:'relay-release-host-restore',evidence_source:'authenticated-ci-restoration-receipt',manifest_sha256:target.recovery.manifest_sha256,version_id:target.version_id,ci_run:run.id,artifact_id:artifact.id,receipt:input.receipt};
  const restoredBytes=Buffer.from(JSON.stringify(record)+'\n'),restoreHash=hash(restoredBytes);
  await immutableObject(env.EVIDENCE,root+'host-restore-'+restoreHash+'.json',restoredBytes);
  const restoredTarget={...target,recovery:{...target.recovery,restore_sha256:restoreHash}};
  await verifyRetainedReleaseArchive(env,restoredTarget);
  return Response.json({ok:true,target:restoredTarget,host_restore_receipt_retained:true,evidence_source:record.evidence_source},{headers:{'Cache-Control':'no-store'}});
 }
 requireValue(request.headers.get('content-type')==='application/zip','invalid_archive','ZIP archive content type is required',400);
 const bytes=await boundedBody(request);
 requireValue(bytes.length===artifact.size_in_bytes&&hash(bytes)===artifact.digest.slice(7),'archive_mismatch','Uploaded archive does not match GitHub artifact digest',400);
 requireValue(resolveTarget,'archive_unavailable','Release verification is unavailable',503);
 const target=await resolveTarget(identity.source_sha);
 requireValue(target.worker==='relay'&&target.source_sha===identity.source_sha&&target.compatibility_id==='relay-autonomy-v1','invalid_target','Only the exact compatible Relay release can be retained');
 const sourceApi=api||((path,options)=>githubApiRequest(env,path,options));
 const configs={};
 for(const path of ['projects/relay.json','wrangler.jsonc']){
  const file=await sourceApi('/repos/lrnolivia/relay/contents/'+path+'?ref='+identity.source_sha,{requireAuthenticated:true,readCache:'none'});
  requireValue(file?.type==='file'&&file.encoding==='base64'&&!file.truncated&&file.size>0&&file.size<=32768&&typeof file.content==='string'&&file.content.length<=48000,'invalid_configuration','Exact source recovery configuration is incomplete');
  const encoded=file.content.replace(/\s/g,''),raw=Buffer.from(encoded,'base64');requireValue(raw.length===file.size&&raw.toString('base64')===encoded,'invalid_configuration','Source configuration size or encoding mismatch');configs[path]={text:new TextDecoder('utf-8',{fatal:true}).decode(raw),sha256:hash(raw)};
 }
 const manifest={schema:1,kind:'relay-release-recovery-archive',repository:'lrnolivia/relay',source_sha:identity.source_sha,worker:target.worker,retained_provider_version:target.version_id,compatibility_id:target.compatibility_id,zip_sha256:artifact.digest.slice(7),zip_bytes:bytes.length,archive_key:archiveKey,artifact_id:artifact.id,ci_run:run.id,ci_attempt:run.run_attempt,required_release_gates_verified:true,source_configuration:configs,limitations:['Secrets and mutable production data are excluded.','Host restoration is separately reported by the CI follow-up; no production rollback or provider-expiry fallback is implied.']};
 const manifestBytes=Buffer.from(JSON.stringify(manifest)+'\n'),manifestHash=hash(manifestBytes);
 requireValue(manifestBytes.length<=65536,'archive_limit','Recovery configuration manifest exceeds 64 KiB',413);
 await immutableObject(env.EVIDENCE,archiveKey,bytes);
 await immutableObject(env.EVIDENCE,root+manifestHash+'.json',manifestBytes);
 const recovery={archive_sha256:manifest.zip_sha256,manifest_sha256:manifestHash,artifact_id:artifact.id,ci_run:run.id};
 await verifyRetainedReleaseArchive(env,{...target,recovery});
 return Response.json({ok:true,target:{...target,recovery},archive_key:archiveKey,manifest_key:root+manifestHash+'.json',remote_readback_verified:true,host_restore_verified:false},{headers:{'Cache-Control':'no-store'}});
}
