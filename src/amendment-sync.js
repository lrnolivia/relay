import { callRunnerControlCore } from "./runner-control-core.js";
import { callResume } from "./resume-checkpoints.js";
import { deriveRecoverySignal } from "./recovery-signals.js";
import { readPendingFeedback } from "./feedback-control.js";

const PRIORITY={informational:1,"plan-adjusting":2,"scope-changing":3,blocking:4};

export function classifyAmendment(entry={}){
  if(entry.classification&&PRIORITY[entry.classification]) return entry.classification;
  const fields=new Set(entry.fields||[]);
  if(fields.has("paths")||fields.has("resources")) return "scope-changing";
  if(["goal","acceptance","next_action","task_class","category","labels","tags","primary_role","supporting_roles","primary_staff","supporting_staff","primary_team","supporting_teams"].some(field=>fields.has(field))) return "plan-adjusting";
  return "informational";
}
export function amendmentWindow(assignment,cursor=0){
  if(!Number.isInteger(cursor)||cursor<0) throw new Error("amendment cursor must be a non-negative integer");
  const total=Number(assignment?.amendment_count||0);
  const history=Array.isArray(assignment?.amendments)?assignment.amendments:[];
  if(cursor>total) return {cursor,total,next_cursor:total,gap:true,reconcile_required:true,updates:[],impact:"blocking"};
  if(total===0) return {cursor,total,next_cursor:0,gap:false,reconcile_required:false,updates:[],impact:"informational"};
  const firstSequence=total-history.length+1;
  if(cursor<firstSequence-1) return {cursor,total,next_cursor:total,gap:true,reconcile_required:true,updates:[],impact:"blocking"};
  const updates=history.map((entry,index)=>Object.freeze({sequence:firstSequence+index,classification:classifyAmendment(entry),...entry})).filter(entry=>entry.sequence>cursor);
  const impact=updates.reduce((best,item)=>PRIORITY[item.classification]>PRIORITY[best]?item.classification:best,"informational");
  return {cursor,total,next_cursor:total,gap:false,reconcile_required:["scope-changing","blocking"].includes(impact),updates,impact};
}
export function synchronizationPoint(name){
  return ["start","resume","pre-source","pre-commit","pre-pr","pre-deploy","post-external-wait","heartbeat"].includes(name);
}
export async function callAssignmentUpdates(args,env={},apiOverride){
  const assignments=await callRunnerControlCore("relay_runner_assignments",{project:args.project,assignment:args.assignment},env,apiOverride);
  const assignment=(assignments.claims||[]).find(x=>x.id===args.assignment)||(assignments.queue||[]).find(x=>x.id===args.assignment);
  if(!assignment) throw new Error("assignment not found");
  const window=amendmentWindow(assignment,args.cursor||0);
  let resume=null;
  try{resume=await callResume({project:args.project,assignment:args.assignment},env,apiOverride);}catch{}
  const checkpoint=resume?.latest||null;
  const recovery=deriveRecoverySignal({
    checkpoint,
    previous_checkpoint_id:args.checkpoint_id||null,
    recovery_attempts:args.recovery_attempts||0
  });
  const feedback=await readPendingFeedback(args,env,apiOverride);
  const feedbackImpact=!feedback.available||feedback.conflicts.length?"blocking":feedback.events.length?"plan-adjusting":"informational";
  const impact=PRIORITY[feedbackImpact]>PRIORITY[window.impact]?feedbackImpact:window.impact;
  return Object.freeze({
    ok:true,
    namespace:"relay.RUNNER",
    project:args.project,
    assignment:args.assignment,
    record_sha:assignments.record_sha,
    primary_team:assignment.primary_team||null,
    supporting_teams:assignment.supporting_teams||[],
    primary_staff:assignment.primary_staff||null,
    supporting_staff:assignment.supporting_staff||[],
    consumed_cursor:args.cursor||0,
    next_cursor:window.next_cursor,
    current_amendment_count:window.total,
    gap:window.gap,
    impact,
    reconcile_required:window.reconcile_required||!feedback.available||feedback.conflicts.length>0,
    context_injection:window.updates.length>0||!feedback.available||feedback.truncated||feedback.events.length>0||feedback.conflicts.length>0,
    updates:window.updates,
    feedback_available:feedback.available,
    feedback:feedback.events,
    feedback_conflicts:feedback.conflicts,
    feedback_acknowledged:[],
    feedback_next_cursor:feedback.next_cursor,
    feedback_truncated:feedback.truncated,
    feedback_scan_complete:feedback.available&&!feedback.truncated,
    feedback_unavailable_reason:feedback.reason||null,
    checkpoint_id:checkpoint?.checkpoint_id||null,
    recovery
  });
}
