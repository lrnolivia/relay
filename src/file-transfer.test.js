import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {transferRead,transferWrite,expireTransfers,CHUNK_BYTES,MAX_TRANSFER_BYTES,transferTools} from './file-transfer.js';
const hash=data=>createHash('sha256').update(data).digest('hex');
const account={iss:'https://access.example',sub:'account-owner'};
const now=1791100000000;
class Bucket {
 objects=new Map();
 revision=0;
 async put(key,data,options={}){const current=this.objects.get(key);if(options.onlyIf?.etagDoesNotMatch==='*'&&current)return null;if(options.onlyIf?.etagMatches&&current?.etag!==options.onlyIf.etagMatches)return null;const etag=String(++this.revision);this.objects.set(key,{bytes:Buffer.from(data),etag,customMetadata:options.customMetadata});return {key,etag};}
 async get(key){const o=this.objects.get(key);return o?{etag:o.etag,text:async()=>o.bytes.toString(),arrayBuffer:async()=>o.bytes,customMetadata:o.customMetadata}:null;}
 async head(key){return this.objects.has(key)?{key}:null;}
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])this.objects.delete(key);}
 async list({prefix='',limit=1000,cursor}){const entries=[...this.objects].filter(([key])=>key.startsWith(prefix)&&(!cursor||key>cursor)).sort(([a],[b])=>a.localeCompare(b));const rows=entries.slice(0,limit);return {objects:rows.map(([key,o])=>({key,customMetadata:o.customMetadata})),truncated:entries.length>limit,cursor:entries.length>limit?rows.at(-1)[0]:undefined};}
}
const begin=(data,extra={})=>({action:'begin',request_id:'request-1',sender:'julian',recipient:'assignment-123',filename:'handoff.zip',bytes:data.length,sha256:hash(data),...extra});
async function send(data,bucket=new Bucket()){
 const args=begin(data);const result=await transferWrite(args,bucket,account,now),id=result.transfer.id;
 for(let offset=0;offset<data.length;offset+=CHUNK_BYTES){const chunk=data.subarray(offset,offset+CHUNK_BYTES);await transferWrite({action:'chunk',id,index:offset/CHUNK_BYTES,base64:chunk.toString('base64'),sha256:hash(chunk)},bucket,account,now);}
 await transferWrite({action:'complete',id},bucket,account,now);return {bucket,id,args};
}
test('temporary inbox transfers round-trip multiple chunks with separate verified receipt',async()=>{
 const data=Buffer.alloc(CHUNK_BYTES+81,17),{bucket,id}=await send(data);
 const status=await transferRead({action:'status',id},bucket,account,now);assert.equal(status.state,'ready');assert.deepEqual(status.uploaded_chunks,[0,1]);
 const chunks=[];for(let index=0;index<2;index++){const r=await transferRead({action:'chunk',id,index},bucket,account,now);const bytes=Buffer.from(r.base64,'base64');assert.equal(hash(bytes),r.sha256);chunks.push(bytes);}
 assert.deepEqual(Buffer.concat(chunks),data);
 const inbox=await transferRead({action:'inbox',address:'assignment-123'},bucket,account,now);assert.equal(inbox.transfers[0].state,'ready');assert.equal(inbox.cursor,null);
 assert.equal((await transferRead({action:'inbox',address:'someone-else'},bucket,account,now)).transfers.length,0);
 assert.equal((await transferRead({action:'outbox',address:'julian'},bucket,account,now)).transfers[0].id,id);
 const ack={action:'ack',id,recipient:'assignment-123',sha256:hash(data)};
 const receipt=await transferWrite(ack,bucket,account,now);assert.deepEqual(await transferWrite(ack,bucket,account,now+1000),receipt);
 assert.equal((await transferRead({action:'status',id},bucket,account,now)).state,'received');
});
test('retry resumes the immutable transfer and never extends its expiry',async()=>{
 const data=Buffer.from('exact bytes'),{bucket,id,args}=await send(data);
 const first=await transferWrite(args,bucket,account,now+1000);assert.equal(first.transfer.id,id);assert.equal(first.transfer.created_at,now);assert.equal(first.resumed,true);
 await assert.rejects(transferWrite({...args,filename:'different.zip'},bucket,account,now),/another transfer/);
 const other=Buffer.from('wrong bytes');await assert.rejects(transferWrite({action:'chunk',id,index:0,base64:other.toString('base64'),sha256:hash(other)},bucket,account,now),/conflicts/);
});
test('incomplete, corrupt and out-of-order chunks are safe to resume',async()=>{
 const bucket=new Bucket(),data=Buffer.alloc(CHUNK_BYTES+1,4),{transfer:{id}}=await transferWrite(begin(data),bucket,account,now);
 await assert.rejects(transferRead({action:'chunk',id,index:0},bucket,account,now),/not ready/);
 await assert.rejects(transferWrite({action:'complete',id},bucket,account,now),/Missing chunk/);
 const last=data.subarray(CHUNK_BYTES);await transferWrite({action:'chunk',id,index:1,base64:last.toString('base64'),sha256:hash(last)},bucket,account,now);
 assert.deepEqual((await transferRead({action:'status',id},bucket,account,now)).uploaded_chunks,[1]);
 await assert.rejects(transferWrite({action:'chunk',id,index:0,base64:last.toString('base64'),sha256:hash(last)},bucket,account,now),/wrong size/);
 await assert.rejects(transferWrite({action:'ack',id,recipient:'assignment-123',sha256:hash(data)},bucket,account,now),/not ready/);
});
test('cross-account access and identity/path spoofing fail closed',async()=>{
 const {bucket,id}=await send(Buffer.from('private'));
 for(const claims of [{...account,sub:'another-account'},{}])for(const action of ['status','chunk'])await assert.rejects(transferRead({action,id,index:0},bucket,claims,now),/not found|subject/);
 assert.equal((await transferRead({action:'inbox',address:'assignment-123'},bucket,{...account,sub:'another-account'},now)).transfers.length,0);
 for(const filename of ['../file','a/b','a\\b','\0file','..'])await assert.rejects(transferWrite(begin(Buffer.from('x'),{filename}),bucket,account,now),/filename/);
 await assert.rejects(transferRead({action:'status',id:'../../evidence'},bucket,account,now),/Invalid transfer/);
});
test('bounds and checksums are enforced before storage',async()=>{
 const bucket=new Bucket();for(const extra of [{bytes:0},{bytes:MAX_TRANSFER_BYTES+1},{ttl_hours:73},{ttl_hours:0},{recipient:55},{sha256:'x'}])await assert.rejects(transferWrite(begin(Buffer.from('x'),extra),bucket,account,now));
 assert.equal(bucket.objects.size,0);const {transfer:{id}}=await transferWrite(begin(Buffer.from('x')),bucket,account,now);
 await assert.rejects(transferWrite({action:'chunk',id,index:0,base64:'eA==',sha256:'0'.repeat(64)},bucket,account,now),/checksum/);
 await assert.rejects(transferWrite({action:'chunk',id,index:0,base64:'eA==\n',sha256:hash('x')},bucket,account,now),/base64/);
});
test('access expires immediately and scheduled cleanup only deletes expired transfer objects',async()=>{
 const {bucket,id}=await send(Buffer.from('expires'));
 await bucket.put('evidence/retained',Buffer.from('keep'),{customMetadata:{expires_at:String(now)}});
 const expiry=now+24*3600000;
 await assert.rejects(transferRead({action:'status',id},bucket,account,expiry),/expired/);
 assert.equal((await transferRead({action:'inbox',address:'assignment-123'},bucket,account,expiry)).transfers.length,0);
 const result=await expireTransfers(bucket,expiry);assert.equal(result.deleted,3);assert.ok(bucket.objects.has('evidence/retained'));assert.equal([...bucket.objects.keys()].filter(x=>x.startsWith('transfers/')).length,0);
});
test('read tools are marked read-only and no credentials or public links are created',()=>{
 assert.equal(transferTools[1].annotations.readOnlyHint,true);assert.equal(transferTools[0].annotations.idempotentHint,true);assert.equal(transferTools[1].inputSchema.additionalProperties,false);
});

