import test from 'node:test';
import assert from 'node:assert/strict';
import { operateNightShift, oversightView, completedSourceReceipt } from './night-shift.mjs';
import { operateJob } from './jobs.mjs';
import { nightShiftBrowser } from './night-shift-browser.mjs';
import { callJobs } from './job-control.mjs';
function fixture(){
 const objects=new Map();let etag=0;
 const bucket={get:async key=>{const v=objects.get(key);return v?{etag:v.etag,json:async()=>JSON.parse(v.text)}:null;},put:async(key,text,{onlyIf})=>{
  const prior=objects.get(key);if(onlyIf instanceof Headers?Boolean(prior):prior?.etag!==onlyIf.etagMatches)return null;
  const value={text,etag:String(++etag)};objects.set(key,value);return value;
 }};
 const now=Date.parse('2026-10-04T00:00:00Z');
 const claims=['caller','recipient'].map(id=>({id,owner:id+'-owner',branch:'relay/'+id,state:'active',lease_until:'2099-01-01T00:00:00Z',goal:'Original '+id+' mission',acceptance:['Original acceptance'],paths:['src/'],repository:'lrnolivia/relay',head_sha:'a'.repeat(40)}));
 const sourceJob={id:'job_'+'b'.repeat(64),project:'relay',assignment:'source',owner:'source-owner',branch:'relay/source',repository:'lrnolivia/relay',revision:4,state:'succeeded',process:{pid:42},started_at:'2026-10-03T20:00:00Z',finished_at:'2026-10-03T21:00:00Z',result:{head_sha:'c'.repeat(40),evidence:'sha256:source-receipt'}};
 const common={project:'relay',assignment:'caller',expected_owner:'caller-owner',expected_branch:'relay/caller'};
 const dependencies={claims,sourceJob,verifyCommit:async()=>true,submitJob:args=>operateJob(bucket,args,claims[1],{now})};
 const call=args=>operateNightShift(bucket,{...common,...args},dependencies,now);
 const record=()=>call({action:'record',expected_revision:0,operation_id:'record-one',job_id:sourceJob.id,source_assignment:'source',summary:'Actual attributed execution receipt',away_window:{start:'2026-10-03T19:00:00Z',end:'2026-10-03T22:00:00Z'}});
 return {bucket,claims,sourceJob,dependencies,common,call,record,now};
}
test('Night Shift requires concrete existing receipts inside an explicit away window and preserves original source attribution',async()=>{
 const f=fixture();f.sourceJob.state='queued';await assert.rejects(f.record(),/concrete process/);
 f.sourceJob.state='succeeded';f.sourceJob.started_at='2026-10-03T18:00:00Z';await assert.rejects(f.record(),/fit/);
 f.sourceJob.started_at='2026-10-03T20:00:00Z';f.dependencies.verifyCommit=async()=>false;await assert.rejects(f.record(),/source artifact/);
 f.dependencies.verifyCommit=async()=>true;const result=await f.record();
 assert.equal(result.item.source.owner,'source-owner');assert.equal(result.item.source.source_exists,true);
 assert.equal(result.item.away_verified,false);assert.equal(result.item.process_verified,false);assert.equal(result.item.objective_completed,false);
 assert.equal((await f.record()).replayed,true);
 const read=await f.call({action:'read'});assert.equal(read.items.length,1);assert.equal(read.oversight.available,false);
 f.claims[0].owner='different';await assert.rejects(f.call({action:'oversight',expected_revision:1,operation_id:'bind',oversight:{assignment:'recipient',owner:'recipient-owner',branch:'relay/recipient'}}),/ownership/);
});
test('Shift resumes an uncertain cross-store write with one exact job and keeps original recipient acceptance',async()=>{
 const f=fixture(),item=(await f.record()).item;
 const args={action:'shift',item_id:item.id,expected_revision:1,operation_id:'shift-one',summary:'Review preserved work',recipient:{assignment:'recipient',owner:'recipient-owner',branch:'relay/recipient',head_sha:'a'.repeat(40)}};
 let uncertain=true,calls=0;
 f.dependencies.submitJob=async jobArgs=>{calls++;const result=await operateJob(f.bucket,jobArgs,f.claims[1],{now:f.now});if(uncertain){uncertain=false;throw Error('Lost transport after persisted job');}return result;};
 await assert.rejects(f.call(args),/Lost transport/);
 const result=await f.call(args);assert.equal(result.shift.initial_state,'queued');assert.equal(result.shift.executor_started,false);assert.equal(result.shift.recipient_acknowledged,false);
 assert.equal((await f.call(args)).replayed,true);assert.equal(calls,2);
 const job=(await operateJob(f.bucket,{action:'status',project:'relay',assignment:'recipient'},null)).job;
 assert.deepEqual(job.objective.acceptance,['Original acceptance']);assert.equal(job.origin.item_id,item.id);assert.equal(job.origin.commit_sha,'c'.repeat(40));
 await assert.rejects(f.call({...args,summary:'Changed intent'}),/different/);
 await assert.rejects(f.call({...args,operation_id:'another',expected_revision:3}),/already/);
});
test('before-write revision rejection is definitive while a retained prepared request stays uncertain',async()=>{
 const f=fixture(),item=(await f.record()).item;
 const args={action:'shift',item_id:item.id,expected_revision:0,operation_id:'revision-test',summary:'Review',recipient:{assignment:'recipient',owner:'recipient-owner',branch:'relay/recipient',head_sha:'a'.repeat(40)}};
 await assert.rejects(f.call(args),error=>error.response_class==='revision'&&error.write_started===false);
 f.dependencies.submitJob=async()=>{throw Error('Transport unavailable after preparation');};
 args.expected_revision=1;
 await assert.rejects(f.call(args),error=>error.write_started===true&&error.response_class==='retained_or_uncertain');
 await assert.rejects(f.call(args),error=>error.write_started===true);
});
test('oversight binds an existing canonical assignment and becomes unavailable after a handoff',async()=>{
 const f=fixture();const result=await f.call({action:'oversight',expected_revision:0,operation_id:'bind',oversight:{assignment:'recipient',owner:'recipient-owner',branch:'relay/recipient'}});
 assert.equal(result.oversight.available,true);assert.equal(result.oversight.worker_online_verified,false);
 f.claims[1].owner='new-owner';const read=await f.call({action:'read'});assert.equal(read.oversight.available,false);
 assert.equal(oversightView({oversight:null},[]).available,false);
});
test('Night Shift browser transport is authenticated, same-origin and bounded; it cannot report a process',async()=>{
 const url='https://relay.loew.fi/api/night-shift/request';let calls=0;
 const request=(body,origin='https://relay.loew.fi')=>new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const options={authenticated:true,run:async args=>{calls++;return {ok:true,action:args.action};}};
 assert.equal((await nightShiftBrowser(request({action:'shift'}),{})).status,403);
 assert.equal((await nightShiftBrowser(request({action:'shift'},'https://elsewhere.invalid'),{},options)).status,403);
 assert.equal((await nightShiftBrowser(request({action:'start'}),{},options)).status,409);
 assert.equal((await nightShiftBrowser(request({action:'record',summary:'x'.repeat(17000)}),{},options)).status,413);
 assert.equal((await nightShiftBrowser(request({action:'shift'}),{},options)).status,200);assert.equal(calls,1);
});
test('generic job submission cannot fabricate Night Shift provenance without the prepared exact ledger operation',async()=>{
 const f=fixture();
 await assert.rejects(callJobs({action:'submit',project:'relay',assignment:'recipient',prompt:'Invented history',operation_id:'fabricated',origin:{kind:'night-shift',item_id:'ns_'+'a'.repeat(64),source_assignment:'source',source_job_id:'job_'+'b'.repeat(64),repository:'lrnolivia/relay',commit_sha:'c'.repeat(40),summary:'Invented history'}},{EVIDENCE:f.bucket}),/exact prepared/);
});
test('native completed-source backfill verifies original owner and exact merged identity without synthesizing a broker or duration',async()=>{
 const f=fixture(),claim={id:'native',owner:'native-codex-session',branch:'relay/native',state:'completed',work_accounted:true,evidence:'Canonical source and QA receipt',pr:41,merged_head_sha:'d'.repeat(40),merge_commit_sha:'e'.repeat(40),goal:'Original native work'};
 f.claims.push(claim);
 const project={registration:{repository:'lrnolivia/relay',default_branch:'main'},coordination:{claims:f.claims}};
 const pr={merged:true,merged_at:'2026-10-03T21:00:00Z',head:{ref:claim.branch,sha:claim.merged_head_sha,repo:{full_name:'lrnolivia/relay'}},base:{ref:'main',repo:{full_name:'lrnolivia/relay'}},merge_commit_sha:claim.merge_commit_sha};
 const api=async route=>route.includes('/pulls/')?pr:{sha:claim.merged_head_sha};
 const args={action:'record_source',source_assignment:claim.id,source_commit_sha:claim.merged_head_sha,operation_id:'native-one',expected_revision:0,summary:'Genuine completed native source receipt',away_window:{start:'2026-10-03T19:00:00Z',end:'2026-10-03T22:00:00Z'}};
 claim.work_accounted=false;await assert.rejects(completedSourceReceipt(args,project,api),/fully accounted/);claim.work_accounted=true;
 pr.head.ref='different';await assert.rejects(completedSourceReceipt(args,project,api),/identity/);pr.head.ref=claim.branch;
 await assert.rejects(completedSourceReceipt({...args,source_commit_sha:'f'.repeat(40)},project,api),/differs/);
 f.dependencies.sourceReceipt=await completedSourceReceipt(args,project,api);
 const result=await f.call(args);assert.equal(result.item.source.owner,'native-codex-session');assert.equal(result.item.source.job_id,null);
 assert.equal(result.item.source.work_duration,null);assert.equal(result.item.source.started_at,undefined);assert.equal(result.item.source.finished_at,undefined);
 assert.equal(result.item.source.provenance_kind,'canonical-assignment-and-merged-source');assert.equal(result.item.source.native_task_verified,false);
 assert.equal((await f.call(args)).replayed,true);
 const catalogue=await f.call({action:'read'});assert.equal(catalogue.native_sources[0].assignment,'native');assert.equal(catalogue.native_sources[0].requires_source_verification,true);
 const shifted=await f.call({action:'shift',item_id:result.item.id,operation_id:'native-shift',expected_revision:1,summary:'Continue preserved native source',recipient:{assignment:'recipient',owner:'recipient-owner',branch:'relay/recipient',head_sha:'a'.repeat(40)}});
 const job=(await operateJob(f.bucket,{action:'status',project:'relay',assignment:'recipient'},null)).job;
 assert.equal(shifted.shift.initial_state,'queued');assert.equal(job.origin.source_job_id,undefined);assert.equal(job.origin.source_pr,41);assert.deepEqual(job.objective.acceptance,['Original acceptance']);
});
test('native-source backfill cannot infer away duration from a merge outside the declared window',async()=>{
 const f=fixture();f.dependencies.sourceReceipt={assignment:'native',commit_sha:'d'.repeat(40),source_exists:true,merged_receipt_verified:true,source_event_at:'2026-10-03T18:00:00Z',pr:41};
 await assert.rejects(f.call({action:'record_source',source_assignment:'native',source_commit_sha:'d'.repeat(40),operation_id:'native-outside',expected_revision:0,summary:'No synthetic duration',away_window:{start:'2026-10-03T19:00:00Z',end:'2026-10-03T22:00:00Z'}}),/source event must fit/);
});
