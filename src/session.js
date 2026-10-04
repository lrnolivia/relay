import { normalizeViewport } from "./browser.js";
import { decodeBase64Bytes, storeEvidence, normalizeEvidenceContext } from "./evidence.js";

const SESSION_RE = /^[a-zA-Z0-9_-]{8,128}$/;
const TARGET_RE = /^[a-zA-Z0-9._:-]{1,256}$/;
const MAX_TRACE = 80;
const COMMAND_TIMEOUT_MS = 15000;

function assertSessionId(value) {
  if (typeof value !== "string" || !SESSION_RE.test(value)) throw new Error("Invalid browser session id");
  return value;
}

function assertTargetId(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !TARGET_RE.test(value)) throw new Error("Invalid browser target id");
  return value;
}

function sessionKey(sessionId) {
  return "sessions/" + assertSessionId(sessionId) + ".json";
}

async function readSession(bucket, sessionId) {
  if (!bucket?.get) throw new Error("Evidence R2 binding unavailable");
  const object = await bucket.get(sessionKey(sessionId));
  if (!object) throw new Error("Browser session record not found");
  const meta = await object.json();
  if (!meta || meta.session_id !== sessionId) throw new Error("Invalid browser session record");
  return meta;
}

async function writeSession(bucket, meta) {
  await bucket.put(sessionKey(meta.session_id), JSON.stringify(meta), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "private, max-age=0, no-store" },
    customMetadata: { status: meta.status, updatedAt: meta.updated_at }
  });
  return meta;
}

function appendTrace(meta, entry) {
  const trace = Array.isArray(meta.trace) ? meta.trace.slice(-MAX_TRACE + 1) : [];
  trace.push({ at: new Date().toISOString(), ...entry });
  meta.trace = trace;
  meta.updated_at = new Date().toISOString();
  return meta;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createCdpClient(socket) {
  let nextId = 1;
  const pending = new Map();
  const waiters = new Set();

  const failAll = (error) => {
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      task.reject(error);
    }
    pending.clear();
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    waiters.clear();
  };

  socket.addEventListener("message", event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(new Error(message.error.message || "CDP command failed"));
      else task.resolve(message.result || {});
      return;
    }
    for (const waiter of Array.from(waiters)) {
      if (message.method !== waiter.method) continue;
      if (waiter.sessionId && message.sessionId !== waiter.sessionId) continue;
      if (waiter.predicate && !waiter.predicate(message.params || {})) continue;
      waiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.resolve(message.params || {});
    }
  });
  socket.addEventListener("close", () => failAll(new Error("Browser session connection closed")));
  socket.addEventListener("error", () => failAll(new Error("Browser session connection failed")));

  const send = (method, params = {}, sessionId = null, timeoutMs = COMMAND_TIMEOUT_MS) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("CDP command timed out: " + method));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    socket.send(JSON.stringify(payload));
  });

  const waitFor = (method, options = {}) => new Promise((resolve, reject) => {
    const waiter = {
      method,
      sessionId: options.sessionId || null,
      predicate: options.predicate || null,
      resolve,
      reject,
      timer: null
    };
    waiter.timer = setTimeout(() => {
      waiters.delete(waiter);
      reject(new Error("Timed out waiting for " + method));
    }, options.timeoutMs || COMMAND_TIMEOUT_MS);
    waiters.add(waiter);
  });

  return {
    send,
    waitFor,
    close() {
      failAll(new Error("Browser connection closed"));
      try { socket.close(); } catch {}
    }
  };
}

