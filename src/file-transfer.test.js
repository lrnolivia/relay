import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {transferRead,transferWrite,expireTransfers,CHUNK_BYTES,MAX_TRANSFER_BYTES,transferTools} from './file-transfer.js';
const hash=data=>createHash('sha256').update(data).digest('hex');
const account={iss:'https://access.example',sub:'account-owner'};
const now=1791100000000;
class Bucket {
 objects=new Map();
 async put(key,data,options={}){if(options.onlyIf?.etagDoesNotMatch==='*'&&this.objects.has(key))return null;this.objects.set(key,{bytes:Buffer.from(data),customMetadata:options.customMetadata});return {key};}
 async get(key){const o=this.objects.get(key);return o?{text:async()=>o.bytes.toString(),arrayBuffer:async()=>o.bytes,customMetadata:o.customMetadata}:null;}
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
