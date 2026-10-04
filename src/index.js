import { readMcpBody, mcpBodyErrorResponse } from "./mcp-request-body.js";
import { handleApi as runnerApi } from "../packages/runner/src/cloudflare-worker.mjs";
import { browserRequestOptions, runQuickAction } from "./browser.js";
import { storeEvidence, decodeBase64Bytes, summarizeSnapshot, normalizeEvidenceContext } from "./evidence.js";
import { openBrowserSession, interactBrowserSession, captureBrowserSession, closeBrowserSession } from "./session.js";
import { runBrowserRecipe, listBrowserRecipes } from "./recipes.js";
import { evidenceEngines, planEvidenceRequest, normalizeBrowserCapacityError } from "./controller.js";
import { ingestExternalEvidence, upsertEvidenceRun } from "./external-evidence.js";
import { getRecipe, listRecipes, saveRecipeFromSession } from "./recipe-store.js";
import { RELAY_CONTROL_CENTER_URI, relayControlCenterResource } from "./relay-ui.js";
import { RELAY_STATUS_CARD_URI, RELAY_STATUS_CARD_TOOL, relayStatusCardDescriptor, relayStatusCardResource, relayStatusCardTool, RELAY_CONTEXT_CARD_URI, RELAY_CONTEXT_CARD_TOOL, relayContextCardDescriptor, relayContextCardResource, relayContextCardTool, validateRelayContextCardArguments, compactContextCardResult } from "./relay-chat-ui.js";
import { RELAY_SKILL_EXTENSION, relaySkillCatalog, relaySkillByUri, relaySkillResourceDescriptors, relaySkillResource } from "./skills.js";
import { sourceAuthStatus, githubApiRequest as sourceGithubApiRequest, commitSourceFiles } from "./source.js";
import { runnerControlTools, callRunnerControl, runnerControlError } from "./runner-control.js";
import { cloudStatus, listCloudScripts, cloudWorkerSummary, cloudBuilds, deployCloudVersion } from "./cloud.js";
import { HOST_PROBE_URI, HOST_PROBE_TOOL, hostProbeDescriptor, hostProbeResource, hostProbeTool, hostProbeResult } from "./relay-host-probe.js";
import { ACTION_PROBE_URI, ACTION_PROBE_TOOL, ACTION_SAMPLE_TOOL, actionProbeDescriptor, actionProbeResource, actionProbeTools, actionProbeResult } from "./relay-host-action-probe.js";

import { feedbackActor } from "./feedback-control.js";
import { cardVariantDescriptors, cardVariantTools, cardVariantResource, cardVariantResult, isCardVariantTool, isCardVariantUri } from "./relay-card-variants.js";

const VERSION = "1.2.0";
const EVIDENCE_CONTEXT_SCHEMA = {
  type: "object",
  properties: {
    project: { type: "string", maxLength: 80 },
    assignment: { type: "string", maxLength: 100 },
    owner: { type: "string", maxLength: 100 },
    branch: { type: "string", maxLength: 240 },
    project_id: { type: "string", maxLength: 128 },
    environment: { type: "string", enum: ["production","preview","qa","smoke","unknown"] },
    surface: { type: "string", maxLength: 80 },
    route_kind: { type: "string", enum: ["qa-work","builder-smoke","runner","other"] },
    commit_sha: { type: "string", maxLength: 64 },
    pr_number: { type: "integer", minimum: 1, maximum: 1000000 },
    deployment_id: { type: "string", maxLength: 128 }
  },
  additionalProperties: false
};
const ACCESS_ISSUER = "https://loewfi.cloudflareaccess.com";
const RELAY_ACCESS_AUD = "7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819";
const MAX_BODY_BYTES = 262144;
const MAX_REDIRECTS = 5;
const TARGET_TIMEOUT_MS = 10000;
const SAFE_HEADERS = [
  "content-type", "content-length", "cache-control", "cf-ray", "server",
  "cross-origin-resource-policy", "cross-origin-opener-policy",
  "cross-origin-embedder-policy", "origin-agent-cluster"
];
const TEXT_TYPES = /^(text\/|application\/(?:json|xml|javascript|xhtml\+xml|[^;]+\+(?:json|xml)))/i;


const RELAY_GITHUB_API = "https://api.github.com";
const RELAY_GITHUB_OWNER = "lrnolivia";
const GITHUB_API_VERSION = "2022-11-28";
const LEGACY_TOOL_ALIASES = Object.freeze({
  fetch_loew_url: "relay_verify_fetch_url",
  browser_screenshot: "relay_verify_browser_screenshot",
  browser_snapshot: "relay_verify_browser_snapshot",
  browser_open: "relay_verify_browser_open",
  browser_interact: "relay_verify_browser_interact",
  browser_capture: "relay_verify_browser_capture",
  browser_recipe: "relay_verify_browser_recipe",
  browser_recipes: "relay_verify_browser_recipes",
  evidence_plan: "relay_verify_evidence_plan",
  evidence_engines: "relay_verify_evidence_engines",
  recipe_list: "relay_verify_recipe_list",
  recipe_from_session: "relay_verify_recipe_from_session",
  browser_close: "relay_verify_browser_close"
});

function relayToolName(name) {
  return LEGACY_TOOL_ALIASES[name] || name;
}

