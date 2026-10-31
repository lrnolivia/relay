import test from "node:test";
import assert from "node:assert/strict";
import { RELAY_CONTEXT_CARD_URI, RELAY_CONTEXT_CARD_TOOL, RELAY_STATUS_CARD_URI, RELAY_STATUS_CARD_TOOL, relayContextCardDescriptor, relayContextCardResource, relayContextCardTool, relayStatusCardDescriptor, relayStatusCardResource, relayStatusCardTool, validateRelayContextCardArguments, contextualizeRelayTool, isContextualRelayTool } from "./relay-chat-ui.js";

test("Relay publishes one versioned compact MCP card resource", () => {
  const descriptor = relayContextCardDescriptor();
  const resource = relayContextCardResource();
  assert.equal(RELAY_CONTEXT_CARD_URI, "ui://relay/context-card/v23.html");
  assert.equal(descriptor.uri, RELAY_CONTEXT_CARD_URI);
  assert.equal(resource.uri, RELAY_CONTEXT_CARD_URI);
  assert.equal(resource.mimeType, "text/html;profile=mcp-app");
  assert.match(resource.text, /observed progress|runner/i);
  assert.match(resource.text, /open relay/i);
  assert.match(resource.text, /qa-media/);
  assert.match(resource.text, /ui\/initialize/);
  assert.match(resource.text, /ui\/notifications\/initialized/);
  assert.match(resource.text, /ui\/notifications\/size-changed/);
  assert.match(resource.text, /notifyIntrinsicHeight/);
  assert.match(resource.text, /id="diag"/);
  assert.match(resource.text, /openai:set_globals/);
  assert.match(resource.text, /toolOutput/);
  assert.match(resource.text, /relay_runner_progress/);
  assert.deepEqual(resource._meta.ui.csp.resourceDomains,['https://relay.loew.fi']);
});

test("legacy bridge bisect keeps v8 as the control and uses a fresh tool/resource identity", () => {
  const control = relayContextCardResource();
  const legacy = relayStatusCardResource();
  const descriptor = relayStatusCardDescriptor();
  const tool = relayStatusCardTool();
  assert.equal(RELAY_STATUS_CARD_URI, "ui://relay/status-card/v5-legacy-bridge.html");
  assert.equal(RELAY_STATUS_CARD_TOOL, "relay_show_legacy_bridge_card");
  assert.equal(descriptor.uri, RELAY_STATUS_CARD_URI);
  assert.equal(tool.name, RELAY_STATUS_CARD_TOOL);
  assert.equal(tool._meta.ui.resourceUri, RELAY_STATUS_CARD_URI);
  assert.equal(tool._meta["openai/outputTemplate"], RELAY_STATUS_CARD_URI);
  assert.match(legacy.text, /let toolInput=window\.openai\?\.toolInput\|\|\{\}/);
  assert.match(legacy.text, /const ready=window\.openai\?Promise\.resolve\(\):rpc\('ui\/initialize'/);
  assert.match(legacy.text, /if\(window\.openai\?\.toolOutput\)render\(window\.openai\.toolOutput\)/);
  assert.match(legacy.text, /if\(window\.openai\?\.callTool\)return window\.openai\.callTool\(name,args\)/);
  assert.match(legacy.text, /openai:set_globals/);
  assert.match(control.text, /const ready=rpc\('ui\/initialize'/);
  assert.doesNotMatch(control.text, /const ready=window\.openai\?Promise\.resolve\(\):rpc\('ui\/initialize'/);
});

test("legacy bridge renders directly from ChatGPT globals without sending ui initialize", async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.openai = {
        toolInput: { project: 'relay' },
        toolOutput: { project: 'relay', claim: { primary_staff: 'nico', goal: 'Desktop legacy bridge proof', state: 'active' } },
        callTool: async () => ({})
      };
    });
    const widgetUrl = 'data:text/html,' + encodeURIComponent(relayStatusCardResource().text);
    await page.setContent(`<!doctype html><script>
      window.seenInitialize=false;
      window.addEventListener('message',event=>{
        const frame=document.getElementById('widget');
        const message=event.data;
        if(event.source!==frame?.contentWindow||message?.jsonrpc!=='2.0')return;
        if(message.method==='ui/initialize')window.seenInitialize=true;
      });
    <\/script><iframe id="widget" src="${widgetUrl}"></iframe>`);
    const frame = page.frameLocator('#widget');
    await frame.locator('#title').filter({ hasText: 'Desktop legacy bridge proof' }).waitFor();
    assert.equal(await page.evaluate(() => window.seenInitialize), false);
  } finally { await browser.close(); }
});

test("legacy bridge still initializes standard MCP Apps when ChatGPT globals are absent", async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const widgetUrl = 'data:text/html,' + encodeURIComponent(relayStatusCardResource().text);
    await page.setContent(`<!doctype html><script>
      window.seenInitialize=false;
      window.addEventListener('message',event=>{
        const frame=document.getElementById('widget');
        const message=event.data;
        if(event.source!==frame?.contentWindow||message?.jsonrpc!=='2.0')return;
        if(message.method==='ui/initialize'){
          window.seenInitialize=true;
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2026-01-26'}},'*');
        } else if(message.method==='ui/notifications/initialized'){
          frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{project:'relay'}},'*');
          frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{project:'relay',claim:{primary_staff:'nico',goal:'Standard bridge fallback proof',state:'active'}}}},'*');
        }
      });
    <\/script><iframe id="widget" src="${widgetUrl}"></iframe>`);
    const frame = page.frameLocator('#widget');
    await frame.locator('#title').filter({ hasText: 'Standard bridge fallback proof' }).waitFor();
    assert.equal(await page.evaluate(() => window.seenInitialize), true);
  } finally { await browser.close(); }
});

test("data tools keep their schemas and do not claim the render template", () => {
  const original = {
    name: "relay_runner_progress",
    inputSchema: { type: "object", properties: { project: { type: "string" } } },
    _meta: { existing: true }
  };
  const decorated = contextualizeRelayTool(original);
  assert.equal(decorated, original);
  assert.deepEqual(decorated.inputSchema, original.inputSchema);
  assert.equal(decorated._meta.existing, true);
  assert.equal(decorated._meta.ui, undefined);
  assert.equal(isContextualRelayTool(original.name), true);
});

test("dedicated launcher owns the MCP Apps mount contract", () => {
  const tool=relayContextCardTool();
  assert.equal(tool.name,RELAY_CONTEXT_CARD_TOOL);
  assert.equal(tool._meta.ui.resourceUri,RELAY_CONTEXT_CARD_URI);
  assert.equal(tool._meta["openai/outputTemplate"],RELAY_CONTEXT_CARD_URI);
  assert.equal(tool.annotations.readOnlyHint,true);
  assert.equal(tool.inputSchema.additionalProperties,false);
  assert.deepEqual(validateRelayContextCardArguments({project:"relay",assignment:"relay-1.9.9-chatgpt-native-experience-20261001"}),{project:"relay",assignment:"relay-1.9.9-chatgpt-native-experience-20261001"});
  assert.deepEqual(validateRelayContextCardArguments({project:"relay",evidence_id:"vis_abcdefgh",show_qa:true}),{project:"relay",evidence_id:"vis_abcdefgh",show_qa:true});
  assert.throws(()=>validateRelayContextCardArguments({project:"relay",evidence_id:"bad"}),/Invalid card evidence id/);
  assert.throws(()=>validateRelayContextCardArguments({project:"relay",surprise:true}),/Unsupported card argument/);
});

