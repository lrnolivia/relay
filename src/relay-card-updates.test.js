import test from 'node:test';
import assert from 'node:assert/strict';
import {appendCardUpdates,assignmentCardUpdates,validPublicCardUpdate} from './relay-card-updates.js';
import {validateCardStepsPublication,assignmentCardContext} from './relay-card-steps.js';
import {contextCardModel} from './relay-context-card-model.js';
const digest='a'.repeat(64),source='b'.repeat(40),now=new Date('2026-11-01T00:00:00Z');
const assignment=()=>({id:'demo',owner:'host',branch:'relay/demo',state:'active',goal:'Build the UI',primary_staff:'nico',primary_team:'runner',supporting_staff:['valentina'],supporting_teams:['inspector'],lease_until:'2026-11-02T00:00:00Z'});

test('explicit preview disposition survives immutable history, with strict source and truthful absence',()=>{
 for(const state of ['pending','attached','unavailable']){
  const p=publication(),u=p.steps[0].receipt.update;
  u.preview=state==='unavailable'?{state,reason:'The rendering service was unavailable at submission.'}:{state};
  if(state==='attached')u.artifacts=[{evidence_id:'vis_preview123',source_sha:source,caption:'Submitted design',kind:'design'}];
  const r=publish(assignment(),p);assert.deepEqual(assignmentCardUpdates(r)[0].preview,u.preview);
  assert.deepEqual(assignmentCardContext(r).card_updates.items[0].preview,u.preview);
  const replay=structuredClone(p);replay.sequence++;assert.equal(publish(r,replay).card_updates.items.length,1);
  replay.steps[0].receipt.update.preview={state:'unavailable',reason:'Different submission'};replay.steps[0].receipt.update.artifacts=[];
  assert.throws(()=>publish(r,replay),/immutable/);
 }
 for(const preview of [{state:'unavailable'},{state:'unavailable',reason:'<private>'},{state:'attached'},{state:'pending',reason:'extra'},{state:'other'}])assert.equal(validPublicCardUpdate({text:'Public',artifacts:[],preview},{source_sha:source}),false);
 const old=publish(assignment(),publication());assert.equal(assignmentCardUpdates(old).length,1,'legacy receipts remain readable');
 const forged=structuredClone(old);forged.card_updates.items[0].preview={state:'pending'};assert.deepEqual(assignmentCardUpdates(forged),[],'projection cannot acquire a disposition absent from its immutable receipt');
});
const publication=(sequence=1,id='build-1',state='running',staff='nico')=>({schema:'relay-card-steps/v1',assignment:'demo',revision:digest,objective_digest:digest,publisher:{owner:'host',branch:'relay/demo'},sequence,complete:false,steps:[{id:'build',label:'Build the UI',depends_on:[],state,receipt:{id,assignment:'demo',step_id:'build',plan_revision:digest,input_digest:digest,evidence:'sha256:'+digest,source_sha:source,observed_at:now.toISOString(),owner:{staff,team:staff==='valentina'?'inspector':'runner'},update:{text:'The bounded layout change is ready to check.',artifacts:[]}}}]});
function publish(record,p){const valid=validateCardStepsPublication(p,record,digest,now);return {...record,card_updates:appendCardUpdates(record,valid,now),card_steps:valid};}
test('ordinary publisher -> canonical history -> transport -> model preserves real contributors and past receipts',()=>{
 let r=publish(assignment(),publication());r=publish(r,publication(2,'design-1','blocked','valentina'));
 const transport=assignmentCardContext(r),m=contextCardModel({project:'relay',claim:transport});
 assert.equal(m.family,'assignment');assert.equal(m.updates.length,2);assert.deepEqual(m.updates.map(x=>x.person.id),['nico','valentina']);assert.equal(m.updates[0].state,'running');assert.equal(m.updates[1].person.display_team,'design');assert.equal(m.plan.passed,0);assert.equal(m.plan.total,null);
 assert.equal(JSON.stringify(transport).includes('receipt_snapshot'),false);
});
test('same immutable receipt deduplicates, altered text or state is rejected',()=>{
 const r=publish(assignment(),publication());const duplicate=publication(2);assert.equal(publish(r,duplicate).card_updates.items.length,1);
 duplicate.steps[0].receipt.observed_at='2026-11-01T00:00:01Z';const reobserved=publish(r,duplicate);assert.equal(reobserved.card_updates.items.length,1);assert.equal(reobserved.card_updates.items[0].observed_at,now.toISOString());
 for(const change of [p=>p.steps[0].receipt.update.text='Other message',p=>p.steps[0].state='failed']){const p=publication(2);change(p);assert.throws(()=>publish(r,p),/immutable/);}
});
test('public prose/artifact contract rejects extra private keys, forged binding and arbitrary URLs',()=>{
 for(const change of [p=>p.steps[0].receipt.update.prompt='private',p=>p.steps[0].receipt.update.text='<script>x</script>',p=>p.steps[0].receipt.owner.staff='julian',p=>p.steps[0].receipt.update.artifacts=[{evidence_id:'https://example.test/a',source_sha:source,caption:'Preview',kind:'design'}]]){const p=publication();change(p);assert.throws(()=>publish(assignment(),p));}
 const p=publication();p.steps[0].receipt.update.artifacts=[{evidence_id:'vis_abcdefgh',source_sha:source,caption:'Layout preview',kind:'rendered-feature'}];assert.ok(validPublicCardUpdate(p.steps[0].receipt.update,p.steps[0].receipt));p.steps[0].receipt.update.artifacts[0].source_sha='c'.repeat(40);assert.throws(()=>publish(assignment(),p));
});
test('routing alone does not create updates and a team-only receipt does not borrow the lead face',()=>{
 assert.deepEqual(assignmentCardUpdates(assignment()),[]);const p=publication();p.steps[0].receipt.owner.staff=null;delete p.steps[0].receipt.update;const r=publish(assignment(),p),m=contextCardModel({project:'relay',claim:assignmentCardContext(r)});assert.equal(m.updates[0].person,null);assert.equal(m.updates[0].text_kind,'recorded-state');assert.equal(m.updates[0].text,'Work started.');
});
test('history is bounded, disclosed as partial, and cannot cross assignment or plan identity',()=>{
 let r=assignment();for(let i=1;i<=30;i++)r=publish(r,publication(i,'event-'+i));assert.equal(r.card_updates.items.length,24);assert.equal(r.card_updates.truncated,true);assert.ok(JSON.stringify(r.card_updates.items).length<=65536);
 assert.deepEqual(assignmentCardUpdates({...r,id:'other'}),[]);assert.deepEqual(assignmentCardUpdates({...r,card_steps:{...r.card_steps,revision:'c'.repeat(64)}}),[]);
});
test('historical owner stays an observation after legitimate current staffing changes',()=>{
 const r=publish(assignment(),publication());r.primary_staff='valentina';r.supporting_staff=[];assert.equal(assignmentCardUpdates(r)[0].owner.staff,'nico');
});

