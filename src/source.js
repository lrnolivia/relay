import { createSign, createHash } from "node:crypto";
import { createGitHubReadCache } from './github-read-cache.js';

const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const TOKEN_CACHE = new Map();
const TOKEN_INFLIGHT = new Map();
const READ_CACHE = createGitHubReadCache();
const credentialScope = value => createHash('sha256').update(value).digest('hex');

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
    required_app_bindings: app ? [] : ["RELAY_GITHUB_APP_ID", "RELAY_GITHUB_APP_PRIVATE_KEY"],
    read_transport: READ_CACHE.metrics()
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
  const scope=context.scope||credentialScope(token||'public-read');
  try { return await READ_CACHE.request({scope,budget:context.budget||scope,resource:path==='/graphql'?'graphql':'core',path,
    method:options.method||'GET',mode:options.jobLog||options.body!==undefined?'none':options.readCache||'revalidate',onObservation:options.onReadObservation,
    execute:async etag=>{
  if(etag)headers['If-None-Match']=etag;
  let response, text;
  try {
    response = await fetch(GITHUB_API + path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(10000)
    });
    if (options.jobLog === true && response.ok) {
      if (!/^\/repos\/[^/]+\/[^/]+\/actions\/jobs\/\d+\/logs$/.test(path)) throw new Error("Job log route required");
      return {status:response.status,value:await readBoundedJobLog(response)};
    }
    text = options.maxResponseBytes === undefined ? await response.text() : await boundedSourceText(response, options.maxResponseBytes);
  } catch (error) {
    error.github = github;
    throw error;
  }
  let body = null;
  const quota={auth_mode:github.auth_mode,...(Number.isSafeInteger(context.installation_id)?{installation_id:context.installation_id}:{})};
  for(const [header,field]of [['x-ratelimit-limit','rate_limit_limit'],['x-ratelimit-used','rate_limit_used'],['x-ratelimit-remaining','rate_limit_remaining'],['x-ratelimit-reset','rate_limit_reset'],['retry-after','retry_after_seconds']]){
    const value=response.headers.get(header);if(/^\d{1,10}$/.test(value||''))quota[field]=Number(value);
  }
  const resource=response.headers.get('x-ratelimit-resource');if(/^[a-z_]{1,40}$/.test(resource||''))quota.rate_limit_resource=resource;
  const cacheable=!/\bno-store\b/i.test(response.headers.get('cache-control')||'');
  if(response.status===304)return {status:304,etag:response.headers.get('etag'),quota,cacheable};
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = { message: text.slice(0, 1000) }; }
  }
  if (!response.ok) {
    const error = new Error(body?.message || ("GitHub request failed with " + response.status));
    error.status = response.status;
    error.github = { ...github, status: response.status, ...quota };
    if (response.status === 429 || (response.status === 403 && (quota.rate_limit_remaining === 0 || quota.retry_after_seconds !== undefined || /secondary rate limit|API rate limit exceeded/i.test(body?.message||'')))) error.code = 'rate_limit';
    throw error;
  }
  return {status:response.status,value:body,etag:response.headers.get('etag'),quota,cacheable};
    }
  }); }catch(error){error.github={...github,...error.github};throw error;}
}

function repositoryFromPath(path) {
  const match = String(path).match(/^\/repos\/([^/]+)\/([^/?]+)/);
  if (!match) return null;
  return { owner: decodeURIComponent(match[1]), repo: decodeURIComponent(match[2]) };
}

async function installationToken(env, owner, repo, onReadObservation) {
  const appScope=credentialScope(String(env.RELAY_GITHUB_APP_ID)+'\0'+normalizePrivateKey(env.RELAY_GITHUB_APP_PRIVATE_KEY));
  const cacheKey = appScope+'\0'+owner.toLowerCase() + "/" + repo.toLowerCase();
  const cached = TOKEN_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached;
  if(TOKEN_INFLIGHT.has(cacheKey))return TOKEN_INFLIGHT.get(cacheKey);
  const pending=(async()=>{

  const jwt = createAppJwt(env);
  const installation = await requestGitHub(
    "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/installation",
    jwt, {onReadObservation}, { phase: 'installation_discovery', auth_mode: 'github_app_jwt',scope:'jwt:'+appScope }
  );
  if (!installation?.id) throw new Error("Relay GitHub App is not installed on " + owner + "/" + repo);
  const created = await requestGitHub(
    "/app/installations/" + installation.id + "/access_tokens",
    jwt,
    { method: "POST", body: {}, onReadObservation }, { phase: 'token_mint', auth_mode: 'github_app_jwt',scope:'jwt:'+appScope }
  );
  if (!created?.token) throw new Error("GitHub App installation token was not returned");
  const expiresAt = created.expires_at ? Date.parse(created.expires_at) : Date.now() + 50 * 60 * 1000;
  const result={token:created.token,expiresAt,installation_id:installation.id,scope:'installation:'+installation.id+':'+appScope,budget:'installation:'+installation.id+':'+String(env.RELAY_GITHUB_APP_ID)};
  TOKEN_CACHE.set(cacheKey,result);return result;
  })();
  TOKEN_INFLIGHT.set(cacheKey,pending);
  try{return await pending;}finally{if(TOKEN_INFLIGHT.get(cacheKey)===pending)TOKEN_INFLIGHT.delete(cacheKey);}
}

