import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {contextCardModel,relayContextCardResource} from './relay-chat-ui.js';
import {appendCardUpdates,assignmentCardUpdates} from './relay-card-updates.js';
import {assignmentCardContext,validateCardStepsPublication} from './relay-card-steps.js';
import {storeEvidence} from './evidence.js';
import {getVisualEvidence} from '../packages/runner/src/visual-evidence.mjs';
const revision='a'.repeat(64),source='b'.repeat(40),now=new Date('2026-11-01T00:00:00Z');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlQZQAAAABJRU5ErkJggg==';
function fixture(count=3,{id='card-demo',artifact=null}={}){
 let record={id,owner:'fixture-host',branch:'relay/fixture',state:'active',goal:'A clearer overlay, built together',primary_staff:'julian',primary_team:'night-shift',supporting_staff:['valentina','nico','roman'],supporting_teams:['inspector','runner'],lease_until:'2026-11-02T00:00:00Z'};
 const people=['valentina','nico','roman','julian'],teams=['inspector','runner','inspector','night-shift'];
 for(let i=0;i<count;i++){
  const pub={schema:'relay-card-steps/v1',assignment:id,revision,objective_digest:revision,publisher:{owner:record.owner,branch:record.branch},sequence:i+1,complete:false,steps:[{id:'stage-'+i,label:['Design the overlay','Build the change','Review the result','Coordinate the next step'][i],depends_on:[],state:i===2?'blocked':'running',receipt:{id:'event-'+i,assignment:id,step_id:'stage-'+i,plan_revision:revision,input_digest:revision,evidence:'sha256:'+revision,source_sha:source,observed_at:now.toISOString(),owner:{staff:people[i],team:teams[i]},update:{text:['The spacing and hierarchy are ready for review.','The interaction is implemented. Verification is next.','One keyboard issue needs attention before acceptance.','The next priorities are recorded.'][i],artifacts:i===0&&artifact?[artifact]:[]}}}]};
  pub.steps.unshift(...(record.card_steps?.steps||[]));
  const validated=validateCardStepsPublication(pub,record,revision,now);record={...record,card_updates:appendCardUpdates(record,validated,now),card_steps:validated};
 }
 return {project:'relay',claim:assignmentCardContext(record)};
}
async function mount(data,{width=760,media='valid',hold=false}={}){
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
 await page.clock.install({time:now});await page.clock.pauseAt(new Date(+now+1));
 await page.addInitScript(({data,media,hold,png,source})=>{
  window.calls=[];window.pendingMedia=[];
  window.openai={toolInput:{project:'relay'},toolOutput:data,callTool:async(name,args)=>{
   window.calls.push({name,args});if(name!=='relay_ui_request')return {project:'relay',claims:[data.claim]};
   const value=args.path.endsWith('/image')?{status:200,content_type:'image/png',base64:media==='bad-image'?'not base64':png}:{status:200,body:{evidence_id:args.path.split('/').at(-1),context:{project:'relay',assignment:media==='wrong'?'other':data.claim.id,commit_sha:source}}};
   if(hold)return new Promise(resolve=>window.pendingMedia.push(()=>resolve(value)));return value;
  }};
 },{data,media,hold,png,source});
 await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));await page.locator('#card').waitFor();
 if(data.claim?.card_updates?.items.length)await page.locator('.family-update').first().waitFor();
 return {browser,page};
}
const artifact={evidence_id:'vis_abcdefgh',source_sha:source,caption:'Recorded overlay preview',kind:'design'};

