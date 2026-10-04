import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { chromium } from "playwright";
import { actionProbeResource, actionProbeResult, actionProbeTools, ACTION_PROBE_URI, ACTION_PROBE_TOOL, ACTION_SAMPLE_TOOL } from "./relay-host-action-probe.js";
import { hostProbeResource, hostProbeTool } from "./relay-host-probe.js";

test("production entrypoint exposes a separate app-only data callback and preserves the released control", async t => {
  const { default: worker } = await import("../apps/mcp/index.js");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "action-proof-fixture", encode = v => Buffer.from(JSON.stringify(v)).toString("base64url");
  const unsigned = encode({ alg: "RS256", kid }) + "." + encode({ iss: "https://loewfi.cloudflareaccess.com",
    aud: ["7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819"], exp: Math.floor(Date.now() / 1000) + 600 });
  const token = unsigned + "." + sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(String(url), "https://loewfi.cloudflareaccess.com/cdn-cgi/access/certs");
    return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid }] });
  });
  const rpc = async (method, params = {}, id = "relay-action-proof-2") => {
    const response = await worker.fetch(new Request("https://relay.loew.fi/mcp", { method: "POST",
      headers: { "content-type": "application/json", "cf-access-jwt-assertion": token },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) }), {});
    assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.id, id); return body.result;
  };
  const { tools } = await rpc("tools/list");
  assert.equal(tools.length, 69);
  assert.deepEqual(tools.filter(t => t.name.startsWith('relay_runner_feedback_')).map(t => t.name).sort(),
    ['relay_runner_feedback_ack', 'relay_runner_feedback_peek', 'relay_runner_feedback_status', 'relay_runner_feedback_submit']);
  const control = tools.find(t => t.name === "relay_test_card_connection");
  assert.deepEqual(control._meta.ui, hostProbeTool()._meta.ui);
  const render = tools.find(t => t.name === ACTION_PROBE_TOOL), data = tools.find(t => t.name === ACTION_SAMPLE_TOOL);
  assert.equal(render._meta.ui.resourceUri, ACTION_PROBE_URI);
  assert.deepEqual(data._meta.ui, { visibility: ["app"] });
  assert.equal(data._meta["openai/outputTemplate"], undefined);
  assert.equal(data._meta["openai/widgetAccessible"], true);
  assert.equal(data.annotations.readOnlyHint, true);
  assert.deepEqual(data.securitySchemes, [{ type: "oauth2", scopes: [] }]);
  assert.deepEqual((await rpc("resources/read", { uri: ACTION_PROBE_URI })).contents, [actionProbeResource()]);
  const baseline = (await rpc("resources/read", { uri: "ui://relay/host-proof/20261001.1.html" })).contents[0];
  assert.deepEqual(baseline, hostProbeResource());
  assert.equal(createHash("sha256").update(baseline.text).digest("hex"), "4abeaffaeff626d246a5f5d582efab1901e1f7c64ca65b53199948024901c3c1");
  const initial = await rpc("tools/call", { name: ACTION_PROBE_TOOL, arguments: {} });
  const action = await rpc("tools/call", { name: ACTION_SAMPLE_TOOL, arguments: {} }, 2);
  assert.equal(initial.structuredContent.kind, "initial"); assert.equal(action.structuredContent.kind, "action");
  assert.notEqual(initial.structuredContent.sample_id, action.structuredContent.sample_id);
  assert.match(initial.content[0].text, /not a visible card/); assert.match(action.content[0].text, /No work started/);
  assert.equal(action._meta, undefined);
  assert.equal((await rpc("tools/call", { name: ACTION_SAMPLE_TOOL, arguments: { command: "write" } })).isError, true);
});

