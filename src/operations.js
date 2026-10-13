export const TOOL_DESIGN_STANDARD_VERSION = "1.0.0";

export const TOOL_KINDS = Object.freeze(["query", "command", "discovery", "recipe"]);
export const TOOL_ERROR_CLASSES = Object.freeze([
  "validation", "auth", "permission", "not_found", "conflict",
  "capacity", "timeout", "uncertain_write", "provider"
]);

export const TOOL_CONTRACT_RULES = Object.freeze({
  mutations_require_readback_on_uncertainty: true,
  credentials_are_server_side: true,
  authority_is_enforced_in_code: true,
  default_outputs_are_bounded: true,
  fallback_must_preserve_authority: true,
  exact_identity_for_guarded_mutations: true
});

export const PROGRESS_POLICY = Object.freeze({
  heartbeat_target_ms: 5 * 60 * 1000,
  possibly_stale_ms: 10 * 60 * 1000,
  officially_stale_ms: 20 * 60 * 1000
});

export function freshness(timestamp, now = new Date(), policy = PROGRESS_POLICY) {
  const ms = Date.parse(timestamp || "");
  if (!Number.isFinite(ms)) return { state: "unknown", age_ms: null };
  const age = Math.max(0, now.getTime() - ms);
  if (age >= policy.officially_stale_ms) return { state: "stale", age_ms: age };
  if (age >= policy.possibly_stale_ms) return { state: "possibly-stale", age_ms: age };
  if (age > policy.heartbeat_target_ms) return { state: "delayed", age_ms: age };
  return { state: "fresh", age_ms: age };
}
