import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir,lstat,rm} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {inspectToolchain,verifyBuild} from './release-toolchain.mjs';
import {runSuites} from './ci-test-orchestrator.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const output='qa-evidence/worker-runtime';
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};

export function validateWrangler(manifest,lock,installed){
  const pin=manifest.devDependencies?.wrangler;
  if(!/^\d+\.\d+\.\d+$/.test(pin||'')||lock.packages?.['node_modules/wrangler']?.version!==pin||installed!==pin)
    fail('wrangler_mismatch','Wrangler must match the exact manifest, lock and installed package version');
  return pin;
}

export function validateWorkerd(installed,locked,compatibilityDate){
  const date=/^1\.(\d{8})\.\d+$/.exec(installed||'')?.[1];
  if(installed!==locked||!date||date<compatibilityDate.replaceAll('-',''))
    fail('workerd_mismatch','Installed workerd must match the lock and support the exact compatibility date');
  return installed;
}

// Deliberate local projection: production vars, secrets, routes and remote browser
// binding are not part of this startup smoke. R2 and DO are local simulations.
export function localRuntimeConfig(config,bundle){
  const supported=new Set(['$schema','name','main','compatibility_date','compatibility_flags','workers_dev','routes','vars','browser','r2_buckets','preview_urls','triggers','durable_objects','migrations']);
  if(Object.keys(config).some(key=>!supported.has(key)))fail('unsupported_runtime_config','Review new Worker configuration before extending the local runtime gate');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(config.compatibility_date||'')||!Array.isArray(config.compatibility_flags))fail('invalid_runtime_config','Exact compatibility date and flags are required');
  if(config.durable_objects?.bindings?.some(b=>b.script_name||b.environment))fail('remote_durable_object','External Durable Objects cannot be simulated by this gate');
  return {name:'relay-runtime-smoke',main:bundle,no_bundle:true,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags,
    r2_buckets:(config.r2_buckets||[]).map(b=>({binding:b.binding,bucket_name:'local-'+b.binding.toLowerCase(),remote:false})),
    durable_objects:config.durable_objects,migrations:config.migrations};
}

export async function probeResponses(fetcher,source){
  const checks=[];
  const health=await fetcher('/health');
  assert.equal(health.status,200,'Worker health status');
  const body=await health.json();assert.equal(body.ok,true);assert.equal(body.service,'relay');
  checks.push({criterion:'worker-health',status:health.status});
  const page=await fetcher('/');assert.equal(page.status,200,'Website status');
  assert.equal(page.headers.get('x-relay-source-sha'),source,'Generated website source identity');
  assert.match(page.headers.get('content-type')||'',/text\/html/);
  await page.arrayBuffer();checks.push({criterion:'website-source',status:page.status,source_sha:source});
  for(const path of ['/mcp','/api/panel']){
    const response=await fetcher(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})});
    assert.equal(response.status,401,'Unauthenticated '+path+' must be rejected');
    assert.match(response.headers.get('www-authenticate')||'',/Bearer /);
    assert.equal((await response.json()).error,'invalid_token');
    checks.push({criterion:'unauthenticated-rejection',path,status:response.status});
  }
  return checks;
}

export function isolatedEnvironment(env){
  // No Cloudflare/GitHub credentials, user-level config, or local .dev.vars.
  return {PATH:env.PATH||'',SYSTEMROOT:env.SYSTEMROOT||'',TMPDIR:env.TMPDIR||'',CI:'true',NO_COLOR:'1',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'};
}

async function bundleRecords(directory){
  const files=[];
  async function visit(dir){for(const name of (await readdir(dir)).sort()){
    const path=join(dir,name),stat=await lstat(path);
    if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile()))fail('invalid_bundle','Bundle contains unsupported paths');
    if(stat.isDirectory())await visit(path);else{const bytes=await readFile(path);files.push({path:relative(directory,path),bytes:bytes.length,sha256:hash(bytes)});}
  }}
  await visit(directory);if(!files.some(f=>f.path==='index.js'&&f.bytes>0))fail('missing_bundle','Wrangler did not emit a nonempty index.js');
  return files;
}

