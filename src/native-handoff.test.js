import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionNativeHandoff,nativeHandoffView,nativeIntent} from './native-handoff.js';
import {continuityObjectiveDigest} from '../packages/runner/src/continuity-expansion.mjs';
const source='a'.repeat(40),record='b'.repeat(40),now=new Date();
const assignment=()=>({id:'task',owner:'worker',branch:'relay/task',state:'active',lease_until:new Date(+now+3600000).toISOString(),goal:'Native review',acceptance:'Real bounded review',paths:['src/'],resources:[],primary_staff:'nico',primary_team:'runner',supporting_staff:['roman'],supporting_teams:['inspector']});
const prepare=a=>({project:'relay',assignment:'task',owner:'worker',action:'prepare',operation_id:'review-1',expected_record_sha:record,source_sha:source,objective_digest:continuityObjectiveDigest(a.goal,a.acceptance),step_id:'review-contract',label:'Review contract',role:'verifier',host_tool:'collaboration.spawn_agent',host_available:true,intent_digest:'c'.repeat(64)});
const apply=(a,args,time=now)=>{const p=transitionNativeHandoff(a,args,source,time);delete p.replayed;Object.assign(a,p);return a.native_handoffs[0];};
const start=(row,extra={})=>({project:'relay',assignment:'task',owner:'worker',action:'started',operation_id:'review-1',expected_record_sha:record,source_sha:source,request_digest:row.request_digest,agent_id:'/root/real-review',observed_at:now.toISOString(),...extra});
const result=row=>({...start(row),action:'result',state:'succeeded',result_digest:'d'.repeat(64)});

test('new explicit design-submission boundary requires disposition while legacy results remain valid',()=>{
 const a=assignment(),row=apply(a,{...prepare(a),submission:{schema:1,kind:'design'}});apply(a,start(row));
 for(const update of [undefined,{text:'Submitted',artifacts:[],preview:{state:'pending'}},{text:'Submitted',artifacts:[],preview:{state:'unavailable',reason:'N/A'}}])assert.throws(()=>apply(a,{...result(row),...(update?{update}:{})}),/Design submission requires/);
 apply(a,{...result(row),update:{text:'Submitted for review.',artifacts:[],preview:{state:'unavailable',reason:'The design renderer was unavailable at submission.'}}});
 assert.equal(a.native_handoffs[0].state,'reported');
 const legacy=assignment(),old=apply(legacy,prepare(legacy));apply(legacy,start(old));apply(legacy,result(old));assert.equal(legacy.native_handoffs[0].state,'reported');
});

