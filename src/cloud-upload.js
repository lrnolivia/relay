import { githubApiRequest } from "./source.js";
import { cloudflareApiRequest, cloudWriteScripts } from "./cloud.js";
import { guardRepository } from './autonomy-control.js';

const SHA = /^[a-f0-9]{40}$/;
const REPO = /^[A-Za-z0-9_.-]+$/;
const SCRIPT = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$/;
const MODULE_EXT = /\.(?:js|mjs)$/;
const MAX_MODULES = 64;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function sourceOwner(env) {
  const owner = String(env?.RELAY_GITHUB_OWNER || "lrnolivia");
  if (!REPO.test(owner)) throw new Error("Invalid configured GitHub owner");
  return owner;
}

function normalizeRepoPath(value, label = "path") {
  if (
    typeof value !== "string" ||
    !value ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").some(part => !part || part === "." || part === "..")
  ) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function joinRelative(from, relative) {
  if (!relative.startsWith("./") && !relative.startsWith("../")) throw new Error("Worker source imports must be relative");
  const parts = from.split("/");
  parts.pop();
  for (const part of relative.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) throw new Error("Worker import escapes repository root");
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  const path = parts.join("/");
  normalizeRepoPath(path, "module path");
  if (!MODULE_EXT.test(path)) throw new Error("Relative Worker imports must include .js or .mjs");
  return path;
}

function stripJsonComments(input) {
  let out = "", quote = null, escaped = false, line = false, block = false;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i], n = input[i + 1];
    if (line) {
      if (c === "\n") { line = false; out += c; }
      continue;
    }
    if (block) {
      if (c === "*" && n === "/") { block = false; i += 1; }
      continue;
    }
    if (quote) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; out += c; continue; }
    if (c === "/" && n === "/") { line = true; i += 1; continue; }
    if (c === "/" && n === "*") { block = true; i += 1; continue; }
    out += c;
  }
  if (quote || block) throw new Error("Invalid Wrangler JSONC");
  return out;
}

function parseWrangler(content, script) {
  let config;
  try { config = JSON.parse(stripJsonComments(content)); }
  catch { throw new Error("Wrangler config must be valid JSONC"); }
  if (config?.name !== script) throw new Error("Wrangler Worker name does not match requested script");
  const main = normalizeRepoPath(config?.main, "Wrangler main module");
  if (!MODULE_EXT.test(main)) throw new Error("Wrangler main module must be .js or .mjs");
  if (typeof config?.compatibility_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(config.compatibility_date)) {
    throw new Error("Wrangler compatibility_date is required");
  }
  const flags = config.compatibility_flags ?? [];
  if (!Array.isArray(flags) || flags.some(flag => typeof flag !== "string" || flag.length > 100)) {
    throw new Error("Invalid Wrangler compatibility_flags");
  }
  const vars = config.vars || {};
  const allowed = new Set(["CLOUDFLARE_ACCOUNT_ID", "RELAY_CLOUDFLARE_WRITE_SCRIPTS", "RELAY_RUNNER_CONTROL_REPOSITORY", "RELAY_CANONICAL_REPOSITORY", "RELAY_GITHUB_APP_ID"]);
  if (!vars || typeof vars !== "object" || Array.isArray(vars)) throw new Error("Invalid Wrangler vars");
  for (const [name, value] of Object.entries(vars)) {
    if (!allowed.has(name) || typeof value !== "string" || value.length > 2048) throw new Error("Unsupported non-secret Wrangler variable: " + name);
  }
  return { main, compatibility_date: config.compatibility_date, compatibility_flags: flags, vars };
}

function decodeFile(file, path) {
  if (file?.type !== "file" || file?.encoding !== "base64" || file?.truncated || typeof file?.content !== "string") {
    throw new Error(`GitHub source file is incomplete: ${path}`);
  }
  return Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
}

