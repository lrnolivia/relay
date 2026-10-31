import {createHash} from 'node:crypto';
import {transition} from '../src/coordination-engine.js';
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
 const f=fixture(),s=await f.run();assert.deepEqual(f.calls,['a','b','c']);assert.equal(s.objective_completed,true);assert.equal(f.saved[0].stages.a.state,'repair-required');assert.ok(f.saved.some(s=>s.stages.a.state==='dispatching'&&s.stages.a.pending),'dispatch intent remains durable before execution');assert.ok(s.stages.c.receipt.evidence);
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
  let canonical={...objective,id:'fixture',owner:'fixture',branch:'relay/fixture',state:'active',paths:['README.md'],resources:[],lease_until:new Date(Date.now()+3600000).toISOString()},revision='a'.repeat(40),writes=0;
  const rpc=async(name,args)=>{
   if(name==='relay_runner_coordinate'){assert.equal(args.expected_record_sha,revision);canonical=transition({claims:[canonical],queue:[]},{...args.request,action:args.action},{max_active_branches:4,lease_hours:12}).claims[0];revision=String(++writes).padStart(40,'0');return {ok:true};}
   if(name==='relay_autonomy')return {ok:true,state:{revision:0,held:false}};
   if(name==='relay_runner_assignments')return {ok:true,record_sha:revision,claims:[structuredClone(canonical)]};throw Error('Command stages must not create coding jobs');
  };
  const run=()=>runContinuityExecution({config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',continuity:p},workspace,stateDir,rpc,runExecution:()=>{throw Error('Unexpected coding process');}});
  assert.equal((await run()).objective_completed,true);assert.equal((await run()).objective_completed,true);
  for(const id of ['a','b','c'])assert.equal(await fs.readFile(path.join(workspace,id+'.txt'),'utf8'),'once\n');
  const saved=JSON.parse(await fs.readFile(path.join(stateDir,'continuity.json'),'utf8'));assert.equal(saved.stages.c.pending,null);assert.ok(saved.stages.c.receipt.evidence);
  const before=saved.stages.a.receipt.input_digest,priorTZ=process.env.TZ;
  try{process.env.TZ=priorTZ==='UTC'?'Europe/London':'UTC';const changed=await run();assert.notEqual(changed.stages.a.receipt.input_digest,before,'Measured environment invalidates unchanged plan evidence');}finally{if(priorTZ===undefined)delete process.env.TZ;else process.env.TZ=priorTZ;}
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('a reconciled queued submission starts its original job exactly once',async()=>{
 const f=fixture();f.options.execute=async p=>{f.calls.push(p.stage);throw Error('lost submit reply');};const s=await f.run();
 f.options.reconcile=async()=>({state:'queued',job_id:'original'});f.options.execute=async p=>{f.calls.push(p.stage);f.passed[p.stage]=true;return {state:'succeeded',job_id:'original'};};assert.equal((await f.run({journal:s})).objective_completed,true);assert.deepEqual(f.calls,['a','a','b','c']);
});

test('publisher reconciles a lost reply, deduplicates milestones and leaves uncertain writes pending without replay',async()=>{
 const {publishContinuityCard,continuityCardProjection}=await import('./relay-continuity.mjs'),{createHash}=await import('node:crypto');
 const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 const objective={goal:'Fixture publication',acceptance:'Verified priority'};
 const p=plan();p.objective_digest=hash(objective);const journal={schema:1,plan_digest:hash(p),stages:{}};
 function publisherFixture(mode){
  let claim={...objective,id:'fixture',owner:'worker',branch:'relay/fixture',state:'active',lease_until:new Date(Date.now()+3600000).toISOString(),paths:['src/'],resources:[]},revision='a'.repeat(40),writes=0,intent=null;
  const config={project:'relay',assignment:'fixture',owner:'worker',branch:'relay/fixture'};
  const readControl=async()=>({held:false,global_held:false,assignment_active:true,objective_digest:p.objective_digest,canonical_record_sha:revision});
  const rpc=async(name,args)=>{
   if(name==='relay_runner_assignments')return {ok:true,record_sha:revision,claims:[structuredClone(claim)]};
   assert.equal(name,'relay_runner_coordinate');writes++;assert.equal(args.expected_record_sha,revision);
   if(mode==='stale')return {ok:true};
   claim=transition({claims:[claim],queue:[]},{...args.request,action:args.action},{lease_hours:12,max_active_branches:4}).claims[0];revision=String(writes).padStart(40,'0');throw Error('Lost committed response');
  };
  return {run:()=>publishContinuityCard({config,plan:p,journal,rpc,readControl,readIntent:async()=>intent,saveIntent:async value=>{intent=structuredClone(value);}}),get writes(){return writes},get intent(){return intent},get claim(){return claim}};
 }
 const lost=publisherFixture('lost');assert.equal((await lost.run()).reconciled,true);assert.equal(lost.writes,1);assert.equal(lost.intent,null);assert.equal((await lost.run()).unchanged,true);assert.equal(lost.writes,1);
 const stale=publisherFixture('stale');await assert.rejects(stale.run(),/readback is stale/);assert.ok(stale.intent);await assert.rejects(stale.run(),/unresolved/);assert.equal(stale.writes,1);
 const bad=structuredClone(journal);bad.plan_digest='0'.repeat(64);assert.throws(()=>continuityCardProjection({plan:p,journal:bad,assignment:lost.claim}),/different plan/);
 const forged=structuredClone(journal);forged.stages.a={state:'passed',receipt:{evidence:'javascript:alert(1)'}};assert.throws(()=>continuityCardProjection({plan:p,journal:forged,assignment:lost.claim}),/lacks matching verifier/);
 const sub=structuredClone(p);sub.completion_scope='subobjective';assert.equal(continuityCardProjection({plan:sub,journal:{...journal,plan_digest:hash(sub)},assignment:lost.claim}).complete,false);
});

test('resuming changed inputs invalidates saved pass receipts before any card observation',async()=>{
 const f=fixture(),journal=await f.run();f.versions.a++;f.passed.a=false;const seen=[];
 await f.run({journal,observe:async state=>seen.push(structuredClone(state))});
 assert.equal(seen[0].stages.a.state,'ready');assert.equal(seen[0].stages.a.receipt,null);
 assert.equal(seen[0].stages.b.state,'ready');assert.equal(seen[0].stages.c.state,'ready');
 assert.equal(seen.at(-1).objective_completed,true);
});

test('authoritative CAS rejection stops once and permits a fresh later attempt without treating rejection as uncertainty',async()=>{
 const {publishContinuityCard}=await import('./relay-continuity.mjs'),{createHash}=await import('node:crypto');const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 const objective={goal:'Fixture conflict',acceptance:'Verified priority'},p=plan();p.objective_digest=hash(objective);const journal={schema:1,plan_digest:hash(p),stages:{}};
 let claim={...objective,id:'fixture',owner:'worker',branch:'relay/fixture',state:'active',lease_until:new Date(Date.now()+3600000).toISOString(),paths:['src/'],resources:[]},revision='a'.repeat(40),writes=0,intent=null;
 const rpc=async(name,args)=>{
  if(name==='relay_runner_assignments')return {ok:true,record_sha:revision,claims:[structuredClone(claim)]};
  writes++;assert.equal(args.expected_record_sha,revision);revision=String(writes).padStart(40,'0');
  if(writes===1)return {ok:false,error:{class:'conflict'}};
  claim=transition({claims:[claim],queue:[]},{...args.request,action:args.action},{lease_hours:12,max_active_branches:4}).claims[0];return {ok:true};
 };
 const run=()=>publishContinuityCard({config:{project:'relay',assignment:'fixture',owner:'worker',branch:'relay/fixture'},plan:p,journal,rpc,readControl:async()=>({held:false,assignment_active:true,objective_digest:p.objective_digest,canonical_record_sha:revision}),readIntent:async()=>intent,saveIntent:async value=>{intent=value}});
 await assert.rejects(run(),/rejected without application: conflict/);assert.equal(writes,1);assert.equal(intent,null);
 assert.equal((await run()).published,true);assert.equal(writes,2);assert.equal(intent,null);
});

test('official observation projection round-trips canonical validation, progress context and specialist identity',async()=>{
 const {continuityCardProjection}=await import('./relay-continuity.mjs');
 const {assignmentCardContext,validateCardStepsPublication}=await import('../src/relay-card-steps.js');
 const {contextCardModel}=await import('../src/relay-context-card-model.js');
 const p=plan(),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 const claim={id:'fixture',owner:'worker',branch:'relay/fixture',state:'active',lease_until:new Date(Date.now()+3600000).toISOString(),primary_staff:'nico',primary_team:'runner',supporting_staff:['rafael','roman'],supporting_teams:['source','inspector']};
 const j={schema:1,plan_digest:hash(p),stages:{a:{state:'dispatching',observation:{state:'running',owner:{staff:'rafael',team:'source'},input_digest:'b'.repeat(64),evidence:'sha256:'+'c'.repeat(64),source_sha:'d'.repeat(40),observed_at:new Date().toISOString()}}}};
 const project=()=>continuityCardProjection({plan:p,journal:j,assignment:claim});
 const projection=project();claim.card_steps=validateCardStepsPublication(projection,claim,p.objective_digest);
 const card=contextCardModel({project:'relay',progress:[assignmentCardContext(claim)]});
 assert.equal(card.identity.speaker.id,'rafael');assert.equal(card.identity.team,'source');assert.equal(card.identity.lead.id,'nico');assert.equal(card.plan.passed,0);
 j.stages.a.observation={...j.stages.a.observation,state:'failed',owner:{staff:'roman',team:'inspector'}};
 claim.card_steps=validateCardStepsPublication(project(),claim,p.objective_digest);
 assert.equal(contextCardModel({claim:assignmentCardContext(claim)}).identity.speaker.id,'roman');
 for(const change of [x=>x.steps[0].receipt.owner.staff='felix',x=>x.steps[0].receipt.owner.team='cloud',x=>x.steps[0].receipt.evidence='javascript:alert(1)',x=>x.steps[0].receipt.plan_revision='f'.repeat(64),x=>x.publisher.owner='other',x=>x.sequence=1]){const bad=structuredClone(project());change(bad);assert.throws(()=>validateCardStepsPublication(bad,claim,p.objective_digest));}
 const none=contextCardModel({claim:{...claim,card_steps:null}});assert.equal(none.identity.speaker,null);assert.equal(none.identity.lead.id,'nico');
});

test('changed source inputs remove old current-owner observations before the first resume publication',async()=>{
 const f=fixture(),seen=[],journal=await f.run();
 journal.stages.a.observation={owner:{staff:'rafael',team:'source'},input_digest:journal.stages.a.receipt.input_digest,state:'running'};
 f.versions.a++;f.passed.a=false;
 await f.run({journal,observe:async state=>seen.push(structuredClone(state))});
 assert.equal(seen[0].stages.a.observation,null);assert.equal(seen[0].stages.a.receipt,null);
});

test('CLI canonical start and finish drive specialist cards, and reject foreign or stale process receipts',async()=>{
 const {specialistExecutionRpc,continuityCardProjection}=await import('./relay-continuity.mjs');
 const {stageSpecialist}=await import('../src/specialist-workflow.js');
 const {assignmentCardContext,validateCardStepsPublication}=await import('../src/relay-card-steps.js');
 const {contextCardModel}=await import('../src/relay-context-card-model.js');
 const p=plan(),sha='b'.repeat(40),claim={id:'fixture',owner:'worker',branch:'relay/fixture',state:'active',lease_until:new Date(Date.now()+3600000).toISOString(),primary_staff:'nico',primary_team:'runner',supporting_staff:['roman'],supporting_teams:['inspector']};
 const config={project:'relay',assignment:claim.id,owner:claim.owner,branch:claim.branch},specialist=stageSpecialist({id:'a',kind:'test'},claim);
 const journal={schema:1,plan_digest:createHash('sha256').update(JSON.stringify(p)).digest('hex'),stages:{a:{state:'dispatching'}}},cards=[];
 let response;
 const rpc=specialistExecutionRpc({rpc:async()=>response,config,jobId:'job-fixture',specialist,sourceSha:sha,onObservation:async observation=>{
  journal.stages.a.observation={...observation,input_digest:'c'.repeat(64)};
  claim.card_steps=validateCardStepsPublication(continuityCardProjection({plan:p,journal,assignment:claim}),claim,p.objective_digest);
  cards.push(contextCardModel({progress:[assignmentCardContext(claim)]}));
 }});
 const process={pid:123,host:'synthetic-fixture',version:'fixture',adapter:'codex-cli'},now=new Date().toISOString();
 const job={id:'job-fixture',project:'relay',assignment:claim.id,owner:claim.owner,branch:claim.branch,initial_head_sha:sha,executor_id:'test-executor',attempt:1,revision:3,process,state:'running',started_at:now};
 const args={action:'start',job_id:job.id,expected_revision:2,executor_id:job.executor_id,process};
 for(const change of [{owner:'other'},{id:'foreign'},{initial_head_sha:'d'.repeat(40)},{started_at:'2000-01-01T00:00:00Z'},{revision:2},{process:{...process,pid:999}}]){
  response={ok:true,job:{...job,...change}};await assert.rejects(rpc('relay_execution',args),/Specialist/);
 }
 assert.equal(cards.length,0);
 response={ok:true,job};await rpc('relay_execution',args);
 assert.equal(cards[0].identity.speaker.id,'roman');assert.equal(cards[0].identity.lead.id,'nico');assert.equal(cards[0].plan.passed,0);
 const result={state:'succeeded',exit_code:0,session_id:'fixture-session',head_sha:sha};
 response={ok:true,job:{...job,revision:4,state:'succeeded',result,finished_at:now}};
 await rpc('relay_execution',{...args,action:'finish',expected_revision:3,result});
 assert.equal(cards.at(-1).plan.steps[0].state,'blocked');assert.equal(cards.at(-1).plan.passed,0,'process completion is not verified acceptance');
});

test('recovered old specialist result cannot gain ownership of new source or a fresh observation time',async()=>{
 const f=fixture();f.plan.stages=f.plan.stages.slice(0,1);f.plan.criteria=['A'];
 f.options.execute=async()=>{throw Error('Interrupted actual execution')};
 const journal=await f.run(),oldTime='2026-01-01T00:00:00Z';
 journal.stages.a.observation={owner:{staff:'roman',team:'inspector'},input_digest:'old',source_sha:'b'.repeat(40),observed_at:oldTime,state:'running'};
 f.versions.a=2;f.control.source_sha='e'.repeat(40);f.passed.a=true;
 const result=await f.run({journal,reconcile:async()=>({state:'succeeded',head_sha:'b'.repeat(40),observation:journal.stages.a.observation})});
 assert.equal(result.stages.a.observation,null);assert.equal(result.stages.a.receipt.owner,undefined);
});
test('promised specialist execution precedes a green verifier; pre-launch staffing blockers leave no uncertain work',async()=>{
 const f=fixture();f.plan.stages=f.plan.stages.slice(0,1);f.plan.criteria=['A'];f.plan.stages[0].specialist_role='verifier';f.passed.a=true;
 let saved,ready=false,launched=0;
 const options={persist:async value=>{saved=structuredClone(value)},prepare:async()=>{if(!ready)throw Error('Staffing required')},execute:async()=>{launched++;return {state:'succeeded',specialist_execution:true}}};
 await assert.rejects(f.run(options),/Staffing required/);assert.equal(saved.stages.a.pending,undefined);assert.equal(launched,0);
 ready=true;const result=await f.run({...options,journal:saved});assert.equal(launched,1);assert.equal(result.objective_completed,true);
 await f.run({...options,journal:result});assert.equal(launched,1,'matching completed specialist work is not repeated');
});
for(const state of ['failed','cancelled'])test('explicit specialist '+state+' cannot be satisfied by an already green command',async()=>{
 const f=fixture();f.plan.stages=f.plan.stages.slice(0,1);f.plan.criteria=['A'];f.plan.stages[0].specialist_role='verifier';f.passed.a=true;
 const result=await f.run({execute:async()=>({state,specialist_execution:true})});
 assert.equal(result.objective_completed,false);assert.equal(result.stages.a.state,'parked');assert.equal(result.stages.a.receipt,null);
});
test('terminal readback keeps historical process time while fresh launch observations still reject stale receipts',async()=>{
 const {specialistExecutionRpc}=await import('./relay-continuity.mjs');
 const sha='a'.repeat(40),at=new Date(Date.now()-3600000).toISOString(),config={project:'relay',assignment:'fixture',owner:'worker',branch:'relay/fixture'},result={state:'succeeded',exit_code:0,session_id:'real-fixture-session',head_sha:sha};
 const job={id:'job-fixture',...config,initial_head_sha:sha,executor_id:'fixture',revision:4,attempt:1,process:{pid:42,host:'fixture',adapter:'codex-cli'},state:'succeeded',started_at:at,finished_at:at,result};
 const args={action:'finish',job_id:job.id,executor_id:job.executor_id,expected_revision:3,result},observations=[];
 const options={rpc:async()=>({ok:true,job}),config,jobId:job.id,specialist:{owner:{staff:'roman',team:'inspector'}},sourceSha:sha,onObservation:async o=>observations.push(o)};
 await assert.rejects(specialistExecutionRpc(options)('relay_execution',args),/stale/);
 await specialistExecutionRpc({...options,terminalReadback:true})('relay_execution',args);
 assert.equal(observations[0].observed_at,at);assert.equal(observations[0].state,'blocked');
 job.state='running';job.revision=3;await assert.rejects(specialistExecutionRpc({...options,terminalReadback:true})('relay_execution',{action:'start',job_id:job.id,executor_id:job.executor_id,expected_revision:2,process:job.process}),/stale/);
});
