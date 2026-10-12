import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile,execFileSync,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {createMcpClient,changedPaths,runExecution} from './relay-executor.mjs';
import {assertSourceCheckpointRuntime,captureSourceBundle} from './relay-source-checkpoint.mjs';

const execute=promisify(execFile);
const bindings=['project','assignment','owner','branch','job_id'];
const sameJob=(a,b)=>a.id===b.id&&a.revision===b.revision&&a.owner===b.owner&&a.branch===b.branch&&a.initial_head_sha===b.initial_head_sha&&b.state==='queued';
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const absolute=value=>typeof value==='string'&&path.posix.isAbsolute(value)&&!/[\0\r\n]/.test(value);

export function validateHosts(hosts){
 if(!Array.isArray(hosts)||hosts.length<1||hosts.length>8)throw Error('Configure one to eight existing hosts');
 const ids=new Set();
 for(const host of hosts){
  if(!host||Object.keys(host).some(k=>!['id','transport','destination','node','script','config','workspace','state_directory'].includes(k))||!/^[-\w]{1,100}$/.test(host.id||'')||ids.has(host.id))throw Error('Host identity/configuration is invalid');
  ids.add(host.id);
  if(!['local','ssh'].includes(host.transport)||!['node','script','config','workspace','state_directory'].every(k=>absolute(host[k])))throw Error('Host requires explicit absolute runtime and private checkout paths');
  if(host.transport==='ssh'&&!/^[A-Za-z0-9][A-Za-z0-9_.-]*(?:@[A-Za-z0-9][A-Za-z0-9_.-]*)?$/.test(host.destination||''))throw Error('SSH requires one configured destination');
  if(host.transport==='local'&&host.destination!==undefined)throw Error('Local host cannot specify SSH destination');
 }
 return hosts;
}

export function hostCommand(host,action){
 validateHosts([host]);if(!['probe','run'].includes(action))throw Error('Unsupported host action');
 const args=[host.script,action,host.config,host.workspace,host.state_directory];
 return host.transport==='local'?{file:host.node,args}:{file:'ssh',args:['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','-o','SendEnv=-*','--',host.destination,[host.node,...args].map(quote).join(' ')]};
}

// This is a live, read-only admission probe, not a lease or process receipt.
export async function probeExecutionHost({config,workspace,stateDir,rpc,getVersion=()=>execFileSync('codex',['--version'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:5000}).trim()}){
 workspace=await fs.realpath(workspace);stateDir=path.resolve(stateDir);
 if(stateDir===workspace||stateDir.startsWith(workspace+path.sep))throw Error('Receipts must remain outside source');
 try{await fs.lstat(path.join(stateDir,'executor.lock'));throw Error('Executor lock requires reconciliation');}catch(error){if(error.code!=='ENOENT')throw error;}
 const {job}=await rpc('relay_execution',{action:'status',project:config.project,assignment:config.assignment,job_id:config.job_id});
 if(!job||job.state!=='queued'||job.id!==config.job_id||job.owner!==config.owner||job.branch!==config.branch)throw Error('Host does not match a queued admitted job');
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:5000}).trim();
 const remote=git(['remote','get-url','origin']).replace(/\.git$/,'');
 if(!['https://github.com/'+job.repository,'git@github.com:'+job.repository].includes(remote)||git(['branch','--show-current'])!==job.branch||git(['rev-parse','HEAD'])!==job.initial_head_sha||changedPaths(workspace).length)throw Error('Host checkout is not the clean admitted source');
 const capabilities=['codex-cli',process.platform==='darwin'?'macos':process.platform==='linux'?'linux':'windows'];
 if(config.source_checkpoints===true){
  await assertSourceCheckpointRuntime();
  await captureSourceBundle({workspace,repository:job.repository,branch:job.branch,head_sha:job.initial_head_sha,scope:job.objective.paths});
  capabilities.push('source-byte-checkpoints-v1');
 }
 const version=getVersion();if(!version||version.length>200)throw Error('Codex runtime unavailable');
 return {schema:1,...Object.fromEntries(bindings.map(k=>[k,config[k]])),executor_id:config.executor_id,head_sha:job.initial_head_sha,capabilities,ready:true,credential_execution_verified:false};
}

