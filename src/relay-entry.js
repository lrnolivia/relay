import { contextTool, callContext } from '../packages/runner/src/context-service.mjs';
import { jobsTool, callJobs } from '../packages/runner/src/job-control.mjs';
import { nightShiftTool, callNightShift } from '../packages/runner/src/night-shift.mjs';
import { skillsTool, callSkills } from './skills-service.js';
import {LOEW_INTERFACE_SKILL_URI,loewInterfaceSkillCatalogEntry,loewInterfaceSkillResourceDescriptor,loewInterfaceSkillResource} from "./loew-interface-skill.js";
import { uiApiTool, callUiApi } from "../apps/web/api.js";
import { readMcpBody, mcpBodyErrorResponse } from "./mcp-request-body.js";
import legacy from "./index.js";
import { callSourceLifecycleTool } from "./source-lifecycle.js";
import { sourceTextMutationTools, isSourceTextMutationTool, validateSourceTextMutationArguments, callSourceTextMutationTool } from "./source-text-mutation.js";
import { staffDirectoryTool, callStaffDirectory, validateStaffDirectoryArguments } from "./staff-registry.js";
import { callRunnerControlCore } from "./runner-control-core.js";
import { runnerControlError } from "./runner-control.js";
import { runnerCleanupTool, callRunnerCleanup, validateRunnerCleanupArguments } from "./runner-cleanup.js";
import { cloudUploadTool, callCloudUpload, validateCloudUploadArguments } from "./cloud-upload.js";
import { QA_SKILL_URI, qaSkillCatalogEntry, qaSkillResourceDescriptor, qaSkillResource } from "./qa-skill.js";
import { LOEW_NAMING_SKILL_URI, loewNamingSkillCatalogEntry, loewNamingSkillResourceDescriptor, loewNamingSkillResource } from "./loew-naming-skill.js";
import { EXECUTIVE_COMMUNICATION_SKILL_URI, executiveCommunicationSkillCatalogEntry, executiveCommunicationSkillResourceDescriptor, executiveCommunicationSkillResource } from "./executive-communication-skill.js";
import { isContextualRelayTool, contextualizeRelayTool, contextualPresentation } from "./relay-chat-ui.js";
import { RELAY_V2_PROBE_URI, relayV2ProbeDescriptor, relayV2ProbeResource } from "./relay-v2-probe.js";

export const RELAY_EXTENSION_VERSION = "1.9.9";

const createBranch = {
  name: "relay_source_create_branch",
  title: "Create a GitHub branch",
  description: "COMMAND — create one non-default GitHub branch through relay.SOURCE from a branch name or exact 40-character commit SHA. Call relay_source_inventory first when the live base/head is not already known. Relay reads the created ref back before returning; on an uncertain/conflict error, refresh inventory instead of replaying blindly.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      branch: { type: "string" },
      base: { type: "string", default: "main", description: "Base branch name or exact 40-character commit SHA." }
    },
    required: ["repo", "branch"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
};

