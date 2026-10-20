import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNightShiftPlan,runNightShiftPass,accountNightShiftPass,uniqueHosts} from './relay-night-shift.mjs';
import {createMcpClient} from './relay-executor.mjs';
import {operateNightShift} from '../packages/runner/src/night-shift.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const host=id=>({id,transport:'local',node:'/runtime/node',script:'/relay/scripts/relay-dispatch.mjs',config:'/private/executor.json',workspace:'/checkout',state_directory:'/private/receipts'});
const jobId=n=>'job_'+String(n).repeat(64);
const START=Date.parse('2026-10-20T00:00:00Z'),END=START+8*3600000;
function plan(count=1){
 return {schema:1,enabled:true,operation:'code',authorization:'Lauren approved this bounded fixture pass.',away_window:{start:new Date(START).toISOString(),end:new Date(END).toISOString()},
  oversight:{relay:{assignment:'lead',owner:'lead',branch:'relay/lead',job_id:jobId(9)}},
  jobs:Array.from({length:count},(_,i)=>({project:'relay',assignment:'worker',owner:'worker',branch:'relay/worker',job_id:jobId(i+1),summary:'Account for the bounded test job.',hosts:[host('local')]}))};
}
// Fixture control plane: every call is recorded, every decision is injectable.
function fixture(p=plan()){
 const f={plan:p,now:START+60000,calls:[],receipts:[],held:{global:false,relay:false},oversight:true,jobs:new Map(),cancel:()=>({ok:true}),dispatched:[]};
 for(const job of p.jobs)f.jobs.set(job.job_id,{id:job.job_id,project:job.project,assignment:job.assignment,owner:job.owner,branch:job.branch,state:'queued',revision:1,required_capabilities:['source-byte-checkpoints-v1']});
 f.lead={id:jobId(9),project:'relay',assignment:'lead',owner:'lead',branch:'relay/lead',state:'running',observed_state:'running',executor_id:'lead-host',process:{pid:123,host:'lead-host',version:'fixture'},started_at:new Date(START).toISOString(),lease_until:new Date(END+60000).toISOString()};
 f.rpc=async(name,args)=>{
  f.calls.push({name,args});
  if(name==='relay_autonomy')return {ok:true,state:{held:f.held[args.scope]}};
  if(name==='relay_night_shift')return {ok:true,oversight:{available:f.oversight,binding:{assignment:'lead',owner:'lead',branch:'relay/lead'}}};
  if(name==='relay_execution'&&args.action==='status')return {ok:true,job:{...(args.job_id===jobId(9)?f.lead:f.jobs.get(args.job_id))}};
  if(name==='relay_execution'&&args.action==='cancel')return f.cancel(args);
  throw Error('unexpected rpc '+name);
 };
 f.persist=async value=>{f.receipts.push(structuredClone(value));};
 f.dispatch=async({config,launch,persist})=>{await persist({state:'dispatching'});await launch(config.hosts[0]);f.dispatched.push(config.job_id);const job=f.jobs.get(config.job_id);job.state='succeeded';job.revision++;return {state:'accounted'};};
 f.launch=async()=>({exit_code:0});
 f.run=(extra={})=>runNightShiftPass({plan:f.plan,rpc:f.rpc,persist:f.persist,dispatch:f.dispatch,launch:f.launch,clock:()=>f.now,pollMs:5,...extra});
 return f;
}

test('plan validation requires explicit authorization, a bounded window and unique exact jobs',()=>{
 assert.ok(validateNightShiftPlan(plan(8)));
 for(const patch of [{enabled:false},{operation:'review'},{authorization:' '},{away_window:{start:new Date(START).toISOString(),end:new Date(START+25*3600000).toISOString()}},{away_window:{start:new Date(END).toISOString(),end:new Date(START).toISOString()}},{jobs:[]},{jobs:plan(9).jobs}])
  assert.throws(()=>validateNightShiftPlan({...plan(),...patch}));
 const p=plan(2);p.jobs[1].job_id=p.jobs[0].job_id;assert.throws(()=>validateNightShiftPlan(p),/Unique/);
 const q=plan();q.jobs[0].job_id='job_short';assert.throws(()=>validateNightShiftPlan(q),/Unique/);
});

