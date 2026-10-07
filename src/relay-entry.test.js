import { LOEW_INTERFACE_SKILL_URI } from "./loew-interface-skill.js";
import test from "node:test";
import assert from "node:assert/strict";
import { RELAY_EXTENSION_VERSION, augmentToolList, augmentResourceList, augmentSkillList, validateLifecycleArguments, classifyExtensionError } from "./relay-entry.js";
import { QA_SKILL_URI } from "./qa-skill.js";
import { LOEW_NAMING_SKILL_URI } from "./loew-naming-skill.js";
import { EXECUTIVE_COMMUNICATION_SKILL_URI } from "./executive-communication-skill.js";
import { RELAY_CONTEXT_CARD_URI, relayContextCardTool, relayContextCardDescriptor } from "./relay-chat-ui.js";
import { RELAY_V2_PROBE_URI, relayV2ProbeDescriptor } from "./relay-v2-probe.js";

test("Relay extension publishes source inventory and exact-head PR action", () => {
  const tools = augmentToolList([{
    name: "relay_source_create_branch",
    description: "old",
    inputSchema: { type: "object" },
    annotations: {},
    securitySchemes: [{ type: "oauth2", scopes: [] }],
    _meta: { existing: true }
  }, {
    name: "relay_source_update_file",
    description: "legacy token text",
    inputSchema: { type: "object" },
    annotations: {},
    securitySchemes: [{ type: "oauth2", scopes: [] }]
  }, {
    name: "relay_runner_progress",
    description: "Read Relay progress",
    inputSchema: { type: "object", properties: { project: { type: "string" } }, required: ["project"] },
    annotations: { readOnlyHint: true },
    securitySchemes: [{ type: "oauth2", scopes: [] }],
    _meta: { existing: true }
  }, relayContextCardTool()]);
  const names = tools.map(tool => tool.name);
  assert.ok(names.includes("relay_source_inventory"));
  assert.ok(names.includes("relay_source_pull_request_action"));
  assert.ok(names.includes("relay_source_edit_text"));
  assert.ok(names.includes("relay_source_append_text"));
  assert.ok(names.includes("relay_staff_directory"));
  assert.ok(names.includes("relay_render_context_card"));
  const renderer=tools.find(tool=>tool.name==="relay_render_context_card");
  assert.equal(renderer._meta.ui.resourceUri,"ui://relay/context-card/v16.html");
  assert.equal(renderer._meta["openai/outputTemplate"],"ui://relay/context-card/v16.html");
  const progress=tools.find(tool=>tool.name==="relay_runner_progress");
  assert.equal(progress._meta?.ui?.resourceUri,undefined);
  assert.equal(progress._meta?.["openai/outputTemplate"],undefined);
  assert.deepEqual(progress.inputSchema,{ type: "object", properties: { project: { type: "string" } }, required: ["project"] });
  const branch = tools.find(tool => tool.name === "relay_source_create_branch");
  assert.match(branch.description, /exact 40-character commit SHA/);
  assert.equal(branch._meta.existing, true);
  assert.ok(names.includes("relay_runner_cleanup"));
  assert.ok(names.includes("relay_cloud_upload_version"));
  assert.equal(tools.find(tool => tool.name === "relay_source_update_file").description.includes("GitHub App preferred"), true);
  assert.equal(RELAY_EXTENSION_VERSION, "1.9.9");
});

test("server validation rejects unsupported and cross-action PR fields", () => {
  assert.throws(
    () => validateLifecycleArguments("relay_source_inventory", { repo: "x", surprise: true }),
    /Unsupported argument/
  );
  assert.throws(
    () => validateLifecycleArguments("relay_source_pull_request_action", {
      repo: "x", number: 1, action: "ready", expected_head_sha: "a".repeat(40), merge_method: "squash"
    }),
    /does not accept/
  );
  assert.throws(
    () => validateLifecycleArguments("relay_source_pull_request_action", {
      repo: "x", number: 1, action: "update", expected_head_sha: "a".repeat(40)
    }),
    /requires title, body, or base/
  );
});

test("extension errors classify retry and readback boundaries", () => {
  const validation = classifyExtensionError(new Error("Invalid repository path"), "relay_source_edit_text");
  assert.equal(validation.class, "validation");
  assert.equal(validation.retryable, false);
  assert.match(validation.recovery, /arguments|schema/i);

  const conflict = classifyExtensionError(new Error("Branch head changed; refresh before mutating text"), "relay_source_edit_text");
  assert.equal(conflict.class, "conflict");
  assert.match(conflict.recovery, /re-read|reconcile/i);

  const timeout = new Error("provider timed out");
  timeout.name = "TimeoutError";
  const uncertain = classifyExtensionError(timeout, "relay_source_edit_text");
  assert.equal(uncertain.class, "uncertain_write");
  assert.equal(uncertain.retryable, false);
  assert.match(uncertain.recovery, /read back/i);
});

