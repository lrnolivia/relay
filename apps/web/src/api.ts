import type { DashboardSnapshot, ProgressPayload, ProjectRegistration, RunnerWorker, WorkloadItem } from "./types";

export class RelayQuotaError extends Error {
  constructor(public retryAt: number) {
    super(`GitHub quota exhausted. Retry after ${new Date(retryAt).toLocaleTimeString()}.`);
  }
}

async function json<T>(path: string, timeout = 15000): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    if ([403,429].includes(response.status) && detail?.code === 'rate_limit') {
      const deadline = typeof detail.retry_at === 'string' ? Date.parse(detail.retry_at) : NaN;
      const retry = response.headers.get('Retry-After');
      const header = retry && /^\d+$/.test(retry) ? Date.now()+Number(retry)*1000 : retry ? Date.parse(retry) : NaN;
      const candidates = [deadline,header].filter(value => Number.isFinite(value) && value > Date.now());
      throw new RelayQuotaError(candidates.length ? Math.max(...candidates) : Date.now()+60000);
    }
    throw new Error(`Relay returned ${response.status} for ${path}`);
  }
  return response.json() as Promise<T>;
}

export async function loadDashboard(onSnapshot?: (snapshot: DashboardSnapshot) => void, previous?: DashboardSnapshot | null): Promise<DashboardSnapshot> {
  const [{ projects }, workers] = await Promise.all([
    json<{ projects: ProjectRegistration[] }>("/api/projects"),
    json<RunnerWorker[]>("/api/workers")
  ]);
  let snapshot: DashboardSnapshot = {
    fetchedAt: new Date().toISOString(), projects, workers, workload:previous?.workload||{},
    progress: Object.fromEntries(projects.filter(project => previous?.progress[project.id]).map(project => [project.id, previous!.progress[project.id]])),
    loadingProgress: projects.map(project => project.id), failedProgress: []
  };
  onSnapshot?.(snapshot);
  await Promise.all(projects.map(async project => {
    try {
      if(project.managed===false){snapshot={...snapshot,progress:{...snapshot.progress,[project.id]:{project:project.id,progress:[],queue:[]}},loadingProgress:snapshot.loadingProgress!.filter(id=>id!==project.id)};onSnapshot?.(snapshot);return;}
      const metadata = await json<{ coordination: { claims: WorkloadItem[]; queue?: Array<NonNullable<ProgressPayload["queue"]>[number] & { state: string }> } | null }>(`/api/projects/${encodeURIComponent(project.id)}`);
      if (!metadata.coordination) throw new Error("Current project coordination is unavailable");
      snapshot={...snapshot,workload:{...snapshot.workload,[project.id]:metadata.coordination.claims}};
      const active = metadata.coordination.claims.filter(claim => ["active", "held"].includes(claim.state));
      const ids = new Set(active.map(claim => claim.id));
      snapshot = { ...snapshot, progress: { ...snapshot.progress, [project.id]: {
        project: project.id, observed_progress: true,
        progress: (snapshot.progress[project.id]?.progress || []).filter(item => ids.has(item.assignment)),
        queue: (metadata.coordination.queue || []).filter(item => item.state === "queued")
      } } };
      onSnapshot?.(snapshot);
      await Promise.all(active.map(async claim => {
        try {
          const payload = await json<ProgressPayload>(`/api/progress/${encodeURIComponent(project.id)}?assignment=${encodeURIComponent(claim.id)}`, 45000);
          const current = snapshot.progress[project.id];
          snapshot = { ...snapshot, progress: { ...snapshot.progress, [project.id]: {
            ...current, progress: [...(current.progress || []).filter(item => item.assignment !== claim.id), ...(payload.progress || []).filter(item => item.assignment === claim.id)]
          } } };
        } catch (cause) {
          snapshot = { ...snapshot, failedProgress: [...new Set([...snapshot.failedProgress!, project.id])] };
          if (cause instanceof RelayQuotaError) snapshot.quotaRetryAt = new Date(Math.max(Date.parse(snapshot.quotaRetryAt || '') || 0,cause.retryAt)).toISOString();
        }
        onSnapshot?.(snapshot);
      }));
    } catch (cause) {
      snapshot = { ...snapshot, failedProgress: [...new Set([...snapshot.failedProgress!, project.id])] };
      if (cause instanceof RelayQuotaError) snapshot.quotaRetryAt = new Date(Math.max(Date.parse(snapshot.quotaRetryAt || '') || 0,cause.retryAt)).toISOString();
    }
    snapshot = { ...snapshot, loadingProgress: snapshot.loadingProgress!.filter(id => id !== project.id) };
    onSnapshot?.(snapshot);
  }));
  return snapshot;
}

export async function loadAssignment(project: string, assignment: string): Promise<ProgressPayload> {
  return json<ProgressPayload>(`/api/progress/${encodeURIComponent(project)}?assignment=${encodeURIComponent(assignment)}`);
}

export function projectLabel(project: ProjectRegistration | string): string {
  const raw = typeof project === "string" ? project : project.name || project.id;
  const id = typeof project === "string" ? project : project.id;
  const known: Record<string, string> = {
    relay: "relay",
    field: "field",
    loewfi: "loew.fi",
    rtxforge: "rtxForge",
    "bazzite-custom": "loewOS",
    gamebridge: "GameBridge"
  };
  return known[id] || raw.replace(/[-_]+/g, " ");
}