test('conflicting configurations for one host id are refused before any receipt opens',()=>{
 const p=plan(2);assert.equal(uniqueHosts(p).length,1);
 p.jobs[1].hosts=[{...host('local'),workspace:'/other'}];assert.throws(()=>uniqueHosts(p),/conflicting/);
});

test('a healthy pass dispatches each exact queued job once and never claims away or objective proof',async()=>{
 const f=fixture(plan(2)),result=await f.run();
 assert.equal(result.state,'pass-finished');assert.deepEqual(f.dispatched,[jobId(1),jobId(2)]);
 assert.equal(result.away_verified,false);assert.equal(result.objective_completed,false);assert.equal(result.process_verified,false);
 assert.ok(f.receipts.some(r=>r.state==='dispatching'),'intent persisted before launch');
 // A finished journal never replays.
 const again=await f.run({journal:result});assert.equal(again,result);assert.equal(f.dispatched.length,2);
});

test('held safety, missing oversight, outside window, operator stop and control failure all stop before launch',async()=>{
 const cases=[[f=>{f.held.global=true;},'held-or-safety-unavailable'],[f=>{f.held.relay=true;},'held-or-safety-unavailable'],[f=>{f.oversight=false;},'oversight-unavailable'],
  [f=>{f.now=START-1;},'outside-declared-window'],[f=>{f.now=END;},'outside-declared-window'],[f=>{f.stop=true;},'operator-stop'],
  [f=>{const rpc=f.rpc;f.rpc=async(n,a)=>{if(n==='relay_autonomy')throw Error('synthetic-secret');return rpc(n,a);};},'control-unavailable']];
 for(const [arrange,reason] of cases){
  const f=fixture();arrange(f);const result=await f.run({shouldStop:async()=>Boolean(f.stop)});
  assert.equal(result.state,'stopped');assert.equal(result.reason,reason);assert.equal(f.dispatched.length,0);assert.doesNotMatch(JSON.stringify(f.receipts),/synthetic-secret/);
 }
});

test('jobs that are not this owner’s queued protected-source job are recorded as not admitted',async()=>{
 for(const patch of [{state:'running'},{owner:'other'},{branch:'other'},{required_capabilities:[]},{assignment:'other'}]){
  const f=fixture();Object.assign(f.jobs.get(jobId(1)),patch);const result=await f.run();
  assert.equal(result.state,'pass-finished');assert.deepEqual(result.jobs,[{job_id:jobId(1),state:'not-admitted'}]);assert.equal(f.dispatched.length,0);
 }
});

test('admission re-checks immediately before launch so a hold raised during probing prevents the process',async()=>{
 const f=fixture(),dispatch=f.dispatch;
 f.dispatch=async args=>{f.held.global=true;return dispatch(args);};
 const result=await f.run();assert.equal(result.state,'reconciliation-required');assert.equal(f.dispatched.length,0);
});

test('an uncertain dispatch stops the pass instead of moving to the next job',async()=>{
 const f=fixture(plan(2));f.dispatch=async()=>{throw Error('lost ssh response');};
 const result=await f.run();assert.equal(result.state,'reconciliation-required');assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].state,'reconciliation-required');
});

// Monitor helpers: hold the dispatch open until the monitor has acted.
const settle=async(f,until)=>{for(let i=0;i<400&&!until();i++)await new Promise(r=>setTimeout(r,5));};
function slowDispatch(f){
 f.release=null;
 f.dispatch=async({config,persist})=>{await persist({state:'dispatching'});const job=f.jobs.get(config.job_id);job.state='running';job.revision=2;await new Promise(r=>{f.release=r;});return {state:'accounted'};};
}

function useRealMcpClient(f){
 const rpc=f.rpc;
 f.rpc=createMcpClient({token:'fixture-only',fetchImpl:async(_url,options)=>{
  const message=JSON.parse(options.body),result=await rpc(message.params.name,message.params.arguments);
  return Response.json({jsonrpc:'2.0',id:message.id,result:{structuredContent:result,isError:result.ok===false}});
 }});
}

