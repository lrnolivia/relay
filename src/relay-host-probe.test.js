import { RELAY_CONTEXT_CARD_URI, RELAY_STATUS_CARD_URI } from './relay-chat-ui.js';
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { chromium } from "playwright";
import { HOST_PROBE_BUILD, HOST_PROBE_TOOL, HOST_PROBE_URI, HOST_PROBE_PROTOCOL,
  hostProbeResource, hostProbeResult } from "./relay-host-probe.js";

const sample = () => hostProbeResult({}, new Request("https://relay.loew.fi/mcp"));
const originalTools = `relay_transfer_read relay_transfer_write relay_cloud_builds relay_cloud_deploy_project_version relay_cloud_deploy_version relay_cloud_project relay_cloud_scripts relay_cloud_status relay_cloud_upload_version relay_cloud_worker relay_control_status relay_render_context_card relay_runner_action relay_runner_assignments relay_runner_audit relay_runner_cleanup relay_runner_coordinate relay_runner_preflight relay_runner_progress relay_runner_project relay_runner_projects relay_runner_resume relay_runner_updates relay_runner_workers relay_show_legacy_bridge_card relay_source_append_text relay_source_checks relay_source_commit_files relay_source_create_branch relay_source_edit_text relay_source_file relay_source_inventory relay_source_open_pull_request relay_source_pull_request relay_source_pull_request_action relay_source_repo relay_source_status relay_source_sync_branch relay_source_tree relay_source_update_file relay_staff_directory relay_ui_control_center relay_verify_browser_capture relay_verify_browser_close relay_verify_browser_interact relay_verify_browser_open relay_verify_browser_recipe relay_verify_browser_recipes relay_verify_browser_screenshot relay_verify_browser_snapshot relay_verify_evidence_engines relay_verify_evidence_plan relay_verify_fetch_url relay_verify_recipe_from_session relay_verify_recipe_list`.split(" ").sort();