test("unrelated tools are not forced into contextual UI", () => {
  const tool = { name: "relay_control_status", inputSchema: { type: "object" } };
  assert.equal(contextualizeRelayTool(tool), tool);
});


test("context card opens Relay through supported external navigation", () => {
  const resource = relayContextCardResource();
  assert.match(resource.text, /openExternal/);
  assert.match(resource.text, /ui\/open-link/);
  assert.deepEqual(resource._meta['openai/ui'].availableDisplayModes,['inline','fullscreen']);
  assert.equal(resource._meta['openai/ui'].preferredDisplayMode,'inline');
  assert.doesNotMatch(resource.text, /ui:\/\/relay\/control-center\/v1\.html/);
});

test('queries stay data-first while ordinary milestone commands mount the work card', () => {
  for(const name of ['relay_runner_resume','relay_runner_updates','relay_runner_progress']) {
    const tool={name};
    assert.equal(contextualizeRelayTool(tool),tool);
    assert.equal(isContextualRelayTool(name),true);
  }
  for(const name of ['relay_runner_coordinate','relay_execution','relay_source_open_pull_request','relay_source_checks','relay_source_pull_request_action','relay_cloud_deploy_project_version']) {
    const tool=contextualizeRelayTool({name,inputSchema:{type:'object'},_meta:{existing:true}});
    assert.equal(tool._meta.ui.resourceUri,RELAY_CONTEXT_CARD_URI,name);
    assert.equal(tool._meta['openai/outputTemplate'],RELAY_CONTEXT_CARD_URI,name);
    assert.deepEqual(tool._meta.ui.visibility,['model','app']);
    assert.equal(tool._meta.existing,true);
    assert.deepEqual(tool.inputSchema,{type:'object'});
    assert.equal(isContextualRelayTool(name),true,name);
  }
  const renderer=contextualizeRelayTool(relayContextCardTool());
  assert.equal(renderer._meta.ui.resourceUri,RELAY_CONTEXT_CARD_URI);
  assert.doesNotMatch(renderer._meta.ui.resourceUri,/control-center/);
});
test('cards show named teams blockers handoffs QA and subordinate exact evidence', async () => {
  const {contextCardModel}=await import('./relay-chat-ui.js');
  const m=contextCardModel({project:'relay',action:'handoff',claim:{id:'exact-task',owner:'next-owner',primary_staff:'julian',supporting_staff:['roman'],state:'blocked',goal:'Connect the release',next_action:'Fix the failing gate',waiting_reason:'Client still has old schema',branch:'relay/exact'},qa:{intended_result:'New card renders',checks:['Card is compact']}});
  assert.equal(m.team,'Julian with Roman');assert.equal(m.blocker,'Client still has old schema');assert.equal(m.handoff,'The assignment was transferred.');assert.equal(m.evidence.owner,'next-owner');assert.equal(m.qa.checks[0],'Card is compact');
  assert.equal(contextCardModel({ok:false,error:{message:'Authorization required'}}).label,'Could not load updates');
  assert.equal(contextCardModel({check_runs:[]}).label,'Checks unconfirmed');
});
test('card initializes the standard MCP Apps bridge even when window.openai exists', async () => {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.addInitScript(()=>{window.openai={requestModal:async()=>{}}});
    const widgetUrl='data:text/html,'+encodeURIComponent(relayContextCardResource().text);
    await page.setContent(`<!doctype html><script>
      window.seenInitialize=false;
      window.addEventListener('message',event=>{
        const frame=document.getElementById('widget');
        const message=event.data;
        if(event.source!==frame?.contentWindow||message?.jsonrpc!=='2.0')return;
        if(message.method==='ui/initialize'){
          window.seenInitialize=true;
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2026-01-26'}},'*');
        } else if(message.method==='ui/notifications/initialized'){
          frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{project:'relay'}},'*');
          frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{project:'relay',claim:{primary_staff:'julian',supporting_staff:['roman'],goal:'Staff routing is ready',state:'active'}}}},'*');
        }
      });
    <\/script><iframe id="widget" src="${widgetUrl}"></iframe>`);
    const frame=page.frameLocator('#widget');
    await frame.locator('#title').filter({hasText:'Staff routing is ready'}).waitFor();
    assert.equal(await page.evaluate(()=>window.seenInitialize),true);
    assert.match(await frame.locator('#team').textContent(),/Assignment lead/);
    assert.equal(await frame.locator('#staff').getAttribute('title'),'Julian with Roman');
  } finally {await browser.close()}
});