test('real MCP rejection re-reads a cancellation race and retries only the changed revision',async()=>{
 const f=fixture();slowDispatch(f);useRealMcpClient(f);
 const cancels=[];f.cancel=args=>{cancels.push(args.expected_revision);if(cancels.length===1){f.jobs.get(jobId(1)).revision=3;return {ok:false,error:{class:'conflict'}};}return {ok:true};};
 const pass=f.run({shouldStop:async()=>Boolean(f.stop)});
 await settle(f,()=>f.release);f.stop=true;await settle(f,()=>cancels.length===2);f.release();
 const result=await pass;assert.deepEqual(cancels,[2,3]);assert.equal(result.jobs[0].cancellation.state,'requested');
});

test('real MCP lost cancellation response is reconciled without repeating a successful cancel',async()=>{
 const f=fixture();slowDispatch(f);useRealMcpClient(f);
 let cancels=0;f.cancel=()=>{cancels++;Object.assign(f.jobs.get(jobId(1)),{state:'cancelled',revision:3});throw Error('private transport failure');};
 const pass=f.run({shouldStop:async()=>Boolean(f.stop)});
 await settle(f,()=>f.release);f.stop=true;await settle(f,()=>f.receipts.at(-1)?.jobs[0]?.cancellation?.state==='already-terminal');f.release();
 const result=await pass;assert.equal(cancels,1);assert.equal(result.jobs[0].cancellation.state,'already-terminal');assert.doesNotMatch(JSON.stringify(result),/private transport failure/);
});

test('failing safety reads still cancel the exact job when execution control remains available',async()=>{
 const f=fixture();slowDispatch(f);
 const rpc=f.rpc;let failing=false,cancels=0;f.rpc=async(n,a)=>{if(failing&&n==='relay_autonomy')throw Error('private safety failure');return rpc(n,a);};
 f.cancel=()=>{cancels++;return {ok:true};};useRealMcpClient(f);
 const pass=f.run();await settle(f,()=>f.release);failing=true;await settle(f,()=>cancels===1);f.release();
 const result=await pass;assert.equal(cancels,1);assert.equal(result.reason,'control-unavailable');assert.equal(result.jobs[0].cancellation.state,'requested');assert.doesNotMatch(JSON.stringify(result),/private safety failure/);
});

test('a stop during a running job cancels the exact job revision once and persists intent first',async()=>{
 const f=fixture();slowDispatch(f);
 const cancels=[];f.cancel=args=>{cancels.push(args);assert.equal(f.receipts.at(-1).jobs[0].cancellation.state,'intent');return {ok:true};};
 const pass=f.run({shouldStop:async()=>Boolean(f.stop)});
 await settle(f,()=>f.release);f.stop=true;await settle(f,()=>cancels.length);f.release();
 const result=await pass;
 assert.equal(result.state,'stopped');assert.equal(result.reason,'operator-stop');assert.equal(cancels.length,1);assert.equal(cancels[0].expected_revision,2);
 assert.equal(result.jobs[0].cancellation.state,'requested');assert.equal(result.jobs[0].reconcile_required,undefined);
});

test('a cancellation revision race re-reads once and retries against the new revision only',async()=>{
 const f=fixture();slowDispatch(f);
 const cancels=[];f.cancel=args=>{cancels.push(args.expected_revision);if(cancels.length===1){f.jobs.get(jobId(1)).revision=3;return {ok:false};}return {ok:true};};
 const pass=f.run({shouldStop:async()=>Boolean(f.stop)});
 await settle(f,()=>f.release);f.stop=true;await settle(f,()=>cancels.length>=2);f.release();
 const result=await pass;assert.deepEqual(cancels,[2,3]);assert.equal(result.jobs[0].cancellation.state,'requested');
});

test('an unconfirmed cancellation is never reported as requested and requires reconciliation',async()=>{
 const f=fixture();slowDispatch(f);
 const cancels=[];f.cancel=()=>{cancels.push(1);return {ok:false};};
 const pass=f.run({shouldStop:async()=>Boolean(f.stop)});
 await settle(f,()=>f.release);f.stop=true;await settle(f,()=>cancels.length);await settle(f,()=>f.receipts.at(-1)?.jobs[0]?.cancellation?.state==='unknown');f.release();
 const result=await pass;assert.equal(cancels.length,1,'same revision is not retried');assert.equal(result.jobs[0].cancellation.state,'unknown');assert.equal(result.jobs[0].reconcile_required,true);
});

