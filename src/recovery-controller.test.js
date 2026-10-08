import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recoveryControllerResponse} from './recovery-controller.js';
import {autonomyState,transitionAutonomy} from './autonomy-control.js';

const request=body=>new Request('https://relay.loew.fi/recovery-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const env={RELAY_AUTONOMY_GUARD:'enforced',RELAY_EVENTS:{},RELAY_CANONICAL_REPOSITORY:'lrnolivia/relay',RELAY_CLOUDFLARE_WRITE_SCRIPTS:'relay'};
const verify=async()=>({token:'synthetic-verified-identity'});
test('controller authenticates before durable access and exposes no approval, promotion, arbitrary scope or provider API',async()=>{
 let calls=0;const control=async()=>{calls++;return {ok:true};};
 assert.equal((await recoveryControllerResponse(request({action:'status',scope:'relay'}),env,{verify:async()=>null,control})).status,401);
 for(const input of [{action:'approve',scope:'relay'},{action:'healthy',scope:'relay'},{action:'prepare_restore_upload',scope:'relay'},{action:'rollback',scope:'global'},{action:'hold',scope:'field'}])assert.equal((await recoveryControllerResponse(request(input),env,{verify,control})).status,400);
 assert.equal(calls,0);
 assert.equal((await recoveryControllerResponse(request({action:'rollback',scope:'relay'}),env,{verify,control})).status,503);assert.equal(calls,0);
 const oversized=request({action:'status',scope:'relay',extra:'a'.repeat(9000)});assert.equal((await recoveryControllerResponse(oversized,env,{verify,control})).status,400);
 assert.equal((await recoveryControllerResponse(request({action:'status',scope:'relay'}),{...env,RELAY_AUTONOMY_GUARD:'disabled'},{verify,control})).status,503);
});
test('controller directly preserves durable holds/CAS/idempotency without invoking the product HTTP handler',async()=>{
 const states=new Map(),runtime={...env,RELAY_EVENTS:{idFromName:x=>x,get:name=>({fetch:async(_url,options)=>{
  try{const result=transitionAutonomy(states.get(name),JSON.parse(options.body));states.set(name,result.state);return Response.json({ok:true,...result});}catch(error){return Response.json({error:error.message},{status:409});}
 }})}};
 const hold={action:'hold',scope:'global',expected_revision:0,operation_id:'external-controller-hold',reason:'Synthetic direct user stop'};
 const first=await recoveryControllerResponse(request(hold),runtime,{verify}),body=await first.json();assert.equal(first.status,200);assert.equal(body.state.held,true);assert.equal(body.state.revision,1);
 assert.equal((await (await recoveryControllerResponse(request(hold),runtime,{verify})).json()).duplicate,true);
 const stale={action:'resume',scope:'global',expected_revision:0,operation_id:'external-controller-resume',reason:'Synthetic direct instruction',authorization:'Synthetic explicit resume'};assert.equal((await recoveryControllerResponse(request(stale),runtime,{verify})).status,409);
 assert.equal((await (await recoveryControllerResponse(request({...stale,expected_revision:1}),runtime,{verify})).json()).state.held,false);
});
test('only verified Access context reaches rollback; errors and configuration never disclose provider secrets',async()=>{
 const runtime={...env,CLOUDFLARE_ACCOUNT_ID:'8df30cd302a4d4a4c01db9863c712166',CLOUDFLARE_API_TOKEN:'synthetic-provider-secret',EVIDENCE:{}},input={action:'rollback',scope:'relay'};
 const response=await recoveryControllerResponse(request(input),runtime,{verify,control:async(actual,args,deps)=>{assert.equal(actual,runtime);assert.deepEqual(args,input);assert.deepEqual(deps,{accessJwt:'synthetic-verified-identity'});throw Error('Synthetic provider accidentally echoed synthetic-provider-secret');}});
 assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/synthetic-provider-secret/);
 const config=JSON.parse(await readFile(new URL('../recovery/wrangler.jsonc',import.meta.url),'utf8'));assert.equal(config.name,'relay-recovery');assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.deepEqual(config.routes,[]);assert.equal(config.migrations,undefined);assert.equal(config.durable_objects.bindings[0].script_name,'relay');assert.equal(config.vars.CLOUDFLARE_API_TOKEN,undefined);assert.equal(config.triggers,undefined);
});

test('independent source inspection binds canonical guarded provider output to an unchanged exact active deployment',async()=>{
 const runtime={...env,CLOUDFLARE_ACCOUNT_ID:'8df30cd302a4d4a4c01db9863c712166',CLOUDFLARE_API_TOKEN:'synthetic-provider',CLOUDFLARE_BUILDS_API_TOKEN:'synthetic-read-provider',EVIDENCE:{}},version='11111111-2222-3333-4444-555555555555',input={action:'inspect_release',scope:'relay',source_sha:'a'.repeat(40),version_id:version};
 const profile={repository:'lrnolivia/relay',worker:'relay',transport:'workers-builds',production_branch:'main',writable:true,rollback:{compatibility_id:'relay-autonomy-v1'}};let reads=0,proofs=0;
 const deps={verify,registration:async()=>profile,active:async()=>{reads++;return {version_id:version,deployment_id:'synthetic-deployment'};},providerSource:async(actual,target,config)=>{proofs++;assert.equal(actual,runtime);assert.deepEqual(target,{worker:'relay',source_sha:input.source_sha,version_id:version});assert.deepEqual(config,{branch:'main',deploy_command:'node scripts/autonomy-gate.mjs relay && npx wrangler deploy'});return 'synthetic-build';}};
 const first=await recoveryControllerResponse(request(input),runtime,deps),body=await first.json();assert.equal(first.status,200);assert.equal(body.verification,'canonical-provider-build+active-deployment');assert.equal(reads,2);assert.equal(proofs,1);
 let count=0;const changed=await recoveryControllerResponse(request(input),runtime,{...deps,active:async()=>({version_id:version,deployment_id:count++?'changed':'original'})});assert.equal(changed.status,503);
 const denied=await recoveryControllerResponse(request(input),runtime,{...deps,registration:async()=>({...profile,repository:'another/project'})});assert.equal(denied.status,503);
 const unsupported=await recoveryControllerResponse(request({...input,url:'https://untrusted.example'}),runtime,deps);assert.equal(unsupported.status,400);
 const status=await recoveryControllerResponse(request({action:'cloud_status',scope:'relay'}),runtime,{verify,snapshot:async()=>({deployments:{deployments:[]},versions:{items:[{id:version,private:'omit'}]},domains:[],settings:{secret:'must never disclose'}})});const serialized=await status.text();assert.doesNotMatch(serialized,/private|secret|must never/);
});
