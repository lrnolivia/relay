import test from 'node:test';
import assert from 'node:assert/strict';
import {activityTime, workRevision, projectActivity, partitionProjects, advanceArrivalBaseline} from '../../../packages/shared-ui/work-activity.js';
test('project promotion uses meaningful recent unseen source activity, never fetches or heartbeats',()=>{
 const now=Date.parse('2026-10-02T06:00:00Z');
 const snapshot={fetchedAt:new Date(now).toISOString(),progress:{z:{progress:[{worker:{heartbeat_at:new Date(now).toISOString()}}]},a:{progress:[{last_meaningful_progress_at:new Date(now-1000).toISOString()}]}}};
 assert.deepEqual(projectActivity(snapshot),{a:now-1000});
 const items=[{id:'z'},{id:'b'},{id:'a'}];
 assert.deepEqual(partitionProjects(items,projectActivity(snapshot),{},now),{recent:[{id:'a'}],rest:[{id:'b'},{id:'z'}]});
 assert.equal(partitionProjects(items,{a:now-1000},{a:now-1000},now).recent.length,0);
 assert.equal(partitionProjects(items,{a:now+1000},{},now).recent.length,0);
 assert.equal(partitionProjects(items,{a:now-86400001},{},now).recent.length,0);
 assert.equal(activityTime({last_meaningful_progress_at:'invalid'}),null);
});
test('first successful project result establishes baseline; errors, polling and reload do not announce old work',()=>{
 const snapshot={progress:{field:{progress:[{assignment:'a'}]}}};
 const first=advanceArrivalBaseline({},snapshot);assert.equal(first.arrivals.length,0);
 assert.equal(advanceArrivalBaseline(JSON.parse(JSON.stringify(first.next)),snapshot).arrivals.length,0);
 assert.equal(advanceArrivalBaseline(first.next,{...snapshot,failedProgress:['field']}).arrivals.length,0);
 const gap=advanceArrivalBaseline(first.next,{progress:{field:{progress:[]}}});
 assert.equal(advanceArrivalBaseline(gap.next,snapshot).arrivals.length,0);
 assert.equal(advanceArrivalBaseline(first.next,{progress:{field:{progress:[{assignment:'a'},{assignment:'b'}]}}}).arrivals[0].item.assignment,'b');
 assert.equal(workRevision({assignment:'a',worker:{heartbeat_at:'y'}}),workRevision({assignment:'a',worker:{heartbeat_at:'x'}}));
});
