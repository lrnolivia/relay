import test from "node:test";
import assert from "node:assert/strict";
import { augmentToolList, classifyExtensionError, RELAY_EXTENSION_VERSION } from "../src/relay-entry.js";
import { runnerControlTools } from "../src/runner-control.js";
import { sourceTextMutationTools } from "../src/source-text-mutation.js";
import { OPERATION_RECIPE_CONTRACTS, OPERATION_RECIPE_CONTRACT_VERSION } from "../src/operation-recipes.js";
import { TOOL_DESIGN_STANDARD_VERSION, TOOL_ERROR_CLASSES } from "../src/operations.js";

test("Relay 1.10.0 preserves the tool-design contract version",()=>{
  assert.equal(RELAY_EXTENSION_VERSION,"1.10.0");
  assert.equal(OPERATION_RECIPE_CONTRACT_VERSION,TOOL_DESIGN_STANDARD_VERSION);
  assert.equal(TOOL_DESIGN_STANDARD_VERSION,"1.0.0");
});

test("high-risk tools expose role, dependency and stale-state guidance",()=>{
  const runner=runnerControlTools.find(tool=>tool.name==="relay_runner_coordinate");
  assert.match(runner.description,/COMMAND \/ TRANSACTION/);
  assert.match(runner.description,/relay_runner_assignments/);
  assert.match(runner.description,/refresh canonical state|refresh/i);

  for(const tool of sourceTextMutationTools){
    assert.match(tool.description,/COMMAND/);
    assert.match(tool.description,/Read the file and branch head first/);
    assert.equal(tool.inputSchema.additionalProperties,false);
    assert.match(tool.inputSchema.properties.expected_head_sha.pattern,/40/);
  }

  const augmented=augmentToolList([]);
  const inventory=augmented.find(tool=>tool.name==="relay_source_inventory");
  const pr=augmented.find(tool=>tool.name==="relay_source_pull_request_action");
  assert.match(inventory.description,/DISCOVERY QUERY/);
  assert.equal(inventory.annotations.readOnlyHint,true);
  assert.match(pr.description,/COMMAND/);
  assert.match(pr.description,/refresh the PR\/check state/i);
});

test("structured extension error classes cover required recovery categories",()=>{
  for(const name of ["validation","auth","permission","not_found","conflict","capacity","timeout","uncertain_write","provider"]){
    assert.ok(TOOL_ERROR_CLASSES.includes(name));
  }
  const auth=classifyExtensionError(Object.assign(new Error("authentication token expired"),{status:401}),"relay_source_inventory");
  assert.equal(auth.class,"auth");
  assert.equal(auth.requires_auth,true);

  const capacity=classifyExtensionError(Object.assign(new Error("rate limit"),{status:429}),"relay_source_inventory");
  assert.equal(capacity.class,"capacity");
  assert.equal(capacity.retryable,true);

  const uncertain=classifyExtensionError(Object.assign(new Error("timeout"),{name:"TimeoutError"}),"relay_source_pull_request_action");
  assert.equal(uncertain.class,"uncertain_write");
  assert.equal(uncertain.retryable,false);
  assert.match(uncertain.recovery,/read back/i);
});

test("durable operation recipes have explicit ordered chains and resume/recovery boundaries",()=>{
  assert.deepEqual(OPERATION_RECIPE_CONTRACTS.map(x=>x.id),["ship-change","publish-worker","qa-then-merge","rollback-release"]);
  for(const recipe of OPERATION_RECIPE_CONTRACTS){
    assert.equal(recipe.kind,"recipe");
    assert.equal(recipe.retry_policy,"operation-status-first");
    assert.ok(recipe.steps.length>=4);
    assert.ok(recipe.resume_points.length>=2);
    assert.ok(Object.keys(recipe.completion).length);
    assert.ok(Object.keys(recipe.recovery).length);
    assert.ok(recipe.authority.every(x=>x.startsWith("relay.")));
  }
});
