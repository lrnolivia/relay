import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { relayContextCardResource, relayStatusCardResource, contextCardModel } from './relay-chat-ui.js';
import { styleContextCard } from './relay-context-card-style.js';
import { contextCardBrandAssets } from '../apps/web/generated.js';

test('versioned legacy bridge preserves the byte-exact host and style shell', () => {
  // The v4 presentation program intentionally changes. Its generated model has
  // separate server/browser parity tests; all surrounding v3 host/style bytes
  // remain bound to the independently verified pre-migration shell hash.
  const shell=relayStatusCardResource().text.replace(/const DIRECTORY=[\s\S]*?(?=const FEATURES=)/,'');
  assert.equal(createHash('sha256').update(shell).digest('hex'), '7f4696e724d991398f6def4dc5b34006f580c59415aec3b478643fec9b37d40c');
  assert.doesNotMatch(relayStatusCardResource().text, /data-context-card-parity|CARD_BRAND_ASSETS/);
});
test('context card embeds canonical artwork and Momo without external fonts', () => {
  const html = relayContextCardResource().text;
  assert.ok(html.includes(contextCardBrandAssets.relay));
  assert.match(html, /data:font\/woff;base64,/);
  assert.match(html, /SIL OPEN FONT LICENSE Version 1.1/);
  assert.match(html, /font-family:"Momo Trust Display"/);
  assert.match(html, /id="feature-kicker"[^>]*hidden aria-hidden="true"/);
  assert.ok(html.indexOf('id="diag"') > html.indexOf('<details id="details"'));
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.ok(Buffer.byteLength(html) < 512 * 1024, 'self-contained card remains bounded');
  assert.equal(html.split(contextCardBrandAssets.relay).length-1,1,'canonical initial icon bytes are embedded once');
  assert.match(html,/CARD_BRAND_ASSETS=\{"relay":document\.querySelector\("#feature-mark img"\)\.getAttribute\("src"\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /visibilitychange/);
});
test('Momo loads from bundled bytes when a host cannot load CSS font URLs', async () => {
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 try {
  const widths=[];
  for(const restrictFontUrls of [false,true]){
   const page=await browser.newPage();const requests=[];page.on('request',request=>requests.push(request.url()));
   await page.route('https://relay-font.test/card',route=>route.fulfill({contentType:'text/html',headers:restrictFontUrls?{'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'self'"}:{},body:relayContextCardResource().text}));
   await page.goto('https://relay-font.test/card');
   await page.waitForFunction(()=>['loaded-css','loaded-buffer'].includes(document.documentElement.dataset.momoFont),null,{timeout:3000});
   const result=await page.evaluate(()=>{
    const family=document.documentElement.dataset.momoFont==='loaded-buffer'?'Momo Trust Display Embedded':'Momo Trust Display';
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font='400 32px "'+family+'"';
    return {mode:document.documentElement.dataset.momoFont,loaded:document.fonts.check('400 32px "'+family+'"'),family:getComputedStyle(document.querySelector('h1')).fontFamily,width:context.measureText('relay 123').width};
   });
   assert.equal(result.mode,restrictFontUrls?'loaded-buffer':'loaded-css');
   assert.equal(result.loaded,true);
   assert.match(result.family,new RegExp(restrictFontUrls?'Momo Trust Display Embedded':'Momo Trust Display'));
   assert.deepEqual(requests,['https://relay-font.test/card'],'font fallback makes no network request');
   widths.push(result.width);await page.close();
  }
  assert.equal(widths[0],widths[1],'fallback uses the same font metrics as the canonical embedded font');
 } finally {await browser.close();}
});

test('no reported percentage is represented as unknown, never invented zero', () => {
  for (const value of [undefined,null,'',' ',false,true,{},'unknown',-1,101,Infinity]) {
    const model = contextCardModel({project:'relay', progress_percent:value});
    assert.equal(model.percent,null,JSON.stringify(value));
    assert.notEqual(model.metric,'0%');
  }
  assert.equal(contextCardModel({project:'relay',progress_percent:0}).percent,null);
  assert.equal(contextCardModel({project:'relay',progress_percent:'42'}).percent,null);
});
test('asset omissions fail the build instead of shipping broken brand images', () => {
  assert.throws(() => styleContextCard('',{}), /Missing bundled card brand/);
  assert.throws(() => styleContextCard('',{...contextCardBrandAssets,relay:'https://untrusted.example/icon.png'}), /Missing bundled card brand/);
});

test('material explanations and actionable next steps remain visible without duplicated status metrics',()=>{
  const html=relayContextCardResource().text;
  assert.match(html,/\.summary\{display:block!important;-webkit-line-clamp:unset!important/);
  assert.match(html,/longCardCopy\('next','Read the full next step'/);
  assert.match(html,/stat\.hidden=m\.has_metric===false/);
  const failure=contextCardModel({ok:false,error:{class:'uncertain_write'}});
  assert.equal(failure.blocker,null);assert.equal(failure.has_metric,false);
  assert.match(failure.summary,/whether or not/);assert.match(failure.next_step,/status before/);
  const assigned=contextCardModel({claim:{state:'active'}});
  assert.equal(assigned.has_metric,false);
  assert.equal(contextCardModel({claims:[{state:'active'}]}).has_metric,true);
});

test('staff cards preserve step evidence, keyboard focus and routing distinctions through refresh and handoff',async()=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 const receipt=(id,staff,team)=>({id:'receipt-'+id,assignment:'cards',step_id:id,plan_revision:'r1',observed_at:'2026-10-30T00:00:00Z',evidence:'Synthetic receipt '+id,owner:{staff,team}});
 const card={project:'relay',claim:{id:'cards',primary_staff:'nico',primary_team:'runner',state:'active',goal:'Shared cards',card_steps:{schema:'relay-card-steps/v1',assignment:'cards',revision:'r1',complete:true,steps:[{id:'build',label:'Build cards',state:'passed',depends_on:[],receipt:receipt('build','nico','runner')},{id:'verify',label:'Verify cards',state:'running',depends_on:['build'],receipt:receipt('verify','rafael','inspector')}]}}};
 try{
  const page=await browser.newPage({viewport:{width:360,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(data=>{window.openai={toolInput:{project:'relay'},toolOutput:data}},card);
  await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));
  await page.locator('#feature-title').filter({hasText:'Rafael'}).waitFor();
  assert.match(await page.locator('#team').textContent(),/Current step owner/);
  assert.match(await page.locator('#card-roles').textContent(),/Assignment lead: Nico/);
  assert.equal(await page.locator('#feature-mark').getAttribute('data-staff'),'rafael');
  const details=page.locator('[data-step=build] details');await details.locator('summary').focus();await page.keyboard.press('Enter');
  await page.evaluate(data=>render(data),card);
  assert.equal(await details.getAttribute('open'),'');
  assert.equal(await page.evaluate(()=>document.activeElement.closest('[data-step]')?.dataset.step),'build');
  const changed=structuredClone(card);changed.claim.primary_staff='julian';changed.claim.card_steps.steps[1].state='passed';
  await page.evaluate(data=>render(data),changed);
  assert.equal(await details.getAttribute('open'),'');
  assert.equal(await page.locator('#feature-title').textContent(),'Julian');
  assert.match(await page.locator('#team').textContent(),/Assignment lead/);
  assert.equal(await page.locator('[data-step=build]').getAttribute('data-state'),'passed');
  assert.equal(await page.locator('#plan-count').textContent(),'2 of 2 verified');
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }finally{await browser.close()}
});

test('suite rings use the suite denominator, settle first observation, and honor reduced motion changes',async()=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 const data={project:'relay',ci:{schema:'relay-ci-card/v1',status:'running',telemetry:'reported',run:{id:'77',attempt:1},tests:{passed:12,failed:0,skipped:2,reported:14,totals_known:false},suites_done:1,suites_total:4,suites:[{id:'one',key:'one',status:'passed'},{id:'two',key:'two',status:'running'}],jobs:{total:1}}};
 try{
  const page=await browser.newPage({viewport:{width:720,height:900}});await page.clock.install();
  await page.addInitScript(data=>{window.openai={toolOutput:data}},data);
  await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));
  await page.locator('#feature-title').filter({hasText:'Design & QA'}).waitFor();
  assert.equal(await page.locator('#telemetry-ring').isVisible(),true);
  assert.equal(await page.locator('#telemetry-value').getAttribute('stroke-dasharray'),'25 100');
  assert.equal(await page.locator('#metric-label').textContent(),'of 4 suites finished');
  assert.equal(await page.locator('#test-counts [data-state=passed] dd').textContent(),'12');
  const update={...data,ci:{...data.ci,suites_done:3,tests:{...data.ci.tests,passed:30}}};
  await page.evaluate(data=>render(data),update);await page.clock.runFor(340);
  const midway=Number((await page.locator('#telemetry-value').getAttribute('stroke-dasharray')).split(' ')[0]);
  assert.ok(midway>25&&midway<75,'update interpolates from the last displayed observation');
  await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(20);
  assert.equal(await page.locator('#telemetry-value').getAttribute('stroke-dasharray'),'75 100');
  assert.equal(await page.locator('#test-counts [data-state=passed] dd').textContent(),'30');
  await page.evaluate(data=>render(data),{...data,ci:{...data.ci,suites_total:null}});
  assert.equal(await page.locator('#telemetry-ring').isVisible(),false);
 }finally{await browser.close()}
});

test('all suite states have explicit accessible words and headings meet contrast in both themes',async()=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 try{for(const colorScheme of ['light','dark']){
  const page=await browser.newPage({colorScheme,viewport:{width:360,height:1000}});
  const statuses=['not_run','running','passed','failed','skipped','blocked','cancelled','unknown'];
  await page.addInitScript(statuses=>{window.openai={toolOutput:{project:'relay',ci:{schema:'relay-ci-card/v1',status:'running',telemetry:'reported',tests:{},jobs:{},suites:statuses.map(status=>({id:status,key:status,status})),suites_total:8,suites_done:3}}}},statuses);
  await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));
  await page.locator('#suite-list li').first().waitFor();
  assert.equal(await page.locator('#suite-list li').count(),8);
  for(const label of ['Pending','Running','Passed','Failed','Skipped','Blocked','Cancelled','Unconfirmed'])assert.ok((await page.locator('#suite-list').textContent()).includes(label));
  const contrast=await page.evaluate(()=>{
   const lum=value=>{const c=value.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
   const bg=lum(getComputedStyle(document.querySelector('#card')).backgroundColor);
   const ratio=n=>{const a=lum(getComputedStyle(document.querySelector(n)).color);return (Math.max(a,bg)+.05)/(Math.min(a,bg)+.05)};
   return {heading:ratio('h1'),body:ratio('#summary'),stroke:getComputedStyle(document.querySelector('#card')).borderColor};
  });assert.ok(contrast.heading>=3);assert.ok(contrast.body>=4.5);assert.equal(contrast.stroke,'rgb(61, 57, 53)');
  await page.close();
 }}finally{await browser.close()}
});

test('staff heading keeps its identity-team accent when Inspector telemetry is present',async()=>{
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 const claim={id:'cards',goal:'Build cards',state:'active',primary_staff:'nico',primary_team:'runner'};
 try{for(const theme of ['light','dark']){
  const page=await browser.newPage({colorScheme:theme});await page.addInitScript(claim=>{window.openai={toolOutput:{project:'relay',claim}}},claim);
  await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));await page.locator('#feature-title').filter({hasText:'Nico'}).waitFor();
  const before=await page.locator('h1').evaluate(n=>getComputedStyle(n).color);
  await page.evaluate(claim=>render({project:'relay',claim,ci:{schema:'relay-ci-card/v1',status:'running',telemetry:'reported',tests:{},suites:[],suites_done:1,suites_total:2,jobs:{}}}),claim);
  const after=await page.locator('h1').evaluate(n=>getComputedStyle(n).color);assert.equal(after,before);assert.equal(after,theme==='dark'?'rgb(59, 203, 141)':'rgb(22, 121, 78)');
  assert.equal(await page.locator('#telemetry-value').evaluate(n=>getComputedStyle(n).stroke),theme==='dark'?'rgb(24, 175, 192)':'rgb(8, 122, 136)');await page.close();
 }}finally{await browser.close()}
});
