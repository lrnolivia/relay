// Only source activity advances these records. Fetches and heartbeats never do.
export function activityTime(item) {
  const value = item.last_meaningful_progress_at || item.latest_event?.at || item.captured_at || item.created_at || null;
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}
export function workRevision(item) {
  return JSON.stringify([item.assignment || item.evidence_id || item.id, item.goal, item.state, item.stage,
    item.next_action, item.waiting_reason, item.recovery_action, item.identities?.head_sha,
    item.identities?.merge_commit_sha, item.latest_event?.id || item.latest_event?.at,
    item.context?.commit_sha, item.captured_at]);
}
export function projectActivity(snapshot) {
  const result = {};
  for (const [project, payload] of Object.entries(snapshot?.progress || {})) {
    if (snapshot.failedProgress?.includes(project) || snapshot.loadingProgress?.includes(project)) continue;
    const times = (payload.progress || []).map(activityTime).filter(Number.isFinite);
    if (times.length) result[project] = Math.max(...times);
  }
  return result;
}
export function partitionProjects(projects, activity, seen = {}, now = Date.now(), label = id => id) {
  const recent = [], rest = [];
  for (const project of projects) {
    const updated = activity[project.id];
    // Future timestamps never manufacture freshness; visiting acknowledges that revision.
    const fresh = Number.isFinite(updated) && updated <= now && now - updated <= 86400000 && updated > (Number(seen[project.id]) || 0);
    (fresh ? recent : rest).push(project);
  }
  const alpha = (a, b) => label(a.id).localeCompare(label(b.id), undefined, { sensitivity: 'base' });
  recent.sort((a,b) => activity[b.id] - activity[a.id] || alpha(a,b));
  rest.sort(alpha);
  return { recent, rest };
}
export function advanceArrivalBaseline(previous = {}, snapshot) {
  const next = { ...previous }, arrivals = [];
  for (const [project, payload] of Object.entries(snapshot?.progress || {})) {
    if (snapshot.failedProgress?.includes(project) || snapshot.loadingProgress?.includes(project)) continue;
    const items = payload.progress || [], old = previous[project];
    const known = new Set(old?.ids || []);
    if (old) for (const item of items) if (item.assignment && !known.has(item.assignment)) arrivals.push({ project, item });
    // Keep seen identities through feed gaps and source removals. Bound persisted history.
    for (const item of items) if (item.assignment) known.add(item.assignment);
    next[project] = { ids: [...known].slice(-5000) };
  }
  return { next, arrivals };
}