test('a job that already finished when the stop arrives is not cancelled',async()=>{
 const f=fixture();slowDispatch(f);
 const cancels=[];f.cancel=()=>{cancels.push(1);return {ok:true};};
 const pass=f.run({shouldStop:async()=>Boolean(f.stop)});
 await settle(f,()=>f.release);f.jobs.get(jobId(1)).state='succeeded';f.stop=true;
 await settle(f,()=>f.receipts.at(-1)?.jobs[0]?.cancellation?.state==='already-terminal');f.release();
 const result=await pass;assert.equal(cancels.length,0);assert.equal(result.jobs[0].cancellation.state,'already-terminal');assert.equal(result.state,'stopped');
});

test('control reads failing mid-run stop the pass conservatively and flag reconciliation',async()=>{
 const f=fixture();slowDispatch(f);
 const rpc=f.rpc;let failing=false;f.rpc=async(n,a)=>{if(failing&&n==='relay_autonomy')throw Error('synthetic-secret');if(failing&&n==='relay_execution')throw Error('synthetic-secret');return rpc(n,a);};
 const pass=f.run();
 await settle(f,()=>f.release);failing=true;await settle(f,()=>f.receipts.at(-1)?.jobs[0]?.stop_reason);f.release();
 const result=await pass;assert.equal(result.state,'stopped');assert.equal(result.reason,'control-unavailable');assert.doesNotMatch(JSON.stringify(result),/synthetic-secret/);
});

test('persistence failure before launch propagates without starting a process',async()=>{
 const f=fixture();f.persist=async value=>{if(value.state==='dispatching')throw Error('disk failed');};
 await assert.rejects(f.run(),/disk failed/);assert.equal(f.dispatched.length,0);
});

test('a journal for another plan is refused; a stopped journal never resumes automatically',async()=>{
 const f=fixture(),stopped=await (async()=>{f.held.global=true;return f.run();})();
 f.held.global=false;assert.equal((await f.run({journal:stopped})).state,'stopped');assert.equal(f.dispatched.length,0);
 await assert.rejects(f.run({journal:{...stopped,state:'ready',plan_sha256:'0'.repeat(64)}}),/does not match/);
});

test('oversight must be a distinct exact running execution with an unexpired process lease',async()=>{
 for(const patch of [{state:'queued'},{observed_state:'recovery_required'},{owner:'other'},{assignment:'other'},{project:'other'},{id:jobId(8)},{executor_id:null},{process:null},{process:{pid:0,host:'x',version:'x'}},{started_at:'invalid'},{lease_until:new Date(START).toISOString()}]){
  const f=fixture();Object.assign(f.lead,patch);const result=await f.run();
  assert.equal(result.reason,'oversight-executor-unavailable');assert.equal(f.dispatched.length,0);
 }
 for(const patch of [{job_id:jobId(1)},{owner:'worker'},{assignment:'worker'},{job_id:undefined}]){
  const p=plan();Object.assign(p.oversight.relay,patch);assert.throws(()=>validateNightShiftPlan(p),/distinct/);
 }
});

test('losing the oversight process during dispatch cancels the exact coding job',async()=>{
 const f=fixture();slowDispatch(f);let cancels=0;f.cancel=()=>{cancels++;return {ok:true};};
 const pass=f.run();await settle(f,()=>f.release);f.lead.state='succeeded';await settle(f,()=>cancels===1);f.release();
 const result=await pass;assert.equal(result.reason,'oversight-executor-unavailable');assert.equal(result.jobs[0].cancellation.state,'requested');
});