export async function githubApiRequest(env, path, options = {}) {
  const method = options.method || "GET";
  const write = !["GET", "HEAD"].includes(method);
  const repo = repositoryFromPath(path);

  if (appConfigured(env) && repo) {
    let token;
    try {
      token = await installationToken(env, repo.owner, repo.repo, options.onReadObservation);
    } catch (error) {
      // Public discovery remains available for an uninstalled repository.
      // Acquisition failure can never establish absence for a guarded lookup.
      if (write || options.requireAuthenticated || error?.status !== 404 || error.github?.phase !== 'installation_discovery') throw error;
    }
    // Once selected, preserve this authenticated identity and its response.
    // A missing resource is not an invitation to ask another identity.
    if (token) return requestGitHub(path, token.token, options, { auth_mode: 'github_app_installation',scope:token.scope,budget:token.budget,installation_id:token.installation_id });
  }

  if (legacyTokenConfigured(env)) return requestGitHub(path, env.RELAY_GITHUB_TOKEN, options, { auth_mode: 'legacy_token' });
  if (options.requireAuthenticated) throw Object.assign(new Error('Authenticated GitHub transport is required for this lookup'), {
    code: 'auth', github: { provider: 'github', method, endpoint: path.split('?')[0].slice(0, 500), phase: 'auth_selection', auth_mode: 'none' }
  });
  if (write) throw new Error("relay.SOURCE writes require a Relay GitHub App installation");
  return requestGitHub(path, null, options);
}