export async function dispatchExecution({config,rpc,probe,launch,persist}){
 const hosts=validateHosts(config.hosts);
 if(!bindings.every(k=>typeof config[k]==='string'&&config[k])||typeof persist!=='function')throw Error('Exact job binding and durable local routing receipt required');
 const status=()=>rpc('relay_execution',{action:'status',project:config.project,assignment:config.assignment,job_id:config.job_id});
 const {job}=await status();
 if(!job||job.id!==config.job_id||job.state!=='queued'||job.owner!==config.owner||job.branch!==config.branch)throw Error('Automatic dispatch accepts only this owner’s queued job; recover prior execution explicitly');
 const receipt={schema:1,job_id:job.id,job_revision:job.revision,owner:job.owner,branch:job.branch,head_sha:job.initial_head_sha,state:'probing',candidates:[],objective_completed:false};
 await persist(receipt);
 const results=await Promise.all(hosts.map(async host=>{
  try{
   const result=await probe(host);
   if(result?.schema!==1||result.ready!==true||result.executor_id!==host.id||!bindings.every(k=>result[k]===config[k])||result.head_sha!==job.initial_head_sha||!Array.isArray(result.capabilities)||result.capabilities.length>32||!result.capabilities.every(x=>typeof x==='string'&&x.length<=120))return {id:host.id,eligible:false,reason:'identity-mismatch'};
   const missing=(job.required_capabilities||[]).filter(x=>!result.capabilities.includes(x));
   return {id:host.id,eligible:missing.length===0,reason:missing.length?'missing-capability':'live-admission',missing};
  }catch{return {id:host.id,eligible:false,reason:'unavailable'};}
 }));
 receipt.candidates=results;
 // Operator configuration order is the deterministic preference, never latency.
 const selected=hosts.find(host=>results.find(x=>x.id===host.id)?.eligible);
 if(!selected){receipt.state='no-eligible-host';await persist(receipt);return receipt;}
 const latest=(await status()).job;
 if(!latest||!sameJob(job,latest)){receipt.state='admission-changed';await persist(receipt);return receipt;}
 receipt.selected_host=selected.id;receipt.state='dispatching';await persist(receipt);
 try{
  const outcome=await launch(selected);
  receipt.exit_code=Number.isInteger(outcome?.exit_code)?outcome.exit_code:null;
  const after=(await status()).job;
  receipt.reported_job_state=after?.id===job.id?after.state:null;
  receipt.state=after?.id===job.id&&after.executor_id===selected.id&&['succeeded','failed','cancelled'].includes(after.state)?'accounted':'reconciliation-required';
 }catch{receipt.state='reconciliation-required';}
 // No second host after launch: lost SSH/RPC responses can hide a live process.
 await persist(receipt);return receipt;
}

export async function probeConfiguredHost(host){
 const command=hostCommand(host,'probe');
 const {stdout}=await execute(command.file,command.args,{timeout:20000,maxBuffer:8192,encoding:'utf8'});
 return JSON.parse(stdout);
}
export function launchConfiguredHost(host){
 const command=hostCommand(host,'run');
 return new Promise((resolve,reject)=>{
  // Discard process output here; the executor’s private journal owns its evidence.
  const child=spawn(command.file,command.args,{stdio:['ignore','ignore','ignore']});
  child.once('error',reject);child.once('exit',code=>resolve({exit_code:code}));
 });
}

export async function openRoutingReceipt(filename,hosts){
 validateHosts(hosts);filename=path.resolve(filename);
 for(const host of hosts.filter(h=>h.transport==='local')){
  const workspace=await fs.realpath(host.workspace);
  if(filename===workspace||filename.startsWith(workspace+path.sep))throw Error('Routing receipt must remain outside source');
 }
 for(let parent=path.dirname(filename);;parent=path.dirname(parent)){
  if((await fs.lstat(parent)).isSymbolicLink())throw Error('Routing receipt parent cannot be a symlink');
  if(parent===path.dirname(parent))break;
 }
 // Exclusive creation refuses retries and symlinks. A partial/crashed receipt
 // still blocks dispatch and must be inspected, never automatically overwritten.
 return fs.open(filename,'wx',0o600);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [action,configFile,workspace,stateDir]=process.argv.slice(2);
 if(!['probe','run','dispatch'].includes(action)||!configFile||!workspace||(action!=='dispatch'&&!stateDir))throw Error('Use probe/run config.json checkout receipt-directory, or dispatch routing.json new-receipt.json');
 const config=JSON.parse(await fs.readFile(configFile,'utf8')),rpc=createMcpClient({token:process.env.RELAY_MCP_TOKEN});
 let result;
 if(action==='dispatch'){
  const handle=await openRoutingReceipt(workspace,config.hosts);
  try{result=await dispatchExecution({config,rpc,probe:probeConfiguredHost,launch:launchConfiguredHost,persist:async value=>{await handle.truncate(0);await handle.write(JSON.stringify(value,null,2)+'\n',0,'utf8');await handle.sync();}});}finally{await handle.close();}
 }else result=action==='probe'?await probeExecutionHost({config,workspace,stateDir,rpc}):await runExecution({config,workspace,stateDir,rpc});
 console.log(JSON.stringify(result));
}
