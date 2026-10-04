import test from "node:test";
import assert from "node:assert/strict";
import { RELAY_CONTEXT_CARD_URI, RELAY_CONTEXT_CARD_TOOL, RELAY_STATUS_CARD_URI, RELAY_STATUS_CARD_TOOL, relayContextCardDescriptor, relayContextCardResource, relayContextCardTool, relayStatusCardDescriptor, relayStatusCardResource, relayStatusCardTool, validateRelayContextCardArguments, contextualizeRelayTool, isContextualRelayTool } from "./relay-chat-ui.js";

test("Relay publishes one versioned compact MCP card resource", () => {
  const descriptor = relayContextCardDescriptor();
  const resource = relayContextCardResource();
  assert.equal(RELAY_CONTEXT_CARD_URI, "ui://relay/context-card/v14.html");
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
  assert.equal(RELAY_STATUS_CARD_URI, "ui://relay/status-card/v3-legacy-bridge.html");
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
  assert.doesNotMatch(resource.text, /ui:\/\/relay\/control-center\/v1\.html/);
});

test('only the dedicated render tool owns the compact resource', () => {
  for(const name of ['relay_runner_coordinate','relay_runner_resume','relay_runner_updates','relay_runner_progress']) {
    const tool={name};
    assert.equal(contextualizeRelayTool(tool),tool);
    assert.equal(isContextualRelayTool(name),true);
  }
  const renderer=contextualizeRelayTool(relayContextCardTool());
  assert.equal(renderer._meta.ui.resourceUri,RELAY_CONTEXT_CARD_URI);
  assert.doesNotMatch(renderer._meta.ui.resourceUri,/control-center/);
});
test('cards show named teams blockers handoffs QA and subordinate exact evidence', async () => {
  const {contextCardModel}=await import('./relay-chat-ui.js');
  const m=contextCardModel({project:'relay',action:'handoff',claim:{id:'exact-task',owner:'next-owner',primary_staff:'julian',supporting_staff:['roman'],state:'blocked',goal:'Connect the release',next_action:'Fix the failing gate',waiting_reason:'Client still has old schema',branch:'relay/exact'},qa:{intended_result:'New card renders',checks:['Card is compact']}});
  assert.equal(m.team,'Julian with Roman');assert.equal(m.blocker,'Client still has old schema');assert.match(m.handoff,/next-owner/);assert.equal(m.evidence.owner,'next-owner');assert.equal(m.qa.checks[0],'Card is compact');
  assert.equal(contextCardModel({ok:false,error:{message:'Authorization required'}}).label,'Blocked');
  assert.equal(contextCardModel({check_runs:[]}).label,'No checks recorded');
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
    assert.equal(await frame.locator('#team').textContent(),'Julian');
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


test('feature identity drives the giant-notification header and pertinent metric', async () => {
  const {contextCardModel}=await import('./relay-chat-ui.js');
  const runner=contextCardModel({
    project:'relay',
    claim:{primary_team:'runner',primary_staff:'nico',state:'working',goal:'Build the card',progress_percent:50}
  });
  assert.equal(runner.feature,'runner');
  assert.equal(runner.metric,'50%');
  assert.equal(runner.metric_label,'completion');
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
  assert.deepEqual(model.rows.map(x=>x.label),['relay card polish','relay skills completion']);
  assert.equal(model.metric,'7'); assert.equal(model.metric_label,'active jobs');
  assert.ok(model.title.length<=72); assert.ok(model.summary.length<=150);
  assert.equal(model.next_step,null); assert.equal(model.evidence.goal,detail);
  assert.equal(model.primary_staff,'Ellis');
});

test("job-focused card never turns a missing completion value into zero percent", async () => {
  const {contextCardModel}=await import('./relay-chat-ui.js');
  for(const value of [null,undefined,'']) {
    const model=contextCardModel({claims:[{id:'check-preview',state:'active',progress_percent:value}]});
    assert.equal(model.percent,null); assert.equal(model.metric,'1');
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
