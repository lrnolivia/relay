import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {contextFixture} from './project-context-fixture.mjs';
import {webAssets} from '../generated.js';

test('retired hash routes preserve project and deep-link context without mounting a duplicate workspace', {timeout:45000},async()=>{
 const browser=await chromium.launch(),fixture=await contextFixture();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));await page.route('https://fonts.gstatic.com/**',route=>route.abort());
  await page.route(fixture.origin+'/retained/fixture',route=>route.fulfill({contentType:'text/html',body:webAssets['/'].text}));
  for(const path of ['/','/retained/fixture'])for(const route of ['/today','/today/relay/item','/now','/runner/relay/exact-task','/night-shift','/inspector']){
   const query='?project=relay&assignment=exact%20task';await page.goto(fixture.origin+path+'#'+route+query);
   await page.getByRole('heading',{name:'Your work is in CTRL',exact:true}).waitFor();
   const target='https://ctrl.loew.fi/#'+route.replace(/^\/today(?=\/|$)/,'/now')+query;
   assert.equal(await page.getByRole('link',{name:'Open CTRL',exact:true}).getAttribute('href'),target);
   assert.equal(await page.locator('.operator-nav,.work-viewer,#review-list').count(),0);
  }
  await page.getByRole('link',{name:'Back to Relay connections and files'}).click();await page.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();
 }finally{await browser.close();await fixture.close();}
});
