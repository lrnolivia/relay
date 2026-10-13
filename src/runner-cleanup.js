import { githubApiRequest } from "./source.js";
import { readRunnerFile as read } from "./runner-control-core.js";
import { occupying, retired } from "./coordination-engine.js";
import { RUNNER_ENGINE_SHA, runnerControlBase } from "./runner-control.js";

const SHA = /^[a-f0-9]{40}$/;
const PROJECT = /^[a-z0-9-]+$/;

async function jsonFile(api, control, path) {
  const file = await read(api, control, path);
  return { ...file, value: JSON.parse(file.content) };
}

async function pages(api, path) {
  const items = [];
  for (let page = 1; page <= 100; page += 1) {
    const part = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!Array.isArray(part)) throw new Error("Incomplete paginated inventory");
    items.push(...part);
    if (part.length < 100) return items;
  }
  throw new Error("Inventory exceeds bounded pagination");
}

function branchRef(name) {
  return String(name).split("/").map(encodeURIComponent).join("/");
}

async function context(api, control, project) {
  if (typeof project !== "string" || !PROJECT.test(project)) throw new Error("Invalid project");
  const registrationFile = await jsonFile(api, control, `projects/${project}.json`);
  const registration = registrationFile.value;
  if (
    registration?.id !== project ||
    registration?.managed !== true ||
    !/^lrnolivia\/[A-Za-z0-9_.-]+$/.test(registration?.repository || "") ||
    !registration?.default_branch ||
    registration?.coordination?.status !== "enabled" ||
    registration?.coordination?.record !== `coordination/${project}.json`
  ) {
    throw new Error("Project is not a managed Runner coordination target");
  }
  if (
    !Array.isArray(registration?.implementation?.excluded_branches) ||
    !Array.isArray(registration?.implementation?.branch_prefixes)
  ) {
    throw new Error("Project cleanup policy is incomplete");
  }
  const recordFile = await jsonFile(api, control, registration.coordination.record);
  const record = recordFile.value;
  if (
    record?.project !== project ||
    !Array.isArray(record?.claims) ||
    !Array.isArray(record?.legacy_branches)
  ) {
    throw new Error("Invalid Runner coordination record");
  }
  const engine = await read(api, control, "src/coordination.mjs");
  if (engine.sha !== RUNNER_ENGINE_SHA) {
    throw new Error("Runner engine changed; refresh cleanup adapter before mutation");
  }
  return { registration, registrationFile, record, recordFile };
}

function evidenceReady(claim) {
  return (
    claim?.state === "completed" &&
    claim?.work_accounted === true &&
    Number.isInteger(claim?.pr) &&
    claim.pr > 0 &&
    SHA.test(claim?.merged_head_sha || "") &&
    SHA.test(claim?.merge_commit_sha || "")
  );
}

async function mergedProof(api, ctx, claim) {
  const base = `/repos/${ctx.registration.repository}`;
  const pr = await api(`${base}/pulls/${claim.pr}`);
  if (
    !pr?.merged ||
    pr?.base?.ref !== ctx.registration.default_branch ||
    pr?.base?.repo?.full_name !== ctx.registration.repository ||
    pr?.head?.repo?.full_name !== ctx.registration.repository ||
    pr?.head?.ref !== claim.branch ||
    pr?.head?.sha !== claim.merged_head_sha ||
    pr?.merge_commit_sha !== claim.merge_commit_sha
  ) {
    throw new Error(`Merged evidence changed for ${claim.branch}; cleanup stopped`);
  }
  return pr;
}

function activeOnBranch(record, branch) {
  return record.claims.some(claim => occupying(claim) && claim.branch === branch);
}

// Retirement releases reservations, but preserves every referenced branch.
// A historical completion for a reused name must not make that branch deletable.
function retiredOnBranch(record, branch) {
  return record.claims.some(claim => retired(claim) && claim.branch === branch);
}

function protectedByPolicy(ctx, claim) {
  return (
    ctx.registration.implementation.excluded_branches.includes(claim.branch) ||
    ctx.record.legacy_branches.includes(claim.branch)
  );
}

async function exactBranchHead(api, repository, branch) {
  const ref = await api(
    `/repos/${repository}/git/ref/heads/${branchRef(branch)}`
  );
  if (!SHA.test(ref?.object?.sha || "")) throw new Error("Branch head response is incomplete");
  return ref.object.sha;
}

