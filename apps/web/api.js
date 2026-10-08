import { relayPanelResponse } from './panel-api.js';
import { handleApi } from "../../packages/runner/src/cloudflare-worker.mjs";

export const uiApiTool = {
  name: "relay_ui_request",
  title: "Use the Relay operator interface",
  description: "App-only transport for existing project, worker and artifact-bound review APIs. Uses the same records and guards as the Relay web app.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", maxLength: 12000 },
      method: { type: "string", enum: ["GET", "POST"], default: "GET" },
      body: { type: "object" }
    }, required: ["path"], additionalProperties: false
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  _meta: { ui: { visibility: ["app"] } }
};

export function validateUiRequest(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Invalid UI request");
  for (const key of Object.keys(args)) if (!["path", "method", "body"].includes(key)) throw new Error("Unsupported UI argument");
  const method = args.method || "GET";
  const path = args.path;
  if (typeof path !== "string" || path.length > 12000 || !path.startsWith("/api/") || /[\\#]/.test(path) || /[\\#%]/.test(new URL(path, "https://relay.loew.fi").pathname) || path.includes("..")) throw new Error("Invalid UI path");
  const url = new URL(path, "https://relay.loew.fi");
  const reads = /^\/api\/(?:execution\/jobs|night-shift\/items|feedback\/(?:status|binding)|health|progress\/[a-zA-Z0-9._-]+|projects(?:\/[a-zA-Z0-9._-]+(?:\/icon)?)?|workers|visual(?:\/runs(?:\/run_[a-zA-Z0-9._-]{8,128}\/review)?|\/compare|\/vis_[a-zA-Z0-9-]{8,128}(?:\/(?:image|qa|live))?)?)$/;
  const writes = /^\/api\/(?:execution\/request|night-shift\/request|relay\/(?:check|refresh)|feedback\/submit|workers\/[a-zA-Z0-9._-]+\/(?:toggle|settings|run|doctor|repair)|visual\/vis_[a-zA-Z0-9-]{8,128}\/qa)$/;
  if (url.pathname === '/api/autonomy' ? !['GET','POST'].includes(method) : method === "GET" ? !reads.test(url.pathname) : method !== "POST" || !writes.test(url.pathname)) throw new Error("UI route or method is not allowed");
  if (method === "GET" && args.body !== undefined) throw new Error("GET cannot contain a body");
  if (args.body !== undefined && (!args.body || typeof args.body !== "object" || Array.isArray(args.body))) throw new Error("Invalid UI body");
  if (JSON.stringify(args.body || {}).length > 16384) throw new Error("UI body exceeds limit");
  for (const key of url.searchParams.keys()) if (!(url.pathname==='/api/autonomy'?['scope']:["project", "environment", "pr", "run", "base", "current", "assignment", "report_id", "review_mode", "cursor", "source_cursor", "limit", "head_sha"]).includes(key)) throw new Error("Unsupported UI filter");
  return { path, method, body: args.body };
}

// Called only after the MCP gateway has verified its OAuth/Access identity.
// Trust is passed in process, never obtained from a caller-supplied header or argument.
export async function callUiApi(input, env, { rpc, accessJwt } = {}) {
  const args = validateUiRequest(input);
  const request = new Request("https://relay.loew.fi" + args.path, {
    method: args.method,
    headers: { "Content-Type": "application/json", Origin: "https://relay.loew.fi" },
    body: args.body === undefined ? undefined : JSON.stringify(args.body)
  });
  const response = await relayPanelResponse(request,{rpc}) || await handleApi(request, env, { authenticatedMcp: true, accessJwt });
  const content_type = response.headers.get("content-type") || "application/json";
  if (content_type.startsWith("image/")) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 4 * 1024 * 1024) throw new Error("Open this full-resolution image in the web review");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { status: response.status, content_type, base64: btoa(binary) };
  }
  return { status: response.status, content_type, body: await response.json() };
}
