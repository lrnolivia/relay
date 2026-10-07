import test from 'node:test';
import assert from 'node:assert/strict';
import {createGitHubReadCache} from './github-read-cache.js';
const representation=value=>({status:200,value,etag:'"fixture"',quota:{rate_limit_limit:5000,rate_limit_remaining:4999,rate_limit_used:1,rate_limit_reset:2000,rate_limit_resource:'core'}});
const args={scope:'installation-a',budget:'installation-a',path:'/repos/fixture/project/branches'};
test('twenty concurrent display readers share one fetch, without sharing mutable response objects',async()=>{
  const cache=createGitHubReadCache();let calls=0,release;
  const wait=new Promise(r=>release=r);
  const request=()=>cache.request({...args,mode:'display',execute:async()=>{calls++;await wait;return representation({items:['original']});}});
  const reads=Array.from({length:20},request);release();const values=await Promise.all(reads);
  assert.equal(calls,1);values[0].items.push('caller mutation');assert.deepEqual(values[1].items,['original']);
  assert.equal(cache.metrics().coalesced,19);
});
test('authority readers revalidate even inside the display TTL and use304 only with the same cached identity',async()=>{
  const cache=createGitHubReadCache();let calls=0;
  await cache.request({...args,mode:'display',execute:async()=>representation({revision:1})});
  const value=await cache.request({...args,execute:async etag=>{calls++;assert.equal(etag,'"fixture"');return {status:304,quota:{rate_limit_remaining:4999}};}});
  assert.deepEqual(value,{revision:1});assert.equal(calls,1);assert.equal(cache.metrics().not_modified,1);
  await assert.rejects(cache.request({...args,scope:'different-credential',execute:async etag=>{assert.equal(etag,undefined);return {status:304};}}),/without a matching/);
});
test('display TTL expiry revalidates and changed upstream bytes replace the cache',async()=>{
  let now=0,calls=0;const cache=createGitHubReadCache({clock:()=>now});
  const execute=async()=>{calls++;return representation({revision:calls});};
  await cache.request({...args,mode:'display',execute});now=14999;assert.equal((await cache.request({...args,mode:'display',execute})).revision,1);
  now=15000;assert.equal((await cache.request({...args,mode:'display',execute})).revision,2);assert.equal(calls,2);
});
test('writes invalidate before dispatch and cannot repopulate with an older in-flight read',async()=>{
  const cache=createGitHubReadCache();let release;
  const pending=cache.request({...args,mode:'display',execute:async()=>{await new Promise(r=>release=r);return representation({revision:1});}});
  await cache.request({...args,method:'PUT',execute:async etag=>{assert.equal(etag,undefined);return {status:200,value:{saved:true}};}});
  const fresh=await cache.request({...args,mode:'display',execute:async etag=>{assert.equal(etag,undefined);return representation({revision:2});}});assert.equal(fresh.revision,2);
  release();await pending;assert.equal(cache.metrics().cache_entries,1);
  assert.equal((await cache.request({...args,mode:'display',execute:async()=>{throw Error('new cache expected');}})).revision,2);
});
test('same installation cooldown spans repositories and tokens, honors reset, and never retries a write',async()=>{
  let now=1000000,calls=0;const cache=createGitHubReadCache({clock:()=>now});
  const denied=Object.assign(new Error('provider-private-message'),{status:403,code:'rate_limit',github:{rate_limit_remaining:0,rate_limit_reset:2000,rate_limit_resource:'core'}});
  await assert.rejects(cache.request({...args,execute:async()=>{calls++;throw denied;}}),error=>error===denied);
  await assert.rejects(cache.request({...args,scope:'installation-a-renewed-token',path:'/repos/fixture/second/pulls',method:'POST',execute:async()=>{calls++;}}),error=>error.code==='rate_limit'&&error.github.request_attempted===false);
  assert.equal(calls,1);
  assert.deepEqual(await cache.request({...args,budget:'installation-b',scope:'installation-b',execute:async()=>representation({ok:true})}),{ok:true});
  now=2000001;await cache.request({...args,execute:async()=>{calls++;return representation({ok:true});}});assert.equal(calls,2);
});
test('Retry-After secondary limits block core and GraphQL until their deadline',async()=>{
  let now=0;const cache=createGitHubReadCache({clock:()=>now});
  await assert.rejects(cache.request({...args,execute:async()=>{throw Object.assign(new Error('limited'),{status:429,code:'rate_limit',github:{retry_after_seconds:120}});}}));
  now=119999;await assert.rejects(cache.request({...args,execute:async()=>{throw Error('must not run');}}),error=>error.code==='rate_limit');
  await assert.rejects(cache.request({...args,resource:'graphql',path:'/graphql',method:'POST',execute:async()=>{throw Error('must not bypass secondary limit');}}),error=>error.code==='rate_limit');
  now=120001;await cache.request({...args,execute:async()=>representation({ok:true})});
});
test('successful last primary allowance blocks another request until the actual reset without blocking GraphQL',async()=>{
  let now=1000000,calls=0;const cache=createGitHubReadCache({clock:()=>now});
  await cache.request({...args,execute:async()=>{calls++;return {...representation({ok:true}),quota:{rate_limit_remaining:0,rate_limit_reset:1014}};}});
  await assert.rejects(cache.request({...args,execute:async()=>{calls++;}}),error=>error.github.retry_at===new Date(1014000).toISOString());
  assert.deepEqual(await cache.request({...args,resource:'graphql',path:'/graphql',method:'POST',execute:async()=>({status:200,value:{ok:true}})}),{ok:true});
  now=1014001;await cache.request({...args,execute:async()=>{calls++;return representation({ok:true});}});assert.equal(calls,2);
});
test('authentication and permission failures cannot fall back to cached display data',async()=>{
  for(const status of [401,403]){
    const cache=createGitHubReadCache();await cache.request({...args,mode:'display',execute:async()=>representation({private:true})});
    await assert.rejects(cache.request({...args,execute:async()=>{throw Object.assign(new Error('denied'),{status});}}));
    assert.equal(cache.metrics().cache_entries,0);
    await assert.rejects(cache.request({...args,mode:'display',execute:async()=>{throw Object.assign(new Error('still denied'),{status});}}));
  }
});
test('failed concurrent reads are not cached and observability excludes credentials and payloads',async()=>{
  const cache=createGitHubReadCache();let calls=0;
  for(let i=0;i<2;i++)await assert.rejects(cache.request({...args,execute:async()=>{calls++;throw Error('private token or response');}}));
  assert.equal(calls,2);assert.equal(cache.metrics().cache_entries,0);
  await cache.request({...args,onObservation:()=>{throw Error('broken logger');},execute:async()=>representation({secret:'private payload'})});
  assert.equal(cache.metrics().last_quota.rate_limit_limit,5000);assert.doesNotMatch(JSON.stringify(cache.metrics()),/installation-a|private payload|token/);
});
test('cache eviction and oversized responses bound retained bytes without truncating returned data',async()=>{
  const cache=createGitHubReadCache({maxEntries:2,maxBytes:80,maxEntryBytes:60});
  for(let i=0;i<4;i++)await cache.request({...args,path:'/item/'+i,execute:async()=>representation({id:i})});
  assert.equal(cache.metrics().cache_entries,2);assert.ok(cache.metrics().cache_bytes<=80);
  const large={text:'x'.repeat(100)};assert.deepEqual(await cache.request({...args,path:'/large',execute:async()=>representation(large)}),large);
  assert.equal(cache.metrics().cache_entries,2);
});
test('a response without an ETag or with no-store cannot leave older display data eligible',async()=>{
  for(const metadata of [{etag:null},{cacheable:false}]){
    const cache=createGitHubReadCache();await cache.request({...args,mode:'display',execute:async()=>representation({old:true})});
    await cache.request({...args,execute:async()=>({...representation({new:true}),...metadata})});assert.equal(cache.metrics().cache_entries,0);
  }
});
test('a full cooldown ledger pauses rather than forgetting another exhausted budget',async()=>{
  let now=0,calls=0;const cache=createGitHubReadCache({clock:()=>now});
  for(let i=0;i<129;i++)await assert.rejects(cache.request({...args,budget:'budget-'+i,execute:async()=>{
    calls++;throw Object.assign(new Error('limited'),{status:429,code:'rate_limit',github:{retry_after_seconds:60}});
  }}));
  await assert.rejects(cache.request({...args,budget:'budget-128',execute:async()=>{calls++;}}),error=>error.github.request_attempted===false);
  assert.equal(calls,129);now=60001;
  await cache.request({...args,budget:'budget-128',execute:async()=>representation({ok:true})});
});
