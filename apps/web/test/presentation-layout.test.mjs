import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {contextFixture} from './project-context-fixture.mjs';

test('Relay landing and connection guidance preserve responsive layout without legacy docks', {timeout:45000},async()=>{
 const browser=await chromium.launch(),fixture=await contextFixture();
 try{
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
   await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));await page.route('https://fonts.gstatic.com/**',route=>route.abort());
   await page.goto(fixture.origin+'/');await page.locator('.live-telemetry[data-loading=false]').waitFor();
   assert.equal(await page.locator('.telemetry-card').count(),4);assert.equal(await page.locator('.operator-topbar,.operator-nav,.work-viewer').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.getByRole('button',{name:'connect your AI'}).click();await page.getByRole('heading',{name:'Connect your AI',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.getByRole('button',{name:'Open files',exact:true}).isEnabled(),true);await page.close();
  }
 }finally{await browser.close();await fixture.close();}
});
