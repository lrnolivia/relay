import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileContinuity,validateContinuityPlan} from './relay-continuity.mjs';
const plan=()=>({schema:1,authorization:'Explicit user authorization includes testing, review and shipping',objective_digest:'a'.repeat(64),environment:{node:'22.23.3',lock:'fixture'},criteria:['A','B','C'],stages:['A','B','C'].map((id,i)=>({id:id.toLowerCase(),kind:i===0?'implementation':i===1?'test':'ship',criteria:[id],depends_on:i?[String.fromCharCode(96+i)]:[],prompt:'Complete '+id,inputs:[id+'.js'],verify:['verify',id]}))});
function fixture(){
 const p=plan(),f={plan:p,calls:[],saved:[],versions:{a:1,b:1,c:1},passed:{},control:{held:false,global_held:false,assignment_active:true,revision:1,global_revision:0,objective_digest:p.objective_digest,source_sha:'b'.repeat(40)}};
 f.options={plan:p,persist:async s=>f.saved.push(structuredClone(s)),readControl:async()=>structuredClone(f.control),inputs:async s=>f.versions[s.id],verify:async s=>({passed:f.passed[s.id]===true,evidence:'exact-'+s.id,fingerprint:'fixable'}),execute:async pending=>{f.calls.push(pending.stage);f.passed[pending.stage]=true;return {state:'succeeded'};},reconcile:async()=>null};
 f.run=(extra={})=>reconcileContinuity({...f.options,...extra});return f;
}
test('coordinator proceeds from completed A to B through authorized shipping and complete acceptance',async()=>{
 const f=fixture(),s=await f.run();assert.deepEqual(f.calls,['a','b','c']);assert.equal(s.objective_completed,true);assert.equal(f.saved[0].stages.a.state,'dispatching');assert.ok(s.stages.c.receipt.evidence);
});
test('a successful process with failing tests is repaired and cannot complete the objective',async()=>{
 const f=fixture();let tests=0;f.options.execute=async p=>{f.calls.push(p.stage);if(p.stage!=='b'||++tests===2)f.passed[p.stage]=true;return {state:'succeeded'};};
 const s=await f.run();assert.deepEqual(f.calls,['a','b','b','c']);assert.equal(s.objective_completed,true);
 const bad=fixture();bad.options.execute=async p=>{bad.calls.push(p.stage);return {state:'succeeded'};};const held=await bad.run();assert.equal(held.objective_completed,false);assert.deepEqual(bad.calls,['a','a']);assert.equal(held.stages.a.state,'parked');
});
test('valid unchanged checkpoints are reused, failed stage resumes, relevant source/config changes invalidate evidence',async()=>{
 const f=fixture();f.options.execute=async p=>{f.calls.push(p.stage);if(p.stage!=='b')f.passed[p.stage]=true;return {state:'succeeded'};};const s=await f.run();assert.equal(s.stages.a.state,'passed');assert.equal(s.objective_completed,false);
 f.passed.b=true;f.calls=[];const resumed=await f.run({journal:s});assert.deepEqual(f.calls,['c']);assert.equal(resumed.objective_completed,true);
 let verifications=[];const verify=f.options.verify;f.options.verify=async stage=>{verifications.push(stage.id);return verify(stage);};await f.run({journal:resumed});assert.deepEqual(verifications,['c'],'shipping always gets fresh readback');
 f.versions.a=2;f.passed.a=false;f.calls=[];await f.run({journal:resumed});assert.equal(f.calls[0],'a');
 const changed=structuredClone(f.plan);changed.environment.node='different';await assert.rejects(f.run({plan:changed,journal:resumed}),/plan changed/);
});
test('later stage source edits invalidate earlier evidence before whole-objective completion',async()=>{
 const f=fixture(),execute=f.options.execute;let edited=false;f.options.execute=async p=>{if(p.stage==='c'&&!edited){edited=true;f.versions.a++;f.passed.a=false;}return execute(p);};const s=await f.run();assert.equal(s.objective_completed,true);assert.equal(f.calls.filter(x=>x==='a').length,2);
});
test('uncertain launch never duplicates; terminal readback advances while independent stages continue',async()=>{
 const f=fixture();f.options.execute=async p=>{f.calls.push(p.stage);throw Error('lost reply');};const s=await f.run();assert.equal(s.objective_completed,false);assert.equal(s.stages.a.state,'reconciliation-required');await f.run({journal:s});assert.deepEqual(f.calls,['a']);
 f.passed.a=true;f.options.reconcile=async()=>({state:'succeeded',job_id:'original'});f.options.execute=async p=>{f.calls.push(p.stage);f.passed[p.stage]=true;return {state:'succeeded'};};assert.equal((await f.run({journal:s})).objective_completed,true);assert.deepEqual(f.calls,['a','b','c']);
});
for(const key of ['held','global_held','security_stop'])test(key+' blocks all dependent continuation',async()=>{const f=fixture();f.control[key]=true;await assert.rejects(f.run(),/authority stops/);assert.deepEqual(f.calls,[]);});
test('stale control revisions cannot launch and missing acceptance cannot disappear',async()=>{
 const f=fixture();let reads=0;f.options.readControl=async()=>({...f.control,revision:++reads});await assert.rejects(f.run(),/revision changed/);assert.deepEqual(f.calls,[]);
 const p=plan();p.criteria.push('forgotten');assert.throws(()=>validateContinuityPlan(p),/drops acceptance/);
});

