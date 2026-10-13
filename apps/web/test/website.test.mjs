import test from 'node:test';
import assert from 'node:assert/strict';
import {webBuildId,webSourceSha} from '../generated.js';
import worker from '../../mcp/index.js';

test('Relay landing preserves deterministic source/build identity, while retired workspace URLs resolve only to CTRL',async()=>{
 for(const method of ['GET','HEAD']){
  for(const path of ['/','/index.html']){
   const response=await worker.fetch(new Request('https://relay.loew.fi'+path,{method}),{});
   assert.equal(response.status,200);assert.equal(response.headers.get('X-Relay-Web-Build'),webBuildId);
   if(webSourceSha)assert.equal(response.headers.get('X-Relay-Source-Sha'),webSourceSha);
   const body=await response.text();if(method==='HEAD')assert.equal(body,'');else assert.match(body,/id="root"/);
  }
  for(const route of ['today','runner','runner/relay/exact-task','night-shift','inspector','inspector/']){
   const response=await worker.fetch(new Request('https://relay.loew.fi/'+route+'?project=relay',{method}),{});
   assert.equal(response.status,308);assert.equal(response.headers.get('Location'),'https://ctrl.loew.fi/#/'+(route==='today'?'now':route.replace(/\/$/,''))+'?project=relay');
  }
  const retired=await worker.fetch(new Request('https://relay.loew.fi/relay-app.js',{method}),{});
  assert.equal(retired.status,410);assert.equal(retired.headers.get('X-Content-Type-Options'),'nosniff');
  assert.equal(retired.headers.get('Content-Type'),'text/plain; charset=utf-8');
 }
 assert.match(webBuildId,/^[a-f0-9]{64}$/);
 const privateApi=await worker.fetch(new Request('https://relay.loew.fi/api/projects'),{});assert.equal(privateApi.status,401);
 const post=await worker.fetch(new Request('https://relay.loew.fi/runner',{method:'POST'}),{});assert.notEqual(post.status,308,'mutations never redirect across origins');
});
