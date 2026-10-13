import { useLiveRelay } from "../live";
import { projectLabel } from "../api";

export function ProgressNotice() {
  const { snapshot, error } = useLiveRelay();
  const loading = snapshot?.loadingProgress || [];
  const failed = snapshot?.failedProgress || [];
  if (snapshot && !loading.length && !failed.length) return null;
  return <div className="progress-notice" role="status" data-progress-notice>
    <details><summary><strong>{error ? "Relay could not refresh." : failed.length ? "Some project activity is unavailable." : "Loading project activity."}</strong></summary>
    <p>{error || (failed.length ? `${failed.map(projectLabel).join(", ")} could not refresh. Previously loaded activity stays visible; Relay will retry.` : snapshot ? `${loading.length} project${loading.length === 1 ? "" : "s"} still loading. Available activity appears as it arrives.` : "Connecting to Relay. Activity counts are not confirmed yet.")}</p></details>
  </div>;
}