test("authenticated endpoint preserves original tools and controls alongside the admitted diagnostics", async t => {
  const { default: worker } = await import("./relay-entry.js");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "host-proof-regression";
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = encode({ alg: "RS256", kid }) + "." + encode({ iss: "https://loewfi.cloudflareaccess.com",
    aud: ["7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819"], common_name:'synthetic-client', exp: Math.floor(Date.now() / 1000) + 600 });
  const token = payload + "." + sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64url");
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(String(url), "https://loewfi.cloudflareaccess.com/cdn-cgi/access/certs");
    return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid }] });
  });
  const rpc = async (method, params = {}) => {
    const response = await worker.fetch(new Request("https://relay.loew.fi/mcp", { method: "POST",
      headers: { "content-type": "application/json", "cf-access-jwt-assertion": token, "user-agent": "synthetic-test" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }), {});
    assert.equal(response.status, 200);
    return response.json();
  };
  const { result: { tools } } = await rpc("tools/list");
  // The exact inventory preserves every existing tool and the admitted additions.
  assert.deepEqual(tools.filter(tool => tool.name !== HOST_PROBE_TOOL).map(tool => tool.name).sort(), [...originalTools, "relay_autonomy", "relay_context", "relay_execution", "relay_night_shift", "relay_skills", "relay_ui_request", "relay_test_card_action", "relay_card_action_sample", "relay_runner_feedback_submit", "relay_runner_feedback_peek", "relay_runner_feedback_status", "relay_runner_feedback_ack", "relay_test_card_static_standard", "relay_test_card_static_compat", "relay_test_card_lifecycle_standard"].sort());
  const autonomy = tools.find(tool => tool.name === "relay_autonomy");
  assert.deepEqual(autonomy.securitySchemes, [{ type: "oauth2", scopes: [] }]);
  assert.deepEqual(autonomy.inputSchema.properties.action.enum, ["status", "hold", "resume", "healthy", "approve", "rollback", "configure_build_guard"]);
  assert.deepEqual(autonomy.inputSchema.required, ["action", "scope"]);
  assert.equal(autonomy.inputSchema.additionalProperties, false);
  const unauthenticated = await worker.fetch(new Request("https://relay.loew.fi/mcp", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"relay_autonomy",arguments:{action:"hold",scope:"global"}}})}), {});
  assert.equal(unauthenticated.status,401);
  assert.equal(autonomy.inputSchema.properties.buildIdentity,undefined);
  const setupDenied=await worker.fetch(new Request('https://relay.loew.fi/mcp',{method:'POST',headers:{'content-type':'application/json','CF-Access-Client-Id':'synthetic-client','CF-Access-Client-Secret':'synthetic-secret'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'relay_autonomy',arguments:{action:'configure_build_guard',scope:'relay',expected_revision:0,operation_id:'unauthenticated-setup',reason:'Synthetic denial test',authorization:'Synthetic'}}})}),{});
  assert.equal(setupDenied.status,401);
  const archiveDenied=await worker.fetch(new Request('https://relay.loew.fi/api/release-recovery?source_sha='+('a'.repeat(40))+'&run_id=7&artifact_id=8',{method:'POST',headers:{'content-type':'application/zip'},body:'synthetic archive'}),{});
  assert.equal(archiveDenied.status,401,'Archive persistence requires the same cryptographic ingress authentication');
  const archiveInvalid=await worker.fetch(new Request('https://relay.loew.fi/api/release-recovery?source_sha=invalid',{headers:{'cf-access-jwt-assertion':token}}),{});
  assert.equal(archiveInvalid.status,400,'Verified JWT reaches archive validation through the canonical auth probe');
  await t.test('private setup headers survive removal of primary service headers and bind to the verified JWT',async()=>{
    const {readFile}=await import('node:fs/promises');
    const {autonomyState}=await import('./autonomy-control.js');
    const registration=JSON.parse(await readFile(new URL('../projects/relay.json',import.meta.url)));
    const priorFetch=globalThis.fetch;let probes=0,providerCalls=0;
    t.mock.method(globalThis,'fetch',async(url,options)=>{
      const path=String(url);
      if(path.startsWith('https://api.github.com/')){
        const value=path.includes('/contents/projects/relay.json')?registration:{project:'relay',claims:[],queue:[],legacy_branches:[]};
        return Response.json({type:'file',sha:'d'.repeat(40),encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')});
      }
      if(path.startsWith('https://relay.loew.fi/autonomy-status?')){
        probes++;assert.equal(options.headers['CF-Access-Client-Id'],'synthetic-client');assert.equal(options.headers['CF-Access-Client-Secret'],'synthetic-secret');assert.equal(options.headers['X-Relay-Build-Client-Secret'],undefined);
        return Response.json({schema:1,scope:new URL(url).searchParams.get('scope'),revision:0,held:false,enforced:true});
      }
      if(path.startsWith('https://api.cloudflare.com/'))providerCalls++;
      return priorFetch(url,options);
    });
    const env={RELAY_GITHUB_TOKEN:'private-header-fixture',RELAY_AUTONOMY_GUARD:'enforced',RELAY_EVENTS:{idFromName:name=>name,get:name=>({fetch:async(_url,options)=>{
      const input=JSON.parse(options.body);assert.equal(input.action,'status');
      return Response.json({ok:true,state:{...autonomyState(input.scope),held:name.endsWith(':global'),reason:'Synthetic stop'}});
    }})}};
    const call=async client=>worker.fetch(new Request('https://relay.loew.fi/mcp',{method:'POST',headers:{'content-type':'application/json','cf-access-jwt-assertion':token,'X-Relay-Build-Client-Id':client,'X-Relay-Build-Client-Secret':'synthetic-secret'},body:JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'relay_autonomy',arguments:{action:'configure_build_guard',scope:'relay',expected_revision:0,operation_id:'private-header-regression',reason:'Synthetic setup',authorization:'Synthetic resume'}}})}),env);
    try{
      const result=await (await call('synthetic-client')).json();assert.equal(result.result.isError,true);assert.match(JSON.stringify(result),/held for global/);assert.equal(probes,2);assert.equal(providerCalls,0);assert.doesNotMatch(JSON.stringify(result),/synthetic-client|synthetic-secret|private-header-fixture/);
      const mismatch=await (await call('different-client')).json();assert.match(JSON.stringify(mismatch),/must match the authenticated service token/);assert.equal(probes,2);assert.equal(providerCalls,0);
    }finally{t.mock.method(globalThis,'fetch',priorFetch);}
  });
  assert.deepEqual(tools.find(tool => tool.name === "relay_ui_request")._meta.ui.visibility, ["app"]);
  const manifestTool=tools.find(tool=>tool.name==='relay_source_tree');
  assert.equal(manifestTool.annotations.readOnlyHint,true);assert.equal(manifestTool.annotations.destructiveHint,false);
  assert.deepEqual(manifestTool.inputSchema.required,['repo','commit_sha']);assert.equal(manifestTool.inputSchema.additionalProperties,false);
  for(const arguments_ of [{repo:'relay',commit_sha:'a'.repeat(40),owner:'different-owner'},{repo:'relay',commit_sha:'a'.repeat(40),unexpected:true}]){
    const rejected=(await rpc('tools/call',{name:'relay_source_tree',arguments:arguments_})).result;
    assert.equal(rejected.isError,true);assert.equal(rejected.structuredContent,undefined);
  }
  const sync = tools.find(tool => tool.name === "relay_source_sync_branch");
  assert.equal(sync.annotations.readOnlyHint, false);
  assert.equal(sync.annotations.destructiveHint, false);
  assert.deepEqual(sync.inputSchema.required, ["repo","branch","expected_head_sha","expected_base_sha"]);
  assert.equal(sync.inputSchema.additionalProperties, false);

  assert.equal(tools.filter(tool => tool.name === HOST_PROBE_TOOL).length, 1);
  const tool = tools.find(tool => tool.name === HOST_PROBE_TOOL);
  assert.equal(tool._meta.ui.resourceUri, HOST_PROBE_URI);
  assert.equal(tool._meta["openai/outputTemplate"], HOST_PROBE_URI);
  assert.deepEqual(tool.securitySchemes, [{ type: "oauth2", scopes: [] }]);
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.destructiveHint, false);
  assert.equal(tools.find(t => t.name === "relay_render_context_card")._meta.ui.resourceUri, RELAY_CONTEXT_CARD_URI);
  assert.equal(tools.find(t => t.name === "relay_runner_progress")._meta?.ui?.resourceUri, undefined);
  assert.equal(tools.find(t => t.name === "relay_show_legacy_bridge_card")._meta.ui.resourceUri, RELAY_STATUS_CARD_URI);
  const { result: { resources } } = await rpc("resources/list");
  assert.equal(resources.filter(r => r.uri === HOST_PROBE_URI).length, 1);
  const { result: { contents } } = await rpc("resources/read", { uri: HOST_PROBE_URI });
  assert.deepEqual(contents, [hostProbeResource()]);
  const result = (await rpc("tools/call", { name: HOST_PROBE_TOOL, arguments: {}, _meta: { "openai/userAgent": "untrusted-client-label" } })).result;
  assert.equal(result.structuredContent.build_id, HOST_PROBE_BUILD);
  assert.equal(result.structuredContent.request_hints.openai_user_agent, "untrusted-client-label");
  assert.match(result.content[0].text, /not that a card appeared/);
  const invalid = (await rpc("tools/call", { name: HOST_PROBE_TOOL, arguments: { write: true } })).result;
  assert.equal(invalid.isError, true);
  assert.match(invalid.content[0].text, /no arguments/);
  assert.equal(invalid.structuredContent, undefined);
  // Observed current-server boundary: initialization does not use client identity to route execution.
  const init = (name, capabilities) => rpc("initialize", { protocolVersion: "2025-03-26", clientInfo: { name, version: "test" }, capabilities });
  assert.deepEqual(await init("Codex", { roots: {} }), await init("ChatGPT", {}));
});

