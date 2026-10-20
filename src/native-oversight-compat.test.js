import test from 'node:test';
import assert from 'node:assert/strict';
import {callCompatibleJobs,NATIVE_OVERSIGHT_PREFIX} from './native-oversight-compat.js';
import {operateJob} from '../packages/runner/src/jobs.mjs';

const now=Date.parse('2026-10-20T19:45:00Z');
async function fixture(){
 let data=null,etag=0;
 const bucket={get:async()=>data?{etag:String(etag),json:async()=>JSON.parse(data)}:null,put:async(_key,value,{onlyIf})=>{if(onlyIf instanceof Headers?data!==null:onlyIf.etagMatches!==String(etag))return null;data=value;return {etag:String(++etag)};}};
 const target={state:'active',owner:'owner',branch:'relay/lead',repository:'lrnolivia/relay',head_sha:'a'.repeat(40),lease_until:'2099-01-01T00:00:00Z',goal:'Observe exact jobs',acceptance:['Read-only oversight'],paths:['docs/relay/oversight.md']};
 const base={project:'relay',assignment:'lead',expected_owner:target.owner,expected_branch:target.branch,executor_id:'native-fixture'};
 let submitted=await operateJob(bucket,{...base,action:'submit',operation_id:'submit',prompt:'Native oversight',expected_head_sha:target.head_sha,required_capabilities:['native-thread-oversight-v1']},target,{now});
 const leased=await operateJob(bucket,{...base,action:'lease',job_id:submitted.job.id,operation_id:'lease',expected_revision:submitted.job.revision,expected_head_sha:target.head_sha,capabilities:['native-thread-oversight-v1']},target,{now,uuid:()=> 'private-fixture-lease'});
 const envelope={command:'start',thread_id:'owner',host:'local',version:'native-host-schema-1',state:'active',observed_at:new Date(now).toISOString()};
 const args={...base,action:'checkpoint',job_id:leased.job.id,lease_token:leased.lease_token,expected_revision:leased.job.revision,operation_id:'host-observation',checkpoint:{summary:'Actual host observation fixture',session_id:'owner',head_sha:target.head_sha,evidence:NATIVE_OVERSIGHT_PREFIX+JSON.stringify(envelope)}};
 const calls=[];const call=async input=>{calls.push(structuredClone(input));return operateJob(bucket,input,target,{now});};
 return {args,envelope,target,calls,call,operate:()=>callCompatibleJobs(args,{}, {call})};
}
test('legacy native start saves a validated observation and reports the actual owner thread without a PID',async()=>{
 const f=await fixture(),r=await f.operate();assert.equal(r.job.state,'running');assert.equal(r.job.process.thread_id,'owner');assert.equal(r.job.process.pid,undefined);assert.equal(r.job.process_verified,false);
 assert.deepEqual(f.calls.map(x=>x.action),['status','checkpoint','start']);
 assert.equal(r.job.checkpoint.native_thread.observed_at,f.envelope.observed_at);
 const replay=await f.operate();assert.equal(replay.replayed,true);assert.deepEqual(f.calls.slice(-2).map(x=>x.action),['status','start']);
});
test('legacy native observation refresh keeps all broker lease, revision and freshness checks',async()=>{
 const f=await fixture(),started=await f.operate();f.envelope.command='observe';f.args.expected_revision=started.job.revision;f.args.operation_id='next-observation';f.args.checkpoint.evidence=NATIVE_OVERSIGHT_PREFIX+JSON.stringify(f.envelope);
 assert.equal((await f.operate()).job.state,'running');
 f.args.operation_id='stale';f.args.expected_revision++;f.envelope.observed_at=new Date(now-60001).toISOString();f.args.checkpoint.evidence=NATIVE_OVERSIGHT_PREFIX+JSON.stringify(f.envelope);
 await assert.rejects(f.operate(),/fresh active host/);
});
test('wrong owner, token, revision, envelope and non-native capability cannot start oversight',async()=>{
 for(const mutate of [f=>{f.args.expected_owner='other';},f=>{f.args.lease_token='wrong';},f=>{f.args.expected_revision++;},f=>{f.envelope.thread_id='other';},f=>{f.envelope.extra='not allowed';},f=>{f.envelope.observed_at=new Date(now+5001).toISOString();}]){
  const f=await fixture();mutate(f);f.args.checkpoint.evidence=NATIVE_OVERSIGHT_PREFIX+JSON.stringify(f.envelope);await assert.rejects(f.operate());
  assert.ok(!f.calls.some(c=>c.action==='start'),'failed admission never starts');
 }
 const f=await fixture(),call=f.call;f.call=async args=>{const r=await call(args);if(args.action==='status')r.job.required_capabilities=['codex-cli'];return r;};
 await assert.rejects(callCompatibleJobs(f.args,{}, {call:f.call}),/native-only/);assert.deepEqual(f.calls.map(c=>c.action),['status']);
});
test('lost start response reconciles the exact broker operation without replaying its checkpoint',async()=>{
 const f=await fixture(),call=f.call;let lose=true;
 const bridge=async args=>{const r=await call(args);if(args.action==='start'&&lose){lose=false;throw Error('lost response');}return r;};
 await assert.rejects(callCompatibleJobs(f.args,{}, {call:bridge}),/lost response/);
 const r=await callCompatibleJobs(f.args,{}, {call:bridge});assert.equal(r.replayed,true);assert.equal(f.calls.filter(c=>c.action==='checkpoint').length,1);
 f.args.lease_token='wrong';await assert.rejects(callCompatibleJobs(f.args,{}, {call:bridge}),/different execution intent/);
});
test('lost observation response reuses its exact checkpoint before starting, and a different start is never inferred',async()=>{
 const f=await fixture(),call=f.call;let lose=true;
 const bridge=async args=>{const r=await call(args);if(args.action==='checkpoint'&&lose){lose=false;throw Error('lost checkpoint response');}return r;};
 await assert.rejects(callCompatibleJobs(f.args,{}, {call:bridge}),/lost checkpoint/);
 const r=await callCompatibleJobs(f.args,{}, {call:bridge});assert.equal(r.job.state,'running');assert.equal(f.calls.filter(c=>c.action==='start').length,1);
 f.args.operation_id='different-start';await assert.rejects(f.operate(),/revision changed/);
});
test('ordinary execution calls and evidence remain unchanged, mixed or malformed native envelopes fail closed',async()=>{
 const normal={action:'status',project:'relay',assignment:'work'};let sent;
 assert.deepEqual(await callCompatibleJobs(normal,{}, {call:async args=>{sent=args;return {ok:true};}}),{ok:true});assert.equal(sent,normal);
 for(const evidence of [NATIVE_OVERSIGHT_PREFIX+'{',NATIVE_OVERSIGHT_PREFIX+'[]']){const f=await fixture();f.args.checkpoint.evidence=evidence;await assert.rejects(f.operate(),/Invalid native/);assert.equal(f.calls.length,0);}
 const f=await fixture();f.args.checkpoint.native_thread={thread_id:'owner',host:'local',state:'active',observed_at:new Date(now).toISOString()};await assert.rejects(f.operate(),/cannot mix/);
});
