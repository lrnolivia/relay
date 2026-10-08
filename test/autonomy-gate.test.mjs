import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAutonomy } from '../scripts/autonomy-gate.mjs';
const reply=(scope,extra={})=>Response.json({schema:1,scope,enforced:true,held:false,revision:3,...extra});
test('CLI checks global then project at the fixed origin without redirects',async()=>{
 const calls=[];
 const result=await checkAutonomy('field',async(url,options)=>{calls.push(url);assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');return reply(new URL(url).searchParams.get('scope'));});
 assert.deepEqual(calls,['https://relay.loew.fi/autonomy-status?scope=global','https://relay.loew.fi/autonomy-status?scope=field']);
 assert.equal(result.ok,true);
});
test('hold, provider error, disabled controls and malformed state stop publication',async()=>{
 for(const response of [reply('global',{held:true}),reply('global',{enforced:false}),reply('global',{held:undefined}),new Response('offline',{status:503})]){
  await assert.rejects(checkAutonomy('relay',async()=>response),/held|stopped/);
 }
 await assert.rejects(checkAutonomy('relay',async()=>{throw Error('Network unavailable');}),/Network unavailable/);
 await assert.rejects(checkAutonomy('../relay'),/canonical project/);
});
