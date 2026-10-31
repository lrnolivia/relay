import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {relayContextCardResource,contextCardModel} from './relay-chat-ui.js';
const row=(id='task',state='working')=>({assignment:id,goal:'Repair '+id,state,primary_staff:'valentina',primary_team:'inspector',worker:{heartbeat_at:'2026-10-31T22:57:12Z',freshness:'fresh'},last_meaningful_progress_at:'2026-10-31T22:26:46Z',progress_freshness:'stale'});
const progress=(id='task',state='working',at='2026-10-31T23:00:00Z')=>({project:'relay',generated_at:at,progress:[row(id,state)]});
async function mount(output,{input={project:'relay'},hold=false}={}){
 const browser=await chromium.launch({headless:true}),page=await browser.newPage();await page.clock.install({time:new Date('2026-10-31T23:00:00Z')});
 await page.addInitScript(({output,input,hold})=>{
  window.calls=[];window.pending=[];window.next=null;window.hold=hold;
  window.openai={toolInput:input,toolOutput:output,callTool:async(name,args)=>{
   window.calls.push({name,args});if(window.hold)return new Promise(resolve=>window.pending.push(resolve));
   return window.next||{project:args.project,generated_at:new Date().toISOString(),progress:[{assignment:args.assignment,goal:'Fresh '+args.assignment,state:'working',primary_staff:'valentina',primary_team:'inspector'}]};
  }};
 },{output,input,hold});
 await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));await page.locator('#feature-title').filter({hasText:'Valentina'}).waitFor();
 return {browser,page};
}
const calls=page=>page.evaluate(()=>window.calls);
const hide=(page,value)=>page.evaluate(value=>{Object.defineProperty(document,'hidden',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));},value);

test('ordinary query mounts fetch live progress without work_card; repeated globals do not starve polling and more than 90 polls stay live',async()=>{
 const initial=progress('task','officially-stale');const {browser,page}=await mount(initial);
 try{
  assert.match(await page.locator('#summary').textContent(),/worker checked in recently.*22:26:46.*does not verify/);
  await page.clock.runFor(400);await page.waitForFunction(()=>window.calls.length===1);await page.locator('#title').filter({hasText:'Fresh task'}).waitFor();
  assert.match(await page.locator('#card-freshness').textContent(),/Live updates.*Checked/);
  for(let i=0;i<3;i++){await page.clock.runFor(9000);await page.evaluate(initial=>{window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolOutput:initial}}}));},initial);}
  await page.clock.runFor(4000);await page.waitForFunction(()=>window.calls.length===2);
  for(let i=0;i<92;i++){const n=(await calls(page)).length;await page.clock.runFor(30050);await page.waitForFunction(n=>window.calls.length>n,n);}
  assert.ok((await calls(page)).length>90);assert.ok((await calls(page)).every(x=>x.name==='relay_runner_progress'&&x.args.assignment==='task'));
 }finally{await browser.close();}
});

test('automatic/manual reads coalesce, ignore late target answers, and bind assignment without toolInput.assignment',async()=>{
 const {browser,page}=await mount(progress(),{hold:true});
 try{
  await page.clock.runFor(400);await page.waitForFunction(()=>window.pending.length===1);
  await page.evaluate(()=>document.querySelector('#refresh').dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal((await calls(page)).length,1);
  await page.evaluate(data=>render(data),progress('other','working','2026-10-31T23:01:00Z'));
  await page.evaluate(data=>window.pending.shift()(data),progress('task','failed','2026-10-31T23:02:00Z'));
  await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await page.clock.runFor(10);await page.waitForFunction(()=>window.pending.length===1);
  assert.equal((await calls(page)).at(-1).args.assignment,'other');assert.equal(await page.locator('#title').textContent(),'Repair other');
  await page.evaluate(data=>window.pending.shift()(data),progress('other','working','2026-10-31T23:03:00Z'));await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  await page.locator('#refresh').click();await page.waitForFunction(()=>window.pending.length===1);assert.equal((await calls(page)).at(-1).args.assignment,'other');
 }finally{await browser.close();}
});

test('hidden cards pause transport; resume reads immediately; errors back off, preserve last evidence and manual recovery succeeds',async()=>{
 const {browser,page}=await mount(progress());
 try{
  await hide(page,true);await page.clock.runFor(300000);assert.equal((await calls(page)).length,0);
  assert.match(await page.locator('#card-freshness').textContent(),/paused while hidden/);
  await page.evaluate(()=>window.next={ok:false,error:{class:'provider',message:'Synthetic provider failure'}});
  await hide(page,false);await page.clock.runFor(5);await page.waitForFunction(()=>window.calls.length===1);await page.locator('#card-freshness').filter({hasText:'retrying automatically'}).waitFor();
  for(const delay of [30000,60000,120000,120000]){const n=(await calls(page)).length;await page.clock.runFor(delay+10);await page.waitForFunction(n=>window.calls.length>n,n);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);}
  assert.equal((await calls(page)).length,5);assert.match(await page.locator('#card-freshness').textContent(),/paused after repeated/);assert.equal(await page.locator('#title').textContent(),'Repair task');
  await page.clock.runFor(600000);assert.equal((await calls(page)).length,5);
  await page.evaluate(()=>window.next=null);await page.locator('#refresh').click();await page.locator('#title').filter({hasText:'Fresh task'}).waitFor();assert.match(await page.locator('#card-freshness').textContent(),/Live updates/);
 }finally{await browser.close();}
});

