import {createHash} from 'node:crypto';
import {inflateRawSync,crc32} from 'node:zlib';

const fail=message=>{throw Error('Compiled recovery: '+message);};
const requireValue=(value,message)=>{if(!value)fail(message);};
export const recoveryHash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const recoveryConfigurationDigest=value=>recoveryHash(JSON.stringify(canonical(value)));
const names=['bundle/README.md','bundle/index.js','bundle/index.js.map','probe.json','result.json'];
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));

// This is a deliberately narrow reader for the five-file GitHub runtime ZIP.
// Nothing is extracted to a filesystem or executed. ZIP64, links, extra fields,
// comments, unknown flags and overlapping records require a different review.
export function readCompiledRecoveryArchive(input,source,receipt){
 const bytes=Buffer.from(input);requireValue(bytes.length>=22&&bytes.length<=8*1024*1024,'archive size');
 const end=bytes.length-22;
 requireValue(bytes.readUInt32LE(end)===0x06054b50&&bytes.readUInt16LE(end+20)===0,'ZIP directory trailer');
 requireValue(bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0&&bytes.readUInt16LE(end+8)===5&&bytes.readUInt16LE(end+10)===5,'ZIP entry inventory');
 const size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
 requireValue(start+size===end,'ZIP directory bounds');
 const files=new Map(),ranges=[];let cursor=start,total=0;
 for(let entry=0;entry<5;entry++){
  requireValue(cursor+46<=end&&bytes.readUInt32LE(cursor)===0x02014b50,'ZIP central record');
  const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),checksum=bytes.readUInt32LE(cursor+16),compressed=bytes.readUInt32LE(cursor+20),length=bytes.readUInt32LE(cursor+24);
  const nameLength=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),mode=bytes.readUInt32LE(cursor+38)>>>16,offset=bytes.readUInt32LE(cursor+42);
  requireValue((flags&~0x808)===0&&[0,8].includes(method)&&extra===0&&comment===0&&bytes.readUInt16LE(cursor+34)===0&&[0,0o100000].includes(mode&0o170000),'unsupported ZIP entry');
  requireValue(cursor+46+nameLength<=end&&nameLength>0&&nameLength<=100,'ZIP entry name');
  const name=bytes.subarray(cursor+46,cursor+46+nameLength).toString('ascii');
  requireValue(names.includes(name)&&!files.has(name)&&Buffer.from(name).equals(bytes.subarray(cursor+46,cursor+46+nameLength)),'unexpected or duplicate entry');
  total+=length;requireValue(length>0&&total<=16*1024*1024&&compressed>0&&compressed<=8*1024*1024,'expanded ZIP limit');
  requireValue(offset+30<=start&&bytes.readUInt32LE(offset)===0x04034b50,'ZIP local record');
  requireValue(bytes.readUInt16LE(offset+6)===flags&&bytes.readUInt16LE(offset+8)===method&&bytes.readUInt16LE(offset+26)===nameLength&&bytes.readUInt16LE(offset+28)===0,'ZIP header mismatch');
  requireValue(bytes.subarray(offset+30,offset+30+nameLength).equals(Buffer.from(name)),'ZIP local name mismatch');
  const dataStart=offset+30+nameLength,dataEnd=dataStart+compressed;
  requireValue(dataEnd<=start,'ZIP compressed bounds');let recordEnd=dataEnd;
  if(flags&8){
   requireValue(dataEnd+16<=start&&bytes.readUInt32LE(dataEnd)===0x08074b50&&bytes.readUInt32LE(dataEnd+4)===checksum&&bytes.readUInt32LE(dataEnd+8)===compressed&&bytes.readUInt32LE(dataEnd+12)===length,'ZIP data descriptor');recordEnd+=16;
  }else requireValue(bytes.readUInt32LE(offset+14)===checksum&&bytes.readUInt32LE(offset+18)===compressed&&bytes.readUInt32LE(offset+22)===length,'ZIP local sizes');
  const encoded=bytes.subarray(dataStart,dataEnd),raw=method===0?encoded:inflateRawSync(encoded,{maxOutputLength:length});
  requireValue(raw.length===length&&crc32(raw)===checksum,'ZIP entry checksum or size');
  files.set(name,{path:name,bytes:raw.length,sha256:recoveryHash(raw),data:raw});ranges.push([offset,recordEnd]);cursor+=46+nameLength;
 }
 requireValue(cursor===end,'ZIP directory length');ranges.sort((a,b)=>a[0]-b[0]);
 requireValue(ranges[0][0]===0&&ranges.at(-1)[1]===start&&ranges.every((range,index)=>index===0||range[0]===ranges[index-1][1]),'ZIP overlapping or hidden bytes');
 requireValue(receipt?.source_sha===source&&receipt.file_count===5&&receipt.files?.length===5,'restoration receipt identity');
 for(const file of files.values())requireValue(receipt.files.filter(r=>r.path===file.path&&r.bytes===file.bytes&&r.sha256===file.sha256).length===1,'restoration digest mismatch');
 let result,probe;try{result=JSON.parse(files.get('result.json').data);probe=JSON.parse(files.get('probe.json').data);}catch{fail('runtime receipt JSON');}
 requireValue(result.schema===1&&result.kind==='relay-worker-runtime'&&result.state==='passed'&&result.stage==='complete'&&result.runtime==='local-workerd'&&result.identity?.source_sha===source&&result.bundle?.status==='passed'&&result.bundle.exit_code===0,'compiled runtime identity');
 requireValue(Array.isArray(result.artifacts)&&result.artifacts.length===3&&['README.md','index.js','index.js.map'].every(name=>result.artifacts.filter(r=>r.path===name&&r.bytes===files.get('bundle/'+name).bytes&&r.sha256===files.get('bundle/'+name).sha256).length===1),'compiled runtime hashes');
 const checks=result.checks;
 requireValue(Array.isArray(checks)&&JSON.stringify(probe.checks)===JSON.stringify(checks),'runtime probe checks');
 requireValue(checks.some(c=>c.criterion==='website-source'&&c.source_sha===source&&c.status===200)&&checks.some(c=>c.criterion==='worker-health'&&c.status===200),'runtime source/health checks');
 for(const path of ['/mcp','/api/panel'])requireValue(checks.some(c=>c.criterion==='unauthenticated-rejection'&&c.path===path&&c.status===401),'runtime authentication checks');
 for(const scope of ['global','relay'])requireValue(checks.some(c=>c.criterion==='durable-safety-status'&&c.scope===scope&&c.held===false),'runtime safety checks');
 return {module:files.get('bundle/index.js').data,module_sha256:files.get('bundle/index.js').sha256,files:[...files.values()].map(({data,...file})=>file).sort((a,b)=>a.path.localeCompare(b.path))};
}