test('Inspector capture producer preserves exact binding through receipt publication and public model',async()=>{
 const objects=new Map(),bucket={put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{json:async()=>JSON.parse(objects.get(k))}:null};
 const meta=await storeEvidence(bucket,{requestId:'card-fixture',targetUrl:'https://relay.loew.fi',kind:'screenshot',screenshotBytes:Buffer.from(png,'base64'),context:{project:'relay',assignment:'card-demo',commit_sha:source,environment:'preview'},viewport:{width:760,height:900}});
 const stored=await getVisualEvidence(bucket,meta.evidence_id);assert.equal(stored.context.assignment,'card-demo');assert.equal(stored.context.commit_sha,source);
 const data=fixture(1,{artifact:{...artifact,evidence_id:meta.evidence_id}}),m=contextCardModel(data);assert.equal(m.updates[0].artifacts[0].evidence_id,stored.evidence_id);assert.equal(m.updates[0].assignment,stored.context.assignment);assert.equal(m.updates[0].source_sha,stored.context.commit_sha);
});
test('no-plan failure and product messages do not invent a crew, plan or progress',()=>{
 for(const data of [{ok:false,error:{message:'The worker stopped.'}},{project:'relay',claim:{id:'failed',primary_staff:'nico',state:'failed',goal:'Repair the build'}}]){const m=contextCardModel(data);assert.equal(m.updates.length,0);assert.equal(m.plan.steps.length,0);assert.notEqual(m.family,'assignment');}
 assert.equal(contextCardModel({ok:true}).family,'product');assert.equal(contextCardModel(fixture(1)).family,'single');assert.equal(contextCardModel(fixture(3)).family,'assignment');
});
test('desktop/mobile family fits, uses actual attributed people and surfaced keyboard carousel',async()=>{
 for(const width of [760,360]){const {browser,page}=await mount(fixture(),{width});try{
  assert.equal(await page.locator('.family-brand').evaluate(n=>getComputedStyle(n).color),'rgb(181, 71, 31)','Relay product brand does not inherit the current staff/status accent');
  assert.equal(await page.locator('.family-message').first().evaluate(n=>getComputedStyle(n).fontSize),'16px');assert.equal(await page.locator('.family-relation').count(),0);assert.equal(await page.locator('.family-step').count(),0);
  assert.equal(await page.locator('.family-update').count(),3);assert.deepEqual(await page.locator('.family-name').allTextContents(),['Valentina','Nico','Roman']);
  assert.equal(await page.locator('.family-media-note').first().textContent(),'No visual is attached to this update.');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const summary of await page.locator('#card summary').all()){assert.equal(await summary.locator('svg').count(),1);assert.equal(await summary.evaluate(n=>getComputedStyle(n).listStyleType),'none');}
  const railColors=await page.locator('.step-list>li').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n,'::before').backgroundColor));assert.notEqual(railColors[0],railColors[2],'running and blocked retain distinct semantic rails');
  if(width<520){for(const copy of await page.locator('.step-copy').all()){const bounds=await copy.boundingBox();assert.ok(bounds.width>=180,'phone priority text has readable full-row width');}}
  const detail=page.locator('.family-update-details').first();await detail.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await detail.getAttribute('open'),'');await page.evaluate(data=>render(data),fixture());assert.equal(await detail.getAttribute('open'),'');assert.equal(await detail.locator('summary').evaluate(n=>document.activeElement===n),true);await page.keyboard.press('Enter');
  const track=page.locator('.family-track');await track.focus();await page.keyboard.press('ArrowRight');await page.clock.runFor(50);assert.ok(await track.evaluate(n=>n.scrollLeft)>0);
  for(const b of await page.locator('.family-nav').all()){const box=await b.boundingBox();assert.ok(box.width>=44&&box.height>=44);assert.equal(await b.locator('svg').count(),1);}
  assert.equal(await page.locator('.family-brand img').evaluate(n=>getComputedStyle(n).animationName),'none');
 }finally{await browser.close();}}
});
test('unchanged live refresh retains carousel DOM, selected position and focused control',async()=>{
 const {browser,page}=await mount(fixture());try{
  const next=page.getByRole('button',{name:'Next updates',exact:true});await next.focus();await next.click();await page.clock.runFor(50);
  const focused=page.getByRole('button',{name:'Previous updates',exact:true});await focused.focus();
  const position=await page.locator('.family-track').evaluate(n=>{window.originalTrack=n;return n.scrollLeft});
  await page.evaluate(data=>render({...data,generated_at:'2026-11-01T00:01:00Z'}),fixture());
  assert.equal(await page.locator('.family-track').evaluate(n=>n===window.originalTrack),true);assert.equal(await page.locator('.family-track').evaluate(n=>n.scrollLeft),position);assert.equal(await focused.evaluate(n=>document.activeElement===n),true);
 }finally{await browser.close();}
});
test('matched real metadata loads inline thumbnail and native dialog restores focus',async()=>{
 const {browser,page}=await mount(fixture(1,{artifact}));try{
  const button=page.getByRole('button',{name:'Expand Recorded overlay preview'});await button.waitFor();await button.click();assert.equal(await page.locator('dialog').evaluate(n=>n.open),true);await page.keyboard.press('Escape');assert.equal(await button.evaluate(n=>document.activeElement===n),true);
  assert.deepEqual((await page.evaluate(()=>window.calls)).filter(x=>x.name==='relay_ui_request').map(x=>x.args.path),['/api/visual/vis_abcdefgh','/api/visual/vis_abcdefgh/image']);
 }finally{await browser.close();}
});
test('wrong-assignment metadata rejects image before fetch and retarget discards held thumbnails',async()=>{
 const wrong=await mount(fixture(1,{artifact}),{media:'wrong'});try{await wrong.page.locator('.family-media-note').filter({hasText:'does not match'}).waitFor();assert.equal(await wrong.page.locator('.family-capture').count(),0);assert.equal((await wrong.page.evaluate(()=>window.calls)).filter(x=>x.args.path?.endsWith('/image')).length,0);}finally{await wrong.browser.close();}
 const held=await mount(fixture(1,{artifact}),{hold:true});try{await held.page.waitForFunction(()=>window.pendingMedia.length===1);await held.page.evaluate(data=>render(data),fixture(1,{id:'other'}));await held.page.evaluate(()=>window.pendingMedia.shift()());await held.page.clock.runFor(50);assert.equal(await held.page.locator('.family-capture').count(),0);assert.equal((await held.page.evaluate(()=>window.calls)).filter(x=>x.args.path?.endsWith('/image')).length,0);}finally{await held.browser.close();}
});
test('ordinary failure and no-plan cards keep details collapsed and omit empty crew containers',async()=>{
 for(const data of [{ok:true},{project:'relay',claim:{id:'failed',primary_staff:'nico',primary_team:'runner',state:'failed',goal:'Repair the failed build',next_action:'Inspect the failed check.'}}]){const {browser,page}=await mount(data);try{assert.equal(await page.locator('#family-crew').isVisible(),false);assert.equal(await page.locator('#plan-panel').isVisible(),false);assert.equal(await page.locator('#details').evaluate(n=>n.open),false);assert.ok((await page.locator('#card').boundingBox()).height<850);}finally{await browser.close();}}
});

 test('partial explicit assignment retains labeled lead without inventing an authored update; generic staff fields stay product-only',()=>{
 const m=contextCardModel({project:'relay',claim:{primary_staff:'julian',goal:'Coordinate review',state:'active'}});
 assert.equal(m.family,'assignment-status');assert.equal(m.identity.lead.id,'julian');assert.equal(m.identity.relationship,'Assignment lead');assert.equal(m.identity.current_owner,null);assert.deepEqual(m.updates,[]);
 const generic=contextCardModel({project:'relay',primary_staff:'julian',human:{staff:'Julian'}});assert.equal(generic.family,'product');assert.equal(generic.identity.lead,null);assert.deepEqual(generic.updates,[]);
 });

