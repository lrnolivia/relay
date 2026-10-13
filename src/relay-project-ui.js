import { sortObservedProgress } from "./relay-operation-ui.js";

export function projectProgressSections(payload = {}) {
  const progress = Array.isArray(payload.progress) ? payload.progress : [];
  const queue = Array.isArray(payload.queue) ? payload.queue : [];
  const current = sortObservedProgress(progress.filter(item => item.state !== "complete"));
  const finished = sortObservedProgress(progress.filter(item => item.state === "complete"));
  const upNext = [...queue].sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
  return { now: current, upNext, finished };
}

export function projectOverview(payload = {}) {
  const sections = projectProgressSections(payload);
  const needsYou = sections.now.filter(item => ["waiting-for-human","blocked","failed","officially-stale"].includes(item.state));
  const waitingExternal = sections.now.filter(item => item.state === "waiting-on-external-system");
  const moving = sections.now.filter(item => item.state === "working");
  return {
    current: sections.now.length,
    needsYou: needsYou.length,
    waitingExternal: waitingExternal.length,
    moving: moving.length,
    newest: sections.now[0] || sections.finished[0] || null
  };
}