test('technical canonical notes remain exact evidence and never become the default human summary',async()=>{
  const {contextCardModel,contextualPresentation}=await import('./relay-chat-ui.js');
  const next='PR #72 merged a015761290cf86ada0c48e0537dbede1ce4e6cb2; deploy Worker version 14b11840-1c72-4402-a5da-e47d33e2ac4d then refresh ChatGPT';
  const data={project:'relay',latest:{assignment:{primary_staff:'julian',supporting_staff:['roman']},identities:{merge_commit_sha:'a'.repeat(40)},next_action:next,state:'working'}};
  const model=contextCardModel(data);assert.doesNotMatch(model.summary,/a015761|PR #72|Worker version/);assert.doesNotMatch(model.next_step,/a015761/);assert.equal(model.evidence.next_action,next);
  assert.equal(contextualPresentation(data).human.staff,'Julian with Roman');
});

test('successful merge receipts tolerate numeric check counts without hiding the write result', async () => {
  const {contextualPresentation}=await import('./relay-chat-ui.js');
  const receipt={ok:true,checks:{check_runs:3,status_contexts:0},merge:{merged:true},pull_request:{number:73,title:'Repair conversational summaries',merged:true,merge_commit_sha:'a'.repeat(40)}};
  const result=contextualPresentation(receipt);
  assert.equal(result.human.what_changed,'The source change is merged.');
  assert.equal(result.pull_request.merge_commit_sha,receipt.pull_request.merge_commit_sha);
  assert.equal(result.merge.merged,true);
});


test('context card is host-transparent and avoids the old framed panel chrome', () => {
  const resource = relayContextCardResource();
  assert.match(resource.text, /html,body\{background:transparent!important\}/);
  assert.match(resource.text, /\.card\{--accent:#b5471f;border:0;padding:8px 2px;background:transparent!important;box-shadow:none\}/);
  assert.match(resource.text, /grid-template-columns:minmax\(0,1fr\) minmax\(230px,38%\)/);
  assert.match(resource.text, /feature-mark/);
  assert.match(resource.text, /status-light/);
  assert.doesNotMatch(resource.text, /\.card\{border:1px solid/);
});

test('finished work does not repeat stale next actions or redundant single status rows', async () => {
  const {contextCardModel}=await import('./relay-chat-ui.js');
  const finished=contextCardModel({
    project:'relay',
    claim:{primary_staff:'julian',state:'completed',goal:'Ship the team foundation',next_action:'Old instruction that should no longer appear'}
  });
  assert.equal(finished.next_step,null);
  assert.deepEqual(finished.rows,[]);

  const duplicated=contextCardModel({
    project:'relay',
    claim:{primary_staff:'julian',state:'active',goal:'Repair the card',next_action:'Keep going'},
    human:{what_changed:'Keep going',next_step:'Keep going'}
  });
  assert.equal(duplicated.next_step,null);
});


test('feature identity keeps a truthful metric without accepting an unbound percentage', async () => {
  const {contextCardModel}=await import('./relay-chat-ui.js');
  const runner=contextCardModel({
    project:'relay',
    claim:{primary_team:'runner',primary_staff:'nico',state:'working',goal:'Build the card',progress_percent:50}
  });
  assert.equal(runner.feature,'runner');
  assert.equal(runner.percent,null);
  assert.notEqual(runner.metric,'50%');
  assert.equal(runner.has_metric,false);assert.equal(runner.metric_label,null);
  assert.equal(runner.signal,'working');

  const verification=contextCardModel({checks:{check_runs:[
    {name:'test',status:'completed',conclusion:'success'},
    {name:'admission',status:'completed',conclusion:'success'}
  ]}});
  assert.equal(verification.feature,'inspector');
  assert.equal(verification.metric,'2/2');
  assert.equal(verification.metric_label,'checks reported');
});


test('card can reuse the latest stored Inspector QA screenshot through standard tools/call', async () => {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    const widgetUrl='data:text/html,'+encodeURIComponent(relayContextCardResource().text);
    await page.setContent(`<!doctype html><script>
      window.addEventListener('message',event=>{
        const frame=document.getElementById('widget');
        const message=event.data;
        if(event.source!==frame?.contentWindow||message?.jsonrpc!=='2.0')return;
        if(message.method==='ui/initialize'){
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2026-01-26'}},'*');
        } else if(message.method==='ui/notifications/initialized'){
          frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{project:'relay',show_qa:true}},'*');
          frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{project:'relay',claim:{primary_staff:'julian',goal:'Visual proof is ready',state:'active'}}}},'*');
        } else if(message.method==='tools/call'){
          const path=message.params?.arguments?.path;
          let structuredContent={status:404};
          if(path==='/api/visual?project=relay') structuredContent={status:200,body:{evidence:[{evidence_id:'vis_abcdefgh',step_label:'Relay card preview'}]}};
          if(path==='/api/visual/vis_abcdefgh/image') structuredContent={status:200,content_type:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlQZQAAAABJRU5ErkJggg=='};
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{structuredContent,content:[{type:'text',text:JSON.stringify(structuredContent)}]}},'*');
        }
      });
    <\/script><iframe id="widget" src="${widgetUrl}"></iframe>`);
    const frame=page.frameLocator('#widget');
    await frame.locator('#qa-media').waitFor({state:'visible'});
    assert.equal(await frame.locator('#qa-media-id').textContent(),'vis_abcdefgh');
    assert.equal(await frame.locator('#qa-media-caption').textContent(),'Relay card preview');
    assert.match(await frame.locator('#qa-media-image').getAttribute('src'),/^data:image\/png;base64,/);
    await frame.locator('#qa-media-image').click();
    await frame.getByRole('dialog',{name:'screenshot preview'}).waitFor();
    await frame.getByRole('button',{name:'Close screenshot'}).click();
    assert.equal(await frame.locator('.screenshot-dialog').count(),0);
  } finally { await browser.close(); }
});


test('historical ChatGPT remount hydrates from compatibility globals without a replayed tool-result', async () => {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.addInitScript(()=>{
      window.openai={
        toolInput:{project:'relay'},
        toolOutput:{project:'relay',claim:{primary_staff:'nico',goal:'Historical card restored',state:'active'}}
      };
    });
    const widgetUrl='data:text/html,'+encodeURIComponent(relayContextCardResource().text);
    await page.setContent(`<!doctype html><script>
      window.toolCalls=0;
      window.addEventListener('message',event=>{
        const frame=document.getElementById('widget');
        const message=event.data;
        if(event.source!==frame?.contentWindow||message?.jsonrpc!=='2.0')return;
        if(message.method==='ui/initialize'){
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2026-01-26'}},'*');
        } else if(message.method==='tools/call'){
          window.toolCalls+=1;
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{structuredContent:{ok:false,error:'unexpected fallback call'}}},'*');
        }
      });
    <\/script><iframe id="widget" src="${widgetUrl}"></iframe>`);
    const frame=page.frameLocator('#widget');
    await frame.locator('#title').filter({hasText:'Historical card restored'}).waitFor();
    assert.equal(await page.evaluate(()=>window.toolCalls),0);
  } finally {await browser.close()}
});

test('historical remount self-recovers once from canonical progress when the host replays input but not output', async () => {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.addInitScript(()=>{window.openai={toolInput:{project:'relay'}}});
    const widgetUrl='data:text/html,'+encodeURIComponent(relayContextCardResource().text);
    await page.setContent(`<!doctype html><script>
      window.calls=[];
      window.addEventListener('message',event=>{
        const frame=document.getElementById('widget');
        const message=event.data;
        if(event.source!==frame?.contentWindow||message?.jsonrpc!=='2.0')return;
        if(message.method==='ui/initialize'){
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2026-01-26'}},'*');
        } else if(message.method==='tools/call'){
          window.calls.push(message.params);
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{structuredContent:{project:'relay',claim:{primary_staff:'nico',goal:'Recovered from canonical progress',state:'working'}}}},'*');
        }
      });
    <\/script><iframe id="widget" src="${widgetUrl}"></iframe>`);
    const frame=page.frameLocator('#widget');
    await frame.locator('#title').filter({hasText:'Recovered from canonical progress'}).waitFor();
    const calls=await page.evaluate(()=>window.calls);
    assert.equal(calls.length,1);
    assert.equal(calls[0].name,'relay_runner_progress');
    assert.deepEqual(calls[0].arguments,{project:'relay'});
  } finally {await browser.close()}
});


test('v9 card paints from ChatGPT globals immediately when the host never answers ui/initialize', async () => {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.addInitScript(()=>{window.openai={toolInput:{project:'relay'},toolOutput:{project:'relay',claim:{primary_staff:'nico',goal:'Immediate paint proof',state:'active'}}}});
    const widgetUrl='data:text/html,'+encodeURIComponent(relayContextCardResource().text);
    await page.setContent(`<!doctype html><iframe id="widget" src="${widgetUrl}"></iframe>`);
    const frame=page.frameLocator('#widget');
    await frame.locator('#title').filter({hasText:'Immediate paint proof'}).waitFor({timeout:3000});
    assert.match(await frame.locator('#diag').textContent(),/globals yes/);
  } finally {await browser.close()}
});