const lifecycle = [
  {
    name: "relay_source_inventory",
    title: "Inspect GitHub branches and PR heads",
    description: "DISCOVERY QUERY — read bounded branch/open-PR inventory plus exact head SHAs through relay.SOURCE. Safe to retry. Use this before branch or pull-request mutations when the current head/base is not already known.",
    inputSchema: {
      type: "object",
      properties: { owner: { type: "string" }, repo: { type: "string" } },
      required: ["repo"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  },
  {
    name: "relay_source_pull_request_action",
    title: "Act on an exact-head pull request",
    description: "COMMAND — mutate one pull request at an exact expected head: update metadata, mark ready, or merge. Read the PR/head first; merge also verifies green checks/statuses server-side and never bypasses protection. Side effects depend on action. If the head changes or outcome is uncertain, refresh the PR/check state before any retry.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        number: { type: "integer", minimum: 1, maximum: 1000000 },
        action: { type: "string", enum: ["update", "ready", "merge"] },
        expected_head_sha: { type: "string", pattern: "^[a-fA-F0-9]{40}$" },
        title: { type: "string" },
        body: { type: "string" },
        base: { type: "string" },
        merge_method: { type: "string", enum: ["merge", "squash", "rebase"], default: "squash" }
      },
      required: ["repo", "number", "action", "expected_head_sha"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  }
];

export function augmentToolList(tools) {
  const list = Array.isArray(tools) ? tools : [];
  const old = list.find(tool => tool.name === createBranch.name);
  const schemes = old?.securitySchemes || list[0]?.securitySchemes || [{ type: "oauth2", scopes: [] }];
  const replacement = {
    ...(old || {}),
    ...createBranch,
    securitySchemes: schemes,
    _meta: { ...(old?._meta || {}), securitySchemes: schemes }
  };
  const extensionTools = [contextTool, jobsTool, nightShiftTool, skillsTool, ...lifecycle, ...sourceTextMutationTools, staffDirectoryTool, runnerCleanupTool, cloudUploadTool, uiApiTool];
  const names = new Set(extensionTools.map(tool => tool.name));
  const sourceDescriptions = {
    relay_source_file: "QUERY — read one UTF-8 repository file through relay.SOURCE. Safe to retry. Use its blob SHA as the expected identity before exact text mutation when applicable.",
    relay_source_checks: "QUERY — read check runs for one commit or branch through relay.SOURCE. Safe to retry. Read checks before a merge decision; relay_source_pull_request_action rechecks them server-side for merge.",
    relay_source_update_file: "COMMAND — create or replace one UTF-8 file on a non-default branch through relay.SOURCE using configured GitHub source auth (GitHub App preferred). Direct default-branch writes are blocked. Read the current branch/file first and pass expected identities when available; refresh after conflicts instead of overwriting.",
    relay_source_open_pull_request: "COMMAND — open a pull request through relay.SOURCE. Create/update the admitted non-default branch first. Draft is the normal safe default; opening a PR does not imply checks, merge, deployment, or runtime correctness.",
    relay_runner_cleanup: "COMMAND — dry-run or delete only completed, accounted managed branches whose current heads and merged-PR identities still match Runner completion evidence. Use dry-run before execute; cleanup never deletes active/unaccounted work.",
    relay_ui_request: "COMMAND / APP TRANSPORT — call one allowlisted Relay operator API route using the authenticated app identity. GET is read-only; POST can toggle/run/repair worker state or submit bounded QA. Route and method are validated server-side; this is not a generic HTTP escape hatch.",
    relay_control_status: "DISCOVERY / HEALTH CHECK — report Relay namespace readiness, source/cloud auth mode, and bounded write capability. Safe to retry. Use this at the start of substantial Relay work when current capability/authority is not already known."
  };
  const kept = list
    .filter(tool => tool.name !== createBranch.name && !names.has(tool.name))
    .map(tool => sourceDescriptions[tool.name] ? { ...tool, description: sourceDescriptions[tool.name] } : tool)
    .map(contextualizeRelayTool)
    .map(tool => ['relay_runner_projects','relay_runner_progress','relay_runner_assignments'].includes(tool.name) ? {...tool,_meta:{...tool._meta,ui:{visibility:['model','app']},'openai/widgetAccessible':true}} : tool);
  return [
    ...kept,
    contextualizeRelayTool(replacement),
    ...extensionTools.map(tool => contextualizeRelayTool({
      ...tool,
      ...(sourceDescriptions[tool.name] ? { description: sourceDescriptions[tool.name] } : {}),
      securitySchemes: schemes,
      _meta: { ...(tool._meta || {}), securitySchemes: schemes }
    }))
  ];
}

export function augmentResourceList(resources) {
  const list = Array.isArray(resources) ? [...resources] : [];
  if (!list.some(resource => resource?.uri === RELAY_V2_PROBE_URI)) list.push(relayV2ProbeDescriptor());
  if (!list.some(resource => resource?.uri === QA_SKILL_URI)) list.push(qaSkillResourceDescriptor());
  if (!list.some(resource => resource?.uri === LOEW_INTERFACE_SKILL_URI)) list.push(loewInterfaceSkillResourceDescriptor());
  if (!list.some(resource => resource?.uri === LOEW_NAMING_SKILL_URI)) list.push(loewNamingSkillResourceDescriptor());
  if (!list.some(resource => resource?.uri === EXECUTIVE_COMMUNICATION_SKILL_URI)) list.push(executiveCommunicationSkillResourceDescriptor());
  return list;
}

export function augmentSkillList(skills) {
  const list = Array.isArray(skills) ? [...skills] : [];
  if (!list.some(skill => skill?.uri === QA_SKILL_URI)) list.push(qaSkillCatalogEntry());
  if (!list.some(skill => skill?.uri === LOEW_INTERFACE_SKILL_URI)) list.push(loewInterfaceSkillCatalogEntry());
  if (!list.some(skill => skill?.uri === LOEW_NAMING_SKILL_URI)) list.push(loewNamingSkillCatalogEntry());
  if (!list.some(skill => skill?.uri === EXECUTIVE_COMMUNICATION_SKILL_URI)) list.push(executiveCommunicationSkillCatalogEntry());
  return list;
}

function rpcResult(id, result, sourceHeaders) {
  return responseJson({ jsonrpc: "2.0", id, result }, 200, sourceHeaders);
}

export function validateLifecycleArguments(name, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object");
  const common = ["owner", "repo"];
  let allowed, required;
  if (name === "relay_source_inventory") {
    allowed = common; required = ["repo"];
  } else if (name === "relay_source_create_branch") {
    allowed = [...common, "branch", "base"]; required = ["repo", "branch"];
  } else if (name === "relay_source_pull_request_action") {
    allowed = [...common, "number", "action", "expected_head_sha", "title", "body", "base", "merge_method"];
    required = ["repo", "number", "action", "expected_head_sha"];
  } else throw new Error("Unknown source lifecycle tool");
  for (const key of Object.keys(args)) if (!allowed.includes(key)) throw new Error(`Unsupported argument: ${key}`);
  for (const key of required) if (!(key in args)) throw new Error(`Missing required argument: ${key}`);

  if (name === "relay_source_pull_request_action") {
    const action = args.action;
    if (!["update", "ready", "merge"].includes(action)) throw new Error("Unsupported pull request action");
    const supplied = key => key in args;
    if (action === "update" && !["title", "body", "base"].some(supplied)) throw new Error("Metadata update requires title, body, or base");
    if (action === "ready" && ["title", "body", "base", "merge_method"].some(supplied)) throw new Error("Ready action does not accept update or merge fields");
    if (action === "merge" && ["title", "body", "base"].some(supplied)) throw new Error("Merge action does not accept metadata fields");
  }
  return args;
}

function responseJson(payload, status = 200, sourceHeaders) {
  const headers = new Headers(sourceHeaders || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.delete("content-length");
  return new Response(JSON.stringify(payload), { status, headers });
}
async function rewrite(response, mutate) {
  const body = await response.text();
  let payload;
  try { payload = JSON.parse(body); } catch { return new Response(body, { status: response.status, headers: response.headers }); }
  mutate(payload);
  return responseJson(payload, response.status, response.headers);
}
function patchVersion(payload) {
  if (payload?.version) payload.version = RELAY_EXTENSION_VERSION;
  if (payload?.result?.serverInfo?.version) payload.result.serverInfo.version = RELAY_EXTENSION_VERSION;
  const structured = payload?.result?.structuredContent;
  if (structured?.version) structured.version = RELAY_EXTENSION_VERSION;
  const content = payload?.result?.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item?.type !== "text" || typeof item.text !== "string") continue;
      try {
        const value = JSON.parse(item.text);
        if (value?.version) {
          value.version = RELAY_EXTENSION_VERSION;
          item.text = JSON.stringify(value);
        }
      } catch {}
    }
  }
}

