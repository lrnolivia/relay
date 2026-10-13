import { statusLabel, phaseLabel, eventLabel, summaryText } from "../../../../packages/shared-ui/presentation-copy.js";
import { projectHref } from "../../../../packages/shared-ui/project-context.js";
import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveRelay } from "../live";
import { loadAssignment } from "../api";
import { SignalDeck } from "../components/SignalDeck";
import { ActivitySparkline, ProgressRing, StatusLight } from "../components/Telemetry";
import type { ObservedProgress } from "../types";

export function RunnerWorkPage() {
  const { project: contextProject } = useLiveRelay();
  const { project = "", assignment = "" } = useParams();
  const heading=useRef<HTMLHeadingElement>(null);
  const [item, setItem] = useState<ObservedProgress | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting" | "stale" | "offline">("connecting");

  useEffect(() => {
    let alive = true;
    let last = 0;
    async function refresh() {
      try {
        if (last) setStatus("reconnecting");
        const payload = await loadAssignment(project, assignment);
        if (!alive) return;
        setItem(payload.progress?.find(candidate=>candidate.assignment===assignment) || null);
        last = Date.now();
        setStatus("live");
      } catch {
        if (!alive) return;
        setStatus(last && Date.now() - last < 30_000 ? "reconnecting" : "offline");
      }
    }
    void refresh();
    const timer = window.setInterval(() => {
      if (last && Date.now() - last > 20_000) setStatus("stale");
      void refresh();
    }, 8_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [project, assignment]);

  useEffect(()=>{if(status==='live')heading.current?.focus({preventScroll:true});},[assignment,status]);
  const title = item?.goal || assignment.replace(/[-_]+/g, " ");
  const events = useMemo(() => item?.events || [], [item]);
  const percent = item?.state === "complete" ? 100 : undefined;
  const cards = [
    { id: "state", label: "state", value: statusLabel(item?.state || status), detail: summaryText(item?.waiting_reason, "Latest reported work status."), tone: item?.state === "failed" || item?.state === "blocked" ? "bad" : status === "live" ? "good" : "quiet" },
    { id: "phase", label: "current phase", value: phaseLabel(item?.stage), detail: summaryText(item?.next_action, "No next step reported."), tone: "quiet" },
    { id: "events", label: "progress updates", value: String(events.length), detail: item?.last_meaningful_progress_at ? `latest ${new Date(item.last_meaningful_progress_at).toLocaleString()}` : "No timestamp reported.", tone: events.length ? "good" : "quiet" }
  ];

  return (
    <div className="page operator-page react-page work-detail">
      <Link className="back-link" to={projectHref("/runner", contextProject)}>← runner</Link>
      <SignalDeck cards={cards} />
      <div className="work-detail-head">
        <div>
          <div className="work-card-meta"><StatusLight tone={status === "live" ? "good" : status === "stale" ? "warn" : "quiet"} label={statusLabel(status)} />{item?.primary_staff && <span>{item.primary_staff}</span>}</div>
          <h1 ref={heading} tabIndex={-1}>{title}</h1>
          {status==="live"&&!item&&<p role="status">This work item is no longer available. Return to Runner to see current work.</p>}
          <p>{summaryText(item?.waiting_reason || item?.recovery_action, item ? eventLabel(item.latest_event?.type) : "Waiting for a progress update.")}</p>
        </div>
        <ProgressRing percent={percent} label={phaseLabel(item?.stage)} />
      </div>
      <section className="telemetry-panel">
        <div><span>latest update</span><strong>{item?.last_meaningful_progress_at ? new Date(item.last_meaningful_progress_at).toLocaleString() : "not reported"}</strong></div>
        <div><span>next</span><strong>{summaryText(item?.next_action, "No next step reported.")}</strong></div>
        <ActivitySparkline events={events} />
      </section>
      <section className="operator-section">
        <div className="section-heading"><h2>live updates</h2><span>{events.length} observed</span></div>
        <ol className="event-stream">
          {events.map((event, index) => <li key={event.id || index}><time>{event.at ? new Date(event.at).toLocaleTimeString() : "time unknown"}</time><strong>{eventLabel(event.type)}</strong><span>{index === 0 ? "latest confirmed update" : "observed by Relay"}</span></li>)}
        </ol>
      </section>
      <details className="technical-disclosure"><summary>technical identity</summary><pre>{JSON.stringify({state:item?.state,stage:item?.stage,next_action:item?.next_action,waiting_reason:item?.waiting_reason,recovery_action:item?.recovery_action,events:item?.events,identities:item?.identities}, null, 2)}</pre></details>
    </div>
  );
}

