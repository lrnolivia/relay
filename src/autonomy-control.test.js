import test from 'node:test';
import assert from 'node:assert/strict';
import { autonomyState, transitionAutonomy, durableAutonomy, guardAutonomy, guardRepository, publicAutonomyStatus } from './autonomy-control.js';
import { githubApiRequest, githubGraphqlRequest } from './source.js';
import { deployCloudVersion, recoverCloudVersion } from './cloud.js';
import { deployProjectCloudVersion, callAutonomyControl, verifyReleaseTarget, RELAY_GUARDED_DEPLOY_COMMAND } from './project-cloud.js';
import { handleApi } from '../packages/runner/src/cloudflare-worker.mjs';
import { callUiApi } from '../apps/web/api.js';

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
function buildGuardFixture(){
 const state=binding(),f=releaseFixture(state.env),tag='a'.repeat(32);
 Object.assign(state.env,{CLOUDFLARE_ACCOUNT_ID:'fixture-account',CLOUDFLARE_API_TOKEN:'primary',CLOUDFLARE_BUILDS_API_TOKEN:'builds',RELAY_CLOUDFLARE_WRITE_SCRIPTS:'relay'});
 const trigger={trigger_uuid:'364453c2-c933-447a-9b19-451dff930e90',external_script_id:tag,root_directory:'/',branch_includes:['main'],branch_excludes:[],build_command:'npm run build',deploy_command:'npx wrangler deploy',repo_connection:{provider_type:'github',provider_account_name:'lrnolivia',repo_name:'relay'}};
 const variables={UNRELATED:{value:'keep',is_secret:false,created_on:'2020-01-01T00:00:00Z'}},calls=[];
 Object.assign(f.deps,{
  accessJwt:'verified.'+Buffer.from(JSON.stringify({common_name:'fixture-client'})).toString('base64url')+'.signature',buildIdentity:{CF_ACCESS_CLIENT_ID:'fixture-client',CF_ACCESS_CLIENT_SECRET:'fixture-secret'},
  identityFetch:async(url,options)=>{assert.match(url,/^https:\/\/relay\.loew\.fi\/autonomy-status\?scope=(global|relay)$/);assert.equal(options.redirect,'manual');assert.deepEqual(options.headers,{'CF-Access-Client-Id':'fixture-client','CF-Access-Client-Secret':'fixture-secret'});return Response.json({schema:1,scope:new URL(url).searchParams.get('scope'),revision:0,held:false,enforced:true});},
  buildApi:async(path,options={})=>{
   calls.push({path,method:options.method||'GET'});
   if(path.endsWith('/workers/scripts')){assert.equal(options.token,undefined);return [{id:'relay',tag}];}
   assert.equal(options.token,'builds');
   if(path.endsWith('/triggers'))return [structuredClone(trigger)];
   if(path.endsWith('/environment_variables')){
    if(options.method==='PATCH'){
     assert.deepEqual(Object.keys(options.body),['CF_ACCESS_CLIENT_ID','CF_ACCESS_CLIENT_SECRET']);
     for(const [key,value] of Object.entries(options.body)){assert.equal(value.is_secret,true);assert.equal(value.value,f.deps.buildIdentity[key]);variables[key]={is_secret:true,value:null,created_on:new Date().toISOString()};}
    }
    return structuredClone(variables);
   }
   assert.equal(path,'/accounts/fixture-account/builds/triggers/'+trigger.trigger_uuid);assert.equal(options.method,'PATCH');assert.deepEqual(options.body,{deploy_command:RELAY_GUARDED_DEPLOY_COMMAND});trigger.deploy_command=options.body.deploy_command;return structuredClone(trigger);
  }
 });
 return {...state,...f,trigger,variables,calls,args:input('configure_build_guard',0,{authorization:'Lauren: keep going with autonomous deployment and safety switch'})};
}

