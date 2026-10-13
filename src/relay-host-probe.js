// Isolated diagnostic. Existing Relay cards remain the comparison controls.
export const HOST_PROBE_BUILD = "20261001.1";
export const HOST_PROBE_TOOL = "relay_test_card_connection";
export const HOST_PROBE_URI = `ui://relay/host-proof/${HOST_PROBE_BUILD}.html`;
export const HOST_PROBE_PROTOCOL = "2026-01-26";

export function hostProbeTool() {
  return {
    name: HOST_PROBE_TOOL, title: "Relay card connection test",
    description: "DIAGNOSTIC, READ ONLY — show a small Relay test card to check whether this chat can display and connect an MCP App. Use only for an explicitly requested card connection test. Does not start work or change project data. Keep the text result if no card appears.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { resourceUri: HOST_PROBE_URI, visibility: ["model", "app"] },
      "openai/outputTemplate": HOST_PROBE_URI, "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Checking the card connection…",
      "openai/toolInvocation/invoked": "Card test returned." }
  };
}

export function hostProbeDescriptor() {
  return { uri: HOST_PROBE_URI, name: "relay-host-proof", title: "Relay card connection test",
    mimeType: "text/html;profile=mcp-app", description: "Read-only diagnostic milestones; not a project dashboard." };
}

export function hostProbeResult(args, request, meta = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length) {
    throw new Error("The card connection test accepts no arguments.");
  }
  const hint = value => typeof value === "string" ? value.slice(0, 240) : null;
  const data = { schema: "relay-host-proof/v1", build_id: HOST_PROBE_BUILD, resource_uri: HOST_PROBE_URI,
    sample_id: crypto.randomUUID(), observed_at: new Date().toISOString(),
    request_hints: { http_user_agent: hint(request?.headers?.get("user-agent")),
      openai_user_agent: hint(meta?.["openai/userAgent"]) },
    execution: "read-only diagnostic; no executor started" };
  return { structuredContent: data, content: [{ type: "text", text:
    `Relay card test ${HOST_PROBE_BUILD} returned successfully. This confirms the server answered, not that a card appeared. If you see the test card, select “Check connection” once. Sample ${data.sample_id}.` }] };
}

// Literal browser source survives Worker bundlers without capturing their helpers.
// One self-contained program; no toString serialization or replacement bootstraps.
const HOST_PROBE_SCRIPT = String.raw`(function startHostProbe(config) {
  const byId = id => document.getElementById(id);
  const mark = (id, text, state = "pass") => {
    byId(id).textContent = text;
    byId(id).dataset.state = state;
  };
  const details = { build: config.build, transport: "standard MCP Apps postMessage", host: null,
    request_hints: null, dimensions: null, events: [] };
  const record = event => {
    details.events.push({ event, elapsed_ms: Math.round(performance.now()) });
    details.events = details.events.slice(-20);
    byId("diagnostics").textContent = JSON.stringify(details, null, 2);
  };
  let connected = false, stopped = false, nextId = 0, resizeObserver;
  const pending = new Map();
  let resultTimer, resultState = "waiting";
  const post = message => window.parent.postMessage({ jsonrpc: "2.0", ...message }, "*");
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = "relay-proof-" + ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("The host did not answer in time.")); }, 10000);
    pending.set(id, { resolve, reject, timer });
    post({ id, method, params });
  });
  const text = value => typeof value === "string" ? value.slice(0, 240) : null;
  function sample(result) {
    const data = result?.structuredContent;
    if (result?.isError || data?.schema !== "relay-host-proof/v1" || data?.build_id !== config.build
      || data?.resource_uri !== config.uri || typeof data?.sample_id !== "string"
      || typeof data?.observed_at !== "string") throw new Error("The returned sample does not match this card build.");
    return data;
  }
  function receiveResult(result) {
    if (resultState === "cancelled") return;
    clearTimeout(resultTimer);
    try {
      const data = sample(result);
      byId("sample").textContent = data.observed_at + " · " + data.sample_id;
      details.request_hints = { http_user_agent: text(data.request_hints?.http_user_agent),
        openai_user_agent: text(data.request_hints?.openai_user_agent) };
      resultState = "received"; mark("result", "Data arrived"); record("tool-result");
    } catch (error) { resultState = "invalid"; mark("result", error.message, "error"); record("tool-result-invalid"); }
  }
  function measure() {
    if (stopped) return;
    const padding = getComputedStyle(document.body);
    const height = Math.ceil(byId("card").getBoundingClientRect().height
      + parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom));
    const width = document.documentElement.clientWidth;
    const old = details.dimensions;
    if (old?.height === height && old?.width === width) return;
    details.dimensions = { width, height, sent_to_host: connected };
    mark("size", width + " × " + height + " pixels" + (connected ? " · size sent" : " · measured"));
    if (connected) post({ method: "ui/notifications/size-changed", params: { height } });
    record("dimensions");
  }
  function stop() {
    stopped = true; connected = false; clearTimeout(resultTimer); resizeObserver?.disconnect();
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error("The card was closed.")); }
    pending.clear(); byId("check").disabled = true;
    window.removeEventListener("message", onMessage); window.removeEventListener("resize", measure);
  }
  function onMessage(event) {
    if (event.source !== window.parent || !event.data || typeof event.data !== "object" || event.data.jsonrpc !== "2.0") return;
    const message = event.data;
    if (!message.method && pending.has(message.id)) {
      const p = pending.get(message.id); pending.delete(message.id); clearTimeout(p.timer);
      message.error ? p.reject(new Error(text(message.error.message) || "The host declined the request.")) : p.resolve(message.result);
      return;
    }
    if (message.method === "ui/notifications/tool-result") receiveResult(message.params);
    if (message.method === "ui/notifications/tool-cancelled") {
      clearTimeout(resultTimer); resultState = "cancelled";
      mark("result", "The host cancelled this result.", "error"); record("tool-cancelled");
    }
    if (message.method === "ui/resource-teardown" && message.id !== undefined) { post({ id: message.id, result: {} }); stop(); }
  }
  mark("script", "Script started"); record("script-started");
  window.addEventListener("message", onMessage);
  window.addEventListener("resize", measure);
  if (typeof ResizeObserver === "function") { resizeObserver = new ResizeObserver(measure); resizeObserver.observe(byId("card")); }
  resultTimer = setTimeout(() => {
    if (resultState === "waiting") { mark("result", "Still waiting for data", "waiting"); record("tool-result-waiting"); }
  }, 15000);
  measure();
  byId("check").addEventListener("click", async () => {
    if (!connected || stopped || byId("check").disabled) return;
    byId("check").disabled = true; mark("action", "Checking…", "waiting"); record("action-requested");
    try {
      const data = sample(await request("tools/call", { name: config.tool, arguments: {} }));
      byId("action-sample").textContent = data.observed_at + " · " + data.sample_id;
      mark("action", "Read-only check worked"); record("action-result");
    } catch (error) { mark("action", error.message, "error"); record("action-error"); }
    finally { if (!stopped) byId("check").disabled = false; }
  });
  request("ui/initialize", { appInfo: { name: "relay-host-proof", version: config.build }, appCapabilities: {}, protocolVersion: config.protocol })
    .then(result => {
      if (stopped) return;
      if (result?.protocolVersion !== config.protocol) throw new Error("The host returned a different UI protocol; this test cannot continue.");
      if (typeof result.hostInfo?.name !== "string" || typeof result.hostInfo?.version !== "string"
        || !result.hostCapabilities || typeof result.hostCapabilities !== "object" || Array.isArray(result.hostCapabilities)
        || !result.hostContext || typeof result.hostContext !== "object" || Array.isArray(result.hostContext)) throw new Error("The host returned incomplete initialization data.");
      details.host = { name: text(result.hostInfo.name), version: text(result.hostInfo.version),
        platform: text(result.hostContext.platform), display_mode: text(result.hostContext.displayMode),
        capabilities: Object.keys(result.hostCapabilities).slice(0, 30), protocol: result.protocolVersion };
      connected = true; post({ method: "ui/notifications/initialized", params: {} });
      mark("init", "Host connected"); record("initialized");
      if (result.hostCapabilities.serverTools && typeof result.hostCapabilities.serverTools === "object") {
        byId("check").disabled = false; mark("action", "Ready to check", "waiting");
      } else mark("action", "This host did not offer tool calls", "unsupported");
      details.dimensions = null; measure();
    }).catch(error => { if (!stopped) { mark("init", error.message, "error"); mark("action", "Needs a host connection", "waiting"); record("initialization-error"); } });
})`;