test('pending metadata and images survive same-assignment appends but never revive removed or retargeted updates',async()=>{
 for(const phase of ['metadata','image'])for(const action of ['append','remove','retarget']){
  const {browser,page}=await mount(fixture(1,{artifact}),{hold:true});try{
   await page.waitForFunction(()=>window.pendingMedia.length===1);
   if(phase==='image'){await page.evaluate(()=>window.pendingMedia.shift()());await page.waitForFunction(()=>window.pendingMedia.length===1);}
   await page.evaluate(data=>render(data),action==='append'?fixture(2,{artifact}):action==='remove'?fixture(0):fixture(1,{id:'another-assignment'}));
   await page.evaluate(()=>window.pendingMedia.shift()());
   if(action==='append'){
    if(phase==='metadata'){await page.waitForFunction(()=>window.pendingMedia.length===1);await page.evaluate(()=>window.pendingMedia.shift()());}
    await page.locator('.family-capture').waitFor();assert.equal(await page.locator('.family-capture').count(),1);assert.equal(await page.locator('.family-update').count(),2);
   }else{await page.clock.runFor(50);assert.equal(await page.locator('.family-capture').count(),0);assert.equal(await page.locator('.family-media-note').filter({hasText:'Loading'}).count(),0);}
  }finally{await browser.close();}
 }
 const bad=await mount(fixture(1,{artifact}),{media:'bad-image'});try{await bad.page.locator('.family-media-note').filter({hasText:'unavailable'}).waitFor();assert.equal(await bad.page.locator('.family-capture').count(),0);}finally{await bad.browser.close();}
});
