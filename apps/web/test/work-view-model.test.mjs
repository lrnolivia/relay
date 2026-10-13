import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWork,reviewKey,effectiveReview,reviewTransition,bulkTargets,sourceRevision} from '../../../packages/shared-ui/work-view-model.js';
const items=[{id:'b',kind:'assignment',project:'field',revision:'1',time:20,priority:'P1',title:'Beta'},{id:'a',kind:'assignment',project:'relay',revision:'1',time:10,priority:'high',title:'Alpha'},{id:'c',kind:'assignment',project:'relay',revision:'1',time:null,priority:null,title:'Unknown'}];
test('shared query preserves null-last ordering, explicit priority and extension filters for both presentations',()=>{
 assert.deepEqual(selectWork(items,{sort:'importance'}).map(x=>x.id),['a','b','c']);
 assert.deepEqual(selectWork(items,{sort:'time',direction:'asc'}).map(x=>x.id),['a','b','c']);
 const predicates={kind:(item,value)=>item.kind===value};
 for(const view of ['list','visual']) assert.equal(selectWork(items,{view,extensions:{kind:'evidence'}},{},predicates).length,0);
 assert.deepEqual(selectWork(items,{project:'relay',search:'alpha'}).map(x=>x.id),['a']);
});
test('review completion and archives are separate from source, new revisions reopen, scopes do not grow',()=>{
 const key=reviewKey(items[0]),records={[key]:{source_revision:'1',status:'completed',archived:true}};
 assert.equal(selectWork(items,{filter:'all'},records).length,3);
 assert.equal(selectWork(items,{filter:'archived'},records).length,1);
 assert.deepEqual(effectiveReview({...items[0],revision:'2'},records[key]),{status:'pending',archived:false});
 assert.deepEqual(reviewTransition({status:'stale',archived:true},'restore'),{status:'stale',archived:false});
 assert.deepEqual(bulkTargets(items,[items[1]],[key],'selected').map(x=>x.id),['b']);
 assert.deepEqual(bulkTargets(items,[items[1]],[key],'filtered').map(x=>x.id),['a']);
});
test('revision ignores heartbeats and changes with source content',async()=>{
 assert.equal(await sourceRevision({assignment:'a',worker:{heartbeat_at:'a'}}),await sourceRevision({assignment:'a',worker:{heartbeat_at:'b'}}));
 assert.notEqual(await sourceRevision({assignment:'a',next_action:'a'}),await sourceRevision({assignment:'a',next_action:'b'}));
});
