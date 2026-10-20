import './source-checkpoints.test.mjs';
import test from 'node:test';
import './night-shift.test.mjs';
import assert from 'node:assert/strict';
import { operateJob } from './jobs.mjs';
function fixture(){
  let value=null,etag=0,now=Date.parse('2026-10-03T00:00:00Z');
  const bucket={get:async()=>value?{etag:String(etag),json:async()=>JSON.parse(value)}:null,put:async(key,text,{onlyIf})=>{
    if(onlyIf instanceof Headers ? value!==null : onlyIf.etagMatches!==String(etag))return null;
    value=text;return {etag:String(++etag)};
  }};
  const target={state:'active',owner:'owner',branch:'relay/task',repository:'lrnolivia/relay',head_sha:'a'.repeat(40),lease_until:'2099-01-01T00:00:00Z',goal:'Original mission',acceptance:['Original acceptance'],paths:['src/']};
  const common={project:'relay',assignment:'fixture',expected_owner:'owner',expected_branch:'relay/task'};
  let job,token,op=0;
  const call=async(action,extra={})=>{const result=await operateJob(bucket,{...common,action,operation_id:'op-'+(++op),...(job?{job_id:job.id,expected_revision:job.revision}:{}),executor_id:'local-fixture',...(token?{lease_token:token}:{}),...extra},target,{now,uuid:()=> 'lease-fixture'});job=result.job;token=result.lease_token||token;return result;};
  return {bucket,target,common,call,advance:()=>{now+=300001;}};
}
test('durable execution distinguishes request, lease, process, cancellation and objective completion',async()=>{
  const f=fixture();let r=await f.call('submit',{prompt:'bounded work',expected_head_sha:f.target.head_sha});
  assert.equal(r.job.state,'queued');assert.equal(r.job.objective.goal,'Original mission');assert.equal(r.job.objective_completed,false);
  await assert.rejects(f.call('submit',{prompt:'duplicate',expected_head_sha:f.target.head_sha}),/occupies/);
  await assert.rejects(f.call('lease',{capabilities:[],expected_head_sha:f.target.head_sha}),/capabilities/);
  r=await f.call('lease',{capabilities:['codex-cli'],expected_head_sha:f.target.head_sha});assert.ok(r.lease_token);assert.equal(r.job.lease_token,undefined);
  await assert.rejects(f.call('start'),/concrete process/);
  await f.call('start',{process:{pid:100,host:'fixture',version:'synthetic',adapter:'codex-cli'}});
  await f.call('checkpoint',{checkpoint:{summary:'Changed source; verification pending',session_id:'session-fixture'}});
  r=await f.call('cancel');assert.equal(r.job.state,'cancel_requested');
  await assert.rejects(f.call('finish',{result:{state:'succeeded',exit_code:0,session_id:'session-fixture',head_sha:f.target.head_sha}}),/Cancellation/);
  r=await f.call('finish',{result:{state:'cancelled',exit_code:null,summary:'process exited'}});assert.equal(r.job.state,'cancelled');
});
test('expired execution never requeues automatically and ownership changes stop recovery',async()=>{
  const f=fixture();await f.call('submit',{prompt:'work',expected_head_sha:f.target.head_sha});
  await f.call('lease',{capabilities:['codex-cli'],expected_head_sha:f.target.head_sha});f.advance();
  assert.equal((await f.call('status')).job.observed_state,'recovery_required');
  await assert.rejects(f.call('lease',{capabilities:['codex-cli'],expected_head_sha:f.target.head_sha}),/not queued/);
  await assert.rejects(f.call('recover',{checkpoint:{summary:'saved'}}),/confirmed stopped/);
  f.target.owner='new-owner';
  await assert.rejects(f.call('recover',{previous_process_stopped:true,checkpoint:{summary:'saved'}}),/ownership/);
});
test('concurrent requests use CAS and repeat operation IDs cannot change intent',async()=>{
  const f=fixture();const args={...f.common,action:'submit',operation_id:'one',prompt:'work',expected_head_sha:f.target.head_sha};
  const r=await Promise.allSettled([operateJob(f.bucket,args,f.target),operateJob(f.bucket,{...args,operation_id:'two'},f.target)]);
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
  const again=await operateJob(f.bucket,args,f.target);assert.equal(again.replayed,true);
  await assert.rejects(operateJob(f.bucket,{...args,prompt:'different'},f.target),/different execution intent/);
});

