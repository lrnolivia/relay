import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createMcpClient} from './relay-executor.mjs';
import {dispatchExecution,validateHosts,probeConfiguredHost,launchConfiguredHost,openRoutingReceipt} from './relay-dispatch.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const terminal=new Set(['succeeded','failed','cancelled']);
export function validateNightShiftPlan(plan){
 if(plan?.schema!==1||plan.enabled!==true||plan.operation!=='code'||typeof plan.authorization!=='string'||!plan.authorization.trim()||plan.authorization.length>2000)throw Error('Explicit bounded coding authorization required');
 const start=Date.parse(plan.away_window?.start),end=Date.parse(plan.away_window?.end);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)throw Error('Declare a finite away window of at most 24 hours');
 if(!Array.isArray(plan.jobs)||!plan.jobs.length||plan.jobs.length>8)throw Error('Configure one to eight exact existing jobs');
 const ids=new Set();
 for(const job of plan.jobs){
  for(const key of ['project','assignment','owner','branch','job_id'])if(typeof job[key]!=='string'||!job[key]||job[key].length>240)throw Error('Exact admitted job identity required');
  if(!/^job_[a-f0-9]{64}$/.test(job.job_id)||ids.has(job.job_id))throw Error('Unique exact job required');ids.add(job.job_id);validateHosts(job.hosts);
  if(typeof job.summary!=='string'||!job.summary.trim()||job.summary.length>2000)throw Error('A bounded accounting summary is required for each job');
  const lead=plan.oversight?.[job.project];
  if(!lead||!['assignment','owner','branch'].every(k=>typeof lead[k]==='string'&&lead[k]&&lead[k].length<=(k==='branch'?240:100))||!/^job_[a-f0-9]{64}$/.test(lead.job_id||'')||lead.assignment===job.assignment||lead.owner===job.owner||plan.jobs.some(x=>x.job_id===lead.job_id))throw Error('Configure a distinct existing oversight execution');
 }
 return plan;
}

// A host id names exactly one configuration across the whole plan.
export function uniqueHosts(plan){
 const hosts=new Map();
 for(const host of plan.jobs.flatMap(x=>x.hosts)){const prior=hosts.get(host.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(host))throw Error('Host id has conflicting configurations');hosts.set(host.id,host);}
 return [...hosts.values()];
}

