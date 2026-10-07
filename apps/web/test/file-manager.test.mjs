import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {webAssets} from '../generated.js';
import {browserFileResponse} from '../../../src/file-transfer.js';
import {filterFiles} from '../../../packages/shared-ui/file-manager.js';
test('shared file queries combine name, readiness, type and ordering without changing the inventory',()=>{
 const files=[{filename:'ZETA.zip',state:'ready',bytes:30,created_at:1},{filename:'photo.png',state:'uploading',bytes:90,created_at:3},{filename:'notes.pdf',state:'ready',bytes:60,created_at:2}];
 assert.deepEqual(filterFiles(files,{search:'zeta',state:'ready',kind:'packages'}).map(x=>x.filename),['ZETA.zip']);
 assert.deepEqual(filterFiles(files,{state:'incomplete',kind:'images'}).map(x=>x.filename),['photo.png']);
 assert.deepEqual(filterFiles(files,{sort:'size'}).map(x=>x.filename),['photo.png','notes.pdf','ZETA.zip']);
 assert.deepEqual(filterFiles(files,{sort:'name'}).map(x=>x.filename),['notes.pdf','photo.png','ZETA.zip']);
 assert.deepEqual(files.map(x=>x.filename),['ZETA.zip','photo.png','notes.pdf']);
});
class Bucket{
 objects=new Map();
 async put(key,value,options={}){if(options.onlyIf&&this.objects.has(key))return null;this.objects.set(key,{bytes:Buffer.from(value),customMetadata:options.customMetadata});return {key}}
 async get(key){const o=this.objects.get(key);return o?{text:async()=>o.bytes.toString(),arrayBuffer:async()=>o.bytes}:null}
 async head(key){return this.objects.has(key)?{key}:null}
 async list({prefix,limit=300,cursor}){const all=[...this.objects].filter(([k])=>k.startsWith(prefix)&&(!cursor||k>cursor)).sort(([a],[b])=>a.localeCompare(b)),rows=all.slice(0,limit);return {objects:rows.map(([key,v])=>({key,customMetadata:v.customMetadata})),truncated:all.length>limit,cursor:all.length>limit?rows.at(-1)[0]:null}}
}
test('shared file manager uploads, resumes, downloads, closes and stays inside mobile bounds',async()=>{
 const bucket=new Bucket(),claims={iss:'https://fixture.invalid',sub:'synthetic-owner'};let failOnce=true;
 const server=http.createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/files')){
   if(failOnce&&req.method==='PUT'&&path.endsWith('/chunks/1')){failOnce=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Test connection interrupted'}));return}
   const body=[];for await(const chunk of req)body.push(chunk);
   const headers={...req.headers,origin:'https://relay.loew.fi'};
   const input=new Request('https://relay.loew.fi'+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(body)})});
   const result=await browserFileResponse(input,bucket,claims);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return;
  }
  if(path.startsWith('/api/')){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(path.includes('/projects')?{projects:[]}:path.includes('/workers')?{workers:[]}:{ok:true,progress:[]}));return}
  const asset=webAssets[path]||webAssets['/'];if(!asset){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':asset.type});res.end(asset.text);
 }catch(e){res.writeHead(500);res.end(String(e))}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true});
 const output=process.env.RELAY_QA_OUTPUT||'qa-evidence/file-manager';await fs.mkdir(output,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.getByRole('button',{name:'Open files',exact:true}).click();const modal=page.getByRole('dialog');await modal.waitFor();
  const data=Buffer.alloc(4*1024*1024+173,29),file={name:'test-work-package.zip',mimeType:'application/zip',buffer:data};
  await modal.locator('input[type=file]').setInputFiles(file);await page.getByText(/Test connection interrupted/).waitFor();assert.equal(await modal.getByRole('button',{name:'Resume',exact:true}).count(),1);
  const chooser=page.waitForEvent('filechooser');await modal.getByRole('button',{name:'Resume',exact:true}).click();await(await chooser).setFiles(file);
  await modal.getByText('test-work-package.zip is ready to download.',{exact:true}).waitFor();
  const download=page.waitForEvent('download');await modal.getByRole('link',{name:'Download',exact:true}).click();const delivered=await download;await delivered.saveAs(output+'/file-roundtrip.zip');assert.equal(createHash('sha256').update(await fs.readFile(output+'/file-roundtrip.zip')).digest('hex'),createHash('sha256').update(data).digest('hex'));
  await modal.getByRole('searchbox',{name:'search files'}).fill('missing');assert.equal(await modal.getByRole('link',{name:'Download',exact:true}).count(),0);
  await modal.getByRole('searchbox',{name:'search files'}).fill('');await modal.locator('[data-control-menu=filters]>summary').click();
  await modal.getByRole('radio',{name:'images',exact:true}).click();assert.equal(await modal.getByRole('link',{name:'Download',exact:true}).count(),0);
  await page.keyboard.press('ArrowRight');await modal.getByRole('link',{name:'Download',exact:true}).waitFor();assert.equal(await modal.getByRole('radio',{name:'packages',exact:true}).getAttribute('aria-checked'),'true');
  await modal.getByRole('button',{name:'upload incomplete',exact:true}).click();assert.equal(await modal.getByRole('link',{name:'Download',exact:true}).count(),0);
  await modal.getByRole('button',{name:'ready to download',exact:true}).click();await modal.getByRole('link',{name:'Download',exact:true}).waitFor();
  assert.equal(await modal.getByRole('radio',{name:'packages',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(181, 71, 31)');
  for(const theme of ['light','dark']){await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);const ratios=await modal.locator('button:not([hidden]),a').evaluateAll(nodes=>{const lum=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};return nodes.filter(n=>n.offsetWidth>0).map(n=>{const s=getComputedStyle(n),a=lum(s.color),b=lum(s.backgroundColor);return {text:n.textContent,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}})});for(const r of ratios)assert.ok(r.ratio>=4.5,theme+' readable action '+JSON.stringify(r));await modal.screenshot({path:output+'/files-'+theme+'.png'})}
  await page.evaluate(()=>{document.documentElement.dataset.theme='light'});
  await modal.screenshot({path:output+'/files-desktop.png'});await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Open files',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'Open files',exact:true}).click();await modal.getByRole('link',{name:'Download',exact:true}).waitFor();
  for(const width of [768,390,320]){await page.setViewportSize({width,height:844});const box=await modal.boundingBox();assert.ok(box.x>=0&&box.width<=width&&box.height<=844);assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
  await modal.screenshot({path:output+'/files-mobile.png'});
  await modal.getByRole('button',{name:'Close files',exact:true}).click();await modal.waitFor({state:'hidden'});
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
});
