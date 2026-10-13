import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { webBuildId } from "./generated.js";
import { readback } from "./readback.mjs";
import { productionMcpRead } from './production-mcp-readback.mjs';
import { verifyFileLifecycle } from './verify-file-lifecycle.mjs';

const expected = process.env.EXPECTED_SOURCE_SHA;
const clientId = process.env.CF_ACCESS_CLIENT_ID;
const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
const diagnoseOnly = process.env.DIAGNOSE_ONLY === "true";
if (!expected || !clientId || !clientSecret) throw new Error("Production website verification environment is incomplete");
const origin = "https://relay.loew.fi";
const headers = {
  Authorization: JSON.stringify({ "cf-access-client-id": clientId, "cf-access-client-secret": clientSecret }),
  "CF-Access-Client-Id": clientId, "CF-Access-Client-Secret": clientSecret
};
await mkdir("qa-evidence/production", { recursive: true });
const api = [];
for (const path of ["/api/projects", "/api/workers"]) {
  const {response,value:body} = await readback(origin + path, { headers });
  api.push({ path, status: response.status, error: body?.error || null, shape: Array.isArray(body) ? "array" : Object.keys(body || {}) });
}
await writeFile("qa-evidence/production/api.json", JSON.stringify(api, null, 2));
console.log("WEBSITE_API=" + JSON.stringify(api));
let ready = false;
for (let attempt = 0; attempt < 12; attempt++) {
  const {response} = await readback(origin + "/", { headers, parse:'text' }, {timeout:15000});
  assert.ok(![401,403].includes(response.status), 'production identity must be authorized before verification');
  if (response.ok && (diagnoseOnly || (response.headers.get("X-Relay-Source-Sha") === expected && response.headers.get("X-Relay-Web-Build") === webBuildId))) { ready = true; break; }
  await new Promise(resolve => setTimeout(resolve, 10000));
}
assert.ok(ready, "production must serve this exact source SHA and built website artifact");
if(!diagnoseOnly){
 // Exercise the explicit authenticated read tool using only this public repository.
 // Private project paths/content must never enter public CI artifacts.
 const mcpRead=(method,params)=>productionMcpRead(method,params,{headers,commitSha:expected});
 const discovered=await mcpRead('tools/list',{}),tool=discovered.tools?.find(tool=>tool.name==='relay_source_tree');
 assert.ok(tool,'source manifest capability must be discoverable');assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.annotations.destructiveHint,false);
 assert.deepEqual(tool.inputSchema.required,['repo','commit_sha']);assert.equal(tool.inputSchema.additionalProperties,false);
 const entries=[],cursors=new Set();let cursor,first,pages=0;
 do{
  assert.ok(pages++<40,'manifest pagination must be bounded');
  const result=await mcpRead('tools/call',{name:'relay_source_tree',arguments:{repo:'relay',commit_sha:expected,limit:500,...(cursor?{cursor}:{})}});
  assert.notEqual(result.isError,true);const page=result.structuredContent;assert.equal(page.ok,true);assert.equal(page.repository,'lrnolivia/relay');assert.equal(page.commit_sha,expected);
  assert.equal(page.manifest_complete,true);assert.equal(page.truncated,false);assert.equal(page.page_offset,entries.length);assert.equal(page.returned_entry_count,page.entries.length);
  first ||= page;assert.equal(page.tree_sha,first.tree_sha);assert.equal(page.manifest_sha256,first.manifest_sha256);assert.equal(page.observed_entry_count,first.observed_entry_count);
  for(const row of page.entries){assert.deepEqual(Object.keys(row),['path','mode','type','sha']);assert.match(row.sha,/^[a-f0-9]{40}$/);}
  entries.push(...page.entries);cursor=page.next_cursor;
  if(cursor){assert.equal(typeof cursor,'string');assert.ok(!cursors.has(cursor),'cursor must advance');cursors.add(cursor);}
 }while(cursor);
 assert.equal(entries.length,first.observed_entry_count);assert.equal(new Set(entries.map(row=>row.path)).size,entries.length);
 assert.equal(createHash('sha256').update(JSON.stringify(entries)).digest('hex'),first.manifest_sha256);
 for(const path of ['AGENTS.md','src/index.js','src/source.js','package.json'])assert.ok(entries.some(entry=>entry.path===path&&entry.mode==='100644'),'manifest includes '+path);
 const proof={ok:true,kind:'authenticated-source-tree-manifest',repository:'lrnolivia/relay',commit_sha:expected,tree_sha:first.tree_sha,manifest_sha256:first.manifest_sha256,entry_count:entries.length,pages,manifest_complete:true,content_included:false,source_bytes_restored:false};
 await writeFile('qa-evidence/production/source-tree.json',JSON.stringify(proof,null,2));console.log('SOURCE_TREE_PROOF='+JSON.stringify(proof));
}
if(!diagnoseOnly){
 const runIdentity=[expected,process.env.GITHUB_RUN_ID||Date.now(),process.env.GITHUB_RUN_ATTEMPT||'1'].join('-');
 try{
  const files=await verifyFileLifecycle((path,options)=>fetch(origin+path,{...options,headers:{...headers,...options.headers}}),{requestId:'verify-'+createHash('sha256').update(runIdentity).digest('hex'),unauthenticatedFetcher:(path,options)=>fetch(origin+path,options)});
  await writeFile('qa-evidence/production/files.json',JSON.stringify({...files,source_sha:expected},null,2));
 }catch(error){await writeFile('qa-evidence/production/files.json',JSON.stringify({...error.receipt,source_sha:expected},null,2));throw error;}
}
// Exercise an existing capture before adding new evidence so legacy lookup is
// verified independently of the new direct index.
const {response:previousResponse,value:previousPayload}=await readback(origin+"/api/visual?limit=1",{headers});
assert.ok(previousResponse.ok,"existing evidence list must be readable");
const previousId=previousPayload.evidence?.[0]?.evidence_id;
if(previousId) console.log("EXISTING_EVIDENCE_READBACK="+JSON.stringify(await verifyEvidenceReadback(previousId)));
const browser = await chromium.launch({ headless: true });
const captures = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, colorScheme: "dark", reducedMotion: "reduce" });
    await page.route(origin + "/**", route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    if (diagnoseOnly) {
      await page.goto(origin + "/#/today");
      await page.waitForTimeout(12000);
      const requests = await page.evaluate(async () => Promise.all(["/api/projects", "/api/workers"].map(async path => {
        const response = await fetch(path);
        const body = await response.json().catch(() => null);
        return { path, status: response.status, error: body?.error || null, shape: Array.isArray(body) ? "array" : Object.keys(body || {}) };
      })));
      const diagnostic = { requests, connection: await page.locator(".operator-connection").innerText(), errors };
      await writeFile(`qa-evidence/production/diagnostic-${viewport.width}.json`, JSON.stringify(diagnostic, null, 2));
      await page.screenshot({ path: `qa-evidence/production/diagnostic-${viewport.width}.png`, fullPage: true });
      console.log("WEBSITE_BROWSER=" + JSON.stringify(diagnostic));
      await page.close();
      continue;
    }
    await page.goto(origin + '/');
    await page.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();
    await page.locator('.telemetry-card').first().waitFor();
    await page.waitForFunction(()=>document.querySelector('.live-telemetry')?.getAttribute('data-loading')==='false',null,{timeout:75000});
    assert.equal(await page.locator('.telemetry-card').count(),4);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('.relay-home').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(25, 23, 20)');
    await page.getByRole('button',{name:'Check connection',exact:true}).click();
    await page.getByText('MCP connected',{exact:true}).waitFor();
    await page.getByRole('button',{name:'refresh tools',exact:true}).click();
    await page.getByText(/Your AI client’s loaded schema is not verified/).waitFor();
    await page.getByLabel('Refresh tools result').getByRole('button',{name:'Close',exact:true}).click();
    const destinations=await page.locator('.live-telemetry a,.relay-current-work').evaluateAll(nodes=>nodes.map(node=>node.href));
    assert.ok(destinations.every(href=>new URL(href).origin==='https://ctrl.loew.fi'),'workspace links resolve to ctrl');
    for(const route of ['/runner','/today','/night-shift','/inspector']) {
      const response=await fetch(origin+route,{headers,redirect:'manual'});
      assert.equal(response.status,308);assert.equal(new URL(response.headers.get('Location')).origin,'https://ctrl.loew.fi');
    }
    await capture(page,'relay',viewport);
    await page.getByRole('button',{name:'Open files',exact:true}).click();
    const filesDialog=page.getByRole('dialog',{name:'Files',exact:true});await filesDialog.waitFor();
    await filesDialog.getByText('Private to your signed-in account. Files expire after 3 days.',{exact:true}).waitFor();
    assert.equal(await filesDialog.locator('.work-control-pair').evaluate(pair=>pair.getBoundingClientRect().top-pair.previousElementSibling.getBoundingClientRect().bottom),8);
    assert.equal(await filesDialog.evaluate(node=>node.scrollWidth>node.clientWidth+1),false);
    await capture(page,'files',viewport);
    await filesDialog.getByRole('button',{name:'Close files',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Open files',exact:true}).evaluate(node=>node===document.activeElement),true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile("qa-evidence/production/result.json", JSON.stringify({ ok: !diagnoseOnly, diagnostic: diagnoseOnly, source_sha: expected, web_build: webBuildId, captures }, null, 2));
  console.log(JSON.stringify({ ok: !diagnoseOnly, diagnostic: diagnoseOnly, source_sha: expected, web_build: webBuildId, captures }));
} finally { await browser.close(); }

async function capture(page, feature, viewport) {
  const surface = `${feature}-${viewport.width}`;
  const canonicalUrl = new URL(page.url());
  canonicalUrl.hash = "";
  const screenshot = await page.screenshot({ fullPage: true });
  await writeFile(`qa-evidence/production/${surface}.png`, screenshot);
  const metadata = {
    kind: "production_website_verification", target_url: canonicalUrl.toString(),
    context: { project: "relay", environment: "production", surface, commit_sha: expected },
    engine: "github-chromium", step_label: `Actual website ${surface}`, viewport,
    dom: { summary: await page.locator('.telemetry-card').allTextContents(), connection: await page.locator('.telemetry-freshness').innerText(), notice: await page.locator('[data-progress-notice]').allTextContents(), review_state: await page.evaluate(() => document.querySelector('#review-list')?.dataset.summaryState || null) },
    trace: [{ action: "verify_actual_website", url: page.url(), initial_data_cycle: "settled success or explicitly labelled partial/error" }]
  };
  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  form.set("screenshot", new Blob([screenshot], { type: "image/png" }), surface + ".png");
  const response = await fetch(origin + "/evidence/ingest", { method: "POST", headers, body: form, signal: AbortSignal.timeout(30000) });
  assert.ok(response.ok, "production screenshot evidence must persist in Inspector: " + response.status);
  const evidence = await response.json();
  const readback=await verifyEvidenceReadback(evidence.evidence_id,screenshot);
  captures.push({ surface, url: page.url(), evidence_id: evidence.evidence_id, state: metadata.dom, readback });
}

async function verifyEvidenceReadback(id,expectedBytes) {
  const path=origin+"/api/visual/"+encodeURIComponent(id);
  const {response:qa}=await readback(path+"/qa",{headers});
  assert.ok(qa.ok,"saved evidence QA must resolve: "+id+" "+qa.status);
  const {response:image,value:bytes}=await readback(path+"/image",{headers,parse:'bytes'});
  assert.ok(image.ok,"saved evidence image must resolve: "+id+" "+image.status);
  assert.ok(bytes.length,"stored capture is nonempty");
  const hash=createHash("sha256").update(bytes).digest("hex");
  if(expectedBytes)assert.equal(hash,createHash("sha256").update(expectedBytes).digest("hex"),"stored capture matches exact emitted bytes");
  return {evidence_id:id,qa_status:qa.status,image_status:image.status,bytes:bytes.length,sha256:hash};
}
