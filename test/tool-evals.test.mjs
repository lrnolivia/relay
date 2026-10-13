import test from "node:test";
import assert from "node:assert/strict";
import { augmentToolList } from "../src/relay-entry.js";
import { runnerControlTools } from "../src/runner-control.js";
import { sourceTextMutationTools } from "../src/source-text-mutation.js";

function contractFindings(tools){
  const findings=[];
  for(const tool of tools){
    if(!tool?.name||!tool?.description||!tool?.inputSchema) findings.push({tool:tool?.name||"unknown",kind:"ambiguous-contract"});
    if(tool?.inputSchema?.type==="object"&&tool.inputSchema.additionalProperties!==false) findings.push({tool:tool.name,kind:"unbounded-object-input"});
    if(tool?.annotations?.readOnlyHint===false){
      if(!/(COMMAND|TRANSACTION|deploy|mutation|mutate|cleanup|upload|create|append|edit)/i.test(tool.description)) findings.push({tool:tool.name,kind:"hidden-side-effect"});
      if(!tool.annotations) findings.push({tool:tool.name,kind:"missing-annotations"});
    }
    const schema=JSON.stringify(tool?.inputSchema||{});
    if(/expected_(head_)?sha/.test(schema)&&!/"pattern":"\^\[a-fA-F0-9\]\{40\}\$"|\[a-f0-9\]\{40\}/.test(schema)) findings.push({tool:tool.name,kind:"weak-exact-identity"});
  }
  return findings;
}

test("1.9.8 extension and Runner contracts reject ambiguous or hidden side-effect shapes",()=>{
  const tools=[
    ...augmentToolList([]),
    ...runnerControlTools,
    ...sourceTextMutationTools
  ];
  const findings=contractFindings(tools);
  assert.deepEqual(findings,[]);
});

test("mutating Relay contracts never advertise read-only retry semantics",()=>{
  const tools=[...augmentToolList([]),...runnerControlTools,...sourceTextMutationTools];
  for(const tool of tools.filter(x=>x.annotations?.readOnlyHint===false)){
    assert.notEqual(tool.annotations?.readOnlyHint,true,tool.name);
    assert.equal(tool.inputSchema?.additionalProperties,false,tool.name);
  }
});
