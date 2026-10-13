import { showLoading } from "./loading.js";
import { glyph } from "../../../packages/shared-ui/glyphs.js";
import { progressStateMeta } from "../../../src/relay-operation-ui.js";
import { iconSlot, hydrateProjectIcons } from "./project-icons.js";
import { esc, loadProjectDetail, loadProjectIndex, projectName } from "./operator-projects.js";
import { relativeProgress, sortCurrentProgress } from "./progress-ui.js";

let workers = [];
let projectIds = [];
let projectAttention = [];
let projectScope = "";
const projectCache = new Map();

async function api(url, options) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", Accept: "application/json" }, ...options });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text || "Unexpected response." }; }
  if (!response.ok) throw Object.assign(new Error(body.error || "Request failed."), { status: response.status });
  return body;
}
function relative(value) {
  if (!value) return "not yet";
  const parsed = Date.parse(value); if (!Number.isFinite(parsed)) return "recently";
  const delta = parsed - Date.now(), abs = Math.abs(delta);
  const unit = abs < 3_600_000 ? "minute" : abs < 86_400_000 ? "hour" : "day";
  const divisor = unit === "minute" ? 60_000 : unit === "hour" ? 3_600_000 : 86_400_000;
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(delta / divisor), unit);
}
function plainStatus(worker) {
  const state = worker.runtime || {};
  if (!worker.enabled) return "paused";
  if (["blocked","failed","waiting_credentials"].includes(state.status)) return "needs attention";
  if (state.status === "running") return "checking now";
  if (state.project_health === "healthy" && state.dependency_health === "healthy") return "all good";
  if (state.dependency_health === "repairable") return "fix available";
  return "watching";
}
function workerStatusMeta(worker) {
  const state = worker.runtime || {};
  if (!worker.enabled) return { tone:"quiet", signal:"quiet" };
  if (["blocked","failed","waiting_credentials"].includes(state.status) || state.dependency_health === "failed") return { tone:"bad", signal:"danger" };
  if (state.status === "running") return { tone:"info", signal:"working" };
  if (["repairable","warning"].includes(state.dependency_health)) return { tone:"warn", signal:"caution" };
  if (state.project_health === "healthy" && state.dependency_health === "healthy") return { tone:"good", signal:"steady" };
  return { tone:"good", signal:"steady" };
}
function primaryAction(worker) {
  const state = worker.runtime || {}, dependency = state.dependency || {};
  const repairable = state.dependency_health === "repairable" && dependency.repair_verified === true;
  if (!worker.enabled) return { label:"Resume checks", action:"toggle", tone:"primary" };
  if (worker.id === "field" && repairable) return { label:"Prepare fix", action:"repair", tone:"secondary" };
  if (worker.id === "field" && ["failed","repairable","warning"].includes(state.dependency_health)) return { label:"Check setup", action:"doctor", tone:"secondary" };
  return { label:"Check now", action:"run", tone:"primary" };
}
async function performAction(worker, action, button, ui) {
  const original = button.innerHTML;
  const pending = { toggle:worker.enabled ? "Pausing…" : "Resuming…", run:"Checking…", doctor:"Checking setup…", repair:"Preparing…" };
  ui.setFlow("act", "Recording your request");
  button.disabled = true; button.textContent = pending[action] || "Working…";
  try {
    const options = { method:"POST", body:"{}" };
    if (action === "toggle") options.body = JSON.stringify({ enabled:!worker.enabled });
    await api("/api/workers/" + encodeURIComponent(worker.id) + "/" + action, options);
    ui.notify(action === "toggle" ? (worker.enabled ? "Automatic checks paused." : "Automatic checks resumed.") : action === "repair" ? "Relay is preparing the guarded fix." : action === "doctor" ? "Setup check started." : "Project check started.");
    workers = await api("/api/workers");
    renderAttention(ui); renderAutomations(ui); ui.setFlow("resolve", "Request recorded");
  } catch (error) { ui.notify(error.message, "bad"); }
  finally { button.disabled = false; button.innerHTML = original; }
}

function scopedWorkers() { return projectScope ? workers.filter(worker => worker.id === projectScope) : workers; }

