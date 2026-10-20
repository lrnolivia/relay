import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNightShiftPlan,runNightShiftPass,uniqueHosts} from './relay-night-shift.mjs';

const host=id=>({id,transport:'local',node:'/runtime/node',script:'/relay/scripts/relay-dispatch.mjs',config:'/private/executor.json',workspace:'/checkout',state_directory:'/private/receipts'});
const jobId=n=>'job_'+String(n).repeat(64);
const START=Date.parse('2026-10-20T00:00:00Z'),END=START+8*3600000;
function plan(count=1){
 return {schema:1,enabled:true,operation:'code',authorization:'Lauren approved this bounded fixture pass.',away_window:{start:new Date(START).toISOString(),end:new Date(END).toISOString()},
  oversight:{relay:{assignment:'lead',owner:'lead',branch:'relay/lead'}},
  jobs:Array.from({length:count},(_,i)=>({project:'relay',assignment:'worker',owner:'worker',branch:'relay/worker',job_id:jobId(i+1),hosts:[host('local')]}))};
}
// Fixture control plane: every call is recorded, every decision is injectable.
function fixture(p=plan()){
 const f={plan:p,now:START+60000,calls:[],receipts:[],held:{global:false,relay:false},oversight:true,jobs:new Map(),cancel:()=>({ok:true}),dispatched:[]};
 for(const job of p.jobs)f.jobs.set(job.job_id,{id:job.job_id,project:job.project,assignment:job.assignment,owner:job.owner,branch:job.branch,state:'queued',revision:1,required_capabilities:['source-byte-checkpoints-v1']});
 f.rpc=async(name,args)=>{
  f.calls.push({name,args});
  if(name==='relay_autonomy')return {ok:true,state:{held:f.held[args.scope]}};
  if(name==='relay_night_shift')return {ok:true,oversight:{available:f.oversight,binding:{assignment:'lead',owner:'lead',branch:'relay/lead'}}};
  if(name==='relay_execution'&&args.action==='status')return {ok:true,job:{...f.jobs.get(args.job_id)}};
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