test("diagnostic has bounded hints, explicit no-argument validation and a self-contained static shell", () => {
  for (const args of [null, [], false, "x", { command: "write" }]) assert.throws(() => hostProbeResult(args), /no arguments/);
  const result = hostProbeResult({}, new Request("https://relay.loew.fi/mcp"), { "openai/userAgent": "x".repeat(1000) });
  assert.equal(result.structuredContent.request_hints.openai_user_agent.length, 240);
  const resource = hostProbeResource();
  assert.equal(resource.mimeType, "text/html;profile=mcp-app");
  assert.match(resource.text, /Card appeared/);
  assert.doesNotMatch(resource.text, /<script[^>]+src=|<link|fetch\(/);
  assert.deepEqual(resource._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
});

test("Worker bundling preserves the entire embedded browser program without external helpers", async () => {
  const { build } = await import("esbuild");
  const bundled = await build({ entryPoints: [new URL("./relay-host-probe.js", import.meta.url).pathname],
    bundle: true, write: false, format: "esm", platform: "neutral", keepNames: true });
  const module = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
  const resource = module.hostProbeResource();
  assert.doesNotMatch(resource.text, /\b__name\b/);
  assert.deepEqual(resource, hostProbeResource());
});

async function mount(browser, mode = "normal", width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 680 } });
  const page = await context.newPage();
  await page.clock.install();
  await page.setContent('<iframe title="Synthetic MCP host" sandbox="allow-scripts" style="width:100%;height:640px;border:0"></iframe>');
  await page.evaluate(({ html, initial, mode, protocol }) => {
    window.received = [];
    window.reply = result => document.querySelector('iframe').contentWindow.postMessage(result, '*');
    window.addEventListener('message', event => {
      if (event.source !== document.querySelector('iframe').contentWindow) return;
      const m = event.data; window.received.push(m);
      if (m.method === 'ui/initialize') {
        if (mode === 'early-result') window.reply({ jsonrpc:'2.0', method:'ui/notifications/tool-result', params:initial });
        if (mode === 'timeout') return;
        if (mode === 'init-error') { window.reply({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'UI not supported'}}); return; }
        window.reply({jsonrpc:'2.0',id:m.id,result:{protocolVersion: mode==='wrong-protocol'?'2099-01-01':protocol,
          hostInfo:{name:'Synthetic host',version:'1'},hostContext:{platform:'web',displayMode:'inline'},
          hostCapabilities:mode==='no-tools'?{}:{serverTools:{}}}});
      }
      if (m.method === 'ui/notifications/initialized' && mode === 'cancelled') {
        window.reply({jsonrpc:'2.0',method:'ui/notifications/tool-cancelled',params:{reason:'Cancelled in synthetic host'}});
      }
      if (m.method === 'ui/notifications/initialized' && !['early-result','no-result','cancelled'].includes(mode)) {
        window.reply({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:initial});
      }
      if (m.method === 'tools/call') {
        if(mode==='action-error')window.reply({jsonrpc:'2.0',id:m.id,error:{code:-32000,message:'Read denied by test host'}});
        else window.reply({jsonrpc:'2.0',id:m.id,result:{...initial,structuredContent:{...initial.structuredContent,sample_id:'action-sample'}}});
      }
    });
    document.querySelector('iframe').srcdoc=html;
  }, { html: hostProbeResource().text, initial: sample(), mode, protocol: HOST_PROBE_PROTOCOL });
  const frame = page.frameLocator('iframe');
  await frame.locator('#script').filter({hasText:'Script started'}).waitFor();
  return { page, frame, context };
}

