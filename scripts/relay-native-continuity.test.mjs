import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openNativeChannel,pendingNativeRequest,beginNativeWork,replyNativeRequest} from './relay-native-continuity.mjs';
import {nativeProofConfig,verifyNativeProof,proofDirectory} from './relay-native-proof.mjs';
import {reconcileContinuity,validateContinuityPlan} from './relay-continuity.mjs';

const config={project:'relay',assignment:'native',owner:'current-native-task',branch:'relay/native',continuity:{schema:1}};
async function fixture(t){const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'relay-native-channel-'))),workspace=path.join(root,'checkout'),directory=path.join(root,'private');await fs.mkdir(workspace);t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,workspace,directory,channel:await openNativeChannel({config,directory,workspace,waitMs:3000})};}
async function pending(directory){for(let i=0;i<100;i++){try{return await pendingNativeRequest(directory);}catch(e){if(e.code!=='ENOENT')throw e;}await new Promise(r=>setTimeout(r,5));}throw Error('No native request');}
test('native snapshot uses existing tools without token and each control gate refreshes all three reads',async t=>{
 const f=await fixture(t),first=f.channel.rpc('relay_autonomy',{action:'status',scope:'global'}),p=await pending(f.directory);
 assert.equal(p.request.kind,'snapshot');const values={global:{ok:true,state:{held:false,revision:0}},project:{ok:true,state:{held:false,revision:7}},assignments:{ok:true,record_sha:'a'.repeat(40),claims:[{id:'native',state:'active'}]}};
 await replyNativeRequest(f.directory,p.request.id,values);assert.deepEqual(await first,values.global);assert.deepEqual(await f.channel.rpc('relay_autonomy',{action:'status',scope:'relay'}),values.project);assert.deepEqual(await f.channel.rpc('relay_runner_assignments',{project:'relay',assignment:'native'}),values.assignments);
 const next=f.channel.rpc('relay_autonomy',{action:'status',scope:'global'});let q;for(let i=0;i<100;i++){q=await pending(f.directory);if(q.request.id!==p.request.id)break;await new Promise(r=>setTimeout(r,5));}assert.notEqual(q.request.id,p.request.id);await replyNativeRequest(f.directory,q.request.id,values);await next;
 await assert.rejects(f.channel.rpc('relay_autonomy',{action:'resume',scope:'relay'}),/exceeds/);await assert.rejects(f.channel.rpc('relay_runner_assignments',{project:'field',assignment:'other'}),/exceeds/);
});
test('native work has a durable once-only start and exact immutable response; uncertain work never re-executes',async t=>{
 const f=await fixture(t),pendingWork={operation_id:'one',stage:'a'},running=f.channel.nativeHost.execute(pendingWork,{id:'a'},{original_goal:'Goal'}),p=await pending(f.directory);
 await assert.rejects(replyNativeRequest(f.directory,p.request.id,{state:'succeeded',summary:'No started receipt',head_sha:'a'.repeat(40)}),/Persist/);
 await beginNativeWork(f.directory,p.request.id);await assert.rejects(beginNativeWork(f.directory,p.request.id),/already started/);assert.equal(await f.channel.nativeHost.reconcile(pendingWork),null);
 const result={state:'succeeded',summary:'Native task actually performed fixture work',head_sha:'a'.repeat(40)};await replyNativeRequest(f.directory,p.request.id,result);const r=await running;assert.equal(r.adapter,'codex-native-tools');assert.equal(r.objective_completed,false);assert.equal(r.process_verified,false);assert.deepEqual(await f.channel.nativeHost.reconcile(pendingWork),result);
 await assert.rejects(replyNativeRequest(f.directory,p.request.id,{...result,summary:'Overwrite'}),/identity changed/);await assert.rejects(replyNativeRequest(f.directory,'b'.repeat(64),result),/target changed/);
});
test('native Codex receives canonical maintenance guidance and preserves a failed report through recovery',async t=>{
 const f=await fixture(t),work={operation_id:'maintenance',stage:'a'},running=f.channel.nativeHost.execute(work,{id:'a'},{original_goal:'Preserve Share'}),p=await pending(f.directory);
 assert.equal(p.request.data.context.test_maintenance.host,'codex');
 assert.deepEqual(p.request.data.context.test_maintenance.playwright_test_agents.init,{codex:'npx playwright init-agents --loop=codex'});
 await beginNativeWork(f.directory,p.request.id);
 const report={schema:1,tested_commit:'a'.repeat(40),run:{id:'native-local'},counts:{passed:0,failed:1,skipped:0,total:1},behaviors:[{id:'share',status:'unchanged'}],tests:[]};
 const result={state:'succeeded',summary:'Native work returned; acceptance still needs verification.',head_sha:'a'.repeat(40),test_maintenance_report:report};
 await assert.rejects(replyNativeRequest(f.directory,p.request.id,{...result,test_maintenance_report:{padding:'x'.repeat(65536)}}),/bounded object/);
 await replyNativeRequest(f.directory,p.request.id,result);
 const actual=await running;
 assert.equal(actual.state,'succeeded');assert.equal(actual.objective_completed,false);
 assert.equal(actual.test_maintenance.verdict,'fail');
 assert.match(actual.summary,/Test maintenance fail · 0 passed, 1 failed/);
 assert.match(actual.summary,/run native-local/);
 const recovered=await f.channel.nativeHost.reconcile(work);
 assert.equal(recovered.summary,actual.summary);assert.deepEqual(recovered.test_maintenance,actual.test_maintenance);
});
test('native channel refuses another plan, public directory, symlink and invented native Claude adapter',async t=>{
 const f=await fixture(t);await assert.rejects(openNativeChannel({config:{...config,continuity:{changed:true}},directory:f.directory,workspace:f.workspace}),/identity changed/);
 const link=path.join(f.root,'link');await fs.symlink(f.directory,link);await assert.rejects(openNativeChannel({config,directory:link,workspace:f.workspace}),/symlink/);
 await assert.rejects(openNativeChannel({config:{...config,provider:'claude'},directory:f.directory,workspace:f.workspace}),/not a Claude/);
 const publicDir=path.join(f.root,'public');await fs.mkdir(publicDir,{mode:0o755});await assert.rejects(openNativeChannel({config,directory:publicDir,workspace:f.workspace}),/private owned/);
 const reading=f.channel.rpc('relay_autonomy',{action:'status',scope:'global'}),packet=await pending(f.directory),hardlink=path.join(f.root,'arbitrary-link');
 await fs.link(path.join(f.directory,packet.request.id+'.request.json'),hardlink);await assert.rejects(pendingNativeRequest(f.directory),/Invalid private native packet/);await fs.unlink(hardlink);
 await replyNativeRequest(f.directory,packet.request.id,{global:{ok:true},project:{ok:true},assignments:{ok:true}});await reading;

});
test('fixture profiles verify real outputs and reject corrupted supporting results',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-native-proof-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const dir=path.join(root,proofDirectory);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'a.json'),'{"seed":7}');assert.deepEqual(await verifyNativeProof('a',root),{criterion:'native-fixture-a',seed:7});
 await fs.writeFile(path.join(dir,'support.json'),'{"validated_seed":7,"doubled":13}');await assert.rejects(verifyNativeProof('support',root));await fs.writeFile(path.join(dir,'support.json'),'{"validated_seed":7,"doubled":14}');await fs.writeFile(path.join(dir,'b.json'),'{"sum":21}');assert.equal((await verifyNativeProof('b',root)).sum,21);
 assert.equal(validateContinuityPlan(nativeProofConfig({id:'one',owner:'native',branch:'relay/fixture',goal:'Goal',acceptance:'Acceptance'}).continuity).completion_scope,'subobjective');
});
test('native subtask acceptance cannot be represented as whole-objective completion',async()=>{
 const p=nativeProofConfig({id:'one',owner:'native',branch:'relay/fixture',goal:'Goal',acceptance:'Full objective'}).continuity,passed=new Set(),calls=[];
 const s=await reconcileContinuity({plan:p,persist:async()=>{},readControl:async()=>({held:false,global_held:false,assignment_active:true,revision:0,global_revision:0,objective_digest:p.objective_digest,original_goal_digest:p.expansion.original_goal&&await import('../packages/runner/src/continuity-expansion.mjs').then(x=>x.expansionDigest('Goal')),source_sha:'a'.repeat(40)}),inputs:async()=>1,verify:async stage=>({passed:passed.has(stage.id),evidence:'fixture'}),execute:async request=>{calls.push(request.stage);passed.add(request.stage);return {state:'succeeded'};},reconcile:async()=>null});
 assert.deepEqual(calls,['a','b']);assert.equal(s.acceptance_completed,true);assert.equal(s.subobjective_completed,true);assert.equal(s.objective_completed,false);
});

