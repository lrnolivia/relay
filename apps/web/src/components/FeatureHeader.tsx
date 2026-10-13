const marks: Record<string, string> = {
  relay: "/brand/relay.png",
  today: "/brand/today.png",
  runner: "/brand/runner.png",
  inspector: "/brand/inspector.png",
  "night-shift": "/brand/night-shift.png"
};

export function FeatureHeader({ feature, title, subtitle }: { feature: string; title: string; subtitle: string }) {
  return (
    <header className="page-heading feature-heading" data-feature={feature}>
      <img className="feature-mark" src={marks[feature] || marks.relay} alt="" />
      <div className="feature-heading-copy">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}
