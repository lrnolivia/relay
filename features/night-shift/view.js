import { showLoading } from "../../apps/web/public/loading.js";
import { iconSlot, hydrateProjectIcons } from "../../apps/web/public/project-icons.js";
import { esc, projectName } from "../../apps/web/public/operator-projects.js";

export async function loadNightShift(ui, projectId = "") {
  const target = document.querySelector("#night-shift-work");
  showLoading(target, "night", "Loading automatic work");
  try {
    const response = await fetch("/api/workers");
    if (!response.ok) throw new Error("Automatic work could not be loaded.");
    const workers = await response.json();
    const visible = projectId ? workers.filter(worker => worker.id === projectId) : workers;
    const blockedCount = visible.filter(worker => Boolean(worker.runtime?.last_error)).length;
    ui.setOverviewDetail(visible.length + " unattended " + (visible.length === 1 ? "check" : "checks") + " · " + blockedCount + " need attention");
    target.innerHTML = visible.length ? visible.map(worker => {
      const state = worker.runtime || {};
      const blocked = Boolean(state.last_error);
      const error = /insufficient_quota|credit_balance_exhausted|no credits remaining/i.test(state.last_error || "")
        ? "Automatic model work is paused because its API credits are exhausted. Project state and manual controls remain available."
        : state.last_error;
      const running = state.status === "running";
      const tone = blocked ? "bad" : running ? "info" : worker.enabled ? "good" : "quiet";
      const signal = blocked ? "danger" : running ? "working" : worker.enabled ? "steady" : "quiet";
      return `<article class="task-row" data-tone="${tone}" data-signal="${signal}"><div class="task-state status-badge" data-tone="${tone}" data-signal="${signal}"><span class="status-light" aria-hidden="true"></span><span>${blocked ? "needs attention" : running ? "working" : worker.enabled ? "watching" : "paused"}</span></div>
        <div class="task-copy"><strong class="project-name">${iconSlot(worker.id)}${esc(projectName(worker.id))}</strong>
        <p>${esc(state.last_summary || "No run result recorded yet.")}</p>
        <small>${esc(state.last_run_at ? "Last run · " + new Date(state.last_run_at).toLocaleString() : "No run recorded")}</small>
        ${state.last_error ? `<p>${esc(error)}</p>` : ""}
        <p><a href="#projects?project=${encodeURIComponent(worker.id)}">Open project</a> · <a href="#today">Manage automatic checks</a></p></div></article>`;
    }).join("") : '<div class="operator-empty">No unattended work matches this project context.</div>';
    hydrateProjectIcons(target);
    ui.setConnection("connected", "good");
  } catch (error) {
    target.innerHTML = '<div class="operator-empty">' + esc(error.message) + '</div>';
    ui.setConnection("couldn’t connect", "bad");
  }
}
