import {loadDashboard} from '../src/api.ts';
import {projectActivity,partitionProjects} from '../../../packages/shared-ui/work-activity.js';
import {groupedProjects,groupedActivity,projectGroup} from '../../../packages/shared-ui/project-groups.js';
import { bindMotion } from "../../../packages/shared-ui/motion.js";
import { bindPresentation, countVisual } from "../../../packages/shared-ui/presentation.js";
import { bindTheme } from "./theme.js";
import { showLoading } from "./loading.js";
import { projectFromHash, projectHref } from "../../../packages/shared-ui/project-context.js";
import { glyph, telemetryGlyph } from "../../../packages/shared-ui/glyphs.js";
import { bindNotifications, publishNotification } from '../../../packages/shared-ui/notifications.js';
import { brand, featureAccent } from "./brand.js";
import { iconSlot, hydrateProjectIcons } from "./project-icons.js";
import { openQa } from "./qa.js";
import { loadNightShift } from "../../../features/night-shift/view.js";

import { loadToday } from "./operator-today.js";
import { bindReviewFilters, loadReview } from "./operator-review.js";
import { esc, loadProjectDetail, loadProjectIndex, projectName, renderProjectDetail } from "./operator-projects.js";

bindTheme();
bindPresentation();
bindMotion();
const notificationRoot = document.querySelector('#notification-center');
if (notificationRoot) bindNotifications(notificationRoot);

const pages = [...document.querySelectorAll("[data-page]")];
const nav = [...document.querySelectorAll("[data-nav]")];
const connection = document.querySelector("#operator-connection");
const projectTabs = document.querySelector("#project-tabs");
const projectDetail = document.querySelector("#project-detail");
const appSettings = document.querySelector("#app-settings");
const sidebar = document.querySelector(".operator-topbar");

let projectIds = [],recentActivity={},projectSeen={},activityStarted=false;
try{projectSeen=JSON.parse(localStorage.getItem('relay.project-seen.v1')||'{}')||{};}catch{}

let selectedProject = projectFromHash(location.hash) || null;
const projectCache = new Map();

const navigation = {
  today: ["today", "focus", "today"],
  projects: ["runner", "coordinate", "runner"],
  review: ["inspector", "review", "inspector"],
  "night-shift": ["night shift", "monitor", "night-shift"]
};

nav.forEach(button => {
  const [label, detail, feature] = navigation[button.dataset.nav];
  button.setAttribute("aria-label", label);
  button.dataset.feature = feature;
  button.style.setProperty("--feature-accent", featureAccent[feature] || featureAccent.relay);
  button.innerHTML = '<span class="glyph-chip"><img class="tool-mark" src="' + brand[feature] + '" alt=""></span><span class="nav-copy"><strong>' + label + '</strong><small>' + detail + '</small></span><span class="nav-chevron">' + glyph("next") + '</span>';
});

document.querySelectorAll("[data-feature-icon]").forEach(image => {
  const feature = image.dataset.featureIcon;
  image.src = brand[feature] || brand.relay;
});
document.querySelectorAll(".feature-heading").forEach(heading => {
  const feature = heading.dataset.feature || "relay";
  heading.style.setProperty("--feature-accent", featureAccent[feature] || featureAccent.relay);
});

if (appSettings) {
  appSettings.querySelector(".utility-icon").innerHTML = glyph("refresh");
}

function setShellMotion(direction) {
  if (!sidebar || window.innerWidth <= 900) return;
  document.body.dataset.shellMotion = direction;
}

sidebar?.addEventListener("pointerenter", () => setShellMotion("expand"));
sidebar?.addEventListener("pointerleave", () => {
  if (!sidebar.contains(document.activeElement)) setShellMotion("collapse");
});
sidebar?.addEventListener("focusin", () => setShellMotion("expand"));
sidebar?.addEventListener("focusout", () => {
  requestAnimationFrame(() => {
    if (!sidebar.contains(document.activeElement)) setShellMotion("collapse");
  });
});

function setFlow(phase) {
  document.body.dataset.flow = phase || "orient";
}

function setOverviewDetail(label) {
  const page = pages.find(item => !item.hidden);
  if (page && label) page.dataset.overviewDetail = label;
}

function route() {
  const page = (location.hash || "#today").slice(1).split("?")[0];
  return ["today", "projects", "review", "night-shift"].includes(page) ? page : "today";
}

function setConnection(label, tone = "quiet") {
  if (!connection) return;
  connection.textContent = label;
  connection.dataset.tone = tone;
}