// One bounded pass over already-created jobs, never an open-ended task generator.
// The caller owns the exclusive durable journal. An uncertain launch is terminal
// for this pass and can only be reconciled by inspecting the original job/host.
export async function runNightShiftPass({plan,rpc,persist,journal=null,dispatch=dispatchExecution,probe=probeConfiguredHost,launch=launchConfiguredHost,shouldStop=async()=>false,clock=Date.now,pollMs=5000}){
 validateNightShiftPlan(plan);
 const planHash=digest(plan),state=journal||{schema:1,plan_sha256:planHash,state:'ready',jobs:[],objective_completed:false,away_verified:false,process_verified:false};
 if(state.schema!==1||state.plan_sha256!==planHash||!Array.isArray(state.jobs))throw Error('Night Shift journal does not match this exact plan');
 if(state.state!=='ready')return state; // No replay after a stop, crash or unknown launch.
 const gate=async config=>{
  if(await shouldStop())return 'operator-stop';
  if(clock()<Date.parse(plan.away_window.start)||clock()>=Date.parse(plan.away_window.end))return 'outside-declared-window';
  for(const scope of ['global',config.project]){const r=await rpc('relay_autonomy',{action:'status',scope});if(r.ok!==true||r.state?.held!==false)return 'held-or-safety-unavailable';}
  const r=await rpc('relay_night_shift',{action:'read',project:config.project,assignment:config.assignment,limit:1});
  const binding=plan.oversight?.[config.project];
  if(r.ok!==true||r.oversight?.available!==true||!binding||!['assignment','owner','branch'].every(k=>r.oversight.binding?.[k]===binding[k]))return 'oversight-unavailable';
  // An assignment lease alone is not an oversight executor. Require a live
  // broker lease and concrete process receipt for the exact separate job.
  const lead=await rpc('relay_execution',{action:'status',project:config.project,assignment:binding.assignment,job_id:binding.job_id});
  const j=lead.job,now=clock();
  const observation=j?.checkpoint?.native_thread,at=Date.parse(observation?.observed_at);
  const native=j?.required_capabilities?.includes('native-thread-oversight-v1')&&j.process?.adapter==='codex-desktop-oversight'&&j.process.thread_id===binding.owner&&j.process.pid===undefined&&observation?.thread_id===binding.owner&&observation.host===j.process.host&&observation.state==='active'&&Number.isFinite(at)&&at<=now+5000&&now-at<=60000;
  const coding=j?.process?.adapter==='codex-cli'&&Number.isInteger(j.process.pid)&&j.process.pid>0;
  if(lead.ok!==true||!j||j.id!==binding.job_id||j.project!==config.project||j.assignment!==binding.assignment||j.owner!==binding.owner||j.branch!==binding.branch||j.state!=='running'||j.observed_state!=='running'||!j.executor_id||(!native&&!coding)||!j.process.host||!j.process.version||!Number.isFinite(Date.parse(j.started_at))||Date.parse(j.started_at)>now||!(Date.parse(j.lease_until)>now))return 'oversight-executor-unavailable';
  return null;
 };
 for(const config of plan.jobs){
  if(state.jobs.some(x=>x.job_id===config.job_id))continue;
  let blocked;try{blocked=await gate(config);}catch{blocked='control-unavailable';}
  if(blocked){state.state='stopped';state.reason=blocked;await persist(state);return state;}
  const result=await rpc('relay_execution',{action:'status',project:config.project,assignment:config.assignment,job_id:config.job_id});
  const job=result.job;
  if(result.ok!==true||!job||job.id!==config.job_id||job.project!==config.project||job.assignment!==config.assignment||job.owner!==config.owner||job.branch!==config.branch||job.state!=='queued'||!job.required_capabilities?.includes('source-byte-checkpoints-v1')){
   state.jobs.push({job_id:config.job_id,state:'not-admitted'});await persist(state);continue;
  }
  const receipt={job_id:job.id,project:config.project,assignment:config.assignment,state:'dispatching',started_at:new Date(clock()).toISOString()};
  state.jobs.push(receipt);state.state='dispatching';await persist(state);
  let monitoring=false,stopReason=null;
  const monitor=async()=>{
   if(monitoring||stopReason)return;monitoring=true;
   try{
    // Losing a safety read is itself a stop reason. Execution control may still
    // be reachable, so try to cancel the exact job before flagging uncertainty.
    try{stopReason=await gate(config);}catch{stopReason='control-unavailable';}
    if(!stopReason)return;
    receipt.stop_reason=stopReason;receipt.cancellation={state:'intent',operation_id:'ns-stop-'+digest({plan:planHash,job:job.id})};await persist(state);
    const latest=await rpc('relay_execution',{action:'status',project:config.project,assignment:config.assignment,job_id:job.id});
    if(latest.ok!==true||latest.job?.id!==job.id)throw Error('Unavailable exact job');
    if(terminal.has(latest.job.state)){receipt.cancellation.state='already-terminal';await persist(state);return;}
    const cancel=revision=>rpc('relay_execution',{action:'cancel',project:config.project,assignment:config.assignment,job_id:job.id,expected_owner:config.owner,expected_branch:config.branch,expected_revision:revision,operation_id:receipt.cancellation.operation_id});
    let cancelled;
    // The real MCP client throws for rejected or uncertain tool responses.
    // Reconcile those just like explicit failures before considering a retry.
    try{cancelled=await cancel(latest.job.revision);}catch{cancelled=null;}
    // One bounded re-read covers a queued→running revision race; never loop.
    if(cancelled?.ok!==true){
     const again=await rpc('relay_execution',{action:'status',project:config.project,assignment:config.assignment,job_id:job.id});
     if(again.ok===true&&again.job?.id===job.id&&terminal.has(again.job.state)){receipt.cancellation.state='already-terminal';await persist(state);return;}
     if(again.ok===true&&again.job?.id===job.id&&again.job.revision!==latest.job.revision)cancelled=await cancel(again.job.revision);
    }
    receipt.cancellation.state=cancelled?.ok===true?'requested':'unknown';
    if(cancelled?.ok!==true)receipt.reconcile_required=true;
    await persist(state);
   }catch{stopReason=stopReason||'control-unavailable';receipt.stop_reason=stopReason;receipt.reconcile_required=true;await persist(state);}
   finally{monitoring=false;}
  };
  const timer=setInterval(()=>{void monitor().catch(()=>{});},pollMs);
  try{
   const routed=await dispatch({config,rpc,probe,launch:async host=>{const reason=await gate(config);if(reason)throw Error('Admission stopped');return launch(host);},persist:async route=>{receipt.routing=route;await persist(state);}});
   receipt.state=routed.state;receipt.finished_at=new Date(clock()).toISOString();
  }catch{receipt.state='reconciliation-required';}
  finally{clearInterval(timer);while(monitoring)await new Promise(resolve=>setTimeout(resolve,5));}
  if(stopReason||receipt.state==='reconciliation-required'){state.state=stopReason?'stopped':'reconciliation-required';state.reason=stopReason||'uncertain-dispatch';await persist(state);return state;}
  state.state='ready';await persist(state);
 }
 state.state='pass-finished';await persist(state);return state;
}

