import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withCardProjectIcon} from './relay-project-icon.js';
import {contextCardModel,compactContextCardResult} from './relay-chat-ui.js';
const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>');
const sha256=createHash('sha256').update(bytes).digest('hex');
function fixture({project='rtxforge',invalid=false,unsafe=false}={}){
 const calls=[],asset=unsafe?Buffer.from('<svg onload="alert(1)"></svg>'):bytes;
 const manifest={schema:1,project,variants:{primary:{path:'brand/icon.svg',bytes:asset.length,sha256:invalid?'0'.repeat(64):createHash('sha256').update(asset).digest('hex')}}};
 const api=async path=>{calls.push(path);if(path.includes('/contents/projects/'))return {type:'file',sha:'e'.repeat(40),encoding:'base64',content:Buffer.from(JSON.stringify({id:project,repository:'owner/'+project,default_branch:'main'})).toString('base64')};if(path.includes('/git/trees/'))return {tree:[{type:'blob',path:'relay.assets.json',sha:'a'.repeat(40)},{type:'blob',path:'brand/icon.svg',sha:'b'.repeat(40)}]};if(path.endsWith('a'.repeat(40)))return {encoding:'base64',content:Buffer.from(JSON.stringify(manifest)).toString('base64')};if(path.endsWith('b'.repeat(40)))return {encoding:'base64',content:asset.toString('base64')};throw Error('Unexpected path '+path);};
 return {api,calls};
}
test('registered icon bytes reach ordinary work, compact transport and refresh with exact provenance',async()=>{
 const f=fixture(),env={RELAY_GITHUB_TOKEN:'synthetic-icon-test'};
 for(const tool of ['relay_runner_coordinate','relay_execution','relay_render_context_card','relay_runner_progress']){
  const result=await withCardProjectIcon(tool,{project:'rtxforge',claims:[{id:'work',state:'active',primary_team:'runner'}]},env,f.api);
  assert.equal(result.project_icon.icon.sha256,sha256);assert.equal(result.project_icon.icon.path,'brand/icon.svg');
  const card=contextCardModel(compactContextCardResult(result));assert.equal(card.project_icon.sha256,sha256);
 }
 assert.ok(f.calls.every(p=>p.startsWith('/repos/lrnolivia/relay/contents/projects/')||p.startsWith('/repos/owner/rtxforge/')));
});
test('invalid manifests, unsafe SVG, unavailable discovery and mismatched projects never supply an icon',async()=>{
 for(const options of [{invalid:true},{unsafe:true}]){const f=fixture(options),r=await withCardProjectIcon('relay_runner_progress',{project:'rtxforge'},{RELAY_GITHUB_TOKEN:JSON.stringify(options)},f.api);assert.equal(r.project_icon.status,'unavailable');}
 const r=await withCardProjectIcon('relay_runner_progress',{project:'rtxforge'},{},async()=>{throw Error('Unavailable')});assert.equal(r.project_icon.status,'unavailable');
 const f=fixture(),good=await withCardProjectIcon('relay_runner_progress',{project:'rtxforge'},{RELAY_GITHUB_TOKEN:'switch-test'},f.api);
 assert.equal(contextCardModel({...good,project:'relay'}).project_icon,null);
 assert.equal(contextCardModel({...good,project_icon:{...good.project_icon,icon:{...good.project_icon.icon,data_url:'https://external.example/icon.svg'}}}).project_icon,null);
});

test('late refresh cannot restore a previous project icon after the host switches project',async()=>{
 const {chromium}=await import('playwright');const {relayContextCardResource}=await import('./relay-chat-ui.js');
 const browser=await chromium.launch({headless:true});
 try{
  const f=fixture(),a=await withCardProjectIcon('relay_runner_progress',{project:'rtxforge',progress:[{assignment:'a',state:'active',goal:'Project A'}]},{RELAY_GITHUB_TOKEN:'late-browser-test'},f.api);
  const b={project:'relay',project_icon:{project:'relay',status:'unavailable',icon:null},progress:[{assignment:'b',state:'active',goal:'Project B'}]};
  const page=await browser.newPage();await page.addInitScript(({a})=>{window.openai={toolInput:{project:'rtxforge'},toolOutput:a,callTool:()=>new Promise(resolve=>window.finishRefresh=resolve)};},{a});
  await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));await page.locator('#card-project img').waitFor();
  await page.locator('#refresh').click();await page.waitForFunction(()=>typeof window.finishRefresh==='function');
  await page.evaluate(b=>{window.openai.toolInput={project:'relay'};window.openai.toolOutput=b;dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolInput:window.openai.toolInput,toolOutput:b}}}));},b);
  await page.locator('#title').filter({hasText:'Project B'}).waitFor();
  await page.evaluate(a=>window.finishRefresh({structuredContent:a}),a);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  assert.equal(await page.locator('#title').textContent(),'Project B');assert.equal(await page.locator('#card-project img').count(),0);assert.equal(await page.locator('#card-project').textContent(),'relay');
 }finally{await browser.close();}
});

test('project explorer retains current icon on refresh and rejects a wrong-project reply',async()=>{
 const {chromium}=await import('playwright');const {relayContextCardResource}=await import('./relay-chat-ui.js');
 const browser=await chromium.launch({headless:true});
 try{
  const f=fixture(),a=await withCardProjectIcon('relay_runner_progress',{project:'rtxforge',progress:[{assignment:'a',state:'active',goal:'Project work'}]},{RELAY_GITHUB_TOKEN:'explorer-browser-test'},f.api);
  const page=await browser.newPage();await page.addInitScript(a=>{window.reply=a;window.openai={toolOutput:{schema:'relay-status-explorer/v1',projects:[{id:'rtxforge',name:'rtxForge',coordination:'enabled'}]},callTool:async()=>({structuredContent:window.reply})};},a);
  await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));await page.getByRole('button',{name:/rtxForge.*1 open/}).click();
  const original=await page.locator('#card-project img').getAttribute('src');assert.equal(original,a.project_icon.icon.data_url);
  await page.locator('#refresh').click();await page.locator('#state-label').filter({hasText:'Work in progress'}).waitFor();assert.equal(await page.locator('#card-project img').getAttribute('src'),original);
  await page.evaluate(()=>window.reply={project:'relay',progress:[]});await page.locator('#refresh').click();await page.locator('#blocker').waitFor({state:'visible'});
  assert.equal(await page.locator('#card-project img').getAttribute('src'),original);assert.equal(await page.locator('#card-project').textContent(),'rtxforge');
 }finally{await browser.close();}
});