test("comparison is self-contained, rejects arguments and survives Worker helper injection", async () => {
  for (const input of [null, [], true, "x", { x: 1 }]) assert.throws(() => actionProbeResult(input, "action"), /no arguments/);
  assert.throws(() => actionProbeResult({}, "unknown"), /Unknown/);
  assert.deepEqual(actionProbeTools()[1]._meta.ui, { visibility: ["app"] });
  const resource = actionProbeResource();
  assert.doesNotMatch(resource.text, /fetch\(|<script[^>]+src=|<link/);
  const { build } = await import("esbuild");
  const bundled = await build({ entryPoints: [new URL("./relay-host-action-probe.js", import.meta.url).pathname], bundle: true, write: false, format: "esm", platform: "neutral", keepNames: true });
  const built = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
  assert.deepEqual(built.actionProbeResource(), resource); assert.doesNotMatch(resource.text, /\b__name\b/);
});

async function mount(browser, mode) {
  const context = await browser.newContext({ viewport: { width: 390, height: 700 } });
  const page = await context.newPage(); await page.clock.install();
  await page.setContent('<iframe title="Synthetic comparison host" sandbox="allow-scripts" style="width:100%;height:650px"></iframe>');
  await page.evaluate(({ html, initial, action, mode }) => {
    window.received = []; window.actionResult = action;
    window.reply = msg => document.querySelector('iframe').contentWindow.postMessage(msg, '*');
    window.addEventListener('message', event => {
      if (event.source !== document.querySelector('iframe').contentWindow) return;
      const m = event.data; window.received.push(m);
      if (m.method === 'ui/initialize') {
        if (mode === 'early-result') window.reply({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: initial });
        window.reply({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: '2026-01-26', hostInfo: { name: 'Synthetic', version: '1' },
          hostContext: { platform: 'web', displayMode: 'inline' }, hostCapabilities: mode === 'no-tools' ? {} : { serverTools: {} } } });
      }
      if (m.method === 'ui/notifications/initialized' && mode !== 'early-result') window.reply({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: initial });
      if (m.method === 'tools/call') {
        window.actionId = m.id;
        if (mode === 'error') window.reply({ jsonrpc: '2.0', id: m.id, error: { code: -32000, message: 'sensitive-payload-not-for-logs' } });
        else if (mode === 'malformed') window.reply({ jsonrpc: '2.0', id: m.id });
        else if (mode === 'invalid') window.reply({ jsonrpc: '2.0', id: m.id, result: initial });
        else if (mode === 'tool-error') window.reply({ jsonrpc: '2.0', id: m.id, result: { isError: true, content: [{ type: 'text', text: 'sensitive-payload-not-for-logs' }] } });
        else if (mode === 'notification-only') window.reply({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: action });
        else if (mode === 'wrong-id') window.reply({ jsonrpc: '2.0', id: 999, result: action });
        else if (mode === 'cancel') window.reply({ jsonrpc: '2.0', method: 'ui/notifications/tool-cancelled', params: {} });
        else if (mode === 'teardown') window.reply({ jsonrpc: '2.0', method: 'ui/resource-teardown', id: 'teardown-test', params: {} });
        else if (mode !== 'late') window.reply({ jsonrpc: '2.0', id: m.id, result: action });
      }
    });
    document.querySelector('iframe').srcdoc = html;
  }, { html: actionProbeResource().text, initial: actionProbeResult({}, "initial"), action: actionProbeResult({}, "action"), mode });
  const frame = page.frameLocator('iframe');
  await frame.locator('#init').filter({ hasText: 'Host connected' }).waitFor();
  await frame.locator('#result').filter({ hasText: 'Data arrived' }).waitFor();
  return { page, frame, context };
}

