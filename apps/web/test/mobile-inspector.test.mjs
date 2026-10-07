import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {webAssets,mcpHtml} from '../generated.js';

test('mobile compatibility handoffs are inert, readable and keyboard accessible', {timeout:45000},async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [320,390,768])for(const [name,html]of [['inspector',webAssets['/inspector'].text],['control-center',mcpHtml]]){
   const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});const requests=[];page.on('request',request=>requests.push(request.url()));
   await page.setContent(html);assert.equal(await page.locator('[data-relay-ctrl-handoff]').count(),1);
   assert.equal(await page.locator('script,iframe,form,button,input,.operator-nav,.work-viewer,#review-list').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const link=page.getByRole('link',{name:'Open CTRL',exact:true});assert.equal(new URL(await link.getAttribute('href')).origin,'https://ctrl.loew.fi');
   await page.keyboard.press('Tab');assert.equal(await link.evaluate(node=>node===document.activeElement),true);assert.deepEqual(requests,[]);
   await mkdir('qa-evidence/retirement',{recursive:true});await page.screenshot({path:'qa-evidence/retirement/'+name+'-'+width+'.png',fullPage:true});await page.close();
  }
 }finally{await browser.close();}
});
