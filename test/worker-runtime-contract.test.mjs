import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateWrangler,validateWorkerd,localRuntimeConfig,probeResponses,isolatedEnvironment} from '../scripts/verify-worker-runtime.mjs';

const sha='a'.repeat(40);
const config={compatibility_date:'2026-09-29',compatibility_flags:['nodejs_compat'],vars:{PRIVATE_TOKEN:'fixture'},browser:{binding:'BROWSER',remote:true},r2_buckets:[{binding:'EVIDENCE',bucket_name:'production',remote:true}],durable_objects:{bindings:[{name:'RELAY_EVENTS',class_name:'RelayEvents'}]},migrations:[{tag:'v1',new_sqlite_classes:['RelayEvents']}],routes:[{pattern:'example.invalid',custom_domain:true}]};
const manifest={devDependencies:{wrangler:'4.148.0'}};
const lock={packages:{'node_modules/wrangler':{version:'4.148.0'}}};
test('Wrangler must be exact and match installed and lock versions',()=>{
  assert.equal(validateWrangler(manifest,lock,'4.148.0'),'4.148.0');
  for(const [m,l,v] of [[{devDependencies:{wrangler:'^4.148.0'}},lock,'4.148.0'],[manifest,lock,'4.147.0'],[manifest,{packages:{}},'4.148.0']])assert.throws(()=>validateWrangler(m,l,v),{code:'wrangler_mismatch'});
});
test('runtime date fallback or installed workerd drift cannot pass',()=>{
  assert.equal(validateWorkerd('1.20261006.1','1.20261006.1','2026-09-29'),'1.20261006.1');
  for(const [installed,locked] of [['1.20260903.1','1.20260903.1'],['1.20261006.1','1.20261005.1'],['unknown','unknown']])assert.throws(()=>validateWorkerd(installed,locked,'2026-09-29'),{code:'workerd_mismatch'});
});
test('local projection preserves compatibility and DO schema without production resources',()=>{
  const local=localRuntimeConfig(config,'/tmp/fixture/index.js');
  assert.equal(local.no_bundle,true);assert.equal(local.main,'/tmp/fixture/index.js');
  assert.deepEqual(local.compatibility_flags,config.compatibility_flags);assert.equal(local.compatibility_date,config.compatibility_date);
  assert.deepEqual(local.migrations,config.migrations);assert.deepEqual(local.durable_objects,config.durable_objects);
  assert.deepEqual(local.r2_buckets,[{binding:'EVIDENCE',bucket_name:'local-evidence',remote:false}]);
  for(const field of ['vars','browser','routes','triggers'])assert.equal(local[field],undefined);
});
test('unsupported bindings and external DOs require an explicit gate update',()=>{
  assert.throws(()=>localRuntimeConfig({...config,services:[]},'bundle'),{code:'unsupported_runtime_config'});
  assert.throws(()=>localRuntimeConfig({...config,durable_objects:{bindings:[{script_name:'production'}]}},'bundle'),{code:'remote_durable_object'});
  assert.throws(()=>localRuntimeConfig({...config,compatibility_date:''},'bundle'),{code:'invalid_runtime_config'});
});
test('child environment excludes credentials, shell hooks and secret config',()=>{
  const env=isolatedEnvironment({PATH:'/bin',HOME:'/private',NODE_OPTIONS:'--require malicious',CLOUDFLARE_API_TOKEN:'secret',GH_TOKEN:'secret',CF_ACCESS_CLIENT_SECRET:'secret'});
  assert.equal(env.PATH,'/bin');for(const key of ['HOME','NODE_OPTIONS','CLOUDFLARE_API_TOKEN','GH_TOKEN','CF_ACCESS_CLIENT_SECRET'])assert.equal(env[key],undefined);
  assert.equal(env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV,'false');
});
function fetcher(overrides={}){return async(path)=>{
  if(overrides[path])return overrides[path]();
  if(path==='/health')return Response.json({ok:true,service:'relay'});
  if(path==='/')return new Response('<!doctype html>',{headers:{'content-type':'text/html','x-relay-source-sha':sha}});
  return Response.json({error:'invalid_token'},{status:401,headers:{'www-authenticate':'Bearer resource_metadata="https://example.invalid"'}});
};}
test('every required response is checked',async()=>assert.equal((await probeResponses(fetcher(),sha)).length,4));
for(const [name,path,response] of [
  ['startup failure','/health',()=>new Response('crashed',{status:500})],
  ['wrong service','/health',()=>Response.json({ok:true,service:'other'})],
  ['stale source','/',()=>new Response('html',{headers:{'content-type':'text/html','x-relay-source-sha':'b'.repeat(40)}})],
  ['open MCP','/mcp',()=>Response.json({result:{}})],
  ['open API','/api/panel',()=>Response.json({result:{}})],
  ['missing challenge','/mcp',()=>Response.json({error:'invalid_token'},{status:401})]
])test(name+' cannot pass the runtime gate',async()=>assert.rejects(probeResponses(fetcher({[path]:response}),sha)));
test('CI runtime prerequisite precedes browser and retains failure accounting',async()=>{
  const workflow=(await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8')).split('  quality:')[1].split('  visual-review-preview:')[0];
  assert.ok(workflow.indexOf('id: setup-runtime')>workflow.indexOf('id: setup-build'));
  assert.ok(workflow.indexOf('id: setup-runtime')<workflow.indexOf('id: setup-browser'));
  assert.match(workflow,/steps\.setup-runtime\.outcome != 'success'/);
  assert.match(workflow,/RELAY_SETUP_RUNTIME:/);
  assert.match(workflow,/Preserve Worker bundle and local runtime evidence\n\s+if: always\(\)/);
});
