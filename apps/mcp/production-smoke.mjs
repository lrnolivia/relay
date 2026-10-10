// Exact-source live smoke; credentials stay in the GitHub Actions environment.
// Expected MCP and web surfaces are derived from the checked-out exact source, so this smoke cannot drift from the release it verifies.
import fs from "node:fs/promises";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { webAssets, webBuildId, webSourceSha } from "../web/generated.js";
import { RELAY_CONTEXT_CARD_URI } from "../../src/relay-chat-ui.js";
import { RELAY_CONTROL_CENTER_URI } from "../../src/relay-ui.js";
import { PROGRESS_CONTRACT_VERSION } from "../../src/progress-api.js";

const origin = "https://relay.loew.fi";
const expected = process.env.EXPECTED_SOURCE_SHA;
const headers = {
  "Content-Type": "application/json",
  Authorization: JSON.stringify({ "cf-access-client-id": process.env.CF_ACCESS_CLIENT_ID, "cf-access-client-secret": process.env.CF_ACCESS_CLIENT_SECRET }),
  "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID,
  "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET
};
const results = [];
const digest = text => createHash("sha256").update(text).digest("hex");
const sameSet = (label, actual, wanted) => {
  const missing = wanted.filter(x => !actual.includes(x)), extra = actual.filter(x => !wanted.includes(x));
  if (missing.length || extra.length) throw new Error(label + " differs from exact source; missing " + JSON.stringify(missing) + " unexpected " + JSON.stringify(extra));
};

// Exact-source surface: the checked-out Worker answers locally behind a throwaway Access identity.
async function sourceSurface() {
  const { default: worker } = await import("../../src/relay-entry.js");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "production-smoke-local", encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = encode({ alg: "RS256", kid }) + "." + encode({ iss: "https://loewfi.cloudflareaccess.com",
    aud: ["7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819"], common_name: "production-smoke-local", exp: Math.floor(Date.now() / 1000) + 600 });
  const token = payload + "." + sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64url");
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => String(url) === "https://loewfi.cloudflareaccess.com/cdn-cgi/access/certs"
    ? Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid }] })
    : Promise.reject(new Error("Exact-source surface must not reach the network: " + url));
  try {
    const local = async (method, params = {}) => {
      const response = await worker.fetch(new Request(origin + "/mcp", { method: "POST",
        headers: { "content-type": "application/json", "cf-access-jwt-assertion": token, "user-agent": "relay-production-smoke" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }), {});
      const body = await response.json();
      if (response.status !== 200 || body.error) throw new Error("Exact-source " + method + " failed");
      return body.result;
    };
    return {
      tools: (await local("tools/list")).tools.map(tool => tool.name).sort(),
      resources: (await local("resources/list")).resources.map(resource => resource.uri).sort(),
      skills: (await local("skills/list")).skills.length,
      card: digest((await local("resources/read", { uri: RELAY_CONTEXT_CARD_URI })).contents[0].text),
      control: digest((await local("resources/read", { uri: RELAY_CONTROL_CENTER_URI })).contents[0].text)
    };
  } finally { globalThis.fetch = realFetch; }
}

async function rpc(method, params = {}) {
  const response = await fetch(origin + "/mcp", { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: results.length + 1, method, params }), signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error("MCP HTTP " + response.status);
  const payload = await response.json();
  if (payload.error || payload.result?.isError) throw new Error("MCP failed: " + method + "/" + (params.name || ""));
  return payload.result;
}
async function call(name, args = {}) {
  const result = await rpc("tools/call", { name, arguments: args });
  results.push({ tool: name, result: result.structuredContent });
  return result.structuredContent;
}
const gitBlobSha = bytes => createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");

