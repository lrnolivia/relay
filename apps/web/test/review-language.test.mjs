import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {contextFixture} from './project-context-fixture.mjs';
import {reviewKey} from '../../../packages/shared-ui/work-view-model.js';

test('actual generated review UI preserves an uncertain save through readback without replaying it',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1440,390])for(const outcome of ['saved-response-lost','incomplete-receipt','readback-incomplete']){
   const fixture=await contextFixture(),page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce',colorScheme:'dark'});
   let writes=0;
   try{
    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
    await page.route('https://fonts.gstatic.com/**',route=>route.abort());
    await page.route('**/api/work-review',async route=>{
     const input=route.request().postDataJSON();
     if(input.action!=='set')return outcome==='readback-incomplete'&&writes?route.fulfill({json:{results:[]}}):route.continue();
     writes++;
     if(outcome!=='incomplete-receipt'){
      await fixture.reviews.body(input);
      return route.fulfill({status:503,json:{error:'Synthetic lost response'}});
     }
     return route.fulfill({status:200,json:{results:[]}});
    });
    await page.goto(fixture.origin+'/#/runner');
    const viewer=page.locator('.work-viewer');
    await viewer.locator('[data-filter=all]').click();
    await page.locator('[data-progress-notice]').waitFor({state:'detached'});
    await page.locator('.work-viewer[data-summary-state=ready]').waitFor();
    const checkbox=viewer.locator('[data-select]').first(),key=await checkbox.getAttribute('data-select');
    await checkbox.check();
    const complete=viewer.getByRole('button',{name:'Mark review complete',exact:true});
    await complete.click();await viewer.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(writes,0);assert.equal(await complete.evaluate(node=>node===document.activeElement),true);
    await complete.click();await viewer.locator('[data-confirm]').click();
    const notice=viewer.locator('.work-message');
    await notice.filter({hasText:outcome==='readback-incomplete'?"couldn't load the review statuses":'The latest review statuses are shown below.'}).waitFor();
    if(outcome==='readback-incomplete'){assert.equal(await complete.isDisabled(),true);assert.doesNotMatch(await notice.innerText(),/latest review statuses are shown/);}
    assert.match(await notice.innerText(),/couldn't confirm whether or not the change was saved/);
    assert.doesNotMatch(await notice.innerText(),/HTTP|Synthetic|receipt/);
    assert.equal(writes,1,'readback must not replay an uncertain mutation');
    const row=viewer.locator('[data-work-key]').filter({has:page.locator('[data-select="'+key+'"]')});
    assert.match(await row.innerText(),outcome==='saved-response-lost'?/Review: Completed/:/Review: Need review/);
    assert.equal(fixture.progress.relay[0].state,'working','review actions do not complete the task');
    await viewer.locator('[data-view=visual]').click();
    assert.match(await notice.innerText(),/couldn't confirm whether or not/);
    await viewer.locator('.work-message-details > summary').click();
    assert.match(await viewer.locator('.work-message-details').innerText(),outcome==='saved-response-lost'?/HTTP 503/:/receipt is incomplete/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await mkdir('qa-evidence/review-language',{recursive:true});
    await page.screenshot({path:'qa-evidence/review-language/'+outcome+'-'+width+'.png',fullPage:true});
   }finally{await page.close();await fixture.close();}
  }
 }finally{await browser.close();}
});

test('review partial receipts give confirmed counts and preserve archive scope',async()=>{
 const fixture=await contextFixture(),browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:1000}});
  await page.route('**/api/work-review',async route=>{
   const input=route.request().postDataJSON();if(input.action!=='set')return route.continue();
   const accepted=await fixture.reviews.body({...input,items:input.items.slice(0,1)});
   return route.fulfill({json:{results:[...accepted.results,...input.items.slice(1).map(item=>({key:reviewKey(item),ok:false,error:'Synthetic conflict'}))]}});
  });
  await page.goto(fixture.origin+'/#/runner');const viewer=page.locator('.work-viewer');
  await viewer.locator('[data-filter=all]').click();await page.locator('[data-progress-notice]').waitFor({state:'detached'});await page.locator('.work-viewer[data-summary-state=ready]').waitFor();
  const count=await viewer.locator('[data-select]').count();assert.ok(count>1);
  await viewer.locator('[data-select-visible]').check();await viewer.getByRole('button',{name:'Mark review complete',exact:true}).click();await viewer.locator('[data-confirm]').click();
  await viewer.locator('.work-message').filter({hasText:'1 review updated.'}).waitFor();
  assert.match(await viewer.locator('.work-message').innerText(),new RegExp((count-1)+' reviews? not updated'));
  assert.doesNotMatch(await viewer.locator('.work-message').innerText(),/Synthetic/);
  await viewer.getByRole('button',{name:'Archive completed reviews',exact:true}).click();
  assert.match(await viewer.locator('.work-confirm').innerText(),/1 item/);await viewer.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(fixture.progress.relay[0].state,'working');
 }finally{await browser.close();await fixture.close();}
});
