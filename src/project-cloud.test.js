import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectCloudStatus, deployProjectCloudVersion } from "./project-cloud.js";

const registration = cloud => ({ id:"field", managed:true, repository:"lrnolivia/field", cloud });
const apiFor = value => async path => {
  assert.match(path, /projects\/field\.json\?ref=main$/);
  return { type:"file", encoding:"base64", truncated:false, content:Buffer.from(JSON.stringify(value)).toString("base64") };
};

test("project registration and runtime allowlist are both required", async () => {
  const env={RELAY_CLOUDFLARE_WRITE_SCRIPTS:"relay,field"};
  const status=await projectCloudStatus(env,"field",apiFor(registration({provider:"cloudflare",worker:"field",write:true})));
  assert.equal(status.writable,true);
  const denied=await projectCloudStatus({RELAY_CLOUDFLARE_WRITE_SCRIPTS:"relay"},"field",apiFor(registration({provider:"cloudflare",worker:"field",write:true})));
  assert.equal(denied.writable,false);
});
test("non-Worker project is not deployable merely because it is registered", async () => {
  const status=await projectCloudStatus({RELAY_CLOUDFLARE_WRITE_SCRIPTS:"relay"},"field",apiFor(registration(null)));
  assert.equal(status.worker,null); assert.equal(status.writable,false);
});
test("project deploy resolves Worker from registration and preserves runtime safety rail", async () => {
  let called=null;
  const result=await deployProjectCloudVersion(
    {RELAY_CLOUDFLARE_WRITE_SCRIPTS:"relay,field"},"field","11111111-2222-3333-4444-555555555555","ship",
    {github:apiFor(registration({provider:"cloudflare",worker:"field",write:true})),deploy:async(worker,version,message)=>{called={worker,version,message};return {ok:true,script:worker,version_id:version};}}
  );
  assert.deepEqual(called,{worker:"field",version:"11111111-2222-3333-4444-555555555555",message:"ship"});
  assert.equal(result.project,"field");
});

test("project cloud status exposes canonical Git-native transport policy", async () => {
  const cloud={
    provider:"cloudflare",
    worker:"field",
    write:true,
    transport:"workers-builds",
    production_branch:"main",
    build_command:"npm run build",
    deploy_command:"npx wrangler deploy",
    manual_upload:"recovery-only"
  };
  const status=await projectCloudStatus({RELAY_CLOUDFLARE_WRITE_SCRIPTS:"field"},"field",apiFor(registration(cloud)));
  assert.equal(status.transport,"workers-builds");
  assert.equal(status.production_branch,"main");
  assert.equal(status.build_command,"npm run build");
  assert.equal(status.deploy_command,"npx wrangler deploy");
  assert.equal(status.manual_upload,"recovery-only");
});

