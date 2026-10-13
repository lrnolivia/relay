import { createHash } from "node:crypto";
import { assignmentStaffView, getStaff } from "./staff-registry.js";

const KINDS=new Set(["fyi","request","blocker","decision","handoff","scope-change"]);
const MACHINE_FIELDS=["project","assignment","owner","branch"];

function requiredText(value,label,max=800){
  if(typeof value!=="string"||!value.trim()||value.length>max) throw new Error(label+" is required");
  return value.trim();
}
function actor(input={}){
  const machine_id=requiredText(input.machine_id,"machine_id",160);
  const staff=input.staff_id?getStaff(input.staff_id):null;
  if(staff&&staff.status!=="retired") return Object.freeze({machine_id,staff_id:staff.id,display_name:staff.display_name,role:staff.role.id});
  return Object.freeze({machine_id,staff_id:null,display_name:machine_id,role:null});
}
function machineIdentity(input={}){
  const out={};
  for(const key of MACHINE_FIELDS) out[key]=requiredText(input[key],"machine."+key,240);
  out.pr=Number.isInteger(input.pr)&&input.pr>0?input.pr:null;
  out.evidence_ids=Array.isArray(input.evidence_ids)?[...new Set(input.evidence_ids.filter(x=>typeof x==="string"&&x).slice(0,20))]:[];
  return Object.freeze(out);
}
function fp(value){return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0,24);}

export function createWorkerMessage(input={}){
  if(!KINDS.has(input.kind)) throw new Error("invalid worker message kind");
  const sender=actor(input.sender);
  const recipient=input.recipient?actor(input.recipient):null;
  const collaborators=(input.collaborators||[]).slice(0,16).map(actor);
  const machine=machineIdentity(input.machine);
  const impact=requiredText(input.impact,"impact",500);
  const requested_action=input.requested_action==null?null:requiredText(input.requested_action,"requested_action",500);
  const summary=requiredText(input.summary,"summary",800);
  const requires_runner_action=["handoff","scope-change"].includes(input.kind);
  if (input.assignment && (input.assignment.id !== machine.assignment || input.assignment.owner !== machine.owner || input.assignment.branch !== machine.branch)) throw new Error("Worker message assignment does not match canonical machine identity.");
  const team=assignmentStaffView(input.assignment || {});
  const identity={team,kind:input.kind,sender,recipient,collaborators,machine,impact,requested_action,summary};
  return Object.freeze({...identity,authoritative:false,requires_runner_action,fingerprint:fp(identity)});
}
export function dedupeWorkerMessages(messages=[]){
  const seen=new Set();const out=[];
  for(const message of messages){if(!message?.fingerprint||seen.has(message.fingerprint)) continue;seen.add(message.fingerprint);out.push(message);}
  return out;
}
export function narrateWorkerMessage(message){
  const who=message.team?.primary_staff?.display_name || message.sender.display_name;
  const support=(message.team?.supporting_staff||[]).map(p=>p.display_name);
  const teamName=message.team?.primary_team?message.team.primary_team+": ":"";
  const withTeam=support.length?" supported by "+support.join(", "):"";
  const to=message.recipient?(" with "+message.recipient.display_name):"";
  const validation=message.machine.evidence_ids.length?(" Validation: "+message.machine.evidence_ids.join(", ")+"."):"";
  const ask=message.requested_action?(" Next: "+message.requested_action):"";
  return (teamName+who+withTeam+to+": "+message.summary+" "+message.impact+"."+ask+validation).replace(/\s+/g," ").trim();
}
export function reconcileWorkerMessage(message,canonical={}){
  const conflicts=[];
  if(canonical.assignment&&canonical.assignment!==message.machine.assignment) conflicts.push("assignment");
  if(canonical.branch&&canonical.branch!==message.machine.branch) conflicts.push("branch");
  if(canonical.owner&&canonical.owner!==message.machine.owner) conflicts.push("owner");
  if (canonical.primary_team !== undefined && canonical.primary_team !== message.team?.primary_team) conflicts.push("primary_team");
  if (canonical.supporting_teams && JSON.stringify(canonical.supporting_teams) !== JSON.stringify(message.team?.supporting_teams||[])) conflicts.push("supporting_teams");
  if (canonical.primary_staff !== undefined && canonical.primary_staff !== (message.team?.primary_staff?.id || null)) conflicts.push("primary_staff");
  if (canonical.supporting_staff && JSON.stringify(canonical.supporting_staff) !== JSON.stringify((message.team?.supporting_staff||[]).map(p=>p.id))) conflicts.push("supporting_staff");
  return Object.freeze({
    safe_to_apply:conflicts.length===0&&!message.requires_runner_action,
    requires_runner_action:message.requires_runner_action,
    conflicts,
    action:conflicts.length?"refresh-canonical-state":message.requires_runner_action?"use-runner-transaction":"apply-context"
  });
}


export function narrateExecutiveStatus({
  owner_staff_id=null,
  assignment=null,
  outcome,
  health="healthy",
  next_action=null,
  blocker=null,
  validation=null,
  technical_detail=null,
  include_technical=false
}={}){
  const staff=assignment ? assignmentStaffView(assignment).primary_staff : owner_staff_id?getStaff(owner_staff_id):null;
  const owner=staff&&staff.status!=="retired"?staff.display_name:"Relay";
  const status=requiredText(outcome,"outcome",600);
  const team=assignment ? assignmentStaffView(assignment).supporting_staff.map(p=>p.display_name) : [];
  const parts=[owner+(team.length?" with "+team.join(", "):"")+" — "+status];
  if(health&&health!=="healthy") parts.push("Status: "+health+".");
  if(blocker) parts.push("Blocker: "+requiredText(blocker,"blocker",500)+".");
  if(next_action) parts.push("Next: "+requiredText(next_action,"next_action",500));
  if(validation) parts.push("Validated: "+requiredText(validation,"validation",500)+".");
  if(include_technical&&technical_detail) parts.push("Technical: "+requiredText(technical_detail,"technical_detail",1000));
  return parts.join(" ").replace(/\s+/g," ").trim();
}