function renderAttention(ui) {
  const target = document.querySelector("#today-attention");
  const workerAttention = scopedWorkers().filter(worker => {
    const state = worker.runtime || {};
    return ["blocked","failed","waiting_credentials"].includes(state.status) || ["failed","repairable"].includes(state.dependency_health);
  }).map(worker => ({ kind:"worker", worker }));
  const attention = [...projectAttention, ...workerAttention].slice(0, 4);
  if (!attention.length) {
    target.innerHTML = '<div class="clear-card"><strong>You’re clear.</strong><span>No observed project state is asking for a decision right now.</span></div>';
    return;
  }
  target.innerHTML = attention.map(entry => {
    if (entry.kind === "project") {
      const { projectId, item } = entry;
      const meta = progressStateMeta(item.state);
      const text = item.waiting_reason || item.recovery_action || item.latest_event?.type?.replaceAll("-", " ") || "Relay needs a decision here.";
      return `<article class="attention-card" data-tone="${esc(meta.tone)}" data-signal="${esc(meta.signal || "quiet")}">
        <div class="attention-copy"><span class="attention-project">${iconSlot(projectId)}${esc(projectName(projectId))}</span><strong>${esc(text)}</strong><small>${esc(item.assignment || "")} · ${esc(relativeProgress(item.last_meaningful_progress_at))}</small></div>
        <div class="attention-action"><span class="badge status-badge" data-tone="${esc(meta.tone)}" data-signal="${esc(meta.signal || "quiet")}"><span class="status-light" aria-hidden="true"></span><span>${esc(meta.label)}</span></span><button type="button" data-open-project="${esc(projectId)}">Open project ${glyph("next")}</button></div>
      </article>`;
    }
    const worker = entry.worker, state = worker.runtime || {};
    const text = state.dependency_health === "repairable" ? "Runner found a setup problem it knows how to repair." : state.dependency_health === "failed" ? "Runner needs to re-check this project’s setup." : state.status === "waiting_credentials" ? "Runner needs access before it can keep going." : "The automatic check stopped and needs another look.";
    return `<article class="attention-card" data-tone="act" data-signal="attention">
      <div class="attention-copy"><span class="attention-project">${iconSlot(worker.id)}${esc(projectName(worker.id))}</span><strong>${esc(text)}</strong></div>
      <div class="attention-action"><span class="badge status-badge" data-tone="act" data-signal="attention"><span class="status-light" aria-hidden="true"></span><span>needs a decision</span></span><button type="button" data-jump-worker="${esc(worker.id)}">See the action ${glyph("next")}</button></div>
    </article>`;
  }).join("");
  hydrateProjectIcons(target);
  target.querySelectorAll("[data-open-project]").forEach(button => button.addEventListener("click", () => ui.openProject(button.dataset.openProject)));
  target.querySelectorAll("[data-jump-worker]").forEach(button => button.addEventListener("click", () => {
    [...document.querySelectorAll("[data-worker-id]")].find(item => item.dataset.workerId === button.dataset.jumpWorker)?.scrollIntoView({ behavior:"smooth", block:"center" });
  }));
}

function renderAutomations(ui) {
  const target = document.querySelector("#today-automations"), visible = scopedWorkers();
  if (!visible.length) { target.innerHTML = '<div class="operator-empty">No automatic checks match this project context.</div>'; return; }
  target.innerHTML = visible.map(worker => {
    const state = worker.runtime || {}, action = primaryAction(worker), visual = workerStatusMeta(worker);
    return `<article class="automation-row" data-worker-id="${esc(worker.id)}" data-tone="${esc(visual.tone)}" data-signal="${esc(visual.signal)}">
      <div class="automation-main"><div class="automation-title"><span class="project-name">${iconSlot(worker.id)}<strong>${esc(worker.name || projectName(worker.id))}</strong></span><span class="operator-state status-badge" data-tone="${esc(visual.tone)}" data-signal="${esc(visual.signal)}"><span class="status-light" aria-hidden="true"></span><span>${esc(plainStatus(worker))}</span></span></div>
      <p>Last checked ${esc(relative(state.last_run_at))} · ${worker.enabled ? "next " + esc(relative(state.next_run_at)) : "automatic checks are off"}</p></div>
      <button class="operator-button ${action.tone}" data-worker-action="${action.action}" type="button">${glyph(action.action === "repair" ? "repair" : "play")} ${esc(action.label)}</button>
      <details class="automation-more"><summary aria-label="More automatic check controls">${glyph("more")}</summary><div class="automation-menu">${worker.enabled && action.action !== "toggle" ? '<button type="button" data-worker-action="toggle">Pause automatic checks</button>' : ""}<div>Runner changes code only through its guarded branch and review flow.</div></div></details>
    </article>`;
  }).join("");
  hydrateProjectIcons(target);
  target.querySelectorAll("[data-worker-id]").forEach(row => {
    const worker = workers.find(item => item.id === row.dataset.workerId);
    row.querySelectorAll("[data-worker-action]").forEach(button => button.addEventListener("click", () => performAction(worker, button.dataset.workerAction, button, ui)));
  });
}