try {
  if (!/^[a-f0-9]{40}$/.test(expected || "")) throw new Error("EXPECTED_SOURCE_SHA must be an exact commit");
  const checkout = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (checkout !== expected || webSourceSha !== expected) throw new Error("Smoke must run from the exact deployed source build");
  const source = await sourceSurface();

  const initialized = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "relay-production-smoke", version: "2" } });
  if (initialized.serverInfo.name !== "relay") throw new Error("Unexpected MCP identity");
  const tools = await rpc("tools/list");
  sameSet("Production tool inventory", tools.tools.map(tool => tool.name).sort(), source.tools);
  const resources = await rpc("resources/list");
  sameSet("Production resource inventory", resources.resources.map(resource => resource.uri).sort(), source.resources);
  const skills = await rpc("skills/list");
  if (skills.skills.length !== source.skills) throw new Error("Production skill surface differs from exact source");
  const card = await rpc("resources/read", { uri: RELAY_CONTEXT_CARD_URI });
  if (digest(card.contents[0].text) !== source.card) throw new Error("Production contextual card differs from exact source " + RELAY_CONTEXT_CARD_URI);
  const control = await rpc("resources/read", { uri: RELAY_CONTROL_CENTER_URI });
  if (digest(control.contents[0].text) !== source.control) throw new Error("Production control center differs from exact source " + RELAY_CONTROL_CENTER_URI);

  await call("relay_source_status");
  await call("relay_source_repo", { repo: "relay" });
  await call("relay_runner_project", { project: "relay" });
  await call("relay_runner_workers");
  for (const path of ["/api/projects", "/api/projects/relay", "/api/progress/relay", "/api/projects/relay/icon", "/api/workers", "/api/visual"]) {
    const result = await call("relay_ui_request", { path });
    if (result.status !== 200) throw new Error("UI API failed " + path);
    if (path === "/api/progress/relay" && (result.body.contract_version !== PROGRESS_CONTRACT_VERSION || result.body.observed_progress !== true)) throw new Error("Observed-progress UI contract failed");
    if (path === "/api/projects/relay/icon") {
      const icon = result.body.icon;
      if (result.body.status !== "found" || icon?.repository !== "lrnolivia/relay") throw new Error("Genuine Relay icon provenance failed");
      // The served icon must be the exact blob committed at this source.
      if (gitBlobSha(await fs.readFile(icon.path)) !== icon.blob_sha) throw new Error("Relay icon blob differs from exact source " + icon.path);
    }
    if (path === "/api/visual" && result.body.evidence?.length) {
      const id = result.body.evidence[0].evidence_id;
      const qa = await call("relay_ui_request", { path: "/api/visual/" + id + "/qa" });
      if (qa.status !== 200 || qa.body.evidence.evidence_id !== id) throw new Error("QA identity readback failed");
    }
  }
  const worker = await call("relay_cloud_worker", { script: "relay" });
  const deployment = worker.deployments.deployments[0];
  const active = deployment.versions[0].version_id;
  // Guarded `wrangler deploy` versions carry no commit annotation; bind the active deployment to the newest successful canonical main build instead.
  const builds = (await call("relay_cloud_builds", { script: "relay" })).builds
    .filter(build => build.build_outcome === "success" && build.build_trigger_metadata?.branch === "main")
    .sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on));
  const build = builds[0], deployed = Date.parse(deployment.created_on);
  if (build?.build_trigger_metadata?.commit_hash !== expected) throw new Error("Newest successful production build is not the expected SHA");
  if (!(deployed >= Date.parse(build.running_on) && deployed <= Date.parse(build.stopped_on))) throw new Error("Active deployment was not created by the expected source build");
  // Each built web path must behave exactly as the exact-source deployed entry does, including intentional ctrl redirects.
  const { default: deployedEntry } = await import("./index.js");
  for (const path of Object.keys(webAssets)) {
    const want = await deployedEntry.fetch(new Request(origin + path), {}, { waitUntil() {} });
    const response = await fetch(origin + path, { headers, redirect: "manual", signal: AbortSignal.timeout(45000) });
    if (response.status !== want.status || response.headers.get("Location") !== want.headers.get("Location")) throw new Error("Web route differs from exact source " + path + " HTTP " + response.status + " expected " + want.status);
    if (want.status === 200 && (response.headers.get("X-Relay-Source-Sha") !== expected || response.headers.get("X-Relay-Web-Build") !== webBuildId)) throw new Error("Web asset identity differs from exact source " + path);
    results.push({ web_path: path, status: response.status });
  }
  for (const path of ["/api/projects", "/api/progress/relay", "/api/projects/relay/icon", "/api/workers", "/api/visual"]) {
    const response = await fetch(origin + path, { headers, redirect: "manual", signal: AbortSignal.timeout(45000) });
    if (response.status !== 200) throw new Error("Web API failed " + path + " HTTP " + response.status);
    results.push({ web_path: path, status: response.status });
  }
  if (process.env.BROWSER_CAPTURE === "true") {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      for (const capture of [
        { id: "desktop-dark", width: 1366, height: 1024, colorScheme: "dark" },
        { id: "mobile-light", width: 390, height: 844, colorScheme: "light" }
      ]) {
        const page = await browser.newPage({ viewport: { width: capture.width, height: capture.height }, colorScheme: capture.colorScheme });
        // Credentials are attached only to this exact origin, never font/CDN requests.
        await page.route(origin + "/**", route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
        await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
        await page.locator(".relay-home").waitFor();
        await page.locator(".telemetry-card").first().waitFor();
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Production viewport overflow: " + capture.id);
        const screenshot = await page.screenshot({ fullPage: false });
        const form = new FormData();
        form.set("metadata", JSON.stringify({
          request_id: "relay-brand-" + expected.slice(0, 12) + "-" + capture.id,
          target_url: origin + "/", kind: "qa_capture", engine: "github-chromium",
          context: { project: "relay", environment: "production", surface: "relay-home", route_kind: "other", commit_sha: expected },
          viewport: { width: capture.width, height: capture.height, deviceScaleFactor: 1 },
          step_id: capture.id, step_label: "Relay home · " + capture.id,
          assertions: [{ id: "responsive-layout", status: "pass", detail: "No horizontal overflow; live telemetry rendered; exact source and web build identity verified." }]
        }));
        form.set("screenshot", new Blob([screenshot], { type: "image/png" }), capture.id + ".png");
        const response = await fetch(origin + "/evidence/ingest", { method: "POST", headers: { Authorization: headers.Authorization, "CF-Access-Client-Id": headers["CF-Access-Client-Id"], "CF-Access-Client-Secret": headers["CF-Access-Client-Secret"] }, body: form });
        if (!response.ok) throw new Error("Visuals registration failed " + response.status);
        const receipt = await response.json();
        if (!receipt.evidence_id) throw new Error("Visuals receipt missing");
        results.push({ visual_capture: capture.id, mime_type: "image/png", sha256: digest(screenshot), receipt });
        await page.close();
      }
    } finally { await browser.close(); }
  }
  results.push({ discovery: { tools: tools.tools.length, resources: resources.resources.length, skills: skills.skills.length }, card: RELAY_CONTEXT_CARD_URI, control_center: RELAY_CONTROL_CENTER_URI, active_version: active, source_sha: expected });
  console.log("Relay production MCP inventory, card/control resources, runtime, web identity, project, workers and existing QA reads match exact source.");
} finally {
  await fs.writeFile(process.env.SMOKE_RESULT_PATH || "/tmp/relay-production-smoke.json", JSON.stringify({ results }, null, 2));
}