test("actual comparison script separates correlated, late, notification-only, error and cancelled outcomes", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  for (const mode of ['normal', 'early-result', 'no-tools', 'error', 'malformed', 'invalid', 'tool-error', 'late', 'notification-only', 'wrong-id', 'cancel', 'teardown']) {
    await t.test(mode, async () => {
      const { page, frame, context } = await mount(browser, mode);
      try {
        if (mode === 'no-tools') { assert.equal(await frame.locator('#check').isDisabled(), true); return; }
        await frame.locator('#check').click();
        if (['late', 'notification-only', 'wrong-id'].includes(mode)) {
          await page.clock.fastForward(11000);
          assert.match(await frame.locator('#action').innerText(), /No matching reply/);
          if (mode === 'late') {
            await page.evaluate(() => window.reply({ jsonrpc: '2.0', id: window.actionId, result: window.actionResult }));
            await frame.locator('#diagnostics').filter({ hasText: 'late-response' }).waitFor({ state: 'attached' });
            assert.match(await frame.locator('#action').innerText(), /No matching reply/);
          }
        } else if (mode === 'cancel') {
          await frame.locator('#action').filter({ hasText: 'Cancelled' }).waitFor();
          await page.clock.fastForward(16000);
          await page.evaluate(() => window.reply({ jsonrpc: '2.0', id: window.actionId, result: window.actionResult }));
          await page.clock.runFor(1);
          assert.equal(await frame.locator('#action').innerText(), 'Cancelled'); assert.equal(await frame.locator('#check').isDisabled(), true);
        } else if (mode === 'teardown') {
          // postMessage crosses documents asynchronously; observe disposal before advancing fake timers.
          await page.waitForFunction(() => received.some(m => m.id === 'teardown-test' && m.result));
          await page.clock.runFor(1); await page.clock.fastForward(16000);
          assert.equal(await frame.locator('#check').isDisabled(), true);
          assert.ok((await page.evaluate(() => received)).some(m => m.id === 'teardown-test' && m.result));
        } else if (['error', 'malformed', 'invalid', 'tool-error'].includes(mode)) {
          await frame.locator('#action[data-state="error"]').waitFor();
          assert.doesNotMatch(await frame.locator('#action').innerText(), /worked/);
        } else await frame.locator('#action').filter({ hasText: 'Read-only data action worked' }).waitFor();
        const calls = await page.evaluate(() => received.filter(m => m.method === 'tools/call'));
        assert.deepEqual(calls.map(m => m.params), [{ name: ACTION_SAMPLE_TOOL, arguments: {} }]);
        const details = JSON.parse(await frame.locator('#diagnostics').textContent());
        assert.ok(details.events.length <= 40); assert.doesNotMatch(JSON.stringify(details), /sensitive-payload-not-for-logs/);
        if (mode === 'notification-only') assert.ok(details.events.some(e => e.event === 'action-result-notification'));
        if (mode === 'wrong-id') assert.ok(details.events.some(e => e.event === 'unmatched-response'));
        if (mode === 'error') assert.ok(details.events.some(e => e.error_code === -32000));
        if (mode === 'tool-error') assert.ok(details.events.some(e => e.tool_error === true));
        if (mode === 'cancel' || mode === 'teardown') assert.equal(details.events.some(e => e.event === 'request-timeout'), false);
      } finally { await context.close(); }
    });
  }
});

test("comparison static HTML remains visible without script; non-parent messages cannot settle an action", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noScript.newPage(); await staticPage.setContent(actionProbeResource().text);
  assert.match(await staticPage.locator('main').innerText(), /Card appeared/);
  assert.equal(await staticPage.locator('#script').innerText(), 'Waiting for script'); await noScript.close();
  const { page, frame, context } = await mount(browser, 'late');
  try {
    await frame.locator('#check').click();
    const id = await page.evaluate(() => window.actionId);
    await page.frames()[1].evaluate(({ id, result }) => window.dispatchEvent(new MessageEvent('message', { source: window, data: { jsonrpc: '2.0', id, result } })), { id, result: actionProbeResult({}, 'action') });
    assert.match(await frame.locator('#action').innerText(), /Checking/);
    await page.clock.fastForward(11000); assert.match(await frame.locator('#action').innerText(), /No matching reply/);
  } finally { await context.close(); }
});