test('v9 card reports its height with ui/notifications/size-changed and shows handshake diagnostics', async () => {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    const widgetUrl='data:text/html,'+encodeURIComponent(relayContextCardResource().text);
    await page.setContent(`<!doctype html><script>
      window.sizes=[];
      window.addEventListener('message',event=>{
        const frame=document.getElementById('widget');
        const message=event.data;
        if(event.source!==frame?.contentWindow||message?.jsonrpc!=='2.0')return;
        if(message.method==='ui/notifications/size-changed')window.sizes.push(message.params);
        if(message.method==='ui/initialize'){
          frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2026-01-26'}},'*');
        } else if(message.method==='ui/notifications/initialized'){
          frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{project:'relay'}},'*');
          frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{project:'relay',claim:{primary_staff:'julian',goal:'Height report proof',state:'active'}}}},'*');
        }
      });
    <\/script><iframe id="widget" src="${widgetUrl}"></iframe>`);
    const frame=page.frameLocator('#widget');
    await frame.locator('#title').filter({hasText:'Height report proof'}).waitFor();
    await page.waitForFunction(()=>window.sizes.some(size=>size.height>0));
    assert.equal(await frame.locator('#diag').isVisible(),false);
    await frame.locator('#details > summary').click();
    await frame.locator('#diag').filter({hasText:/handshake ok/}).waitFor();
  } finally {await browser.close()}
});

test('production context card model remains executable after Worker keepNames bundling', async () => {
  const { build } = await import('esbuild');
  const { runInNewContext } = await import('node:vm');
  const built = await build({
    entryPoints: [new URL('./relay-chat-ui.js', import.meta.url).pathname],
    bundle: true, write: false, format: 'esm', platform: 'neutral', keepNames: true
  });
  const bundled = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
  const html = bundled.relayContextCardResource().text;
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'actual shipped resource includes its browser program');
  const prefix = script.slice(0, script.indexOf('const FEATURES='));
  assert.ok(prefix.includes('const model='), 'test executes the actual embedded model');
  const cases = [
    {project:'relay',claim:{primary_staff:'julian',state:'active',goal:'Bundled card is alive'}},
    {ok:false,error:{message:'Readable failure'}},
    {checks:{check_runs:[]}},
    {claim:{primary_staff:'nico',state:'completed',goal:'Finished',next_action:'Old action'}},
    {project:'relay',claim:{primary_team:'runner',state:'working',progress_percent:50}}
  ];
  for (const input of cases) {
    const actual = runInNewContext(prefix + ';model(input,DIRECTORY)', {input});
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(bundled.contextCardModel(input))));
  }
  assert.doesNotMatch(prefix, /\b__name\b/, 'browser code must not depend on a Worker-only helper');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.openai = {
      toolInput:{project:'relay'},
      toolOutput:{project:'relay',claim:{primary_staff:'julian',state:'active',goal:'Bundled card is alive'}}
    }; });
    await page.goto('data:text/html,' + encodeURIComponent(html));
    await page.locator('#title').filter({hasText:'Bundled card is alive'}).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('real card response is a bounded projection, not the historical assignment ledger', async()=>{
 const {compactContextCardResult}=await import('./relay-chat-ui.js');
 const history=Array.from({length:100},(_,i)=>({id:'task-'+i,state:i===99?'active':'completed',goal:'Current task '+i,owner:'verified-owner',primary_staff:'ellis',acceptance:'x'.repeat(20000),objective_history:{large:'x'.repeat(20000)}}));
 const raw={ok:true,project:'relay',record_sha:'a'.repeat(40),claims:history,queue:history};
 const card=compactContextCardResult(raw);
 assert.ok(JSON.stringify(card).length<8000);
 assert.equal(card.claims[0].id,'task-99');assert.equal(card.claims[0].owner,'verified-owner');
 assert.equal(card.coverage.claims,100);assert.equal(card.record_sha,raw.record_sha);
 assert.equal(card.claims[0].acceptance,undefined);assert.equal(history[0].acceptance.length,20000);
 assert.equal(compactContextCardResult({ok:false,error:{message:'Authentication unavailable'}}).error.message,'Authentication unavailable');
});

test('late input after initial recovery window still fetches once and empty globals do not block it', async()=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.addInitScript(()=>{window.openai={toolOutput:{}};});
  const widgetUrl='data:text/html,'+encodeURIComponent(relayContextCardResource().text);
  await page.setContent(`<!doctype html><script>
   window.calls=[];
   addEventListener('message',event=>{const frame=document.getElementById('widget'),m=event.data;
    if(event.source!==frame?.contentWindow||m?.jsonrpc!=='2.0')return;
    if(m.method==='ui/initialize'){
     frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result:{protocolVersion:'2026-01-26'}},'*');
     setTimeout(()=>frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{project:'relay'}}},'*'),800);
    }else if(m.method==='tools/call'){
     window.calls.push(m.params);
     frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result:{structuredContent:{project:'relay',claims:[{state:'active',goal:'Late input recovered'}]}}},'*');
    }
   });
  <\/script><iframe id="widget" src="${widgetUrl}"></iframe>`);
  await page.frameLocator('#widget').locator('#title').filter({hasText:'Late input recovered'}).waitFor();
  assert.equal((await page.evaluate(()=>window.calls)).length,1);
 }finally{await browser.close();}
});


test("job-focused card rows show work rather than staff and collapse long copy", async () => {
  const {contextCardModel} = await import('./relay-chat-ui.js');
  const detail='Review the entire recorded delivery history and every pending check. '.repeat(10);
  const model=contextCardModel({project:'relay',coverage:{active:7},claims:[
    {id:'relay-card-polish-20261003',state:'active',primary_staff:'ellis',goal:detail,next_action:detail},
    {id:'relay-skills-completion-20261003',state:'working',primary_staff:'roman'},
    {id:'old-job',state:'completed',primary_staff:'nico'}
  ]});
  assert.deepEqual(model.rows,[]);
  assert.equal(model.has_metric,false);assert.equal(model.metric,null);
  assert.ok(model.title.length<=72); assert.ok(model.summary.length<=150);
  assert.equal(model.next_step,null); assert.equal(model.evidence.goal,detail.trim());
  assert.equal(model.primary_staff,'Ellis');
});

test("job-focused card never turns a missing completion value into zero percent", async () => {
  const {contextCardModel}=await import('./relay-chat-ui.js');
  for(const value of [null,undefined,'']) {
    const model=contextCardModel({claims:[{id:'check-preview',state:'active',progress_percent:value}]});
    assert.equal(model.percent,null);assert.equal(model.has_metric,false);assert.equal(model.metric,null);
  }
});

