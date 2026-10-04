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
