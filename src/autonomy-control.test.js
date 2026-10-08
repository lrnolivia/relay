import test from 'node:test';
import assert from 'node:assert/strict';
import { autonomyState, transitionAutonomy, durableAutonomy, guardAutonomy, guardRepository, publicAutonomyStatus } from './autonomy-control.js';
import { githubApiRequest, githubGraphqlRequest } from './source.js';
import { deployCloudVersion, recoverCloudVersion } from './cloud.js';
import { deployProjectCloudVersion, callAutonomyControl } from './project-cloud.js';

const version='11111111-2222-3333-4444-555555555555';
const target={worker:'relay',version_id:version,source_sha:'a'.repeat(40),compatibility_id:'relay-v1',evidence:'Exact candidate and production receipt'};
const input=(action,revision=0,extra={})=>({action,scope:'relay',expected_revision:revision,operation_id:'operation-'+action+'-'+revision,reason:'Direct operator instruction',...extra});
function binding(initial={}) {
 const values=new Map(Object.entries(initial));let tail=Promise.resolve();
 const storage={transaction(fn){const result=tail.then(()=>fn({get:async key=>values.get(key),put:async(key,value)=>values.set(key,structuredClone(value))}));tail=result.catch(()=>{});return result;}};
 const atoms=new Map();
 return {env:{RELAY_AUTONOMY_GUARD:'enforced',RELAY_EVENTS:{idFromName:name=>name,get:name=>({fetch:async(_url,options)=>{
   if(!atoms.has(name))atoms.set(name,{transaction:fn=>storage.transaction(async()=>fn({get:async()=>values.get(name),put:async(_key,value)=>values.set(name,structuredClone(value))}))});
   try{return Response.json(await durableAutonomy(atoms.get(name),JSON.parse(options.body)));}
   catch(error){return Response.json({error:error.message},{status:error.status||500});}
 }})}},values,storage};
}

test('stop is durable, revision checked and a retry cannot overwrite a resume',async()=>{
 const {storage,values}=binding();
 const held=await durableAutonomy(storage,input('hold'));
 assert.equal(values.get('autonomy').held,true);
 assert.equal(held.state.revision,1);
 await assert.rejects(durableAutonomy(storage,input('resume',0,{authorization:'Resume now'})),/revision changed/);
 await assert.rejects(durableAutonomy(storage,input('resume',1)),/authorization/);
 const resumed=await durableAutonomy(storage,input('resume',1,{authorization:'Lauren: keep going; message 42'}));
 assert.equal(resumed.state.held,false);
  const duplicate=await durableAutonomy(storage,input('hold'));
 assert.equal(duplicate.duplicate,true);
  assert.equal(duplicate.state.held,false);
  const reordered=Object.fromEntries(Object.entries(input('hold')).reverse());
  assert.equal((await durableAutonomy(storage,reordered)).duplicate,true);
 await assert.rejects(durableAutonomy(storage,{...input('hold'),reason:'Different intent'}),/different intent/);
});