test('mixed extension operations preserve query versus unknown-write timeout semantics',()=>{
  const error=Object.assign(new Error('provider timed out'),{name:'TimeoutError'});
  assert.equal(classifyExtensionError(error,'relay_execution',{action:'status'}).class,'timeout');
  assert.equal(classifyExtensionError(error,'relay_execution',{action:'submit'}).class,'uncertain_write');
  assert.equal(classifyExtensionError(error,'relay_night_shift',{action:'shift'}).class,'uncertain_write');
  assert.equal(classifyExtensionError(error,'relay_ui_request',{method:'POST'}).class,'uncertain_write');
  assert.equal(classifyExtensionError(error,'unknown_read_tool').class,'uncertain_write');
});

test("server validation accepts exact-head merge input", () => {
  const args = {
    repo: "relay",
    number: 32,
    action: "merge",
    expected_head_sha: "b".repeat(40),
    merge_method: "squash"
  };
  assert.equal(validateLifecycleArguments("relay_source_pull_request_action", args), args);
});

test('typed GitHub quota403 preserves its retry deadline instead of requesting an authority refresh',()=>{
  const failure=classifyExtensionError(Object.assign(new Error('GitHub quota exhausted'),{status:403,code:'rate_limit',github:{
    provider:'github',status:403,phase:'resource_request',auth_mode:'github_app_installation',rate_limit_remaining:0,
    rate_limit_limit:5000,rate_limit_used:5000,rate_limit_reset:1791356400,installation_id:166454233,
    private_token:'must-not-be-returned',private_payload:{secret:'must-not-be-returned'}
  }}),'relay_source_pull_request_action');
  assert.equal(failure.class,'rate_limit');assert.equal(failure.retryable,false);assert.equal(failure.requires_auth,false);
  assert.equal(failure.retry_at,'2026-10-07T07:00:00.000Z');assert.equal(failure.upstream.rate_limit_used,5000);
  assert.match(failure.recovery,/Wait until 2026-10-07T07:00:00/);assert.doesNotMatch(failure.recovery,/Refresh Relay authority/);
  assert.doesNotMatch(JSON.stringify(failure),/must-not-be-returned|private_token|private_payload/);
  const denied=classifyExtensionError(Object.assign(new Error('Resource not accessible by integration'),{status:403}),'relay_source_pull_request_action');
  assert.equal(denied.class,'permission');assert.equal(denied.retry_at,undefined);
});


test("Relay extension preserves native card resources and appends skills once", () => {
  const resources = augmentResourceList([{ uri: "skill://relay/existing/SKILL.md" }, relayContextCardDescriptor()]);
  const skills = augmentSkillList([{ uri: "skill://relay/existing/SKILL.md" }]);
  assert.equal(resources.filter(item => item.uri === RELAY_CONTEXT_CARD_URI).length, 1);
  assert.equal(resources.filter(item => item.uri === RELAY_V2_PROBE_URI).length, 1);
  assert.deepEqual(resources.find(item => item.uri === RELAY_V2_PROBE_URI), relayV2ProbeDescriptor());
  for (const uri of [QA_SKILL_URI, LOEW_NAMING_SKILL_URI, EXECUTIVE_COMMUNICATION_SKILL_URI, LOEW_INTERFACE_SKILL_URI]) {
    assert.equal(resources.filter(item => item.uri === uri).length, 1);
    assert.equal(skills.filter(item => item.uri === uri).length, 1);
  }

  const resourcesAgain = augmentResourceList(resources);
  const skillsAgain = augmentSkillList(skills);
  assert.equal(resourcesAgain.filter(item => item.uri === RELAY_CONTEXT_CARD_URI).length, 1);
  assert.equal(resourcesAgain.filter(item => item.uri === RELAY_V2_PROBE_URI).length, 1);
  for (const uri of [QA_SKILL_URI, LOEW_NAMING_SKILL_URI, EXECUTIVE_COMMUNICATION_SKILL_URI, LOEW_INTERFACE_SKILL_URI]) {
    assert.equal(resourcesAgain.filter(item => item.uri === uri).length, 1);
    assert.equal(skillsAgain.filter(item => item.uri === uri).length, 1);
  }
});