function validateIdentifier(value, label, pattern = /^[A-Za-z0-9._-]+$/) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 || !pattern.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function validateBranch(value, label = "branch") {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 240 ||
    !/^[A-Za-z0-9._\/-]+$/.test(value) ||
    value.includes("..") ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.endsWith(".lock")
  ) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function encodeRepositoryPath(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 1024) throw new Error("Invalid repository path");
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) throw new Error("Invalid repository path");
  return parts.map(encodeURIComponent).join("/");
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const binary = atob(String(value || "").replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function configuredSourceOwner(env, requested) {
  const configured = String(env?.RELAY_GITHUB_OWNER || RELAY_GITHUB_OWNER);
  validateIdentifier(configured, "configured GitHub owner");
  if (requested && String(requested).toLowerCase() !== configured.toLowerCase()) {
    throw new Error(`relay.SOURCE is restricted to GitHub owner ${configured}`);
  }
  return configured;
}

async function githubApiRequest(env, path, options = {}) {
  return sourceGithubApiRequest(env, path, options);
}

async function runnerApiRequest(accessJwt, path, options = {}, env) {
  const method = options.method || "GET";
  if (typeof path !== "string" || !path.startsWith("/api/") || path.includes("://")) throw new Error("Invalid Runner API path");
  const response = await runnerApi(new Request("https://relay.loew.fi" + path, {
    method, headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }), env, { authenticatedMcp: true });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = { message: text.slice(0, 1000) }; }
  }
  if (!response.ok) {
    const error = new Error(body?.error || body?.message || `Runner request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function relayResult(id, result) {
  return rpc(id, {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result
  });
}


let jwksCache = { expires: 0, keys: [] };

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

function validateTarget(input) {
  if (typeof input !== "string" || input.length > 4096 || input !== input.trim() || /[\\\x00-\x1f\x7f]/.test(input)) {
    throw new Error("Invalid URL");
  }
  let url;
  try { url = new URL(input); } catch { throw new Error("Invalid URL"); }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (host !== "loew.fi" && !host.endsWith(".loew.fi")) ||
    url.username || url.password || url.port || url.hash
  ) {
    throw new Error("Only HTTPS URLs on loew.fi and its subdomains are allowed");
  }
  return url;
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function getAccessKeys() {
  const now = Date.now();
  if (jwksCache.expires > now && jwksCache.keys.length) return jwksCache.keys;
  const response = await fetch(ACCESS_ISSUER + "/cdn-cgi/access/certs", {
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error("Unable to load Access signing keys");
  const data = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  jwksCache = { expires: now + 300000, keys };
  return keys;
}

async function verifyAccessJwt(request) {
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const now = Date.now() / 1000;
    if (
      header.alg !== "RS256" ||
      typeof header.kid !== "string" ||
      claims.iss !== ACCESS_ISSUER ||
      !aud.includes(RELAY_ACCESS_AUD) ||
      typeof claims.exp !== "number" || claims.exp <= now ||
      (typeof claims.nbf === "number" && claims.nbf > now)
    ) return null;

    const keys = await getAccessKeys();
    const jwk = keys.find(k => k.kid === header.kid && k.kty === "RSA");
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
    return ok ? { token, claims } : null;
  } catch {
    return null;
  }
}

async function boundedText(response) {
  if (!response.body) return { body: "", truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = MAX_BODY_BYTES - total;
      if (remaining <= 0) {
        truncated = true;
        await reader.cancel();
        break;
      }
      if (value.length > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return { body: new TextDecoder().decode(joined), truncated };
}

async function fetchTarget(input, method, accessJwt) {
  if (method !== "GET" && method !== "HEAD") throw new Error("Only GET and HEAD are allowed");
  let url = validateTarget(input);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const response = await fetch(url.toString(), {
      method,
      redirect: "manual",
      headers: {
        "Cf-Access-Token": accessJwt,
        "Accept": "text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.1"
      },
      signal: AbortSignal.timeout(TARGET_TIMEOUT_MS)
    });

    if ([301,302,303,307,308].includes(response.status) && response.headers.has("location")) {
      if (redirects === MAX_REDIRECTS) throw new Error("Too many redirects");
      url = validateTarget(new URL(response.headers.get("location"), url).toString());
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    const headers = Object.fromEntries(
      SAFE_HEADERS.flatMap(name => response.headers.has(name) ? [[name, response.headers.get(name)]] : [])
    );
    const readable = method === "GET" && TEXT_TYPES.test(contentType);
    const content = readable ? await boundedText(response) : { body: "", truncated: false };
    return {
      status: response.status,
      final_url: url.toString(),
      content_type: contentType,
      ...content,
      headers
    };
  }
  throw new Error("Too many redirects");
}

function rpc(id, result) {
  return json({ jsonrpc: "2.0", id, result });
}

function rpcError(id, code, message) {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}

async function mcp(request, access, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "JSON required" }, 415);
  }
  let raw;
  try { raw = await readMcpBody(request); }
  catch (error) { return mcpBodyErrorResponse(error); }

  let message;
  try { message = JSON.parse(raw); }
  catch { return rpcError(null, -32700, "Invalid JSON"); }

  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id ?? null, -32600, "Invalid request");
  }

  if (message.method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }

  const id = message.id ?? null;

  if (message.method === "initialize") {
    return rpc(id, {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: {},
        resources: {},
        extensions: { [RELAY_SKILL_EXTENSION]: {} }
      },
      serverInfo: { name: "relay", version: VERSION },
      instructions: "Relay coordinates managed loew.fi work. When Relay is explicitly requested, use Relay MCP namespaces first; inspect relay.CONTROL, resolve current Runner authority and exact repo/worker before writes, use non-default branches and draft PRs for normal source work, verify resulting state through relay.VERIFY, and never silently substitute another GitHub/browser/cloud integration for a Relay capability. For user-visible ChatGPT status cards, call relay_render_context_card directly as the render step; do not expect a generic data-tool call or nested wrapper to preserve MCP Apps UI metadata. A card counts as rendered only when the ChatGPT consumer visibly mounts it."
    });
  }

  if (message.method === "ping") return rpc(id, {});

  if (message.method === "resources/list") {
    return rpc(id, {
      resources: [
        {
          uri: RELAY_CONTROL_CENTER_URI,
          name: "relay-control-center",
          title: "Relay control center",
          description: "Interactive control surface for relay.CONTROL, relay.RUNNER, relay.SOURCE, relay.CLOUD, and relay.VERIFY.",
          mimeType: "text/html;profile=mcp-app"
        },
        relayContextCardDescriptor(),
        relayStatusCardDescriptor(),
        hostProbeDescriptor(),
        actionProbeDescriptor(),
        ...cardVariantDescriptors(),
        ...relaySkillResourceDescriptors()
      ]
    });
  }

  if (message.method === "resources/read") {
    const uri = message.params?.uri;
    if (uri === HOST_PROBE_URI) return rpc(id, { contents: [hostProbeResource()] });
    if (uri === ACTION_PROBE_URI) return rpc(id, { contents: [actionProbeResource()] });
    if (isCardVariantUri(uri)) return rpc(id, { contents: [cardVariantResource(uri)] });
    if (uri === RELAY_CONTROL_CENTER_URI) {
      return rpc(id, { contents: [relayControlCenterResource()] });
    }
    if (uri === RELAY_CONTEXT_CARD_URI || uri === 'ui://relay/context-card/v13.html' || uri === 'ui://relay/context-card/v12.html' || uri === 'ui://relay/context-card/v11.html') {
      return rpc(id, { contents: [{...relayContextCardResource(), uri}] });
    }
    if (uri === RELAY_STATUS_CARD_URI) {
      return rpc(id, { contents: [relayStatusCardResource()] });
    }
    const skillResource = relaySkillResource(uri);
    if (skillResource) return rpc(id, { contents: [skillResource] });
    return rpcError(id, -32602, "Unknown resource");
  }

  if (message.method === "skills/list") {
    const cursor = message.params?.cursor;
    if (cursor !== undefined && cursor !== null && cursor !== "") {
      return rpcError(id, -32602, "Invalid skills cursor");
    }
    return rpc(id, { skills: relaySkillCatalog() });
  }

  if (message.method === "skills/get") {
    const uri = message.params?.uri;
    const skill = relaySkillByUri(uri);
    if (!skill) return rpcError(id, -32602, "Unknown skill");
    return rpc(id, { skill });
  }

  if (message.method === "tools/list") {
    const securitySchemes = [{ type: "oauth2", scopes: [] }];
    const tools = [
      ...runnerControlTools,

        {
          name: "relay_ui_control_center",
          title: "Open Relay control center",
          description: "Render Relay's interactive control center for inspecting namespaces, Runner state, source/cloud readiness, and verification engines. Use this when a visual Relay overview or control surface would help.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          _meta: {
            ui: {
              resourceUri: RELAY_CONTROL_CENTER_URI,
              visibility: ["model", "app"]
            },
            "openai/outputTemplate": RELAY_CONTROL_CENTER_URI,
            "openai/widgetAccessible": true,
            "openai/toolInvocation/invoking": "Opening Relay…",
            "openai/toolInvocation/invoked": "Relay ready.",
            "openai/ui": {
              entrypoints: [{ type: "global" }]
            }
          }
        },
        relayContextCardTool(),
        relayStatusCardTool(),
        hostProbeTool(),
        ...actionProbeTools(),
        ...cardVariantTools(),

        {
          name: "relay_control_status",
          title: "Relay control-plane status",
          description: "Describe relay.CONTROL namespaces, backend readiness, and the currently configured authenticated transports.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_runner_workers",
          title: "List Runner workers",
          description: "Read the live Runner worker registry through relay.RUNNER.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_runner_action",
          title: "Run a bounded Runner action",
          description: "Execute one supported Runner worker action through relay.RUNNER. Actions are limited to the deployed Runner API.",
          inputSchema: {
            type: "object",
            properties: {
              worker_id: { type: "string", minLength: 1, maxLength: 128 },
              action: { type: "string", enum: ["toggle", "settings", "run", "doctor", "repair"] },
              payload: { type: "object" }
            },
            required: ["worker_id", "action"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
        },
        {
          name: "relay_source_status",
          title: "Relay source status",
          description: "Report relay.SOURCE authentication mode and whether guarded GitHub writes are available.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_source_repo",
          title: "Read a GitHub repository",
          description: "Read repository metadata through relay.SOURCE. The owner is restricted to the configured Relay GitHub owner.",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" }
            },
            required: ["repo"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
        },
        {
          name: "relay_source_file",
          title: "Read a GitHub file",
          description: "Read UTF-8 repository file content through relay.SOURCE.",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              path: { type: "string" },
              ref: { type: "string" }
            },
            required: ["repo", "path"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
        },
        {
          name: "relay_source_pull_request",
          title: "Read a GitHub pull request",
          description: "Read one pull request through relay.SOURCE.",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              number: { type: "integer", minimum: 1, maximum: 1000000 }
            },
            required: ["repo", "number"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
        },
        {
          name: "relay_source_checks",
          title: "Read GitHub checks",
          description: "Read check runs for a GitHub commit or branch through relay.SOURCE.",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              ref: { type: "string" }
            },
            required: ["repo", "ref"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
        },
        {
          name: "relay_source_create_branch",
          title: "Create a GitHub branch",
          description: "Create a branch through relay.SOURCE. Requires RELAY_GITHUB_TOKEN on the Relay Worker.",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              branch: { type: "string" },
              base: { type: "string", default: "main" }
            },
            required: ["repo", "branch"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
        },
        {
          name: "relay_source_update_file",
          title: "Create or update a GitHub file",
          description: "Create or replace one UTF-8 file on a non-default branch through relay.SOURCE. Requires RELAY_GITHUB_TOKEN.",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              path: { type: "string" },
              branch: { type: "string" },
              content: { type: "string" },
              message: { type: "string" },
              expected_sha: { type: "string" }
            },
            required: ["repo", "path", "branch", "content", "message"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true }
        },
        {
          name: "relay_source_commit_files",
          title: "Commit multiple GitHub files",
          description: "Atomically commit 1-20 UTF-8 files to an existing non-default branch through relay.SOURCE.",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              branch: { type: "string" },
              message: { type: "string" },
              expected_head_sha: { type: "string" },
              files: {
                type: "array",
                minItems: 1,
                maxItems: 20,
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    content: { type: "string" }
                  },
                  required: ["path", "content"],
                  additionalProperties: false
                }
              }
            },
            required: ["repo", "branch", "message", "files"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true }
        },
        {
          name: "relay_source_open_pull_request",
          title: "Open a GitHub pull request",
          description: "Open a pull request through relay.SOURCE. Requires RELAY_GITHUB_TOKEN.",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string" },
              repo: { type: "string" },
              head: { type: "string" },
              base: { type: "string", default: "main" },
              title: { type: "string" },
              body: { type: "string" },
              draft: { type: "boolean", default: true }
            },
            required: ["repo", "head", "title"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
        },
        {
          name: "relay_cloud_scripts",
          title: "List Cloudflare Workers",
          description: "List Worker scripts visible to relay.CLOUD.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
        },
        {
          name: "relay_cloud_worker",
          title: "Read Cloudflare Worker state",
          description: "Read one Worker's settings, deployments, versions, and custom domains through relay.CLOUD.",
          inputSchema: {
            type: "object",
            properties: { script: { type: "string" } },
            required: ["script"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
        },
        {
          name: "relay_cloud_builds",
          title: "Read Cloudflare Worker builds",
          description: "Read Workers Builds history for one Worker through relay.CLOUD.",
          inputSchema: {
            type: "object",
            properties: { script: { type: "string" } },
            required: ["script"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
        },
        {
          name: "relay_cloud_deploy_version",
          title: "Deploy a Cloudflare Worker version",
          description: "Deploy or roll back an explicitly allowed Worker to an existing version at 100% traffic.",
          inputSchema: {
            type: "object",
            properties: {
              script: { type: "string" },
              version_id: { type: "string" },
              message: { type: "string" }
            },
            required: ["script", "version_id"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true }
        },
        {
          name: "relay_cloud_status",
          title: "Relay Cloud control status",
          description: "Report whether relay.CLOUD has first-party Cloudflare credentials configured. No cloud mutation is exposed until credentials are present and bounded tools are implemented.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_fetch_url",
          title: "Fetch a protected loew.fi page",
          description: "Read an HTTPS page on loew.fi or a loew.fi subdomain through the authenticated inspector. Redirects are revalidated and text responses are bounded.",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "HTTPS loew.fi URL" },
              method: { type: "string", enum: ["GET","HEAD"], default: "GET" }
            },
            required: ["url"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_browser_screenshot",
          title: "Capture loew.fi visual evidence",
          description: "Render an HTTPS loew.fi page in Cloudflare Browser Run, persist the PNG in inspector evidence storage, and return a compact evidence record.",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "HTTPS loew.fi URL" },
              request_id: { type: "string", description: "Optional safe correlation id" },
              context: EVIDENCE_CONTEXT_SCHEMA,
              full_page: { type: "boolean", default: false },
              selector: { type: "string", description: "Optional CSS selector to capture" },
              viewport: {
                type: "object",
                properties: {
                  width: { type: "number", minimum: 320, maximum: 3840 },
                  height: { type: "number", minimum: 240, maximum: 2160 },
                  deviceScaleFactor: { type: "number", minimum: 1, maximum: 2 }
                },
                additionalProperties: false
              }
            },
            required: ["url"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_browser_snapshot",
          title: "Capture loew.fi browser snapshot",
          description: "Render an HTTPS loew.fi page and persist screenshot evidence while returning HTTP status plus rendered DOM and accessibility summaries.",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "HTTPS loew.fi URL" },
              request_id: { type: "string", description: "Optional safe correlation id" },
              context: EVIDENCE_CONTEXT_SCHEMA,
              full_page: { type: "boolean", default: false },
              viewport: {
                type: "object",
                properties: {
                  width: { type: "number", minimum: 320, maximum: 3840 },
                  height: { type: "number", minimum: 240, maximum: 2160 },
                  deviceScaleFactor: { type: "number", minimum: 1, maximum: 2 }
                },
                additionalProperties: false
              }
            },
            required: ["url"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_browser_open",
          title: "Open a loew.fi browser session",
          description: "Open a persistent Browser Run session on an HTTPS loew.fi target and return opaque session and target ids for controlled follow-up interactions.",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "HTTPS loew.fi URL" },
              context: EVIDENCE_CONTEXT_SCHEMA,
              keep_alive_ms: { type: "number", minimum: 10000, maximum: 1200000, default: 600000 },
              viewport: {
                type: "object",
                properties: {
                  width: { type: "number", minimum: 320, maximum: 3840 },
                  height: { type: "number", minimum: 240, maximum: 2160 },
                  deviceScaleFactor: { type: "number", minimum: 1, maximum: 2 }
                },
                additionalProperties: false
              }
            },
            required: ["url"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_browser_interact",
          title: "Interact with a loew.fi browser session",
          description: "Perform one bounded semantic action in an existing loew.fi Browser Run session. No arbitrary JavaScript is accepted.",
          inputSchema: {
            type: "object",
            properties: {
              session_id: { type: "string" },
              target_id: { type: "string" },
              action: { type: "string", enum: ["click","double_click","hover","type","press","select","scroll","wait"] },
              locator: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["role","text","test_id","css"] },
                  value: { type: "string" },
                  name: { type: "string" }
                },
                required: ["type","value"],
                additionalProperties: false
              },
              value: { type: "string" },
              key: { type: "string" },
              delta_x: { type: "number", minimum: -5000, maximum: 5000 },
              delta_y: { type: "number", minimum: -5000, maximum: 5000 },
              wait_ms: { type: "number", minimum: 0, maximum: 10000 }
            },
            required: ["session_id","action"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_browser_capture",
          title: "Capture an interactive browser session",
          description: "Capture the current page in an existing Browser Run session and persist PNG evidence with the session interaction trace.",
          inputSchema: {
            type: "object",
            properties: {
              session_id: { type: "string" },
              target_id: { type: "string" },
              request_id: { type: "string" },
              context: EVIDENCE_CONTEXT_SCHEMA,
              full_page: { type: "boolean", default: false }
            },
            required: ["session_id"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_browser_recipe",
          title: "Run a field visual QA recipe",
          description: "Run a bounded named visual-QA recipe against the canonical real-project /qa/work/{projectId} route, persist evidence, then close the browser session.",
          inputSchema: {
            type: "object",
            properties: {
              recipe: { type: "string", enum: ["field.canvas-first-paint","field.full","field.focus","field.float","field.light","field.dark","field.inspector-stroke"] },
              url: { type: "string" },
              request_id: { type: "string" },
              context: EVIDENCE_CONTEXT_SCHEMA
            },
            required: ["recipe","url"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_browser_recipes",
          title: "List field visual QA recipes",
          description: "List the built-in bounded real-project field visual-QA recipes.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_evidence_plan",
          title: "Plan a loew evidence check",
          description: "Choose the cheapest capable evidence engine deterministically. Known recipes route to GitHub Chromium; exploratory sessions reserve Browser Run.",
          inputSchema: {
            type: "object",
            properties: {
              requires: { type: "array", items: { type: "string", enum: ["http","headers","json","redirects","render","screenshot","snapshot","interaction","recipe","compare","artifact","exploratory","session"] }, maxItems: 12 },
              recipe: { type: "string" },
              exploratory: { type: "boolean", default: false },
              preferred_engine: { type: "string", enum: ["http","github-chromium","browser-run"] }
            },
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_evidence_engines",
          title: "List loew evidence engines",
          description: "List the evidence engines and their deterministic capabilities.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_recipe_list",
          title: "List loew visual QA recipes",
          description: "List versioned built-in and saved deterministic evidence recipes.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_recipe_from_session",
          title: "Save a browser trace as a deterministic QA recipe",
          description: "Compile replayable bounded interactions from an Inspector browser session into a versioned recipe stored in private evidence R2.",
          inputSchema: {
            type: "object",
            properties: {
              session_id: { type: "string" },
              recipe_id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" }
            },
            required: ["session_id","recipe_id"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
        },
        {
          name: "relay_verify_browser_close",
          title: "Close a loew.fi browser session",
          description: "Close a Browser Run session and mark its persisted session record closed.",
          inputSchema: {
            type: "object",
            properties: { session_id: { type: "string" } },
            required: ["session_id"],
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
        }
    ];
    return rpc(id, {
      tools: tools.map((tool) => ({
        ...tool,
        securitySchemes,
        _meta: { ...(tool._meta || {}), ...(['relay_runner_progress','relay_runner_assignments','relay_ui_request'].includes(tool.name)?{ui:{...(tool._meta?.ui||{}),visibility:['model','app']},'openai/widgetAccessible':true}:{}), securitySchemes }
      }))
    });
  }

  if (message.method === "tools/call") {
    try {
      const rawName = message.params?.name;
      const name = relayToolName(rawName);
      const args = message.params?.arguments || {};

      if (isCardVariantTool(name)) return rpc(id, cardVariantResult(name, message.params?.arguments ?? {}));
      if (name === HOST_PROBE_TOOL) return rpc(id, hostProbeResult(message.params?.arguments ?? {}, request, message.params?._meta));
      if (name === ACTION_PROBE_TOOL || name === ACTION_SAMPLE_TOOL) return rpc(id, actionProbeResult(message.params?.arguments ?? {}, name === ACTION_PROBE_TOOL ? "initial" : "action"));


      if (runnerControlTools.some(tool => tool.name === name)) {
        try {
          const result = await callRunnerControl(name, args, { ...env, RELAY_FEEDBACK_ACTOR: feedbackActor(access) });
          return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result,
            ...(result.ok === false ? { isError: true } : {}) });
        }
        catch (error) {
          const failure = runnerControlError(error);
          return rpc(id, { content: [{ type: "text", text: JSON.stringify(failure) }], structuredContent: failure, isError: true });
        }
      }

      if (name === RELAY_CONTEXT_CARD_TOOL || name === RELAY_STATUS_CARD_TOOL) {
        const cardArgs = validateRelayContextCardArguments(args);
        const { evidence_id, show_qa, ...runnerArgs } = cardArgs;
        if (!runnerArgs.project) {
          const registry = await callRunnerControl("relay_runner_projects", {}, env);
          return relayResult(id, { ...registry, kind: 'overview', schema:'relay-status-explorer/v1' });
        }
        const result = await callRunnerControl("relay_runner_progress", runnerArgs, env);
        return relayResult(id, {
          ...result,
          schema: 'relay-status-explorer/v1',
          ...(evidence_id ? { evidence_id } : {}),
          ...(show_qa === true ? { show_qa: true } : {})
        });
      }

      if (name === "relay_ui_control_center") {
        const workers = await runnerApiRequest(access.token, "/api/workers", {}, env);
        const capabilities = {
          runner_read: true,
          runner_write: true,
          source_read: true,
          source_write: sourceAuthStatus(env).write_enabled,
          cloud_control: Boolean(env?.CLOUDFLARE_API_TOKEN && env?.CLOUDFLARE_ACCOUNT_ID),
          verify: true
        };
        const result = {
          ok: true,
          service: "relay",
          version: VERSION,
          architecture: {
            control: "relay.CONTROL",
            runner: "relay.RUNNER",
            source: "relay.SOURCE",
            cloud: "relay.CLOUD",
            verify: "relay.VERIFY"
          },
          capabilities,
          source_owner: String(env?.RELAY_GITHUB_OWNER || RELAY_GITHUB_OWNER),
          cloud: {
            configured: capabilities.cloud_control,
            account_configured: Boolean(env?.CLOUDFLARE_ACCOUNT_ID),
            token_configured: Boolean(env?.CLOUDFLARE_API_TOKEN)
          },
          verify: {
            engines: evidenceEngines()
          },
          workers,
          generated_at: new Date().toISOString()
        };
        return relayResult(id, result);
      }

      if (name === "relay_control_status") {
        return relayResult(id, {
          ok: true,
          service: "relay",
          version: VERSION,
          architecture: {
            control: "relay.CONTROL",
            runner: "relay.RUNNER",
            source: "relay.SOURCE",
            cloud: "relay.CLOUD",
            verify: "relay.VERIFY"
          },
          capabilities: {
            runner_read: true,
            runner_write: true,
            source_read: true,
            source_write: sourceAuthStatus(env).write_enabled,
            cloud_control: cloudStatus(env).configured,
            verify: true
          },
          source_owner: String(env?.RELAY_GITHUB_OWNER || RELAY_GITHUB_OWNER),
          source: sourceAuthStatus(env),
          cloud: cloudStatus(env),
          legacy_verify_aliases: Object.keys(LEGACY_TOOL_ALIASES).length
        });
      }

      if (name === "relay_runner_workers") {
        return relayResult(id, {
          ok: true,
          workers: await runnerApiRequest(access.token, "/api/workers", {}, env)
        });
      }

      if (name === "relay_runner_action") {
        const workerId = validateIdentifier(args.worker_id, "Runner worker id");
        const action = args.action;
        if (!["toggle", "settings", "run", "doctor", "repair"].includes(action)) throw new Error("Unsupported Runner action");
        const result = await runnerApiRequest(
          access.token,
          `/api/workers/${encodeURIComponent(workerId)}/${action}`,
          { method: "POST", body: args.payload || {} }, env
        );
        return relayResult(id, { ok: true, worker_id: workerId, action, result });
      }

      if (name === "relay_source_status") {
        return relayResult(id, sourceAuthStatus(env));
      }

      if (name === "relay_source_repo") {
        const owner = configuredSourceOwner(env, args.owner);
        const repo = validateIdentifier(args.repo, "repository");
        const result = await githubApiRequest(env, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
        return relayResult(id, { ok: true, repository: result });
      }

      if (name === "relay_source_file") {
        const owner = configuredSourceOwner(env, args.owner);
        const repo = validateIdentifier(args.repo, "repository");
        const path = encodeRepositoryPath(args.path);
        const ref = args.ref ? validateBranch(args.ref, "ref") : "main";
        const result = await githubApiRequest(
          env,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}?ref=${encodeURIComponent(ref)}`
        );
        if (!result || result.type !== "file" || typeof result.content !== "string") throw new Error("GitHub path is not a readable file");
        return relayResult(id, {
          ok: true,
          repository: `${owner}/${repo}`,
          path: result.path,
          ref,
          sha: result.sha,
          size: result.size,
          content: result.encoding === "base64" ? decodeBase64Utf8(result.content) : result.content
        });
      }

      if (name === "relay_source_pull_request") {
        const owner = configuredSourceOwner(env, args.owner);
        const repo = validateIdentifier(args.repo, "repository");
        const number = Number(args.number);
        if (!Number.isInteger(number) || number < 1 || number > 1000000) throw new Error("Invalid pull request number");
        const result = await githubApiRequest(
          env,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`
        );
        return relayResult(id, { ok: true, pull_request: result });
      }

      if (name === "relay_source_checks") {
        const owner = configuredSourceOwner(env, args.owner);
        const repo = validateIdentifier(args.repo, "repository");
        const ref = validateBranch(args.ref, "ref");
        const result = await githubApiRequest(
          env,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}/check-runs`
        );
        return relayResult(id, { ok: true, checks: result });
      }

      if (name === "relay_source_create_branch") {
        const owner = configuredSourceOwner(env, args.owner);
        const repo = validateIdentifier(args.repo, "repository");
        const branch = validateBranch(args.branch);
        const base = validateBranch(args.base || "main", "base branch");
        const baseRef = await githubApiRequest(
          env,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${base.split("/").map(encodeURIComponent).join("/")}`
        );
        const created = await githubApiRequest(
          env,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,
          { method: "POST", body: { ref: `refs/heads/${branch}`, sha: baseRef?.object?.sha } }
        );
        return relayResult(id, { ok: true, branch: created });
      }

      if (name === "relay_source_update_file") {
        const owner = configuredSourceOwner(env, args.owner);
        const repo = validateIdentifier(args.repo, "repository");
        const path = encodeRepositoryPath(args.path);
        const branch = validateBranch(args.branch);
        const repository = await githubApiRequest(
          env,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
        );
        if (branch === repository?.default_branch) throw new Error("relay.SOURCE refuses direct default-branch file writes");
        if (typeof args.content !== "string" || args.content.length > 500000) throw new Error("Invalid file content");
        if (typeof args.message !== "string" || args.message.length < 1 || args.message.length > 500) throw new Error("Invalid commit message");
        const body = {
          message: args.message,
          content: encodeBase64Utf8(args.content),
          branch
        };
        if (args.expected_sha) body.sha = validateIdentifier(args.expected_sha, "expected blob sha", /^[a-f0-9]{40}$/i);
        const result = await githubApiRequest(
          env,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
          { method: "PUT", body }
        );
        return relayResult(id, { ok: true, result });
      }

      if (name === "relay_source_commit_files") {
        const owner = configuredSourceOwner(env, args.owner);
        const repo = validateIdentifier(args.repo, "repository");
        const branch = validateBranch(args.branch);
        const result = await commitSourceFiles(env, {
          owner,
          repo,
          branch,
          files: args.files,
          message: args.message,
          expectedHeadSha: args.expected_head_sha
        });
        return relayResult(id, result);
      }

      if (name === "relay_source_open_pull_request") {
        const owner = configuredSourceOwner(env, args.owner);
        const repo = validateIdentifier(args.repo, "repository");
        const head = validateBranch(args.head, "head branch");
        const base = validateBranch(args.base || "main", "base branch");
        if (typeof args.title !== "string" || args.title.length < 1 || args.title.length > 256) throw new Error("Invalid pull request title");
        const result = await githubApiRequest(
          env,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
          {
            method: "POST",
            body: {
              head,
              base,
              title: args.title,
              body: typeof args.body === "string" ? args.body : "",
              draft: args.draft !== false
            }
          }
        );
        return relayResult(id, { ok: true, pull_request: result });
      }

      if (name === "relay_cloud_scripts") {
        return relayResult(id, { ok: true, scripts: await listCloudScripts(env) });
      }

      if (name === "relay_cloud_worker") {
        return relayResult(id, await cloudWorkerSummary(env, args.script));
      }

      if (name === "relay_cloud_builds") {
        return relayResult(id, { ok: true, script: args.script, builds: await cloudBuilds(env, args.script) });
      }

      if (name === "relay_cloud_deploy_version") {
        return relayResult(id, await deployCloudVersion(env, args.script, args.version_id, args.message));
      }

      if (name === "relay_cloud_status") {
        return relayResult(id, cloudStatus(env));
      }

      if (name === "relay_verify_fetch_url") {
        const target = validateTarget(args.url);
        const method = args.method || "GET";
        const result = await fetchTarget(target.toString(), method, access.token);
        return rpc(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result
        });
      }

      if (name === "relay_verify_browser_screenshot") {
        const target = validateTarget(args.url);
        const options = browserRequestOptions({
          url: target,
          accessJwt: access.token,
          viewport: args.viewport,
          selector: args.selector,
          fullPage: args.full_page
        });
        const started = Date.now();
        const response = await runQuickAction(env.BROWSER, "screenshot", options);
        const browserMs = Number(response.headers.get("x-browser-ms-used") || 0) || null;
        const png = new Uint8Array(await response.arrayBuffer());
        const metadata = await storeEvidence(env.EVIDENCE, {
          requestId: args.request_id,
          targetUrl: target.toString(),
          kind: "screenshot",
          screenshotBytes: png,
          browserMs,
          viewport: options.viewport,
          selector: options.selector ?? null,
          fullPage: Boolean(args.full_page),
          durationMs: Date.now() - started,
          context: args.context
        });
        return rpc(id, {
          content: [{ type: "text", text: JSON.stringify(metadata) }],
          structuredContent: metadata
        });
      }

      if (name === "relay_verify_browser_snapshot") {
        const target = validateTarget(args.url);
        const probe = await fetchTarget(target.toString(), "GET", access.token);
        const options = browserRequestOptions({
          url: target,
          accessJwt: access.token,
          viewport: args.viewport,
          fullPage: args.full_page
        });
        options.formats = ["content", "screenshot", "accessibilityTree"];
        const started = Date.now();
        const response = await runQuickAction(env.BROWSER, "snapshot", options);
        const browserMs = Number(response.headers.get("x-browser-ms-used") || 0) || null;
        const payload = await response.json();
        const result = payload?.result ?? payload;
        const screenshotBytes = decodeBase64Bytes(result?.screenshot);
        const summary = summarizeSnapshot(result);
        const metadata = await storeEvidence(env.EVIDENCE, {
          requestId: args.request_id,
          targetUrl: target.toString(),
          kind: "snapshot",
          screenshotBytes,
          browserMs,
          viewport: options.viewport,
          fullPage: Boolean(args.full_page),
          durationMs: Date.now() - started,
          context: args.context,
          extra: {
            http_status: probe.status,
            final_url: probe.final_url,
            title: summary.title,
            dom: summary.dom,
            accessibility: summary.accessibility,
            console_errors: { supported: false, reason: "Quick Actions do not expose a console event stream; interactive Browser Run sessions add this in Gen 2 Batch 3." },
            failed_requests: { supported: false, reason: "Quick Actions do not expose request-failure events; interactive Browser Run sessions add this in Gen 2 Batch 3." }
          }
        });
        return rpc(id, {
          content: [{ type: "text", text: JSON.stringify(metadata) }],
          structuredContent: metadata
        });
      }

      if (name === "relay_verify_browser_open") {
        const target = validateTarget(args.url);
        const result = await openBrowserSession(env.BROWSER, env.EVIDENCE, {
          url: target,
          accessJwt: access.token,
          viewport: args.viewport,
          keepAliveMs: args.keep_alive_ms,
          context: args.context
        });
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      if (name === "relay_verify_browser_interact") {
        const result = await interactBrowserSession(env.BROWSER, env.EVIDENCE, {
          sessionId: args.session_id,
          targetId: args.target_id,
          accessJwt: access.token,
          action: args.action,
          locator: args.locator,
          value: args.value,
          key: args.key,
          deltaX: args.delta_x,
          deltaY: args.delta_y,
          waitMs: args.wait_ms
        });
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      if (name === "relay_verify_browser_capture") {
        const result = await captureBrowserSession(env.BROWSER, env.EVIDENCE, {
          sessionId: args.session_id,
          targetId: args.target_id,
          accessJwt: access.token,
          requestId: args.request_id,
          fullPage: args.full_page,
          context: args.context
        });
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      if (name === "relay_verify_browser_recipe") {
        const target = validateTarget(args.url);
        const result = await runBrowserRecipe(env.BROWSER, env.EVIDENCE, {
          recipe: args.recipe,
          url: target,
          accessJwt: access.token,
          requestId: args.request_id,
          context: args.context
        });
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      if (name === "relay_verify_browser_recipes") {
        const result = { ok: true, recipes: listBrowserRecipes() };
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      if (name === "relay_verify_evidence_plan") {
        const result = planEvidenceRequest(args);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      if (name === "relay_verify_evidence_engines") {
        const result = { ok: true, engines: evidenceEngines() };
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      if (name === "relay_verify_recipe_list") {
        const result = { ok: true, recipes: await listRecipes(env.EVIDENCE) };
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      if (name === "relay_verify_recipe_from_session") {
        const recipe = await saveRecipeFromSession(env.EVIDENCE, {
          sessionId: args.session_id,
          recipeId: args.recipe_id,
          title: args.title,
          description: args.description
        });
        const result = { ok: true, recipe };
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      if (name === "relay_verify_browser_close") {
        const result = await closeBrowserSession(env.BROWSER, env.EVIDENCE, args.session_id);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
      }

      return rpcError(id, -32602, "Unknown tool");
    } catch (error) {
      const capacity = normalizeBrowserCapacityError(error);
      if (capacity) {
        return rpc(id, {
          content: [{ type: "text", text: JSON.stringify(capacity) }],
          structuredContent: capacity
        });
      }
      return rpc(id, {
        content: [{ type: "text", text: error instanceof Error ? error.message : "Relay action failed" }],
        isError: true
      });
    }
  }

  return rpcError(id, -32601, "Method not found");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "relay",
        runtime_verify: "relay",
        version: VERSION,
        auth: "cloudflare-managed-oauth",
        downstream_auth: "linked-app-token",
        browser_runtime: Boolean(env?.BROWSER)
      });
    }

    const access = await verifyAccessJwt(request);
    if (!access) {
      return json(
        { error: "invalid_token", error_description: "Authentication required" },
        401,
        {
          "WWW-Authenticate": 'Bearer resource_metadata="https://relay.loew.fi/.well-known/oauth-protected-resource/mcp", error="invalid_token", error_description="Authentication required"'
        }
      );
    }

    const recipeMatch = url.pathname.match(/^\/recipe\/([a-z0-9][a-z0-9._-]{2,80})$/);
    if (request.method === "GET" && recipeMatch) {
      try {
        const recipe = await getRecipe(env.EVIDENCE, recipeMatch[1]);
        return recipe ? json({ ok: true, recipe }) : json({ error: "Recipe not found" }, 404);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Recipe lookup failed" }, 400);
      }
    }

    if (request.method === "GET" && url.pathname === "/recipes") {
      try { return json({ ok: true, recipes: await listRecipes(env.EVIDENCE) }); }
      catch (error) { return json({ error: error instanceof Error ? error.message : "Recipe list failed" }, 400); }
    }

    if (url.pathname === "/evidence/ingest") {
      try { return await ingestExternalEvidence(request, env.EVIDENCE); }
      catch (error) { return json({ error: error instanceof Error ? error.message : "Evidence ingest failed" }, 400); }
    }

    if (url.pathname === "/evidence/run") {
      try { return await upsertEvidenceRun(request, env.EVIDENCE); }
      catch (error) { return json({ error: error instanceof Error ? error.message : "Evidence run update failed" }, 400); }
    }

    if (url.pathname === "/mcp") return mcp(request, access, env);

    if (url.pathname === "/setup") {
      return json({
        error: "Deprecated",
        message: "Service-token setup is no longer used. Authentication is handled by Cloudflare Managed OAuth."
      }, 410);
    }

    if (url.pathname === "/" && request.method === "GET") {
      return json({
        ok: true,
        service: "relay",
        runtime_verify: "relay",
        version: VERSION,
        authenticated: true
      });
    }

    return json({ error: "Not found" }, 404);
  }
};
