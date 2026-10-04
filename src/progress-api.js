import { githubApiRequest } from "./source.js";
import { readRunnerFile } from "./runner-control-core.js";
import { cloudWorkerSummary } from "./cloud.js";
import { deriveObservedProgress } from "./progress-observation.js";

export const PROGRESS_CONTRACT_VERSION = "1.7.5";

async function jsonFile(api, base, path) {
  const file = await readRunnerFile(api, base, path);
  return JSON.parse(file.content);
}
async function pages(api, path) {
  const out = [];
  for (let page = 1; page <= 10; page += 1) {
    const part = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!Array.isArray(part)) throw new Error("Progress inventory is incomplete");
    out.push(...part);
    if (part.length < 100) return out;
  }
  throw new Error("Progress inventory exceeds bounded pagination");
}

export function queuedProgress(item) {
  return {
    assignment: item.id,
    state: "queued",
    stage: "queued",
    observed: false,
    last_meaningful_progress_at: null,
    latest_event: null,
    identities: {},
    next_action: item.next_action || null
  };
}
export function progressResponse(project, progress = [], queue = []) {
  return {
    contract_version: PROGRESS_CONTRACT_VERSION,
    observed_progress: true,
    project,
    generated_at: new Date().toISOString(),
    progress,
    queue
  };
}

export async function callProgress(args, env = {}, apiOverride, cloudOverride) {
  const api = apiOverride || ((path, options) => githubApiRequest(env, path, options));
  const controlRepository = String(env?.RELAY_RUNNER_CONTROL_REPOSITORY || "lrnolivia/relay");
  const control = `/repos/${controlRepository}`;
  const registration = await jsonFile(api, control, `projects/${args.project}.json`);
  const record = await jsonFile(api, control, registration.coordination.record);
  const repoBase = `/repos/${registration.repository}`;
  const [branches, prs] = await Promise.all([
    pages(api, `${repoBase}/branches`),
    pages(api, `${repoBase}/pulls?state=all`)
  ]);
  let cloud = null;
  if (registration.cloud?.provider === "cloudflare" && registration.cloud.worker) {
    try {
      cloud = cloudOverride
        ? await cloudOverride(registration.cloud.worker)
        : await cloudWorkerSummary(env, registration.cloud.worker);
    } catch (error) {
      cloud = { script: registration.cloud.worker, error: error instanceof Error ? error.message : "Cloud evidence unavailable" };
    }
  }
  const claims = record.claims.filter(item => !args.assignment || item.id === args.assignment);
  const progress = [];
  for (const claim of claims) {
    const branch = branches.find(item => item.name === claim.branch) || null;
    const headSha = branch?.commit?.sha || claim.merged_head_sha || null;
    let commit = null;
    if (headSha) { try { commit = await api(`${repoBase}/commits/${headSha}`); } catch {} }
    const pr = prs.filter(item => item?.head?.ref === claim.branch)
      .sort((a,b) => Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0))[0] || null;
    let checks = [];
    if (headSha) {
      try {
        const got = await api(`${repoBase}/commits/${headSha}/check-runs?per_page=100`);
        checks = Array.isArray(got?.check_runs) ? got.check_runs : [];
      } catch {}
    }
    progress.push(deriveObservedProgress({
      project: args.project, claim, branch, commit, pullRequest: pr, checks, cloud,
      findings: branches
        .filter(item => !record.claims.some(c => c.branch === item.name) && !record.legacy_branches.includes(item.name))
        .map(item => ({ type: "unregistered_branch", branch: item.name }))
    }));
  }
  const queue = record.queue
    .filter(item => item.state === "queued" && (!args.assignment || item.id === args.assignment))
    .map(queuedProgress);
  return progressResponse(args.project, progress, queue);
}