test('canonical build guard setup holds publication, writes only secret CI identity, verifies and resumes once',async()=>{
 const f=buildGuardFixture();let writes=0;const api=f.deps.buildApi;
 f.deps.buildApi=async(path,options)=>{if(options?.method==='PATCH'){writes++;assert.equal(f.values.get('autonomy:relay').held,true);}return api(path,options);};
 const receipt=await callAutonomyControl(f.env,f.args,f.deps);
 assert.equal(receipt.state.revision,2);assert.equal(receipt.state.held,false);assert.equal(receipt.build_guard.configuration_readback_verified,true);assert.equal(receipt.build_guard.build_execution_verified,false);assert.equal(f.trigger.deploy_command,RELAY_GUARDED_DEPLOY_COMMAND);assert.equal(writes,2);assert.equal(f.variables.UNRELATED.value,'keep');
 assert.doesNotMatch(JSON.stringify(receipt)+JSON.stringify([...f.values]),/fixture-client|fixture-secret|verified-private-context/);
 assert.equal((await callAutonomyControl(f.env,f.args,f.deps)).duplicate,true);assert.equal(writes,2);
 await assert.rejects(callAutonomyControl(f.env,{...f.args,authorization:'different authorization'},f.deps),/different intent/);
});

test('build setup rejects missing or invalid private identity and unregistered scope before holding or writing',async()=>{
 for(const change of [
  f=>{delete f.deps.accessJwt;},f=>{delete f.deps.buildIdentity;},f=>{f.deps.buildIdentity.CF_ACCESS_CLIENT_SECRET='';},
  f=>{f.deps.buildIdentity.CF_ACCESS_CLIENT_SECRET='secret\n';},f=>{f.args.scope='field';},f=>{f.env.RELAY_AUTONOMY_GUARD='disabled';},
  f=>{f.deps.accessJwt='verified.'+Buffer.from(JSON.stringify({common_name:'different-client'})).toString('base64url')+'.signature';},
  f=>{f.deps.identityFetch=async()=>{throw Error('secret-containing remote diagnostic');};},
  f=>{f.deps.identityFetch=async()=>new Response(null,{status:302,headers:{Location:'https://login.example/'}});},
  f=>{f.deps.identityFetch=async()=>Response.json({schema:1,scope:'wrong',revision:0,held:false,enforced:true});},
  f=>{f.deps.identityFetch=async()=>Response.json({schema:1,scope:'relay',revision:0,held:false,enforced:false});},
  f=>{f.deps.identityFetch=async()=>new Response('x'.repeat(16385),{headers:{'Content-Type':'application/json'}});},
  f=>{f.args.buildIdentity={CF_ACCESS_CLIENT_SECRET:'tool-secret'};}
 ]){const f=buildGuardFixture();change(f);await assert.rejects(callAutonomyControl(f.env,f.args,f.deps),error=>!error.message.includes('secret-containing'));assert.equal(f.values.has('autonomy:relay'),false);assert.equal(f.calls.length,0);}
});

test('build setup preserves unknown existing secrets and changed trigger ownership',async()=>{
 for(const change of [
  f=>{f.trigger.repo_connection.repo_name='another';},f=>{f.trigger.branch_includes=['main','*'];},f=>{f.trigger.external_script_id='b'.repeat(32);},
  f=>{f.trigger.trigger_uuid='another';},f=>{f.trigger.root_directory='/subproject';},f=>{f.trigger.deploy_command='unreviewed command';},
  f=>{f.variables.CF_ACCESS_CLIENT_SECRET={value:null,is_secret:true,created_on:'2020-01-01T00:00:00Z'};},
  f=>{for(const key of ['CF_ACCESS_CLIENT_ID','CF_ACCESS_CLIENT_SECRET'])f.variables[key]={value:null,is_secret:true,created_on:'2020-01-01T00:00:00Z'};}
 ]){const f=buildGuardFixture();change(f);await assert.rejects(callAutonomyControl(f.env,f.args,f.deps));assert.equal(f.values.get('autonomy:relay').held,true);assert.equal(f.calls.filter(c=>c.method==='PATCH').length,0);}
});