function notify(message, tone = "good") {
  const feature = navigation[route()]?.[2] || 'inspector';
  publishNotification({ id: feature + ':' + (selectedProject || 'all') + ':' + message,
    feature, project: selectedProject || '', title: tone === 'bad' ? 'Could not finish this step' : 'Update',
    message, severity: tone === 'bad' ? 'error' : tone === 'warn' ? 'warning' : 'info',
    href: projectHref('/inspector#review', selectedProject), action: 'Open Inspector' });
}

async function ensureProjects() {
  if (!projectIds.length) projectIds = await loadProjectIndex();
  renderProjectTabs();
  if(!activityStarted&&location.pathname==='/inspector'){activityStarted=true;void loadDashboard(snapshot=>{recentActivity={...recentActivity,...groupedActivity(projectActivity(snapshot))};renderProjectTabs();}).catch(()=>{});}
  return projectIds;
}

function contextProject() {
  return selectedProject || "";
}

function renderProjectTabs() {
  if (!projectTabs) return;
  const groups=groupedProjects(projectIds.map(id=>({id}))),parts=partitionProjects(groups,recentActivity,projectSeen,Date.now(),projectName);
  const button=(item,fresh=false)=>{
    const active=projectGroup(selectedProject||'')===item.id,identity=item.id?iconSlot(item.id):'<span class="project-tab-all">'+glyph('projects')+'</span>';
    return '<button class="project-tab'+(active?' active':'')+'" type="button" role="tab" aria-selected="'+active+'" aria-label="'+esc(item.id?projectName(item.id):'all projects')+'" data-project-id="'+esc(item.id)+'">'+identity+'<span>'+esc(item.id?projectName(item.id):'all projects')+'</span>'+(fresh?'<span class="project-update-label">updated</span>':'')+'</button>';
  };
  const group=groups.find(item=>item.id===projectGroup(selectedProject||''));
  projectTabs.innerHTML=(parts.recent.length?'<div class="project-updates-row" aria-label="Recently updated projects">'+parts.recent.map(item=>button(item,true)).join('')+'</div>':'')+button({id:''})+parts.rest.map(item=>button(item)).join('')+(group?.children.length?'<div class="project-child-tabs">'+group.children.map(item=>'<button type="button" data-project-id="'+esc(item.id)+'" aria-pressed="'+(selectedProject===item.id)+'">'+esc(projectName(item.id))+'</button>').join('')+'</div>':'');
  projectTabs.querySelectorAll("[data-project-id]").forEach(button => {
    button.addEventListener("click", () => chooseProject(button.dataset.projectId));
  });
  hydrateProjectIcons(projectTabs);
  const active = projectTabs.querySelector(".project-tab.active");
  active?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

async function chooseProject(id) {
  if(id&&recentActivity[id]){projectSeen={...projectSeen,[id]:recentActivity[id]};try{localStorage.setItem('relay.project-seen.v1',JSON.stringify(projectSeen));}catch{}}
  selectedProject = id || null;
  const next = projectHref("#" + route(), selectedProject);
  if (location.hash !== next) { location.hash = next; return; }
  projectCache.clear();
  renderProjectTabs();
  if (route() === "projects") {
    if (id) {
      const next = "#projects?project=" + encodeURIComponent(id);
      if (location.hash !== next) location.hash = next;
      else await selectProject(id);
    } else {
      if (location.hash !== "#projects") location.hash = "projects";
      else await selectProject(null);
    }
    return;
  }
  await showPage(route());
}

async function selectProject(id) {
  selectedProject = id || null;
  renderProjectTabs();
  if (!id) {
    projectDetail.innerHTML = '<div class="project-empty-state"><strong>Choose a project</strong><span>The project tabs above control Runner, Inspector, Today and night shift.</span></div>';
    return;
  }
  showLoading(projectDetail, "project", "Loading project");
  try {
    if (!projectCache.has(id)) projectCache.set(id, await loadProjectDetail(id));
    renderProjectDetail(projectDetail, id, projectCache.get(id));
  } catch {
    projectDetail.innerHTML = '<div class="operator-empty">Relay could not load this project right now.</div>';
  }
}

async function loadProjects() {
  const linked = new URLSearchParams(location.hash.split("?")[1] || "").get("project");
  await ensureProjects();
  projectCache.clear();
  if (linked && projectIds.includes(linked)) selectedProject = linked;
  renderProjectTabs();
  await selectProject(selectedProject);
}

function openProject(id) {
  selectedProject = id;
  renderProjectTabs();
  location.hash = "projects?project=" + encodeURIComponent(id);
}

async function openSettings(event) {
  event?.preventDefault();
  const href = "https://chatgpt.com/settings/plugins-settings/plugin_asdk_app_6abe234861d881919e30db65d656492f";
  try {
    if (window.openai?.openExternal) await window.openai.openExternal({ href });
    else window.open(href, "_blank", "noopener,noreferrer");
  } catch {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}

document.querySelectorAll("[data-signal-id] .signal-mark").forEach(slot => {
  slot.innerHTML = glyph(telemetryGlyph(slot.closest("[data-signal-id]").dataset.signalId));
});

const ui = { setConnection, notify, openProject, setFlow, setOverviewDetail, contextProject };

function updateInspectorSignals() {
  const list = document.querySelector("#review-list");
  const loading = list?.querySelector(".content-skeleton");
  const state = list?.dataset.summaryState || "loading";
  const previews = document.querySelectorAll("#chat-card-tabs [role='tab'], #chat-card-tabs button").length;
  const set = (id, value) => {
    const node = document.getElementById(id);
    if (node) { node.textContent = String(value); node.dataset.valueKind = /^\d+$/.test(String(value)) ? "number" : "text"; }
  };
  set("inspector-signal-needs", loading || state === "loading" ? "pending" : state === "error" ? "unavailable" : list.dataset.summaryNeeds);
  set("inspector-signal-visible", loading || state === "loading" ? "pending" : state === "error" ? "unavailable" : list.dataset.summaryVisible);

  document.querySelectorAll('.inspector-signal-deck .signal-card').forEach(card => {
    const value = card.querySelector('strong').textContent;
    if (card.dataset.visualValue === value) return;
    card.dataset.visualValue = value;
    let slot = card.querySelector('.signal-visual-slot');
    if (!slot) { slot = document.createElement('span'); slot.className = 'signal-visual-slot'; card.append(slot); }
    slot.innerHTML = countVisual(value);
  });
  const needsCard = document.getElementById("inspector-signal-needs")?.closest(".signal-card");
  if (needsCard) needsCard.dataset.tone = state === "error" ? "warn" : state === "ready" && Number(list.dataset.summaryNeeds) > 0 ? "act" : "quiet";
}

const inspectorSignalObserver = new MutationObserver(updateInspectorSignals);
["review-list", "chat-card-tabs"].forEach(id => {
  const node = document.getElementById(id);
  if (node) inspectorSignalObserver.observe(node, { childList: true, subtree: true, attributes: true });
});

async function showPage(name) {
  selectedProject = projectFromHash(location.hash) || null;
  const heading = document.querySelector('.operator-page[data-page="' + name + '"] .feature-heading');
  if (heading && projectTabs) heading.after(projectTabs.closest(".project-context"));
  pages.forEach(page => { page.hidden = page.dataset.page !== name; });
  nav.forEach(button => {
    const active = button.dataset.nav === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  if (name === "today") [["today-attention", "attention"], ["today-work", "work"], ["today-automations", "automation"]].forEach(([id, kind]) => showLoading(document.getElementById(id), kind, "Loading project activity"));
  if (name === "review") showLoading(document.getElementById("review-list"), "review", "Loading captures");
  if (name === "night-shift") showLoading(document.getElementById("night-shift-work"), "night", "Loading automatic work");
  if (name === "projects" && selectedProject) showLoading(projectDetail, "project", "Loading project");
  if (!projectIds.length) showLoading(projectTabs, "tabs", "Loading projects");
  await ensureProjects().catch(() => []);
  document.body.dataset.page = name;
  document.querySelector("#workspace-page").textContent = navigation[name][0];

  if (name === "today") {
    setFlow("orient", "live workspace");
    await loadToday(ui, contextProject());
  }
  if (name === "projects") {
    setFlow("orient", "observed execution");
    setConnection("connected", "good");
    await loadProjects();
  }
  if (name === "review") {
    setFlow("orient", "evidence queue");
    await loadReview(ui, contextProject());
    updateInspectorSignals();
    const evidence = new URLSearchParams(location.hash.split("?")[1] || "").get("evidence");
    if (evidence && /^vis_[a-zA-Z0-9-]{8,128}$/.test(evidence)) await openQa(evidence);
  }
  if (name === "night-shift") {
    setFlow("orient", "unattended activity");
    await loadNightShift(ui, contextProject());
  }
}

nav.forEach(button => button.addEventListener("click", () => {
  const next = button.dataset.nav;
  if (location.hash === "#" + next) showPage(next);
  else location.hash = projectHref("#" + next, contextProject());
}));

appSettings?.addEventListener("click", openSettings);
window.addEventListener("hashchange", () => showPage(route()));
bindReviewFilters();
showPage(route()).catch(error => { setConnection("couldn’t connect", "bad"); notify(error.message, "bad"); });

