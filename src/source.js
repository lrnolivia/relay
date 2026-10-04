import { createSign } from "node:crypto";

const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const TOKEN_CACHE = new Map();

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function normalizePrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function appConfigured(env) {
  return Boolean(env?.RELAY_GITHUB_APP_ID && env?.RELAY_GITHUB_APP_PRIVATE_KEY);
}

function legacyTokenConfigured(env) {
  return Boolean(env?.RELAY_GITHUB_TOKEN);
}

export function sourceAuthStatus(env) {
  const app = appConfigured(env);
  const legacy = legacyTokenConfigured(env);
  return {
    ok: true,
    namespace: "relay.SOURCE",
    auth_mode: app ? "github_app" : legacy ? "legacy_token" : "public_read",
    app_configured: app,
    legacy_token_configured: legacy,
    write_enabled: app || legacy,
    required_app_bindings: app ? [] : ["RELAY_GITHUB_APP_ID", "RELAY_GITHUB_APP_PRIVATE_KEY"]
  };
}

function createAppJwt(env) {
  if (!appConfigured(env)) throw new Error("relay.SOURCE GitHub App credentials are not configured");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iat: now - 60,
    exp: now + 540,
    iss: String(env.RELAY_GITHUB_APP_ID)
  }));
  const input = header + "." + payload;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  signer.end();
  const signature = signer.sign(normalizePrivateKey(env.RELAY_GITHUB_APP_PRIVATE_KEY)).toString("base64url");
  return input + "." + signature;
}

async function requestGitHub(path, token, options = {}, context = {}) {
  if (typeof path !== "string" || !path.startsWith("/") || path.includes("://")) throw new Error("Invalid GitHub API path");
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "relay-by-loew-fi"
  };
  if (token) headers.Authorization = "Bearer " + token;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const github = { provider: 'github', method: options.method || 'GET', endpoint: path.split('?')[0].slice(0, 500),
    phase: context.phase || 'resource_request', auth_mode: context.auth_mode || (token ? 'authenticated' : 'public_read') };
  let response, text;
  try {
    response = await fetch(GITHUB_API + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(10000)
    });
    text = await response.text();
  } catch (error) {
    error.github = github;
    throw error;
  }
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = { message: text.slice(0, 1000) }; }
  }
  if (!response.ok) {
    const error = new Error(body?.message || ("GitHub request failed with " + response.status));
    error.status = response.status;
    error.github = { ...github, status: response.status };
    for (const [header, field] of [['x-ratelimit-remaining', 'rate_limit_remaining'], ['x-ratelimit-reset', 'rate_limit_reset'], ['retry-after', 'retry_after_seconds']]) {
      const value = response.headers.get(header);
      if (/^\d{1,10}$/.test(value || '')) error.github[field] = Number(value);
    }
    if (response.status === 429 || (response.status === 403 && error.github.rate_limit_remaining === 0)) error.code = 'rate_limit';
    throw error;
  }
  return body;
}

function repositoryFromPath(path) {
  const match = String(path).match(/^\/repos\/([^/]+)\/([^/?]+)/);
  if (!match) return null;
  return { owner: decodeURIComponent(match[1]), repo: decodeURIComponent(match[2]) };
}

async function installationToken(env, owner, repo) {
  const cacheKey = owner.toLowerCase() + "/" + repo.toLowerCase();
  const cached = TOKEN_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

  const jwt = createAppJwt(env);
  const installation = await requestGitHub(
    "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/installation",
    jwt, {}, { phase: 'installation_discovery', auth_mode: 'github_app_jwt' }
  );
  if (!installation?.id) throw new Error("Relay GitHub App is not installed on " + owner + "/" + repo);
  const created = await requestGitHub(
    "/app/installations/" + installation.id + "/access_tokens",
    jwt,
    { method: "POST", body: {} }, { phase: 'token_mint', auth_mode: 'github_app_jwt' }
  );
  if (!created?.token) throw new Error("GitHub App installation token was not returned");
  const expiresAt = created.expires_at ? Date.parse(created.expires_at) : Date.now() + 50 * 60 * 1000;
  TOKEN_CACHE.set(cacheKey, { token: created.token, expiresAt });
  return created.token;
}

export async function githubApiRequest(env, path, options = {}) {
  const method = options.method || "GET";
  const write = !["GET", "HEAD"].includes(method);
  const repo = repositoryFromPath(path);

  if (appConfigured(env) && repo) {
    let token;
    try {
      token = await installationToken(env, repo.owner, repo.repo);
    } catch (error) {
      // Public discovery remains available for an uninstalled repository.
      // Acquisition failure can never establish absence for a guarded lookup.
      if (write || options.requireAuthenticated || error?.status !== 404 || error.github?.phase !== 'installation_discovery') throw error;
    }
    // Once selected, preserve this authenticated identity and its response.
    // A missing resource is not an invitation to ask another identity.
    if (token) return requestGitHub(path, token, options, { auth_mode: 'github_app_installation' });
  }

  if (legacyTokenConfigured(env)) return requestGitHub(path, env.RELAY_GITHUB_TOKEN, options, { auth_mode: 'legacy_token' });
  if (options.requireAuthenticated) throw Object.assign(new Error('Authenticated GitHub transport is required for this lookup'), {
    code: 'auth', github: { provider: 'github', method, endpoint: path.split('?')[0].slice(0, 500), phase: 'auth_selection', auth_mode: 'none' }
  });
  if (write) throw new Error("relay.SOURCE writes require a Relay GitHub App installation");
  return requestGitHub(path, null, options);
}