test("actual resource script separates lifecycle milestones, errors and host limitations", async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const mode of ['normal','early-result','no-tools','action-error','init-error','wrong-protocol','timeout','no-result','cancelled']) {
    await t.test(mode, async () => {
      const { page, frame, context } = await mount(browser, mode);
      try {
        if (mode === 'cancelled') {
          await frame.locator('#result').filter({hasText:'The host cancelled this result.'}).waitFor();
          await page.clock.fastForward(16000);
          assert.equal(await frame.locator('#result').innerText(), 'The host cancelled this result.');
          await page.evaluate(result => window.reply({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:result}), sample());
          await page.clock.runFor(1);
          assert.equal(await frame.locator('#result').innerText(), 'The host cancelled this result.');
        } else if (mode === 'timeout') {
          await page.clock.fastForward(16000);
          assert.match(await frame.locator('#init').innerText(), /did not answer/);
          assert.equal(await frame.locator('#result').innerText(), 'Still waiting for data');
        } else if (['init-error','wrong-protocol'].includes(mode)) {
          await frame.locator('#init[data-state="error"]').waitFor();
          assert.equal(await frame.locator('#check').isDisabled(), true);
        } else {
          await frame.locator('#init').filter({hasText:'Host connected'}).waitFor();
          if (mode === 'no-result') {
            // A forged child-frame message is not the host's delivery.
            await page.frames()[1].evaluate(result => window.dispatchEvent(new MessageEvent('message', {
              source: window, data: {jsonrpc:'2.0',method:'ui/notifications/tool-result',params:result}
            })), sample());
            assert.equal(await frame.locator('#result').innerText(), 'Waiting for data');
            await page.clock.fastForward(16000);
            assert.equal(await frame.locator('#result').innerText(), 'Still waiting for data');
          } else {
            await frame.locator('#result').filter({hasText:'Data arrived'}).waitFor();
          }
          if (mode === 'no-tools') {
            assert.equal(await frame.locator('#check').isDisabled(), true);
            assert.match(await frame.locator('#action').innerText(), /did not offer/);
          } else {
            await frame.locator('#check').click();
            await frame.locator('#action').filter({hasText:mode==='action-error'?'Read denied':'Read-only check worked'}).waitFor();
            const calls = await page.evaluate(() => received.filter(m=>m.method==='tools/call'));
            assert.deepEqual(calls.map(m=>m.params), [{name:HOST_PROBE_TOOL,arguments:{}}]);
          }
          assert.ok((await page.evaluate(() => received)).some(m=>m.method==='ui/notifications/size-changed' && m.params.height>0));
        }
      } finally { await context.close(); }
    });
  }
});

