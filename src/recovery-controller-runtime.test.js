import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('separate edge controller verifies real signatures and reaches the existing durable safety atom during a product HTTP failure',{timeout:30000},async()=>{
 const {createTestHarness}=await import('wrangler'),directory=await mkdtemp(join(tmpdir(),'relay-independent-controller-'));
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),kid='independent-controller-runtime',encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const payload=encode({alg:'RS256',kid})+'.'+encode({iss:'https://loewfi.cloudflareaccess.com',aud:['7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819'],exp:Math.floor(Date.now()/1000)+600});
 const token=payload+'.'+sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64url');
 const product=join(directory,'product.mjs'),controller=join(directory,'controller.mjs');
 await writeFile(product,`export {RelayEvents} from ${JSON.stringify(new URL('./relay-events.js',import.meta.url).pathname)};export default {fetch(){return new Response('Synthetic broken product handler',{status:500});}};`);
 await writeFile(controller,`import worker from ${JSON.stringify(new URL('./recovery-controller.js',import.meta.url).pathname)};
 globalThis.fetch=async url=>{if(String(url)!=='https://loewfi.cloudflareaccess.com/cdn-cgi/access/certs')throw Error('Unexpected external request');return Response.json({keys:[${JSON.stringify({...publicKey.export({format:'jwk'}),kid})}]});};export default worker;`);
 const config=JSON.parse(await readFile(new URL('../recovery/wrangler.jsonc',import.meta.url),'utf8'));
 const harness=createTestHarness({root:directory,workers:[{config:{name:'relay',main:product,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags,durable_objects:{bindings:[{name:'RELAY_EVENTS',class_name:'RelayEvents'}]},migrations:[{tag:'test-v1',new_sqlite_classes:['RelayEvents']}]}},{config:{...config,main:controller,workers_dev:true,r2_buckets:[{binding:'EVIDENCE',bucket_name:'fixture'}]}}]});
 try{
  await harness.listen();assert.equal((await harness.getWorker('relay').fetch('/')).status,500);
  const call=body=>harness.getWorker('relay-recovery').fetch('/recovery-control',{method:'POST',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':token},body:JSON.stringify(body)});
  const hold={action:'hold',scope:'relay',expected_revision:0,operation_id:'independent-runtime-hold',reason:'Synthetic direct user stop'};
  const response=await call(hold),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.state.held,true);assert.equal(body.state.revision,1);
  const duplicate=await (await call(hold)).json();assert.equal(duplicate.duplicate,true);assert.equal(duplicate.state.revision,1);
  const denied=await harness.getWorker('relay-recovery').fetch('/recovery-control',{method:'POST',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':'not-a-signed-token'},body:JSON.stringify({action:'status',scope:'relay'})});assert.equal(denied.status,401);
  const status=await (await call({action:'status',scope:'relay'})).json();assert.equal(status.state.held,true);assert.equal((await harness.getWorker('relay').fetch('/')).status,500);
 }finally{await harness.close();await rm(directory,{recursive:true,force:true});}
});

test('edge runtime enforces both immutable context capabilities and rejects unsupported retained versions',{timeout:30000},async()=>{
 const {createTestHarness}=await import('wrangler'),directory=await mkdtemp(join(tmpdir(),'relay-context-floor-runtime-')),main=join(directory,'worker.mjs');
 await writeFile(main,`import {assertContextSource,assertContextVersion} from ${JSON.stringify(new URL('./context-schema-guard.js',import.meta.url).pathname)};
 const sha='a'.repeat(40),version='11111111-2222-3333-4444-555555555555';
 const api=async path=>({type:'file',encoding:'base64',content:btoa(path.includes('context-storage')?'export const CONTEXT_STORAGE_SCHEMA_CAPABILITY = 2;':'export const CONTEXT_SCHEMA_GUARD_VERSION = 1;')});
 export default {async fetch(){let denied=0;await assertContextSource({},sha,2,api);await assertContextVersion({},'relay',version,{last_healthy:{worker:'relay',version_id:version,source_sha:sha}},{floor:2,github:api});
 try{await assertContextVersion({},'relay',version,{}, {floor:2,github:api});}catch{denied++;}
 try{await assertContextSource({},sha,2,async()=>({type:'file',encoding:'base64',content:btoa('export const CONTEXT_STORAGE_SCHEMA_CAPABILITY = 2;')}));}catch{denied++;}
 return Response.json({ok:denied===2,denied});}};`);
 const config=JSON.parse(await readFile(new URL('../recovery/wrangler.jsonc',import.meta.url),'utf8')),harness=createTestHarness({root:directory,workers:[{config:{name:'floor-fixture',main,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags}}]});
 try{await harness.listen();assert.deepEqual(await(await harness.getWorker('floor-fixture').fetch('/')).json(),{ok:true,denied:2});}finally{await harness.close();await rm(directory,{recursive:true,force:true});}
});
