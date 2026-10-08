import {autonomyRequest} from './autonomy-control.js';
import {retainedCompiledRecovery} from './release-recovery.js';
import {providerRecoveryConfiguration,compatibleRecoveryConfiguration,recoveryConfigurationDigest} from './compiled-recovery.js';

// Only an exact pending durable rollback can enter here. A persisted upload
// intent is never POSTed again, even if the provider's first reply was lost.
export async function restoreExpiredCloudVersion(env,scope,operation,{api,active,upload,read,retained=target=>retainedCompiledRecovery(env,target)}={}){
 let snapshot=await read(),pending=snapshot.state.rollback;
 if(scope!=='relay'||pending.target.worker!=='relay')throw Error('Compiled recovery is Relay-only');
 const original=pending.original_target||pending.target;
 const saved=await retained(original),live=await active();
 if(live.version_id!==pending.expected_current_version)throw Error('Deployment changed before compiled recovery');
 const current=providerRecoveryConfiguration(await api('/versions/'+live.version_id));
 const metadata=compatibleRecoveryConfiguration(saved.manifest.provider_configuration,current,saved.manifest.source_configuration);
 const hashes={module_sha256:saved.module_sha256,configuration_sha256:recoveryConfigurationDigest(metadata)};
 const message='Relay compiled recovery '+operation+' '+original.source_sha+' '+hashes.module_sha256+' '+hashes.configuration_sha256;
 const assertUnchanged=async()=>{
  const fresh=await read();
  if(JSON.stringify(fresh)!==JSON.stringify(snapshot))throw Error('Safety changed before compiled recovery write');
  const now=await active();if(now.version_id!==live.version_id||now.deployment_id!==live.deployment_id)throw Error('Deployment changed before compiled recovery write');
 };
 let version;
 if(pending.restoration){
  if(pending.restoration.state!=='upload_pending'||Object.entries(hashes).some(([key,value])=>pending.restoration[key]!==value))throw Error('Compiled upload intent changed');
  const list=await api('/versions');
  if(!Array.isArray(list?.items)||list.items.length>100)throw Error('Bounded provider version inventory is required');
  const matches=list.items.filter(item=>item.annotations?.['workers/message']===message);
  if(matches.length!==1)throw Error('Compiled upload remains uncertain; no repeated provider upload');
  version=matches[0].id;
 }else{
  await assertUnchanged();
  const prepared=await autonomyRequest(env,{action:'prepare_restore_upload',scope,expected_revision:snapshot.state.revision,operation_id:operation+'-upload',reason:snapshot.state.reason,result:hashes});
  snapshot={...snapshot,state:prepared.state};pending=prepared.state.rollback;
  await assertUnchanged();
  try{const result=await upload({...metadata,annotations:{'workers/message':message}},saved.module);version=result?.id;}
  catch{throw Error('Compiled upload response uncertain; durable intent retained without replay');}
 }
 // Provider readback must prove runtime/binding identity before recording the
 // new UUID. The immutable release and explicit approval keep their old UUID.
 const uploaded=providerRecoveryConfiguration(await api('/versions/'+version));
 const {version_id:oldId,...expected}=saved.manifest.provider_configuration;
 const {version_id:newId,...actual}=uploaded;
 if(!version||version===live.version_id||version===original.version_id||recoveryConfigurationDigest(actual)!==recoveryConfigurationDigest(expected))throw Error('Compiled provider configuration readback changed');
 await assertUnchanged();
 return autonomyRequest(env,{action:'finish_restore_upload',scope,expected_revision:snapshot.state.revision,operation_id:operation+'-record',reason:snapshot.state.reason,result:{...hashes,version_id:version}});
}