test('uncertain build writes remain held and are reconciled without replaying successful writes',async()=>{
 for(const suffix of ['/environment_variables','/364453c2-c933-447a-9b19-451dff930e90']){
  const f=buildGuardFixture(),api=f.deps.buildApi;let once=true;
  f.deps.buildApi=async(path,options)=>{const result=await api(path,options);if(once&&options?.method==='PATCH'&&path.endsWith(suffix)){once=false;throw Error('Provider accidentally echoed fixture-secret');}return result;};
  await assert.rejects(callAutonomyControl(f.env,f.args,f.deps),error=>/uncertain/.test(error.message)&&!error.message.includes('fixture-secret'));
  assert.equal(f.values.get('autonomy:relay').held,true);
  const result=await callAutonomyControl(f.env,f.args,f.deps);assert.equal(result.state.held,false);
  assert.equal(f.calls.filter(c=>c.method==='PATCH'&&c.path.endsWith('/environment_variables')).length,1);
  assert.equal(f.calls.filter(c=>c.method==='PATCH'&&!c.path.endsWith('/environment_variables')).length,1);
 }
});

test('a concurrent stop wins over setup and global holds prevent provider configuration',async()=>{
 for(const global of [false,true]){
  const f=buildGuardFixture(),api=f.deps.buildApi;
  f.deps.buildApi=async(path,options)=>{const result=await api(path,options);if(options?.method==='PATCH'&&path.endsWith('/environment_variables')){
    const scope=global?'global':'relay',revision=global?0:1;
    await durableAutonomy({transaction:fn=>fn({get:async()=>f.values.get('autonomy:'+scope),put:async(_key,value)=>f.values.set('autonomy:'+scope,value)})},{action:'hold',scope,expected_revision:revision,operation_id:'concurrent-human-stop',reason:'Stop now'});
   }return result;};
  await assert.rejects(callAutonomyControl(f.env,f.args,f.deps),global?/held for global/:/revision changed/);
  assert.equal(f.values.get('autonomy:'+(global?'global':'relay')).held,true);assert.equal(f.trigger.deploy_command,'npx wrangler deploy');
 }
 const f=buildGuardFixture();f.values.set('autonomy:global',{...autonomyState('global'),held:true,reason:'Stop now'});
 await assert.rejects(callAutonomyControl(f.env,f.args,f.deps),/held for global/);assert.equal(f.calls.length,0);
});

function releaseFixture(env){
 let current=target;
 const deps={
  github:async()=>({type:'file',encoding:'base64',content:Buffer.from(JSON.stringify({id:'relay',managed:true,repository:'lrnolivia/relay',cloud:{provider:'cloudflare',worker:'relay',write:true,transport:'workers-builds',production_branch:'main',build_command:'npm run build',deploy_command:'npx wrangler deploy',rollback:profile}})).toString('base64')}),
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
 f.deps.retained=async()=>null;
 await assert.rejects(callAutonomyControl(env,args,f.deps),/not retained/);
 await assert.rejects(callAutonomyControl(env,{...args,target:{...target,compatibility_id:'changed-schema'}},f.deps),/compatibility/);
});

