import test from "node:test";
import assert from "node:assert/strict";
import { aggregateWorkflowTelemetry, classifyWorkflowPhase, deriveWorkflowTimeline, detectWorkflowBottlenecks, telemetrySummary } from "./workflow-telemetry.js";

test("workflow phase classification separates execution waits stalls blockers humans and release",()=>{
  assert.equal(classifyWorkflowPhase({type:"source-commit"}),"active-execution");
  assert.equal(classifyWorkflowPhase({type:"external-wait",detail:"Chromium install in_progress"}),"external-wait");
  assert.equal(classifyWorkflowPhase({type:"retry",reason:"no-progress"}),"recoverable-stall");
  assert.equal(classifyWorkflowPhase({type:"blocked",reason:"authorization required"}),"blocked");
  assert.equal(classifyWorkflowPhase({type:"human-review"}),"human-intervention");
  assert.equal(classifyWorkflowPhase({type:"cloud-deployment"}),"verification-deploy");
});

test("timeline derives bounded phase durations from canonical events",()=>{
  const segments=deriveWorkflowTimeline([
    {type:"source-commit",at:"2026-10-01T00:00:00Z",tool_family:"relay.SOURCE"},
    {type:"external-wait",at:"2026-10-01T00:02:00Z",tool_family:"github"},
    {type:"check-completed",at:"2026-10-01T00:12:00Z",tool_family:"github"}
  ],{end_at:"2026-10-01T00:14:00Z"});
  assert.deepEqual(segments.map(x=>x.duration_ms),[120000,600000,120000]);
  assert.deepEqual(segments.map(x=>x.phase),["active-execution","external-wait","verification-deploy"]);
});

test("aggregation supports workflow dimensions and staff only as a filter",()=>{
  const segments=[
    {phase:"active-execution",duration_ms:100,task_class:"implementation",tool_family:"relay.SOURCE",staff_id:"nico"},
    {phase:"active-execution",duration_ms:200,task_class:"implementation",tool_family:"relay.SOURCE",staff_id:"rafael"},
    {phase:"external-wait",duration_ms:500,tool_family:"github",staff_id:"nico"}
  ];
  const all=aggregateWorkflowTelemetry(segments,{dimensions:["phase","task_class","tool_family"]});
  assert.equal(all.find(x=>x.key==="active-execution|implementation|relay.SOURCE").duration_ms,300);
  const nico=aggregateWorkflowTelemetry(segments,{dimensions:["phase"],staff_id:"nico"});
  assert.equal(nico.reduce((n,x)=>n+x.duration_ms,0),600);
  assert.equal(telemetrySummary(segments).staff_productivity_ranking,null);
});

test("bottlenecks become finding candidates without staff rankings",()=>{
  const b=detectWorkflowBottlenecks([
    {phase:"recoverable-stall",duration_ms:200000,tool_family:"relay.SOURCE",reason:"no-progress"},
    {phase:"recoverable-stall",duration_ms:200000,tool_family:"relay.SOURCE",reason:"no-progress"}
  ],{minimum_ms:999999,minimum_segments:2});
  assert.equal(b.length,1);
  assert.equal(b[0].finding_candidate,true);
  assert.equal(b[0].staff_productivity_score,null);
  assert.match(b[0].recommendation,/recovery/);
});