const nativeReceipt=()=>({thread_id:'owner',host:'local',state:'active',observed_at:'2026-10-03T00:00:00Z'});
async function nativeFixture(){const f=fixture();await f.call('submit',{prompt:'Read-only native oversight',expected_head_sha:f.target.head_sha,required_capabilities:['native-thread-oversight-v1']});await f.call('lease',{capabilities:['native-thread-oversight-v1'],expected_head_sha:f.target.head_sha});return f;}
test('native oversight starts only with an active exact-owner host observation and no invented PID',async()=>{
 const f=await nativeFixture(),process={thread_id:'owner',host:'local',version:'native-host-fixture',adapter:'codex-desktop-oversight'};
 await assert.rejects(f.call('start',{process}),/fresh active host/);
 await f.call('checkpoint',{checkpoint:{summary:'Host reports the exact native chat active',native_thread:nativeReceipt()}});
 for(const patch of [{thread_id:'other'},{pid:123},{host:'other'},{adapter:'codex-cli'}])await assert.rejects(f.call('start',{process:{...process,...patch}}),/Native oversight/);
 const r=await f.call('start',{process});assert.equal(r.job.process.thread_id,'owner');assert.equal(r.job.process.pid,undefined);assert.equal(r.job.process_verified,false);assert.equal(r.job.objective_completed,false);
});
test('native oversight refuses stale, future, wrong-owner and unavailable host observations',async()=>{
 const f=await nativeFixture();
 for(const patch of [{observed_at:'2026-10-02T23:58:59Z'},{observed_at:'2026-10-03T00:00:06Z'},{observed_at:'invalid'},{thread_id:'other'},{state:'idle'},{host:''}])await assert.rejects(f.call('checkpoint',{checkpoint:{summary:'Rejected observation',native_thread:{...nativeReceipt(),...patch}}}),/fresh active host/);
 await f.call('checkpoint',{checkpoint:{summary:'Current observation',native_thread:nativeReceipt()}});f.advance();
 assert.equal((await f.call('status')).job.observed_state,'recovery_required');
});
test('a native oversight receipt cannot start a coding job or coexist with coding capabilities',async()=>{
 const f=fixture();await assert.rejects(f.call('submit',{prompt:'Mixed adapters',expected_head_sha:f.target.head_sha,required_capabilities:['native-thread-oversight-v1','codex-cli']}),/cannot be combined/);
 await f.call('submit',{prompt:'Real coding job',expected_head_sha:f.target.head_sha});await f.call('lease',{capabilities:['codex-cli'],expected_head_sha:f.target.head_sha});
 await assert.rejects(f.call('checkpoint',{checkpoint:{summary:'Not a native job',native_thread:nativeReceipt()}}),/Checkpoint requires/);
 await assert.rejects(f.call('start',{process:{thread_id:'owner',host:'local',version:'fixture',adapter:'codex-desktop-oversight'}}),/Coding execution/);
 await assert.rejects(f.call('start',{process:{host:'local',version:'fixture',adapter:'codex-cli'}}),/concrete process/);
});

import {jobsTool} from './job-control.mjs';
import {validateControlArguments} from '../../../src/runner-control.js';
test('public schema carries native host observations without admitting arbitrary proof fields',()=>{
 const base={action:'start',project:'relay',assignment:'oversight',process:{thread_id:'owner',host:'local',version:'fixture',adapter:'codex-desktop-oversight'}};
 assert.doesNotThrow(()=>validateControlArguments(base,jobsTool.inputSchema));
 assert.doesNotThrow(()=>validateControlArguments({action:'checkpoint',project:'relay',assignment:'oversight',checkpoint:{summary:'Host observation',native_thread:nativeReceipt()}},jobsTool.inputSchema));
 assert.throws(()=>validateControlArguments({...base,process:{...base.process,verified:true}},jobsTool.inputSchema));
});