test('release verification request options work in the actual pinned edge runtime', {timeout:30000}, async()=>{
  const {createTestHarness}=await import('wrangler');
  const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  const directory=await mkdtemp(join(tmpdir(),'relay-release-runtime-'));
  const main=join(directory,'worker.mjs');
  await writeFile(main, `import {verifyReleaseTarget,callAutonomyControl,RELAY_GUARDED_DEPLOY_COMMAND} from ${JSON.stringify(new URL('./project-cloud.js',import.meta.url).pathname)};
    export {RelayEvents} from ${JSON.stringify(new URL('./relay-events.js',import.meta.url).pathname)};
    export default {async fetch(request,env){try{
      if(new URL(request.url).pathname==='/setup'){
        const tag='a'.repeat(32),trigger={trigger_uuid:'364453c2-c933-447a-9b19-451dff930e90',external_script_id:tag,root_directory:'/',branch_includes:['main'],branch_excludes:[],build_command:'npm run build',deploy_command:'npx wrangler deploy',repo_connection:{provider_type:'github',provider_account_name:'lrnolivia',repo_name:'relay'}};
        const variables={};
        const result=await callAutonomyControl({...env,CLOUDFLARE_ACCOUNT_ID:'fixture',CLOUDFLARE_BUILDS_API_TOKEN:'fixture-builds',RELAY_AUTONOMY_GUARD:'enforced'},{action:'configure_build_guard',scope:'relay',expected_revision:0,operation_id:'runtime-build-guard',reason:'Synthetic runtime test',authorization:'Synthetic test resume'}, {
          accessJwt:'verified.'+Buffer.from(JSON.stringify({common_name:'synthetic-id'})).toString('base64url')+'.signature',buildIdentity:{CF_ACCESS_CLIENT_ID:'synthetic-id',CF_ACCESS_CLIENT_SECRET:'synthetic-secret'},
          github:async()=>({type:'file',encoding:'base64',content:Buffer.from(JSON.stringify({id:'relay',managed:true,repository:'lrnolivia/relay',cloud:{provider:'cloudflare',worker:'relay',write:true,transport:'workers-builds',production_branch:'main',build_command:'npm run build',deploy_command:'npx wrangler deploy'}})).toString('base64')}),
          identityFetch:async(url,options)=>{const probe=new Request(url,options);if(probe.redirect!=='manual'||probe.headers.get('CF-Access-Client-Secret')!=='synthetic-secret')throw Error('Runtime identity confinement failed');return Response.json({schema:1,scope:new URL(url).searchParams.get('scope'),revision:0,held:false,enforced:true});},
          buildApi:async(path,options={})=>{
            if(path.endsWith('/workers/scripts'))return [{id:'relay',tag}];
            if(path.endsWith('/triggers'))return [trigger];
            if(path.endsWith('/environment_variables')){if(options.method==='PATCH')for(const key of Object.keys(options.body))variables[key]={is_secret:true,value:null,created_on:new Date().toISOString()};return variables;}
            if(options.method!=='PATCH'||options.body.deploy_command!==RELAY_GUARDED_DEPLOY_COMMAND)throw Error('Unexpected provider write');trigger.deploy_command=options.body.deploy_command;return trigger;
          }
        });return Response.json(result);
      }
      const target={worker:'relay',version_id:'11111111-2222-3333-4444-555555555555',source_sha:'a'.repeat(40),compatibility_id:'relay-v1'};
      const status={worker:'relay',writable:true,rollback:{identity_url:'https://relay.loew.fi/',health_url:'https://relay.loew.fi/health',source_header:'X-Relay-Source-Sha',compatibility_header:'X-Relay-Release-Compatibility',compatibility_id:'relay-v1'}};
      const proof=await verifyReleaseTarget({},status,target,{
        accessJwt:'synthetic-verified-identity',
        snapshot:async()=>({deployments:[{versions:[{version_id:target.version_id,percentage:100}]}],versions:[{id:target.version_id}],domains:[{service:'relay',hostname:'relay.loew.fi'}]}),
        active:async()=>({version_id:target.version_id,deployment_id:'fixture'}),
        fetch:async(url,options)=>{const request=new Request(url,options);if(request.redirect!=='manual'||request.headers.get('Cf-Access-Token')!=='synthetic-verified-identity')throw Error('Authenticated redirect policy changed');return url.endsWith('/health')?Response.json({ok:true,service:'relay'}):new Response('fixture',{headers:{'X-Relay-Source-Sha':target.source_sha,'X-Relay-Release-Compatibility':target.compatibility_id}});}
      });return Response.json({ok:true,proof});
    }catch(error){return Response.json({error:error.message},{status:500});}}};`);
  const harness=createTestHarness({root:directory,workers:[{config:{name:'relay-release-runtime',main,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags,durable_objects:config.durable_objects,migrations:config.migrations}}]});
  try{
    await harness.listen();const response=await harness.fetch('/');const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.proof.source_sha,'a'.repeat(40));
    const setup=await harness.fetch('/setup'),result=await setup.json();assert.equal(setup.status,200,JSON.stringify(result));assert.equal(result.state.revision,2);assert.equal(result.state.held,false);assert.equal(result.build_guard.configuration_readback_verified,true);assert.doesNotMatch(JSON.stringify(result),/synthetic-secret|synthetic-id|synthetic-private-identity/);
  }
  finally{await harness.close();await rm(directory,{recursive:true,force:true});}
});
