import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium} from 'playwright';
import {createVerificationFetch,navigateProductionPage} from '../verification-transport.mjs';

async function serve(handler,run){
 const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await run('http://127.0.0.1:'+server.address().port);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('one-shot verification does not reuse reset-prone sockets or replay writes',async()=>{
 const sockets=new WeakMap();let received=0;
 await serve((req,res)=>{
  received++;const used=sockets.has(req.socket);sockets.set(req.socket,true);req.resume();
  if(used){req.socket.destroy();return;}res.setHeader('Content-Type','application/json');res.end('{"ok":true}');
 },async origin=>{
  // Seed the global fetch pool: a close header alone can reuse this socket.
  await (await fetch(origin)).text();
  const send=createVerificationFetch();
  for(let i=0;i<5;i++)assert.deepEqual(await (await send(origin,{method:'POST',body:'fixture'})).json(),{ok:true});
  assert.equal(received,6,'five writes were each sent exactly once');
 });
});
test('response is fully consumed before return and body resets remain single-attempt failures',async()=>{
 let calls=0;const events=[];
 await serve((req,res)=>{calls++;req.resume();res.writeHead(200,{'Content-Length':40});res.write('partial');setImmediate(()=>res.destroy());},async origin=>{
  await assert.rejects(createVerificationFetch({onEvent:e=>events.push(e)})(origin,{method:'POST',body:'once'}));
  assert.equal(calls,1);assert.equal(events[0].phase,'body');assert.equal(events[0].status,200);assert.equal(events[0].error_code,'ECONNRESET');
 });
});
test('HTTP failures preserve exact status and body without retries or credential diagnostics',async()=>{
 const events=[];let calls=0;
 await serve((req,res)=>{calls++;req.resume();res.writeHead(403,{'Content-Type':'application/json'});res.end('{"error":"denied"}');},async origin=>{
  const response=await createVerificationFetch({onEvent:e=>events.push(e)})(origin+'/api/files/fl_'+ 'a'.repeat(32)+'?secret=private',{method:'PATCH',headers:{Authorization:'private-token'},body:'private-body'});
  assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'denied'});assert.equal(calls,1);
  assert.equal(events[0].path,'/api/files/:fixture');assert.doesNotMatch(JSON.stringify(events),/private|Authorization|secret/);
 });
});
test('the caller deadline aborts a request without replay and redirects never forward credentials',async()=>{
 let calls=0;const events=[];
 await serve((req,res)=>{calls++;req.resume();if(req.url==='/redirect'){res.writeHead(302,{Location:'/private'});res.end();}},async origin=>{
  const send=createVerificationFetch({onEvent:e=>events.push(e)});
  await assert.rejects(send(origin,{method:'POST',body:'once',signal:AbortSignal.timeout(50)}),{name:'TimeoutError'});
  assert.equal(calls,1);assert.equal(events[0].error_code,'TIMEOUT_OR_ABORT');
  await assert.rejects(send(origin+'/redirect',{headers:{Authorization:'private-token'}}),/redirects must be explicit/);assert.equal(calls,2);
  assert.equal((await send(origin+'/redirect',{redirect:'manual'})).status,302);assert.equal(calls,3);
 });
});
test('multipart evidence bytes and response limits are preserved',async()=>{
 let body='';
 await serve((req,res)=>{req.on('data',chunk=>body+=chunk);req.on('end',()=>{res.end('too-large');});},async origin=>{
  const form=new FormData();form.set('metadata','{"fixture":true}');form.set('screenshot',new Blob(['exact-image-bytes']), 'fixture.png');
  await assert.rejects(createVerificationFetch({maxResponseBytes:4})(origin,{method:'POST',body:form}),/exceeds limit/);
  assert.match(body,/exact-image-bytes/);assert.match(body,/filename="fixture.png"/);assert.match(body,/\{"fixture":true\}/);
 });
});
test('production navigation reaches UI assertions while an unrelated resource never finishes',async()=>{
 await serve((req,res)=>{if(req.url==='/pending.png')return;res.setHeader('Content-Type','text/html');res.end('<h1>relay</h1><button>Check connection</button><img src="/pending.png">');},async origin=>{
  const browser=await chromium.launch({headless:true});try{
   const previous=await browser.newPage();await assert.rejects(previous.goto(origin,{timeout:150}),/Timeout/);await previous.close();
   const page=await browser.newPage();await navigateProductionPage(page,origin);
   await page.getByRole('heading',{name:'relay',exact:true}).waitFor();await page.getByRole('button',{name:'Check connection'}).click();
   assert.equal(await page.evaluate(()=>document.readyState),'interactive');
  }finally{await browser.close();}
 });
});