test('atomic response publication never exposes a partial large JSON packet to the waiting reader',async t=>{
 const f=await fixture(t);let previous;
 for(let i=0;i<8;i++){
  const read=f.channel.rpc('relay_autonomy',{action:'status',scope:'global'});let p;
  for(let n=0;n<100;n++){p=await pending(f.directory);if(p.request.id!==previous)break;await new Promise(r=>setTimeout(r,5));}
  previous=p.request.id;const response={global:{ok:true,body:'X'.repeat(200000),revision:i},project:{ok:true},assignments:{ok:true}};
  await replyNativeRequest(f.directory,p.request.id,response);assert.equal((await read).revision,i);
 }
});

test('actual canonical assignment shape rejects held/expired ownership, and native source escape preserves an uncertain intent',async t=>{
 const {execFileSync}=await import('node:child_process'),{runContinuityExecution}=await import('./relay-continuity.mjs'),{continuityObjectiveDigest}=await import('../packages/runner/src/continuity-expansion.mjs');
 const f=await fixture(t),git=args=>execFileSync('git',args,{cwd:f.workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 git(['init','-b','relay/native']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);await fs.writeFile(path.join(f.workspace,'outside.txt'),'preserved');git(['add','.']);git(['commit','-m','fixture']);const head=git(['rev-parse','HEAD']);
 const objective={goal:'Native scope enforcement',acceptance:'Actual ownership and scope guard'},plan={schema:1,authorization:'Fixture only',objective_digest:continuityObjectiveDigest(objective.goal,objective.acceptance),environment:{fixture:1},criteria:['A'],stages:[{id:'a',kind:'implementation',criteria:['A'],depends_on:[],prompt:'Work inside allowed/',inputs:['allowed/'],verify:[process.execPath,'-e','process.exit(1)']}]};
 let claim={...objective,id:config.assignment,owner:config.owner,branch:config.branch,state:'active',paths:['allowed/'],lease_until:new Date(Date.now()+3600000).toISOString()},starts=0;
 const rpc=async(name,args)=>{if(name==='relay_autonomy')return {ok:true,state:{held:false,revision:0}};if(name==='relay_runner_assignments')return {ok:true,record_sha:'a'.repeat(40),claims:[claim]};if(name==='relay_execution')return {ok:true,job:null};throw Error('Must read canonical assignments, not resume projection');};
 const nativeHost={reconcile:async()=>null,execute:async()=>{starts++;await fs.writeFile(path.join(f.workspace,'outside.txt'),'out of scope');return {state:'succeeded',head_sha:head,summary:'Unsafe fixture adapter report'};}};
 const run=stage=>runContinuityExecution({config:{...config,continuity:plan},workspace:f.workspace,stateDir:path.join(f.root,stage),rpc,nativeHost});
 claim={...claim,state:'held'};await assert.rejects(run('held'),/authority stops/);claim={...claim,state:'active',lease_until:'2000-01-01T00:00:00Z'};await assert.rejects(run('expired'),/authority stops/);assert.equal(starts,0);
 claim={...claim,lease_until:new Date(Date.now()+3600000).toISOString()};const state=await run('escape');assert.equal(starts,1);assert.equal(state.objective_completed,false);assert.equal(state.stages.a.state,'reconciliation-required');assert.ok(state.stages.a.pending);
});

test('native mutation persists one start and an uncertain/rejected reply cannot be replayed as another tool call',async t=>{
 const f=await fixture(t),args={action:'amend',project:'relay',expected_record_sha:'a'.repeat(40),request:{id:'native',owner:config.owner,next_action:'Record actual fixture progress',reason:'Fixture'}};
 const result=f.channel.rpc('relay_runner_coordinate',args),p=await pending(f.directory);assert.equal(p.request.kind,'rpc');
 const uncertain={ok:false,reconcile_required:true,error:{class:'uncertain_write'}};
 await assert.rejects(replyNativeRequest(f.directory,p.request.id,uncertain),/Persist/);await beginNativeWork(f.directory,p.request.id);await replyNativeRequest(f.directory,p.request.id,uncertain);assert.deepEqual(await result,uncertain);
 assert.deepEqual(await f.channel.rpc('relay_runner_coordinate',args),uncertain);assert.equal((await fs.readdir(f.directory)).filter(x=>x.endsWith('.started.json')).length,1);assert.equal((await fs.readdir(f.directory)).filter(x=>x.endsWith('.request.json')).length,1);
 await assert.rejects(f.channel.rpc('relay_runner_coordinate',{...args,request:{...args.request,goal:'Changed goal'}}),/exceeds/);
});
