import test from 'node:test';
import assert from 'node:assert/strict';
import {expansionDigest,validateContinuityAdditions,expandedContinuityPlan,orderContinuityStages} from './continuity-expansion.mjs';
import {reconcileContinuity} from '../../../scripts/relay-continuity.mjs';
function fixture(){
 const goal='Build the assigned preview feature';
 const plan={schema:1,authorization:'Complete this assigned feature through verification and shipping',objective_digest:'a'.repeat(64),criteria:['A','B'],environment:{node:'fixture'},stages:[{id:'a',kind:'implementation',criteria:['A'],depends_on:[],prompt:'Build assigned preview',inputs:['src/preview.js'],verify:['verify','a']},{id:'ship',kind:'ship',criteria:['B'],depends_on:['a'],prompt:'Ship verified preview',inputs:['src/'],verify:['verify','ship']}],expansion:{enabled:true,authorization:'Add necessary or strengthening supporting features while preserving this goal',original_goal:goal,profiles:{engineering:{kind:'implementation',inputs:['src/'],verify:['verify','support']}},allowed_paths:['src/']}};
 const f={plan,goal,calls:[],snapshots:[],passed:{},version:1,control:{revision:1,global_revision:0,source_sha:'b'.repeat(40),assignment_active:true,held:false,global_held:false,objective_digest:plan.objective_digest,original_goal_digest:expansionDigest(goal)}};
 f.proposal=(patch={})=>({id:'readiness',goal_digest:expansionDigest(goal),kind:'strengthens',reason:'A reusable readiness indicator makes the preview clearer',relationship:'Strengthens original preview acceptance A without changing the preview goal',supports:['A'],target_stage:'a',depends_on:['a'],acceptance:['Readiness status updates when the preview becomes usable'],profile:'engineering',paths:['src/readiness.js'],description:'Add a readiness indicator to the assigned preview',...patch});
 f.options={plan,persist:async state=>f.snapshots.push(structuredClone(state)),readControl:async()=>structuredClone(f.control),inputs:async stage=>stage.id.startsWith('add-')?f.version:1,verify:async stage=>({passed:f.passed[stage.id]===true,evidence:'fixture-'+stage.id}),execute:async p=>{f.calls.push(p.stage);f.passed[p.stage]=true;return {state:'succeeded'};},reconcile:async()=>null,reviewAddition:async p=>({verdict:'admit',preserves_goal:true,goal_digest:p.goal_digest,within_authority:true,sensitive_permissions:false,paid_services:false,canonical_key:p.id,reason:'Directly strengthens the original feature within existing authority'}),admitScope:async()=>({admitted:true,readback_verified:true})};
 f.run=(extra={})=>reconcileContinuity({...f.options,...extra});return f;
}
test('a discovered strengthening feature becomes durable acceptance and runs before shipping',async()=>{
 const f=fixture(),execute=f.options.execute;f.options.execute=async p=>({...await execute(p),...(p.stage==='a'?{continuity_additions:[f.proposal()]}:{})});
 const original=structuredClone(f.plan),s=await f.run();assert.deepEqual(f.calls,['a','add-readiness','ship']);assert.equal(s.objective_completed,true);assert.equal(s.additions[0].status,'admitted');assert.ok(s.effective_plan.criteria.includes('addition:readiness:0'));assert.equal(s.effective_plan.objective_digest,original.objective_digest);assert.deepEqual(f.plan,original);assert.ok(s.effective_plan.stages.find(x=>x.id==='ship').depends_on.includes('add-readiness'));assert.ok(f.snapshots.some(x=>x.additions?.[0]?.status==='admitted'&&!x.stages['add-readiness']));
 f.calls=[];await f.run({journal:s});assert.deepEqual(f.calls,[],'Accepted unchanged work must not run again');
});
test('a necessary dependency discovered during failure runs before repair and remains verified acceptance',async()=>{
 const f=fixture();let first=true;f.options.execute=async p=>{f.calls.push(p.stage);if(p.stage==='a'&&first){first=false;return {state:'succeeded',continuity_additions:[f.proposal({kind:'necessary',depends_on:[]})]};}f.passed[p.stage]=true;return {state:'succeeded'};};
 const s=await f.run();assert.deepEqual(f.calls,['a','add-readiness','a','ship']);assert.equal(s.objective_completed,true);assert.ok(s.effective_plan.stages.find(x=>x.id==='a').depends_on.includes('add-readiness'));
});
test('late coordinator discovery cannot vanish after original acceptance finishes',async()=>{
 const f=fixture();f.passed.a=true;f.passed.ship=true;let reads=0;const s=await f.run({discover:async()=>++reads===2?[f.proposal()]:[]});assert.equal(s.objective_completed,true);assert.deepEqual(f.calls,['add-readiness']);assert.equal(s.additions[0].proposal.relationship,f.proposal().relationship);
});
test('semantic duplicates and exact replay do not generate a second feature or review',async()=>{
 const f=fixture();let reviews=0;f.options.reviewAddition=async p=>{reviews++;return {verdict:'admit',preserves_goal:true,goal_digest:p.goal_digest,within_authority:true,sensitive_permissions:false,paid_services:false,canonical_key:'readiness',reason:'Same supporting feature'};};
 const items=[f.proposal(),f.proposal({id:'other-wording',description:'Equivalent readiness improvement'})];const s=await f.run({discover:async()=>items});assert.equal(s.additions[1].status,'duplicate');assert.equal(s.effective_plan.stages.filter(x=>x.id.startsWith('add-')).length,1);assert.equal(reviews,2);await f.run({journal:s,discover:async()=>items});assert.equal(reviews,2);
});
test('goal drift and sensitive/spending/out-of-authority expansion cannot launch or disappear as complete',async()=>{
 const wrong=fixture(),s=await wrong.run({discover:async()=>[wrong.proposal({goal_digest:'f'.repeat(64)})]});assert.equal(s.additions[0].status,'rejected');assert.ok(!wrong.calls.some(x=>x.startsWith('add-')));
 for(const patch of [{preserves_goal:false},{within_authority:false},{sensitive_permissions:true},{paid_services:true},{verdict:'authority'}]){
  const f=fixture(),review=f.options.reviewAddition;f.options.reviewAddition=async p=>({...await review(p),...patch});const state=await f.run({discover:async()=>[f.proposal()]});assert.equal(state.objective_completed,false);assert.equal(state.additions[0].status,'authority-required');assert.ok(!f.calls.some(x=>x==='ship'||x.startsWith('add-')));
 }
});
test('review unavailable and uncertain scope admission preserve proposals and block promotion',async()=>{
 for(const missing of ['review','scope']){const f=fixture();if(missing==='review')f.options.reviewAddition=async()=>null;else f.options.admitScope=async()=>({admitted:false});const s=await f.run({discover:async()=>[f.proposal()]});assert.equal(s.objective_completed,false);assert.ok(s.additions[0].proposal.reason);assert.ok(!f.calls.some(x=>x==='ship'||x.startsWith('add-')));}
});
test('cumulative expansion/depth budgets and cycle protection survive restart',async()=>{
 const f=fixture();f.plan.expansion.max_additions=1;const state=await f.run({discover:async()=>[f.proposal(),f.proposal({id:'second'})]});assert.equal(state.additions.filter(x=>x.status==='admitted').length,1);assert.equal(state.additions[1].status,'budget-wait');assert.equal(state.objective_completed,false);await f.run({journal:state});assert.equal(state.additions.filter(x=>x.status==='admitted').length,1);
 const depth=fixture();depth.plan.expansion.max_depth=1;const limited=await depth.run({discover:async()=>[depth.proposal(),depth.proposal({id:'child',depends_on:['add-readiness']})]});assert.equal(limited.additions[1].status,'budget-wait');
 const cyclic=fixture();const s=await cyclic.run({discover:async()=>[cyclic.proposal({depends_on:['add-readiness']})]});assert.equal(s.additions[0].status,'rejected');assert.match(s.additions[0].reason,/cycle/);assert.ok(!cyclic.calls.some(x=>x.startsWith('add-')));
 assert.throws(()=>orderContinuityStages([{id:'a',depends_on:['b']},{id:'b',depends_on:['a']}]),/cycle/);
});
test('expansion cannot invent commands, profiles, paths or mutate accepted proposal identity',async()=>{
 const f=fixture();for(const patch of [{command:['publish']},{verify:['true']},{paths:['../escape']},{paths:['.aws/credentials']},{paths:['/absolute']}])assert.throws(()=>validateContinuityAdditions([f.proposal(patch)]));
 const s=await f.run({discover:async()=>[f.proposal()]});await assert.rejects(f.run({journal:s,discover:async()=>[f.proposal({reason:'Replacement'})]}),/identity changed/);
 const corrupt=structuredClone(s);corrupt.additions[0].proposal.reason='Tampered';assert.throws(()=>expandedContinuityPlan(f.plan,corrupt.additions),/proposal changed/);
});
test('user/global/security stops and stale review revisions prevent supporting work',async()=>{
 for(const key of ['held','global_held','security_stop']){const f=fixture();f.options.reviewAddition=async p=>{f.control[key]=true;return {verdict:'admit'};};await assert.rejects(f.run({discover:async()=>[f.proposal()]}),/authority stops/);assert.deepEqual(f.calls,[]);}
 const f=fixture();f.options.reviewAddition=async()=>{f.control.revision++;return {verdict:'admit'};};const s=await f.run({discover:async()=>[f.proposal()]});assert.equal(s.objective_completed,false);assert.ok(!f.calls.some(x=>x.startsWith('add-')));
});
test('explicit policy enablement preserves an existing base checkpoint instead of restarting completed work',async()=>{
 const f=fixture(),full=f.plan;delete f.options.plan.expansion;f.passed.a=true;f.passed.ship=true;const state=await f.run();full.expansion={enabled:true,authorization:'Supporting improvements authorized',original_goal:f.goal,profiles:{engineering:{kind:'implementation',inputs:['src/'],verify:['verify','support']}}};f.calls=[];const next=await f.run({plan:full,journal:state,discover:async()=>[f.proposal()]});assert.deepEqual(f.calls,['add-readiness']);assert.equal(next.objective_completed,true);assert.equal(next.policy_history.length,1);
});