test('context card actions validate native and browser results, preserve failed refresh and enlarge thumbnails',async()=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 try{
  for(const native of [false,true]){
   const page=await browser.newPage({viewport:{width:390,height:1000}});
   const initial={project:'relay',progress:[{assignment:'card-actions',state:'working',goal:'Original canonical work'}]};
   await page.addInitScript(({initial,native})=>{
    if(parent===window)return;
    window.calls=[];window.mode='initial';
    const result=(name)=>{if(name==='relay_ui_request')return {base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lV8AAAAASUVORK5CYII=',content_type:'image/png'};
     if(window.mode==='initial')return {structuredContent:initial};
     if(window.mode==='provider-error')return {structuredContent:{ok:false,error:{message:'Exact source could not be read'}}};
     if(window.mode==='malformed')return {};
     return {structuredContent:{project:'relay',progress:[{assignment:'card-actions',state:'working',goal:'Refreshed canonical work'}]}};};
    window.actionResult=result;
    if(native)window.openai={toolInput:{project:'relay',evidence_id:'vis_abcdefgh'},toolOutput:initial,callTool:async(name,args)=>{window.calls.push({name,args});return result(name);},openExternal:async({href})=>{window.calls.push({name:'openExternal',href});},requestDisplayMode:async({mode})=>{window.calls.push({name:'display',mode});}};
   },{initial,native});
   const origin='https://relay-card-actions.test';
   await page.route(origin+'/**',route=>route.fulfill({contentType:'text/html',body:route.request().url().endsWith('/card')?relayContextCardResource().text:`<!doctype html><iframe id="widget" src="/card" style="width:100%;height:950px;border:0"></iframe><script>window.opened=[];addEventListener('message',event=>{const frame=document.querySelector('iframe'),m=event.data;if(event.source!==frame.contentWindow||m?.jsonrpc!=='2.0')return;if(m.method==='ui/initialize'){frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{project:'relay',evidence_id:'vis_abcdefgh'}}},'*');frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:${JSON.stringify(initial)}},'*');}else if(m.method==='tools/call'){frame.contentWindow.calls.push(m.params);frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result:frame.contentWindow.actionResult(m.params.name)},'*');}else if(m.method==='ui/open-link'){window.opened.push(m.params.url);frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');}});</script>`}));
   await page.goto(origin+'/host');const frame=page.frameLocator('#widget');
   await frame.locator('#title').filter({hasText:'Original canonical work'}).waitFor();
   await frame.locator('body').evaluate(()=>{window.mode='success';});
   await frame.locator('#refresh').click();await frame.locator('#title').filter({hasText:'Refreshed canonical work'}).waitFor();
   for(const mode of ['provider-error','malformed']){
    await frame.locator('body').evaluate((_,mode)=>{window.mode=mode;},mode);
    const before=await frame.locator('body').evaluate(()=>window.calls.filter(call=>call.name==='relay_runner_progress').length);
    await frame.locator('#refresh').click();await frame.locator('#refresh').filter({hasText:'Try refresh again'}).waitFor({timeout:5000});
    assert.equal(await frame.locator('#title').textContent(),'Refreshed canonical work');
    assert.equal(await frame.locator('#blocker').isVisible(),true);
    assert.equal(await frame.locator('body').evaluate(()=>window.calls.filter(call=>call.name==='relay_runner_progress').length),before+1,'a provider failure is not replayed through another host');
   }
   await frame.locator('#open-relay').click();
   if(native)assert.equal(await frame.locator('body').evaluate(()=>window.calls.find(call=>call.name==='openExternal').href),'https://relay.loew.fi/');
   else {await page.waitForFunction(()=>window.opened.length===1);assert.deepEqual(await page.evaluate(()=>window.opened),['https://relay.loew.fi/']);}
   await frame.locator('#qa-media-image').waitFor();await frame.locator('#qa-media-image').click();
   await frame.getByRole('dialog',{name:'screenshot preview'}).waitFor();
   assert.equal(await frame.locator('.screenshot-dialog img').getAttribute('src'),await frame.locator('#qa-media-image').getAttribute('src'));
   await frame.getByRole('button',{name:'Close screenshot'}).click();
   assert.equal(await frame.getByRole('dialog').count(),0);
   assert.equal(await frame.locator('#qa-media-image').evaluate(node=>document.activeElement===node),true);
   assert.equal(await frame.locator('#details').evaluate(node=>node.open),false);
   await page.close();
  }
 }finally{await browser.close();}
});

test('overall status expands projects and assignments within one mounted card', async () => {
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:1000}});
  await page.addInitScript(()=>{
   window.calls=[];
   window.openai={toolOutput:{schema:'relay-status-explorer/v1',projects:[{id:'field',name:'Field',coordination:'enabled'},{id:'arc',name:'Arc',coordination:'tracking-only'}]},widgetState:{},setWidgetState(state){this.widgetState=state;},callTool:async(name,args)=>{
    window.calls.push({name,args});
    return {structuredContent:{project:args.project,generated_at:'2026-10-04T08:00:00Z',progress:[{assignment:'field-editor',goal:'Finish the editor',state:'working',next_action:'Verify touch input'}],queue:[]}};
   }};
  });
  await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));
  await page.locator('#title').filter({hasText:'Your projects'}).waitFor();
  await page.getByRole('button',{name:/Field.*1 open/}).waitFor();
  await page.getByRole('button',{name:/Field.*1 open/}).click();
  await page.getByRole('button',{name:/Finish the editor.*In progress/}).click();
  assert.equal(await page.locator('#title').textContent(),'Finish the editor');
  assert.equal(await page.locator('#summary').textContent(),'');
  assert.match(await page.locator('#next').textContent(),/Verify touch input/);
  assert.match(await page.locator('#evidence').textContent(),/Verify touch input/);
  await page.getByRole('button',{name:'‹ Project',exact:true}).click();
  await page.getByRole('button',{name:'‹ Overall',exact:true}).click();
  await page.locator('#title').filter({hasText:'Your projects'}).waitFor();
  assert.equal(await page.locator('.status-navigation').count(),1);
  assert.deepEqual(await page.evaluate(()=>window.calls),[{name:'relay_runner_progress',args:{project:'field'}}]);
  assert.equal(await page.evaluate(()=>window.openai.widgetState.statusExplorer.level),'overview');
 } finally {await browser.close();}
});

test('widget-state globals echoes cannot replace refreshed assignment evidence', async () => {
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.addInitScript(()=>{
   const initial={schema:'relay-status-explorer/v1',project:'relay',generated_at:'2026-10-28T04:00:00Z',progress:[{assignment:'refresh-proof',goal:'Refresh proof',state:'working',next_action:'Old action',identities:{head_sha:'1111111111111111111111111111111111111111'}}],queue:[]};
   const current={...initial,generated_at:'2026-10-28T05:00:00Z',progress:[{...initial.progress[0],state:'waiting-for-human',next_action:'Current action',identities:{head_sha:'2222222222222222222222222222222222222222'}}]};
   window.calls=[];window.echoes=0;
   window.openai={toolInput:{project:'relay',assignment:'refresh-proof'},toolOutput:initial,widgetState:{},setWidgetState(state){
    if(JSON.stringify(state)===JSON.stringify(this.widgetState))return;
    this.widgetState=state;
    setTimeout(()=>{window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:JSON.parse(JSON.stringify({toolInput:this.toolInput,toolOutput:this.toolOutput,widgetState:this.widgetState}))}}));window.echoes++;},0);
   },callTool:async(name,args)=>{window.calls.push({name,args});await new Promise(resolve=>setTimeout(resolve,30));return {structuredContent:current};}};
  });
  await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));
  await page.locator('#title').filter({hasText:'Refresh proof'}).waitFor();
  await page.waitForFunction(()=>window.echoes===1);
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.waitForFunction(()=>window.echoes>=3);
  assert.equal(JSON.parse(await page.locator('#evidence').textContent()).head_sha,'2222222222222222222222222222222222222222');
  assert.equal(await page.locator('#next').textContent(),'Current action');
  assert.equal(await page.locator('#state-label').textContent(),'Ready for review');
  assert.equal(await page.evaluate(()=>window.openai.widgetState.statusExplorer.assignment),'refresh-proof');
  assert.deepEqual(await page.evaluate(()=>window.calls),[{name:'relay_runner_progress',args:{project:'relay'}}]);
  await page.evaluate(()=>{
   window.openai.toolOutput={...window.openai.toolOutput,progress:[{assignment:'refresh-proof',goal:'Refresh proof',state:'working',next_action:'New host result',identities:{head_sha:'3333333333333333333333333333333333333333'}}]};
   window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolOutput:window.openai.toolOutput}}}));
  });
  assert.equal(JSON.parse(await page.locator('#evidence').textContent()).head_sha,'3333333333333333333333333333333333333333');
  assert.equal(await page.locator('#next').textContent(),'New host result');
 } finally {await browser.close();}
});

