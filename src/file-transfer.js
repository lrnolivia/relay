import {createHash} from 'node:crypto';

export const CHUNK_BYTES=256*1024;
export const MAX_TRANSFER_BYTES=32*1024*1024;
const PREFIX='transfers/v1/';
const CURSOR_KEY='transfer-maintenance/v1/expiry-cursor.json';
const digest=value=>createHash('sha256').update(value).digest('hex');
const validId=value=>typeof value==='string'&&/^tr_[a-f0-9]{32}$/.test(value);
const hashPattern=/^[a-f0-9]{64}$/;
const isLabel=value=>typeof value==='string'&&labelPattern.test(value);
const labelPattern=/^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{0,127}$/;
function requireValue(condition,message){if(!condition)throw Error(message);}
function principal(claims){requireValue(typeof claims?.sub==='string'&&claims.sub.length>0&&claims.sub.length<=512,'An authenticated subject is required');return digest(claims.iss+'\0'+claims.sub);}
const prefix=(owner,id)=>PREFIX+owner+'/'+id+'/';
const readJson=async(bucket,key)=>{const item=await bucket.get(key);return item?JSON.parse(await item.text()):null;};
async function immutable(bucket,key,value,expires){
 const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(value);
 const written=await bucket.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{expires_at:String(expires)}});
 if(written)return;
 const previous=await bucket.get(key);
 requireValue(previous&&digest(Buffer.from(await previous.arrayBuffer()))===digest(bytes),'Transfer conflicts with an existing immutable object');
}
async function manifest(bucket,owner,id,now){
 requireValue(validId(id),'Invalid transfer ID');
 const item=await readJson(bucket,prefix(owner,id)+'manifest.json');
 requireValue(item&&item.owner===owner,'Transfer not found');
 requireValue(item.expires_at>now,'Transfer expired');return item;
}
function publicManifest(meta){const {owner,...rest}=meta;return rest;}
function chunkIndex(meta,index){requireValue(Number.isInteger(index)&&index>=0&&index<meta.chunks,'Invalid chunk index');return String(index).padStart(4,'0');}
const chunkKey=(meta,index)=>prefix(meta.owner,meta.id)+'chunks/'+chunkIndex(meta,index);
function base64(value){
 requireValue(typeof value==='string'&&value.length<=Math.ceil(CHUNK_BYTES/3)*4&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'Invalid or oversized base64 chunk');
 const bytes=Buffer.from(value,'base64');requireValue(bytes.toString('base64')===value,'Non-canonical base64 chunk');return bytes;
}
export async function transferWrite(args,bucket,claims,now=Date.now()){
 requireValue(bucket&&typeof bucket.put==='function','Temporary storage is unavailable');
 const owner=principal(claims);requireValue(args&&typeof args==='object','Transfer arguments required');
 if(args.action==='begin'){
  requireValue(isLabel(args.request_id),'A stable request ID is required for safe retries');
  requireValue(isLabel(args.sender)&&isLabel(args.recipient),'Sender and recipient routing labels required');
  requireValue(typeof args.filename==='string'&&args.filename.length<=180&&args.filename.length>0&&!/[\x00-\x1f\x7f/\\]/.test(args.filename)&&!['.','..'].includes(args.filename),'Use a filename without path separators');
  requireValue(Number.isInteger(args.bytes)&&args.bytes>0&&args.bytes<=MAX_TRANSFER_BYTES,'Transfer must be between 1 byte and 32 MiB');
  requireValue(hashPattern.test(args.sha256||''),'A whole-file SHA-256 checksum is required');
  const ttl=args.ttl_hours??24;requireValue(Number.isInteger(ttl)&&ttl>=1&&ttl<=72,'Expiry must be 1–72 hours');
  const id='tr_'+digest(owner+'\0'+args.request_id).slice(0,32),key=prefix(owner,id)+'manifest.json';
  const existing=await readJson(bucket,key);
  const properties={id,owner,filename:args.filename,bytes:args.bytes,sha256:args.sha256,sender:args.sender,recipient:args.recipient,ttl_hours:ttl,chunk_bytes:CHUNK_BYTES,chunks:Math.ceil(args.bytes/CHUNK_BYTES)};
  if(existing){requireValue(existing.expires_at>now,'Transfer expired; use a new request ID');requireValue(Object.entries(properties).every(([k,v])=>existing[k]===v),'Request ID already belongs to another transfer');return {ok:true,transfer:publicManifest(existing),resumed:true};}
  const meta={...properties,created_at:now,expires_at:now+ttl*3600000};
  // Concurrent identical begin calls can choose slightly different timestamps. The first wins.
  const stored=await bucket.put(key,JSON.stringify(meta),{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{expires_at:String(meta.expires_at)}});
  if(!stored)return transferWrite(args,bucket,claims,now);
  return {ok:true,transfer:publicManifest(meta),resumed:false};
 }
 const meta=await manifest(bucket,owner,args.id,now),root=prefix(owner,args.id);
 if(args.action==='chunk'){
  const key=chunkKey(meta,args.index),bytes=base64(args.base64);
  requireValue(bytes.length===Math.min(CHUNK_BYTES,meta.bytes-args.index*CHUNK_BYTES),'Chunk has the wrong size');
  requireValue(hashPattern.test(args.sha256||'')&&digest(bytes)===args.sha256,'Chunk checksum mismatch');
  await immutable(bucket,key,bytes,meta.expires_at);return {ok:true,id:meta.id,index:args.index,bytes:bytes.length,sha256:args.sha256};
 }
 if(args.action==='complete'){
  const hash=createHash('sha256');let size=0;
  for(let index=0;index<meta.chunks;index++){
   const item=await bucket.get(chunkKey(meta,index));requireValue(item,'Missing chunk '+index);
   const bytes=Buffer.from(await item.arrayBuffer());requireValue(bytes.length===Math.min(CHUNK_BYTES,meta.bytes-index*CHUNK_BYTES),'Stored chunk size mismatch');hash.update(bytes);size+=bytes.length;
  }
  requireValue(size===meta.bytes&&hash.digest('hex')===meta.sha256,'Whole-file checksum mismatch');
  await immutable(bucket,root+'ready.json',JSON.stringify({id:meta.id,sha256:meta.sha256,bytes:meta.bytes}),meta.expires_at);
  return {ok:true,transfer:publicManifest(meta),state:'ready'};
 }
 if(args.action==='ack'){
  requireValue(await readJson(bucket,root+'ready.json'),'Transfer is not ready');
  requireValue(args.recipient===meta.recipient&&args.sha256===meta.sha256,'Receipt must match the intended routing label and verified file checksum');
  const key=root+'receipt.json',existing=await readJson(bucket,key);
  if(existing)return {ok:true,receipt:existing};
  const receipt={id:meta.id,recipient:meta.recipient,sha256:meta.sha256,bytes:meta.bytes,received_at:now,identity_scope:'same authenticated account; recipient is a routing label'};
  const stored=await bucket.put(key,JSON.stringify(receipt),{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{expires_at:String(meta.expires_at)}});
  return {ok:true,receipt:stored?receipt:await readJson(bucket,key)};
 }
 throw Error('Unknown transfer write action');
}
export async function transferRead(args,bucket,claims,now=Date.now()){
 if(['files','file-status','file-chunk'].includes(args.action))return readBrowserFiles(args,bucket,claims,now);
 requireValue(bucket&&typeof bucket.get==='function','Temporary storage is unavailable');const owner=principal(claims);
 if(['inbox','outbox'].includes(args.action)){
  requireValue(isLabel(args.address),'A routing address is required');requireValue(args.cursor==null||(typeof args.cursor==='string'&&args.cursor.length<=4096),'Invalid inbox cursor');
  const page=await bucket.list({prefix:PREFIX+owner+'/',limit:200,...(args.cursor?{cursor:args.cursor}:{})});const transfers=[];
  for(const object of page.objects){if(!object.key.endsWith('/manifest.json'))continue;const meta=await readJson(bucket,object.key);if(!meta||meta.expires_at<=now||meta[args.action==='inbox'?'recipient':'sender']!==args.address)continue;
   const root=prefix(owner,meta.id),ready=await readJson(bucket,root+'ready.json'),receipt=await readJson(bucket,root+'receipt.json');transfers.push({...publicManifest(meta),state:receipt?'received':ready?'ready':'uploading'});
  }
  return {ok:true,transfers,cursor:page.truncated?page.cursor:null};
 }
 const meta=await manifest(bucket,owner,args.id,now),root=prefix(owner,args.id);
 if(args.action==='status'){
  const present=[];for(let index=0;index<meta.chunks;index++)if(await bucket.head(chunkKey(meta,index)))present.push(index);
  const ready=await readJson(bucket,root+'ready.json'),receipt=await readJson(bucket,root+'receipt.json');
  return {ok:true,transfer:publicManifest(meta),state:receipt?'received':ready?'ready':'uploading',uploaded_chunks:present,receipt};
 }
 if(args.action==='chunk'){
  requireValue(await readJson(bucket,root+'ready.json'),'Transfer is not ready');const item=await bucket.get(chunkKey(meta,args.index));requireValue(item,'Chunk not found');const bytes=Buffer.from(await item.arrayBuffer());
  return {ok:true,id:meta.id,index:args.index,base64:bytes.toString('base64'),bytes:bytes.length,sha256:digest(bytes),file_sha256:meta.sha256};
 }
 throw Error('Unknown transfer read action');
}
export async function expireTransfers(bucket,now=Date.now()){
 if(!bucket)return {scanned:0,deleted:0};let cursor=(await readJson(bucket,CURSOR_KEY))?.cursor;let scanned=0,deleted=0;
 // A persistent scan cursor gives later prefixes a turn even with a large inbox.
 for(let pageNumber=0;pageNumber<8;pageNumber++){
  const page=await bucket.list({prefix:PREFIX,limit:1000,include:['customMetadata'],...(cursor?{cursor}:{})});scanned+=page.objects.length;
  const expired=page.objects.filter(item=>Number(item.customMetadata?.expires_at)>0&&Number(item.customMetadata.expires_at)<=now).map(item=>item.key);
  for(let offset=0;offset<expired.length;offset+=100){const keys=expired.slice(offset,offset+100);await bucket.delete(keys);deleted+=keys.length;}
  cursor=page.truncated?page.cursor:null;await bucket.put(CURSOR_KEY,JSON.stringify({cursor}));if(!cursor)break;
 }
 return {scanned,deleted,cursor:cursor||null};
}