// The actual ledger service, including CAS, identity, completed-window and
// source-verification rules, runs behind the real JSON-RPC client here.
async function accountingFixture(){
 const f=fixture(),journal=await f.run();
 let stored=null,etag=0;
 const bucket={get:async()=>stored?{etag:String(etag),json:async()=>JSON.parse(stored)}:null,put:async(_key,value,options)=>{
  if(stored&&options.onlyIf.etagMatches!==String(etag))return null;
  stored=value;etag++;return {etag:String(etag)};
 }};
 const claims=[{id:'worker',owner:'worker',branch:'relay/worker',state:'active',lease_until:new Date(END+3600000).toISOString()}];
 for(const job of f.jobs.values())Object.assign(job,{repository:'lrnolivia/relay',process:{pid:456,host:'fixture',version:'fixture'},started_at:new Date(START+1000).toISOString(),finished_at:new Date(START+2000).toISOString(),result:{head_sha:'a'.repeat(40),evidence:'Exact synthetic process fixture.'}});
 const rpc=f.rpc;f.writes=0;f.verifications=0;
 f.rpc=async(name,args)=>{
  if(name!=='relay_night_shift')return rpc(name,args);
  f.calls.push({name,args});if(args.action==='record'){f.writes++;assert.equal(f.receipts.at(-1).jobs[0].ledger.state,'intent');}
  try{return await operateNightShift(bucket,args,{claims,sourceJob:f.jobs.get(args.job_id),verifyCommit:async(repo,sha)=>{f.verifications++;return repo==='lrnolivia/relay'&&sha==='a'.repeat(40);}},f.now);}catch{return {ok:false};}
 };
 useRealMcpClient(f);f.journal=journal;
 f.account=()=>accountNightShiftPass({plan:f.plan,journal:f.journal,rpc:f.rpc,persist:f.persist,clock:()=>f.now});
 return f;
}

test('accounting waits for the entire declared window without attempting a ledger write',async()=>{
 const f=await accountingFixture(),result=await f.account();assert.equal(result.accounting.state,'waiting-for-window');assert.equal(f.writes,0);
});

test('completed exact execution is verified and read back from the real ledger without claiming away proof',async()=>{
 const f=await accountingFixture();f.now=END;const result=await f.account();
 assert.equal(result.accounting.state,'finished');assert.equal(result.jobs[0].ledger.state,'recorded');assert.equal(f.writes,1);assert.equal(f.verifications,1);
 const read=await f.rpc('relay_night_shift',{action:'read',project:'relay',assignment:'worker',limit:20});
 assert.equal(read.items.length,1);assert.equal(read.items[0].source.job_id,jobId(1));assert.equal(read.items[0].process_verified,false);assert.equal(read.items[0].away_verified,false);
 await f.account();assert.equal(f.writes,1,'completed accounting only rereads the existing item');
});

test('a lost successful accounting response is reconciled by readback without another write',async()=>{
 const f=await accountingFixture();f.now=END;const rpc=f.rpc;
 f.rpc=async(n,a)=>{const r=await rpc(n,a);if(n==='relay_night_shift'&&a.action==='record')throw Error('private lost response');return r;};
 const result=await f.account();assert.equal(result.accounting.state,'finished');assert.equal(f.writes,1);assert.doesNotMatch(JSON.stringify(result),/private lost/);
});

test('an uncertain accounting intent survives and is never automatically replayed when no item is found',async()=>{
 const f=await accountingFixture();f.now=END;const rpc=f.rpc;let writes=0;
 f.rpc=async(n,a)=>{if(n==='relay_night_shift'&&a.action==='record'){writes++;throw Error('private connection loss');}return rpc(n,a);};
 let result=await f.account();assert.equal(result.accounting.state,'reconciliation-required');assert.equal(result.jobs[0].ledger.state,'intent');
 result=await f.account();assert.equal(result.accounting.state,'reconciliation-required');assert.equal(writes,1);assert.doesNotMatch(JSON.stringify(result),/private connection loss/);
});

test('a persisted intent can reconcile a server commit after the first readback failed',async()=>{
 const f=await accountingFixture();f.now=END;const rpc=f.rpc;let written=false;
 f.rpc=async(n,a)=>{if(written&&n==='relay_night_shift'&&a.action==='read')throw Error('readback unavailable');const r=await rpc(n,a);if(a.action==='record')written=true;return r;};
 assert.equal((await f.account()).accounting.state,'reconciliation-required');assert.equal(f.writes,1);
 f.rpc=rpc;assert.equal((await f.account()).accounting.state,'finished');assert.equal(f.writes,1);
});

