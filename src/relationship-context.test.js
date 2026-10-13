import test from "node:test";
import assert from "node:assert/strict";
import { createInteractionSignal, curateRelationshipNote, relationshipContextForStaff } from "./relationship-context.js";

test("staff workers emit bounded non-durable interaction signals",()=>{
  const s=createInteractionSignal({staff_id:"roman",topic:"communication",source:"explicit-feedback",observation:"Prefers concise verification receipts.",explicit:true,evidence_refs:["chat:1"]});
  assert.equal(s.staff_id,"roman");
  assert.equal(s.durable,false);
});

test("only Julian curates durable relationship notes",()=>{
  const s=createInteractionSignal({staff_id:"margot",topic:"presentation",source:"explicit-feedback",observation:"User prefers design critique tied to visible hierarchy.",explicit:true,evidence_refs:["chat:2"]});
  assert.throws(()=>curateRelationshipNote(s,{curator_staff_id:"roman"}),/Julian/);
  const n=curateRelationshipNote(s);
  assert.equal(n.durable,true);
  assert.equal(n.affinity_score,null);
  assert.equal(n.canned_jokes,null);
});

test("repeated collaboration needs evidence and sensitive inference is rejected",()=>{
  const s=createInteractionSignal({staff_id:"nico",topic:"workflow",source:"repeated-collaboration",observation:"Fast implementation slices work well.",explicit:false,evidence_refs:["run:1"]});
  assert.throws(()=>curateRelationshipNote(s),/two evidence/);
  assert.throws(()=>createInteractionSignal({staff_id:"nico",topic:"workflow",source:"explicit-feedback",observation:"Infer a medical diagnosis from behavior.",explicit:true}),/sensitive/);
});

test("relationship context returns only curated notes for one sticky identity",()=>{
  const roman=curateRelationshipNote(createInteractionSignal({staff_id:"roman",topic:"humor",source:"explicit-feedback",observation:"Dry humor is welcome when verification is already clear.",explicit:true,evidence_refs:["chat:3"]}));
  const margot=curateRelationshipNote(createInteractionSignal({staff_id:"margot",topic:"presentation",source:"explicit-feedback",observation:"Keep critique visual and specific.",explicit:true,evidence_refs:["chat:4"]}));
  const c=relationshipContextForStaff("roman",[margot,roman]);
  assert.equal(c.display_name,"Roman");
  assert.equal(c.notes.length,1);
  assert.equal(c.notes[0].topic,"humor");
});
