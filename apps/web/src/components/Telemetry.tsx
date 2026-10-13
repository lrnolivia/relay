import type { ProgressEvent } from "../types";

export function StatusLight({ tone = "quiet", label }: { tone?: string; label: string }) {
  return <span className="status-badge status-chip" data-tone={tone}><span className="status-light" aria-hidden="true" />{label}</span>;
}

export function ProgressRing({ percent, label }: { percent?: number; label: string }) {
  const safe = percent == null ? null : Math.max(0, Math.min(100, percent));
  const circumference = 2 * Math.PI * 42;
  const dash = safe == null ? circumference * .18 : circumference * (safe / 100);
  return (
    <div className="progress-ring" aria-label={safe == null ? label : `${safe}% — ${label}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-track" cx="50" cy="50" r="42" />
        <circle className="ring-value" cx="50" cy="50" r="42" strokeDasharray={`${dash} ${circumference}`} />
      </svg>
      <div className="ring-copy"><strong>{safe == null ? "•" : `${safe}%`}</strong><span>{label}</span></div>
    </div>
  );
}

export function ActivitySparkline({ events = [] }: { events?: ProgressEvent[] }) {
  const recent = events.slice(0, 12).reverse();
  const points = recent.map((event, index) => {
    const weight = /completed|deployment|merge/i.test(event.type || "") ? 18 : /opened|started|commit/i.test(event.type || "") ? 12 : 8;
    const x = recent.length <= 1 ? 50 : (index / (recent.length - 1)) * 100;
    return `${x},${24 - weight}`;
  }).join(" ");
  return (
    <div className="sparkline" aria-label={`${recent.length} recent observed events`}>
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
        {points && <polyline points={points} />}
      </svg>
      <span>{recent.length} events</span>
    </div>
  );
}
