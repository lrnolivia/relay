import { iconSlot, hydrateProjectIcons } from "./project-icons.js";
import { projectOverview, projectProgressSections } from "../../../src/relay-project-ui.js";
import { progressStateMeta } from "../../../src/relay-operation-ui.js";
import { loadObservedProgress, renderProgressRow } from "./progress-ui.js";

const names = {
  relay: "relay", "bazzite-custom": "loewOS", field: "field", gamebridge: "GameBridge",
  "loew-inspector": "inspector", "loew-runner": "runner", "loew-shell": "loew shell",
  loewfi: "loew.fi", loewtorials: "loewtorials", "rtxforge-mfg": "rtxForge MFG",
  rtxforge: "rtxForge", thetake: "The Take"
};

export function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}
export function projectName(id) { return names[id] || String(id || "project").replace(/[-_]+/g, " "); }

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not load project information.");
  return response.json();
}
export async function loadProjectIndex() {
  const { projects } = await fetchJson("/api/projects");
  return projects.map(project => project.id).sort((a,b) => projectName(a).localeCompare(projectName(b)));
}
export async function loadProjectDetail(id) {
  const [detail, observed] = await Promise.all([
    fetchJson("/api/projects/" + encodeURIComponent(id)),
    loadObservedProgress(id).catch(error => ({ contract_version: "1.7.5", observed_progress: false, project: id, progress: [], queue: [], error: error.message }))
  ]);
  return { ...detail, observed };
}
export function stateLabel(state) { return progressStateMeta(state).label; }

function queuedRow(item) {
  const state = progressStateMeta("queued");
  return `
    <article class="task-row progress-row" data-progress-state="queued" data-tone="${esc(state.tone)}" data-signal="${esc(state.signal || "quiet")}">
      <div class="task-state status-badge" data-tone="${esc(state.tone)}" data-signal="${esc(state.signal || "quiet")}"><span class="status-light" aria-hidden="true"></span><span>${esc(state.label)}</span></div>
      <div class="task-copy"><strong>${esc(item.assignment || item.id || "queued work")}</strong>
      <p>${esc(item.next_action || "Queued behind current work.")}</p></div>
    </article>`;
}
function empty(message) { return '<div class="operator-empty">' + esc(message) + "</div>"; }

export function renderProjectDetail(target, id, data) {
  const project = data.project || {};
  const observed = data.observed || {};
  const sections = projectProgressSections(observed);
  const summary = projectOverview(observed);
  const truth = observed.observed_progress !== false;
  target.innerHTML = `
    <div class="project-detail-head">
      <div>
        <h2 class="project-name">${iconSlot(id)}${esc(project.name || projectName(id))}</h2>
        <p>${truth ? "Observed execution progress" : "Progress evidence unavailable"} · newest concrete activity first</p>
      </div>
      <span class="project-health ${project.managed ? "good" : "quiet"}">${project.managed ? "Managed by Relay" : "Tracked"}</span>
    </div>
    <div class="overview-metrics" aria-label="project overview">
      <span class="overview-metric status-metric" data-tone="${summary.current ? "info" : "quiet"}" data-signal="${summary.current ? "working" : "quiet"}"><span class="status-light" aria-hidden="true"></span><strong>${summary.current}</strong> now</span>
      <span class="overview-metric status-metric" data-tone="${summary.moving ? "good" : "quiet"}" data-signal="${summary.moving ? "working" : "quiet"}"><span class="status-light" aria-hidden="true"></span><strong>${summary.moving}</strong> moving</span>
      <span class="overview-metric status-metric" data-tone="${summary.waitingExternal ? "wait" : "quiet"}" data-signal="${summary.waitingExternal ? "external" : "quiet"}"><span class="status-light" aria-hidden="true"></span><strong>${summary.waitingExternal}</strong> external wait</span>
      <span class="overview-metric status-metric" data-tone="${summary.needsYou ? "act" : "quiet"}" data-signal="${summary.needsYou ? "attention" : "quiet"}"><span class="status-light" aria-hidden="true"></span><strong>${summary.needsYou}</strong> needs you</span>
    </div>
    <section class="project-work-section">
      <h3><span>now</span><span>${sections.now.length}</span></h3>
      ${sections.now.length ? sections.now.map(item => renderProgressRow(item, esc)).join("") : empty("No observed work is active right now.")}
    </section>
    <section class="project-work-section">
      <h3><span>up next</span><span>${sections.upNext.length}</span></h3>
      ${sections.upNext.length ? sections.upNext.map(queuedRow).join("") : empty("No queued work.")}
    </section>
    <section class="project-work-section">
      <h3><span>finished</span><span>${sections.finished.length}</span></h3>
      ${sections.finished.length ? sections.finished.slice(0, 8).map(item => renderProgressRow(item, esc, { compact: true })).join("") : empty("Nothing recently finished.")}
    </section>
  `;
  hydrateProjectIcons(target);
}
