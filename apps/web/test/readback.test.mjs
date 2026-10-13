import test from 'node:test';
import assert from 'node:assert/strict';
import {readback} from '../readback.mjs';
const reset=()=>Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}});
const wait=async()=>{};
test('safe GET retries a transport reset and returns exact bytes',async()=>{
 let calls=0;const result=await readback('https://example.test/image',{parse:'bytes'},{wait,fetcher:async(_url,options)=>{assert.equal(options.method,'GET');if(++calls===1)throw reset();return new Response(new Uint8Array([1,2,3]));}});
 assert.equal(calls,2);assert.deepEqual([...result.value],[1,2,3]);
});
test('a reset during body consumption is retried, not only before headers',async()=>{
 let calls=0;const result=await readback('https://example.test/qa',{}, {wait,fetcher:async()=>{calls++;return calls===1?{ok:true,json:async()=>{throw reset()}}:Response.json({ok:true});}});
 assert.equal(calls,2);assert.equal(result.value.ok,true);
});
test('auth, permission and missing resources never retry',async()=>{
 for(const status of [401,403,404]){let calls=0;const r=await readback('https://example.test/qa',{}, {wait,fetcher:async()=>{calls++;return new Response('',{status});}});assert.equal(calls,1);assert.equal(r.response.status,status);assert.equal(r.value,null);}
});
test('transient HTTP response respects Retry-After and bounded retry budget',async()=>{
 let calls=0;const delays=[];const r=await readback('https://example.test/qa',{}, {wait:async n=>delays.push(n),fetcher:async()=>{calls++;return calls===1?new Response('',{status:429,headers:{'Retry-After':'2'}}):Response.json({ok:true});}});assert.equal(r.value.ok,true);assert.deepEqual(delays,[2000]);
 calls=0;const slow=await readback('https://example.test/qa',{}, {wait:async()=>assert.fail('must not ignore long Retry-After'),fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}});}});assert.equal(calls,1);assert.equal(slow.response.status,429);
 calls=0;await assert.rejects(readback('https://example.test/qa',{}, {wait,fetcher:async()=>{calls++;throw reset();}}),/fetch failed/);assert.equal(calls,3);
});
test('invalid JSON, programming errors and mutations fail without replay',async()=>{
 let calls=0;await assert.rejects(readback('https://example.test/qa',{}, {wait,fetcher:async()=>{calls++;return new Response('not json');}}),SyntaxError);assert.equal(calls,1);
 await assert.rejects(readback('https://example.test/ingest',{method:'POST',body:'bytes'},{fetcher:async()=>assert.fail('no write may execute')}),/GET only/);
 await assert.rejects(readback('https://example.test/qa',{}, {wait,fetcher:async()=>{throw new Error('programming error')}}),/programming error/);
});