test('concurrent writers cannot both win the same revision',async()=>{
 const {storage}=binding();
 const results=await Promise.allSettled([durableAutonomy(storage,input('hold')),durableAutonomy(storage,input('resume',0,{authorization:'Resume'}))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.match(results.find(r=>r.status==='rejected').reason.message,/revision changed/);
});

test('healthy release never advances the separate explicitly approved target',()=>{
 let state=transitionAutonomy(null,input('approve',0,{target,approval:{text:'I approve this exact release',source:'Lauren message 12'}})).state;
 state=transitionAutonomy(state,input('healthy',1,{target:{...target,version_id:'66666666-7777-8888-9999-aaaaaaaaaaaa',source_sha:'b'.repeat(40)}})).state;
 assert.equal(state.last_user_approved.version_id,version);
 assert.notEqual(state.last_healthy.version_id,version);
 state=transitionAutonomy(state,input('prepare_rollback',2,{kind:'user-approved',expected_current_version:state.last_healthy.version_id})).state;
 assert.equal(state.rollback.target.version_id,version);
 assert.equal(state.held,true);
 assert.throws(()=>transitionAutonomy(state,input('resume',3,{authorization:'Resume'})),/uncertain rollback/);
 state=transitionAutonomy(state,input('finish_rollback',3,{result:{state:'verified',version_id:version,evidence:'Exact provider and health readback'}})).state;
 assert.equal(state.held,true);
 assert.equal(state.last_user_approved.version_id,version);
});

test('missing approved target never substitutes a healthy release',()=>{
 const state=transitionAutonomy(null,input('healthy',0,{target})).state;
 assert.throws(()=>transitionAutonomy(state,input('prepare_rollback',1,{kind:'user-approved',expected_current_version:version})),/no substitute/);
 assert.throws(()=>transitionAutonomy(state,input('approve',1,{target})),/explicit text/);
 assert.throws(()=>transitionAutonomy(state,input('hold',1,{target})),/Unexpected fields/);
 assert.throws(()=>transitionAutonomy({...autonomyState('relay'),held:undefined},{action:'status',scope:'relay'}),/state is invalid/);
});

test('global and project holds block provider writes while read and cancellation stay available',async()=>{
 const {env}=binding({'autonomy:global':{...autonomyState('global'),held:true,reason:'Stop all deployments'}});
 let calls=0;const original=globalThis.fetch;
 globalThis.fetch=async()=>{calls++;return Response.json({ok:true});};
 try{
  await assert.rejects(githubApiRequest({...env,RELAY_GITHUB_TOKEN:'test'},'/repos/lrnolivia/relay/git/refs',{method:'POST',body:{}}),/held for global/);
  await assert.rejects(githubGraphqlRequest({...env,RELAY_GITHUB_TOKEN:'test'},'lrnolivia','relay','mutation { ready }'),/held for global/);
  await assert.rejects(githubApiRequest({...env,RELAY_GITHUB_TOKEN:'test'},'/repos/lrnolivia/field/contents/coordination/field.json',{method:'PUT',body:{}}),/held for global/);
  await assert.rejects(deployCloudVersion({...env,CLOUDFLARE_ACCOUNT_ID:'test',CLOUDFLARE_API_TOKEN:'test'},'relay',version),/held for global/);
  await assert.rejects(deployProjectCloudVersion(env,'field',version,'deploy',{github:async()=>{throw Error('Should not read provider');}}),/held for global/);
  assert.equal(calls,0);
  await githubApiRequest({...env,RELAY_GITHUB_TOKEN:'test'},'/repos/lrnolivia/relay/contents/coordination/relay.json',{method:'PUT',body:{}});
  await githubApiRequest({...env,RELAY_GITHUB_TOKEN:'test'},'/repos/lrnolivia/relay/actions/runs/123/cancel',{method:'POST'});
  assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});

test('canonical GW hold covers the repository alias',async()=>{
 const {env}=binding({'autonomy:grnwht':{...autonomyState('grnwht'),held:true,reason:'Stop GW'}});
 await assert.rejects(guardRepository(env,'lrnolivia/gwfamily'),/held for grnwht/);
 await guardRepository(env,'lrnolivia/field');
});

test('missing or malformed safety state fails closed; public status reveals no approval records',async()=>{
 await assert.rejects(guardAutonomy({RELAY_AUTONOMY_GUARD:'enforced'},['relay']),/unavailable/);
 const env={RELAY_AUTONOMY_GUARD:'enforced',RELAY_EVENTS:{idFromName:x=>x,get:()=>({fetch:async()=>Response.json({ok:true,state:{scope:'global'}})})}};
 await assert.rejects(guardAutonomy(env),/invalid/);
 const good=binding({'autonomy:relay':{...autonomyState('relay'),last_user_approved:target}}).env;
 assert.deepEqual(await publicAutonomyStatus(good,'relay'),{schema:1,scope:'relay',revision:0,held:false,enforced:true});
});

const profile={identity_url:'https://relay.loew.fi/',health_url:'https://relay.loew.fi/health',source_header:'X-Relay-Source-Sha',compatibility_header:'X-Relay-Release-Compatibility',compatibility_id:'relay-v1'};
function releaseFixture(env){
 let current=target;
 const deps={
  github:async()=>({type:'file',encoding:'base64',content:Buffer.from(JSON.stringify({id:'relay',managed:true,repository:'lrnolivia/relay',cloud:{provider:'cloudflare',worker:'relay',write:true,rollback:profile}})).toString('base64')}),
  snapshot:async()=>({deployments:{deployments:[{id:'deployment',versions:[{version_id:current.version_id,percentage:100}]}]},versions:{items:[target,current].map(value=>({id:value.version_id}))},domains:[{service:'relay',hostname:'relay.loew.fi',enabled:true}]}),
  active:async()=>({version_id:current.version_id,deployment_id:'deployment'}),
  fetch:async (url,options)=>{assert.equal(options.redirect,'manual');return url.endsWith('/health')?Response.json({ok:true,service:'relay'}):new Response('website',{headers:{'X-Relay-Source-Sha':current.source_sha,'X-Relay-Release-Compatibility':current.compatibility_id}});}
 };
 return {deps,setCurrent:value=>{current=value;},getCurrent:()=>current};
}

test('verified release controls keep the approved target and perform one held rollback',async()=>{
 const {env}=binding(),f=releaseFixture(env);env.RELAY_CLOUDFLARE_WRITE_SCRIPTS='relay';
 await callAutonomyControl(env,input('approve',0,{target,approval:{text:'Lauren: I approve this release',source:'Exact user message 12'}}),f.deps);
 const newer={...target,version_id:'66666666-7777-8888-9999-aaaaaaaaaaaa',source_sha:'b'.repeat(40)};f.setCurrent(newer);
 await callAutonomyControl(env,input('healthy',1,{target:newer}),f.deps);
 let writes=0;f.deps.recover=async()=>{writes++;f.setCurrent(target);return {ok:true};};
 const args=input('rollback',2,{kind:'user-approved',expected_current_version:newer.version_id});
 const result=await callAutonomyControl(env,args,f.deps);
 assert.equal(result.state.rollback.state,'verified');assert.equal(result.state.held,true);
 assert.equal(result.state.last_healthy.version_id,newer.version_id);assert.equal(result.state.last_user_approved.version_id,version);
 assert.equal((await callAutonomyControl(env,args,f.deps)).duplicate,true);assert.equal(writes,1);
 await assert.rejects(callAutonomyControl(env,{...args,kind:'healthy'},f.deps),/different intent/);
});

test('missing target and uncertain provider write remain held; retry reconciles the same operation',async()=>{
 const missing=binding(),m=releaseFixture(missing.env);missing.env.RELAY_CLOUDFLARE_WRITE_SCRIPTS='relay';
 await assert.rejects(callAutonomyControl(missing.env,input('rollback',0,{kind:'user-approved',expected_current_version:version}),m.deps),/no substitute/);
 assert.equal(missing.values.get('autonomy:relay').held,true);
 const {env,values}=binding(),f=releaseFixture(env);env.RELAY_CLOUDFLARE_WRITE_SCRIPTS='relay';
 await callAutonomyControl(env,input('healthy',0,{target}),f.deps);
 const newer={...target,version_id:'66666666-7777-8888-9999-aaaaaaaaaaaa',source_sha:'b'.repeat(40)};f.setCurrent(newer);
 const args=input('rollback',1,{kind:'healthy',expected_current_version:newer.version_id});let writes=0;
 f.deps.recover=async()=>{if(f.getCurrent().version_id!==version){writes++;f.setCurrent(target);throw Error('Provider response was lost');}return {ok:true,reconciled:true};};
 await assert.rejects(callAutonomyControl(env,args,f.deps),/response was lost/);
 assert.equal(values.get('autonomy:relay').rollback.state,'pending');assert.equal(values.get('autonomy:relay').held,true);
 await assert.rejects(callAutonomyControl(env,input('approve',3,{target,approval:{text:'Approve',source:'message'}}),f.deps),/cannot change/);
 assert.equal((await callAutonomyControl(env,args,f.deps)).state.rollback.state,'verified');assert.equal(writes,1);
});

test('wrong deployed source, missing retained version and incompatible configuration cannot become approved',async()=>{
 const {env,values}=binding(),f=releaseFixture(env);env.RELAY_CLOUDFLARE_WRITE_SCRIPTS='relay';
 const args=input('approve',0,{target,approval:{text:'Approve',source:'message'}});
 f.setCurrent({...target,source_sha:'b'.repeat(40)});
 await assert.rejects(callAutonomyControl(env,args,f.deps),/identity does not match/);
 assert.equal(values.has('autonomy:relay'),false);
 f.setCurrent(target);f.deps.snapshot=async()=>({versions:{items:[]},deployments:{deployments:[]}});
 await assert.rejects(callAutonomyControl(env,args,f.deps),/retained exact active/);
 await assert.rejects(callAutonomyControl(env,{...args,target:{...target,compatibility_id:'changed-schema'}},f.deps),/compatibility/);
});

test('identity and health redirects never save healthy or user-approved recovery targets',async()=>{
 for(const action of ['healthy','approve'])for(const path of ['identity','health'])for(const status of [301,302,303,307,308]){
  const {env,values}=binding(),f=releaseFixture(env);env.RELAY_CLOUDFLARE_WRITE_SCRIPTS='relay';
  const request=f.deps.fetch;let calls=0;
  f.deps.fetch=async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return (url.endsWith('/health')?path==='health':path==='identity')?new Response(null,{status,headers:{Location:'https://elsewhere.loew.fi/'}}):request(url,options);};
  await assert.rejects(callAutonomyControl(env,input(action,0,{target,...(action==='approve'?{approval:{text:'Approve',source:'message'}}:{})}),f.deps),path==='identity'?/identity does not match/:/health endpoint failed/);
  assert.equal(calls,path==='identity'?1:2);assert.equal(values.has('autonomy:relay'),false);
 }
});

test('actual recovery transport never replays a successful but uncertain provider deployment',async()=>{
 const from='66666666-7777-8888-9999-aaaaaaaaaaaa';
 const pending=transitionAutonomy(transitionAutonomy(null,input('healthy',0,{target})).state,input('prepare_rollback',1,{kind:'healthy',expected_current_version:from})).state;
 const {env}=binding({'autonomy:relay':pending});Object.assign(env,{CLOUDFLARE_ACCOUNT_ID:'test',CLOUDFLARE_API_TOKEN:'test'});
 let active=from,writes=0;const original=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='POST'){writes++;active=version;throw Error('Network response lost after provider commit');}
  if(String(url).includes('/versions/'))return Response.json({success:true,result:{id:version}});
  return Response.json({success:true,result:{deployments:[{id:'deployment',versions:[{version_id:active,percentage:100}]}]}});
 };
 try{
  await assert.rejects(recoverCloudVersion(env,'relay',pending.rollback.operation_id),/response lost/);
  const result=await recoverCloudVersion(env,'relay',pending.rollback.operation_id);
  assert.equal(result.reconciled,true);assert.equal(writes,1);
  active='bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
  await assert.rejects(recoverCloudVersion(env,'relay',pending.rollback.operation_id),/Deployment changed/);
  assert.equal(writes,1);
 }finally{globalThis.fetch=original;}
});