const properties={action:{type:'string'},id:{type:'string',pattern:'^tr_[a-f0-9]{32}$'},index:{type:'integer',minimum:0,maximum:127},request_id:{type:'string',maxLength:128},sender:{type:'string',maxLength:128},recipient:{type:'string',maxLength:128},filename:{type:'string',maxLength:180},bytes:{type:'integer',minimum:1,maximum:MAX_TRANSFER_BYTES},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},ttl_hours:{type:'integer',minimum:1,maximum:72},base64:{type:'string',maxLength:Math.ceil(CHUNK_BYTES/3)*4},address:{type:'string',maxLength:128},cursor:{type:'string',maxLength:4096}};
export const transferTools=[
 {name:'relay_transfer_write',title:'Send or acknowledge a temporary file',description:'Private same-account inbox/outbox. Begin with a stable request_id, sender/recipient routing labels, filename, bytes and SHA-256. Upload fixed 256 KiB chunks (last may be shorter), then complete to verify the entire file. Acknowledge only after downloading and independently verifying the whole file checksum. Retries are immutable and bounded. Labels do not grant access across accounts. Expires after 24 hours by default, up to 72 hours. Never send credentials.',inputSchema:{type:'object',properties:{...properties,action:{type:'string',enum:['begin','chunk','complete','ack']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'relay_transfer_read',title:'Read temporary files and transfer receipts',description:'Read same-authenticated-account temporary transfers. Browser file manager uploads: action files lists private files with cursor; file-status uses fl_ ID; file-chunk downloads fixed 256 KiB indexed slices and whole-file checksum (up to 512 MiB). Verify the complete checksum before using downloaded content. Inbox/outbox require an address routing label; paginate with cursor until null. Status reports uploaded chunks for resume. Chunk returns bounded base64 only after complete verification. Download every chunk, verify chunk and whole-file SHA-256 before acknowledging. Transfer IDs are not public download links.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['inbox','outbox','status','chunk','files','file-status','file-chunk']},id:{type:'string',pattern:'^(tr|fl)_[a-f0-9]{32}$'},index:{type:'integer',minimum:0,maximum:2047},address:properties.address,cursor:properties.cursor},required:['action'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];

// Browser packages are streamed in bounded chunks, separately from the MCP envelopes.
export const FILE_CHUNK_BYTES=4*1024*1024;
export const MAX_FILE_BYTES=512*1024*1024;
const FILE_PREFIX='file-manager/v1/';
const fileId=value=>typeof value==='string'&&/^fl_[a-f0-9]{32}$/.test(value);
const fileRoot=(owner,id)=>FILE_PREFIX+owner+'/'+id+'/';
async function fileMeta(bucket,owner,id,now){
 requireValue(fileId(id),'Invalid file ID');
 const meta=await readJson(bucket,fileRoot(owner,id)+'manifest.json');
 requireValue(meta&&meta.owner===owner&&meta.expires_at>now,'File not found or expired');return meta;
}
async function fileStatus(bucket,meta,details=false){
 const root=fileRoot(meta.owner,meta.id),ready=await readJson(bucket,root+'ready.json');
 const out={...publicManifest(meta),state:ready?'ready':'uploading'};
 if(details){out.uploaded_chunks=[];for(let i=0;i<meta.chunks;i++)if(await bucket.head(root+'chunks/'+i))out.uploaded_chunks.push(i)}
 return out;
}
async function limitedBytes(request,max){
 const length=Number(request.headers.get('content-length'));
 requireValue(!length||length<=max,'Request is too large');
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Request is too large')}chunks.push(value)}}finally{reader.releaseLock()}
 const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length}return out;
}
export async function readBrowserFiles(args,bucket,claims,now=Date.now()){
 const owner=principal(claims);requireValue(bucket,'File storage unavailable');
 if(args.action==='files'){
  requireValue(args.cursor==null||(typeof args.cursor==='string'&&args.cursor.length<=4096),'Invalid cursor');
  const page=await bucket.list({prefix:FILE_PREFIX+owner+'/',limit:300,...(args.cursor?{cursor:args.cursor}:{})});const files=[];
  for(const item of page.objects){if(!item.key.endsWith('/manifest.json'))continue;const meta=await readJson(bucket,item.key);if(meta?.owner===owner&&meta.expires_at>now)files.push(await fileStatus(bucket,meta));}
  return {ok:true,files,cursor:page.truncated?page.cursor:null,max_bytes:MAX_FILE_BYTES,chunk_bytes:FILE_CHUNK_BYTES};
 }
 const meta=await fileMeta(bucket,owner,args.id,now);
 if(args.action==='file-status')return {ok:true,file:await fileStatus(bucket,meta,true)};
 requireValue(args.action==='file-chunk','Unknown file read action');
 requireValue(await readJson(bucket,fileRoot(owner,args.id)+'ready.json'),'File is not ready');
 // MCP downloads always remain 256 KiB even for large browser-uploaded packages.
 const total=Math.ceil(meta.bytes/CHUNK_BYTES);requireValue(Number.isInteger(args.index)&&args.index>=0&&args.index<total,'Invalid chunk index');
 const offset=args.index*CHUNK_BYTES,storageIndex=Math.floor(offset/FILE_CHUNK_BYTES),start=offset%FILE_CHUNK_BYTES;
 const item=await bucket.get(fileRoot(owner,args.id)+'chunks/'+storageIndex);requireValue(item,'Chunk missing');
 const data=Buffer.from(await item.arrayBuffer()).subarray(start,start+Math.min(CHUNK_BYTES,meta.bytes-offset));
 return {ok:true,id:meta.id,index:args.index,chunks:total,chunk_bytes:CHUNK_BYTES,bytes:data.length,base64:data.toString('base64'),sha256:digest(data),file_sha256:meta.sha256};
}
export async function browserFileResponse(request,bucket,claims,now=Date.now()){
 const url=new URL(request.url),path=url.pathname; if(!path.startsWith('/api/files'))return null;
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
 const json=(body,status=200)=>Response.json(body,{status,headers});
 try{
  requireValue(bucket,'File storage unavailable');const owner=principal(claims);
  if(!['GET','HEAD'].includes(request.method)){
   const origin=request.headers.get('origin');requireValue(['https://relay.loew.fi','https://ctrl.loew.fi'].includes(origin),'Same-origin request required');
   requireValue(request.headers.get('x-relay-file-request')==='1','Explicit file request required');
  }
  if(path==='/api/files'&&request.method==='GET')return json(await readBrowserFiles({action:'files',cursor:url.searchParams.get('cursor')},bucket,claims,now));
  if(path==='/api/files'&&request.method==='POST'){
   requireValue(request.headers.get('content-type')?.startsWith('application/json'),'JSON required');
   const args=JSON.parse(new TextDecoder().decode(await limitedBytes(request,4096)));
   requireValue(isLabel(args.request_id),'Stable request ID required');
   requireValue(typeof args.filename==='string'&&args.filename.length>0&&args.filename.length<=180&&!/[\x00-\x1f\x7f/\\]/.test(args.filename)&&!['.','..'].includes(args.filename),'Invalid filename');
   requireValue(Number.isSafeInteger(args.bytes)&&args.bytes>0&&args.bytes<=MAX_FILE_BYTES,'File must be 1 byte–512 MiB');
   requireValue(hashPattern.test(args.sha256||''),'File checksum required');
   const id='fl_'+digest(owner+'\0'+args.request_id).slice(0,32),key=fileRoot(owner,id)+'manifest.json';
   const props={id,owner,filename:args.filename,bytes:args.bytes,sha256:args.sha256,chunk_bytes:FILE_CHUNK_BYTES,chunks:Math.ceil(args.bytes/FILE_CHUNK_BYTES)};
   const previous=await readJson(bucket,key);
   if(previous){requireValue(previous.expires_at>now,'File expired; start a new upload');requireValue(Object.entries(props).every(([k,v])=>previous[k]===v),'Request ID conflicts with another file');return json({ok:true,file:await fileStatus(bucket,previous,true),resumed:true})}
   const meta={...props,created_at:now,expires_at:now+72*3600000};
   const stored=await bucket.put(key,JSON.stringify(meta),{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{expires_at:String(meta.expires_at)}});
   if(!stored){const found=await fileMeta(bucket,owner,id,now);requireValue(Object.entries(props).every(([k,v])=>found[k]===v),'Request ID conflicts with another file');return json({ok:true,file:await fileStatus(bucket,found,true),resumed:true})}
   return json({ok:true,file:{...publicManifest(meta),state:'uploading',uploaded_chunks:[]}},201);
  }
  const match=path.match(/^\/api\/files\/(fl_[a-f0-9]{32})(?:\/(status|complete|download|chunks\/\d+))?$/);requireValue(match,'Unknown file route');
  const meta=await fileMeta(bucket,owner,match[1],now),root=fileRoot(owner,meta.id),action=match[2]||'status';
  if(action==='status'&&request.method==='GET')return json({ok:true,file:await fileStatus(bucket,meta,true)});
  if(action.startsWith('chunks/')&&request.method==='PUT'){
   const index=Number(action.slice(7));requireValue(Number.isInteger(index)&&index>=0&&index<meta.chunks,'Invalid chunk index');
   const bytes=await limitedBytes(request,FILE_CHUNK_BYTES),expected=Math.min(FILE_CHUNK_BYTES,meta.bytes-index*FILE_CHUNK_BYTES);
   requireValue(bytes.length===expected,'Wrong chunk size');requireValue(hashPattern.test(request.headers.get('x-content-sha256')||'')&&digest(bytes)===request.headers.get('x-content-sha256'),'Chunk checksum mismatch');
   await immutable(bucket,root+'chunks/'+index,bytes,meta.expires_at);return json({ok:true,index,bytes:bytes.length});
  }
  if(action==='complete'&&request.method==='POST'){
   const hash=createHash('sha256');let size=0;
   for(let i=0;i<meta.chunks;i++){const item=await bucket.get(root+'chunks/'+i);requireValue(item,'Missing chunk '+i);const bytes=Buffer.from(await item.arrayBuffer());requireValue(bytes.length===Math.min(FILE_CHUNK_BYTES,meta.bytes-i*FILE_CHUNK_BYTES),'Wrong stored chunk size');hash.update(bytes);size+=bytes.length}
   requireValue(size===meta.bytes&&hash.digest('hex')===meta.sha256,'Whole-file checksum mismatch');
   await immutable(bucket,root+'ready.json',JSON.stringify({id:meta.id,sha256:meta.sha256,bytes:meta.bytes}),meta.expires_at);return json({ok:true,file:{...publicManifest(meta),state:'ready'}});
  }
  if(action==='download'&&['GET','HEAD'].includes(request.method)){
   requireValue(await readJson(bucket,root+'ready.json'),'File is not ready');let index=0;
   const stream=new ReadableStream({async pull(controller){try{if(index===meta.chunks){controller.close();return}const item=await bucket.get(root+'chunks/'+index++);requireValue(item,'Chunk unavailable');controller.enqueue(new Uint8Array(await item.arrayBuffer()))}catch(e){controller.error(e)}}});
   return new Response(request.method==='HEAD'?null:stream,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(meta.bytes),'Content-Disposition':`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(meta.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,'X-File-Sha256':meta.sha256}});
  }
  return json({error:'Method not allowed'},405);
 }catch(e){return json({error:e.message||'File operation failed'},400)}
}
export async function expireBrowserFiles(bucket,now=Date.now()){
 if(!bucket)return;const key='transfer-maintenance/v1/file-cursor.json';let cursor=(await readJson(bucket,key))?.cursor;
 for(let pageNumber=0;pageNumber<8;pageNumber++){const page=await bucket.list({prefix:FILE_PREFIX,limit:1000,include:['customMetadata'],...(cursor?{cursor}:{})});const expired=page.objects.filter(o=>Number(o.customMetadata?.expires_at)>0&&Number(o.customMetadata.expires_at)<=now).map(o=>o.key);for(let i=0;i<expired.length;i+=100)await bucket.delete(expired.slice(i,i+100));cursor=page.truncated?page.cursor:null;await bucket.put(key,JSON.stringify({cursor}));if(!cursor)break}
}