// Explicit accounting never launches or retries an execution. The declared
// window must have ended, and the server independently verifies source receipts.
// Persist the exact ledger intent first; an uncertain write is reconciled only
// through readback, never replayed automatically with a new operation id.
export async function accountNightShiftPass({plan,journal,rpc,persist,clock=Date.now}){
 validateNightShiftPlan(plan);
 if(journal?.schema!==1||journal.plan_sha256!==digest(plan)||!Array.isArray(journal.jobs)||!['pass-finished','stopped','reconciliation-required'].includes(journal.state))throw Error('Accounting requires a matching finished or stopped pass');
 const state=journal;
 if(clock()<Date.parse(plan.away_window.end)){state.accounting={state:'waiting-for-window'};await persist(state);return state;}
 const read=async config=>{
  const items=[];let cursor=0,revision;
  for(let page=0;page<10;page++){
   const r=await rpc('relay_night_shift',{action:'read',project:config.project,assignment:config.assignment,cursor,limit:20});
   if(r.ok!==true||!Number.isInteger(r.revision)||!Array.isArray(r.items)||(revision!==undefined&&revision!==r.revision))throw Error('Ledger read changed or unavailable');
   revision=r.revision;items.push(...r.items);
   if(r.next_cursor===null)return {items,revision};
   if(!Number.isInteger(r.next_cursor)||r.next_cursor<=cursor)throw Error('Invalid ledger pagination');cursor=r.next_cursor;
  }
  throw Error('Ledger read exceeds bounded capacity');
 };
 state.accounting={state:'accounting'};await persist(state);
 for(const receipt of state.jobs){
  if(receipt.state!=='accounted')continue;
  const config=plan.jobs.find(x=>x.job_id===receipt.job_id);
  if(!config)throw Error('Receipt is outside the exact plan');
  const operation='ns-record-'+digest({plan:state.plan_sha256,job:config.job_id}),itemId='ns_'+digest({project:config.project,operation});
  try{
   const ledger=await read(config),item=ledger.items.find(x=>x.id===itemId);
   const matches=x=>x?.source?.job_id===config.job_id&&x.source.assignment===config.assignment&&x.source.owner===config.owner&&x.source.branch===config.branch&&x.recorded_by?.assignment===config.assignment&&x.recorded_by.owner===config.owner&&x.recorded_by.branch===config.branch&&x.declared_away_window?.start===plan.away_window.start&&x.declared_away_window.end===plan.away_window.end&&x.summary===config.summary;
   if(item){
    if(!matches(item))throw Error('Recorded item identity differs');
    receipt.ledger={state:'recorded',item_id:itemId};await persist(state);continue;
   }
   if(receipt.ledger)throw Error('Prior accounting intent requires reconciliation');
   const status=await rpc('relay_execution',{action:'status',project:config.project,assignment:config.assignment,job_id:config.job_id}),job=status.job;
   const start=Date.parse(job?.started_at),end=Date.parse(job?.finished_at);
   if(status.ok!==true||!job||job.id!==config.job_id||job.project!==config.project||job.assignment!==config.assignment||job.owner!==config.owner||job.branch!==config.branch||!terminal.has(job.state)||!job.process||!Number.isFinite(start)||!Number.isFinite(end)||start<Date.parse(plan.away_window.start)||end>Date.parse(plan.away_window.end)||end<start||!job.result?.head_sha||!job.result?.evidence)throw Error('Terminal execution evidence unavailable or outside the window');
   const request={action:'record',project:config.project,assignment:config.assignment,source_assignment:config.assignment,job_id:config.job_id,expected_owner:config.owner,expected_branch:config.branch,expected_revision:ledger.revision,operation_id:operation,summary:config.summary,away_window:plan.away_window};
   receipt.ledger={state:'intent',request};await persist(state);
   // Even a successful response is confirmed through the canonical ledger.
   try{await rpc('relay_night_shift',request);}catch{}
   const saved=(await read(config)).items.find(x=>x.id===itemId);
   if(!matches(saved))throw Error('Ledger write unconfirmed');
   receipt.ledger={state:'recorded',item_id:itemId};await persist(state);
  }catch{
   state.accounting={state:'reconciliation-required',job_id:config.job_id};await persist(state);return state;
  }
 }
 state.accounting={state:'finished'};await persist(state);return state;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),account=args[0]==='account';
 const [planFile,receiptFile,stopFile]=account?args.slice(1):args;
 if(!planFile||!receiptFile||(!account&&(!stopFile||!path.isAbsolute(stopFile))))throw Error('Usage: relay-night-shift.mjs plan.json new-private-receipt.json /absolute/stop-file; or account plan.json existing-private-receipt.json');
 const plan=validateNightShiftPlan(JSON.parse(await fs.readFile(planFile,'utf8')));
 const rpc=createMcpClient({token:process.env.RELAY_MCP_TOKEN});
 if(account){
  // A stale lock is a reconciliation boundary, never automatically removed.
  const lock=await openRoutingReceipt(receiptFile+'.accounting-lock',uniqueHosts(plan));
  let handle;
  try{
   const before=await fs.lstat(receiptFile);
   if(!before.isFile()||before.nlink!==1||(before.mode&0o077)!==0)throw Error('Accounting requires a private regular receipt');
   handle=await fs.open(receiptFile,constants.O_RDWR|constants.O_NOFOLLOW);
   const opened=await handle.stat();
   if(opened.ino!==before.ino||opened.dev!==before.dev||opened.nlink!==1)throw Error('Receipt changed before accounting');
   const journal=JSON.parse(await handle.readFile('utf8'));
   const result=await accountNightShiftPass({plan,journal,rpc,persist:async value=>{await handle.truncate(0);await handle.write(JSON.stringify(value,null,2)+'\n',0,'utf8');await handle.sync();}});
   console.log(JSON.stringify({state:result.state,accounting:result.accounting,away_verified:false,objective_completed:false}));
  }finally{await handle?.close();await lock.close();await fs.unlink(receiptFile+'.accounting-lock');}
 }else{
 // The same host may serve different jobs, but each receipt path is protected.
 const handle=await openRoutingReceipt(receiptFile,uniqueHosts(plan));
 try{
  // A signal is a stop request, not an abort: the pass still cancels the exact job
  // through Relay and persists its receipt. Only a repeated signal exits at once.
  let signalled=false;
  for(const name of ['SIGINT','SIGTERM'])process.on(name,()=>{if(signalled)process.exit(130);signalled=true;});
  const persist=async value=>{await handle.truncate(0);await handle.write(JSON.stringify(value,null,2)+'\n',0,'utf8');await handle.sync();};
  const journal=await runNightShiftPass({plan,rpc,shouldStop:async()=>{if(signalled)return true;try{await fs.lstat(stopFile);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}},persist});
  const result=await accountNightShiftPass({plan,journal,rpc,persist});
  console.log(JSON.stringify({state:result.state,accounting:result.accounting,jobs:result.jobs.map(x=>({job_id:x.job_id,state:x.state})),away_verified:false,objective_completed:false}));
 }finally{await handle.close();}
 }
}