test("fresh inline status card is listed and readable through the authenticated MCP endpoint", async t => {
  const { generateKeyPairSync, sign } = await import("node:crypto");
  const { default: worker } = await import("./relay-entry.js");
  const { relayContextCardResource, relayStatusCardResource } = await import("./relay-chat-ui.js");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "status-card-regression";
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = encode({ alg: "RS256", kid }) + "." + encode({
    iss: "https://loewfi.cloudflareaccess.com",
    aud: ["7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819"],
    exp: Math.floor(Date.now() / 1000) + 600
  });
  const token = payload + "." + sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64url");
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(String(url), "https://loewfi.cloudflareaccess.com/cdn-cgi/access/certs");
    return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid }] });
  });
  const rpc = async (method, params = {}, env = {}) => {
    const response = await worker.fetch(new Request("https://relay.loew.fi/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-access-jwt-assertion": token },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
    }), env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.error, undefined);
    return body.result;
  };
  const uri = "ui://relay/status-card/v4-legacy-bridge.html";
  const { tools } = await rpc("tools/list");
  const fresh = tools.filter(tool => tool.name === "relay_show_legacy_bridge_card");
  assert.equal(fresh.length, 1);
  const tool = fresh[0];
  const control = tools.find(tool => tool.name === "relay_ui_control_center");
  const old = tools.find(tool => tool.name === "relay_render_context_card");
  assert.equal(tool._meta.ui.resourceUri, uri);
  assert.equal(tool._meta["openai/outputTemplate"], uri);
  assert.deepEqual(tool._meta.ui.visibility, control._meta.ui.visibility);
  assert.deepEqual(tool.securitySchemes, control.securitySchemes);
  assert.deepEqual(tool._meta.securitySchemes, control._meta.securitySchemes);
  assert.equal(tool._meta["openai/ui"], undefined);
  assert.deepEqual(tool.inputSchema, old.inputSchema);
  assert.deepEqual(tool.annotations, old.annotations);
  assert.equal(old._meta.ui.resourceUri, "ui://relay/context-card/v16.html");
  const { resources } = await rpc("resources/list");
  assert.equal(resources.filter(resource => resource.uri === uri).length, 1);
  assert.equal(resources.find(resource => resource.uri === uri).mimeType, "text/html;profile=mcp-app");
  assert.equal(resources.filter(resource => resource.uri === RELAY_CONTEXT_CARD_URI).length, 1);
  const { contents } = await rpc("resources/read", { uri });
  assert.equal(contents.length, 1);
  assert.equal(contents[0].uri, uri);
  assert.equal(contents[0].mimeType, "text/html;profile=mcp-app");
  const original = relayStatusCardResource();
  assert.equal(contents[0].text, original.text);
  assert.deepEqual(contents[0]._meta, original._meta);
  assert.deepEqual(contents[0]._meta["openai/ui"].availableDisplayModes, ["inline"]);
  assert.equal(contents[0]._meta["openai/ui"].entrypoints, undefined);
  const oldResource = await rpc("resources/read", { uri: RELAY_CONTEXT_CARD_URI });
  assert.deepEqual(oldResource.contents[0], relayContextCardResource());
  for(const [alias,current] of [['ui://relay/context-card/v15.html',relayContextCardResource()],['ui://relay/status-card/v3-legacy-bridge.html',relayStatusCardResource()]]){
    const response=await rpc('resources/read',{uri:alias});
    assert.equal(response.contents[0].uri,alias);assert.equal(response.contents[0].text,current.text);
  }
  const invalid = await rpc("tools/call", { name: "relay_show_legacy_bridge_card", arguments: { project: "../relay" } });
  assert.equal(invalid.isError, true);
  assert.match(invalid.content[0].text, /Invalid card project/);

  await t.test('authenticated source reads preserve GitHub quota deadlines and never offer a browser fallback',async()=>{
    const priorFetch=globalThis.fetch;let calls=0,quota=true;
    const reset=Math.floor(Date.now()/1000)+600,retryAt=new Date(reset*1000).toISOString();
    t.mock.method(globalThis,'fetch',async(url,options)=>{
      if(!String(url).startsWith('https://api.github.com/'))return priorFetch(url,options);
      calls++;assert.equal(String(url),'https://api.github.com/repos/lrnolivia/relay/pulls/167');
      return Response.json({message:quota?'API rate limit exceeded for installation ID166454233':'Resource not accessible by integration'},
        {status:403,headers:quota?{'x-ratelimit-limit':'5000','x-ratelimit-used':'5000','x-ratelimit-remaining':'0','x-ratelimit-reset':String(reset)}:{}});
    });
    try{
      const params={name:'relay_source_pull_request',arguments:{repo:'relay',number:167}};
      const result=await rpc('tools/call',params,{RELAY_GITHUB_TOKEN:'mcp-quota-fixture'});
      assert.equal(result.isError,true);assert.equal(result.structuredContent.namespace,'relay.SOURCE');
      assert.equal(result.structuredContent.error.class,'rate_limit');assert.equal(result.structuredContent.error.retry_at,retryAt);
      assert.equal(result.structuredContent.error.upstream.rate_limit_used,5000);assert.equal(result.structuredContent.error.retryable,false);
      assert.equal(result.structuredContent.human_v1.message_id,'error.rate_limit');
      assert.match(result.structuredContent.human_v1.summary,/resume after/);
      const legacyText=JSON.parse(result.content[0].text);
      assert.equal(legacyText.error.class,'rate_limit');assert.equal(legacyText.human_v1,undefined);
      assert.equal(result.structuredContent.reason,undefined);assert.doesNotMatch(JSON.stringify(result),/browser_capacity|github-chromium|mcp-quota-fixture/);
      const blocked=await rpc('tools/call',params,{RELAY_GITHUB_TOKEN:'mcp-quota-fixture'});
      assert.equal(blocked.structuredContent.error.upstream.request_attempted,false);assert.equal(calls,1);
      const rollback=await rpc('tools/call',params,{RELAY_GITHUB_TOKEN:'mcp-quota-fixture',RELAY_HUMAN_PRESENTATION:'legacy'});
      assert.equal(rollback.structuredContent.presentation_mode,'legacy');assert.equal(rollback.structuredContent.human_v1,undefined);assert.equal(calls,1);
      quota=false;const denied=await rpc('tools/call',params,{RELAY_GITHUB_TOKEN:'mcp-permission-fixture'});
      assert.equal(denied.structuredContent.error.class,'permission');assert.equal(denied.structuredContent.error.retry_at,undefined);
      const unauthenticated=await worker.fetch(new Request('https://relay.loew.fi/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params})}),{RELAY_GITHUB_TOKEN:'mcp-permission-fixture'});
      assert.equal(unauthenticated.status,401);assert.equal(calls,2);
    }finally{t.mock.method(globalThis,'fetch',priorFetch);}
  });

  await t.test('feedback tools enforce the existing authentication and preserve readable receipts', async () => {
    const priorFetch = globalThis.fetch;
    const file = value => Response.json({ type: 'file', sha: 'b'.repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') });
    let head = 'a'.repeat(40), changeHeadOnWrite = false;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      const path = String(url);
      if (path.includes('projects/fixture.json')) return file({ id: 'fixture', repository: 'lrnolivia/fixture', managed: true, default_branch: 'main',
        implementation: { branch_prefixes: ['fixture/'], excluded_branches: ['main'] },
        coordination: { status: 'enabled', record: 'coordination/fixture.json', max_active_branches: 4, lease_hours: 12 } });
      if (path.includes('coordination/fixture.json')) return file({ project: 'fixture', claims: [{ id: 'task', owner: 'fixture-owner', branch: 'fixture/task', state: 'active' }], queue: [], legacy_branches: [] });
      if (path.includes('/git/ref/heads/')) return Response.json({ object: { sha: head } });
      return priorFetch(url, options);
    });
    let writes = 0;
    const data = new Map();
    const env = { EVIDENCE: {
      async get(key) { return data.has(key) ? { etag: String(writes), json: async () => JSON.parse(data.get(key)) } : null; },
      async put(key, value, options) {
        if (options.onlyIf instanceof Headers && data.has(key)) return null;
        data.set(key, value); writes++;
        if (changeHeadOnWrite) head = 'c'.repeat(40);
        return { etag: String(writes) };
      }
    } };
    const args = { project: 'fixture', assignment: 'task', expected_owner: 'fixture-owner', expected_branch: 'fixture/task',
      operation_id: 'entry-fixture', original_text: 'Synthetic entrypoint fixture.', artifact: { repository: 'lrnolivia/fixture', commit_sha: head } };
    const params = { name: 'relay_runner_feedback_submit', arguments: args };
    const denied = await worker.fetch(new Request('https://relay.loew.fi/mcp', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params }) }), env);
    assert.equal(denied.status, 401); assert.equal(writes, 0);
    const saved = await rpc('tools/call', params, env);
    assert.equal(saved.isError, undefined); assert.equal(saved.structuredContent.feedback.original_text, args.original_text);
    assert.equal(saved.structuredContent.feedback.reporter, 'authenticated-mcp-caller-unattributed');
    assert.equal(saved.structuredContent.feedback.status.delivered, null);
    assert.ok(saved.content[0].text.includes(saved.structuredContent.feedback.report_id));
    const retry = await rpc('tools/call', params, env);
    assert.equal(retry.structuredContent.feedback.replayed, true); assert.equal(writes, 1);
    const conflict = await rpc('tools/call', { ...params, arguments: { ...args, original_text: 'Different intent.' } }, env);
    assert.equal(conflict.isError, true); assert.equal(conflict.structuredContent.error.class, 'conflict');
    changeHeadOnWrite = true;
    const raced = await rpc('tools/call', { ...params, arguments: { ...args, operation_id: 'raced-identity' } }, env);
    assert.equal(raced.isError, true); assert.equal(raced.structuredContent.reconcile_required, true);
    assert.ok(raced.structuredContent.report.report_id);
  });
});
