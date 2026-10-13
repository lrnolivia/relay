export const RELAY_PROGRESS_STATES = Object.freeze({
  queued: { label: "up next", tone: "quiet", signal: "quiet" },
  "reserved-but-idle": { label: "reserved", tone: "quiet", signal: "quiet" },
  working: { label: "working", tone: "good", signal: "working" },
  "waiting-on-external-system": { label: "waiting on system", tone: "wait", signal: "external" },
  "waiting-for-human": { label: "waiting for you", tone: "act", signal: "attention" },
  blocked: { label: "blocked", tone: "bad", signal: "danger" },
  "possibly-stale": { label: "possibly stale", tone: "warn", signal: "caution" },
  "officially-stale": { label: "stale", tone: "warn", signal: "caution" },
  failed: { label: "failed", tone: "bad", signal: "danger" },
  "rolled-back": { label: "rolled back", tone: "warn", signal: "caution" },
  complete: { label: "finished", tone: "done", signal: "steady" }
});

export function progressStateMeta(state) {
  return RELAY_PROGRESS_STATES[state] || {
    label: String(state || "recorded").replaceAll("-", " "),
    tone: "quiet",
    signal: "quiet"
  };
}

export function progressTimestamp(item) {
  return item?.last_meaningful_progress_at || item?.latest_event?.at || item?.worker?.heartbeat_at || null;
}

export function sortObservedProgress(items = []) {
  return [...items].sort((a, b) => Date.parse(progressTimestamp(b) || 0) - Date.parse(progressTimestamp(a) || 0));
}

export function observedProgressSummary(item = {}) {
  const meta = progressStateMeta(item.state);
  const external = item.external?.active ? item.external?.detail || "external work is still running" : null;
  const waiting = item.waiting_reason || null;
  const recovery = item.recovery_action || null;
  const event = item.latest_event?.type ? item.latest_event.type.replaceAll("-", " ") : null;
  return {
    label: meta.label,
    tone: meta.tone,
    signal: meta.signal,
    stage: String(item.stage || "recorded").replaceAll("-", " "),
    event,
    detail: external || waiting || event || "No newer execution evidence.",
    recovery
  };
}
