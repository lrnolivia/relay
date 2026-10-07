import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Uses only a uniquely identified synthetic file. Mutations are single attempts;
// an uncertain failure is recorded, never silently replayed.
export async function verifyFileLifecycle(fetcher,{requestId,unauthenticatedFetcher}={}){
 const bytes=Buffer.from('Relay synthetic Files lifecycle verification.');
 const checksum=createHash('sha256').update(bytes).digest('hex');
 const receipt={kind:'synthetic-file-lifecycle',ok:false,checks:[],checksum,bytes:bytes.length};
 let id;
 const call=async(path,method='GET',body,extra={},status=200)=>{
  const response=await fetcher('/api/files'+path,{method,headers:{Origin:'https://relay.loew.fi','X-Relay-File-Request':'1',...extra},...(body===undefined?{}:{body}),signal:AbortSignal.timeout(15000)});
  receipt.checks.push({path:id?path.replace(id,':fixture'):path,method,status:response.status});
  assert.equal(response.status,status,'Synthetic Files '+method+' '+path);
  return response;
 };
 const json=async(...args)=>(await call(...args)).json();
 const rename=name=>json('/'+id,'PATCH',JSON.stringify({filename:name}),{'Content-Type':'application/json'});
 try{
  const inventory=await json('');assert.deepEqual(inventory.capabilities,{rename:true,delete:true,restore:true});assert.deepEqual(inventory.file_policy,{rename:'ready_only',deletion:'soft',restore_until:'original_expiry'});
  const created=await json('','POST',JSON.stringify({request_id:requestId,filename:'relay-verification.txt',bytes:bytes.length,sha256:checksum}),{'Content-Type':'application/json'},201);id=created.file.id;assert.match(id,/^fl_[a-f0-9]{32}$/);const expiry=created.file.expires_at;
  if(unauthenticatedFetcher)for(const [suffix,method] of [['','PATCH'],['','DELETE'],['/restore','POST']]){
   const denied=await unauthenticatedFetcher('/api/files/'+id+suffix,{method,redirect:'manual',headers:{Origin:'https://relay.loew.fi','X-Relay-File-Request':'1','Content-Type':'application/json'},...(method==='PATCH'?{body:JSON.stringify({filename:'denied.txt'})}:{}),signal:AbortSignal.timeout(15000)});
   if(denied.status===302){const login=new URL(denied.headers.get('Location'));assert.ok(login.hostname.endsWith('.cloudflareaccess.com')&&login.pathname.startsWith('/cdn-cgi/access/login'),'Redirect must be the Access login boundary');}
   else assert.ok([401,403].includes(denied.status),'Unauthenticated mutation must be denied');
   receipt.checks.push({path:':fixture'+suffix,method,status:denied.status,authenticated:false});
  }
  const incomplete=await json('/'+id,'PATCH',JSON.stringify({filename:'incomplete.txt'}),{'Content-Type':'application/json'},409);assert.equal(incomplete.code,'file_incomplete');
  await call('/'+id+'/chunks/0','PUT',bytes,{'X-Content-Sha256':checksum});await json('/'+id+'/complete','POST');
  const renamed=await rename('relay-verification-renamed.txt');assert.equal(renamed.file.filename,'relay-verification-renamed.txt');assert.equal(renamed.file.sha256,checksum);assert.equal(renamed.file.expires_at,expiry);
  for(const extra of [{Origin:'https://invalid.example'},{'X-Relay-File-Request':''}])await call('/'+id,'PATCH',JSON.stringify({filename:'denied.txt'}),{'Content-Type':'application/json',...extra},400);
  const deleted=await json('/'+id,'DELETE');assert.equal(deleted.delete_mode,'soft');assert.equal(deleted.recoverable_until,expiry);
  const hidden=await json('/'+id+'/status','GET',undefined,{},410);assert.equal(hidden.code,'file_deleted');
  assert.equal((await json('')).files.some(file=>file.id===id),false);
  const repeated=await json('/'+id,'DELETE');assert.equal(repeated.deleted_at,deleted.deleted_at);
  const restored=await json('/'+id+'/restore','POST');assert.equal(restored.file.filename,renamed.file.filename);assert.equal(restored.file.expires_at,expiry);
  const download=await call('/'+id+'/download');assert.ok(download.headers.get('Content-Disposition').includes(renamed.file.filename));assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'),checksum);
  await json('/'+id+'/restore','POST');receipt.original_expiry=expiry;receipt.ok=true;
 }catch(error){error.receipt=receipt;throw error;}
 finally{
  if(id){try{const response=await call('/'+id,'DELETE');receipt.cleanup={status:response.status,mode:'soft',retained_until_original_expiry:true};}catch(error){receipt.ok=false;receipt.cleanup={status:'failed'};throw Object.assign(Error('Synthetic Files cleanup failed'),{receipt,cause:error});}}
 }
 return receipt;
}