test('invalid terminal identities, out-of-window execution and unavailable evidence cannot be classified',async()=>{
 for(const patch of [{state:'running'},{owner:'other'},{assignment:'other'},{project:'other'},{process:null},{started_at:new Date(START-1).toISOString()},{finished_at:new Date(END+1).toISOString()},{result:{head_sha:'a'.repeat(40)}}]){
  const f=await accountingFixture();f.now=END;Object.assign(f.jobs.get(jobId(1)),patch);
  assert.equal((await f.account()).accounting.state,'reconciliation-required');assert.equal(f.writes,0);
 }
});

test('accounting rejects an unrelated or unfinished journal before reading or writing',async()=>{
 const f=await accountingFixture();f.now=END;
 for(const patch of [{state:'dispatching'},{plan_sha256:'0'.repeat(64)}])await assert.rejects(accountNightShiftPass({plan:f.plan,journal:{...f.journal,...patch},rpc:()=>{throw Error('must not call');},persist:f.persist,clock:()=>f.now}),/matching/);
});

test('ledger pagination cannot hide an earlier record or cross a changing revision',async()=>{
 const f=await accountingFixture();f.now=END;await f.account();const rpc=f.rpc;
 f.rpc=async(n,a)=>{
  if(n==='relay_night_shift'&&a.action==='read'&&a.cursor===0)return {ok:true,revision:1,items:[],next_cursor:20};
  return rpc(n,n==='relay_night_shift'&&a.action==='read'?{...a,cursor:0}:a);
 };
 assert.equal((await f.account()).accounting.state,'finished');assert.equal(f.writes,1);
 f.rpc=async(n,a)=>n==='relay_night_shift'&&a.action==='read'?{ok:true,revision:a.cursor===0?1:2,items:[],next_cursor:a.cursor===0?20:null}:rpc(n,a);
 assert.equal((await f.account()).accounting.state,'reconciliation-required');assert.equal(f.writes,1);
});

test('a conflicting item under the deterministic id is never accepted or overwritten',async()=>{
 const f=await accountingFixture();f.now=END;await f.account();const rpc=f.rpc;
 f.rpc=async(n,a)=>{const r=await rpc(n,a);if(n==='relay_night_shift'&&a.action==='read')r.items[0].source.owner='other';return r;};
 assert.equal((await f.account()).accounting.state,'reconciliation-required');assert.equal(f.writes,1);
});

test('account CLI updates only a private original journal and rejects unsafe files or an existing lock',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'relay-night-account-'))),workspace=path.join(root,'checkout'),receipt=path.join(root,'receipt.json'),planFile=path.join(root,'plan.json');
 try{
  await fs.mkdir(workspace);const p=plan();p.away_window={start:new Date(Date.now()-60000).toISOString(),end:new Date(Date.now()+3600000).toISOString()};p.jobs[0].hosts[0].workspace=workspace;
  const journal={schema:1,plan_sha256:createHash('sha256').update(JSON.stringify(p)).digest('hex'),state:'pass-finished',jobs:[],away_verified:false,process_verified:false,objective_completed:false};
  await fs.writeFile(planFile,JSON.stringify(p));await fs.writeFile(receipt,JSON.stringify(journal),{mode:0o600});
  const invoke=()=>execFileSync(process.execPath,[new URL('./relay-night-shift.mjs',import.meta.url).pathname,'account',planFile,receipt],{env:{...process.env,RELAY_MCP_TOKEN:'synthetic-no-network'},encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.equal(JSON.parse(invoke()).accounting.state,'waiting-for-window');assert.equal(JSON.parse(await fs.readFile(receipt,'utf8')).accounting.state,'waiting-for-window');
  await fs.writeFile(receipt+'.accounting-lock','retained crash lock',{mode:0o600});assert.throws(invoke);await fs.unlink(receipt+'.accounting-lock');
  await fs.chmod(receipt,0o644);assert.throws(invoke);await fs.chmod(receipt,0o600);
  await fs.link(receipt,receipt+'.hardlink');assert.throws(invoke);await fs.unlink(receipt+'.hardlink');
  await fs.rename(receipt,receipt+'.original');await fs.symlink(receipt+'.original',receipt);assert.throws(invoke);
  assert.equal(JSON.parse(await fs.readFile(receipt+'.original','utf8')).state,'pass-finished');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