test('canonical amendment audits derived history and mirrors the queue without accepting client-written messages',async()=>{
 const {transition}=await import('./coordination-engine.js');const {continuityObjectiveDigest}=await import('../packages/runner/src/continuity-expansion.mjs');
 const a={...assignment(),acceptance:'Verify the UI',paths:['src/'],resources:[]};const p=publication();p.objective_digest=continuityObjectiveDigest(a.goal,a.acceptance);
 const state=transition({claims:[a],queue:[{...a,state:'claimed'}]},{action:'amend',id:a.id,owner:a.owner,card_steps:p,reason:'Publish actual observed step'},{lease_hours:12,max_active_branches:4},now);
 assert.equal(state.claims[0].card_updates.items.length,1);assert.deepEqual(state.queue[0].card_updates,state.claims[0].card_updates);
 assert.ok(JSON.stringify(state.claims[0].amendments).includes('card_updates'));
 assert.throws(()=>transition({claims:[a],queue:[]},{action:'amend',id:a.id,owner:a.owner,card_updates:state.claims[0].card_updates,reason:'Forge messages'},{lease_hours:12,max_active_branches:4},now),/mutable/);
});

test('evicted receipt identities remain immutable and bounded capacity never silently forgets provenance',()=>{
 let r=assignment();for(let i=1;i<=30;i++)r=publish(r,publication(i,'event-'+i));
 const old=publication(31,'event-1');assert.equal(publish(r,old).card_updates.items.length,24);
 old.steps[0].receipt.update.text='Rewrite an evicted report';assert.throws(()=>publish(r,old),/immutable/);
 for(let i=31;i<=256;i++)r=publish(r,publication(i,'event-'+i));
 assert.equal(Object.keys(r.card_updates.identities).length,256);assert.throws(()=>publish(r,publication(257,'event-257')),/capacity reached/);
 assert.equal(assignmentCardContext(r).card_updates.identities,undefined);
});
test('public history rejects inconsistent raw snapshots, phase/time and duplicate identities',()=>{
 const r=publish(assignment(),publication());
 for(const mutate of [x=>x.phase='made-up',x=>x.phase='awaiting-verification',x=>x.recorded_at='never',x=>x.text='Altered after publication',x=>x.owner.staff='valentina']){const bad=structuredClone(r);mutate(bad.card_updates.items[0]);assert.deepEqual(assignmentCardUpdates(bad),[]);}
 const duplicate=structuredClone(r);duplicate.card_updates.items.push({...duplicate.card_updates.items[0],key:'different'});assert.equal(assignmentCardUpdates(duplicate).length,1);
});
test('unchanged admitted historical owners survive a real handoff, new forged owners do not',()=>{
 let r=publish(assignment(),publication(1,'nico-verified','passed'));
 r.primary_staff='valentina';r.primary_team='inspector';r.supporting_staff=[];r.supporting_teams=[];
 const next=publication(2,'val-review','running','valentina');next.steps[0].id='design';next.steps[0].label='Review the UI';next.steps[0].receipt.step_id='design';next.steps.unshift(structuredClone(r.card_steps.steps[0]));
 const updated=publish(r,next);assert.deepEqual(assignmentCardUpdates(updated).map(x=>x.owner.staff),['nico','valentina']);
 const forged=structuredClone(next);forged.steps[0].receipt.evidence='sha256:'+'f'.repeat(64);assert.throws(()=>publish(r,forged),/matching plan/);
});
