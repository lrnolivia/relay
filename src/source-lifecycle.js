import { githubApiRequest, githubGraphqlRequest, sourceAuthStatus } from "./source.js";
import { assertExistingGitHubIdentity, assertGitHubCommit, PROJECT_AUTHOR, stripToolCoauthors, verifyAttributedCommit } from './commit-attribution.js';

const SHA = /^[a-f0-9]{40}$/i;
const OWNER = "lrnolivia";
const GOOD = new Set(["success", "neutral", "skipped"]);

function ident(v, label) {
  if (typeof v !== "string" || v.length < 1 || v.length > 128 || !/^[A-Za-z0-9._-]+$/.test(v)) throw new Error(`Invalid ${label}`);
  return v;
}
function branch(v, label = "branch") {
  if (typeof v !== "string" || v.length < 1 || v.length > 240 || !/^[A-Za-z0-9._\/-]+$/.test(v) ||
      v.includes("..") || v.startsWith("/") || v.endsWith("/") || v.endsWith(".lock")) throw new Error(`Invalid ${label}`);
  return v;
}
function commit(v, label = "commit SHA") {
  if (typeof v !== "string" || !SHA.test(v)) throw new Error(`Invalid ${label}`);
  return v.toLowerCase();
}
function owner(env, requested) {
  const configured = ident(String(env?.RELAY_GITHUB_OWNER || OWNER), "configured GitHub owner");
  if (requested && String(requested).toLowerCase() !== configured.toLowerCase()) throw new Error(`relay.SOURCE is restricted to GitHub owner ${configured}`);
  return configured;
}
const root = (o, r) => `/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`;
const refName = v => String(v).split("/").map(encodeURIComponent).join("/");

async function pages(env, request, path, max = 10) {
  const items = [];
  for (let page = 1; page <= max; page += 1) {
    const join = path.includes("?") ? "&" : "?";
    const part = await request(env, `${path}${join}per_page=100&page=${page}`);
    if (!Array.isArray(part)) throw new Error("GitHub pagination returned an invalid payload");
    items.push(...part);
    if (part.length < 100) return { items, truncated: false };
  }
  return { items, truncated: true };
}

// Read-only workflow discovery uses the same repository installation and exact
// default-branch commit as the inventory. No token or permission changes.
export async function workflowInventory(env, request, base, headSha) {
  try {
    const entries = await request(env, `${base}/contents/.github/workflows?ref=${headSha}`);
    if (!Array.isArray(entries)) throw new Error("Invalid workflow directory response");
    const files = [];
    for (const entry of entries.slice(0, 200)) {
      if (entry?.type !== "file" || !/\.ya?ml$/i.test(entry.name || "")) continue;
      if (!/^[A-Za-z0-9._-]+\.ya?ml$/i.test(entry.name) || entry.path !== `.github/workflows/${entry.name}` || !SHA.test(entry.sha || "")) throw new Error("Invalid workflow file identity");
      files.push({path:entry.path, blob_sha:entry.sha.toLowerCase(), size_bytes:Number.isSafeInteger(entry.size) ? entry.size : null});
    }
    return {status:"available", ref:headSha, files, truncated:entries.length >= 200};
  } catch (error) {
    if (error?.status === 404) return {status:"absent", ref:headSha, files:[], truncated:false};
    return {status:"unavailable", ref:headSha, files:[], truncated:false, error_class:error?.status === 403 ? "access_denied" : error?.status === 429 ? "rate_limited" : "provider_error"};
  }
}

export async function sourceInventory(env, args, request = githubApiRequest) {
  const o = owner(env, args.owner), repo = ident(args.repo, "repository"), base = root(o, repo);
  const meta = await request(env, base);
  const defaultBranch = branch(meta?.default_branch, "default branch");
  const head = await request(env, `${base}/git/ref/heads/${refName(defaultBranch)}`);
  const branches = await pages(env, request, base + "/branches");
  const pulls = await pages(env, request, base + "/pulls?state=open");
  const defaultHead = commit(head?.object?.sha, "default branch SHA");
  const workflows = await workflowInventory(env, request, base, defaultHead);
  return {
    ok: true, repository: `${o}/${repo}`, default_branch: defaultBranch,
    default_head_sha: defaultHead, workflows,
    branches: branches.items.map(x => ({ name: x?.name || null, head_sha: x?.commit?.sha || null, protected: Boolean(x?.protected) })),
    open_pull_requests: pulls.items.map(x => ({
      number: x?.number || null, title: x?.title || "", draft: Boolean(x?.draft),
      head_ref: x?.head?.ref || null, head_sha: x?.head?.sha || null,
      base_ref: x?.base?.ref || null, state: x?.state || null
    })),
    truncated: { branches: branches.truncated, pull_requests: pulls.truncated }
  };
}

async function resolveBase(env, base, value, request) {
  const requested = String(value || "main");
  if (SHA.test(requested)) {
    const exact = commit(requested, "base commit SHA");
    const found = await request(env, `${base}/git/commits/${exact}`);
    return { requested, sha: commit(found?.sha, "resolved base commit SHA") };
  }
  const named = branch(requested, "base branch");
  const found = await request(env, `${base}/git/ref/heads/${refName(named)}`);
  return { requested: named, sha: commit(found?.object?.sha, "resolved base branch SHA") };
}

