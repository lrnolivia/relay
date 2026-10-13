import { WorkViewer } from "../components/WorkViewer";
import { useWorkItems } from "../components/useWorkItems";
import { statusLabel } from "../../../../packages/shared-ui/presentation-copy.js";
import { ProjectSwitcher } from "../components/ProjectSwitcher";
import { FeatureHeader } from "../components/FeatureHeader";
import { SignalDeck } from "../components/SignalDeck";
import { ProgressNotice } from "../components/ProgressNotice";
import { WorkCard } from "../components/WorkCard";
import { useLiveRelay } from "../live";
import type { ObservedProgress } from "../types";

export function RunnerPage() {
  const { snapshot, allSnapshot, state, project: contextProject } = useLiveRelay();
  const workItems = useWorkItems(allSnapshot);
  const all: Array<{ project: string; item: ObservedProgress }> = [];
  for (const [project, payload] of Object.entries(snapshot?.progress || {})) {
    for (const item of payload.progress || []) if (item.state !== "complete") all.push({ project, item });
  }
  all.sort((a, b) => Date.parse(b.item.last_meaningful_progress_at || "0") - Date.parse(a.item.last_meaningful_progress_at || "0"));
  const needs = all.filter(({ item }) => ["waiting-for-human", "blocked", "failed"].includes(item.state || "")).length;
  const external = all.filter(({ item }) => item.state === "waiting-on-external-system").length;
  const stale = all.filter(({ item }) => item.state?.includes("stale")).length;
  const incomplete = !snapshot || Boolean(snapshot.loadingProgress?.length || snapshot.failedProgress?.length);
  const count = (value: number) => incomplete ? value ? `${value}+` : "pending" : String(value);
  const cards = [
    { id: "now", label: "current work", value: count(all.length), detail: incomplete ? "Some projects are still loading or could not refresh." : "Includes work in progress and work waiting for its next step.", tone: all.length ? "good" : "quiet" },
    { id: "needs", total: incomplete ? undefined : all.length, totalLabel: "current work items", label: "needs you", value: count(needs), detail: incomplete ? "Some projects are still loading or could not refresh." : needs ? "A decision or a fix is needed." : "No current work is waiting on you.", tone: needs ? "act" : "quiet" },
    { id: "external", total: incomplete ? undefined : all.length, totalLabel: "current work items", label: "waiting for a response", value: count(external), detail: incomplete ? "Some projects are still loading or could not refresh." : external ? "Work is waiting on another service." : "No work is waiting on another service.", tone: external ? "wait" : "quiet" },
    { id: "fresh", label: "last update", value: statusLabel(state), detail: incomplete ? "Some project activity is unavailable." : stale ? `${stale} work item${stale === 1 ? "" : "s"} may need an update.` : "No overdue update is reported.", tone: stale ? "warn" : state === "live" ? "good" : "quiet" }
  ];
  return (
    <div className="page operator-page react-page">
      <FeatureHeader feature="runner" title="runner" subtitle="coordinate" />
      <ProjectSwitcher />
      <ProgressNotice />
      <SignalDeck cards={cards} feature="runner" />
      <section className="operator-section">
        <div className="section-heading"><h2>current work</h2><span>{all.length} {incomplete ? "loaded" : "current"}</span></div>
        <WorkViewer id="runner" items={workItems} project={contextProject} incomplete={!allSnapshot || Boolean(allSnapshot.loadingProgress?.length || allSnapshot.failedProgress?.length)} />
      </section>
    </div>
  );
}

