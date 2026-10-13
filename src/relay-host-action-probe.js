// Bounded comparison only. The released host probe remains an unchanged control.
export const ACTION_PROBE_BUILD = "20261001.1";
export const ACTION_PROBE_URI = `ui://relay/host-action-proof/${ACTION_PROBE_BUILD}.html`;
export const ACTION_PROBE_TOOL = "relay_test_card_action";
export const ACTION_SAMPLE_TOOL = "relay_card_action_sample";
const PROTOCOL = "2026-01-26";

export function actionProbeTools() {
  const common = { inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } };
  return [
    { ...common, name: ACTION_PROBE_TOOL, title: "Relay card action comparison",
      description: "DIAGNOSTIC, READ ONLY — use only when explicitly asked for Relay's card action comparison. Opens an isolated test card whose button calls a separate data-only tool. Keep the text result; server success does not prove card rendering or action success. Does not start work or change project data.",
      _meta: { ui: { resourceUri: ACTION_PROBE_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": ACTION_PROBE_URI, "openai/widgetAccessible": true } },
    { ...common, name: ACTION_SAMPLE_TOOL, title: "Read a Relay card action sample",
      description: "Read-only sample for the explicitly opened card action comparison. Returns data only; never opens a card, starts work or changes project data.",
      _meta: { ui: { visibility: ["app"] }, "openai/widgetAccessible": true } }
  ];
}

export function actionProbeDescriptor() {
  return { uri: ACTION_PROBE_URI, name: "relay-host-action-proof", title: "Relay card action comparison",
    mimeType: "text/html;profile=mcp-app" };
}

export function actionProbeResult(args, kind) {
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length) throw new Error("The card action comparison accepts no arguments.");
  if (!["initial", "action"].includes(kind)) throw new Error("Unknown card action sample kind.");
  const data = { schema: "relay-host-action-proof/v1", build_id: ACTION_PROBE_BUILD, resource_uri: ACTION_PROBE_URI,
    kind, sample_id: crypto.randomUUID(), observed_at: new Date().toISOString(), execution: "read-only diagnostic; no executor started" };
  return { structuredContent: data, content: [{ type: "text", text: kind === "initial"
    ? `Relay card action comparison ${ACTION_PROBE_BUILD} returned. This confirms a server answer, not a visible card or working button. If the comparison card appears, select “Check data action” once. Sample ${data.sample_id}.`
    : `Relay returned a read-only data action sample ${data.sample_id}. No work started and no project data changed.` }] };
}

// Keep browser code literal: Worker bundling must not inject out-of-frame helpers.
const SCRIPT = String.raw`(function startActionProbe(config) {
  const el = id => document.getElementById(id);
  const mark = (id, text, state = "pass") => { el(id).textContent = text; el(id).dataset.state = state; };
  const info = { build: config.build, resource: config.uri, transport: "standard MCP Apps postMessage",
    action_tool: config.actionTool, timeout_ms: 10000, host: null, dimensions: null, events: [] };
  const record = (event, fields = {}) => {
    info.events.push({ event, elapsed_ms: Math.round(performance.now()), ...fields });
    info.events = info.events.slice(-40);
    el("diagnostics").textContent = JSON.stringify(info, null, 2);
  };
  let stopped = false, connected = false, cancelled = false, nextId = 0, initialState = "waiting", observer;
  let initialTimer;
  const pending = new Map(), expired = new Map();
  const post = value => window.parent.postMessage({ jsonrpc: "2.0", ...value }, "*");
  const short = value => typeof value === "string" ? value.slice(0, 160) : null;
  const responseType = m => m.error ? "error" : Object.hasOwn(m, "result") ? "result" : "malformed";
  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = "relay-action-proof-" + ++nextId;
      const started = performance.now();
      const timer = setTimeout(() => {
        pending.delete(id); expired.set(id, { method, started });
        if (expired.size > 8) expired.delete(expired.keys().next().value);
        record("request-timeout", { id, method, waited_ms: Math.round(performance.now() - started) });
        reject(new Error("No matching reply within 10 seconds. Open Technical details."));
      }, 10000);
      pending.set(id, { method, started, timer, resolve, reject });
      record("request-sent", { id, method, ...(method === "tools/call" ? { tool: config.actionTool } : {}) });
      post({ id, method, params });
    });
  }
  function sample(result, kind) {
    const d = result?.structuredContent;
    if (result?.isError || d?.schema !== "relay-host-action-proof/v1" || d.build_id !== config.build
      || d.resource_uri !== config.uri || d.kind !== kind || typeof d.sample_id !== "string"
      || typeof d.observed_at !== "string") throw new Error("The reply did not contain the expected comparison sample.");
    return d;
  }
  function receiveResult(result) {
    if (cancelled || stopped) return;
    // An action notification is diagnostic evidence, not a correlated request reply.
    if (result?.structuredContent?.kind === "action") {
      try { sample(result, "action"); record("action-result-notification", { correlated_reply: false }); }
      catch { record("action-result-notification-invalid"); }
      return;
    }
    clearTimeout(initialTimer);
    try {
      const d = sample(result, "initial"); initialState = "received";
      el("sample").textContent = d.observed_at + " · " + d.sample_id;
      mark("result", "Data arrived"); record("initial-result");
    } catch (error) { initialState = "invalid"; mark("result", error.message, "error"); record("initial-result-invalid"); }
  }
  function measure() {
    if (stopped) return;
    const p = getComputedStyle(document.body);
    const height = Math.ceil(el("card").getBoundingClientRect().height + parseFloat(p.paddingTop) + parseFloat(p.paddingBottom));
    const width = document.documentElement.clientWidth;
    if (info.dimensions?.width === width && info.dimensions?.height === height) return;
    info.dimensions = { width, height, sent_to_host: connected };
    mark("size", width + " × " + height + " pixels" + (connected ? " · size sent" : " · measured"));
    if (connected) post({ method: "ui/notifications/size-changed", params: { height } });
    record("dimensions");
  }
  function cancelPending(reason) {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    pending.clear(); expired.clear();
  }
  function stop() {
    stopped = true; connected = false; clearTimeout(initialTimer); observer?.disconnect();
    cancelPending("The card was closed."); el("check").disabled = true;
    window.removeEventListener("message", onMessage); window.removeEventListener("resize", measure);
  }
  function onMessage(event) {
    if (event.source !== window.parent || !event.data || typeof event.data !== "object" || event.data.jsonrpc !== "2.0") return;
    const m = event.data;
    if (!m.method && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer);
      const type = responseType(m);
      record("response-received", { id: m.id, method: p.method, type, waited_ms: Math.round(performance.now() - p.started),
        ...(type === "error" && Number.isInteger(m.error.code) ? { error_code: m.error.code } : {}),
        ...(type === "result" ? { tool_error: m.result?.isError === true } : {}) });
      if (type === "error") p.reject(new Error("The host returned a request error."));
      else if (type === "malformed") p.reject(new Error("The host returned a malformed reply."));
      else p.resolve(m.result);
      return;
    }
    if (!m.method && expired.has(m.id)) {
      const p = expired.get(m.id); expired.delete(m.id);
      record("late-response", { id: m.id, method: p.method, type: responseType(m), waited_ms: Math.round(performance.now() - p.started) });
      return;
    }
    if (!m.method && Object.hasOwn(m, "id")) { record("unmatched-response", { id_type: typeof m.id, type: responseType(m) }); return; }
    if (m.method === "ui/notifications/tool-result") receiveResult(m.params);
    if (m.method === "ui/notifications/tool-cancelled") {
      cancelled = true; initialState = "cancelled"; clearTimeout(initialTimer); cancelPending("The host cancelled this card.");
      el("check").disabled = true; mark("result", "The host cancelled this card.", "error"); mark("action", "Cancelled", "error"); record("tool-cancelled");
    }
    if (m.method === "ui/resource-teardown" && m.id !== undefined) { post({ id: m.id, result: {} }); stop(); }
  }
  mark("script", "Script started"); record("script-started");
  window.addEventListener("message", onMessage); window.addEventListener("resize", measure);
  if (typeof ResizeObserver === "function") { observer = new ResizeObserver(measure); observer.observe(el("card")); }
  initialTimer = setTimeout(() => { if (initialState === "waiting") { mark("result", "Still waiting for data", "waiting"); record("initial-result-waiting"); } }, 15000);
  measure();
  el("check").addEventListener("click", async () => {
    if (!connected || stopped || cancelled || el("check").disabled) return;
    el("check").disabled = true; mark("action", "Checking data action…", "waiting"); record("action-requested");
    try {
      const d = sample(await request("tools/call", { name: config.actionTool, arguments: {} }), "action");
      if (stopped || cancelled) return;
      el("action-sample").textContent = d.observed_at + " · " + d.sample_id;
      mark("action", "Read-only data action worked"); record("action-result");
    } catch (error) { if (!stopped && !cancelled) { mark("action", error.message, "error"); record("action-error"); } }
    finally { if (!stopped && !cancelled) el("check").disabled = false; }
  });
  request("ui/initialize", { appInfo: { name: "relay-host-action-proof", version: config.build }, appCapabilities: {}, protocolVersion: config.protocol })
    .then(result => {
      if (stopped || cancelled) return;
      if (result?.protocolVersion !== config.protocol) throw new Error("The host returned a different UI protocol.");
      if (typeof result.hostInfo?.name !== "string" || typeof result.hostInfo?.version !== "string"
        || !result.hostCapabilities || typeof result.hostCapabilities !== "object" || Array.isArray(result.hostCapabilities)
        || !result.hostContext || typeof result.hostContext !== "object" || Array.isArray(result.hostContext)) throw new Error("The host returned incomplete initialization data.");
      info.host = { name: short(result.hostInfo.name), version: short(result.hostInfo.version),
        platform: short(result.hostContext.platform), display_mode: short(result.hostContext.displayMode),
        capabilities: Object.keys(result.hostCapabilities).slice(0, 30).map(short), protocol: result.protocolVersion };
      connected = true; post({ method: "ui/notifications/initialized", params: {} });
      mark("init", "Host connected"); record("initialized");
      const capability = result.hostCapabilities.serverTools;
      if (capability && typeof capability === "object" && !Array.isArray(capability)) {
        el("check").disabled = false; mark("action", "Ready to check data action", "waiting");
      } else mark("action", "This host did not offer tool calls", "unsupported");
      info.dimensions = null; measure();
    }).catch(error => { if (!stopped && !cancelled) { mark("init", error.message, "error"); mark("action", "Needs a host connection", "waiting"); record("initialization-error"); } });
})`;

export function actionProbeResource() {
  const config = { build: ACTION_PROBE_BUILD, uri: ACTION_PROBE_URI, actionTool: ACTION_SAMPLE_TOOL, protocol: PROTOCOL };
  return { uri: ACTION_PROBE_URI, mimeType: "text/html;profile=mcp-app",
    _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } },
      "openai/widgetDescription": "Read-only card action comparison. A server result is not proof of rendering or a working button.",
      "openai/ui": { availableDisplayModes: ["inline"] } }, text: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html{color-scheme:light dark}body{margin:0;padding:12px;font:14px/1.45 system-ui,sans-serif;color:CanvasText;background:Canvas}main{max-width:540px;margin:auto}h1{font-size:20px;margin:0 0 6px}p{margin:8px 0;overflow-wrap:anywhere}ol{padding-left:24px}li{padding:4px 0}button{font:inherit;padding:10px 14px;min-height:44px;max-width:100%;cursor:pointer}button:focus-visible,summary:focus-visible{outline:2px solid currentColor;outline-offset:3px}button:disabled{cursor:default}small,pre{overflow-wrap:anywhere;white-space:pre-wrap}pre{font-size:12px;max-height:220px;overflow:auto}details{margin-top:12px}[data-state=error]{font-weight:700}#sample,#action-sample{font-size:11px}body{padding-top:max(12px,env(safe-area-inset-top));padding-bottom:max(12px,env(safe-area-inset-bottom))}
</style></head><body><main id="card"><h1>relay · action comparison</h1><p>This checks a separate read-only data action. It does not change your work.</p><small>Action build ${ACTION_PROBE_BUILD}</small>
<ol aria-label="Connection milestones"><li>Card appeared</li><li id="script">Waiting for script</li><li id="init">Waiting for host</li><li id="result">Waiting for data</li><li id="size">Waiting for dimensions</li><li id="action">Waiting to check</li></ol>
<p id="sample"></p><button id="check" type="button" disabled>Check data action</button><p id="action-sample"></p><p>The whole card and button should be reachable. “Size sent” does not confirm the host used that size.</p>
<details><summary>Technical details</summary><p>Host labels describe the connection; they do not grant computer access. Late replies are recorded without changing a timed-out result.</p><pre id="diagnostics"></pre></details>
</main><script>${SCRIPT}(${JSON.stringify(config)});</script></body></html>` };
}