export async function createSourceBranch(env, args, request = githubApiRequest) {
  const o = owner(env, args.owner), repo = ident(args.repo, "repository"), name = branch(args.branch), base = root(o, repo);
  const from = await resolveBase(env, base, args.base, request);
  let created = null, writeError = null;
  try {
    created = await request(env, base + "/git/refs", { method: "POST", body: { ref: `refs/heads/${name}`, sha: from.sha } });
  } catch (error) { writeError = error; }
  let verified;
  try { verified = await request(env, `${base}/git/ref/heads/${refName(name)}`); }
  catch { if (writeError) throw writeError; throw new Error("Branch creation outcome cannot be verified"); }
  const actual = commit(verified?.object?.sha, "created branch SHA");
  if (actual !== from.sha) throw new Error("Created branch head differs from requested base; reconcile before retry");
  return {
    ok: true, repository: `${o}/${repo}`, base: from.requested, base_sha: from.sha,
    branch: created || verified, head_sha: actual, reconciled_after_transport_error: Boolean(writeError)
  };
}

async function exactPull(env, base, number, expected, request) {
  const pr = await request(env, `${base}/pulls/${number}`);
  if (String(pr?.head?.sha || "").toLowerCase() !== expected) throw new Error("Pull request head changed; refresh before acting");
  if (pr?.state !== "open") throw new Error("Pull request is not open");
  return pr;
}

async function green(env, base, expected, request) {
  const checks = await request(env, `${base}/commits/${expected}/check-runs?per_page=100`);
  const runs = Array.isArray(checks?.check_runs) ? checks.check_runs : [];
  if (Number(checks?.total_count || 0) > runs.length) throw new Error("Check inventory exceeds Relay's bounded merge limit");
  const bad = runs.find(x => x?.status !== "completed" || !GOOD.has(x?.conclusion));
  if (bad) throw new Error(`Pull request head checks are not green: ${bad.name || "unnamed check"}`);
  const statuses = await pages(env, request, `${base}/statuses/${expected}`);
  if (statuses.truncated) throw new Error("Commit status inventory exceeds Relay's bounded merge limit");
  const latest = new Map();
  for (const x of statuses.items) if (x?.context && !latest.has(x.context)) latest.set(x.context, x);
  for (const x of latest.values()) if (x?.state !== "success") throw new Error(`Pull request head status is not green: ${x.context}`);
  return { check_runs: runs.length, status_contexts: latest.size };
}

