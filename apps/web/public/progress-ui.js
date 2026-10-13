import { observedProgressSummary, progressStateMeta, progressTimestamp, sortObservedProgress } from "../../../src/relay-operation-ui.js";
import { releaseIdentityRows } from "../../../src/relay-release-ui.js";

export async function loadObservedProgress(project, assignment) {
  const query = assignment ? "?assignment=" + encodeURIComponent(assignment) : "";
  const response = await fetch("/api/progress/" + encodeURIComponent(project) + query, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Observed progress is unavailable.");
  return response.json();
}

export function relativeProgress(value) {
  if (!value) return "no recent evidence";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "time unknown";
  const delta = parsed - Date.now();
  const absolute = Math.abs(delta);
  const unit = absolute < 3_600_000 ? "minute" : absolute < 86_400_000 ? "hour" : "day";
  const divisor = unit === "minute" ? 60_000 : unit === "hour" ? 3_600_000 : 86_400_000;
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(delta / divisor), unit);
}

export function progressPriority(item) {
  return {
    "waiting-for-human": 0, blocked: 1, failed: 1, "officially-stale": 2, "possibly-stale": 3,
    "waiting-on-external-system": 4, working: 5, "reserved-but-idle": 6, queued: 7, complete: 8
  }[item?.state] ?? 9;
}

export function sortCurrentProgress(items = []) {
  return sortObservedProgress(items).sort((a, b) => progressPriority(a) - progressPriority(b) || Date.parse(progressTimestamp(b) || 0) - Date.parse(progressTimestamp(a) || 0));
}

export function progressIdentityText(item = {}) {
  return releaseIdentityRows(item).map(([key, value]) => key + " · " + value);
}

export function renderProgressRow(item, esc, { compact = false } = {}) {
  const state = progressStateMeta(item.state);
  const summary = observedProgressSummary(item);
  const identities = progressIdentityText(item);
  const timestamp = progressTimestamp(item);
  return `
    <article class="task-row progress-row" data-progress-state="${esc(item.state || "recorded")}" data-tone="${esc(state.tone)}" data-signal="${esc(state.signal || "quiet")}">
      <div class="task-state status-badge" data-tone="${esc(state.tone)}" data-signal="${esc(state.signal || "quiet")}"><span class="status-light" aria-hidden="true"></span><span>${esc(state.label)}</span></div>
      <div class="task-copy">
        <strong>${esc(item.assignment || "work item")}</strong>
        <p>${esc(summary.detail)}</p>
        <small>${esc(summary.stage)} · ${esc(relativeProgress(timestamp))}${item.worker?.freshness ? " · worker " + esc(item.worker.freshness) : ""}</small>
        ${!compact && identities.length ? '<div class="identity-row">' + identities.map(value => '<code>' + esc(value) + '</code>').join("") + "</div>" : ""}
        ${!compact && (item.recovery_action || item.next_action) ? `
          <details class="task-details"><summary>context</summary><div>${item.recovery_action ? "<strong>recovery</strong><br>" + esc(item.recovery_action) : ""}${item.recovery_action && item.next_action ? "<br><br>" : ""}${item.next_action ? "<strong>next note</strong><br>" + esc(item.next_action) : ""}</div></details>
        ` : ""}
      </div>
    </article>`;
}
