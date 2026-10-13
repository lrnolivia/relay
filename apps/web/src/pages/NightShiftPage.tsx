import { ExecutionPanel } from '../components/ExecutionPanel';
import { WorkViewer } from "../components/WorkViewer";
import { useWorkItems } from "../components/useWorkItems";
import { statusLabel, summaryText } from "../../../../packages/shared-ui/presentation-copy.js";
import { ProjectSwitcher } from "../components/ProjectSwitcher";
import { FeatureHeader } from "../components/FeatureHeader";
import { SignalDeck } from "../components/SignalDeck";
import { StatusLight } from "../components/Telemetry";
import { projectLabel } from "../api";
import { useLiveRelay } from "../live";

function relative(value?: string | null) {
  if (!value) return "not reported";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "time unknown";
  const diff = ms - Date.now();
  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 1) return diff >= 0 ? "within the hour" : "less than an hour ago";
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(hours, "hour");
}

export function NightShiftPage() {
  const { snapshot, allSnapshot, state, project: contextProject } = useLiveRelay();
  const workItems = useWorkItems(allSnapshot, "check");
  const workers = snapshot?.workers || [];
  const enabled = workers.filter(worker => worker.enabled);
  const attention = workers.filter(worker => Boolean(worker.runtime?.last_error) || ["blocked", "failed", "waiting_credentials"].includes(worker.runtime?.status || ""));
  const nextTimes = enabled.map(worker => worker.runtime?.next_run_at).filter(Boolean) as string[];
  const next = nextTimes.sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const results = [...workers].filter(worker => worker.runtime?.last_run_at).sort((a, b) => Date.parse(b.runtime?.last_run_at || "0") - Date.parse(a.runtime?.last_run_at || "0"));

  const answer = !snapshot ? "pending" : !enabled.length ? "nothing scheduled" : next ? relative(next) : "schedule enabled";
  const cards = [
    { id: "next", label: "will anything happen?", value: answer, detail: !snapshot ? "Checking your automatic schedules." : !enabled.length ? "Automatic checks are paused or unavailable." : next ? `next reported check ${new Date(next).toLocaleString()}` : "Automatic work is enabled, but Relay has no next-run time to show.", tone: enabled.length ? "good" : "quiet" },
    { id: "projects", total: !snapshot ? undefined : workers.length, totalLabel: "projects with schedules", label: "included projects", value: snapshot ? String(enabled.length) : "pending", detail: !snapshot ? "Checking your automatic schedules." : enabled.length ? "Projects Relay checks for you." : "No project is currently scheduled.", tone: enabled.length ? "wait" : "quiet" },
    { id: "attention", total: !snapshot ? undefined : workers.length, totalLabel: "automatic checks", label: "needs attention", value: snapshot ? String(attention.length) : "pending", detail: !snapshot ? "Checking your automatic schedules." : attention.length ? "An automatic check needs help." : "No automatic check is reporting a problem.", tone: attention.length ? "act" : "quiet" },
    { id: "monitoring", label: "monitoring", value: statusLabel(state), detail: snapshot ? `dashboard refreshed ${new Date(snapshot.fetchedAt).toLocaleTimeString()}` : "waiting for Relay", tone: state === "live" ? "good" : state === "stale" ? "warn" : "quiet" }
  ];

  return (
    <div className="page operator-page react-page">
      <FeatureHeader feature="night-shift" title="night shift" subtitle="monitor" />
      <ProjectSwitcher />
      <ExecutionPanel />
      <SignalDeck cards={cards} feature="night-shift" />
      <section className="operator-section">
        <div className="section-heading"><h2>automatic check history</h2><span>{results.length} results on record</span></div>
        <WorkViewer id="night-shift" items={workItems} project={contextProject} incomplete={!allSnapshot} />
      </section>
    </div>
  );
}