export async function githubGraphqlRequest(env, owner, repo, query, variables = {}) {
  let token = null;
  if (appConfigured(env)) {
    token = await installationToken(env, owner, repo);
  } else if (legacyTokenConfigured(env)) {
    token = env.RELAY_GITHUB_TOKEN;
  } else {
    throw new Error("relay.SOURCE writes require a Relay GitHub App installation");
  }

  const result = await requestGitHub("/graphql", token, {
    method: "POST",
    body: { query, variables }
  });
  if (Array.isArray(result?.errors) && result.errors.length) {
    throw new Error(result.errors[0]?.message || "GitHub GraphQL request failed");
  }
  return result?.data || {};
}

export async function commitSourceFiles(env, { owner, repo, branch, files, message, expectedHeadSha }) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 20) {
    throw new Error("relay.SOURCE commits require 1-20 files");
  }
  if (typeof message !== "string" || message.length < 1 || message.length > 500) throw new Error("Invalid commit message");

  let aggregate = 0;
  const normalized = files.map((file) => {
    if (!file || typeof file.path !== "string" || !file.path || file.path.includes("..") || file.path.startsWith("/")) {
      throw new Error("Invalid repository path");
    }
    if (typeof file.content !== "string") throw new Error("File content must be UTF-8 text");
    aggregate += file.content.length;
    if (file.content.length > 500000 || aggregate > 1000000) throw new Error("relay.SOURCE commit payload is too large");
    return { path: file.path, content: file.content };
  });

  const repoBase = "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
  const repository = await githubApiRequest(env, repoBase);
  if (branch === repository?.default_branch) throw new Error("relay.SOURCE refuses direct default-branch commits; coordination control state must be mutated through relay.RUNNER");

  const encodedBranch = branch.split("/").map(encodeURIComponent).join("/");
  const ref = await githubApiRequest(env, repoBase + "/git/ref/heads/" + encodedBranch);
  const headSha = ref?.object?.sha;
  if (!headSha) throw new Error("Unable to resolve branch head");
  if (expectedHeadSha && expectedHeadSha !== headSha) throw new Error("Branch head changed; refresh before committing");

  const parent = await githubApiRequest(env, repoBase + "/git/commits/" + headSha);
  const treeCache = new Map();
  async function entries(sha) {
    if (!treeCache.has(sha)) {
      treeCache.set(sha, githubApiRequest(env, repoBase + "/git/trees/" + sha).then(tree => {
        if (tree.truncated || !Array.isArray(tree.tree)) throw new Error("Cannot preserve modes from an incomplete source tree");
        return tree.tree;
      }));
    }
    return treeCache.get(sha);
  }
  async function existingMode(path) {
    const parts = path.split("/");
    if (parts.some(part => !part || part === ".")) throw new Error("Invalid repository path");
    let treeSha = parent?.tree?.sha;
    if (!treeSha) throw new Error("Missing parent source tree");
    for (let index = 0; index < parts.length; index++) {
      const entry = (await entries(treeSha)).find(item => item.path === parts[index]);
      if (!entry) return "100644";
      if (index < parts.length - 1) {
        if (entry.type !== "tree") throw new Error("Source path parent is not a directory");
        treeSha = entry.sha;
      } else {
        if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode)) throw new Error("Text batches cannot replace symlinks or submodules");
        return entry.mode;
      }
    }
  }
  // Validate every path before creating blobs; retain executable entrypoints.
  const modes = await Promise.all(normalized.map(file => existingMode(file.path)));
  const blobs = [];
  for (const [index, file] of normalized.entries()) {
    const blob = await githubApiRequest(env, repoBase + "/git/blobs", {
      method: "POST",
      body: { content: file.content, encoding: "utf-8" }
    });
    blobs.push({ path: file.path, mode: modes[index], type: "blob", sha: blob.sha });
  }

  const tree = await githubApiRequest(env, repoBase + "/git/trees", {
    method: "POST",
    body: { base_tree: parent?.tree?.sha, tree: blobs }
  });
  const commit = await githubApiRequest(env, repoBase + "/git/commits", {
    method: "POST",
    body: { message, tree: tree.sha, parents: [headSha] }
  });
  await githubApiRequest(env, repoBase + "/git/refs/heads/" + encodedBranch, {
    method: "PATCH",
    body: { sha: commit.sha, force: false }
  });

  return {
    ok: true,
    repository: owner + "/" + repo,
    branch,
    previous_head_sha: headSha,
    commit_sha: commit.sha,
    files: normalized.map((file) => file.path)
  };
}

export async function readSourceChecks(env, owner, repo, ref, api = path => githubApiRequest(env, path)) {
  const root = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const checks = await api(`${root}/commits/${encodeURIComponent(ref)}/check-runs`);
  const failed = (checks.check_runs || []).filter(run => ["failure", "timed_out", "action_required"].includes(run.conclusion));
  const details = new Map();
  for (const run of failed.slice(0, 5)) {
    if (!Number.isSafeInteger(run.id) || run.id < 1) continue;
    try {
      const rows = await api(`${root}/check-runs/${run.id}/annotations?per_page=50`);
      if (!Array.isArray(rows)) throw new Error("Invalid annotation response");
      details.set(run.id, { available: true, truncated: (run.output?.annotations_count || 0) > rows.length, annotations: rows.slice(0, 50).map(row => ({
        path: String(row.path || "").slice(0, 1024),
        start_line: row.start_line, end_line: row.end_line,
        annotation_level: row.annotation_level,
        title: String(row.title || "").slice(0, 1024),
        message: String(row.message || "").slice(0, 8000)
      })) });
    } catch {
      details.set(run.id, { available: false, annotations: [], reason: "Failure annotations unavailable" });
    }
  }
  return { ...checks, check_runs: (checks.check_runs || []).map(run => details.has(run.id) ? {...run, failure_details: details.get(run.id)} : run),
    failure_details_truncated: failed.length > 5 };
}
