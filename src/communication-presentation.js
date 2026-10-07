import { assignmentStaffView, getStaff } from "./staff-registry.js";

const HEALTH=new Set(["healthy","degraded","blocked","waiting"]);

function bounded(value,label,max,{nullable=false}={}){
  if(value==null&&nullable) return null;
  if(typeof value!=="string"||!value.trim()||value.length>max) throw new Error(label+" is required");
  return value.trim();
}
function staffView(staff_id){
  if(!staff_id) return null;
  const staff=getStaff(staff_id);
  if(!staff||staff.status==="retired") return null;
  return Object.freeze({id:staff.id,display_name:staff.display_name,role:staff.role?.title||staff.role?.id||null});
}
function qaView(qa){
  if(qa==null) return null;
  if(!qa||typeof qa!=="object") throw new Error("qa must be an object");
  const checks=Array.isArray(qa.checks)?qa.checks.map((item)=>bounded(item,"qa check",300)).slice(0,3):[];
  if(!checks.length) throw new Error("qa checks are required");
  return Object.freeze({
    surface:bounded(qa.surface,"qa surface",300),
    intended_result:bounded(qa.intended_result,"qa intended result",500),
    evidence_identity:qa.evidence_identity==null?null:bounded(qa.evidence_identity,"qa evidence identity",500),
    checks:Object.freeze(checks)
  });
}
export function shapeCommunicationResult({
  health="healthy",
  outcome,
  staff_id=null,
  assignment=null,
  what_changed=null,
  next_step=null,
  needs_user=false,
  blocker=null,
  qa=null,
  technical_evidence={}
}={}){
  if(!HEALTH.has(health)) throw new Error("invalid human result health");
  if(typeof needs_user!=="boolean") throw new Error("needs_user must be boolean");
  if(!technical_evidence||typeof technical_evidence!=="object"||Array.isArray(technical_evidence)) throw new Error("technical_evidence must be an object");
  const human=Object.freeze({
    health,
    outcome:bounded(outcome,"outcome",700),
    primary_team:assignment?.primary_team||null,
    supporting_teams:assignment?.supporting_teams||[],
    responsible_staff:assignment ? assignmentStaffView(assignment).primary_staff : staffView(staff_id),
    supporting_staff:assignment ? assignmentStaffView(assignment).supporting_staff : [],
    what_changed:what_changed==null?null:bounded(what_changed,"what_changed",700),
    next_step:next_step==null?null:bounded(next_step,"next_step",700),
    needs_user,
    blocker:blocker==null?null:bounded(blocker,"blocker",700),
    qa:qaView(qa)
  });
  return Object.freeze({human,technical_evidence:Object.freeze({...technical_evidence})});
}
export function shapeToolResult(tool_result,human={}){
  if(!tool_result||typeof tool_result!=="object"||Array.isArray(tool_result)) throw new Error("tool_result must be an object");
  return shapeCommunicationResult({assignment:tool_result.claim || (typeof tool_result.assignment === "object" ? tool_result.assignment : null),...human,technical_evidence:{tool_result}});
}
export function renderHumanFirst(result){
  if(!result?.human) throw new Error("presentation result is missing human layer");
  const h=result.human;
  const owner=h.responsible_staff?.display_name||"Relay";
  const team=(h.supporting_staff||[]).map(person=>person.display_name);
  const parts=[owner+(team.length?" with "+team.join(", "):"")+" — "+h.outcome];
  if(h.what_changed) parts.push(h.what_changed);
  if(h.blocker) parts.push("Blocker: "+h.blocker+".");
  if(h.qa){
    const evidence=h.qa.evidence_identity?(" Evidence: "+h.qa.evidence_identity+"."):"";
    parts.push("QA: "+h.qa.surface+" — "+h.qa.intended_result+". Check: "+h.qa.checks.join("; ")+ "."+evidence);
  }
  if(h.next_step) parts.push("Next: "+h.next_step);
  if(h.needs_user) parts.push("You need to act on this.");
  return parts.join(" ").replace(/\s+/g," ").trim();
}

export { HUMAN_CATALOG_VERSION, HUMAN_CATALOG, presentationOperation, safePresentationText, normalizeCommunicationResult, formatRelay, withHumanPresentation } from './human-presentation.js';