export function providerRecoveryConfiguration(version){
 const runtime=version?.resources?.script_runtime,bindings=version?.resources?.bindings,named=version?.resources?.script?.named_handlers;
 requireValue(/^[a-f0-9-]{36}$/.test(version?.id||'')&&runtime&&/^\d{4}-\d{2}-\d{2}$/.test(runtime.compatibility_date||'')&&Array.isArray(runtime.compatibility_flags)&&runtime.compatibility_flags.every(x=>typeof x==='string'&&x.length<=100)&&typeof runtime.migration_tag==='string'&&runtime.migration_tag.length<=100&&runtime.usage_model==='standard','provider runtime configuration');
 requireValue(Array.isArray(bindings)&&bindings.length>0&&bindings.length<=64&&new Set(bindings.map(b=>b.name)).size===bindings.length,'provider binding inventory');
 const fields={browser:['name','type','version'],plain_text:['name','type','text'],secret_text:['name','type'],r2_bucket:['name','type','bucket_name','jurisdiction'],durable_object_namespace:['name','type','class_name','namespace_id','script_name','environment']};
 for(const binding of bindings){
  requireValue(fields[binding.type]&&exact(binding,fields[binding.type])&&/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(binding.name||''),'unsupported provider binding');
  if(binding.type==='plain_text')requireValue(typeof binding.text==='string'&&binding.text.length<=4096&&!/(?:^|_)(?:TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL)(?:_|$)/i.test(binding.name),'secret-like plain-text binding');
  if(binding.type==='r2_bucket')requireValue(typeof binding.bucket_name==='string'&&binding.bucket_name.length<=128,'R2 binding identity');
  if(binding.type==='durable_object_namespace')requireValue(/^[a-f0-9]{32}$/.test(binding.namespace_id||'')&&typeof binding.class_name==='string'&&binding.class_name.length<=100,'durable namespace identity');
 }
 requireValue(Array.isArray(named)&&named.length===1&&named[0].name==='RelayEvents'&&JSON.stringify(named[0].handlers)==='["class"]','durable class exports');
 return canonical({schema:1,version_id:version.id,compatibility_date:runtime.compatibility_date,compatibility_flags:[...runtime.compatibility_flags].sort(),migration_tag:runtime.migration_tag,usage_model:runtime.usage_model,bindings:[...bindings].sort((a,b)=>a.name.localeCompare(b.name)),named_handlers:named});
}

export function compatibleRecoveryConfiguration(saved,current,sourceConfiguration){
 requireValue(saved?.schema===1&&current?.schema===1,'missing retained provider configuration');
 const {version_id:a,compatibility_date:ad,compatibility_flags:af,...oldBindings}=saved;
 const {version_id:b,compatibility_date:bd,compatibility_flags:bf,...newBindings}=current;
 requireValue(recoveryConfigurationDigest(oldBindings)===recoveryConfigurationDigest(newBindings),'provider bindings or durable schema changed');
 let config;try{config=JSON.parse(sourceConfiguration?.['wrangler.jsonc']?.text);}catch{fail('source configuration JSON');}
 requireValue(config.name==='relay'&&config.compatibility_date===ad&&JSON.stringify([...config.compatibility_flags].sort())===JSON.stringify(af)&&config.migrations?.at(-1)?.tag===saved.migration_tag,'retained source/runtime configuration');
 for(const [name,text] of Object.entries(config.vars||{}))requireValue(saved.bindings.some(b=>b.name===name&&b.type==='plain_text'&&b.text===text),'retained source variable changed');
 requireValue(config.r2_buckets?.length===1&&config.r2_buckets[0].binding==='EVIDENCE'&&saved.bindings.some(b=>b.type==='r2_bucket'&&b.name==='EVIDENCE'&&b.bucket_name===config.r2_buckets[0].bucket_name),'retained archive binding');
 requireValue(config.durable_objects?.bindings?.length===1&&config.durable_objects.bindings[0].name==='RELAY_EVENTS'&&config.durable_objects.bindings[0].class_name==='RelayEvents'&&saved.bindings.some(b=>b.type==='durable_object_namespace'&&b.name==='RELAY_EVENTS'&&b.class_name==='RelayEvents'),'retained durable binding');
 return {main_module:'index.js',compatibility_date:ad,compatibility_flags:af,usage_model:saved.usage_model,bindings:saved.bindings.map(binding=>({name:binding.name,type:'inherit',version_id:b}))};
}