test('real MCP entry authenticates transfer calls and exposes the two tools without public URLs',async t=>{
 const {generateKeyPairSync,sign}=await import('node:crypto');const {default:worker}=await import('./relay-entry.js');
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),kid='transfer-test';
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const claims={iss:'https://loewfi.cloudflareaccess.com',aud:['7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819'],exp:Math.floor(Date.now()/1000)+600,sub:'owner'};
 const payload=encode({alg:'RS256',kid})+'.'+encode(claims),token=payload+'.'+sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64url');
 t.mock.method(globalThis,'fetch',async url=>{assert.equal(String(url),'https://loewfi.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[{...publicKey.export({format:'jwk'}),kid}]});});
 const bucket=new Bucket();const rpc=async(method,params={},authorized=true)=>worker.fetch(new Request('https://relay.loew.fi/mcp',{method:'POST',headers:{'content-type':'application/json',...(authorized?{'cf-access-jwt-assertion':token}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),{EVIDENCE:bucket});
 assert.equal((await rpc('tools/call',{name:'relay_transfer_write',arguments:begin(Buffer.from('a'))},false)).status,401);
 const {default:entry}=await import('../apps/mcp/index.js');
 assert.equal((await entry.fetch(new Request('https://relay.loew.fi/api/files'),{EVIDENCE:bucket})).status,401);
 const listed=await entry.fetch(new Request('https://relay.loew.fi/api/files',{headers:{'cf-access-jwt-assertion':token}}),{EVIDENCE:bucket});assert.equal(listed.status,200);assert.deepEqual((await listed.json()).files,[]);
 const otherPayload=encode({alg:'RS256',kid})+'.'+encode({...claims,sub:'other-owner'}),otherToken=otherPayload+'.'+sign('RSA-SHA256',Buffer.from(otherPayload),privateKey).toString('base64url');
 const browser=async(path,method='GET',body,identity=token)=>entry.fetch(new Request('https://relay.loew.fi/api/files'+path,{method,headers:{Origin:'https://relay.loew.fi','X-Relay-File-Request':'1','Content-Type':'application/json',...(identity?{'cf-access-jwt-assertion':identity}:{})},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),{EVIDENCE:bucket});
 const created=await browser('','POST',{request_id:'signed-browser',filename:'signed.txt',bytes:1,sha256:hash('a')}),file=(await created.json()).file;assert.equal(created.status,201);
 for(const [suffix,method] of [['','PATCH'],['','DELETE'],['/restore','POST']]){
  assert.equal((await browser('/'+file.id+suffix,method,method==='PATCH'?{filename:'new.txt'}:undefined,null)).status,401);
  assert.equal((await browser('/'+file.id+suffix,method,method==='PATCH'?{filename:'new.txt'}:undefined,otherToken)).status,400);
 }
 const upload=await entry.fetch(new Request('https://relay.loew.fi/api/files/'+file.id+'/chunks/0',{method:'PUT',headers:{Origin:'https://relay.loew.fi','X-Relay-File-Request':'1','X-Content-Sha256':hash('a'),'cf-access-jwt-assertion':token},body:'a'}),{EVIDENCE:bucket});assert.equal(upload.status,200);
 assert.equal((await browser('/'+file.id+'/complete','POST')).status,200);assert.equal((await browser('/'+file.id,'PATCH',{filename:'new.txt'})).status,200);assert.equal((await browser('/'+file.id,'DELETE')).status,200);assert.equal((await browser('/'+file.id+'/restore','POST')).status,200);
 const serviceClaims={...claims,type:'app',sub:'',common_name:'a'.repeat(32)+'.access'},servicePayload=encode({alg:'RS256',kid})+'.'+encode(serviceClaims),serviceToken=servicePayload+'.'+sign('RSA-SHA256',Buffer.from(servicePayload),privateKey).toString('base64url');
 assert.deepEqual((await(await browser('','GET',undefined,serviceToken)).json()).files,[]);
 assert.equal((await browser('/'+file.id,'DELETE',undefined,serviceToken)).status,400);
 const serviceCreated=await browser('','POST',{request_id:'signed-service',filename:'service.txt',bytes:1,sha256:hash('a')},serviceToken),serviceFile=(await serviceCreated.json()).file;assert.equal(serviceCreated.status,201);
 assert.equal((await browser('/'+serviceFile.id,'DELETE')).status,400);assert.equal((await browser('/'+serviceFile.id,'DELETE',undefined,serviceToken)).status,200);assert.equal((await browser('/'+serviceFile.id+'/restore','POST',undefined,serviceToken)).status,200);
 const forged=servicePayload+'.'+token.split('.')[2];assert.equal((await browser('','GET',undefined,forged)).status,401);
 const discovery=await (await rpc('tools/list')).json();for(const name of ['relay_transfer_read','relay_transfer_write'])assert.ok(discovery.result.tools.some(tool=>tool.name===name));
 const response=await(await rpc('tools/call',{name:'relay_transfer_write',arguments:begin(Buffer.from('a'))})).json();assert.equal(response.result.structuredContent.ok,true);assert.equal(response.result.structuredContent.transfer.bytes,1);assert.equal(response.result.structuredContent.transfer.url,undefined);
});

test('whole-file verification rejects checksum mismatch and receipts cannot target another recipient',async()=>{
 const bucket=new Bucket(),data=Buffer.from('test');const bad=begin(data,{sha256:hash('different')});const {transfer:{id}}=await transferWrite(bad,bucket,account,now);
 await transferWrite({action:'chunk',id,index:0,base64:data.toString('base64'),sha256:hash(data)},bucket,account,now);
 await assert.rejects(transferWrite({action:'complete',id},bucket,account,now),/Whole-file checksum/);
 const good=await send(data);
 await assert.rejects(transferWrite({action:'ack',id:good.id,recipient:'not-addressed',sha256:hash(data)},good.bucket,account,now),/Receipt must match/);
 await assert.rejects(transferWrite({action:'ack',id:good.id,recipient:'assignment-123',sha256:hash('other')},good.bucket,account,now),/Receipt must match/);
});
test('concurrent begin calls converge on the first immutable manifest',async()=>{
 const bucket=new Bucket(),args=begin(Buffer.from('x'));const [a,b]=await Promise.all([transferWrite(args,bucket,account,now),transferWrite(args,bucket,account,now+1)]);assert.equal(a.transfer.id,b.transfer.id);assert.equal(a.transfer.expires_at,b.transfer.expires_at);assert.equal(bucket.objects.size,1);
});

import {browserFileResponse,readBrowserFiles,expireBrowserFiles,FILE_CHUNK_BYTES,MAX_FILE_BYTES} from './file-transfer.js';
const fileReq=(path='',method='GET',body,headers={})=>new Request('https://relay.loew.fi/api/files'+path,{method,headers:{Origin:'https://relay.loew.fi','X-Relay-File-Request':'1',...headers},...(body===undefined?{}:{body})});
async function browserBegin(bucket,data,extra={}){const r=await browserFileResponse(fileReq('','POST',JSON.stringify({request_id:'package-test',filename:'work.tar.gz',bytes:data.length,sha256:hash(data),...extra}),{'Content-Type':'application/json'}),bucket,account,now);return {response:r,value:await r.json()}}
async function browserUpload(bucket,data){const {value}=await browserBegin(bucket,data);const f=value.file;for(let i=0;i<f.chunks;i++){const bytes=data.subarray(i*FILE_CHUNK_BYTES,(i+1)*FILE_CHUNK_BYTES);const r=await browserFileResponse(fileReq('/'+f.id+'/chunks/'+i,'PUT',bytes,{'X-Content-Sha256':hash(bytes)}),bucket,account,now);assert.equal(r.status,200)}const complete=await browserFileResponse(fileReq('/'+f.id+'/complete','POST'),bucket,account,now);assert.equal(complete.status,200);return f}
test('browser accepts a package above the old 32 MiB limit and streams exact downloads',async()=>{
 const bucket=new Bucket(),data=Buffer.alloc(33*1024*1024+17,19),file=await browserUpload(bucket,data);
 const result=await browserFileResponse(fileReq('/'+file.id+'/download'),bucket,account,now);assert.equal(result.status,200);assert.match(result.headers.get('content-disposition'),/attachment/);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(hash(Buffer.from(await result.arrayBuffer())),file.sha256);
 const list=await readBrowserFiles({action:'files'},bucket,account,now);assert.equal(list.files[0].id,file.id);assert.equal(list.files[0].state,'ready');
 const logicalChunks=Math.ceil(data.length/CHUNK_BYTES);for(const i of [0,15,16,logicalChunks-1]){const part=await transferRead({action:'file-chunk',id:file.id,index:i},bucket,account,now);assert.ok(part.bytes<=CHUNK_BYTES);assert.deepEqual(Buffer.from(part.base64,'base64'),data.subarray(i*CHUNK_BYTES,(i+1)*CHUNK_BYTES));assert.equal(part.file_sha256,file.sha256)}
});
test('browser immutable resume rejects changed bytes, missing chunks and wrong files',async()=>{
 const bucket=new Bucket(),data=Buffer.alloc(FILE_CHUNK_BYTES+11,3),first=await browserBegin(bucket,data),id=first.value.file.id;
 const bytes=data.subarray(0,FILE_CHUNK_BYTES),put=()=>browserFileResponse(fileReq('/'+id+'/chunks/0','PUT',bytes,{'X-Content-Sha256':hash(bytes)}),bucket,account,now);
 assert.equal((await put()).status,200);assert.equal((await put()).status,200);assert.deepEqual((await browserBegin(bucket,data)).value.file.uploaded_chunks,[0]);
 assert.equal((await browserFileResponse(fileReq('/'+id+'/complete','POST'),bucket,account,now)).status,400);
 assert.equal((await browserFileResponse(fileReq('/'+id+'/download'),bucket,account,now)).status,400);
 const changed=Buffer.alloc(FILE_CHUNK_BYTES,4);assert.equal((await browserFileResponse(fileReq('/'+id+'/chunks/0','PUT',changed,{'X-Content-Sha256':hash(changed)}),bucket,account,now)).status,400);
 assert.equal((await browserBegin(bucket,data,{filename:'other.zip'})).response.status,400);
});
test('browser files preserve authentication namespace, CSRF guards, bounds, and private expiry',async()=>{
 const bucket=new Bucket(),file=await browserUpload(bucket,Buffer.from('private package'));
 assert.equal((await browserFileResponse(fileReq('/'+file.id+'/download'),bucket,{...account,sub:'other'},now)).status,400);
 assert.equal((await readBrowserFiles({action:'files'},bucket,{...account,sub:'other'},now)).files.length,0);
 assert.equal((await browserFileResponse(fileReq('/'+file.id+'/complete','POST',undefined,{Origin:'https://evil.example'}),bucket,account,now)).status,400);
 assert.equal((await browserFileResponse(fileReq('/'+file.id+'/complete','POST',undefined,{'X-Relay-File-Request':''}),bucket,account,now)).status,400);
 for(const extra of [{bytes:MAX_FILE_BYTES+1},{bytes:0},{filename:'../work'},{sha256:'bad'}])assert.equal((await browserBegin(bucket,Buffer.from('x'),extra)).response.status,400);
 const expiry=now+72*3600000;assert.equal((await browserFileResponse(fileReq('/'+file.id+'/download'),bucket,account,expiry)).status,400);
 await bucket.put('evidence/keep','stay',{customMetadata:{expires_at:String(now)}});await expireBrowserFiles(bucket,expiry);assert.ok(bucket.objects.has('evidence/keep'));assert.equal([...bucket.objects.keys()].filter(k=>k.startsWith('file-manager/')).length,0);
});

const change=(bucket,id,method,body,at=now,claims=account,headers={})=>browserFileResponse(fileReq('/'+id,method,body===undefined?undefined:JSON.stringify(body),{'Content-Type':'application/json',...headers}),bucket,claims,at);
const restore=(bucket,id,at=now)=>browserFileResponse(fileReq('/'+id+'/restore','POST'),bucket,account,at);
test('ready rename changes the displayed/download filename while immutable bytes, resume identity and expiry survive',async()=>{
 const bucket=new Bucket(),data=Buffer.from('verified package'),file=await browserUpload(bucket,data);
 const immutableBefore=[...bucket.objects].map(([key,o])=>[key,hash(o.bytes)]);
 const list=await readBrowserFiles({action:'files'},bucket,account,now);assert.deepEqual(list.capabilities,{rename:true,delete:true,restore:true});assert.deepEqual(list.file_policy,{rename:'ready_only',deletion:'soft',restore_until:'original_expiry'});
 const renamed=await change(bucket,file.id,'PATCH',{filename:'Sienna résumé.zip'},now+1000);assert.equal(renamed.status,200);const value=(await renamed.json()).file;
 assert.equal(value.filename,'Sienna résumé.zip');for(const key of ['id','sha256','bytes','created_at','expires_at','chunk_bytes','chunks'])assert.equal(value[key],file[key]);
 assert.equal((await browserBegin(bucket,data)).value.file.filename,value.filename);
 assert.equal((await readBrowserFiles({action:'file-status',id:file.id},bucket,account,now)).file.filename,value.filename);
 const download=await browserFileResponse(fileReq('/'+file.id+'/download'),bucket,account,now);assert.ok(download.headers.get('Content-Disposition').includes(encodeURIComponent(value.filename)));assert.equal(hash(Buffer.from(await download.arrayBuffer())),file.sha256);
 for(const [key,sha] of immutableBefore)assert.equal(hash(bucket.objects.get(key).bytes),sha);
 const revision=bucket.revision;assert.equal((await change(bucket,file.id,'PATCH',{filename:value.filename})).status,200);assert.equal(bucket.revision,revision);
});
test('soft delete hides every new read/write and restore recovers the same ready file until its original expiry',async()=>{
 const bucket=new Bucket(),data=Buffer.from('restore original bytes'),file=await browserUpload(bucket,data);
 const deleted=await change(bucket,file.id,'DELETE',undefined,now+1000);assert.equal(deleted.status,200);const tombstone=await deleted.json();assert.deepEqual(tombstone,{ok:true,id:file.id,deleted_at:now+1000,recoverable_until:file.expires_at,delete_mode:'soft'});
 const revision=bucket.revision;assert.deepEqual(await(await change(bucket,file.id,'DELETE',undefined,now+2000)).json(),tombstone);assert.equal(bucket.revision,revision);
 assert.deepEqual((await readBrowserFiles({action:'files'},bucket,account,now)).files,[]);
 for(const [path,method,body,headers] of [[file.id,'GET'],[file.id+'/status','GET'],[file.id+'/download','GET'],[file.id+'/download','HEAD'],[file.id+'/complete','POST'],[file.id+'/chunks/0','PUT',data,{'X-Content-Sha256':hash(data)}]]){
  const r=await browserFileResponse(fileReq('/'+path,method,body,headers),bucket,account,now);assert.equal(r.status,410);assert.equal((await r.json()).code,'file_deleted');
 }
 for(const action of ['file-status','file-chunk'])await assert.rejects(readBrowserFiles({action,id:file.id,index:0},bucket,account,now),e=>e.code==='file_deleted');
 assert.equal((await browserBegin(bucket,data)).response.status,410);assert.equal((await change(bucket,file.id,'PATCH',{filename:'new.zip'})).status,410);
 assert.equal((await restore(bucket,file.id,now+3000)).status,200);const restored=(await readBrowserFiles({action:'files'},bucket,account,now)).files[0];assert.equal(restored.expires_at,file.expires_at);assert.equal(restored.sha256,file.sha256);
 const restoredRevision=bucket.revision;assert.equal((await restore(bucket,file.id)).status,200);assert.equal(bucket.revision,restoredRevision);
 const download=await browserFileResponse(fileReq('/'+file.id+'/download'),bucket,account,now);assert.deepEqual(Buffer.from(await download.arrayBuffer()),data);
 await change(bucket,file.id,'DELETE');assert.equal((await restore(bucket,file.id,file.expires_at)).status,400);
 await expireBrowserFiles(bucket,file.expires_at);assert.equal([...bucket.objects.keys()].filter(k=>k.startsWith('file-manager/')).length,0);
});
test('incomplete uploads cannot rename, can be hidden and resume unchanged after restore',async()=>{
 const bucket=new Bucket(),data=Buffer.from('incomplete'),{value:{file}}=await browserBegin(bucket,data);
 const rename=await change(bucket,file.id,'PATCH',{filename:'changed.zip'});assert.equal(rename.status,409);assert.equal((await rename.json()).code,'file_incomplete');
 await change(bucket,file.id,'DELETE');assert.equal((await browserBegin(bucket,data)).response.status,410);
 assert.equal((await restore(bucket,file.id)).status,200);assert.equal((await browserBegin(bucket,data)).value.file.filename,file.filename);
 await browserUpload(bucket,data);assert.equal((await change(bucket,file.id,'PATCH',{filename:'completed.zip'})).status,200);
});
test('new mutations keep private account namespace and actual Origin/request guards and bounded filename-only JSON',async()=>{
 const bucket=new Bucket(),file=await browserUpload(bucket,Buffer.from('isolation')),initial=bucket.revision;
 for(const claims of [{...account,sub:'another-account'},{...account,iss:'https://another-issuer'},{}])for(const method of ['PATCH','DELETE'])assert.equal((await change(bucket,file.id,method,method==='PATCH'?{filename:'intrusion.zip'}:undefined,now,claims)).status,400);
 const crossRestore=await browserFileResponse(fileReq('/'+file.id+'/restore','POST'),bucket,{...account,sub:'another-account'},now);assert.equal(crossRestore.status,400);
 for(const suffix of ['', '/restore'])for(const method of suffix?['POST']:['PATCH','DELETE'])for(const headers of [{Origin:'https://evil.example'},{Origin:''},{'X-Relay-File-Request':''}])assert.equal((await browserFileResponse(fileReq('/'+file.id+suffix,method,method==='PATCH'?JSON.stringify({filename:'safe.zip'}):undefined,{'Content-Type':'application/json',...headers}),bucket,account,now)).status,400);
 for(const body of [null,[],{filename:'safe.zip',expires_at:now+1},{filename:'../file'},{filename:'a\\b'},{filename:'\u0000file'},{filename:'..'},{filename:''},{filename:'x'.repeat(181)}])assert.equal((await change(bucket,file.id,'PATCH',body)).status,400);
 for(const [body,type] of [[JSON.stringify({filename:'safe.zip'}),'text/plain'],['x'.repeat(4097),'application/json'],['{broken','application/json']])assert.equal((await browserFileResponse(fileReq('/'+file.id,'PATCH',body,{'Content-Type':type}),bucket,account,now)).status,400);
 assert.equal(bucket.revision,initial);
 assert.equal((await change(bucket,file.id,'PATCH',{filename:'ctrl-authorized.zip'},now,account,{Origin:'https://ctrl.loew.fi'})).status,200);
});
test('metadata CAS re-reads a concurrent delete instead of resurrecting stale rename state',async()=>{
 const bucket=new Bucket(),file=await browserUpload(bucket,Buffer.from('race')),put=bucket.put.bind(bucket);let raced=false;
 bucket.put=async(key,data,options)=>{if(key.endsWith('/metadata.json')&&!raced){raced=true;await put(key,JSON.stringify({deleted_at:now+123}),{customMetadata:options.customMetadata});}return put(key,data,options)};
 const response=await change(bucket,file.id,'PATCH',{filename:'stale.zip'});assert.equal(response.status,410);assert.deepEqual((await readBrowserFiles({action:'files'},bucket,account,now)).files,[]);
 const restored=await restore(bucket,file.id);assert.equal(restored.status,200);assert.equal((await restored.json()).file.filename,file.filename);
});
test('CAS reconciles a concurrent rename on delete and stops after three conflicts',async()=>{
 const bucket=new Bucket(),file=await browserUpload(bucket,Buffer.from('race')),put=bucket.put.bind(bucket);let raced=false;
 bucket.put=async(key,data,options)=>{if(key.endsWith('/metadata.json')&&!raced){raced=true;await put(key,JSON.stringify({filename:'concurrent.zip'}),{customMetadata:options.customMetadata});}return put(key,data,options)};
 assert.equal((await change(bucket,file.id,'DELETE')).status,200);const restored=await restore(bucket,file.id);assert.equal((await restored.json()).file.filename,'concurrent.zip');
 let attempts=0;bucket.put=async(key,data,options)=>{if(key.endsWith('/metadata.json')){attempts++;return null}return put(key,data,options)};
 const conflict=await change(bucket,file.id,'DELETE');assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'file_conflict');assert.equal(attempts,3);
 assert.equal((await readBrowserFiles({action:'files'},bucket,account,now)).files[0].filename,'concurrent.zip');
});
test('verified service file namespaces remain disjoint from humans and other services; legacy transfers still require a user',async()=>{
 const bucket=new Bucket(),human=await browserUpload(bucket,Buffer.from('human'));
 const service={iss:account.iss,type:'app',sub:'',common_name:'a'.repeat(32)+'.access'},other={...service,common_name:'b'.repeat(32)+'.access'},data=Buffer.from('service');
 const request=fileReq('','POST',JSON.stringify({request_id:'service-fixture',filename:'service.txt',bytes:data.length,sha256:hash(data)}),{'Content-Type':'application/json'}),r=await browserFileResponse(request,bucket,service,now);assert.equal(r.status,201);const {file}=await r.json();
 assert.equal((await change(bucket,human.id,'DELETE',undefined,now,service)).status,400);
 for(const identity of [account,other,{...account,sub:'service\0'+service.common_name}, {...account,sub:service.common_name}])assert.equal((await change(bucket,file.id,'DELETE',undefined,now,identity)).status,400);
 assert.equal((await readBrowserFiles({action:'files'},bucket,service,now)).files[0].id,file.id);assert.equal((await readBrowserFiles({action:'files'},bucket,other,now)).files.length,0);
 assert.ok([...bucket.objects.keys()].some(key=>key.startsWith('file-manager/v1/svc_')));
 for(const invalid of [{...service,type:'org'},{...service,sub:undefined},{...service,common_name:'../spoof'},{...service,common_name:undefined},{...service,common_name:[service.common_name]},{...service,common_name:{client:service.common_name}}])assert.equal((await browserFileResponse(fileReq(),bucket,invalid,now)).status,400);
 await assert.rejects(transferWrite(begin(Buffer.from('x')),bucket,service,now),/subject/);
});