async function eligibleClaims(api, ctx) {
  const branches = await pages(api, `/repos/${ctx.registration.repository}/branches`);
  const branchMap = new Map(branches.map(item => [item.name, item?.commit?.sha]));
  const eligible = [];
  const retained = [];

  for (const claim of ctx.record.claims) {
    if (!evidenceReady(claim)) continue;
    if (protectedByPolicy(ctx, claim)) {
      retained.push({ branch: claim.branch, assignment: claim.id, reason: "protected_policy" });
      continue;
    }
    if (retiredOnBranch(ctx.record, claim.branch)) {
      retained.push({ branch: claim.branch, assignment: claim.id, reason: "retired_branch" });
      continue;
    }
    if (activeOnBranch(ctx.record, claim.branch)) {
      retained.push({ branch: claim.branch, assignment: claim.id, reason: "active_ownership" });
      continue;
    }
    if (!branchMap.has(claim.branch)) {
      retained.push({ branch: claim.branch, assignment: claim.id, reason: "branch_absent" });
      continue;
    }

    await mergedProof(api, ctx, claim);
    if (branchMap.get(claim.branch) !== claim.merged_head_sha) {
      retained.push({ branch: claim.branch, assignment: claim.id, reason: "post_merge_commits" });
      continue;
    }
    eligible.push({
      assignment: claim.id,
      branch: claim.branch,
      pr: claim.pr,
      merged_head_sha: claim.merged_head_sha,
      merge_commit_sha: claim.merge_commit_sha
    });
  }
  return { eligible, retained };
}

async function rereadClaim(api, control, project, candidate) {
  const record = await jsonFile(api, control, `coordination/${project}.json`);
  const claim = record.value.claims.find(item => item.id === candidate.assignment);
  if (
    !claim ||
    !evidenceReady(claim) ||
    claim.branch !== candidate.branch ||
    claim.pr !== candidate.pr ||
    claim.merged_head_sha !== candidate.merged_head_sha ||
    claim.merge_commit_sha !== candidate.merge_commit_sha ||
    activeOnBranch(record.value, candidate.branch) ||
    retiredOnBranch(record.value, candidate.branch)
  ) {
    throw new Error(`Ownership or evidence changed for ${candidate.branch}; cleanup stopped`);
  }
  return { record, claim };
}

export const runnerCleanupTool = {
  name: "relay_runner_cleanup",
  title: "Clean eligible managed branches",
  description: "Dry-run or delete only completed, accounted managed branches whose current head and merged PR identity still exactly match Runner's recorded completion evidence.",
  inputSchema: {
    type: "object",
    properties: {
      project: { type: "string", pattern: "^[a-z0-9-]+$" },
      mode: { type: "string", enum: ["dry_run", "execute"] }
    },
    required: ["project", "mode"],
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true
  }
};

export function validateRunnerCleanupArguments(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object");
  for (const key of Object.keys(args)) if (!["project", "mode"].includes(key)) throw new Error(`Unsupported argument: ${key}`);
  if (typeof args.project !== "string" || !PROJECT.test(args.project)) throw new Error("Invalid project");
  if (!["dry_run", "execute"].includes(args.mode)) throw new Error("Cleanup mode must be dry_run or execute");
  return args;
}

export async function callRunnerCleanup(args, env, apiOverride) {
  validateRunnerCleanupArguments(args);
  const api = apiOverride || ((path, options) => githubApiRequest(env, path, options));
  const control = runnerControlBase(env);
  const ctx = await context(api, control, args.project);
  const scan = await eligibleClaims(api, ctx);

  if (args.mode === "dry_run") {
    return {
      ok: true,
      namespace: "relay.RUNNER",
      project: args.project,
      mode: "dry_run",
      checked_at: new Date().toISOString(),
      record_sha: ctx.recordFile.sha,
      policy_sha: ctx.registrationFile.sha,
      engine_sha: RUNNER_ENGINE_SHA,
      eligible: scan.eligible,
      retained: scan.retained,
      deleted: []
    };
  }

  const deleted = [];
  const retained = [...scan.retained];
  for (const candidate of scan.eligible) {
    const latest = await rereadClaim(api, control, args.project, candidate);
    const latestCtx = { ...ctx, record: latest.record.value, recordFile: latest.record };
    if (protectedByPolicy(latestCtx, latest.claim)) {
      retained.push({ branch: candidate.branch, assignment: candidate.assignment, reason: "protected_policy" });
      continue;
    }
    await mergedProof(api, latestCtx, latest.claim);
    const currentHead = await exactBranchHead(api, ctx.registration.repository, candidate.branch);
    if (currentHead !== candidate.merged_head_sha) {
      retained.push({ branch: candidate.branch, assignment: candidate.assignment, reason: "post_merge_commits" });
      continue;
    }

    await api(
      `/repos/${ctx.registration.repository}/git/refs/heads/${branchRef(candidate.branch)}`,
      { method: "DELETE" }
    );
    const branches = await pages(api, `/repos/${ctx.registration.repository}/branches`);
    if (branches.some(item => item.name === candidate.branch)) {
      throw new Error(`Branch deletion did not verify for ${candidate.branch}`);
    }
    deleted.push(candidate.branch);
  }

  return {
    ok: true,
    namespace: "relay.RUNNER",
    project: args.project,
    mode: "execute",
    checked_at: new Date().toISOString(),
    record_sha: ctx.recordFile.sha,
    policy_sha: ctx.registrationFile.sha,
    engine_sha: RUNNER_ENGINE_SHA,
    eligible: scan.eligible,
    retained,
    deleted
  };
}