function isExtensionTool(name) {
  return name === contextTool.name || name === jobsTool.name || name === nightShiftTool.name || name === skillsTool.name || name === uiApiTool.name || name === createBranch.name || lifecycle.some(tool => tool.name === name) || isSourceTextMutationTool(name) || name === staffDirectoryTool.name || name === runnerCleanupTool.name || name === cloudUploadTool.name;
}
async function authProbe(request, message, env) {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const probe = {
    jsonrpc: "2.0",
    id: message.id ?? null,
    method: "tools/call",
    params: { name: "__relay_extension_auth_probe__", arguments: {} }
  };
  return legacy.fetch(new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify(probe)
  }), env);
}
async function readMcp(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/mcp" || request.method !== "POST" || !request.headers.get("content-type")?.startsWith("application/json")) return null;
  const raw = await readMcpBody(request);
  try { return JSON.parse(raw); } catch { return null; }
}
function toolResult(id, result, name) {
  if (isContextualRelayTool(name)) result = contextualPresentation(result);
  return responseJson({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result
    }
  });
}
export function classifyExtensionError(error, toolName = "") {
  const message = error instanceof Error ? error.message : "Relay extension action failed";
  const status = Number(error?.status || 0);
  const lower = message.toLowerCase();
  const mutation = /(_create_|_update_|_edit_|_append_|_open_|_action$|_cleanup$|_upload_|_deploy_)/.test(toolName);
  let errorClass = "provider";
  if (error?.code === 'rate_limit') errorClass = 'rate_limit';
  else if (status === 401 || /auth|credential|token/.test(lower)) errorClass = "auth";
  else if (status === 403 || /permission|restricted|not authorized|refuses direct/.test(lower)) errorClass = "permission";
  else if (status === 404 || /not found|does not exist/.test(lower)) errorClass = "not_found";
  else if (status === 409 || /changed; refresh|differs from|reconcile before retry|expected .* but found/.test(lower)) errorClass = "conflict";
  else if (status === 429 || /capacity|rate limit/.test(lower)) errorClass = "capacity";
  else if (error?.name === "TimeoutError" || /timed out|timeout/.test(lower)) errorClass = mutation ? "uncertain_write" : "timeout";
  else if (/invalid |missing required|unsupported |does not accept|requires title|must be /.test(lower)) errorClass = "validation";
  else if (mutation && /outcome cannot be verified|readback/.test(lower)) errorClass = "uncertain_write";

  const upstream=errorClass==='rate_limit'?runnerControlError(error).error.upstream:undefined;
  const retryAt=upstream?.retry_at||(Number.isSafeInteger(upstream?.rate_limit_reset)?new Date(upstream.rate_limit_reset*1000).toISOString():
    Number.isSafeInteger(upstream?.retry_after_seconds)?new Date(Date.now()+upstream.retry_after_seconds*1000).toISOString():null);
  const retryable = ["capacity", "timeout"].includes(errorClass);
  const recovery = errorClass === 'rate_limit'
    ? (retryAt?'Wait until '+retryAt+' before sending another request through this GitHub connection.':'Respect the provider quota deadline before sending another request through this GitHub connection.')+
      ' A tool refresh does not reset quota. Reconcile the affected resource before retrying a mutation.'
    : errorClass === "validation"
    ? "Correct the arguments from the tool schema; do not retry unchanged."
    : errorClass === "auth"
      ? "Restore/refresh the authorized Relay connection, then retry."
      : errorClass === "permission"
        ? "Refresh Relay authority/project policy. Do not substitute an unauthorized writer."
        : errorClass === "conflict"
          ? "Re-read the current resource/head and reconcile before retrying."
          : errorClass === "uncertain_write"
            ? "Read back the affected resource first; never replay the mutation blindly."
            : errorClass === "not_found"
              ? "Refresh discovery/inventory and confirm the identifier before retrying."
              : errorClass === "capacity"
                ? "Retry after the provider capacity/rate-limit condition clears."
                : errorClass === "timeout"
                  ? "The read-only request may be retried after a bounded delay."
                  : mutation
                    ? "Read back the affected resource before deciding whether another mutation is safe."
                    : "Retry only after checking Relay/provider health.";
  return {
    class: errorClass,
    message,
    retryable,
    requires_auth: errorClass === "auth",
    requires_user: false,
    recovery,
    ...(upstream?{upstream}:{}),
    ...(retryAt?{retry_at:retryAt}:{})
  };
}
function toolError(id, error, toolName = "") {
  const classified = classifyExtensionError(error, toolName);
  const structured = { ok: false, namespace: "relay", tool: toolName || null, error: classified, checked_at: new Date().toISOString() };
  return responseJson({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: classified.message }],
      structuredContent: structured,
      isError: true
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let message;
    try { message = await readMcp(request); }
    catch (error) { return mcpBodyErrorResponse(error); }

    if (message?.method === "tools/call" && isExtensionTool(message.params?.name)) {
      const auth = await authProbe(request, message, env);
      if (auth.status !== 200) return auth;
      try {
        const name = message.params.name;
        let result;
        if (name === uiApiTool.name) {
          result = await callUiApi(message.params?.arguments || {}, env, { rpc: async method => {
            if(!['initialize','ping','tools/list'].includes(method))throw Error('Unsupported panel discovery method');
            const response=await legacy.fetch(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({jsonrpc:'2.0',id:0,method})}),env);
            if(response.status!==200)throw Error('MCP handshake unavailable');
            const body=await response.json();if(body.error)throw Error('MCP handshake failed');
            if(method==='tools/list')body.result.tools=augmentToolList(body.result.tools);
            if(method==='initialize')patchVersion(body);
            return body.result;
          } });
        } else if (name === contextTool.name) {
          result = await callContext(message.params?.arguments || {}, env);
        } else if (name === jobsTool.name) {
          result = await callJobs(message.params?.arguments || {}, env);
        } else if (name === nightShiftTool.name) {
          result = await callNightShift(message.params?.arguments || {}, env);
        } else if (name === skillsTool.name) {
          result = await callSkills(message.params?.arguments || {}, undefined, env);
        } else if (name === runnerCleanupTool.name) {
          const args = validateRunnerCleanupArguments(message.params?.arguments || {});
          result = await callRunnerCleanup(args, env);
        } else if (name === cloudUploadTool.name) {
          const args = validateCloudUploadArguments(message.params?.arguments || {});
          result = await callCloudUpload(args, env);
        } else if (name === staffDirectoryTool.name) {
          const args = validateStaffDirectoryArguments(message.params?.arguments || {});
          const bindings=args.project ? await callRunnerControlCore("relay_runner_assignments",{project:args.project},env) : null;
          result = {...callStaffDirectory(args,undefined,bindings?.claims||[]),bindings_source:bindings?{project:args.project,record_sha:bindings.record_sha}:null};
        } else if (isSourceTextMutationTool(name)) {
          const args = validateSourceTextMutationArguments(name, message.params?.arguments || {});
          result = await callSourceTextMutationTool(name, args, env);
        } else {
          const args = validateLifecycleArguments(name, message.params?.arguments || {});
          result = await callSourceLifecycleTool(name, args, env);
        }
        return toolResult(message.id ?? null, result, name);
      } catch (error) {
        return toolError(message.id ?? null, error, message.params?.name || "");
      }
    }

    const response = await legacy.fetch(request, env);

    if (url.pathname === "/health" || url.pathname === "/") {
      return rewrite(response, patchVersion);
    }
    if (!message) return response;

    if (message.method === "initialize") return rewrite(response, patchVersion);
    if (message.method === "resources/list") {
      return rewrite(response, payload => {
        patchVersion(payload);
        if (payload?.result?.resources) payload.result.resources = augmentResourceList(payload.result.resources);
      });
    }
    if (message.method === "resources/read" && response.status === 200) {
      if (message.params?.uri === RELAY_V2_PROBE_URI) return rpcResult(message.id ?? null, { contents: [relayV2ProbeResource()] }, response.headers);
      if (message.params?.uri === QA_SKILL_URI) return rpcResult(message.id ?? null, { contents: [qaSkillResource()] }, response.headers);
      if (message.params?.uri === LOEW_INTERFACE_SKILL_URI) return rpcResult(message.id ?? null, { contents: [loewInterfaceSkillResource()] }, response.headers);
      if (message.params?.uri === LOEW_NAMING_SKILL_URI) return rpcResult(message.id ?? null, { contents: [loewNamingSkillResource()] }, response.headers);
      if (message.params?.uri === EXECUTIVE_COMMUNICATION_SKILL_URI) return rpcResult(message.id ?? null, { contents: [executiveCommunicationSkillResource()] }, response.headers);
    }
    if (message.method === "skills/list") {
      return rewrite(response, payload => {
        patchVersion(payload);
        if (payload?.result?.skills) payload.result.skills = augmentSkillList(payload.result.skills);
      });
    }
    if (message.method === "skills/get" && response.status === 200) {
      if (message.params?.uri === QA_SKILL_URI) return rpcResult(message.id ?? null, { skill: qaSkillCatalogEntry() }, response.headers);
      if (message.params?.uri === LOEW_INTERFACE_SKILL_URI) return rpcResult(message.id ?? null, { skill: loewInterfaceSkillCatalogEntry() }, response.headers);
      if (message.params?.uri === LOEW_NAMING_SKILL_URI) return rpcResult(message.id ?? null, { skill: loewNamingSkillCatalogEntry() }, response.headers);
      if (message.params?.uri === EXECUTIVE_COMMUNICATION_SKILL_URI) return rpcResult(message.id ?? null, { skill: executiveCommunicationSkillCatalogEntry() }, response.headers);
    }
    if (message.method === "tools/list") {
      return rewrite(response, payload => {
        patchVersion(payload);
        if (payload?.result?.tools) payload.result.tools = augmentToolList(payload.result.tools);
      });
    }
    if (message.method === "tools/call" && isContextualRelayTool(message.params?.name)) {
      return rewrite(response, payload => {
        const data = payload?.result?.structuredContent;
        if (data) payload.result.structuredContent = contextualPresentation(data);
      });
    }
    if (message.method === "tools/call" && ["relay_control_status", "relay_ui_control_center"].includes(message.params?.name)) {
      return rewrite(response, patchVersion);
    }
    return response;
  }
};
