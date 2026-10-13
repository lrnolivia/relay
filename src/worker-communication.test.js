import test from "node:test";import assert from "node:assert/strict";import {createWorkerMessage,dedupeWorkerMessages,narrateExecutiveStatus,narrateWorkerMessage,reconcileWorkerMessage} from "./worker-communication.js";
const base={kind:"request",sender:{machine_id:"worker-roman",staff_id:"roman"},recipient:{machine_id:"worker-julian",staff_id:"julian"},machine:{project:"relay",assignment:"a1",owner:"owner-1",branch:"relay/a1",pr:66,evidence_ids:["check:test"]},impact:"Release gate is waiting on verification",requested_action:"review the exact head",summary:"Roman finished the regression pass"};
test("messages resolve sticky staff while machine ids remain authoritative",()=>{const m=createWorkerMessage(base);assert.equal(m.sender.display_name,"Roman");assert.equal(m.recipient.display_name,"Julian");assert.equal(m.machine.owner,"owner-1");assert.equal(m.authoritative,false);assert.match(narrateWorkerMessage(m),/Roman with Julian/);});
test("unknown staff falls back to machine identity instead of inventing a name",()=>{const m=createWorkerMessage({...base,sender:{machine_id:"worker-x",staff_id:"not-real"}});assert.equal(m.sender.display_name,"worker-x");assert.equal(m.sender.staff_id,null);});
test("duplicate chatter is suppressed and scope changes require Runner",()=>{const a=createWorkerMessage(base);assert.equal(dedupeWorkerMessages([a,a]).length,1);const b=createWorkerMessage({...base,kind:"scope-change"});assert.equal(b.requires_runner_action,true);assert.equal(reconcileWorkerMessage(b,{assignment:"a1",branch:"relay/a1",owner:"owner-1"}).action,"use-runner-transaction");});
test("canonical mismatch blocks context application",()=>{const m=createWorkerMessage(base);const r=reconcileWorkerMessage(m,{assignment:"a1",branch:"relay/other",owner:"owner-1"});assert.equal(r.safe_to_apply,false);assert.deepEqual(r.conflicts,["branch"]);});


test("executive status leads with person and outcome while hiding technical internals by default",()=>{
  const base=narrateExecutiveStatus({
    owner_staff_id:"julian",
    outcome:"the coordination pass is complete",
    next_action:"ship the verified patch",
    validation:"Runner admission passed",
    technical_detail:"branch relay/x at deadbeef"
  });
  assert.match(base,/^Julian — the coordination pass is complete/);
  assert.match(base,/Next: ship the verified patch/);
  assert.match(base,/Validated: Runner admission passed/);
  assert.doesNotMatch(base,/branch relay\/x/);

  const detailed=narrateExecutiveStatus({
    owner_staff_id:"julian",
    outcome:"the coordination pass is blocked",
    health:"blocked",
    blocker:"client schema is stale",
    technical_detail:"tool relay_runner_updates is not loaded",
    include_technical:true
  });
  assert.match(detailed,/Technical: tool relay_runner_updates is not loaded/);
});

test('canonical teams survive connected messages and reject stale team context',()=>{
  const input={kind:'handoff',sender:{machine_id:'worker'},machine:{project:'relay',assignment:'task',owner:'worker',branch:'relay/task'},impact:'Keep the verified source identity',summary:'Ready for release',assignment:{id:'task',owner:'worker',branch:'relay/task',primary_staff:'julian',supporting_staff:['roman']}};
  const message=createWorkerMessage(input);
  assert.match(narrateWorkerMessage(message),/^Julian supported by Roman/);
  assert.equal(reconcileWorkerMessage(message,{primary_staff:'nico'}).safe_to_apply,false);
  assert.throws(()=>createWorkerMessage({...input,assignment:{...input.assignment,owner:'other'}}),/canonical machine identity/);
});

test('worker message contract recognizes every emitted field including canonical team',async()=>{
  const {readFile}=await import('node:fs/promises');const schema=JSON.parse(await readFile(new URL('../contracts/assignments/worker-message-v1.schema.json',import.meta.url),'utf8'));
  const message=createWorkerMessage({kind:'fyi',sender:{machine_id:'worker'},machine:{project:'relay',assignment:'task',owner:'worker',branch:'relay/task'},impact:'No action required',summary:'Evidence is recorded'});
  for(const key of Object.keys(message)) assert.ok(schema.properties[key],key+' is missing from the contract');
});
