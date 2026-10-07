import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createTestHarness} from 'wrangler';
import {verifyFileLifecycle} from '../apps/web/verify-file-lifecycle.mjs';

test('actual local workerd/R2 conditional writes preserve soft deletion and restored names',{timeout:60000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'relay-files-workerd-'));
 const main=join(directory,'worker.js'),source=fileURLToPath(new URL('./file-transfer.js',import.meta.url));
 // Synthetic principal only. Signed Access and cross-account authorization are
 // tested through the real gateway separately; no production credentials here.
 await writeFile(main,`import {browserFileResponse} from ${JSON.stringify(source)};export default {fetch(request,env){return browserFileResponse(request,env.EVIDENCE,{iss:'local-runtime-fixture',sub:request.headers.get('X-Fixture-Owner')||'fixture-owner'})}};`);
 const harness=createTestHarness({workers:[{config:{name:'relay-files-runtime',main,compatibility_date:'2026-10-01',compatibility_flags:['nodejs_compat'],r2_buckets:[{binding:'EVIDENCE',bucket_name:'local-files-fixture',remote:false}]}}]});
 try{
  await harness.listen();
  const receipt=await verifyFileLifecycle((path,options)=>harness.fetch(path,options),{requestId:'local-runtime-lifecycle'});assert.equal(receipt.ok,true);assert.equal(receipt.cleanup.status,200);
  const list=await harness.fetch('/api/files');assert.deepEqual((await list.json()).files,[]);
  const other=await harness.fetch('/api/files',{headers:{'X-Fixture-Owner':'another-owner'}});assert.deepEqual((await other.json()).files,[]);
  const bytes='race',sha256=createHash('sha256').update(bytes).digest('hex'),headers={Origin:'https://relay.loew.fi','X-Relay-File-Request':'1','Content-Type':'application/json'};
  const created=await harness.fetch('/api/files',{method:'POST',headers,body:JSON.stringify({request_id:'runtime-cas-race',filename:'race.txt',bytes:4,sha256})}),{file}=await created.json();assert.equal(created.status,201);
  assert.equal((await harness.fetch('/api/files/'+file.id+'/chunks/0',{method:'PUT',headers:{...headers,'X-Content-Sha256':sha256},body:bytes})).status,200);
  assert.equal((await harness.fetch('/api/files/'+file.id+'/complete',{method:'POST',headers})).status,200);
  const [rename,deleted]=await Promise.all([harness.fetch('/api/files/'+file.id,{method:'PATCH',headers,body:JSON.stringify({filename:'renamed-race.txt'})}),harness.fetch('/api/files/'+file.id,{method:'DELETE',headers})]);
  assert.ok([200,410].includes(rename.status));assert.equal(deleted.status,200);assert.equal((await harness.fetch('/api/files/'+file.id+'/status')).status,410);
  for(const [suffix,method] of [['','DELETE'],['','PATCH'],['/restore','POST']])assert.equal((await harness.fetch('/api/files/'+file.id+suffix,{method,headers:{...headers,'X-Fixture-Owner':'another-owner'},...(method==='PATCH'?{body:JSON.stringify({filename:'intrusion.txt'})}:{})})).status,400);
  assert.equal((await harness.fetch('/api/files/'+file.id+'/restore',{method:'POST',headers})).status,200);
  assert.equal((await harness.fetch('/api/files/'+file.id,{method:'DELETE',headers})).status,200);
 }finally{await harness.close();await rm(directory,{recursive:true,force:true});}
});
