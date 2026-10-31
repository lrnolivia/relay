import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_STEPS_SCHEMA, normalizeCardSteps, assignmentCardContext, assignmentCardSteps } from './relay-card-steps.js';
const plan=()=>({schema:CARD_STEPS_SCHEMA,assignment:'cards',revision:'plan-1',complete:true,steps:[{id:'build',label:'Build the cards',state:'passed',depends_on:[],receipt:{id:'receipt-build',assignment:'cards',step_id:'build',plan_revision:'plan-1',observed_at:'2026-10-30T00:00:00Z',evidence:'Verifier output sha256:abc',owner:{staff:'nico',team:'runner'}}},{id:'verify',label:'Verify the cards',state:'running',depends_on:['build'],receipt:{id:'receipt-verify',assignment:'cards',step_id:'verify',plan_revision:'plan-1',observed_at:'2026-10-30T00:01:00Z',evidence:'Run 42 started',owner:{staff:'roman',team:'inspector'}}}]});
test('ordered step identity and evidence survive handoff and compact transport',()=>{
 const p=plan();const first=assignmentCardContext({id:'cards',primary_staff:'nico',card_steps:p});
 const next=assignmentCardContext({...first,primary_staff:'julian'});
 assert.deepEqual(next.card_steps,first.card_steps);
 const m=assignmentCardSteps(next);assert.equal(m.passed,1);assert.equal(m.total,2);assert.equal(m.current,'verify');assert.equal(m.steps[1].owner.staff,'roman');
});
test('missing, mismatched and malformed evidence never becomes a completed step',()=>{
 for(const change of [p=>delete p.steps[0].receipt,p=>p.steps[0].receipt.assignment='other',p=>p.steps[0].receipt.plan_revision='old',p=>p.steps[0].receipt.step_id='other',p=>p.steps[0].receipt.observed_at='invalid']){
  const p=plan();change(p);const m=normalizeCardSteps(p,'cards');assert.equal(m.steps[0].state,'unknown');assert.equal(m.passed,0);
 }
 assert.equal(normalizeCardSteps(plan(),'other').availability,'unknown');
 for(const change of [p=>p.steps[1].id='build',p=>p.steps[0].depends_on=['verify'],p=>p.steps[0].label='',p=>p.steps=Array(33).fill(p.steps[0])]){const p=plan();change(p);assert.equal(normalizeCardSteps(p,'cards').availability,'unknown');}
});
test('states, unknown totals and skipped work stay distinct',()=>{
 for(const state of ['pending','running','passed','failed','skipped','blocked','cancelled','stale','unknown']){
  const p=plan();p.steps=[{...p.steps[0],state}];p.complete=false;const m=normalizeCardSteps(p,'cards');assert.equal(m.steps[0].state,state);assert.equal(m.total,null);assert.equal(m.passed,state==='passed'?1:0);
 }
 const p=plan();p.steps[0].state='skipped';p.steps[1].state='passed';assert.equal(normalizeCardSteps(p,'cards').steps[1].state,'unknown');
});
test('routing and prose acceptance do not manufacture a plan',()=>{
 const m=assignmentCardSteps({id:'cards',state:'completed',primary_staff:'nico',acceptance:'Build, test, ship',progress_percent:100});assert.equal(m.total,null);assert.deepEqual(m.steps,[]);
});
test('the transport preserves the sole long blocker and all supporting roles',()=>{
 const reason='A blocking deadline explanation. '.repeat(50)+'Deadline Friday at 16:00 UTC.';
 const m=assignmentCardContext({id:'cards',waiting_reason:reason,supporting_staff:['roman','margot','nico','julian','rafael'],supporting_teams:['inspector','source']});
 assert.equal(m.waiting_reason,reason);assert.equal(m.supporting_staff.length,5);assert.deepEqual(m.supporting_teams,['inspector','source']);
});