test('prepare is routing only; read and duplicate prepare never authorize another launch',()=>{
 const a=assignment(),args=prepare(a),row=apply(a,args);
 assert.equal(a.card_steps.steps[0].state,'pending');assert.equal(a.card_steps.steps[0].receipt,null);
 assert.equal(nativeHandoffView(row,{assignment:a,source_sha:source,launch:true}).launch_required,true);
 const read=nativeHandoffView(row,{assignment:a,source_sha:source});assert.equal(read.launch_required,false);assert.equal(read.state,'reconciliation-needed');
 const duplicate=transitionNativeHandoff(a,args,source,new Date(+now+999999));assert.equal(duplicate.replayed,true);assert.equal(duplicate.native_handoffs[0].prepared_at,row.prepared_at);
 assert.throws(()=>transitionNativeHandoff(a,{...args,intent_digest:'e'.repeat(64)},source,now),/conflicting/);
});
test('real identity binding publishes running then awaiting verification, never pass',()=>{
 const a=assignment(),row=apply(a,prepare(a));apply(a,start(row));
 assert.equal(a.card_steps.sequence,2);assert.equal(a.card_steps.steps[0].state,'running');assert.deepEqual(a.card_steps.steps[0].receipt.owner,{staff:'roman',team:'inspector'});
 apply(a,result(row));assert.equal(a.native_handoffs[0].state,'reported');assert.equal(a.card_steps.steps[0].state,'blocked');assert.equal(a.card_steps.complete,false);assert.equal(a.card_steps.steps[0].receipt.phase,'awaiting-verification');
 const duplicate=transitionNativeHandoff(a,result(row),source,new Date(+now+999999));assert.equal(duplicate.replayed,true);assert.equal(duplicate.native_handoffs[0].reported_at,a.native_handoffs[0].reported_at);
 assert.throws(()=>transitionNativeHandoff(a,{...result(row),result_digest:'e'.repeat(64)},source,now),/conflicting/);
});
test('missing start, forged result identity, stale observation and conflicting starts reject',()=>{
 const a=assignment(),row=apply(a,prepare(a));assert.throws(()=>apply(a,result(row)),/exact started/);
 assert.throws(()=>apply(a,{...start(row),project:'other'}),/project binding/);
 assert.throws(()=>apply(a,start(row,{observed_at:new Date(+now-600000).toISOString()})),/stale/);
 assert.throws(()=>apply(a,start(row,{agent_id:'worker'})),/distinct/);
 apply(a,start(row));assert.throws(()=>apply(a,start(row,{agent_id:'/root/impostor'})),/conflicting/);
 assert.throws(()=>apply(a,{...result(row),agent_id:'/root/impostor'}),/exact started/);
});
test('owner, lease, source, objective, scope and routing rollover cannot promote stale work',()=>{
 for(const change of [a=>a.owner='other',a=>a.state='held',a=>a.lease_until=new Date(+now-1).toISOString(),a=>a.goal='different',a=>a.paths.push('other/'),a=>a.supporting_staff=[]]){
  const a=assignment(),row=apply(a,prepare(a));change(a);assert.throws(()=>apply(a,start(row)));
 }
 const a=assignment(),row=apply(a,prepare(a));assert.throws(()=>transitionNativeHandoff(a,start(row),'e'.repeat(40),now),/source changed/);
 assert.equal(nativeHandoffView(row,{assignment:a,source_sha:'e'.repeat(40)}).source_current,false);
});
test('unassigned specialist and missing actual host capability fail before launch',()=>{
 const a=assignment();assert.throws(()=>apply(a,{...prepare(a),role:'integrator'}),/staffing required/);
 assert.throws(()=>apply(a,{...prepare(a),host_available:false}),/no authorized host/);
 assert.throws(()=>nativeIntent({...prepare(a),prompt:'private text'}),/invalid prompt/);
 assert.throws(()=>nativeIntent({...prepare(a),intent_digest:'made up'}),/invalid intent_digest/);
});
test('complete private plan, prior evidence and dependencies survive selected-step updates',()=>{
 const a=assignment();apply(a,prepare(a));const revision=a.card_steps.revision;
 // Explicit synthetic existing full plan, with real shape and prior verifier evidence.
 a.native_handoffs=[];a.card_steps.complete=true;a.card_steps.revision='f'.repeat(64);
 a.card_steps.steps.unshift({id:'baseline',label:'Baseline',depends_on:[],state:'passed',receipt:{id:'baseline:proof',assignment:a.id,step_id:'baseline',plan_revision:a.card_steps.revision,input_digest:'c'.repeat(64),evidence:'sha256:'+'d'.repeat(64),source_sha:source,observed_at:now.toISOString()}});
 a.card_steps.steps[1].depends_on=['baseline'];const prior=structuredClone(a.card_steps.steps[0]);
 const row=apply(a,prepare(a));apply(a,start(row));assert.equal(a.card_steps.complete,true);assert.notEqual(a.card_steps.revision,revision);assert.deepEqual(a.card_steps.steps[0],prior);assert.deepEqual(a.card_steps.steps[1].depends_on,['baseline']);
 assert.throws(()=>apply(a,{...prepare(a),operation_id:'new-op',step_id:'new-step'}),/preserve the existing plan/);
});
test('changed canonical step or unverified dependency prevents starting a stale handoff',()=>{
 const a=assignment(),row=apply(a,prepare(a));a.card_steps.steps[0].state='unknown';assert.throws(()=>apply(a,start(row)),/step changed/);
 const b=assignment();apply(b,prepare(b));b.native_handoffs=[];b.card_steps.steps.unshift({id:'first',label:'First',depends_on:[],state:'pending',receipt:null});b.card_steps.steps[1].depends_on=['first'];assert.throws(()=>apply(b,prepare(b)),/prerequisites/);
});

test('awaiting marker is bounded to unverified blocked receipts',async()=>{
 const {validateCardStepsPublication}=await import('./relay-card-steps.js');
 const a=assignment(),row=apply(a,prepare(a));apply(a,start(row));apply(a,result(row));
 for(const change of [p=>p.steps[0].state='passed',p=>p.steps[0].receipt.phase='arbitrary prose']){
  const p=structuredClone(a.card_steps);p.sequence++;change(p);assert.throws(()=>validateCardStepsPublication(p,a,continuityObjectiveDigest(a.goal,a.acceptance),now));
 }
});

test('hosted native public update is discoverable, immutable and atomically projected without private result prose',async()=>{
 const {nativeHandoffSchema}=await import('./native-handoff.js');
 const {appendCardUpdates,assignmentCardUpdates}=await import('./relay-card-updates.js');
 assert.equal(nativeHandoffSchema.properties.update.additionalProperties,false);
 const {runnerControlTools}=await import('./runner-control.js');assert.deepEqual(runnerControlTools.find(t=>t.name==='relay_runner_delegate').inputSchema.properties.update,nativeHandoffSchema.properties.update);
 const ordinary=runnerControlTools.find(t=>t.name==='relay_runner_coordinate').inputSchema.properties.request.properties.card_steps;assert.ok(ordinary.properties.steps.items.properties.receipt.anyOf[1].properties.update);
 const a=assignment(),row=apply(a,prepare(a));
 const update={text:'The scoped contract review found one issue to fix.',artifacts:[]};
 const args={...start(row),update};const patch=transitionNativeHandoff(a,args,source,now);
 a.card_updates=appendCardUpdates(a,patch.card_steps,now);Object.assign(a,patch);
 assert.equal(assignmentCardUpdates(a)[0].text,update.text);assert.equal(assignmentCardUpdates(a)[0].owner.staff,'roman');
 assert.equal(transitionNativeHandoff(a,args,source,now).replayed,true);
 assert.throws(()=>transitionNativeHandoff(a,{...args,update:{...update,text:'Changed report'}},source,now),/conflicting/);
 assert.throws(()=>nativeIntent({...result(row),update:{...update,prompt:'private'}}),/invalid public update/);
 assert.throws(()=>nativeIntent({...prepare(assignment()),update}),/exact action/);
 const b=assignment(),br=apply(b,prepare(b));apply(b,start(br));apply(b,result(br));assert.equal(b.card_steps.steps[0].receipt.update,undefined);
});
