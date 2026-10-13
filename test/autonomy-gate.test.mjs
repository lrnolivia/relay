import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAutonomy } from '../scripts/autonomy-gate.mjs';
const reply=(scope,extra={})=>Response.json({schema:1,scope,enforced:true,held:false,revision:3,...extra});
test('CLI checks global then project at the fixed origin without redirects',async()=>{
 const calls=[];
 const result=await checkAutonomy('field',async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');assert.equal(options.cache,'no-store');return reply(new URL(url).searchParams.get('scope'));},{env:{}});
 assert.deepEqual(calls,['https://relay.loew.fi/autonomy-status?scope=global','https://relay.loew.fi/autonomy-status?scope=field']);
 assert.equal(result.ok,true);
});
test('hold, provider error, disabled controls and malformed state stop publication',async()=>{
 for(const response of [reply('global',{held:true}),reply('global',{enforced:false}),reply('global',{held:undefined}),new Response('offline',{status:503})]){
  await assert.rejects(checkAutonomy('relay',async()=>response),/held|stopped/);
 }
 await assert.rejects(checkAutonomy('relay',async()=>{throw Error('Network unavailable');}),/transport unavailable/);
 await assert.rejects(checkAutonomy('../relay'),/canonical project/);
});
test('existing Access identity stays at the fixed origin and never enters receipts or errors',async()=>{
 const env={CF_ACCESS_CLIENT_ID:'test-client-id',CF_ACCESS_CLIENT_SECRET:'test-client-secret'},calls=[];
 const result=await checkAutonomy('relay',async(url,options)=>{
  assert.equal(new URL(url).origin,'https://relay.loew.fi');
  assert.deepEqual(options.headers,{'CF-Access-Client-Id':env.CF_ACCESS_CLIENT_ID,'CF-Access-Client-Secret':env.CF_ACCESS_CLIENT_SECRET});
  calls.push(url);return reply(new URL(url).searchParams.get('scope'));
 },{env});
 assert.equal(calls.length,2);assert.doesNotMatch(JSON.stringify(result),/test-client/);
 await assert.rejects(checkAutonomy('relay',async()=>{throw Error(env.CF_ACCESS_CLIENT_SECRET);},{env}),error=>!error.message.includes(env.CF_ACCESS_CLIENT_SECRET)&&/stopped/.test(error.message));
 for(const invalid of [{CF_ACCESS_CLIENT_ID:'id'},{CF_ACCESS_CLIENT_SECRET:'secret'},{...env,CF_ACCESS_CLIENT_ID:'id\r\nInjected: yes'}]){
  let requests=0;await assert.rejects(checkAutonomy('relay',async()=>{requests++;},{env:invalid}),/identity/);assert.equal(requests,0);
 }
});
test('redirects, HTML login, oversized JSON, malformed JSON and project hold fail closed',async()=>{
 for(const response of [new Response('',{status:302,headers:{location:'https://other.invalid'}}),new Response('<html>login</html>'),new Response('x'.repeat(16385),{headers:{'Content-Type':'application/json'}}),Response.json(null),new Response('{',{headers:{'Content-Type':'application/json'}})]){
  let calls=0;await assert.rejects(checkAutonomy('relay',async()=>{calls++;return response;},{env:{}}),/stopped/);assert.equal(calls,1);
 }
 await assert.rejects(checkAutonomy('relay',async url=>reply(new URL(url).searchParams.get('scope'),{held:url.includes('scope=relay')}),{env:{}}),/held for relay/);
});
