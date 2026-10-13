import { retired } from "./coordination-engine.js";

export function reconcileExecution(claim, findings = []) {
  const relevant = findings.filter(item =>
    item?.assignment === claim?.id || item?.assignments?.includes?.(claim?.id) ||
    (item?.branch && item.branch === claim?.branch)
  );
  if (retired(claim)) return { disposition: claim.state, findings: relevant };
  if (claim?.state === "completed") return { disposition: "completed", findings: relevant };
  if (claim?.state === "held") return { disposition: "reserved-not-executing", findings: relevant };
  if (relevant.some(item => item.type === "missing_branch" || item.type === "unregistered_branch")) {
    return { disposition: "reconciliation-required", findings: relevant };
  }
  return { disposition: "live-intent", findings: relevant };
}