async function loadProjectWork(ui) {
  const target = document.querySelector("#today-work");
  showLoading(target, "work", "Loading project work");
  try {
    if (!projectIds.length) projectIds = await loadProjectIndex();
    const ids = projectScope && projectIds.includes(projectScope) ? [projectScope] : projectIds;
    const results = await Promise.allSettled(ids.map(async id => {
      projectCache.set(id, await loadProjectDetail(id));
      return { id, ...projectCache.get(id) };
    }));
    const items = [];
    projectAttention = [];
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const progress = Array.isArray(result.value.observed?.progress) ? result.value.observed.progress : [];
      for (const item of progress) {
        if (item.state === "complete") continue;
        items.push({ projectId:result.value.id, item });
        if (["waiting-for-human","blocked","failed","officially-stale"].includes(item.state)) projectAttention.push({ kind:"project", projectId:result.value.id, item });
      }
    }
    items.sort((a,b) => {
      const sorted = sortCurrentProgress([a.item,b.item]);
      return sorted[0] === a.item ? -1 : 1;
    });
    target.innerHTML = items.length ? items.slice(0, 8).map(({ projectId, item }) => {
      const meta = progressStateMeta(item.state);
      const detail = item.external?.active ? item.external.detail : item.waiting_reason || item.latest_event?.type?.replaceAll("-", " ") || "Observed execution state";
      return `<button class="today-task" type="button" data-open-project="${esc(projectId)}" data-tone="${esc(meta.tone)}" data-signal="${esc(meta.signal || "quiet")}">
        <span class="today-task-project">${iconSlot(projectId)}${esc(projectName(projectId))}</span>
        <span class="today-task-title">${esc(item.assignment || "work item")}<small class="today-task-meta">${esc(detail)} · ${esc(relativeProgress(item.last_meaningful_progress_at))}</small></span>
        <span class="today-task-state status-badge" data-tone="${esc(meta.tone)}" data-signal="${esc(meta.signal || "quiet")}"><span class="status-light" aria-hidden="true"></span><span>${esc(meta.label)}</span></span>
      </button>`;
    }).join("") : '<div class="operator-empty">No observed project work is active right now.</div>';
    hydrateProjectIcons(target);
    target.querySelectorAll("[data-open-project]").forEach(button => button.addEventListener("click", () => ui.openProject(button.dataset.openProject)));
    renderAttention(ui);
  } catch {
    target.innerHTML = '<div class="operator-empty">Observed project work could not be loaded right now.</div>';
  }
}

export async function loadToday(ui, projectId = "") {
  projectScope = projectId || "";
  ui.setConnection("checking…", "loading");
  [["today-attention", "attention"], ["today-work", "work"], ["today-automations", "automation"]].forEach(([id, kind]) => showLoading(document.getElementById(id), kind, "Loading project activity"));
  try {
    workers = await api("/api/workers");
    projectAttention = [];
    renderAttention(ui); renderAutomations(ui);
    await loadProjectWork(ui);
    ui.setConnection("connected", "good");
  } catch (error) {
    ui.setConnection(error.status === 403 ? "access needed" : "couldn’t connect", "bad");
    document.querySelector("#today-attention").innerHTML = '<div class="operator-empty">Relay could not load project status.</div>';
    document.querySelector("#today-automations").innerHTML = "";
    document.querySelector("#today-work").innerHTML = '<div class="operator-empty">Project work could not be loaded right now.</div>';
  }
}