test('canonical continuity receipts adapt without inferring staff, timestamps or subobjective completion',async()=>{
 const {createHash}=await import('node:crypto');const {validateContinuityPlan}=await import('../scripts/relay-continuity.mjs');const {continuityCardSteps}=await import('./relay-card-steps.js');
 const p={schema:1,authorization:'Synthetic regression fixture',objective_digest:'a'.repeat(64),criteria:['cards','qa'],environment:{node:'22.23.3'},completion_scope:'subobjective',stages:[{id:'build-cards',kind:'implementation',prompt:'Build the approved cards',criteria:['cards'],depends_on:[],verify:['node','verify.mjs'],inputs:['src/']},{id:'verify-cards',kind:'test',prompt:'Verify the rendered UI',criteria:['qa'],depends_on:['build-cards'],verify:['node','test.mjs'],inputs:['src/']}]};
 validateContinuityPlan(p);const digest=createHash('sha256').update(JSON.stringify(p)).digest('hex');const j={schema:1,plan_digest:digest,stages:{'build-cards':{state:'passed',receipt:{input_digest:'b'.repeat(64),evidence:'sha256:'+ 'c'.repeat(64),source_sha:'d'.repeat(40)}},'verify-cards':{state:'dispatching',pending:{operation_id:'real-dispatch'}}},subobjective_completed:false};
 const m=await continuityCardSteps({assignment:'cards',plan:p,journal:j,observed_at:'2026-10-30T00:00:00Z'});
 assert.equal(m.steps[0].state,'passed');assert.equal(m.steps[0].owner,null);assert.equal(m.steps[1].state,'unknown');assert.equal(m.passed,1);assert.equal(m.objective_completed,undefined);
 assert.equal((await continuityCardSteps({assignment:'cards',plan:{...p,criteria:['changed']},journal:j,observed_at:'2026-10-30T00:00:00Z'})).availability,'unknown');
 const expanded={...j,effective_plan:{...p,stages:[...p.stages,{id:'new-stage'}]}};
 assert.equal((await continuityCardSteps({assignment:'cards',plan:p,journal:expanded,observed_at:'2026-10-30T00:00:00Z'})).total,null);
});

test('current-step headlines require bound observations and preserve held/terminal authority',async()=>{
 const {contextCardModel}=await import('./relay-context-card-model.js');
 const claim={id:'work',owner:'worker',goal:'Canonical work',state:'active',primary_team:'runner',card_steps:{schema:CARD_STEPS_SCHEMA,assignment:'work',revision:'plan',complete:true,steps:[{id:'verify',label:'Verify',depends_on:[],state:'failed',receipt:{id:'receipt',assignment:'work',step_id:'verify',plan_revision:'plan',evidence:'Observed failure',observed_at:'2026-10-31T00:00:00Z'}}]}};
 assert.equal(contextCardModel({claim}).label,'Step failed');
 for(const state of ['held','completed']){const card=contextCardModel({claim:{...claim,state}});assert.notEqual(card.label,'Step failed');assert.equal(card.evidence.assignment_state,state);}
 const unknown=structuredClone(claim);unknown.card_steps.steps[0].receipt=null;
 const card=contextCardModel({claim:unknown});assert.equal(card.plan.steps[0].state,'unknown');assert.notEqual(card.label,'Step failed');
 const pending=structuredClone(unknown);pending.card_steps.steps[0].state='pending';assert.notEqual(contextCardModel({claim:pending}).label,'Running');
});

test('awaiting verification phase survives compact refresh without becoming passed or hiding real blockers',()=>{
 const p=plan();p.steps[1].state='blocked';p.steps[1].receipt.phase='awaiting-verification';
 const compact=assignmentCardContext({id:'cards',card_steps:p});const next=assignmentCardSteps(compact);
 assert.equal(next.steps[1].state,'blocked');assert.equal(next.steps[1].receipt.phase,'awaiting-verification');assert.equal(next.passed,1);
 delete p.steps[1].receipt.phase;assert.equal(normalizeCardSteps(p,'cards').steps[1].receipt.phase,undefined);
 p.steps[1].state='failed';p.steps[1].receipt.phase='awaiting-verification';assert.equal(normalizeCardSteps(p,'cards').steps[1].receipt.phase,undefined);
});
