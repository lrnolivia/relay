import { createHash } from "node:crypto";

export function progressEvent(type, at, detail = {}) {
  const payload = { type, at: at || null, ...detail };
  const stable = JSON.stringify(payload);
  return { id: createHash("sha256").update(stable).digest("hex").slice(0, 24), ...payload };
}

export function dedupeProgressEvents(events = []) {
  const seen = new Set();
  return events
    .filter(event => event?.id && !seen.has(event.id) && seen.add(event.id))
    .sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));
}