async function connectTarget(binding, sessionId, targetId, accessJwt, viewport) {
  const sid = assertSessionId(sessionId);
  let target = assertTargetId(targetId);
  if (!target) {
    const targets = await binding.devtools.listTargets(sid);
    const page = (targets || []).find(item => item.type === "page");
    target = page?.id || page?.targetId;
  }
  if (!target) throw new Error("No browser page target found");

  const connection = await binding.connectSession(sid);
  const response = await connection.webSocket.fetch("https://browser-binding.invalid", {
    headers: { Upgrade: "websocket" }
  });
  if (!response.webSocket) throw new Error("Browser Run did not return a WebSocket");
  const socket = response.webSocket;
  socket.accept();
  const client = createCdpClient(socket);
  const attached = await client.send("Target.attachToTarget", { targetId: target, flatten: true });
  const pageSessionId = attached.sessionId;
  if (!pageSessionId) {
    client.close();
    throw new Error("Unable to attach to browser page");
  }

  await Promise.all([
    client.send("Page.enable", {}, pageSessionId),
    client.send("Runtime.enable", {}, pageSessionId),
    client.send("Network.enable", {}, pageSessionId)
  ]);
  await client.send("Network.setExtraHTTPHeaders", {
    headers: { "Cf-Access-Token": accessJwt }
  }, pageSessionId);
  const vp = normalizeViewport(viewport);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.deviceScaleFactor,
    mobile: false
  }, pageSessionId);
  return { client, pageSessionId, targetId: target, viewport: vp };
}

async function evaluate(client, pageSessionId, expression) {
  const out = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true
  }, pageSessionId);
  if (out.exceptionDetails) throw new Error(out.exceptionDetails.text || "Browser evaluation failed");
  return out.result?.value;
}

function locatorScript(locator) {
  if (!locator || typeof locator !== "object") throw new Error("This action requires a locator");
  const type = locator.type;
  const value = String(locator.value || "").slice(0, 512);
  const name = locator.name == null ? null : String(locator.name).slice(0, 512);
  if (!["role","text","test_id","css"].includes(type) || !value) throw new Error("Invalid locator");
  const encoded = JSON.stringify({ type, value, name });
  return "(() => {" +
    "const locator=" + encoded + ";" +
    "const normalize=value=>String(value??'').replace(/\\s+/g,' ').trim();" +
    "const roleOf=el=>{const explicit=el.getAttribute('role');if(explicit)return explicit;const tag=el.tagName.toLowerCase();if(tag==='button')return 'button';if(tag==='a'&&el.hasAttribute('href'))return 'link';if(tag==='select')return 'combobox';if(tag==='textarea')return 'textbox';if(tag==='input'){const t=(el.getAttribute('type')||'text').toLowerCase();if(['button','submit','reset'].includes(t))return 'button';if(t==='checkbox')return 'checkbox';if(t==='radio')return 'radio';return 'textbox';}return ''};" +
    "const nameOf=el=>normalize(el.getAttribute('aria-label')||el.getAttribute('title')||el.getAttribute('placeholder')||el.textContent);" +
    "let el=null;" +
    "if(locator.type==='css'){try{el=document.querySelector(locator.value)}catch{}}" +
    "else if(locator.type==='test_id'){el=[...document.querySelectorAll('[data-testid]')].find(node=>node.getAttribute('data-testid')===locator.value)||null;}" +
    "else if(locator.type==='text'){const wanted=normalize(locator.value);const nodes=[...document.querySelectorAll('button,a,input,select,textarea,[role],[tabindex],summary,label')];el=nodes.find(node=>nameOf(node)===wanted)||nodes.find(node=>nameOf(node).includes(wanted))||null;}" +
    "else if(locator.type==='role'){const wantedRole=normalize(locator.value).toLowerCase();const wantedName=locator.name==null?null:normalize(locator.name);el=[...document.querySelectorAll('*')].find(node=>roleOf(node).toLowerCase()===wantedRole&&(wantedName==null||nameOf(node)===wantedName||nameOf(node).includes(wantedName)))||null;}" +
    "if(!el)return {ok:false};globalThis.__loewInspectorTarget=el;const rect=el.getBoundingClientRect();return {ok:true,tag:el.tagName.toLowerCase(),text:nameOf(el).slice(0,160),x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:rect.width,height:rect.height};" +
  "})()";
}