test("static shell survives disabled script and local narrow/large-text content stays reachable", async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const staticContext = await browser.newContext({ javaScriptEnabled:false });
  const staticPage = await staticContext.newPage(); await staticPage.setContent(hostProbeResource().text);
  assert.equal(await staticPage.locator('#static').innerText(), 'Card appeared');
  assert.equal(await staticPage.locator('#script').innerText(), 'Waiting for script');
  assert.equal(await staticPage.locator('#check').isDisabled(), true); await staticContext.close();
  const { page, frame, context } = await mount(browser, 'normal', 320);
  try {
    await frame.locator('#init').filter({hasText:'Host connected'}).waitFor();
    await page.frames()[1].addStyleTag({content:'body{font-size:28px}'});
    await frame.locator('summary').click();
    await frame.locator('#check').focus();
    await frame.locator('#check').scrollIntoViewIfNeeded();
    const geometry = await page.frames()[1].evaluate(() => ({overflow:document.documentElement.scrollWidth>innerWidth,
      focused:document.activeElement.id,button:document.querySelector('#check').getBoundingClientRect().toJSON(),height:innerHeight}));
    assert.equal(geometry.overflow,false); assert.equal(geometry.focused,'check');
    assert.ok(geometry.button.top>=0 && geometry.button.bottom<=geometry.height);
    await frame.locator('#diagnostics').scrollIntoViewIfNeeded();
    assert.ok(await frame.locator('#diagnostics').isVisible());
    // Local harness evidence only. No native iPhone/desktop support claim.
  } finally { await context.close(); }
});
