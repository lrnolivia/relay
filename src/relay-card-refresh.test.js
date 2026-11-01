import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {relayContextCardResource,contextCardModel} from './relay-chat-ui.js';
const row=(id='task',state='working')=>({assignment:id,goal:'Repair '+id,state,primary_staff:'valentina',primary_team:'inspector',worker:{heartbeat_at:'2026-10-31T22:57:12Z',freshness:'fresh'},last_meaningful_progress_at:'2026-10-31T22:26:46Z',progress_freshness:'stale'});
const progress=(id='task',state='working',at='2026-10-31T23:00:00Z')=>({project:'relay',generated_at:at,progress:[row(id,state)]});
async function mount(output,{input={project:'relay'},hold=false,waitStaff=true}={}){
 const browser=await chromium.launch({headless:true}),page=await browser.newPage();await page.clock.install({time:new Date('2026-10-31T23:00:00Z')});await page.clock.pauseAt(new Date('2026-10-31T23:00:00.001Z'));
 await page.addInitScript(({output,input,hold})=>{
  window.calls=[];window.pending=[];window.next=null;window.hold=hold;
  window.openai={toolInput:input,toolOutput:output,callTool:async(name,args)=>{
   window.calls.push({name,args});if(window.hold)return new Promise(resolve=>window.pending.push(resolve));
   return window.next||{project:args.project,generated_at:new Date().toISOString(),progress:[{assignment:args.assignment,goal:'Fresh '+args.assignment,state:'working',primary_staff:'valentina',primary_team:'inspector'}]};
  }};
 },{output,input,hold});
 await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));if(waitStaff)await page.locator('#feature-title').filter({hasText:'Valentina'}).waitFor();
 return {browser,page};
}
const calls=page=>page.evaluate(()=>window.calls);
const hide=(page,value)=>page.evaluate(value=>{Object.defineProperty(document,'hidden',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));},value);

test('ordinary query mounts fetch live progress without work_card; repeated globals do not starve polling and more than 90 polls stay live',async()=>{
 const initial=progress('task','officially-stale');const {browser,page}=await mount(initial);
 try{
  assert.match(await page.locator('#summary').textContent(),/Worker connected.*22:26 UTC/);
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
  await hide(page,false);await page.clock.runFor(5);await page.waitForFunction(()=>window.calls.length===1);await page.locator('#card-freshness').filter({hasText:'Retrying automatically'}).waitFor();
  for(const delay of [30000,60000,120000,120000]){const n=(await calls(page)).length;await page.clock.runFor(delay+10);await page.waitForFunction(n=>window.calls.length>n,n);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);}
  assert.equal((await calls(page)).length,5);assert.match(await page.locator('#card-freshness').textContent(),/Use Refresh to try again/);assert.equal(await page.locator('#title').textContent(),'Repair task');
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
  assert.equal(await page.locator('#title').textContent(),'Repair task');assert.match(await page.locator('#state-label').textContent(),/Waiting for a work update/);
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
  await page.locator('#state-label').filter({hasText:'Waiting for a work update'}).waitFor();
  assert.match(await page.locator('#summary').textContent(),/Worker connected.*22:26 UTC/);
  await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  assert.match(await page.locator('#card-freshness').textContent(),/Checked/);assert.equal(await page.locator('#state-label').textContent(),'Waiting for a work update');
  const evidence=JSON.parse(await page.locator('#evidence').textContent());assert.equal(evidence.progress_freshness,'stale');assert.match(evidence.progress_clock,/check-ins.*not verified progress/);assert.equal(evidence.progress_observed_at,'2026-10-31T22:26:46.000Z');
 }finally{await browser.close();}
});