async function locate(client, pageSessionId, locator) {
  const result = await evaluate(client, pageSessionId, locatorScript(locator));
  if (!result?.ok) throw new Error("Browser target not found");
  return result;
}

function boundedText(value, max = 4000) {
  if (value == null) return "";
  const text = String(value);
  if (text.length > max) throw new Error("Interaction value is too long");
  return text;
}

function normalizeKey(key) {
  const value = boundedText(key, 32);
  const allowed = new Set(["Enter","Escape","Tab","Backspace","Delete","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End","PageUp","PageDown"," ","Space"]);
  if (!allowed.has(value)) throw new Error("Unsupported key");
  return value === "Space" ? " " : value;
}

function isAllowedLoewUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { return false; }
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" && (host === "loew.fi" || host.endsWith(".loew.fi")) &&
    !url.username && !url.password && !url.port;
}

async function pageIdentity(client, pageSessionId) {
  return evaluate(client, pageSessionId, "({ title: document.title.slice(0, 200), url: location.href })");
}

async function enforceTopLevelLoewNavigation(client, pageSessionId, previousUrl) {
  const identity = await pageIdentity(client, pageSessionId);
  if (isAllowedLoewUrl(identity?.url)) return identity;
  if (isAllowedLoewUrl(previousUrl)) {
    try {
      await client.send("Page.navigate", { url: previousUrl }, pageSessionId, 15000);
      await delay(250);
    } catch {}
  }
  throw new Error("Browser interaction attempted to leave loew.fi");
}

export async function openBrowserSession(binding, bucket, { url, accessJwt, viewport, keepAliveMs = 600000, context = null }) {
  if (!binding?.acquire || !binding?.devtools) throw new Error("Browser Run session API unavailable");
  const vp = normalizeViewport(viewport);
  const keepAlive = Math.min(1200000, Math.max(10000, Number(keepAliveMs) || 600000));
  const acquired = await binding.acquire({ keepAlive, recording: true, targets: true });
  const sessionId = assertSessionId(acquired.sessionId);
  const target = await binding.devtools.newTarget(sessionId, "about:blank");
  const targetId = assertTargetId(target?.id || target?.targetId);
  if (!targetId) {
    await binding.closeSession(sessionId);
    throw new Error("Browser Run did not create a page target");
  }

  const connected = await connectTarget(binding, sessionId, targetId, accessJwt, vp);
  try {
    const loaded = connected.client.waitFor("Page.loadEventFired", {
      sessionId: connected.pageSessionId,
      timeoutMs: 20000
    }).catch(() => null);
    const nav = await connected.client.send("Page.navigate", { url: url.toString() }, connected.pageSessionId, 20000);
    if (nav.errorText) throw new Error("Browser navigation failed: " + nav.errorText);
    await loaded;
    await delay(500);
    const identity = await pageIdentity(connected.client, connected.pageSessionId);
    const now = new Date().toISOString();
    const meta = {
      session_id: sessionId,
      target_id: targetId,
      target_url: url.toString(),
      current_url: identity?.url || url.toString(),
      title: identity?.title || "",
      viewport: vp,
      keep_alive_ms: keepAlive,
      context: normalizeEvidenceContext(context),
      status: "open",
      created_at: now,
      updated_at: now,
      trace: [{ at: now, action: "open", url: url.toString() }]
    };
    await writeSession(bucket, meta);
    return { ok: true, session_id: sessionId, target_id: targetId, current_url: meta.current_url, title: meta.title, viewport: vp };
  } catch (error) {
    await binding.closeSession(sessionId).catch(() => {});
    throw error;
  } finally {
    connected.client.close();
  }
}

