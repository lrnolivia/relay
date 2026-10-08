import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {webAssets,mcpHtml} from '../generated.js';
import {reactJs} from '../generated-react.js';
import {legacyScript} from '../generated-inspector.js';
import {contextFixture} from './project-context-fixture.mjs';
const captureDirectory=fileURLToPath(new URL('../../../qa-evidence/retirement/',import.meta.url));

test('production bundles contain the Relay landing and inert CTRL handoffs, without legacy application programs',()=>{
 assert.equal(legacyScript,'');assert.equal(webAssets['/relay-app.js'],undefined);
 assert.match(webAssets['/'].text,/id="root"/);
 for(const html of [mcpHtml,webAssets['/inspector'].text,webAssets['/inspector/'].text]){
  assert.match(html,/data-relay-ctrl-handoff/);assert.match(html,/https:\/\/ctrl.loew.fi\//);
  assert.doesNotMatch(html,/<script|<iframe|id="root"|operator-nav|data-page="review"|relay_ui_request/);
 }
 assert.doesNotMatch(reactJs,/operator-nav react-operator-nav|data-bulk|qa-review-loading/);
});

test('the actual generated landing stays intact and retired hash routes cannot render old panels at any pathname',async()=>{
 const browser=await chromium.launch({headless:true}),fixture=await contextFixture();
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce',colorScheme:'dark'});
   await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
   await page.route('https://fonts.gstatic.com/**',route=>route.abort());
   await page.route('**/api/relay/check',route=>route.fulfill({json:{ok:true,checked_at:new Date().toISOString(),elapsed_ms:4,tools:{count:1}}}));
   await page.route(fixture.origin+'/preview/fixture',route=>route.fulfill({contentType:'text/html',body:webAssets['/'].text}));
   await page.goto(fixture.origin+'/#/');await page.getByRole('heading',{name:'relay',level:1,exact:true}).waitFor();
   await page.locator('.live-telemetry[data-loading=false]').waitFor();
   assert.equal(await page.getByRole('button',{name:'Open files',exact:true}).isEnabled(),true);
   assert.equal(await page.locator('.operator-nav,.work-viewer,#review-list').count(),0);
   await mkdir(captureDirectory,{recursive:true});await page.screenshot({path:captureDirectory+'relay-landing-'+width+'.png',fullPage:true});
   for(const path of ['/','/index.html','/preview/fixture'])for(const route of ['today','runner','night-shift','inspector']){
    await page.goto(fixture.origin+path+'#/'+route+'?project=relay');
    await page.getByRole('heading',{name:'Your work is in CTRL',exact:true}).waitFor();
    const expected='https://ctrl.loew.fi/#/'+(route==='today'?'now':route)+'?project=relay';
    assert.equal(await page.getByRole('link',{name:'Open CTRL',exact:true}).getAttribute('href'),expected);
    assert.equal(await page.locator('.operator-nav,.work-viewer,#review-list').count(),0);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:captureDirectory+'ctrl-handoff-'+width+'.png',fullPage:true});
   await page.getByRole('link',{name:'Back to Relay connections and files'}).click();
   await page.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();await page.close();
  }
 }finally{await browser.close();await fixture.close();}
});