test('human_v1 card preserves error facts and pending release steps without guessing a chat fix',async()=>{
  const {contextCardModel,compactContextCardResult}=await import('./relay-chat-ui.js');
  const data={ok:false,checked_at:'2026-10-07T10:00:00Z',error:{class:'rate_limit',message:'Bearer secret-value',retry_at:'2026-10-07T11:00:00Z',upstream:{provider:'github',private_token:'secret-value'}}};
  const compact=compactContextCardResult(data);
  assert.equal(compact.error.class,'rate_limit');assert.equal(compact.error.retry_at,data.error.retry_at);
  assert.equal(compact.error.upstream.private_token,undefined);
  const error=contextCardModel({...compact,pull_request:{merged:true,number:9}});
  assert.equal(error.human_v1.message_id,'error.rate_limit');assert.equal(error.tone,'wait');
  assert.match(error.summary,/resume after/);assert.doesNotMatch(JSON.stringify(error),/secret-value/);
  const pending=contextCardModel({pull_request:{merged:true,number:9},claim:{next_action:'Verify the deployment'},next_action:{code:'verify_release',actor:'relay',availability:'unavailable'}});
  assert.match(pending.next_step,/live checks/);
  const technical=contextCardModel({claim:{state:'working',next_action:'Check commit_sha aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa before deployment'}});
  assert.doesNotMatch(technical.next_step,/refreshed chat connection/);
  const partial=contextCardModel({partial:true,pull_request:{merged:true,number:9}});
  assert.equal(partial.human_v1.message_id,'data.partial');assert.equal(partial.tone,'wait');
});

test('human_v1 generated current and legacy bridge resources share exact server semantics',async()=>{
  const {build}=await import('esbuild');const {runInNewContext}=await import('node:vm');
  const built=await build({entryPoints:[new URL('./relay-chat-ui.js',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral',keepNames:true});
  const module=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  const cases=[
    {ok:true,manifest_complete:false,truncated:true,presentation_operation:{kind:'query',name:'relay_source_tree'}},
    {ok:true,content:'unchanged file',presentation_operation:{kind:'query',name:'relay_source_file'}},
    {ok:true,revision:36,presentation_operation:{kind:'command',name:'relay_context'}},
    {ok:true,state:'unknown-provider-state',presentation_operation:{kind:'unknown',name:'new_tool'}},
    {ok:false,error:{class:'rate_limit',retry_at:'2026-10-07T11:00:00Z'},checked_at:'2026-10-07T10:00:00Z'},
    {ok:false,presentation_operation:{kind:'command',name:'relay_execution'},error:{class:'uncertain_write'}},
    {ok:false,mutation:'not_attempted',error:{class:'conflict',reason:'coordination_admission',findings:[{type:'missing_branch',assignment:'task',branch:'relay/task'}]}},
    {partial:true,claim:{state:'working',goal:'Keep the last update'}},
    {pull_request:{merged:true,number:9},next_action:{code:'verify_release',actor:'relay',availability:'unavailable'}},
    {check_runs:[{name:'test',status:'completed',conclusion:'cancelled'}]},
    {presentation_mode:'legacy',claim:{state:'working',goal:'Rollback renderer'}},
    {human_v1:{summary:'forged success',severity:'success'},ok:false,error:{class:'permission'}}
  ];
  for(const resource of [module.relayContextCardResource(),module.relayStatusCardResource()]){
    const script=resource.text.match(/<script>([\s\S]*?)<\/script>/)[1];
    const prefix=script.slice(0,script.indexOf('const FEATURES='));
    assert.doesNotMatch(prefix,/\b__name\b/);
    for(const input of cases){
      const actual=runInNewContext(prefix+';model(input,DIRECTORY)',{input});
      assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(module.contextCardModel(input,undefined,{timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}))));
    }
  }
});

test('human_v1 removal of duplicate error text does not turn legacy health healthy',async()=>{
 const {contextualPresentation}=await import('./relay-chat-ui.js');
 const result=contextualPresentation({ok:false,error:{class:'permission'}});
 assert.equal(result.human.health,'blocked');assert.equal(result.human_v1.severity,'error');
});

test('human_v1 mobile shows the complete warning and next step without duplicate error text',async()=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 try{
  for(const error of [{class:'conflict',reason:'coordination_admission',findings:[{type:'missing_branch',assignment:'task',branch:'relay/task'}]},{class:'uncertain_write'},{class:'rate_limit',retry_at:'2026-10-07T11:00:00Z',upstream:{provider:'github'}}]){
   const page=await browser.newPage({viewport:{width:320,height:900}});
   await page.addInitScript(({error})=>{window.openai={toolInput:{project:'relay'},toolOutput:{project:'relay',ok:false,checked_at:'2026-10-07T10:00:00Z',error}};},{error});
   await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));
   await page.locator('#summary').filter({hasText:error.reason==='coordination_admission'?'coordination issue':error.class==='uncertain_write'?'whether or not':'GitHub says requests can resume'}).waitFor();
   assert.equal(await page.locator('#blocker').isVisible(),false);
   assert.equal(await page.locator('.telemetry-stat').isVisible(),false);
   assert.ok(await page.locator('#summary').evaluate(node=>node.scrollHeight<=node.clientHeight+1),'material explanation is not clamped');
   if(error.class==='uncertain_write'){
    assert.equal(await page.locator('#next').isVisible(),true);
    assert.match(await page.locator('#next').textContent(),/Check the latest status before trying again/);
   }
   if(error.reason==='coordination_admission'){
    assert.equal(await page.locator('#next').isVisible(),true);
    assert.match(await page.locator('#next').textContent(),/blocking findings/);
    await page.locator('#details summary').click();
    assert.match(await page.locator('#details').textContent(),/missing_branch|relay\/task/);
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.close();
  }
 }finally{await browser.close();}
});

// Resource versions change with generated copy; existing client identities remain readable.
test('neutral fallback cache rotation preserves the preceding current and legacy resource aliases',async()=>{
 const {readFile}=await import('node:fs/promises');const source=await readFile(new URL('./index.js',import.meta.url),'utf8');
 assert.ok(source.includes("uri === 'ui://relay/context-card/v16.html'"));
 assert.ok(source.includes("uri === 'ui://relay/status-card/v4-legacy-bridge.html'"));
 assert.notEqual(RELAY_CONTEXT_CARD_URI,'ui://relay/context-card/v16.html');
 assert.notEqual(RELAY_STATUS_CARD_URI,'ui://relay/status-card/v4-legacy-bridge.html');
});