export async function interactBrowserSession(binding, bucket, args) {
  const meta = await readSession(bucket, assertSessionId(args.sessionId));
  if (meta.status !== "open") throw new Error("Browser session is not open");
  const chosenTarget = assertTargetId(args.targetId) || meta.target_id;
  validateInteractionShape(args);

  const connected = await connectTarget(binding, meta.session_id, chosenTarget, args.accessJwt, meta.viewport);
  try {
    let found = null;
    if (!['scroll','wait'].includes(args.action) || args.locator) found = await locate(connected.client, connected.pageSessionId, args.locator);

    if (["click","double_click","hover"].includes(args.action)) {
      const clickCount = args.action === "double_click" ? 2 : 1;
      await connected.client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: found.x, y: found.y }, connected.pageSessionId);
      if (args.action !== "hover") {
        await connected.client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: found.x, y: found.y, button: "left", clickCount }, connected.pageSessionId);
        await connected.client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: found.x, y: found.y, button: "left", clickCount }, connected.pageSessionId);
      }
    } else if (args.action === "type") {
      const text = boundedText(args.value);
      const expression = "(() => {const el=globalThis.__loewInspectorTarget;if(!el)return false;el.focus();const value=" + JSON.stringify(text) + ";if('value' in el){const proto=Object.getPrototypeOf(el);const descriptor=Object.getOwnPropertyDescriptor(proto,'value');if(descriptor?.set)descriptor.set.call(el,value);else el.value=value;}else if(el.isContentEditable){el.textContent=value;}else{return false;}el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()";
      const ok = await evaluate(connected.client, connected.pageSessionId, expression);
      if (!ok) throw new Error("Target cannot accept text");
    } else if (args.action === "press") {
      const normalized = normalizeKey(args.key);
      await connected.client.send("Input.dispatchKeyEvent", { type: "keyDown", key: normalized }, connected.pageSessionId);
      await connected.client.send("Input.dispatchKeyEvent", { type: "keyUp", key: normalized }, connected.pageSessionId);
    } else if (args.action === "select") {
      const selected = boundedText(args.value, 1000);
      const expression = "(() => {const el=globalThis.__loewInspectorTarget;if(!el||el.tagName!=='SELECT')return false;const wanted=" + JSON.stringify(selected) + ";const option=[...el.options].find(o=>o.value===wanted||o.textContent.trim()===wanted);if(!option)return false;el.value=option.value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()";
      const ok = await evaluate(connected.client, connected.pageSessionId, expression);
      if (!ok) throw new Error("Select option not found");
    } else if (args.action === "scroll") {
      const dx = Math.max(-5000, Math.min(5000, Number(args.deltaX) || 0));
      const dy = Math.max(-5000, Math.min(5000, Number(args.deltaY) || 0));
      if (args.locator) {
        await evaluate(connected.client, connected.pageSessionId, "globalThis.__loewInspectorTarget?.scrollIntoView({block:'center',inline:'center'})");
      } else {
        await evaluate(connected.client, connected.pageSessionId, "window.scrollBy({left:" + dx + ",top:" + dy + ",behavior:'instant'})");
      }
    }

    // Keep Network credentials attached while the action's asynchronous requests
    // settle. A detached sleep cannot authenticate those later requests.
    const settleMs=args.waitMs ?? (args.action==='wait'?500:150);
    await delay(settleMs);
    const identity = await enforceTopLevelLoewNavigation(connected.client, connected.pageSessionId, meta.current_url);
    meta.current_url = identity?.url || meta.current_url;
    meta.title = identity?.title || meta.title;
    meta.target_id = chosenTarget;
    appendTrace(meta, {
      action: args.action,
      settle_ms: settleMs,
      locator: args.locator || null,
      value: args.action === "type" || args.action === "select" ? boundedText(args.value, 120) : undefined,
      key: args.action === "press" ? normalizeKey(args.key) : undefined,
      delta_x: args.action === "scroll" ? Number(args.deltaX) || 0 : undefined,
      delta_y: args.action === "scroll" ? Number(args.deltaY) || 0 : undefined
    });
    await writeSession(bucket, meta);
    return {
      ok: true,
      session_id: meta.session_id,
      target_id: chosenTarget,
      action: args.action,
      current_url: meta.current_url,
      title: meta.title,
      matched: found ? { tag: found.tag, text: found.text, width: found.width, height: found.height } : null,
      trace_length: meta.trace.length
    };
  } finally {
    connected.client.close();
  }
}

