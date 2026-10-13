const ID=/^vis_[a-zA-Z0-9-]{8,128}$/;
export const EVIDENCE_INDEX_PREFIX='evidence-index/v1/';
export function evidenceIndexKey(id){if(!ID.test(String(id)))throw Error('Invalid evidence id');return EVIDENCE_INDEX_PREFIX+'id/'+id+'.json';}
export async function readEvidenceIndex(bucket,id){
 const object=await bucket.get(evidenceIndexKey(id));if(!object)return null;
 try {const record=await object.json();return record?.evidence_id===id&&typeof record.metadata_key==='string'&&record.metadata_key.startsWith('visual/')?record:null;}catch{return null;}
}
export async function writeEvidenceIndex(bucket,record){
 const time=Date.parse(record.captured_at);if(!Number.isFinite(time)||time<0||time>=9999999999999)throw Error('Invalid capture time');
 const idKey=evidenceIndexKey(record.evidence_id),recentKey=EVIDENCE_INDEX_PREFIX+'recent/'+String(9999999999999-time).padStart(13,'0')+'-'+record.evidence_id+'.json';
 const body=JSON.stringify(record),options={httpMetadata:{contentType:'application/json; charset=utf-8',cacheControl:'private, no-store'}};
 const indexedBody=JSON.stringify({...record,_catalog_version:2});
 // Publish a discoverable fallback before the project index. Only mark it
 // project-indexed after that write succeeds, and publish the direct index last.
 await bucket.put(recentKey,body,options);
 const project=record.context?.project;
 if(typeof project==='string'&&/^[a-z0-9][a-z0-9._-]{0,79}$/.test(project)) {
  await bucket.put(EVIDENCE_INDEX_PREFIX+'project/'+project+'/'+recentKey.split('/').at(-1),indexedBody,options);
  await bucket.put(recentKey,indexedBody,options);
 }
 await bucket.put(idKey,body,options);
}
export async function readRecentEvidenceIndex(bucket,limit=200){
 const page=await bucket.list({prefix:EVIDENCE_INDEX_PREFIX+'recent/',limit});const records=[];
 for(let offset=0;offset<(page.objects||[]).length;offset+=20){
  const part=await Promise.all(page.objects.slice(offset,offset+20).map(async item=>{try{const object=await bucket.get(item.key);return object?await object.json():null;}catch{return null;}}));
  records.push(...part.filter(record=>record&&ID.test(record.evidence_id)&&Number.isFinite(Date.parse(record.captured_at))).map(({_catalog_version,...record})=>record));
 }
 return {records,truncated:Boolean(page.truncated)||records.length!==(page.objects||[]).length};
}