test('historical approval binds retained version to exact provider deployment and actual production gates',async()=>{
 function fixture(){
  const state=binding(),f=releaseFixture(state.env);state.env.RELAY_CLOUDFLARE_WRITE_SCRIPTS='relay';
  const newer={...target,version_id:'66666666-7777-8888-9999-aaaaaaaaaaaa',source_sha:'b'.repeat(40)};f.setCurrent(newer);
  Object.assign(f.deps,{
   retained:async()=>({id:version}),
   builds:async()=>[{build_uuid:'bbbbbbbb-2222-3333-4444-555555555555',build_outcome:'success',build_trigger_metadata:{commit_hash:target.source_sha,branch:'main',deploy_command:'npx wrangler deploy'}}],
   buildLogs:async(_id,cursor)=>cursor?{lines:[[1,'Current Version ID: '+version]]}:{lines:[[0,'Uploading exact build']],cursor:'page2'},
   sourceProfile:f.deps.github,
   checks:async()=>({total_count:1,check_runs:[{id:1,name:'quality',app:{slug:'github-actions'},head_sha:target.source_sha,status:'completed',conclusion:'success',html_url:'https://github.com/lrnolivia/relay/actions/runs/12/job/34'}]}),
   job:async()=>({head_sha:target.source_sha,conclusion:'success',steps:[{name:'Verify exact live source and capture actual website pages',conclusion:'success'},{name:'Retain and verify exact interactive sample build',conclusion:'success'}]}),
   fetch:async()=>{throw Error('Historical approval must not claim the newer endpoint is the older version');}
  });return {...state,...f};
 }
 const args=input('approve',0,{target,approval:{text:'Approve the older exact release',source:'human message'}});
 const good=fixture();const result=await callAutonomyControl(good.env,args,good.deps);assert.equal(result.state.last_user_approved.version_id,version);assert.equal(result.state.last_healthy,null);assert.equal(result.verified_release.currently_active,false);assert.equal(result.verified_release.production_job_id,'34');
 const eof=fixture();eof.deps.buildLogs=async(_id,cursor)=>cursor?{lines:[],cursor}:{lines:[[0,'Current Version ID: '+version]],cursor:'terminal'};assert.equal((await callAutonomyControl(eof.env,args,eof.deps)).state.last_user_approved.version_id,version);
 const changed=fixture(),oldProfile=changed.deps.github;
 changed.deps.github=async()=>{const file=await oldProfile(),value=JSON.parse(Buffer.from(file.content,'base64'));value.cloud.deploy_command=RELAY_GUARDED_DEPLOY_COMMAND;value.cloud.production_branch='new-production';return {...file,content:Buffer.from(JSON.stringify(value)).toString('base64')};};
 assert.equal((await callAutonomyControl(changed.env,args,changed.deps)).state.last_user_approved.version_id,version);
 for(const change of [
  f=>{f.deps.retained=async()=>({id:'wrong'});},
  f=>{f.deps.builds=async()=>[];},
  f=>{const original=f.deps.builds;f.deps.builds=async()=>[...(await original()),...(await original())];},
  f=>{f.deps.buildLogs=async()=>({lines:[[0,'Current Version ID: 66666666-7777-8888-9999-aaaaaaaaaaaa']]});},
  f=>{f.deps.buildLogs=async()=>({lines:[],truncated:true});},
  f=>{f.deps.buildLogs=async()=>({lines:[],cursor:'repeated'});},
  f=>{f.deps.checks=async()=>({check_runs:[]});},
  f=>{f.deps.job=async()=>({head_sha:target.source_sha,conclusion:'success',steps:[]});},
  f=>{f.deps.sourceProfile=async()=>({type:'file',encoding:'base64',content:Buffer.from(JSON.stringify({id:'relay',managed:true,cloud:{provider:'cloudflare',worker:'relay',write:true,rollback:{compatibility_id:'incompatible'}}})).toString('base64')});}
  ,f=>{const source=f.deps.sourceProfile;f.deps.sourceProfile=async()=>{const file=await source(),value=JSON.parse(Buffer.from(file.content,'base64'));value.cloud.deploy_command='unproven command';return {...file,content:Buffer.from(JSON.stringify(value)).toString('base64')};};}
  ,f=>{const source=f.deps.sourceProfile;f.deps.sourceProfile=async()=>{const file=await source(),value=JSON.parse(Buffer.from(file.content,'base64'));delete value.cloud.production_branch;return {...file,content:Buffer.from(JSON.stringify(value)).toString('base64')};};}
  ,f=>{const source=f.deps.sourceProfile;f.deps.sourceProfile=async()=>{const file=await source(),value=JSON.parse(Buffer.from(file.content,'base64'));value.repository='lrnolivia/another';return {...file,content:Buffer.from(JSON.stringify(value)).toString('base64')};};}
 ]){const f=fixture();change(f);await assert.rejects(callAutonomyControl(f.env,args,f.deps));assert.equal(f.values.has('autonomy:relay'),false);}
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

test('release probes carry only the trusted existing Access identity to the bound hostname',async()=>{
 const {env}=binding(),f=releaseFixture(env);env.RELAY_CLOUDFLARE_WRITE_SCRIPTS='relay';
 const request=f.deps.fetch;let calls=0;
 f.deps.accessJwt='synthetic-verified-identity';
 f.deps.fetch=async(url,options)=>{calls++;assert.equal(new URL(url).hostname,'relay.loew.fi');assert.deepEqual(options.headers,{'Cf-Access-Token':'synthetic-verified-identity'});return request(url,options);};
 await callAutonomyControl(env,input('healthy',0,{target}),f.deps);assert.equal(calls,2);
 const status={worker:'relay',writable:true,rollback:profile};
 await assert.rejects(verifyReleaseTarget(env,{...status,rollback:{...profile,health_url:'https://other.loew.fi/health'}},target,f.deps),/same bound Worker hostname/);assert.equal(calls,2);
 await assert.rejects(verifyReleaseTarget(env,status,target,{snapshot:f.deps.snapshot,active:f.deps.active}),/Authenticated release verification identity/);
});

test('browser and authenticated app safety routes preserve private Access context through production verification',async t=>{
 let expectedIdentity,probes=0;
 const registration={id:'relay',managed:true,repository:'lrnolivia/relay',cloud:{provider:'cloudflare',worker:'relay',write:true,rollback:profile}};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  const address=String(url);
  if(address.startsWith('https://api.github.com/'))return Response.json({type:'file',sha:'a'.repeat(40),encoding:'base64',content:Buffer.from(JSON.stringify(registration)).toString('base64')});
  if(address.startsWith('https://api.cloudflare.com/')){
   const result=address.endsWith('/deployments')?{deployments:[{id:'fixture-deployment',versions:[{version_id:version,percentage:100}]}]}:address.endsWith('/versions')?{items:[{id:version}]}:address.endsWith('/domains')?[{service:'relay',hostname:'relay.loew.fi'}]:address.endsWith('/scripts')?[{id:'relay',tag:'fixture-tag'}]:{};
   return Response.json({success:true,result});
  }
  assert.ok(address==='https://relay.loew.fi/'||address==='https://relay.loew.fi/health');
  assert.deepEqual(options.headers,{'Cf-Access-Token':expectedIdentity});assert.equal(options.redirect,'manual');probes++;
  return address.endsWith('/health')?Response.json({ok:true,service:'relay'}):new Response('fixture',{headers:{'X-Relay-Source-Sha':target.source_sha,'X-Relay-Release-Compatibility':target.compatibility_id}});
 });
 const environment=()=>{const state=binding();Object.assign(state.env,{RUNNER_GITHUB_TOKEN:'synthetic',RELAY_GITHUB_TOKEN:'synthetic',CLOUDFLARE_ACCOUNT_ID:'synthetic',CLOUDFLARE_API_TOKEN:'synthetic',RELAY_CLOUDFLARE_WRITE_SCRIPTS:'relay'});return state;};
 const args=input('healthy',0,{target});
 let state=environment();expectedIdentity='synthetic-browser-identity';
 const response=await handleApi(new Request('https://relay.loew.fi/api/autonomy',{method:'POST',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':expectedIdentity},body:JSON.stringify(args)}),state.env);
 assert.equal(response.status,200,JSON.stringify(await response.json()));assert.equal(state.values.get('autonomy:relay').last_healthy.version_id,version);
 state=environment();expectedIdentity='synthetic-mcp-identity';
 const app=await callUiApi({path:'/api/autonomy',method:'POST',body:args},state.env,{accessJwt:expectedIdentity});assert.equal(app.status,200);assert.equal(state.values.get('autonomy:relay').last_healthy.version_id,version);assert.equal(probes,4);
 state=environment();const missing=await callUiApi({path:'/api/autonomy',method:'POST',body:args},state.env);assert.equal(missing.status,503);assert.match(missing.body.error,/Authenticated release verification identity/);assert.equal(state.values.has('autonomy:relay'),false);assert.equal(probes,4);
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

test('authorization/provider failures cannot trigger compiled fallback and a new stop blocks pending recovery writes',async()=>{
 const pending=transitionAutonomy(transitionAutonomy(null,input('healthy',0,{target})).state,input('prepare_rollback',1,{kind:'healthy',expected_current_version:'66666666-7777-8888-9999-aaaaaaaaaaaa'})).state;
 const {env,values}=binding({'autonomy:relay':pending});Object.assign(env,{CLOUDFLARE_ACCOUNT_ID:'test',CLOUDFLARE_API_TOKEN:'test'});
 const original=globalThis.fetch;let calls=0;
 try{
  for(const status of [403,429,503]){
   calls=0;globalThis.fetch=async()=>{calls++;return Response.json({success:false,errors:[{message:'Synthetic provider rejection'}]},{status});};
   await assert.rejects(recoverCloudVersion(env,'relay',pending.rollback.operation_id),error=>error.status===status);assert.equal(calls,1);
  }
  values.set('autonomy:relay',transitionAutonomy(pending,input('hold',2,{operation_id:'later-human-stop-fixture'})).state);
  calls=0;await assert.rejects(recoverCloudVersion(env,'relay',pending.rollback.operation_id),/Safety changed after rollback reservation/);assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});


test('compiled restoration transitions bind one upload intent and reject mismatched hashes or unsafe UUID substitution',()=>{
 const retained={...target,recovery:{archive_sha256:'a'.repeat(64),manifest_sha256:'b'.repeat(64),restore_sha256:'c'.repeat(64),artifact_id:1,ci_run:2}};
 const operation='compiled-durable-fixture',from='66666666-7777-8888-9999-aaaaaaaaaaaa',restored='bbbbbbbb-cccc-dddd-eeee-ffffffffffff',hashes={module_sha256:'d'.repeat(64),configuration_sha256:'e'.repeat(64)};
 let state=transitionAutonomy({...autonomyState('relay'),last_healthy:retained,last_user_approved:retained},input('prepare_rollback',0,{operation_id:operation,kind:'healthy',expected_current_version:from})).state;
 const prepare=input('prepare_restore_upload',1,{operation_id:operation+'-upload',result:hashes});
 assert.throws(()=>transitionAutonomy(state,{...prepare,operation_id:'another-upload-operation'}),/exact pending/);
 state=transitionAutonomy(state,prepare).state;assert.equal(transitionAutonomy(state,prepare).duplicate,true);
 const record=input('finish_restore_upload',2,{operation_id:operation+'-record',result:{...hashes,version_id:restored}});
 for(const version_id of [version,from])assert.throws(()=>transitionAutonomy(state,{...record,result:{...record.result,version_id}}),/pending intent/);
 assert.throws(()=>transitionAutonomy(state,{...record,result:{...record.result,module_sha256:'f'.repeat(64)}}),/pending intent/);
 state=transitionAutonomy(state,record).state;assert.equal(state.rollback.target.version_id,restored);assert.equal(state.rollback.original_target.version_id,version);assert.equal(state.last_user_approved.version_id,version);assert.equal(state.last_healthy.version_id,version);
 assert.throws(()=>transitionAutonomy(state,input('finish_rollback',3,{result:{state:'verified',version_id:version,evidence:'Wrong original provider UUID'}})),/pending exact target/);
});
