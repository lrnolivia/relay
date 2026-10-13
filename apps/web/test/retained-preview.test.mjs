import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {webAssets,webBuildId} from '../generated.js';
import {createRetainedBundle} from '../retained-bundle.mjs';
import {storeRetainedBundle,getRetainedBundle} from '../../../src/retained-preview.js';
import {contextFixture} from './project-context-fixture.mjs';
import {retainedStorageFixture} from './retained-storage-fixture.mjs';

test('new retained builds show the legitimate landing, preserve historical records and keep the original opaque network isolation', {timeout:120000},async()=>{
 const sourceSha='a'.repeat(40),bucket=retainedStorageFixture();
 const {bundle,sha256}=await createRetainedBundle({webAssets,sourceSha,buildId:webBuildId,createdAt:'2026-10-07T14:00:00.000Z',fontCss:''});
 const stored=await storeRetainedBundle(bucket,bundle);assert.equal(stored.sha256,sha256);
 const historical={...bundle,source_sha:'b'.repeat(40),documents:{app:'<!doctype html><html><body>Historical recovery fixture</body></html>',inspector:'<!doctype html><html><body>Historical Inspector fixture</body></html>'}};
 const old=await storeRetainedBundle(bucket,historical);assert.notEqual(old.id,stored.id);
 assert.deepEqual((await getRetainedBundle(bucket,old.id)).bundle.documents,historical.documents);
 const browser=await chromium.launch(),fixture=await contextFixture({retained:{bucket,id:stored.id,source_sha:sourceSha}});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
   await page.goto(fixture.origin+'/');await page.locator('.live-telemetry[data-loading=false]').waitFor();
   await page.evaluate(()=>localStorage.setItem('host-secret','host-only'));
   await page.evaluate(id=>{const frame=document.createElement('iframe');frame.id='retained-test';frame.setAttribute('sandbox','allow-scripts');frame.src='/api/retained-preview/'+id+'/view?entry=app#/';frame.style.cssText='width:100%;height:800px';document.body.append(frame);},stored.id);
   const frame=page.frameLocator('#retained-test');await frame.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();
   await frame.locator('.live-telemetry[data-loading=false]').waitFor();
   assert.equal(await frame.locator('.operator-nav,.work-viewer,#review-list').count(),0);
   assert.equal(await frame.getByRole('button',{name:'Open files',exact:true}).isDisabled(),true);
   assert.match(await frame.locator('.relay-connection-copy').innerText(),/cannot check or change your real connection/);
   const isolation=await frame.locator('body').evaluate(async()=>{
    const violations=[];const onViolation=e=>violations.push(e.effectiveDirective);window.addEventListener('securitypolicyviolation',onViolation);
    let parentBlocked=false,cookieBlocked=false;try{void parent.document.body;}catch{parentBlocked=true;}try{void document.cookie;}catch{cookieBlocked=true;}
    try{navigator.sendBeacon('/forbidden-beacon','preview');}catch{}
    const image=new Image();image.src=location.origin+'/forbidden-image';
    localStorage.setItem('preview-only','yes');await new Promise(resolve=>setTimeout(resolve,300));window.removeEventListener('securitypolicyviolation',onViolation);
    return {origin:window.origin,parentBlocked,cookieBlocked,violations,storage:localStorage.getItem('preview-only'),hostSecret:localStorage.getItem('host-secret')};
   });
   assert.equal(isolation.origin,'null');assert.ok(isolation.parentBlocked&&isolation.cookieBlocked);assert.equal(isolation.storage,'yes');assert.equal(isolation.hostSecret,null);
   assert.ok(isolation.violations.includes('connect-src')&&isolation.violations.includes('img-src'),JSON.stringify(isolation));
   assert.equal(fixture.requests.some(path=>path.startsWith('/forbidden-')),false);
   await frame.locator('body').evaluate(()=>{location.hash='#/runner?project=relay';});
   await frame.getByRole('heading',{name:'Your work is in CTRL',exact:true}).waitFor();assert.equal(await frame.locator('.operator-nav,.work-viewer').count(),0);
   await frame.getByRole('link',{name:'Back to Relay connections and files'}).click();await frame.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();
   await page.evaluate(id=>{document.querySelector('#retained-test').src='/api/retained-preview/'+id+'/view?entry=inspector';},stored.id);
   await frame.getByRole('heading',{name:'Inspector is in CTRL',exact:true}).waitFor();assert.equal(await frame.locator('#review-list,.qa-review,.operator-nav').count(),0);
   assert.equal(await page.evaluate(()=>localStorage.getItem('preview-only')),null);await page.close();
  }
 }finally{await browser.close();await fixture.close();}
});
