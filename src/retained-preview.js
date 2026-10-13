const PREFIX='retained-preview/v1/';
const ID=/^rp_[a-f0-9]{64}$/;
const LIMIT=8*1024*1024;
const DAY=86400000;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export const RETAINED_CSP="sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
export async function previewDigest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function key(id,kind){if(!ID.test(String(id)))throw fail('Invalid retained build identity');return PREFIX+kind+'/'+id+'.json';}
export function normalizeRetainedBundle(input){
 if(input?.schema!==1||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(input.project||'')||!/^[a-f0-9]{40}$/.test(input.source_sha||'')||!/^[a-f0-9]{64}$/.test(input.build_id||'')||input.fixture_version!==1||input.data_mode!=='synthetic')throw fail('Invalid retained build provenance');
 if(!input.documents||typeof input.documents!=='object'||Array.isArray(input.documents))throw fail('Self-contained documents are required');
 const documents={};for(const entry of Object.keys(input.documents).sort()){
  if(!['app','inspector'].includes(entry)||typeof input.documents[entry]!=='string'||!input.documents[entry].trim()||input.documents[entry].includes('\u0000'))throw fail('Unsupported retained document');
  documents[entry]=input.documents[entry];
 }
 if(!documents.app||!documents.inspector)throw fail('Both app and Inspector documents are required');
 const stamp=Date.parse(input.created_at);if(!Number.isFinite(stamp))throw fail('Invalid build creation time');
 const result={schema:1,project:input.project,source_sha:input.source_sha,build_id:input.build_id,fixture_version:1,data_mode:'synthetic',created_at:new Date(stamp).toISOString(),documents};
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>LIMIT)throw fail('Retained build exceeds 8MiB',413);
 return result;
}
async function readState(bucket,id){const object=await bucket.get(key(id,'states'));return object?{value:await object.json(),etag:object.etag}:{value:{approved_at:null,updated_at:null,operation_id:null,history:[]},etag:null};}
export function previewAvailability(state,now=Date.now()){
 const approved=state?.approved_at?Date.parse(state.approved_at):null;
 if(approved!==null&&!Number.isFinite(approved))throw fail('Invalid retained approval record',503);
 const expires=approved===null?null:approved+30*DAY;
 return {state:expires===null?'pending':now>=expires?'expired':'approved',available:expires===null||now<expires,approved_at:state?.approved_at||null,expires_at:expires===null?null:new Date(expires).toISOString(),retention_days_after_approval:30};
}
export async function storeRetainedBundle(bucket,input){
 const bundle=normalizeRetainedBundle(input),text=JSON.stringify(bundle),hash=await previewDigest(text),id='rp_'+hash;
 const saved=await bucket.put(key(id,'bundles'),text,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
 if(!saved){const existing=await bucket.get(key(id,'bundles'));if(!existing||await previewDigest(await existing.text())!==hash)throw fail('Retained build identity conflict',409);}
 // Retries never reset an existing approval or extend its retention window.
 await bucket.put(key(id,'states'),JSON.stringify({approved_at:null,updated_at:new Date().toISOString(),operation_id:null,history:[]}),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
 return {ok:true,id,sha256:hash,source_sha:bundle.source_sha,build_id:bundle.build_id,reconciled:!saved};
}
export async function getRetainedBundle(bucket,id){
 const object=await bucket.get(key(id,'bundles'));if(!object)return null;
 const text=await object.text();if(new TextEncoder().encode(text).byteLength>LIMIT||await previewDigest(text)!==id.slice(3))throw fail('Retained build integrity check failed',503);
 const bundle=normalizeRetainedBundle(JSON.parse(text)),state=await readState(bucket,id);
 return {id,bundle,approval:state.value,etag:state.etag,...previewAvailability(state.value)};
}
export function retainedMetadata(record){return {ok:true,id:record.id,sha256:record.id.slice(3),project:record.bundle.project,source_sha:record.bundle.source_sha,build_id:record.bundle.build_id,created_at:record.bundle.created_at,data_mode:'synthetic',entries:Object.keys(record.bundle.documents),state:record.state,available:record.available,approved_at:record.approved_at,expires_at:record.expires_at,retention_days_after_approval:30,etag:record.etag,url:'/api/retained-preview/'+record.id+'/view'};}
export async function reviewRetainedBundle(bucket,id,input,{now=()=>new Date().toISOString()}={}){
 if(!['approve','reopen'].includes(input?.action)||!/^[a-zA-Z0-9._-]{1,100}$/.test(input.operation_id||'')||!(input.expected_etag===null||typeof input.expected_etag==='string'&&input.expected_etag.length<=160))throw fail('Explicit approval action and prior version are required');
 const record=await getRetainedBundle(bucket,id);if(!record)throw fail('Retained build not found',404);
 if(record.approval.operation_id===input.operation_id){if(record.approval.action!==input.action)throw fail('Operation identity reused for another action',409);return retainedMetadata(record);}
 if(record.etag!==input.expected_etag)throw fail('This build review changed. Refresh before applying.',409);
 const stamp=now();const next={approved_at:input.action==='approve'?(record.approved_at||stamp):null,updated_at:stamp,action:input.action,operation_id:input.operation_id,history:[...(record.approval.history||[]),{approved_at:record.approved_at,updated_at:record.approval.updated_at}].slice(-20)};
 const saved=await bucket.put(key(id,'states'),JSON.stringify(next),{onlyIf:record.etag?{etagMatches:record.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
 if(!saved)throw fail('This build review changed. Refresh before applying.',409);
 return retainedMetadata({...record,approval:next,etag:saved.etag,...previewAvailability(next)});
}
export async function readRetainedRequest(request){
 if(Number(request.headers.get('content-length')||0)>LIMIT)throw fail('Retained request exceeds 8MiB',413);
 const reader=request.body?.getReader();if(!reader)throw fail('JSON body required');const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();throw fail('Retained request exceeds 8MiB',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fail('Valid UTF-8 JSON required');}
}
export async function handleRetainedPreview(request,bucket){
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/retained-preview(?:\/(rp_[a-f0-9]{64})(?:\/(view|review))?)?$/);if(!match)return null;
 try{
  if(request.method==='POST'){
   const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Same-origin review request required'},403);
   const input=await readRetainedRequest(request);
   if(!match[1])return json(await storeRetainedBundle(bucket,input));
   if(match[2]==='review')return json(await reviewRetainedBundle(bucket,match[1],input));
  }
  if(['GET','HEAD'].includes(request.method)&&match[1]&&match[2]!=='review'){
   const record=await getRetainedBundle(bucket,match[1]);if(!record)return json({error:'Retained build not found'},404);
   if(match[2]!=='view')return json(retainedMetadata(record));
   if(!record.available)return json({...retainedMetadata(record),ok:false,error:'The 30-day approved review window ended. Reopen the build review to restore this retained copy.'},410);
   const entry=url.searchParams.get('entry')||'app';if(!Object.hasOwn(record.bundle.documents,entry))return json({error:'Unknown retained entry'},400);
   // The HTTP sandbox is enforced even when someone opens this URL directly.
   // No allow-same-origin: original code runs in an opaque origin while its URL
   // still supplies the app's expected URL syntax. No production network access.
   return new Response(request.method==='HEAD'?null:record.bundle.documents[entry],{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':RETAINED_CSP,'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Retained-Build':record.id,'X-Retained-Source-Sha':record.bundle.source_sha,'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()'}});
  }
  return json({error:'Method not allowed'},405);
 }catch(error){return json({error:error.message||'Retained preview failed'},error.status||503);}
}