test('new host project and assignment replace hydrated explorer navigation and the shared refresh target',async()=>{
 const initial={...progress(),schema:'relay-status-explorer/v1'};
 const {browser,page}=await mount(initial,{input:{project:'relay',assignment:'task'}});
 try{
  await page.clock.runFor(400);await page.waitForFunction(()=>window.calls.length===1);
  const next={...progress('next','working','2026-10-31T23:05:00Z'),project:'field'};
  await page.evaluate(data=>{window.openai.toolInput={project:'field',assignment:'next'};window.openai.toolOutput=data;window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolInput:window.openai.toolInput,toolOutput:data}}}));},next);
  assert.equal(await page.locator('#title').textContent(),'Repair next');
  await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  assert.deepEqual((await calls(page)).at(-1).args,{project:'field',assignment:'next'});
  next.progress[0].assignment='third';next.progress[0].goal='Third assignment';next.generated_at='2026-10-31T23:06:00Z';
  await page.evaluate(data=>{window.openai.toolInput={project:'field',assignment:'third'};window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolInput:window.openai.toolInput,toolOutput:data}}}));},next);
  assert.equal(await page.locator('#title').textContent(),'Third assignment');await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  assert.deepEqual((await calls(page)).at(-1).args,{project:'field',assignment:'third'});
 }finally{await browser.close();}
});

test('queued-only progress remains live, then follows claimed and completed evidence without queue metadata winning',async()=>{
 const queued={id:'task',goal:'Queued repair',state:'queued',primary_staff:'valentina',primary_team:'inspector'};
 const initial={project:'relay',generated_at:'2026-10-31T23:00:00Z',progress:[],queue:[queued]};
 const {browser,page}=await mount(initial);
 try{
  await page.evaluate(data=>window.next=data,initial);await page.clock.runFor(400);await page.waitForFunction(()=>window.calls.length===1&&!document.querySelector('#refresh').disabled);
  assert.equal(await page.locator('#title').textContent(),'Queued repair');assert.match(await page.locator('#card-freshness').textContent(),/Live updates/);
  const claimed={...progress('task','working','2026-10-31T23:01:00Z'),queue:[{...queued,state:'claimed'}]};claimed.progress[0].goal='Actually working';
  await page.evaluate(data=>window.next=data,claimed);await page.clock.runFor(30050);await page.locator('#title').filter({hasText:'Actually working'}).waitFor();assert.equal((await calls(page)).at(-1).args.assignment,'task');
  await page.evaluate(data=>window.next=data,progress('task','completed','2026-10-31T23:02:00Z'));await page.clock.runFor(30050);await page.locator('#card-freshness').filter({hasText:'Final recorded state'}).waitFor();const count=(await calls(page)).length;
  await page.clock.runFor(300000);assert.equal((await calls(page)).length,count);
 }finally{await browser.close();}
});

test('explicit explorer navigation stops the previous exact CI run even while lastData still contains ci',async()=>{
 const {browser,page}=await mount({...progress(),schema:'relay-status-explorer/v1'},{input:{project:'relay',assignment:'task'}});
 try{
  await page.clock.runFor(400);await page.waitForFunction(()=>window.calls.length===1);
  const data={ci:{schema:'relay-ci-card/v1',status:'running',telemetry:'reported',head_sha:'a'.repeat(40),live:true,tests:{},suites:[],jobs:{}}};
  await page.evaluate(data=>{window.next=data;window.openai.toolInput={repo:'relay',ref:'a'.repeat(40)};window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolInput:window.openai.toolInput,toolOutput:data}}}));},data);
  await page.clock.runFor(15050);await page.waitForFunction(()=>window.calls.some(c=>c.name==='relay_source_checks'));
  await page.getByRole('button',{name:'‹ Project',exact:true}).click();const count=(await calls(page)).filter(c=>c.name==='relay_source_checks').length;
  await page.clock.runFor(60000);assert.equal((await calls(page)).filter(c=>c.name==='relay_source_checks').length,count);assert.equal(await page.locator('#title').textContent(),'relay');assert.equal(await page.locator('#card-freshness').isVisible(),false);
 }finally{await browser.close();}
});


