import { WorkViewer } from "../components/WorkViewer";
import { useWorkItems } from "../components/useWorkItems";
import { statusLabel, summaryText } from "../../../../packages/shared-ui/presentation-copy.js";
import { projectHref } from "../../../../packages/shared-ui/project-context.js";
import { Link } from "react-router-dom";
import { ProjectSwitcher } from "../components/ProjectSwitcher";
import { FeatureHeader } from "../components/FeatureHeader";
import { SignalDeck } from "../components/SignalDeck";
import { ProgressNotice } from "../components/ProgressNotice";
import { StatusLight } from "../components/Telemetry";
import { projectLabel } from "../api";
import { useLiveRelay } from "../live";
import type { ObservedProgress } from "../types";

function tone(state?: string) {
  if (["blocked", "failed"].includes(state || "")) return "bad";
  if (state === "waiting-for-human") return "act";
  if (state?.includes("stale")) return "warn";
  if (state === "waiting-on-external-system") return "wait";
  if (state === "working") return "good";
  return "quiet";
}

export function TodayPage() {
  const { snapshot, allSnapshot, state, project: contextProject } = useLiveRelay();
  const workItems = useWorkItems(allSnapshot);
  const all: Array<{ project: string; item: ObservedProgress }> = [];
  for (const [project, payload] of Object.entries(snapshot?.progress || {})) {
    for (const item of payload.progress || []) all.push({ project, item });
  }
  const current = all.filter(({ item }) => item.state !== "complete");
  const needs = current.filter(({ item }) => ["waiting-for-human", "blocked", "failed", "officially-stale"].includes(item.state || ""));
  const moving = current.filter(({ item }) => item.state === "working");
  const workers = snapshot?.workers || [];
  const enabled = workers.filter(worker => worker.enabled);
  const incomplete = !snapshot || Boolean(snapshot.loadingProgress?.length || snapshot.failedProgress?.length);
  const count = (value: number) => incomplete ? value ? `${value}+` : "pending" : String(value);

  const cards = [
    { id: "needs", total: incomplete ? undefined : current.length, totalLabel: "current work items", label: "needs you", value: count(needs.length), detail: incomplete ? "Some projects are still loading or could not refresh." : needs.length ? "A decision, review, or recovery step is waiting." : "Nothing is asking for your attention.", tone: needs.length ? "act" : "quiet" },
    { id: "moving", total: incomplete ? undefined : current.length, totalLabel: "current work items", label: "moving", value: count(moving.length), detail: incomplete ? "Some projects are still loading or could not refresh." : moving.length ? "Work has reported recent progress." : "No work is reporting progress right now.", tone: moving.length ? "good" : "quiet" },
    { id: "automatic", total: incomplete ? undefined : workers.length, totalLabel: "automatic checks", label: "automatic checks", value: snapshot ? String(enabled.length) : "pending", detail: !snapshot ? "Checking your automatic schedules." : enabled.length ? "Projects Relay checks for you." : "No automatic checks are enabled.", tone: enabled.length ? "wait" : "quiet" },
    { id: "freshness", label: "information", value: statusLabel(state), detail: snapshot ? `last refreshed ${new Date(snapshot.fetchedAt).toLocaleTimeString()}` : "waiting for Relay", tone: state === "live" ? "good" : state === "stale" ? "warn" : "quiet" }
  ];

  return (
    <div className="page operator-page react-page">
      <FeatureHeader feature="today" title="today" subtitle="focus" />
      <ProjectSwitcher />
      <ProgressNotice />
      <SignalDeck cards={cards} feature="today" />

      <section className="operator-section">
        <h2>needs you</h2>
        <div className="react-stack">
          {needs.length ? needs.map(({ project, item }) => (
            <article className="attention-card" data-tone={tone(item.state)} key={`${project}:${item.assignment}`}>
              <div className="attention-copy">
                <span className="attention-project">{projectLabel(project)}</span>
                <strong>{item.goal || item.assignment.replace(/[-_]+/g, " ")}</strong>
                <p>{item.waiting_reason || item.recovery_action || item.next_action || "Relay needs your attention."}</p>
              </div>
              <Link className="operator-button secondary" to={projectHref(`/runner/${encodeURIComponent(project)}/${encodeURIComponent(item.assignment)}`, contextProject)}>review</Link>
            </article>
          )) : incomplete ? null : <div className="clear-card"><strong>You’re clear.</strong><span>Nothing needs your attention right now.</span></div>}
        </div>
      </section>

      <section className="operator-section">
        <div className="section-heading"><h2>current work</h2><span>across your projects</span></div>
        <WorkViewer id="today" items={workItems} project={contextProject} incomplete={!allSnapshot || Boolean(allSnapshot.loadingProgress?.length || allSnapshot.failedProgress?.length)} />
      </section>

      <section className="operator-section">
        <div className="section-heading"><h2>automatic checks</h2><span>relay watches these for you</span></div>
        <div className="react-stack">
          {workers.length ? workers.map(worker => {
            const workerTone = worker.runtime?.last_error ? "bad" : worker.runtime?.status === "running" ? "good" : worker.enabled ? "wait" : "quiet";
            return <article className="automation-row" data-tone={workerTone} key={worker.id}>
              <div className="automation-main">
                <div className="automation-title"><strong>{worker.name || projectLabel(worker.id)}</strong><StatusLight tone={workerTone} label={worker.runtime?.last_error ? "needs attention" : statusLabel(worker.runtime?.status || (worker.enabled ? "enabled" : "paused"))} /></div>
                <p>{summaryText(worker.runtime?.last_summary || worker.runtime?.last_error, worker.runtime?.last_error ? "A check needs attention. Open Details for the reported problem." : worker.enabled ? "Relay will check this project automatically." : "Automatic checks are paused.")}</p>
                {(worker.runtime?.last_summary || worker.runtime?.last_error) && <details><summary>Details</summary><p>{worker.runtime?.last_summary}</p><p>{worker.runtime?.last_error}</p></details>}
              </div>
              <span className="operator-state">{worker.runtime?.next_run_at ? `next ${new Date(worker.runtime.next_run_at).toLocaleString()}` : worker.enabled ? "schedule enabled" : "paused"}</span>
            </article>;
          }) : <div className="clear-card"><strong>{snapshot ? "No automatic checks." : "Checking automatic schedules."}</strong><span>{snapshot ? "No automatic schedule is available." : "Checking your automatic schedules."}</span></div>}
        </div>
      </section>
    </div>
  );
}

