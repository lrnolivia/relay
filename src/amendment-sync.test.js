import test from "node:test";import assert from "node:assert/strict";import {amendmentWindow,classifyAmendment,synchronizationPoint} from "./amendment-sync.js";
const assignment={amendment_count:3,amendments:[
  {fields:["next_action"],reason:"n",at:"2026-10-01T00:00:00Z"},
  {fields:["acceptance"],reason:"a",at:"2026-10-01T00:01:00Z"},
  {fields:["paths"],reason:"p",at:"2026-10-01T00:02:00Z"}
]};
test("cursor returns only new amendments and flags scope reconciliation",()=>{const w=amendmentWindow(assignment,1);assert.deepEqual(w.updates.map(x=>x.sequence),[2,3]);assert.equal(w.impact,"scope-changing");assert.equal(w.reconcile_required,true);assert.equal(w.next_cursor,3);});
test("no-change cursor injects no updates",()=>{const w=amendmentWindow(assignment,3);assert.equal(w.updates.length,0);assert.equal(w.reconcile_required,false);});
test("history gap requires canonical reconciliation instead of replay",()=>{const x={amendment_count:25,amendments:Array.from({length:20},()=>({fields:["next_action"]}))};const w=amendmentWindow(x,1);assert.equal(w.gap,true);assert.equal(w.reconcile_required,true);assert.equal(w.updates.length,0);});
test("classification and synchronization points are bounded",()=>{assert.equal(classifyAmendment({fields:["resources"]}),"scope-changing");assert.equal(classifyAmendment({fields:["acceptance"]}),"plan-adjusting");assert.equal(classifyAmendment({fields:["primary_role"]}),"plan-adjusting");assert.equal(synchronizationPoint("pre-deploy"),true);assert.equal(synchronizationPoint("every-token"),false);});

test('staff amendments are relevant planning updates without changing authorization',()=>{
  const window=amendmentWindow({amendment_count:1,amendments:[{fields:['primary_staff','supporting_staff'],before:{primary_staff:'nico'},after:{primary_staff:'roman'}}]},0);
  assert.equal(window.context_injection,undefined);
  assert.equal(window.impact,'plan-adjusting');
  assert.equal(window.updates[0].after.primary_staff,'roman');
  assert.equal(window.reconcile_required,false);
});

test('team amendments require planning synchronization',()=>{
  assert.equal(classifyAmendment({fields:['primary_team','supporting_teams']}),'plan-adjusting');
});