test('queued explorer hydration honors explicit assignment across queued, claimed and completed reads',async()=>{
 const queued={id:'task',goal:'Queued explorer repair',state:'queued',primary_staff:'valentina',primary_team:'inspector'};
 const initial={schema:'relay-status-explorer/v1',project:'relay',generated_at:'2026-10-31T23:00:00Z',progress:[],queue:[queued]};
 const {browser,page}=await mount(initial,{input:{project:'relay',assignment:'task'},waitStaff:false});
 try{
  assert.equal(await page.locator('#title').textContent(),'Queued explorer repair');
  assert.match(await page.locator('.status-navigation').textContent(),/Assignment/);
  await page.evaluate(data=>window.next=data,initial);await page.clock.runFor(400);await page.waitForFunction(()=>window.calls.length===1&&!document.querySelector('#refresh').disabled);
  assert.deepEqual((await calls(page))[0].args,{project:'relay',assignment:'task'});
  const claimed={...progress('task','working','2026-10-31T23:01:00Z'),queue:[{...queued,state:'claimed'}]};
  await page.evaluate(data=>window.next=data,claimed);await page.clock.runFor(30050);await page.waitForFunction(()=>window.calls.length===2&&!document.querySelector('#refresh').disabled);
  assert.equal(await page.locator('#title').textContent(),'Repair task');assert.match(await page.locator('.status-navigation').textContent(),/Assignment/);
  await page.evaluate(data=>window.next=data,progress('task','completed','2026-10-31T23:02:00Z'));await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  assert.match(await page.locator('#card-freshness').textContent(),/Final recorded state/);const count=(await calls(page)).length;await page.clock.runFor(90000);assert.equal((await calls(page)).length,count);
  assert.ok((await calls(page)).every(c=>c.args.assignment==='task'));
 }finally{await browser.close();}
});

test('new host assignment invalidates pending explorer project and overview replies, including errors',async()=>{
 for(const level of ['project','overview'])for(const failed of [false,true])for(const project of ['relay','field']){
  const {browser,page}=await mount({...progress(),schema:'relay-status-explorer/v1'},{input:{project:'relay',assignment:'task'},hold:true});
  try{
   // Navigate before the initial assignment timer fires, leaving exactly one explorer request held.
   await page.getByRole('button',{name:'‹ Project',exact:true}).click();
   await page.locator('#title').filter({hasText:/^relay$/}).waitFor();
   if(level==='overview')await page.getByRole('button',{name:'‹ Overall',exact:true}).click();
   else await page.locator('#refresh').click();
   await page.waitForFunction(()=>window.pending.length===1);
   const latest={...progress('new-task','blocked','2026-10-31T23:05:00Z'),project};
   await page.evaluate(data=>{window.openai.toolInput={project:data.project,assignment:'new-task'};window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolInput:window.openai.toolInput,toolOutput:data}}}));},latest);
   assert.equal(await page.locator('#title').textContent(),'Repair new-task');
   const old=failed?{ok:false,error:{class:'provider',message:'Old navigation failed'}}:level==='project'?progress():{projects:[{id:'relay',coordination:'enabled'}]};
   await page.evaluate(async data=>{window.pending.shift()(data);for(let i=0;i<20;i++)await Promise.resolve();},old);
   assert.equal(await page.locator('#title').textContent(),'Repair new-task',level+' late '+(failed?'error':'success')+' must not replace current host evidence');
   assert.equal(await page.locator('#blocker').isVisible(),false);
   await page.getByRole('button',{name:'‹ Project',exact:true}).click();
   assert.match(await page.locator('#rows').textContent(),/Repair new-task/);
   await page.getByRole('button',{name:/Repair new-task/}).click();
   await page.locator('#refresh').click();await page.waitForFunction(()=>window.pending.length===1);
   assert.deepEqual((await calls(page)).at(-1).args,{project,assignment:'new-task'});
   await page.evaluate(async data=>{window.pending.shift()(data);for(let i=0;i<20;i++)await Promise.resolve();},latest);
   await page.getByRole('button',{name:'‹ Project',exact:true}).click();
   assert.match(await page.locator('#rows').textContent(),/Repair new-task/);
  }finally{await browser.close();}
 }
});


