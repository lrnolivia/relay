import { sourceRevision, reviewKey, reviewStates } from '../../shared-ui/work-view-model.js';
const safeId=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/;
const error=(message,status=400)=>Object.assign(new Error(message),{status});
function identity(item) {
  if(!item || !safeId.test(item.project) || !safeId.test(item.id) || !['assignment','evidence','check'].includes(item.kind)) throw error('Invalid review identity.');
  return 'work-review/v1/'+reviewKey(item)+'.json';
}
export async function readWorkReview(bucket,item) {
  if(!bucket?.get) throw error('Review storage unavailable.',503);
  const object=await bucket.get(identity(item));
  if(!object) return {record:null,etag:null};
  return {record:await object.json(),etag:object.etag};
}
export async function writeWorkReview(bucket,item,resolveSource,{now=()=>new Date().toISOString()}={}) {
  const key=identity(item);
  if(!reviewStates.includes(item.status) || typeof item.archived!=='boolean' || !/^[a-f0-9]{64}$/.test(item.source_revision||'') || !safeId.test(item.operation_id||'')) throw error('Invalid review change.');
  if(item.expected_etag!==null && (typeof item.expected_etag!=='string'||item.expected_etag.length>160)) throw error('An exact prior review version is required.');
  const source=await resolveSource(item);
  if(!source) throw error('The source item is no longer available.',404);
  if(await sourceRevision(source)!==item.source_revision) throw error('The source changed. Refresh before reviewing this version.',409);
  const previous=await readWorkReview(bucket,item);
  if(previous.record?.operation_id===item.operation_id) {
    if(previous.record.source_revision!==item.source_revision || previous.record.status!==item.status || previous.record.archived!==item.archived) throw error('Operation identity was reused for another change.',409);
    return previous;
  }
  if(previous.etag!==item.expected_etag) throw error('Another review changed this item. Refresh before applying or undoing.',409);
  const stamp=now();
  const history=previous.record ? [...(previous.record.history||[]),{source_revision:previous.record.source_revision,status:previous.record.status,archived:previous.record.archived,updated_at:previous.record.updated_at}].slice(-50):[];
  const record={schema:1,project:item.project,kind:item.kind,id:item.id,source_revision:item.source_revision,status:item.status,archived:item.archived,operation_id:item.operation_id,updated_at:stamp,history};
  const written=await bucket.put(key,JSON.stringify(record),{onlyIf:previous.etag?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
  if(!written) throw error('Another review changed this item. Refresh before applying or undoing.',409);
  return {record,etag:written.etag};
}
export async function reviewBatch(bucket,input,resolveSource) {
  if(!input || !['read','set'].includes(input.action) || !Array.isArray(input.items) || !input.items.length || input.items.length>100) throw error('Provide 1–100 review identities and a supported action.');
  const seen=new Set();
  for(const item of input.items) {const key=identity(item);if(seen.has(key))throw error('Duplicate review identity.');seen.add(key);}
  const results=[];
  // Bounded concurrency avoids hundreds of simultaneous provider reads/writes.
  for(let start=0;start<input.items.length;start+=4) results.push(...await Promise.all(input.items.slice(start,start+4).map(async item=>{
    try {return {key:reviewKey(item),ok:true,...await(input.action==='read'?readWorkReview(bucket,item):writeWorkReview(bucket,item,resolveSource))};}
    catch(cause){return {key:reviewKey(item),ok:false,status:cause.status||503,error:cause.message};}
  })));
  return {ok:results.every(result=>result.ok),results};
}