async function childProbe(){
  const {createTestHarness}=await import('wrangler');
  const nativeFetch=globalThis.fetch;
  globalThis.fetch=(input,init)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))fail('outbound_blocked','Runtime smoke cannot access external network resources');
    return nativeFetch(input,init);
  };
  const config=await readJson('wrangler.jsonc');
  const harness=createTestHarness({workers:[{config:localRuntimeConfig(config,resolve(output,'bundle/index.js'))}]});
  try{
    await harness.listen();
    const checks=await probeResponses((...args)=>harness.fetch(...args),process.env.RELAY_SOURCE_SHA);
    await writeFile(resolve(output,'probe.json'),JSON.stringify({checks})+'\n');
  }finally{try{await harness.close();}finally{globalThis.fetch=nativeFetch;}}
}

export async function verifyWorkerRuntime({root=process.cwd(),env=process.env,signal}={}){
  const directory=resolve(root,output);await mkdir(directory,{recursive:true});
  const receipt={schema:1,kind:'relay-worker-runtime',state:'running',stage:'preflight',production_verified:false,authenticated_success_verified:false,checks:[]};
  const save=()=>writeFile(join(directory,'result.json'),JSON.stringify(receipt,null,2)+'\n');
  await save();
  try{
    receipt.identity=await inspectToolchain({root,env});
    await verifyBuild(await readJson(resolve(root,'qa-evidence/toolchain/build.json')),{root,env});
    const require=createRequire(resolve(root,'package.json'));
    const wranglerPath=require.resolve('wrangler/package.json'),installed=await readJson(wranglerPath);
    receipt.wrangler=validateWrangler(await readJson(resolve(root,'package.json')),await readJson(resolve(root,'package-lock.json')),installed.version);
    const config=await readJson(resolve(root,'wrangler.jsonc'));
    const workerdPath=require.resolve('workerd/package.json',{paths:[wranglerPath]});
    const lock=await readJson(resolve(root,'package-lock.json'));
    receipt.workerd=validateWorkerd(require(workerdPath).version,lock.packages[relative(root,workerdPath).replaceAll('\\','/').replace(/\/package.json$/,'')]?.version,config.compatibility_date);
    localRuntimeConfig(config,resolve(directory,'bundle/index.js'));
    const childEnv={...isolatedEnvironment(env),RELAY_SOURCE_SHA:receipt.identity.source_sha};
    const cli=resolve(wranglerPath,'..','bin/wrangler.js');
    await rm(join(directory,'bundle'),{recursive:true,force:true});await rm(join(directory,'probe.json'),{force:true});
    receipt.stage='bundle';await save();
    const run=async(id,args)=>{
      const report=await runSuites([{id,command:process.execPath,args,required:true,dependsOn:[]}],{cwd:root,env:childEnv,timeoutMs:60000,signal,onOutput:text=>process.stdout.write(text)});
      receipt[id]=report.results[0];await save();
      if(report.exit_code!==0)fail(id+'_failed','Worker '+id+' did not pass; see retained original exit and diagnostic');
    };
    await run('bundle',[cli,'deploy','--dry-run','--outdir',join(directory,'bundle'),'--config',resolve(root,'wrangler.jsonc')]);
    receipt.artifacts=await bundleRecords(join(directory,'bundle'));
    receipt.stage='startup';await save();
    await run('startup',[fileURLToPath(import.meta.url),'--probe']);
    receipt.checks=(await readJson(join(directory,'probe.json'))).checks;
    assert.equal(receipt.checks.length,4,'Every runtime criterion must have evidence');
    assert.deepEqual(await bundleRecords(join(directory,'bundle')),receipt.artifacts,'Bundle changed during startup verification');
    await verifyBuild(await readJson(resolve(root,'qa-evidence/toolchain/build.json')),{root,env});
    receipt.state='passed';receipt.stage='complete';receipt.runtime='local-workerd';
    receipt.limitations=['Local R2 and Durable Objects only; remote Browser binding omitted','No authenticated success, remote storage, Cloudflare deployment or production proof'];
    await save();return receipt;
  }catch(error){receipt.state='failed';receipt.code=/^[a-z_]+$/.test(error.code||'')?error.code:'runtime_verification_failed';await save();throw error;}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const controller=new AbortController();process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());
  const task=process.argv.length===3&&process.argv[2]==='--probe'?childProbe():process.argv.length===2?verifyWorkerRuntime({signal:controller.signal}):Promise.reject(Error('Unsupported runtime verification command'));
  task.then(()=>process.stdout.write('Worker runtime verification passed\n')).catch(error=>{process.stderr.write((error.code||'runtime_verification_failed')+': '+error.message+'\n');process.exitCode=1;});
}