test('malformed, other-assignment and older responses preserve evidence; terminal stops polling but failed work can recover',async()=>{
 const {browser,page}=await mount(progress(),{hold:true});
 try{
  await page.clock.runFor(400);await page.waitForFunction(()=>window.pending.length===1);
  for(const bad of [{project:'relay',progress:[]},progress('wrong'),progress('task','failed','2026-10-31T22:00:00Z')]){
   await page.evaluate(data=>window.pending.shift()(data),bad);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
   assert.equal(await page.locator('#title').textContent(),'Repair task');await page.locator('#refresh').click();await page.waitForFunction(()=>window.pending.length===1);
  }
  await page.evaluate(data=>window.pending.shift()(data),progress('task','failed','2026-10-31T23:01:00Z'));await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  await page.clock.runFor(30010);await page.waitForFunction(()=>window.pending.length===1);
  await page.evaluate(data=>window.pending.shift()(data),progress('task','completed','2026-10-31T23:02:00Z'));await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  const n=(await calls(page)).length;await page.clock.runFor(120000);assert.equal((await calls(page)).length,n);assert.match(await page.locator('#card-freshness').textContent(),/Final recorded/);
 }finally{await browser.close();}
});

test('fresh routing notifications cannot downgrade observed progress; stale evidence does not become fresh from heartbeat or fetch',async()=>{
 const initial=progress('task','officially-stale');const {browser,page}=await mount(initial,{hold:true});
 try{
  await page.clock.runFor(400);await page.waitForFunction(()=>window.pending.length===1);
  const newer=progress('task','officially-stale','2026-10-31T23:01:00Z');await page.evaluate(data=>window.pending.shift()(data),newer);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  await page.evaluate(()=>render({project:'relay',claim:{id:'task',goal:'Routing snapshot',state:'active',primary_staff:'valentina'}}));
  assert.equal(await page.locator('#title').textContent(),'Repair task');assert.match(await page.locator('#state-label').textContent(),/No recent progress/);
  await page.clock.runFor(10);await page.waitForFunction(()=>window.pending.length===1);
  assert.equal(contextCardModel(newer).evidence.progress_observed_at,'2026-10-31T22:26:46Z');
 }finally{await browser.close();}
});

test('current global hydration wins over an in-flight read; page restore and online events reconcile without overlapping reads',async()=>{
 const {browser,page}=await mount(progress(),{hold:true});
 try{
  await page.clock.runFor(400);await page.waitForFunction(()=>window.pending.length===1);
  const latest=progress('task','blocked','2026-10-31T23:05:00Z');latest.progress[0].goal='New host evidence';
  await page.evaluate(data=>window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolOutput:data}}})),latest);
  await page.evaluate(data=>window.pending.shift()(data),progress('task','failed','2026-10-31T23:01:00Z'));
  await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert.equal(await page.locator('#title').textContent(),'New host evidence');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));const count=(await calls(page)).length;await page.clock.runFor(300000);assert.equal((await calls(page)).length,count);
  await page.evaluate(()=>{window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('online'));});await page.clock.runFor(5);await page.waitForFunction(n=>window.calls.length===n+1,count);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.clock.runFor(5);assert.equal((await calls(page)).length,count+1);
  await page.evaluate(data=>window.pending.shift()(data),latest);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert.equal(await page.locator('#title').textContent(),'New host evidence');
 }finally{await browser.close();}
});

test('real progress producer through mounted refresh keeps source age separate from fresh worker and successful reads',async()=>{
 const {deriveObservedProgress}=await import('./progress-observation.js');
 const claim={id:'task',state:'active',goal:'Source freshness',primary_staff:'valentina',primary_team:'inspector',branch:'relay/task',base_sha:'a'.repeat(40),created_at:'2026-10-31T21:00:00Z',updated_at:'2026-10-31T22:59:58Z'};
 const observed=deriveObservedProgress({project:'relay',claim,branch:{commit:{sha:'b'.repeat(40)}},commit:{commit:{committer:{date:'2026-10-31T22:26:46Z'}}},now:new Date('2026-10-31T23:00:00Z')});
 assert.equal(observed.state,'officially-stale');assert.equal(observed.worker.freshness,'fresh');
 const current={project:'relay',generated_at:'2026-10-31T23:00:00Z',progress:[observed]};
 const {browser,page}=await mount({project:'relay',claim});
 try{
  await page.evaluate(data=>window.next=data,current);await page.clock.runFor(400);
  await page.locator('#state-label').filter({hasText:'No recent progress evidence'}).waitFor();
  assert.match(await page.locator('#summary').textContent(),/22:26:46.*check-in does not verify/i);
  await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  assert.match(await page.locator('#card-freshness').textContent(),/Checked/);assert.equal(await page.locator('#state-label').textContent(),'No recent progress evidence');
  const evidence=JSON.parse(await page.locator('#evidence').textContent());assert.equal(evidence.progress_freshness,'stale');assert.equal(evidence.progress_observed_at,'2026-10-31T22:26:46.000Z');
 }finally{await browser.close();}
});
