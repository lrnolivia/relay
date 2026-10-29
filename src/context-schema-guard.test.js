import test from 'node:test';
import assert from 'node:assert/strict';
import {contextSchemaFloor,readContextSchemaFloor,assertContextSource,assertContextTarget,assertContextVersion} from './context-schema-guard.js';
import {publicAutonomyStatus,autonomyState,transitionAutonomy} from './autonomy-control.js';
import {deployCloudVersion,recoverCloudVersion} from './cloud.js';
import {deployProjectCloudVersion,callAutonomyControl} from './project-cloud.js';
const sha='a'.repeat(40),old='b'.repeat(40),version='11111111-2222-3333-4444-555555555555';
const file=text=>({type:'file',encoding:'base64',content:Buffer.from(typeof text==='string'?text:JSON.stringify(text)).toString('base64')});
function fixture(floor=2){
 const registration={id:'relay',managed:true,repository:'lrnolivia/relay',cloud:{provider:'cloudflare',worker:'relay',write:true,rollback:{compatibility_id:'v1',source_header:'X-Source',compatibility_header:'X-Compatibility',identity_url:'https://relay.loew.fi/',health_url:'https://relay.loew.fi/health',...(floor===undefined?{}:{minimum_context_schema:floor})}}};
 const reads=[];const github=async path=>{reads.push(path);if(path==='/repos/lrnolivia/relay/contents/projects/relay.json?ref=main')return file(registration);if(!path.endsWith('?ref='+sha))throw Error('Unavailable exact artifact');return file(path.includes('context-storage.mjs')?'export const CONTEXT_STORAGE_SCHEMA_CAPABILITY = 2;':'export const CONTEXT_SCHEMA_GUARD_VERSION = 1;');};
 const state=autonomyState('relay');state.last_healthy={worker:'relay',version_id:version,source_sha:sha,compatibility_id:'v1',evidence:'fixture'};
 const env={RELAY_AUTONOMY_GUARD:'enforced',RELAY_CLOUDFLARE_WRITE_SCRIPTS:'relay',CLOUDFLARE_ACCOUNT_ID:'a',CLOUDFLARE_API_TOKEN:'fixture',RELAY_EVENTS:{idFromName:x=>x,get:name=>({fetch:async(_url,options)=>{const input=JSON.parse(options.body);if(name==='autonomy:global')return Response.json({ok:true,state:autonomyState('global')});const next=transitionAutonomy(state,input);Object.assign(state,next.state);return Response.json({ok:true,state});}})}};
 return {github,registration,reads,state,env};
}
test('floor absent remains compatible; malformed floor and registration fail closed',async()=>{
 assert.equal(contextSchemaFloor(null),null);assert.equal(contextSchemaFloor({}),null);
 for(const value of [null,1,3,'2',false])assert.throws(()=>contextSchemaFloor({minimum_context_schema:value}),/Unsupported/);
 const f=fixture();assert.equal(await readContextSchemaFloor(f.env,f.github),2);f.registration.repository='other/relay';await assert.rejects(readContextSchemaFloor(f.env,f.github),/identity/);
});
test('floor requires exact source to preserve reader AND guard, not just claimed version metadata',async()=>{
 const f=fixture();await assertContextSource(f.env,sha,2,f.github);assert.equal(f.reads.length,2);
 await assert.rejects(assertContextSource(f.env,old,2,f.github),/Unavailable/);
 await assert.rejects(assertContextSource(f.env,sha,2,async path=>file(path.includes('context-storage')?'export const CONTEXT_STORAGE_SCHEMA_CAPABILITY = 2;':'// old runtime')),/publication floor/);
 await assert.rejects(assertContextSource(f.env,'main',2,f.github),/Exact/);
 await assert.rejects(assertContextSource(f.env,sha,2,async()=>({...file(''),truncated:true})),/unavailable/);
 await assertContextSource(f.env,old,null,()=>{throw Error('must not read');});
});
test('raw version proof derives only unambiguous retained durable target identity',async()=>{
 const f=fixture();await assertContextVersion(f.env,'relay',version,f.state,{github:f.github});
 await assert.rejects(assertContextVersion(f.env,'relay','22222222-2222-3333-4444-555555555555',f.state,{github:f.github}),/Retained/);
 f.state.last_user_approved={...f.state.last_healthy,source_sha:old};await assert.rejects(assertContextVersion(f.env,'relay',version,f.state,{github:f.github}),/Retained/);
 await assertContextTarget(f.env,'field',null,{github:()=>{throw Error('unrelated');}});
});
test('server build gate rejects missing, old or guardless candidate and admits compatible source',async()=>{
 const f=fixture();let value=await publicAutonomyStatus(f.env,'relay',null,f.github);assert.equal(value.candidate_identity_required,true);
 value=await publicAutonomyStatus(f.env,'relay',old,f.github);assert.equal(value.candidate_blocked,true);
 value=await publicAutonomyStatus(f.env,'relay',sha,f.github);assert.equal(value.candidate_blocked,false);
 f.registration.cloud.rollback.minimum_context_schema='2';await assert.rejects(publicAutonomyStatus(f.env,'relay',sha,f.github),/Unsupported/);
});
test('raw and project deployment reject unproven source before injected provider writes',async()=>{
 const f=fixture();f.state.last_healthy.source_sha=old;let writes=0;const before=globalThis.fetch;globalThis.fetch=async()=>{writes++;throw Error('Provider must not be reached');};
 try{await assert.rejects(deployCloudVersion(f.env,'relay',version,'fixture',{github:f.github}),/Unavailable/);await assert.rejects(deployProjectCloudVersion(f.env,'relay',version,'fixture',{github:f.github,deploy:()=>{writes++;}}),/Unavailable/);assert.equal(writes,0);}finally{globalThis.fetch=before;}
});
test('rollback and healthy promotion reject incompatible target without durable preparation/provider mutation',async()=>{
 const f=fixture();f.state.last_healthy.source_sha=old;let provider=0;
 await assert.rejects(callAutonomyControl(f.env,{action:'healthy',scope:'relay',expected_revision:0,operation_id:'floor-healthy-test',reason:'fixture',target:f.state.last_healthy},{github:f.github,snapshot:()=>{provider++;}}),/Unavailable/);assert.equal(f.state.revision,0);
 await assert.rejects(callAutonomyControl(f.env,{action:'rollback',scope:'relay',expected_revision:0,operation_id:'floor-rollback-test',reason:'fixture',kind:'healthy',expected_current_version:version},{github:f.github,recover:()=>{provider++;}}),/Unavailable/);assert.equal(f.state.held,true);assert.equal(f.state.rollback,null);assert.equal(provider,0);
});
test('pending recovery rejects incompatible original before retained artifact lookup or restoration upload',async()=>{
 const f=fixture();f.state.last_healthy.source_sha=old;
 Object.assign(f.state,transitionAutonomy(f.state,{action:'prepare_rollback',scope:'relay',expected_revision:0,operation_id:'floor-recover-test',reason:'fixture',kind:'healthy',expected_current_version:version}).state);
 let writes=0;const before=globalThis.fetch;globalThis.fetch=async()=>{writes++;throw Error('Provider must not be reached');};
 try{await assert.rejects(recoverCloudVersion(f.env,'relay','floor-recover-test',{github:f.github}),/Unavailable/);assert.equal(writes,0);}finally{globalThis.fetch=before;}
});
test('compatible raw publication retains existing provider path and exact version without configuration writes',async()=>{
 const f=fixture(),calls=[],before=globalThis.fetch;globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return Response.json({success:true,result:{id:'deployment'}});};
 try{const result=await deployCloudVersion(f.env,'relay',version,'compatible fixture',{github:f.github});assert.equal(result.version_id,version);assert.equal(calls.length,1);assert.match(calls[0].url,/\/workers\/scripts\/relay\/deployments$/);assert.equal(calls[0].options.method,'POST');const body=JSON.parse(calls[0].options.body);assert.deepEqual(body.versions,[{version_id:version,percentage:100}]);assert.equal(body.bindings,undefined);}finally{globalThis.fetch=before;}
});
test('absent floor does not require durable target proof or source capability',async()=>{
 const f=fixture();delete f.registration.cloud.rollback.minimum_context_schema;
 await assertContextVersion(f.env,'relay',version,null,{github:f.github});assert.equal(f.reads.length,1);
 const value=await publicAutonomyStatus(f.env,'relay',null,f.github);assert.equal(value.candidate_identity_required,undefined);assert.equal(value.candidate_blocked,undefined);
});