export async function githubGraphqlRequest(env, owner, repo, query, variables = {}) {
  let token = null,context={};
  if (appConfigured(env)) {
    const installation=await installationToken(env, owner, repo);token=installation.token;context={auth_mode:'github_app_installation',scope:installation.scope,budget:installation.budget,installation_id:installation.installation_id};
  } else if (legacyTokenConfigured(env)) {
    token = env.RELAY_GITHUB_TOKEN;
  } else {
    throw new Error("relay.SOURCE writes require a Relay GitHub App installation");
  }

  const result = await requestGitHub("/graphql", token, {
    method: "POST",
    body: { query, variables }
  },context);
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

export async function readSourceChecks(env, owner, repo, ref, api = (path, options) => githubApiRequest(env, path, options)) {
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

  for (const run of failed.slice(0, 2)) {
    let url;
    try { url = new URL(run.html_url); } catch { continue; }
    const prefix = `/${owner}/${repo}/actions/runs/`;
    if (url.origin !== "https://github.com" || !url.pathname.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const match = url.pathname.slice(prefix.length).match(/^\d+\/job\/(\d+)$/);
    if (!match) continue;
    const detail = details.get(run.id) || {available:false,annotations:[]};
    try {
      const job = await api(`${root}/actions/jobs/${match[1]}`);
      detail.job = {id:job.id,name:job.name,conclusion:job.conclusion,steps:(job.steps||[]).slice(0,100).map(step=>({name:step.name,status:step.status,conclusion:step.conclusion}))};
      detail.log = await api(`${root}/actions/jobs/${match[1]}/logs`, {jobLog:true});
    } catch { detail.job_diagnostics_unavailable = true; }
    details.set(run.id,detail);
  }
  return { ...checks, check_runs: (checks.check_runs || []).map(run => details.has(run.id) ? {...run, failure_details: details.get(run.id)} : run),
    failure_details_truncated: failed.length > 5 };
}

export async function readBoundedJobLog(response) {
  const reader=response.body?.getReader();
  if(!reader)return {excerpt:"",available:false,truncated:false};
  const decoder=new TextDecoder();
  let text="",bytes=0,truncated=false;
  try {
    while(true){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;
      if(bytes>4*1024*1024){truncated=true;await reader.cancel();break;}
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
  } finally {reader.releaseLock();}
  const lines=text.split("\n"), indexes=new Set();
  for(let i=lines.length-1;i>=0;i--)if(/error|failed|failure|traceback|exception|no such|not found|permission denied|syntax|unrecognized|cannot|exit code/i.test(lines[i])){
    for(let j=Math.max(0,i-3);j<=Math.min(lines.length-1,i+4);j++)indexes.add(j);
    if(indexes.size>=120)break;
  }
  const excerpt=(indexes.size?[...indexes].sort((a,b)=>a-b).map(i=>lines[i]).join("\n"):lines.slice(-80).join("\n")).slice(0,24000);
  return {available:true,excerpt,read_bytes:bytes,truncated:truncated||excerpt.length===24000,scope:"bounded latest failure-context excerpt; not the full log"};
}

export async function syncIdenticalSourceBranch(env, {owner,repo,branch,expectedHeadSha,expectedBaseSha}, api=(path,options)=>githubApiRequest(env,path,options)) {
  if(!/^[a-f0-9]{40}$/.test(expectedHeadSha||"") || !/^[a-f0-9]{40}$/.test(expectedBaseSha||""))throw new Error("Exact source and base identities required");
  const root=`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const metadata=await api(root);
  if(!metadata.default_branch || branch===metadata.default_branch)throw new Error("Default branch synchronization is prohibited");
  const branchPath=branch.split("/").map(encodeURIComponent).join("/");
  const basePath=metadata.default_branch.split("/").map(encodeURIComponent).join("/");
  const head=await api(`${root}/git/ref/heads/${branchPath}`),base=await api(`${root}/git/ref/heads/${basePath}`);
  if(head.object?.sha!==expectedHeadSha || base.object?.sha!==expectedBaseSha)throw new Error("Branch identity changed; refresh before synchronization");
  if(expectedHeadSha===expectedBaseSha)return {ok:true,unchanged:true,head_sha:expectedHeadSha};
  const a=await api(`${root}/git/commits/${expectedHeadSha}`),b=await api(`${root}/git/commits/${expectedBaseSha}`);
  if(!/^[a-f0-9]{40}$/.test(a.tree?.sha||"") || a.tree.sha!==b.tree?.sha)throw new Error("Trees differ; source changes require explicit resolution before synchronization");
  const commit=await api(`${root}/git/commits`,{method:"POST",body:{message:"Synchronize identical reviewed source with default-branch ancestry",tree:a.tree.sha,parents:[expectedHeadSha,expectedBaseSha]}});
  if(!/^[a-f0-9]{40}$/.test(commit.sha||""))throw new Error("Invalid synchronization commit receipt");
  const current=await api(`${root}/git/ref/heads/${branchPath}`);
  if(current.object?.sha!==expectedHeadSha)throw new Error("Branch changed before synchronization; no ref update performed");
  await api(`${root}/git/refs/heads/${branchPath}`,{method:"PATCH",body:{sha:commit.sha,force:false}});
  const verified=await api(`${root}/git/ref/heads/${branchPath}`);
  if(verified.object?.sha!==commit.sha)throw new Error("Synchronization readback did not match; inspect before retrying");
  return {ok:true,repository:`${owner}/${repo}`,branch,previous_head_sha:expectedHeadSha,base_sha:expectedBaseSha,head_sha:commit.sha,tree_sha:a.tree.sha,files_changed:false};
}

export const SOURCE_TREE_LIMITS = Object.freeze({ response_bytes: 4 * 1024 * 1024, entries: 20000, page_entries: 500, page_bytes: 128 * 1024 });
const treeFailure = (message, code = 'validation') => Object.assign(new Error(message), { code });
async function boundedSourceText(response, limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SOURCE_TREE_LIMITS.response_bytes) throw treeFailure('Invalid source response limit');
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw treeFailure('Source manifest response exceeds the bounded read limit; completeness is unverified', 'capacity');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw treeFailure('Source manifest response exceeds the bounded read limit; completeness is unverified', 'capacity'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

// This is a metadata manifest, never a source-byte checkpoint or an auth grant.
// Pagination is Relay-owned; GitHub's recursive tree response has no page API.
export async function readSourceTree(env, args, api = (path, options) => githubApiRequest(env, path, options)) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !['owner','repo','commitSha','cursor','limit'].includes(key))) throw treeFailure('Unsupported source tree arguments');
  const { owner, repo, commitSha } = args, limit = args.limit === undefined ? 200 : args.limit;
  for (const value of [owner, repo]) if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(value) || ['.','..'].includes(value)) throw treeFailure('Invalid source repository identity');
  if (!/^[a-f0-9]{40}$/.test(commitSha || '')) throw treeFailure('Source tree requires an exact lowercase 40-character commit SHA');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SOURCE_TREE_LIMITS.page_entries) throw treeFailure('Source tree page limit must be between 1 and 500');
  const repository = `${owner}/${repo}`;
  let cursor = null;
  if (args.cursor !== undefined) {
    if (typeof args.cursor !== 'string' || args.cursor.length > 1200 || !/^[A-Za-z0-9_-]+$/.test(args.cursor)) throw treeFailure('Invalid source tree cursor');
    try {
      const decoded = Buffer.from(args.cursor, 'base64url');
      if (decoded.toString('base64url') !== args.cursor) throw Error();
      cursor = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded));
      if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor) || Object.keys(cursor).sort().join(',') !== 'commit_sha,manifest_sha256,offset,repository,tree_sha,v' || cursor.v !== 1 || cursor.repository !== repository || cursor.commit_sha !== commitSha || !/^[a-f0-9]{40}$/.test(cursor.tree_sha || '') || !/^[a-f0-9]{64}$/.test(cursor.manifest_sha256 || '') || !Number.isSafeInteger(cursor.offset) || cursor.offset < 1) throw Error();
    } catch { throw treeFailure('Source tree cursor does not match this exact repository and commit'); }
  }
  const root = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const readOptions = { requireAuthenticated: true, maxResponseBytes: SOURCE_TREE_LIMITS.response_bytes };
  const commit = await api(`${root}/git/commits/${commitSha}`, readOptions);
  if (commit?.sha !== commitSha || !/^[a-f0-9]{40}$/.test(commit?.tree?.sha || '')) throw treeFailure('Commit identity could not be verified', 'provider');
  const treeSha = commit.tree.sha;
  const tree = await api(`${root}/git/trees/${treeSha}?recursive=1`, readOptions);
  if (tree?.sha !== treeSha || typeof tree.truncated !== 'boolean' || !Array.isArray(tree.tree)) throw treeFailure('Source tree identity or completeness could not be verified', 'provider');
  if (tree.tree.length > SOURCE_TREE_LIMITS.entries || Buffer.byteLength(JSON.stringify(tree)) > SOURCE_TREE_LIMITS.response_bytes) throw treeFailure('Source tree exceeds bounded manifest limits; completeness is unverified', 'capacity');
  const modes = { '100644': 'blob', '100755': 'blob', '120000': 'blob', '040000': 'tree', '160000': 'commit' };
  const seen = new Set();
  const entries = tree.tree.map(entry => {
    const path = entry?.path;
    if (typeof path !== 'string' || !path || path.length > 4096 || path.includes('\0') || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..') || seen.has(path) || !Object.hasOwn(modes, entry?.mode) || modes[entry.mode] !== entry.type || !/^[a-f0-9]{40}$/.test(entry.sha || '')) throw treeFailure('Source tree contains an invalid or duplicate entry; completeness is unverified', 'provider');
    seen.add(path);
    return { path, mode: entry.mode, type: entry.type, sha: entry.sha };
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const digest = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  if (cursor && (cursor.tree_sha !== treeSha || cursor.manifest_sha256 !== digest || cursor.offset >= entries.length)) throw treeFailure('Source tree cursor does not match this exact manifest');
  const offset = cursor?.offset || 0, page = []; let bytes = 2;
  for (let index = offset; index < entries.length && page.length < limit; index++) {
    const size = Buffer.byteLength(JSON.stringify(entries[index])) + 1;
    if (bytes + size > SOURCE_TREE_LIMITS.page_bytes) break;
    page.push(entries[index]); bytes += size;
  }
  const nextOffset = offset + page.length;
  const next = nextOffset < entries.length ? base64url(JSON.stringify({ v: 1, repository, commit_sha: commitSha, tree_sha: treeSha, manifest_sha256: digest, offset: nextOffset })) : null;
  return { ok: true, repository, commit_sha: commitSha, tree_sha: treeSha, manifest_sha256: digest,
    digest_format: 'sha256-json-entries-v1', manifest_complete: !tree.truncated, truncated: tree.truncated,
    ...(tree.truncated ? { incomplete_reason: 'GitHub returned a truncated recursive tree; this is not a complete repository manifest.' } : {}),
    observed_entry_count: entries.length, page_offset: offset, returned_entry_count: page.length, next_cursor: next, entries: page,
    limits: SOURCE_TREE_LIMITS,
    recovery: 'Collect the entire cursor chain from offset 0 and verify count/digest before claiming a complete manifest. Paths and object IDs do not prove source bytes were restored. Symlinks and submodules are metadata only; never follow them implicitly.' };
}