// Normal-work delivery: a host that honors the descriptor's template mounts the card for an
// ordinary command result, and the same card refreshes itself instead of a new one per step.
async function mountWorkCard({toolName,args,result,answers}) {
  const {chromium}=await import('playwright');
  const {contextualPresentation}=await import('./relay-chat-ui.js');
  const descriptor=contextualizeRelayTool({name:toolName,inputSchema:{type:'object'}});
  assert.equal(descriptor._meta.ui.resourceUri,RELAY_CONTEXT_CARD_URI);
  const present=(name,data)=>contextualPresentation(data,{operation:{name,kind:'command'}});
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  await page.clock.install();
  const calls=[];
  await page.exposeFunction('answerTool',(name,toolArgs)=>{calls.push({name,args:toolArgs});const next=answers.shift();return next?present(name,next):{ok:false,error:{message:'no more answers'}};});
  const widgetUrl='data:text/html,'+encodeURIComponent(relayContextCardResource().text);
  await page.setContent(`<!doctype html><script>
    window.addEventListener('message',async event=>{
      const frame=document.getElementById('widget');const message=event.data;
      if(event.source!==frame?.contentWindow||message?.jsonrpc!=='2.0')return;
      if(message.method==='ui/initialize')frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2026-01-26'}},'*');
      else if(message.method==='ui/notifications/initialized'){
        frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:${JSON.stringify(args)}}},'*');
        frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:${JSON.stringify(present(toolName,result))}}},'*');
      } else if(message.method==='tools/call'){
        const data=await window.answerTool(message.params.name,message.params.arguments);
        frame.contentWindow.postMessage({jsonrpc:'2.0',id:message.id,result:{structuredContent:data}},'*');
      }
    });
  <\/script><iframe id="widget" src="${widgetUrl}"></iframe>`);
  return {browser,page,frame:page.frameLocator('#widget'),calls};
}

test('an ordinary claim mounts a staff-attributed work card that follows the same assignment to completion', async () => {
  const claim={id:'relay-live-work-cards-staff-ci-20261023',owner:'claude-code-session_x',state:'active',goal:'Repair normal-work cards',next_action:'Implement milestone delivery',primary_staff:'rafael',supporting_staff:['roman'],primary_team:'source',primary_role:'integrator',updated_at:'2026-10-23T05:16:52.405Z'};
  const done={ok:true,project:'relay',progress:[{...claim,assignment:claim.id,state:'completed'}]};
  const {browser,page,frame,calls}=await mountWorkCard({toolName:'relay_runner_coordinate',args:{project:'relay',action:'claim'},result:{ok:true,project:'relay',action:'claim',claim},answers:[{ok:true,project:'relay',progress:[{...claim,assignment:claim.id}]},{ok:true,project:'relay',progress:[{...claim,assignment:claim.id,state:'held',waiting_reason:'Waiting for a CI rerun'}]},done]});
  try {
    await frame.locator('#title').filter({hasText:'Repair normal-work cards'}).waitFor();
    // Mount-time recovery reads canonical progress once; the tool result still drives the card.
    await page.waitForFunction(()=>true);
    assert.equal(await frame.locator('#rows').textContent(),'');
    assert.match(await frame.locator('#team').textContent(),/Assignment lead/);
    assert.equal(await frame.locator('#staff').isHidden(),false);
    assert.equal(await frame.locator('#rows').textContent(),'');
    await page.clock.runFor(31000);
    await frame.locator('#state-label').filter({hasText:/hold/i}).waitFor();
    await page.clock.runFor(31000);
    await frame.locator('#state-label').filter({hasText:/complete/i}).waitFor();
    // The card keeps the step it was mounted for after the live state moves on.
    assert.equal(await frame.locator('#rows').textContent(),'');
    assert.match(await frame.locator('#team').textContent(),/Assignment lead/);
    await page.clock.runFor(120000);
    assert.deepEqual(calls.map(call=>call.args),[{project:'relay'},{project:'relay',assignment:claim.id},{project:'relay',assignment:claim.id}]);
    assert.ok(calls.every(call=>call.name==='relay_runner_progress'));
  } finally {await browser.close()}
});

test('a CI read mounts a live card with real test counts and stops once the run finishes', async () => {
  const {buildTelemetryPayload,renderCheckRunOutput}=await import('./ci-test-telemetry.js');
  const sha='b'.repeat(40);
  const checks=(state,suites,job)=>({check_runs:[{name:'quality',head_sha:sha,started_at:'2026-10-23T05:00:00Z',html_url:'https://github.com/lrnolivia/relay/actions/runs/77/job/5',...job},{name:'relay-tests / quality',status:'in_progress',head_sha:sha,output:renderCheckRunOutput(buildTelemetryPayload({run:{id:'77',attempt:1,job:'quality',url:'https://github.com/lrnolivia/relay/actions/runs/77/attempts/1'},head_sha:sha,state,suites,now:Date.parse('2026-10-23T05:01:00Z')}))}]});
  const running=checks('running',[{id:'inspector',status:'passed',counts:{passed:300,skipped:4},total:304},{id:'runner',status:'running',counts:{passed:12,failed:1},failures:[{name:'lease renews',message:'expected 2'}]}],{status:'in_progress'});
  const finished=checks('completed',[{id:'inspector',status:'passed',counts:{passed:300,skipped:4},total:304},{id:'runner',status:'failed',counts:{passed:40,failed:1},total:41,failures:[{name:'lease renews',message:'expected 2'}]}],{status:'completed',conclusion:'failure',completed_at:'2026-10-23T05:04:00Z'});
  const {browser,page,frame,calls}=await mountWorkCard({toolName:'relay_source_checks',args:{repo:'relay',ref:sha},result:{ok:true,checks:running},answers:[{ok:true,checks:finished}]});
  try {
    await frame.locator('#title').filter({hasText:'Checking the build'}).waitFor();
    assert.equal(await frame.locator('[data-state=passed] dd').textContent(),'312');
    assert.equal(await frame.locator('[data-state=failed] dd').textContent(),'1');
    assert.equal(await frame.locator('[data-state=skipped] dd').textContent(),'4');
    assert.match(await frame.locator('#telemetry-note').textContent(),/Total test count is not yet known/);
    assert.match(await frame.locator('#ci-failure-details').textContent(),/lease renews[\s\S]*expected 2/);
    assert.equal(await frame.locator('#metric-label').textContent(),'of 2 suites finished');
    await page.clock.runFor(16000);
    await frame.locator('#state-label').filter({hasText:'Failed'}).waitFor();
    await page.clock.runFor(700);
    assert.equal(await frame.locator('#metric').textContent(),'2');
    assert.equal(await frame.locator('[data-state=passed] dd').textContent(),'340');
    assert.match(await frame.locator('#blocker').textContent(),/1 test failed/);
    assert.ok(await frame.getByText('Open CI run ›').isVisible());
    await page.clock.runFor(120000);
    assert.deepEqual(calls,[{name:'relay_source_checks',args:{repo:'relay',ref:sha}}]);
  } finally {await browser.close()}
});