test('changed host assignment is honored when the project snapshot bytes are unchanged',async()=>{
 const initial={...progress(),schema:'relay-status-explorer/v1',progress:[row('task'),row('other')]};
 const {browser,page}=await mount(initial,{input:{project:'relay',assignment:'task'},hold:true});
 try{
  await page.clock.runFor(400);await page.waitForFunction(()=>window.pending.length===1);
  await page.evaluate(data=>{window.openai.toolInput={project:'relay',assignment:'other'};window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolInput:window.openai.toolInput,toolOutput:data}}}));},initial);
  assert.equal(await page.locator('#title').textContent(),'Repair other');
  await page.evaluate(async data=>{window.pending.shift()(data);for(let i=0;i<20;i++)await Promise.resolve();},progress('task','failed','2026-10-31T23:01:00Z'));
  assert.equal(await page.locator('#title').textContent(),'Repair other');
  await page.locator('#refresh').click();await page.waitForFunction(()=>window.pending.length===1);assert.deepEqual((await calls(page)).at(-1).args,{project:'relay',assignment:'other'});
 }finally{await browser.close();}
});

test('typed refresh failures preserve evidence and checked clock without leaking raw errors',async()=>{
 const {browser,page}=await mount(progress());
 try{
  await page.clock.runFor(400);await page.locator('#title').filter({hasText:'Fresh task'}).waitFor();const checked=(await page.locator('#card-freshness').textContent()).match(/Checked .*$/)[0];
  for(const [reply,code]of [[{ok:false,error:{message:'PRIVATE token diagnostic'}},'provider_error'],[{project:'other',progress:[]},'wrong_target'],[{project:'relay',progress:[]},'missing_target'],[progress('task','failed','2026-10-30T01:00:00Z'),'stale_response']]){
   await page.evaluate(x=>window.next=x,reply);await page.locator('#refresh').click();await page.locator('#refresh').filter({hasText:'Try refresh again'}).waitFor();
   assert.equal(await page.locator('#title').textContent(),'Fresh task');assert.ok((await page.locator('#card-freshness').textContent()).endsWith(checked));
   const diag=await page.locator('#card-refresh-diagnostics').textContent();assert.ok(diag.includes(code));assert.ok(!diag.includes('PRIVATE'));assert.equal(await page.locator('#details').evaluate(x=>x.open),false);
  }
 }finally{await browser.close();}
});
test('native timeout preserves last evidence, ignores its late answer, and never dispatches through MCP',async()=>{
 const {browser,page}=await mount(progress(),{hold:true});
 try{
  await page.evaluate(()=>{window.mcpReads=0;const post=window.postMessage.bind(window);window.postMessage=(msg,...rest)=>{if(msg.method==='tools/call')window.mcpReads++;return post(msg,...rest)};});
  await page.clock.runFor(400);await page.waitForFunction(()=>window.pending.length===1);await page.clock.runFor(12010);
  await page.locator('#refresh').filter({hasText:'Try refresh again'}).waitFor();assert.match(await page.locator('#card-freshness').textContent(),/update took too long/);
  assert.equal(await page.evaluate(()=>window.mcpReads),0);assert.equal((await calls(page)).length,1);
  await page.evaluate(data=>window.pending.shift()(data),progress('task','failed','2026-10-31T23:05:00Z'));assert.equal(await page.locator('#title').textContent(),'Repair task');
  await page.evaluate(()=>window.hold=false);await page.locator('#refresh').click();await page.locator('#title').filter({hasText:'Fresh task'}).waitFor();assert.equal(await page.locator('#card-refresh-diagnostics').isVisible(),false);
 }finally{await browser.close();}
});