export async function sourcePullRequestAction(env, args, request = githubApiRequest, graphql = githubGraphqlRequest) {
  const o = owner(env, args.owner), repo = ident(args.repo, "repository"), number = Number(args.number);
  if (!Number.isInteger(number) || number < 1 || number > 1000000) throw new Error("Invalid pull request number");
  if (!["update", "ready", "merge"].includes(args.action)) throw new Error("Unsupported pull request action");
  const expected = commit(args.expected_head_sha, "expected pull request head SHA"), base = root(o, repo);
  const pr = await exactPull(env, base, number, expected, request);

  if (args.action === "update") {
    const patch = {};
    if (args.title !== undefined) {
      if (typeof args.title !== "string" || args.title.length < 1 || args.title.length > 256) throw new Error("Invalid pull request title");
      patch.title = args.title;
    }
    if (args.body !== undefined) {
      if (typeof args.body !== "string" || args.body.length > 200000) throw new Error("Invalid pull request body");
      patch.body = args.body;
    }
    if (args.base !== undefined) patch.base = branch(args.base, "base branch");
    if (!Object.keys(patch).length) throw new Error("No pull request metadata update was requested");
    let writeError = null;
    try { await request(env, `${base}/pulls/${number}`, { method: "PATCH", body: patch }); }
    catch (error) { writeError = error; }
    const got = await exactPull(env, base, number, expected, request);
    const match = (!("title" in patch) || got.title === patch.title) && (!("body" in patch) || got.body === patch.body) && (!("base" in patch) || got.base?.ref === patch.base);
    if (!match) { if (writeError) throw writeError; throw new Error("Pull request metadata readback differs from request"); }
    return { ok: true, repository: `${o}/${repo}`, number, action: args.action, head_sha: expected, reconciled_after_transport_error: Boolean(writeError), pull_request: got };
  }

  if (args.action === "ready") {
    if (!pr?.draft) return { ok: true, repository: `${o}/${repo}`, number, action: args.action, head_sha: expected, already_ready: true, pull_request: pr };
    if (!pr?.node_id) throw new Error("Pull request node identity is unavailable");
    let writeError = null;
    try {
      await graphql(env, o, repo, "mutation($pullRequestId:ID!){markPullRequestReadyForReview(input:{pullRequestId:$pullRequestId}){pullRequest{id number isDraft}}}", { pullRequestId: pr.node_id });
    } catch (error) { writeError = error; }
    const got = await exactPull(env, base, number, expected, request);
    if (got?.draft) { if (writeError) throw writeError; throw new Error("Pull request remains draft after ready mutation"); }
    return { ok: true, repository: `${o}/${repo}`, number, action: args.action, head_sha: expected, reconciled_after_transport_error: Boolean(writeError), pull_request: got };
  }

  const method = args.merge_method || "squash";
  if (!["merge", "squash", "rebase"].includes(method)) throw new Error("Invalid merge method");
  if (method === 'rebase') throw new Error('Rebase merge attribution route is unverified; use a reviewed merge or squash route');
  if (sourceAuthStatus(env).auth_mode !== 'legacy_token') throw new Error('App-authenticated merge is blocked: final Lauren attribution requires an existing verified human connection; no automatic identity fallback');
  const profile = await request(env, '/user', {requireAuthenticated: true});
  const witness = await request(env, `/repos/${PROJECT_AUTHOR.witness_repo}/commits/${PROJECT_AUTHOR.witness_sha}`, {requireAuthenticated: true});
  assertExistingGitHubIdentity(profile, witness);
  if (pr?.user?.login !== PROJECT_AUTHOR.login || Number(pr?.user?.id) !== PROJECT_AUTHOR.id) throw new Error('Final-author route requires a pull request created through Lauren\'s existing human connection; App-created pull requests cannot use this merge route');
  assertGitHubCommit(await request(env, `${base}/commits/${expected}`, {requireAuthenticated: true}), expected);
  const checks = await green(env, base, expected, request);
  const sourceCommits = await pages(env, request, `${base}/pulls/${number}/commits`);
  if (sourceCommits.truncated || !Number.isSafeInteger(pr.commits) || pr.commits < 1 || sourceCommits.items.length !== pr.commits || sourceCommits.items.at(-1)?.sha !== expected) throw new Error('Complete exact-head pull request commit inventory required before merge');
  const humanTrailers = new Set();
  const messages = [];
  for (const item of sourceCommits.items) {
    const preservedMessage = stripToolCoauthors(item?.commit?.message);
    messages.push(preservedMessage.trimEnd());
    for (const line of preservedMessage.split('\n')) {
      if (/^Co-authored-by\s*:/i.test(line)) humanTrailers.add(line);
    }
    const identity = item?.commit?.author;
    if (!identity?.name || !identity?.email || /[<>\r\n\0]/.test(identity.name) || /[<>\s\0]/.test(identity.email)) throw new Error('Source author identity unavailable for preserving human coauthors');
    const credit = `Co-authored-by: ${identity.name} <${identity.email}>`;
    if (identity.name !== PROJECT_AUTHOR.name || identity.email !== PROJECT_AUTHOR.email) {
      if (stripToolCoauthors(credit).trim() && item?.author?.type !== 'Bot') {
        if (item?.author?.type !== 'User') throw new Error('Unlinked source author requires review before preserving human authorship');
        humanTrailers.add(credit);
      }
    }
  }
  if (typeof pr.title !== 'string' || !pr.title.trim() || pr.title.length > 256 || /[\r\n\0]/.test(pr.title)) throw new Error('Exact pull request title unavailable for merge');
  const implicitCredits = [...humanTrailers].filter(line => !messages.some(message => message.split('\n').includes(line)));
  const commitMessage = stripToolCoauthors(`Merge pull request #${number}\n\n${messages.join('\n\n')}\n\n${implicitCredits.join('\n')}`);
  if (commitMessage.length > 200000) throw new Error('Complete preserved merge message exceeds the bounded request limit');
  let result = null, writeError = null;
  try { result = await request(env, `${base}/pulls/${number}/merge`, { method: "PUT", body: { sha: expected, merge_method: method, commit_title: pr.title, commit_message: commitMessage } }); }
  catch (error) { writeError = error; }
  const got = await request(env, `${base}/pulls/${number}`);
  if (String(got?.head?.sha || "").toLowerCase() !== expected || !got?.merged_at) {
    if (writeError) throw writeError;
    if (!result?.merged) throw new Error(result?.message || "GitHub did not merge the pull request");
    throw new Error("Merge outcome cannot be verified on the expected head");
  }
  const finalSha = commit(got?.merge_commit_sha, 'exact final merged commit SHA');
  if (result?.sha && result.sha !== finalSha) throw new Error('Merge receipt differs from the exact final commit; reconcile before retrying');
  const attribution = await verifyAttributedCommit((path, options) => request(env, path, options), base, finalSha);
  return {
    ok: true, repository: `${o}/${repo}`, number, action: args.action, head_sha: expected,
    merge_method: method, checks, merge: result, final_commit_sha: finalSha, attribution, reconciled_after_transport_error: Boolean(writeError), pull_request: got
  };
}

export async function callSourceLifecycleTool(name, args, env, request, graphql) {
  if (name === "relay_source_inventory") return sourceInventory(env, args, request);
  if (name === "relay_source_create_branch") return createSourceBranch(env, args, request);
  if (name === "relay_source_pull_request_action") return sourcePullRequestAction(env, args, request, graphql);
  return null;
}