test('intrinsic sizing ignores the host viewport and reports shrinking content and width-only changes', async () => {
  const { runInNewContext } = await import('node:vm');
  // Execute the actual emitted sizing function, not a second implementation.
  const html = relayContextCardResource().text;
  const sizing = html.match(/function reportSize\(\)\{[\s\S]*?\}\}if\(typeof ResizeObserver/)[0]
    .replace(/if\(typeof ResizeObserver$/, '');
  let bounds = { bottom: 220.2, width: 640 };
  const sizes = [], intrinsic = [];
  const card = { getBoundingClientRect: () => bounds };
  const context = {
    Math, diag: { h: 0, w: 0 }, showDiag() {},
    document: { documentElement: { scrollHeight: 1600, scrollWidth: 640 }, getElementById: () => card },
    window: { scrollY: 0, parent: { postMessage: message => sizes.push(message.params) },
      openai: { notifyIntrinsicHeight: height => intrinsic.push(height) } }
  };
  runInNewContext(sizing + ';globalThis.measure=reportSize', context);
  for (const [bottom,width] of [[220.2,640],[810.1,640],[220.2,640],[810.1,640],[220.2,640],[220.2,320],[140,320]]) {
    bounds = {bottom,width}; context.measure();
  }
  assert.deepEqual(sizes.map(size => size.height), [221,811,221,811,221,221,140]);
  assert.deepEqual(sizes.map(size => size.width), [640,640,640,640,640,320,320]);
  assert.deepEqual(intrinsic, [221,811,221,811,221,221,140]);
  context.measure();
  assert.equal(sizes.length, 7, 'unchanged bounds do not cause resize feedback');
  assert.match(html, /new ResizeObserver\(reportSize\)\.observe\(document.getElementById\('card'\)\)/);
});

test('mounted card shrinks an oversized iframe and follows repeated evidence toggles', async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    const widgetUrl = 'data:text/html,' + encodeURIComponent(relayContextCardResource().text);
    await page.setContent(`<!doctype html><script>
      window.sizes=[];
      addEventListener('message',event=>{
        const frame=document.getElementById('widget'),m=event.data;
        if(event.source!==frame?.contentWindow||m?.jsonrpc!=='2.0')return;
        if(m.method==='ui/notifications/size-changed'){
          window.sizes.push(m.params);
          frame.style.height=m.params.height+'px';
        }
        if(m.method==='ui/initialize')frame.contentWindow.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');
        if(m.method==='ui/notifications/initialized')frame.contentWindow.postMessage({
          jsonrpc:'2.0',method:'ui/notifications/tool-result',
          params:{structuredContent:{project:'relay',claim:{primary_staff:'julian',goal:'Content sized card',state:'active'}}}
        },'*');
      });
    <\/script><iframe id="widget" style="width:640px;height:1600px;border:0" src="${widgetUrl}"></iframe>`);
    const frame = page.frameLocator('#widget');
    await frame.locator('#title').filter({hasText:'Content sized card'}).waitFor();
    await page.waitForFunction(()=>window.sizes.at(-1)?.height<1000);
    const assertFits = async () => {
      const deadline=Date.now()+5000;
      let height,reported,iframeHeight,confirmedHeight;
      do {
        height=await frame.locator('#card').evaluate(node=>Math.ceil(node.getBoundingClientRect().bottom+window.scrollY));
        ({reported,iframeHeight}=await page.evaluate(()=>({
          reported:window.sizes.at(-1)?.height,
          iframeHeight:parseFloat(document.getElementById('widget').style.height)
        })));
        confirmedHeight=await frame.locator('#card').evaluate(node=>Math.ceil(node.getBoundingClientRect().bottom+window.scrollY));
        if(height===confirmedHeight&&Math.abs(reported-height)<=1&&iframeHeight===reported)break;
        await page.waitForTimeout(25);
      } while(Date.now()<deadline);
      assert.equal(height,confirmedHeight,'card geometry settled while sampled');
      assert.ok(Math.abs(reported-height)<=1, 'reported height fits visible content');
      assert.equal(iframeHeight,reported,'host applied the matching content height');
      return height;
    };
    await frame.locator('#card').evaluate(async () => { await document.fonts.ready; await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); });
    const collapsed=await assertFits();
    for(let cycle=0;cycle<3;cycle++){
      await frame.locator('#details > summary').click();
      await page.waitForFunction(h=>window.sizes.at(-1)?.height>h,collapsed);
      const expanded=await assertFits();
      assert.ok(expanded>collapsed);
      await frame.locator('#details > summary').click();
      await page.waitForFunction(h=>window.sizes.at(-1)?.height===h,collapsed);
      assert.equal(await assertFits(),collapsed);
    }
    await page.locator('#widget').evaluate(node=>node.style.width='320px');
    await page.waitForFunction(()=>window.sizes.at(-1)?.width===320);
    const narrowCollapsed=await assertFits();
    const sendResult=async claim=>page.evaluate(claim=>{
      document.getElementById('widget').contentWindow.postMessage({
        jsonrpc:'2.0',method:'ui/notifications/tool-result',
        params:{structuredContent:{project:'relay',claim}}
      },'*');
    },claim);
    const waitingReason='Waiting for the requested verification result before continuing. '.repeat(18);
    await sendResult({primary_staff:'julian',goal:'Long result card',state:'blocked',waiting_reason:waitingReason});
    await frame.locator('#title').filter({hasText:'Long result card'}).waitFor();
    await frame.locator('#blocker-full > summary').click();
    await frame.locator('#blocker-full p').filter({hasText:'Waiting for the requested verification result'}).waitFor();
    assert.equal(await frame.locator('#blocker-full p').textContent(),waitingReason.trim());
    await page.waitForFunction(h=>window.sizes.at(-1)?.height>h,narrowCollapsed);
    const longHeight=await assertFits();
    assert.ok(longHeight>narrowCollapsed,'long tool result grows the mounted card');
    await sendResult({primary_staff:'julian',goal:'Content sized card',state:'active'});
    await frame.locator('#title').filter({hasText:'Content sized card'}).waitFor();
    await page.waitForFunction(h=>window.sizes.at(-1)?.height===h,narrowCollapsed);
    assert.equal(await assertFits(),narrowCollapsed,'shorter tool result shrinks back without reopening evidence');
  } finally { await browser.close(); }
});

test('ordinary failed/no-plan outcomes retain the real cause and next step without redundant telemetry',async()=>{
 const {contextCardModel}=await import('./relay-chat-ui.js');
 const next='Finish native visual confirmation and protocol regression tests; wire new tests and native panel fixtures into exact-source CI, publish a draft PR, and retain explicit gameplay acceptance limits.';
 const row={assignment:'rtxforge-overlay-workbench',owner:'worker',state:'failed',goal:'rtxforge overlay workbench',primary_staff:'nico',primary_team:'runner',waiting_reason:'Publish Windows Beta failed',next_action:next};
 const m=contextCardModel({project:'rtxforge',progress:[row],work_card:{milestone:{kind:'step',label:'Step recorded'}}});
 assert.equal(m.has_metric,false);assert.equal(m.metric,null);assert.deepEqual(m.rows,[]);assert.deepEqual(m.plan.steps,[]);assert.equal(m.identity.speaker.id,'nico');assert.equal(m.identity.relationship,'Assignment lead');assert.equal(m.identity.current_owner,null);assert.equal(m.identity.lead.id,'nico');
 assert.equal(m.blocker,'Publish Windows Beta failed');assert.equal(m.evidence.next_action,next);assert.equal(m.next_step,'Read the next step below.');
 for(const state of ['active','queued','possibly-stale','unknown','blocked','completed','cancelled','superseded']){const card=contextCardModel({project:'rtxforge',claim:{...row,state}});assert.equal(card.has_metric,false);assert.equal(card.evidence.next_action,next);if(['completed','cancelled','superseded'].includes(state))assert.equal(card.next_step,null);}
});
