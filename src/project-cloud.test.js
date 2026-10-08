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
  await writeFile(main, `import {verifyReleaseTarget} from ${JSON.stringify(new URL('./project-cloud.js',import.meta.url).pathname)};
    export default {async fetch(){try{
      const target={worker:'relay',version_id:'11111111-2222-3333-4444-555555555555',source_sha:'a'.repeat(40),compatibility_id:'relay-v1'};
      const status={worker:'relay',writable:true,rollback:{identity_url:'https://relay.loew.fi/',health_url:'https://relay.loew.fi/health',source_header:'X-Relay-Source-Sha',compatibility_header:'X-Relay-Release-Compatibility',compatibility_id:'relay-v1'}};
      const proof=await verifyReleaseTarget({},status,target,{
        snapshot:async()=>({deployments:[{versions:[{version_id:target.version_id,percentage:100}]}],versions:[{id:target.version_id}],domains:[{service:'relay',hostname:'relay.loew.fi'}]}),
        active:async()=>({version_id:target.version_id,deployment_id:'fixture'}),
        fetch:async(url,options)=>{const request=new Request(url,options);if(request.redirect!=='manual')throw Error('Redirect policy changed');return url.endsWith('/health')?Response.json({ok:true,service:'relay'}):new Response('fixture',{headers:{'X-Relay-Source-Sha':target.source_sha,'X-Relay-Release-Compatibility':target.compatibility_id}});}
      });return Response.json({ok:true,proof});
    }catch(error){return Response.json({error:error.message},{status:500});}}};`);
  const harness=createTestHarness({root:directory,workers:[{config:{name:'relay-release-runtime',main,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags}}]});
  try{await harness.listen();const response=await harness.fetch('/');const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.proof.source_sha,'a'.repeat(40));}
  finally{await harness.close();await rm(directory,{recursive:true,force:true});}
});
