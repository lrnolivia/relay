import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {contextFixture} from './project-context-fixture.mjs';

test('landing remains usable with reduced motion and no retired panel navigation', {timeout:45000},async()=>{
 const browser=await chromium.launch(),fixture=await contextFixture();
 try{
  for(const reducedMotion of ['reduce','no-preference']){
   const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion});
   await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));await page.route('https://fonts.gstatic.com/**',route=>route.abort());
   await page.goto(fixture.origin+'/');await page.locator('.live-telemetry[data-loading=false]').waitFor();
   assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),reducedMotion==='reduce');
   assert.equal(await page.locator('.operator-nav,.work-viewer,#review-list').count(),0);
   await page.getByRole('button',{name:'connect your AI'}).click();await page.getByRole('heading',{name:'Connect your AI',exact:true}).waitFor();
   await page.getByLabel('Add Relay to AI').getByRole('button',{name:'Close',exact:true}).click();
   assert.equal(await page.getByRole('heading',{name:'relay',exact:true,level:1}).isVisible(),true);await page.close();
  }
 }finally{await browser.close();await fixture.close();}
});
