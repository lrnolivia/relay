import { createHash } from "node:crypto";

const LIMIT=2;
function blockedReason(checkpoint){
  if(!checkpoint) return "no-checkpoint";
  if(checkpoint.state==="waiting-on-external-system") return "external-wait";
  if(checkpoint.state==="waiting-for-human") return "human-wait";
  const text=[checkpoint.wait?.reason,checkpoint.wait?.recovery_action,checkpoint.next_action].filter(Boolean).join(" ");
  if(/\b(auth|authentication|authorization|authorize|permission|tool[- ]?schema|client|scope conflict|destructive|credential)\b/i.test(text)) return "explicit-blocker";
  return null;
}
function key(value){return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0,24);}
export function deriveRecoverySignal({checkpoint,previous_checkpoint_id=null,recovery_attempts=0,now=new Date()}={}){
  const blocked=blockedReason(checkpoint);
  if(blocked) return Object.freeze({should_recover:false,reason:blocked,status:"blocked",attempt_limit:LIMIT});
  if(recovery_attempts>=LIMIT) return Object.freeze({should_recover:false,reason:"recovery-loop-limit",status:"blocked",attempt_limit:LIMIT});
  if(!checkpoint) return Object.freeze({should_recover:false,reason:"no-checkpoint",status:"blocked",attempt_limit:LIMIT});
  const workerFreshness=checkpoint.activity?.worker?.freshness||null;
  const external=Boolean(checkpoint.activity?.external?.active);
  const last=Date.parse(checkpoint.activity?.last_meaningful_progress_at||"");
  const age=Number.isFinite(last)?Math.max(0,now.getTime()-last):null;
  let reason=null;
  if(!external&&["stale","frozen"].includes(workerFreshness)) reason="stale-worker";
  else if(!external&&previous_checkpoint_id&&previous_checkpoint_id===checkpoint.checkpoint_id&&age!==null&&age>=20*60*1000) reason="no-progress";
  if(!reason) return Object.freeze({should_recover:false,reason:"healthy-or-insufficient-evidence",status:"healthy",attempt_limit:LIMIT});
  const signal={
    should_recover:true,
    reason,
    status:"caught up here",
    checkpoint_id:checkpoint.checkpoint_id,
    last_successful_action:checkpoint.activity?.last_successful_action||null,
    resume_from:checkpoint.next_action||checkpoint.resume?.instruction||null,
    recovery_attempt:recovery_attempts+1,
    attempt_limit:LIMIT
  };
  return Object.freeze({...signal,recovery_key:key(signal)});
}
export function learnRecoveryLesson(signal,{outcome,capability=null,tool_family=null,recovery_action=null}={}){
  if(!signal?.should_recover||outcome!=="resolved") return null;
  return Object.freeze({
    kind:"capability-lesson",
    reason:signal.reason,
    capability,
    tool_family,
    recovery_action:recovery_action||signal.resume_from,
    evidence_checkpoint:signal.checkpoint_id,
    staff_productivity_score:null
  });
}