async function readSourceFile(github, owner, repo, path, commitSha) {
  const file = await github(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${commitSha}`
  );
  return decodeFile(file, path);
}

function relativeImports(source) {
  const found = new Set();
  const patterns = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["'](\.{1,2}\/[^"']+)["']/g,
    /import\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) found.add(match[1]);
  }
  return [...found];
}

async function moduleGraph(github, owner, repo, entry, commitSha) {
  const modules = new Map();
  let total = 0;
  async function visit(path) {
    if (modules.has(path)) return;
    if (modules.size >= MAX_MODULES) throw new Error("Worker module graph exceeds Relay's bounded module limit");
    const source = await readSourceFile(github, owner, repo, path, commitSha);
    total += Buffer.byteLength(source);
    if (total > MAX_TOTAL_BYTES) throw new Error("Worker module graph exceeds Relay's bounded byte limit");
    modules.set(path, source);
    for (const specifier of relativeImports(source)) await visit(joinRelative(path, specifier));
  }
  await visit(entry);
  return [...modules.entries()].map(([name, source]) => ({ name, source }));
}

function bindingNames(settings) {
  const names = [];
  for (const binding of Array.isArray(settings?.bindings) ? settings.bindings : []) {
    if (typeof binding?.name === "string" && /^[A-Z0-9_][A-Z0-9_-]{0,127}$/i.test(binding.name) && !names.includes(binding.name)) {
      names.push(binding.name);
    }
  }
  return names;
}

function versionItems(result) {
  return Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : [];
}

function exactVersion(result, commitSha) {
  return versionItems(result).find(version => version?.annotations?.["workers/commit_sha"] === commitSha) || null;
}

async function defaultRawUpload(env, path, metadata, modules, fetchImpl = fetch) {
  if (!env?.CLOUDFLARE_API_TOKEN) throw new Error("relay.CLOUD credentials are not configured");
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
  for (const module of modules) {
    form.append(module.name, new Blob([module.source], { type: "application/javascript+module" }), module.name);
  }
  const response = await fetchImpl("https://api.cloudflare.com/client/v4" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + env.CLOUDFLARE_API_TOKEN, Accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(15000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.errors?.[0]?.message || "Cloudflare Worker version upload failed");
    error.status = response.status;
    throw error;
  }
  return body?.result;
}

async function lookupVersion(cloud, path, commitSha) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = exactVersion(await cloud(path), commitSha);
    if (existing) return existing;
  }
  return null;
}

export const cloudUploadTool = {
  name: "relay_cloud_upload_version",
  title: "Recovery upload exact-source Worker version",
  description: "Recovery/diagnostic-only exact-source upload for allowlisted Workers. Normal web-family publication uses GitHub -> Cloudflare Workers Builds. Canonical Relay source upload is disabled; recover Relay with Workers Builds or known-good version rollback.",
  inputSchema: {
    type: "object",
    properties: {
      script: { type: "string", pattern: "^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$" },
      repo: { type: "string", pattern: "^[A-Za-z0-9_.-]+$" },
      commit_sha: { type: "string", pattern: "^[a-f0-9]{40}$" },
      purpose: { type: "string", enum: ["recovery", "diagnostic"] },
      message: { type: "string", maxLength: 1000 }
    },
    required: ["script", "repo", "commit_sha", "purpose"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

export function validateCloudUploadArguments(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object");
  for (const key of Object.keys(args)) if (!["script", "repo", "commit_sha", "purpose", "message"].includes(key)) throw new Error(`Unsupported argument: ${key}`);
  if (!SCRIPT.test(args.script || "")) throw new Error("Invalid Worker script");
  if (!REPO.test(args.repo || "")) throw new Error("Invalid GitHub repository");
  if (!SHA.test(args.commit_sha || "")) throw new Error("Invalid exact source commit SHA");
  if (!["recovery", "diagnostic"].includes(args.purpose)) throw new Error("Normal publication uses Cloudflare Workers Builds; manual upload requires explicit recovery or diagnostic purpose");
  if (args.message !== undefined && (typeof args.message !== "string" || args.message.length > 1000)) throw new Error("Invalid upload message");
  return args;
}

export async function uploadCloudSourceVersion(args, env, deps = {}) {
  validateCloudUploadArguments(args);
  await guardRepository(env,args.repo);
  if (!cloudWriteScripts(env).includes(args.script)) throw new Error("relay.CLOUD writes are not allowed for " + args.script);
  if (args.script === "relay" && args.repo === "relay") {
    throw new Error("Canonical Relay source upload is disabled; use Cloudflare Workers Builds for publication or deploy a known-good Worker version for rollback");
  }

  const owner = sourceOwner(env);
  const github = deps.github || ((path, options) => githubApiRequest(env, path, options));
  const cloud = deps.cloud || ((path, options) => cloudflareApiRequest(env, path, options));
  const rawUpload = deps.rawUpload || ((path, metadata, modules) => defaultRawUpload(env, path, metadata, modules, deps.fetch));

  const repoBase = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(args.repo)}`;
  const commit = await github(`${repoBase}/git/commits/${args.commit_sha}`);
  if (commit?.sha !== args.commit_sha) throw new Error("Exact source commit could not be verified");

  const wrangler = parseWrangler(
    await readSourceFile(github, owner, args.repo, "wrangler.jsonc", args.commit_sha),
    args.script
  );
  const modules = await moduleGraph(github, owner, args.repo, wrangler.main, args.commit_sha);

  const account = String(env?.CLOUDFLARE_ACCOUNT_ID || "");
  if (!account || !env?.CLOUDFLARE_API_TOKEN) throw new Error("relay.CLOUD credentials are not configured");
  const versionsPath = `/accounts/${account}/workers/scripts/${encodeURIComponent(args.script)}/versions`;
  const existing = await lookupVersion(cloud, versionsPath, args.commit_sha);
  if (existing) {
    return {
      ok: true, script: args.script, repository: `${owner}/${args.repo}`,
      commit_sha: args.commit_sha, version_id: existing.id, version: existing,
      already_exists: true, reconciled_after_transport_error: false,
      modules: modules.map(module => module.name)
    };
  }

  const settings = await cloud(`/accounts/${account}/workers/scripts/${encodeURIComponent(args.script)}/settings`);
  for (const name of Object.keys(wrangler.vars)) {
    const existing = settings.bindings?.find(binding => binding.name === name);
    if (existing && existing.type !== "plain_text") throw new Error("Committed variable conflicts with protected binding: " + name);
  }
  const metadata = {
    main_module: wrangler.main,
    compatibility_date: wrangler.compatibility_date,
    compatibility_flags: wrangler.compatibility_flags,
    usage_model: "standard",
    bindings: [
      ...bindingNames(settings).filter(name => !(name in wrangler.vars)).map(name => ({ name, type: "inherit" })),
      ...Object.entries(wrangler.vars).map(([name, text]) => ({ name, type: "plain_text", text }))
    ],
    annotations: {
      "workers/commit_sha": args.commit_sha,
      "workers/message": (args.message || `Relay exact source upload ${args.commit_sha.slice(0, 12)}`).slice(0, 1000),
      "workers/repository_url": `https://github.com/${owner}/${args.repo}`,
      "workers/tag": args.purpose ? `relay-${args.purpose}-source-upload` : "relay-native-source-upload"
    }
  };

  let uploaded = null, writeError = null;
  try {
    uploaded = await rawUpload(versionsPath + "?bindings_inherit=strict", metadata, modules);
  } catch (error) {
    writeError = error;
  }

  const verified = await lookupVersion(cloud, versionsPath, args.commit_sha);
  if (!verified) {
    if (writeError) throw new Error("Worker version upload outcome cannot be verified; inspect relay_cloud_worker before retrying");
    throw new Error("Uploaded Worker version was not found by exact commit annotation");
  }
  if (uploaded?.id && uploaded.id !== verified.id) throw new Error("Worker version readback differs from upload receipt");

  return {
    ok: true, script: args.script, repository: `${owner}/${args.repo}`,
    commit_sha: args.commit_sha, version_id: verified.id, version: verified,
    already_exists: false, reconciled_after_transport_error: Boolean(writeError),
    modules: modules.map(module => module.name)
  };
}

export async function callCloudUpload(args, env) {
  return uploadCloudSourceVersion(args, env);
}
