import {crc32,deflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {providerRecoveryConfiguration} from '../../src/compiled-recovery.js';
export const fixtureSource='a'.repeat(40),fixtureVersion='11111111-2222-3333-4444-555555555555';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function zipRecoveryFiles(files,{descriptor=true}={}){
 const local=[],central=[];let offset=0;
 for(const [name,data] of files){
  const raw=Buffer.from(data),encoded=deflateRawSync(raw),label=Buffer.from(name),checksum=crc32(raw),flag=descriptor?8:0;
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(flag,6);h.writeUInt16LE(8,8);h.writeUInt16LE(label.length,26);
  if(!descriptor){h.writeUInt32LE(checksum,14);h.writeUInt32LE(encoded.length,18);h.writeUInt32LE(raw.length,22);}
  const d=Buffer.alloc(descriptor?16:0);if(descriptor){d.writeUInt32LE(0x08074b50);d.writeUInt32LE(checksum,4);d.writeUInt32LE(encoded.length,8);d.writeUInt32LE(raw.length,12);}
  local.push(h,label,encoded,d);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(flag,8);c.writeUInt16LE(8,10);c.writeUInt32LE(checksum,16);c.writeUInt32LE(encoded.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(label.length,28);c.writeUInt32LE(0o100644*65536,38);c.writeUInt32LE(offset,42);central.push(c,label);offset+=h.length+label.length+encoded.length+d.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,directory,end]);
}
export function recoveryArchiveFixture(source=fixtureSource){
 const checks=[{criterion:'website-source',source_sha:source,status:200},{criterion:'worker-health',status:200},...['/mcp','/api/panel'].map(path=>({criterion:'unauthenticated-rejection',path,status:401})),...['global','relay'].map(scope=>({criterion:'durable-safety-status',scope,held:false}))];
 const files=[['bundle/README.md','Synthetic compiled fixture\n'],['bundle/index.js','export default {fetch(){return new Response("synthetic");}}'],['bundle/index.js.map','{"version":3}']];
 const artifacts=files.map(([path,data])=>({path:path.slice(7),bytes:Buffer.byteLength(data),sha256:hash(data)}));
 files.push(['probe.json',JSON.stringify({checks})],['result.json',JSON.stringify({schema:1,kind:'relay-worker-runtime',state:'passed',stage:'complete',runtime:'local-workerd',identity:{source_sha:source},bundle:{status:'passed',exit_code:0},artifacts,checks})]);
 const archive=zipRecoveryFiles(files),receipt={schema:1,source_sha:source,archive_sha256:hash(archive),file_count:5,host_restore_verified:true,compiled_ci_runtime_evidence_verified:true,runtime_reexecuted:false,production_rollback_performed:false,files:files.map(([path,data])=>({path,bytes:Buffer.byteLength(data),sha256:hash(data)})).sort((a,b)=>a.path.localeCompare(b.path))};
 return {archive,receipt,files};
}
export function recoveryVersionFixture(id=fixtureVersion){return {id,resources:{script_runtime:{compatibility_date:'2026-09-29',compatibility_flags:['nodejs_compat','global_fetch_strictly_public'],migration_tag:'ctrl-events-v1',usage_model:'standard'},script:{named_handlers:[{name:'RelayEvents',handlers:['class']}]},bindings:[{name:'EVIDENCE',type:'r2_bucket',bucket_name:'loew-inspector-evidence'},{name:'RELAY_EVENTS',type:'durable_object_namespace',class_name:'RelayEvents',namespace_id:'a'.repeat(32)},{name:'CLOUDFLARE_API_TOKEN',type:'secret_text'},{name:'RELAY_AUTONOMY_GUARD',type:'plain_text',text:'enforced'}]}};}
export function recoverySourceConfiguration(){return {'wrangler.jsonc':{text:JSON.stringify({name:'relay',compatibility_date:'2026-09-29',compatibility_flags:['nodejs_compat','global_fetch_strictly_public'],vars:{RELAY_AUTONOMY_GUARD:'enforced'},r2_buckets:[{binding:'EVIDENCE',bucket_name:'loew-inspector-evidence'}],durable_objects:{bindings:[{name:'RELAY_EVENTS',class_name:'RelayEvents'}]},migrations:[{tag:'ctrl-events-v1',new_sqlite_classes:['RelayEvents']}]})}};}

export function retainedRecoveryFixture(){
 const fixture=recoveryArchiveFixture(),root='release-recovery/v1/relay/'+fixtureSource+'/';
 const manifest={schema:1,kind:'relay-release-recovery-archive',repository:'lrnolivia/relay',source_sha:fixtureSource,worker:'relay',retained_provider_version:fixtureVersion,compatibility_id:'relay-autonomy-v1',zip_sha256:hash(fixture.archive),zip_bytes:fixture.archive.length,archive_key:root+hash(fixture.archive)+'.zip',artifact_id:1,ci_run:2,required_release_gates_verified:true,provider_configuration:providerRecoveryConfiguration(recoveryVersionFixture()),source_configuration:recoverySourceConfiguration()};
 const manifestBytes=Buffer.from(JSON.stringify(manifest)),manifestHash=hash(manifestBytes);
 const host={schema:1,kind:'relay-release-host-restore',evidence_source:'authenticated-ci-restoration-receipt',manifest_sha256:manifestHash,version_id:fixtureVersion,ci_run:2,artifact_id:1,receipt:fixture.receipt};
 const hostBytes=Buffer.from(JSON.stringify(host)),hostHash=hash(hostBytes);
 return {...fixture,target:{worker:'relay',version_id:fixtureVersion,source_sha:fixtureSource,compatibility_id:'relay-autonomy-v1',evidence:'Synthetic retained fixture',recovery:{archive_sha256:hash(fixture.archive),manifest_sha256:manifestHash,restore_sha256:hostHash,artifact_id:1,ci_run:2}},objects:[[manifest.archive_key,fixture.archive],[root+manifestHash+'.json',manifestBytes],[root+'host-restore-'+hostHash+'.json',hostBytes]]};
}