export async function captureBrowserSession(binding, bucket, { sessionId, targetId, accessJwt, requestId, fullPage = false, context = null }) {
  const meta = await readSession(bucket, assertSessionId(sessionId));
  if (meta.status !== "open") throw new Error("Browser session is not open");
  const chosenTarget = assertTargetId(targetId) || meta.target_id;
  const connected = await connectTarget(binding, meta.session_id, chosenTarget, accessJwt, meta.viewport);
  const started = Date.now();
  try {
    const params = { format: "png", fromSurface: true, captureBeyondViewport: Boolean(fullPage) };
    if (fullPage) {
      const metrics = await connected.client.send("Page.getLayoutMetrics", {}, connected.pageSessionId);
      const size = metrics.cssContentSize || metrics.contentSize;
      if (size?.width && size?.height) params.clip = { x: 0, y: 0, width: size.width, height: size.height, scale: 1 };
    }
    const shot = await connected.client.send("Page.captureScreenshot", params, connected.pageSessionId, 30000);
    const identity = await pageIdentity(connected.client, connected.pageSessionId);
    const screenshotBytes = decodeBase64Bytes(shot.data);
    appendTrace(meta, { action: "capture", full_page: Boolean(fullPage) });
    meta.current_url = identity?.url || meta.current_url;
    meta.title = identity?.title || meta.title;
    await writeSession(bucket, meta);
    return storeEvidence(bucket, {
      requestId,
      targetUrl: meta.current_url,
      kind: "session_capture",
      screenshotBytes,
      browserMs: null,
      viewport: meta.viewport,
      fullPage: Boolean(fullPage),
      durationMs: Date.now() - started,
      context: context ?? meta.context,
      extra: {
        session_id: meta.session_id,
        target_id: chosenTarget,
        title: meta.title,
        trace: meta.trace,
        console_errors: { supported: false, reason: "Session event history is not replayed across disconnected CDP clients." },
        failed_requests: { supported: false, reason: "Session event history is not replayed across disconnected CDP clients." }
      }
    });
  } finally {
    connected.client.close();
  }
}

export async function closeBrowserSession(binding, bucket, sessionId) {
  const sid = assertSessionId(sessionId);
  const meta = await readSession(bucket, sid);
  await binding.closeSession(sid);
  meta.status = "closed";
  appendTrace(meta, { action: "close" });
  await writeSession(bucket, meta);
  return { ok: true, session_id: sid, status: "closed", trace_length: meta.trace.length };
}

export function validateLoewNavigationForTest(value) {
  return isAllowedLoewUrl(value);
}

export function validateInteractionShape(args) {
  const allowed = new Set(["click","double_click","hover","type","press","select","scroll","wait"]);
  if (!allowed.has(args.action)) throw new Error("Unsupported browser action");
  if (["click","double_click","hover","type","press","select"].includes(args.action) && !args.locator) throw new Error("This action requires a locator");
  if (["type","select"].includes(args.action)) boundedText(args.value);
  if (args.action === "press") normalizeKey(args.key);
  if (args.action === "scroll") {
    if (Math.abs(Number(args.deltaX) || 0) > 5000 || Math.abs(Number(args.deltaY) || 0) > 5000) throw new Error("Scroll delta out of range");
  }
  if (args.waitMs!==undefined&&(!Number.isInteger(args.waitMs)||args.waitMs<0||args.waitMs>10000)) throw new Error("Wait out of range");
  return true;
}


export async function getBrowserSessionTrace(bucket, sessionId) {
  const meta = await readSession(bucket, assertSessionId(sessionId));
  return {
    session_id: meta.session_id,
    target_url: meta.target_url,
    current_url: meta.current_url,
    context: meta.context ?? null,
    status: meta.status,
    trace: Array.isArray(meta.trace) ? meta.trace.slice(0, MAX_TRACE) : []
  };
}
