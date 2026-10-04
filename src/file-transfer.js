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
 {name:'relay_transfer_read',title:'Read temporary files and transfer receipts',description:'Read same-authenticated-account temporary transfers. Inbox/outbox require an address routing label; paginate with cursor until null. Status reports uploaded chunks for resume. Chunk returns bounded base64 only after complete verification. Download every chunk, verify chunk and whole-file SHA-256 before acknowledging. Transfer IDs are not public download links.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['inbox','outbox','status','chunk']},id:properties.id,index:properties.index,address:properties.address,cursor:properties.cursor},required:['action'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];
