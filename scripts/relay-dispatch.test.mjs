import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {dispatchExecution,hostCommand,validateHosts,probeExecutionHost,openRoutingReceipt} from './relay-dispatch.mjs';

const host=(id,transport='local')=>({id,transport,...(transport==='ssh'?{destination:'existing-host'}:{}),node:'/runtime/node',script:'/relay/scripts/relay-dispatch.mjs',config:'/private/executor.json',workspace:'/checkout',state_directory:'/private/receipts'});
function fixture(required=['codex-cli','source-byte-checkpoints-v1']){
 const config={project:'relay',assignment:'existing',owner:'owner',branch:'work',job_id:'job_123',hosts:[host('local'),host('remote','ssh')]};
 let job={id:config.job_id,owner:config.owner,branch:config.branch,state:'queued',revision:1,initial_head_sha:'a'.repeat(40),required_capabilities:required};
 const receipts=[],launches=[],f={config,receipts,launches,reads:0,setJob(value){job={...job,...value};}};
 f.rpc=async()=>{f.reads++;return {job:{...job}};};
 f.probe=async h=>({schema:1,project:config.project,assignment:config.assignment,owner:config.owner,branch:config.branch,job_id:config.job_id,executor_id:h.id,head_sha:job.initial_head_sha,ready:true,capabilities:['codex-cli','source-byte-checkpoints-v1']});
 f.launch=async h=>{launches.push(h.id);job={...job,state:'succeeded',executor_id:h.id};return {exit_code:0};};
 f.persist=async value=>receipts.push(structuredClone(value));
 f.run=()=>dispatchExecution(f);return f;
}
test('live eligible hosts follow configured preference, persist before one dispatch and retain truthful completion',async()=>{
 const f=fixture(),original=f.launch;f.launch=async h=>{assert.equal(f.receipts.at(-1).state,'dispatching');return original(h);};
 const result=await f.run();assert.deepEqual(f.launches,['local']);assert.equal(result.state,'accounted');assert.equal(result.objective_completed,false);assert.equal(result.reported_job_state,'succeeded');
});
test('unavailable and incapable local hosts select a capable configured remote without invented readiness',async()=>{
 for(const unavailable of [false,true]){
  const f=fixture(),probe=f.probe;f.probe=async h=>{if(h.id==='local'){if(unavailable)throw Error('synthetic-secret');return {...await probe(h),capabilities:['codex-cli']};}return probe(h);};
  const result=await f.run();assert.deepEqual(f.launches,['remote']);assert.equal(result.candidates[0].reason,unavailable?'unavailable':'missing-capability');assert.doesNotMatch(JSON.stringify(result),/synthetic-secret/);
 }
});
test('head, owner, branch and executor identity mismatch cannot route; expired/terminal jobs never dispatch',async()=>{
 for(const patch of [{head_sha:'b'.repeat(40)},{owner:'other'},{branch:'other'},{executor_id:'other'},{job_id:'other'},{ready:false}]){
  const f=fixture(),probe=f.probe;f.probe=async h=>({...await probe(h),...patch});assert.equal((await f.run()).state,'no-eligible-host');assert.equal(f.launches.length,0);
 }
 for(const state of ['running','failed','cancelled','succeeded','recovery_required']){const f=fixture();f.setJob({state});await assert.rejects(f.run());assert.equal(f.launches.length,0);}
});
test('changed admission or failed receipt storage prevents process launch',async()=>{
 const f=fixture(),probe=f.probe;f.probe=async h=>{const result=await probe(h);f.setJob({revision:2});return result;};assert.equal((await f.run()).state,'admission-changed');assert.equal(f.launches.length,0);
 const storage=fixture();storage.persist=async value=>{if(value.state==='dispatching')throw Error('disk failed');};await assert.rejects(storage.run(),/disk/);assert.equal(storage.launches.length,0);
});
test('an uncertain launch never falls through to another host or claims success from process exit',async()=>{
 for(const mode of ['throw','unaccounted']){
  const f=fixture();f.launch=async h=>{f.launches.push(h.id);if(mode==='throw')throw Error('synthetic-secret');return {exit_code:0};};
  const result=await f.run();assert.equal(result.state,'reconciliation-required');assert.deepEqual(f.launches,['local']);assert.doesNotMatch(JSON.stringify(result),/synthetic-secret/);
 }
});
test('SSH cannot change host trust or receive credentials/options; shell paths are quoted as data',()=>{
 const remote={...host('remote','ssh'),config:"/private/a 'quoted' $(command).json"};const command=hostCommand(remote,'probe');
 assert.equal(command.file,'ssh');assert.ok(command.args.includes('BatchMode=yes'));assert.ok(command.args.includes('StrictHostKeyChecking=yes'));assert.ok(command.args.includes('ConnectTimeout=5'));
 assert.ok(command.args.includes('ForwardAgent=no'));assert.ok(command.args.includes('ClearAllForwardings=yes'));assert.ok(command.args.includes('SendEnv=-*'));
 assert.equal(command.args.at(-2),'existing-host');assert.match(command.args.at(-1),/a '\\''quoted'\\'' \$\(command\)/);
 for(const destination of ['-oProxyCommand=bad','user@host;bad','host\ncommand','a@b@c'])assert.throws(()=>hostCommand({...remote,destination},'run'));
 assert.throws(()=>validateHosts([remote,remote]));assert.throws(()=>validateHosts([{...remote,token:'synthetic'}]));assert.throws(()=>hostCommand(remote,'arbitrary'));
});
test('routing receipt is private, exclusive, outside source and rejects symlink parents',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(tmpdir(),'relay-route-receipt-'))),workspace=path.join(root,'source');
 try{
  await fs.mkdir(workspace);const hosts=[{...host('local'),workspace}],file=path.join(root,'route.json');
  const handle=await openRoutingReceipt(file,hosts);await handle.write('preserved');await handle.close();assert.equal((await fs.stat(file)).mode&0o777,0o600);
  await assert.rejects(openRoutingReceipt(file,hosts),{code:'EEXIST'});assert.equal(await fs.readFile(file,'utf8'),'preserved');
  await assert.rejects(openRoutingReceipt(path.join(workspace,'route.json'),hosts),/outside source/);
  await fs.symlink(root,path.join(root,'alias'));await assert.rejects(openRoutingReceipt(path.join(root,'alias','new.json'),hosts),/symlink/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('actual local Git probe is read-only and refuses dirty source and existing executor locks',async()=>{
 const root=await fs.mkdtemp(path.join(tmpdir(),'relay-routing-test-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'private');
 try{
  await fs.mkdir(workspace);const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git(['init','-b','work']);git(['config','user.name','Test']);git(['config','user.email','test@example.invalid']);await fs.writeFile(path.join(workspace,'file.txt'),'preserved');git(['add','file.txt']);git(['commit','-m','fixture']);git(['remote','add','origin','https://github.com/lrnolivia/relay']);
  const config={project:'relay',assignment:'existing',owner:'owner',branch:'work',job_id:'job_123',executor_id:'local'};
  const job={id:config.job_id,repository:'lrnolivia/relay',state:'queued',owner:config.owner,branch:config.branch,initial_head_sha:git(['rev-parse','HEAD']),objective:{paths:['file.txt']}};
  const rpc=async(name,args)=>{assert.equal(name,'relay_execution');assert.equal(args.action,'status');return {job};};
  const input={config,workspace,stateDir,rpc,getVersion:()=> 'codex-cli fixture'};
  const result=await probeExecutionHost(input);assert.equal(result.ready,true);assert.equal(result.credential_execution_verified,false);await assert.rejects(fs.stat(stateDir),{code:'ENOENT'});
  await fs.writeFile(path.join(workspace,'file.txt'),'dirty');await assert.rejects(probeExecutionHost(input),/clean admitted/);git(['checkout','--','file.txt']);
  await fs.mkdir(path.join(stateDir,'executor.lock'),{recursive:true});await assert.rejects(probeExecutionHost(input),/lock/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