test('native coordinator journals and resumes trusted publication commands without rerunning completed work',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),{execFileSync}=await import('node:child_process'),{createHash}=await import('node:crypto'),{runContinuityExecution}=await import('./relay-continuity.mjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-continuity-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');await fs.mkdir(workspace);
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 try{
  git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);await fs.writeFile(path.join(workspace,'README.md'),'baseline');git(['add','.']);git(['commit','-m','baseline']);
  const objective={goal:'Complete the finite objective',acceptance:'A then B and shipping C'};
  const p=plan();p.objective_digest=createHash('sha256').update(JSON.stringify(objective)).digest('hex');
  for(const stage of p.stages){stage.inputs=['README.md'];stage.command=[process.execPath,'-e',`require('node:fs').appendFileSync('${stage.id}.txt','once\\n')`];stage.verify=[process.execPath,'-e',`if(!require('node:fs').existsSync('${stage.id}.txt'))process.exit(1)`];}
  const rpc=async(name,args)=>{
   if(name==='relay_autonomy')return {ok:true,state:{revision:0,held:false}};
   if(name==='relay_runner_resume')return {ok:true,latest:{assignment:{...objective,id:'fixture',owner:'fixture',branch:'relay/fixture',state:'active'}}};throw Error('Command stages must not create coding jobs');
  };
  const run=()=>runContinuityExecution({config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',continuity:p},workspace,stateDir,rpc,runExecution:()=>{throw Error('Unexpected coding process');}});
  assert.equal((await run()).objective_completed,true);assert.equal((await run()).objective_completed,true);
  for(const id of ['a','b','c'])assert.equal(await fs.readFile(path.join(workspace,id+'.txt'),'utf8'),'once\n');
  const saved=JSON.parse(await fs.readFile(path.join(stateDir,'continuity.json'),'utf8'));assert.equal(saved.stages.c.pending,null);assert.ok(saved.stages.c.receipt.evidence);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('a reconciled queued submission starts its original job exactly once',async()=>{
 const f=fixture();f.options.execute=async p=>{f.calls.push(p.stage);throw Error('lost submit reply');};const s=await f.run();
 f.options.reconcile=async()=>({state:'queued',job_id:'original'});f.options.execute=async p=>{f.calls.push(p.stage);f.passed[p.stage]=true;return {state:'succeeded',job_id:'original'};};assert.equal((await f.run({journal:s})).objective_completed,true);assert.deepEqual(f.calls,['a','a','b','c']);
});