export function hostProbeResource() {
  const config = { build: HOST_PROBE_BUILD, uri: HOST_PROBE_URI, tool: HOST_PROBE_TOOL, protocol: HOST_PROBE_PROTOCOL };
  return { uri: HOST_PROBE_URI, mimeType: "text/html;profile=mcp-app", _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } },
    "openai/widgetDescription": "Read-only Relay connection test. A successful tool result alone does not prove this card is visible.",
    "openai/ui": { availableDisplayModes: ["inline"] } }, text: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html{color-scheme:light dark}body{margin:0;padding:12px;font:14px/1.45 system-ui,sans-serif;color:CanvasText;background:Canvas}main{max-width:540px;margin:auto}h1{font-size:20px;margin:0 0 6px}p{margin:8px 0;overflow-wrap:anywhere}ol{padding-left:24px}li{padding:4px 0}button{font:inherit;padding:10px 14px;min-height:44px;max-width:100%;cursor:pointer}button:focus-visible,summary:focus-visible{outline:2px solid currentColor;outline-offset:3px}button:disabled{cursor:default}small,pre{overflow-wrap:anywhere;white-space:pre-wrap}pre{font-size:12px;max-height:220px;overflow:auto}details{margin-top:12px}[data-state=error]{font-weight:700}#sample,#action-sample{font-size:11px}body{padding-top:max(12px,env(safe-area-inset-top));padding-bottom:max(12px,env(safe-area-inset-bottom))}
</style></head><body><main id="card"><h1>relay · connection test</h1><p>This checks the card connection. It does not change your work.</p><small>Build ${HOST_PROBE_BUILD}</small>
<ol aria-label="Connection milestones"><li id="static">Card appeared</li><li id="script">Waiting for script</li><li id="init">Waiting for host</li><li id="result">Waiting for data</li><li id="size">Waiting for dimensions</li><li id="action">Waiting to check</li></ol>
<p id="sample"></p><button id="check" type="button" disabled>Check connection</button><p id="action-sample"></p><p>The whole card and button should be reachable. “Size sent” does not confirm the host used that size.</p>
<details><summary>Technical details</summary><p>Host names and request hints are informational, not permissions or proof of local computer access.</p><pre id="diagnostics"></pre></details>
</main><script>${HOST_PROBE_SCRIPT}(${JSON.stringify(config)});</script></body></html>` };
}
