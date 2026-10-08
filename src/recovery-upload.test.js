import test from 'node:test';
import assert from 'node:assert/strict';
import {autonomyState,transitionAutonomy} from './autonomy-control.js';
import {restoreExpiredCloudVersion} from './recovery-upload.js';
import {providerRecoveryConfiguration,recoveryHash} from './compiled-recovery.js';
import {recoveryVersionFixture,recoverySourceConfiguration,fixtureVersion,fixtureSource} from '../test/fixtures/recovery-archive.mjs';

const current='66666666-7777-8888-9999-aaaaaaaaaaaa',restored='bbbbbbbb-cccc-dddd-eeee-ffffffffffff',operation='compiled-recovery-fixture';
function fixture(){
 const target={worker:'relay',version_id:fixtureVersion,source_sha:fixtureSource,compatibility_id:'relay-autonomy-v1',evidence:'Synthetic recovery fixture',recovery:{archive_sha256:'a'.repeat(64),manifest_sha256:'b'.repeat(64),restore_sha256:'c'.repeat(64),artifact_id:1,ci_run:2}};
 let state=transitionAutonomy({...autonomyState('relay'),last_healthy:target,last_user_approved:{...target,approval:{text:'Synthetic explicit approval'}}},{action:'prepare_rollback',scope:'relay',expected_revision:0,operation_id:operation,reason:'Synthetic recovery',kind:'healthy',expected_current_version:current}).state;
 let global=autonomyState('global'),deployment={version_id:current,deployment_id:'synthetic-deployment'},uploaded;
 const module=Buffer.from('Synthetic compiled bytes'),saved={module,module_sha256:recoveryHash(module),manifest:{provider_configuration:providerRecoveryConfiguration(recoveryVersionFixture()),source_configuration:recoverySourceConfiguration()}};
 const f={get state(){return state;},get saved(){return saved;},writes:0,loseResponse:false,ambiguous:false,race:false,env:{RELAY_EVENTS:{idFromName:x=>x,get:()=>({fetch:async(_url,options)=>{
  try{const result=transitionAutonomy(state,JSON.parse(options.body));state=result.state;return Response.json({ok:true,...result});}catch(error){return Response.json({error:error.message},{status:409});}
 }})}}};
 f.deps={read:async()=>structuredClone({state,global}),active:async()=>deployment,retained:async t=>{assert.deepEqual(t,target);return saved;},api:async path=>{
  if(path==='/versions'){const items=uploaded?[uploaded]:[];return {items:f.ambiguous?[...items,...items]:items};}
  if(path==='/versions/'+current)return recoveryVersionFixture(current);
  if(path==='/versions/'+restored)return recoveryVersionFixture(restored);
  throw Error('Unexpected synthetic provider read '+path);
 },upload:async(metadata,bytes)=>{
  f.writes++;assert.deepEqual(bytes,module);assert.ok(metadata.bindings.every(b=>b.type==='inherit'&&b.version_id===current));assert.equal(state.rollback.restoration.state,'upload_pending');
  uploaded={id:restored,annotations:metadata.annotations};
  if(f.race)state=transitionAutonomy(state,{action:'hold',scope:'relay',expected_revision:state.revision,operation_id:'synthetic-concurrent-stop',reason:'Stop now'}).state;
  if(f.loseResponse)throw Error('Lost response after commit');return {id:restored};
 }};
 f.execute=()=>restoreExpiredCloudVersion(f.env,'relay',operation,f.deps);return f;
}
test('compiled upload records a distinct effective UUID while preserving exact healthy and user-approved identities',async()=>{
 const f=fixture(),healthy=structuredClone(f.state.last_healthy),approval=structuredClone(f.state.last_user_approved);await f.execute();
 assert.equal(f.writes,1);assert.equal(f.state.rollback.target.version_id,restored);assert.deepEqual(f.state.rollback.original_target,healthy);assert.equal(f.state.rollback.restoration.state,'uploaded');assert.equal(f.state.held,true);assert.deepEqual(f.state.last_healthy,healthy);assert.deepEqual(f.state.last_user_approved,approval);
});
test('lost provider upload reconciles its unique annotation without POSTing again; ambiguity stays held',async()=>{
 const f=fixture();f.loseResponse=true;await assert.rejects(f.execute(),/uncertain/);assert.equal(f.state.rollback.restoration.state,'upload_pending');
 f.ambiguous=true;await assert.rejects(f.execute(),/no repeated provider upload/);assert.equal(f.writes,1);
 f.ambiguous=false;await f.execute();assert.equal(f.writes,1);assert.equal(f.state.rollback.restoration.state,'uploaded');
});
test('binding drift and concurrent safety changes prevent recording or deploying a restored version',async()=>{
 const drift=fixture();drift.saved.manifest.provider_configuration.bindings[0].bucket_name='different';await assert.rejects(drift.execute(),/bindings or durable schema changed/);assert.equal(drift.writes,0);
 const race=fixture();race.race=true;await assert.rejects(race.execute(),/Safety changed/);assert.equal(race.state.held,true);assert.equal(race.state.rollback.restoration.state,'upload_pending');assert.equal(race.writes,1);
});
