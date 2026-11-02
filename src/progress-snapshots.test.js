import test from 'node:test';
import assert from 'node:assert/strict';
import {progressSnapshot,progressDueHint,validProgressSnapshot} from './progress-snapshots.js';
import {contextualPresentation,contextCardModel,validateRelayContextCardArguments} from './relay-chat-ui.js';
const at=new Date('2026-11-02T00:00:00Z');
const row={id:'test',state:'active',created_at:at.toISOString(),goal:'Build a test interface',primary_staff:'nico'};
test('ordinary work response carries an immutable public snapshot, excluding private result prose',()=>{
 const result=contextualPresentation({project:'relay',checked_at:at.toISOString(),claim:{...row,result:'PRIVATE',execution_prompt:'PRIVATE'}},{operation:{name:'relay_runner_coordinate',kind:'command'}});
 assert.equal(result.card_mode,'snapshot');assert.equal(result.snapshot.schema,'relay-progress-snapshot/v1');assert.equal(result.snapshot.as_of,at.toISOString());assert.equal(result.snapshot.payload.claim.goal,row.goal);assert.ok(!JSON.stringify(result.snapshot).includes('PRIVATE'));
 const saved=JSON.stringify(result.snapshot);result.claim.goal='Later';assert.equal(JSON.stringify(result.snapshot),saved);
 assert.notEqual(progressSnapshot({...result,claim:row,checked_at:new Date(+at+300000).toISOString()}).id,result.snapshot.id);
});
test('due hints stay anchored across reads, stop at held/completed and never assert delivery',()=>{
 const first=progressDueHint(row,+at),next=progressDueHint(row,+at+420000);assert.equal(first.due_at,next.due_at);assert.equal(first.overdue_at,next.overdue_at);assert.equal(next.state,'overdue');assert.equal(next.delivery,'unknown');assert.equal(progressDueHint(row,+at+300000).state,'due');
 for(const state of ['completed','held','retired'])assert.equal(progressDueHint({...row,state},+at).due_at,null);
 assert.equal(progressDueHint({...row,created_at:null},+at).state,'unknown');
});
test('explicit current view is validated and does not acquire a historical snapshot',()=>{
 assert.equal(validateRelayContextCardArguments({project:'relay',assignment:'test',view:'current'}).view,'current');assert.throws(()=>validateRelayContextCardArguments({view:'pretend'}));
 const result=contextualPresentation({project:'relay',card_mode:'current',progress:[row]},{operation:{name:'relay_render_context_card'}});assert.equal(result.snapshot,undefined);assert.equal(contextCardModel(result).card_mode,'current');
});
test('snapshot identity binds time source plan revision and exact public preview descriptors',()=>{
 const snapshot=progressSnapshot({project:'relay',claim:row,record_sha:'a'.repeat(40)},at);assert.equal(validProgressSnapshot(snapshot),true);
 for(const mutate of [s=>s.payload.claim.goal='Changed',s=>s.as_of='2026-11-03T00:00:00.000Z',s=>s.payload.record_sha='b'.repeat(40)]){const altered=structuredClone(snapshot);mutate(altered);assert.equal(validProgressSnapshot(altered),false);}
 assert.equal(validProgressSnapshot(null),false);
});
test('ordinary coordinate aliases retain one exact assignment and queued sparse snapshots retain identity',()=>{
 const data=progressSnapshot({project:'relay',claim:row,assignment:row},at);assert.equal(data.payload.claim.id,row.id);assert.equal(data.payload.claims,undefined);
 assert.equal(progressSnapshot({project:'relay',queue:[{...row,state:'queued'}]},at).payload.claim.id,row.id);
});
