import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {contextCardModel,relayContextCardResource,contextualPresentation} from './relay-chat-ui.js';
import {appendCardUpdates,assignmentCardUpdates} from './relay-card-updates.js';
import {assignmentCardContext,validateCardStepsPublication} from './relay-card-steps.js';
import {storeEvidence} from './evidence.js';
import {getVisualEvidence} from '../packages/runner/src/visual-evidence.mjs';
import {STAFF} from './staff-registry.js';
import {cardStaff} from './relay-card-identity.js';
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
function individual(data){return {...data,presentation_view:'individual',presentation_update_id:data.claim.card_updates.items[0].id};}
async function mount(data,{width=760,media='valid',hold=false,sourceSha=source,imageBytes=png,theme='light',expand=true,saved=null}={}){
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width,height:1100},colorScheme:theme,reducedMotion:'reduce'});
 await page.clock.install({time:now});await page.clock.pauseAt(new Date(+now+1));
 await page.addInitScript(({data,media,hold,png,source,saved})=>{
  window.calls=[];window.pendingMedia=[];
  window.openai={widgetState:saved||{},setWidgetState(state){this.widgetState=state},toolInput:{project:'relay'},toolOutput:data,callTool:async(name,args)=>{
   window.calls.push({name,args});if(name!=='relay_ui_request')return {project:'relay',claims:[data.claim]};
   const value=args.path.endsWith('/image')?{status:200,content_type:'image/png',base64:media==='bad-image'?'not base64':png}:{status:200,body:{evidence_id:args.path.split('/').at(-1),context:{project:'relay',assignment:media==='wrong'?'other':data.claim.id,commit_sha:source}}};
   if(hold)return new Promise(resolve=>window.pendingMedia.push(()=>resolve(value)));return value;
  }};
 },{data,media,hold,png:imageBytes,source:sourceSha,saved});
 await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));await page.locator('#card').waitFor();
 if(expand&&data.claim?.card_updates?.items.length){await page.locator('#banner-content').evaluate(n=>n.open=true);await page.locator('.family-update').first().waitFor();}
 return {browser,page};
}
const artifact={evidence_id:'vis_abcdefgh',source_sha:source,caption:'Recorded overlay preview',kind:'design'};

test('ordinary zero one and many update responses mount shallow frozen banners with a separate current view',async()=>{
 for(const count of [0,1,3])for(const width of [360,760]){
  const data=contextualPresentation({...fixture(count),checked_at:now.toISOString()},{operation:{name:'relay_runner_coordinate',kind:'command'}});
  const {browser,page}=await mount(data,{width,expand:false});try{
   await page.locator('#card[data-card-mode=snapshot]').waitFor();
   assert.equal(await page.locator('#card').getAttribute('data-snapshot-id'),data.snapshot.id);
   const box=await page.locator('#card').boundingBox();assert.ok(box.height<=(width>=620?box.width*.75:360)+1,JSON.stringify({count,width,box}));
   const title=await page.locator('#title').boundingBox(),lead=await page.locator('#family-assignment-lead').boundingBox();assert.ok(lead.y>=title.y+title.height);
   assert.equal(await page.locator('#refresh').isVisible(),false);
   assert.equal(await page.locator('#assignment-ring').getAttribute('aria-valuenow'),null);
   await page.clock.runFor(50);const original=await page.locator('#card').textContent();
   await page.evaluate(data=>{window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{toolOutput:data}}}));render(data);document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'))},{project:'relay',claim:{id:'card-demo',goal:'LATER PRIVATE CHANGE',state:'completed'}});
   await page.clock.fastForward(420000);assert.equal(await page.locator('#card').textContent(),original);assert.equal(await page.evaluate(()=>window.calls.length),0);
   await page.getByRole('button',{name:'Open latest',exact:true}).click();await page.getByRole('dialog',{name:'Current assignment status'}).waitFor();await page.getByRole('button',{name:'Close latest'}).click();assert.equal(await page.locator('#card').textContent(),original);
   await page.getByLabel('Card options',{exact:true}).click();await page.getByRole('button',{name:'Technical evidence',exact:true}).focus();await page.keyboard.press('Escape');assert.equal(await page.getByLabel('Card options',{exact:true}).evaluate(n=>n===document.activeElement),true);
   if(count){await page.locator('#banner-content').evaluate(n=>n.open=true);assert.equal(await page.locator('.family-update').count(),count);}
  }finally{await browser.close();}
 }
});

const leadFixture=id=>({project:'relay',claim:{id:'lead-badge',state:'active',goal:'Build the project interface',primary_staff:id,primary_team:'source'}});
test('frozen remount preserves the original snapshot and rejects altered payloads without polling',async()=>{
 const original=contextualPresentation({...fixture(1),checked_at:now.toISOString()},{operation:{name:'relay_runner_coordinate'}});
 const first=await mount(original,{expand:false});let saved;try{saved=await first.page.evaluate(()=>window.openai.widgetState);assert.equal(saved.relay_snapshot.id,original.snapshot.id);}finally{await first.browser.close();}
 const newer=contextualPresentation({...fixture(3),checked_at:'2026-11-01T00:06:00Z'},{operation:{name:'relay_runner_coordinate'}});
 const remount=await mount(newer,{saved,expand:false});try{assert.equal(await remount.page.locator('#card').getAttribute('data-snapshot-id'),original.snapshot.id);assert.equal(await remount.page.locator('.family-update').count(),1);await remount.page.clock.runFor(450000);assert.equal(await remount.page.evaluate(()=>window.calls.length),0);}finally{await remount.browser.close();}
 const altered=structuredClone(original);altered.snapshot.payload.claim.goal='Altered history';const bad=await mount(altered,{expand:false});try{assert.equal(await bad.page.locator('#card-freshness').textContent(),'Snapshot unavailable');await bad.page.clock.runFor(450000);assert.equal(await bad.page.evaluate(()=>window.calls.length),0);}finally{await bad.browser.close();}
});
test('checklist circle counts verified passes only and waits for full objective confirmation before 100',()=>{
 const data=fixture(3);data.claim.card_steps.complete=true;data.claim.card_steps.steps.forEach(s=>s.state='passed');
 assert.equal(contextCardModel(data).percent,null,'checklist passes alone are not whole-objective completion');data.claim.state='completed';assert.equal(contextCardModel(data).percent,100);
 data.claim.card_steps.steps[2].state='blocked';assert.equal(contextCardModel(data).percent,66);data.claim.card_steps.steps[1].receipt=null;assert.equal(contextCardModel(data).percent,33);data.claim.card_steps.complete=false;assert.equal(contextCardModel(data).percent,null);
});
test('assignment header badge renders every canonical staff identity without claiming a contributor message',async()=>{
 const {browser,page}=await mount(leadFixture('nico'));
 try{for(const staff of STAFF.filter(s=>cardStaff(s.id))){
  const data=leadFixture(staff.id),person=contextCardModel(data).identity.lead;
  await page.evaluate(data=>render(data),data);
  const lead=page.getByRole('group',{name:'Assigned lead',exact:true});
  assert.equal(await lead.getAttribute('data-staff'),person.id);assert.equal(await lead.getAttribute('data-org'),person.display_team||'');
  assert.equal(await lead.locator('.family-lead-name').textContent(),person.name);
  assert.equal((await lead.locator('.family-lead-team').textContent()).trim(),person.display_team_label||person.team);
  assert.equal(await lead.locator('.family-lead-team svg').count(),2);
  assert.equal(await lead.locator('.family-lead-role').textContent(),'Assigned lead · '+person.role);
  assert.equal(await lead.locator('img').getAttribute('alt'),'');assert.equal(await lead.locator('img').evaluate(async img=>{await img.decode();return img.naturalWidth>0}),true);
  assert.equal(await lead.evaluate(n=>n.parentElement.classList.contains('family-assignment-header')),true);
  assert.equal(await page.locator('#feature-title').textContent(),contextCardModel(data).project_label||'relay');assert.equal(await page.locator('#title').textContent(),'Build the project interface');
  assert.equal(await page.locator('.family-update').count(),0);
 }}finally{await browser.close();}
});

test('lead badge uses an honest initial fallback for failed and missing approved portraits and clears absent leads',async()=>{
 const {browser,page}=await mount(leadFixture('nico'));try{
  const portrait=page.locator('.family-lead-portrait');await portrait.locator('img').evaluate(img=>img.dispatchEvent(new Event('error')));
  assert.equal(await portrait.getAttribute('data-state'),'unavailable');assert.equal(await portrait.locator('img').count(),0);assert.equal(await portrait.textContent(),'N');
  await page.evaluate(data=>render(data),leadFixture('nico'));assert.equal(await portrait.locator('img').count(),0);
  await page.evaluate(data=>{delete STAFF_PORTRAITS.julian;render(data)},leadFixture('julian'));
  assert.equal(await portrait.getAttribute('data-state'),'unavailable');assert.equal(await portrait.textContent(),'J');assert.equal(await portrait.locator('img').count(),0);
  for(const id of [null,'unrecorded-person']){await page.evaluate(data=>render(data),leadFixture(id));assert.equal(await page.getByRole('group',{name:'Assigned lead',exact:true}).count(),0);assert.equal(await page.locator('#family-assignment-lead').textContent(),'No assignment lead is recorded.');assert.equal(await page.locator('.family-lead-portrait').count(),0);}
 }finally{await browser.close();}
});

test('lead badge retains canonical identity when assignment team and current contributor differ',async()=>{
 const data=fixture(3);data.claim.primary_team='source';const m=contextCardModel(data);assert.equal(m.identity.lead.id,'julian');assert.equal(m.identity.current_owner.id,'valentina');
 const {browser,page}=await mount(data);try{
  const lead=page.getByRole('group',{name:'Assigned lead',exact:true});assert.equal(await lead.getAttribute('data-staff'),'julian');assert.equal(await lead.getAttribute('data-org'),'management-planning');assert.equal((await lead.locator('.family-lead-team').textContent()).trim(),'Management & Planning');
  assert.equal(await page.locator('.family-update .family-name').last().textContent(),'Roman');assert.equal(await page.locator('#feature-title').textContent(),m.project_label||'relay');assert.equal(await page.locator('#feature-mark').getAttribute('data-staff'),'');
 }finally{await browser.close();}
});

test('lead badge stays readable and contained at phone and desktop widths in both themes',async()=>{
 const {browser,page}=await mount(leadFixture('nico'));try{
  for(const width of [360,760])for(const theme of ['light','dark'])for(const id of ['nico','valentina','roman','julian','luca','imani']){
   await page.setViewportSize({width,height:1100});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await page.evaluate(data=>render(data),leadFixture(id));
   const geometry=await page.locator('.family-lead').evaluate(n=>{const name=n.querySelector('.family-lead-name'),r=n.getBoundingClientRect(),h=document.querySelector('#title');return {left:r.left,right:r.right,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,nameFont:getComputedStyle(name).fontFamily,nameWeight:getComputedStyle(name).fontWeight,nameSize:parseFloat(getComputedStyle(name).fontSize),titleSize:parseFloat(getComputedStyle(h).fontSize),color:getComputedStyle(name).color,roleColor:getComputedStyle(n.querySelector('.family-lead-role')).color,bg:getComputedStyle(n).backgroundColor,iconVisible:[...n.querySelectorAll('.family-lead-team>span')].filter(e=>getComputedStyle(e).display!=='none').length}});
   assert.equal(geometry.overflow,false);assert.ok(geometry.left>=0&&geometry.right<=geometry.width);assert.match(geometry.nameFont,/Momo/);assert.equal(geometry.nameWeight,'700');assert.ok(geometry.titleSize>geometry.nameSize);assert.equal(geometry.iconVisible,1);
   const contrast=(a,b)=>{const luminance=x=>{const c=x.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
   assert.ok(contrast(geometry.color,geometry.bg)>=4.5,id+' '+theme+' name contrast');assert.ok(contrast(geometry.roleColor,geometry.bg)>=4.5,id+' '+theme+' role contrast');
  }
 }finally{await browser.close();}
});

test('lead badge introduces no keyboard stop and follows assignment, individual and product transitions',async()=>{
 const data=fixture(3),{browser,page}=await mount(data);try{
  await page.getByRole('button',{name:'Next updates',exact:true}).focus();
  const changed=structuredClone(data);changed.claim.primary_staff='nico';await page.evaluate(data=>render(data),changed);
  assert.equal(await page.getByRole('button',{name:'Next updates',exact:true}).evaluate(n=>n===document.activeElement),true);assert.equal(await page.locator('.family-lead button,.family-lead a,.family-lead [tabindex]').count(),0);
  await page.evaluate(data=>render(data),individual(data));await page.clock.runFor(50);assert.equal(await page.locator('#family-assignment-lead').isHidden(),true);assert.equal(await page.locator('.family-update-details summary').first().evaluate(n=>n===document.activeElement),true);
  await page.evaluate(()=>render({ok:true}));assert.equal(await page.locator('#family-assignment-lead').isHidden(),true);
  await page.evaluate(data=>render(data),changed);assert.equal(await page.locator('#family-assignment-lead').isVisible(),true);assert.equal(await page.locator('.family-lead-name').textContent(),'Nico');assert.equal(await page.locator('#feature-title').textContent(),contextCardModel(changed).project_label||'relay');
 }finally{await browser.close();}
});

// The ordinary command boundary: real CAS handler and publication validation,
// rather than placing card_updates directly in a browser fixture.
async function ordinaryCommands(){
 const {callRunnerControl,RUNNER_ENGINE_SHA}=await import('./runner-control.js');
 const {PROJECT_AUTHOR}=await import('./commit-attribution.js');
 const {withCardProjectIcon}=await import('./relay-project-icon.js');
 const {readFile}=await import('node:fs/promises');
 const assets=new Map();for(const path of ['apps/web/public/relay.assets.json','icons/relay-icon.png']){const bytes=await readFile(new URL('../'+path,import.meta.url)),sha=(await import('node:crypto')).createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');assets.set(sha,{bytes,path});}
 const {createHash}=await import('node:crypto');
 let evidenceBucket;
 let record={schema:1,project:'relay',claims:[],queue:[],legacy_branches:[]},revision='a'.repeat(40),parent=revision,message;
 const file=(content,sha=revision)=>({type:'file',sha,encoding:'base64',content:Buffer.from(typeof content==='string'?content:JSON.stringify(content)).toString('base64')});
 const api=async(path,request)=>{
  if(path.includes('/git/trees/'))return {truncated:false,tree:[...assets].map(([sha,a])=>({sha,path:a.path,size:a.bytes.length,type:'blob'}))};
  if(path.includes('/git/blobs/')){const a=assets.get(path.split('/').at(-1));return {encoding:'base64',content:a.bytes.toString('base64')};}
  if(path.includes('src/coordination.mjs'))return file('',RUNNER_ENGINE_SHA);
  if(path.includes('projects/relay.json'))return file({id:'relay',repository:'lrnolivia/relay',managed:true,default_branch:'main',implementation:{branch_prefixes:['relay/'],excluded_branches:['main']},coordination:{record:'coordination/relay.json',status:'enabled',max_active_branches:4,lease_hours:12}});
  if(path.includes('coordination/relay.json?ref='+'d'.repeat(40)))return file({},parent);
  if(path.includes('coordination/relay.json')){
   if(request?.method==='PUT'){assert.equal(request.body.sha,revision);parent=revision;message=request.body.message;record=JSON.parse(Buffer.from(request.body.content,'base64'));revision=createHash('sha1').update(JSON.stringify(record)).digest('hex');return {commit:{sha:'c'.repeat(40)}};}
   return file(message?JSON.stringify(record,null,2)+'\n':record);
  }
  if(path.endsWith('/commits/'+'c'.repeat(40)))return {sha:'c'.repeat(40),author:PROJECT_AUTHOR,committer:PROJECT_AUTHOR,commit:{author:PROJECT_AUTHOR,committer:PROJECT_AUTHOR,message},parents:[{sha:'d'.repeat(40)}]};
  if(path.includes('/branches?'))return record.claims.length?[{name:'relay/ordinary',commit:{sha:source}}]:[];
  if(path.includes('/git/ref/heads/'))return {object:{sha:source}};
  if(path.includes('/pulls?'))return [];
  throw Error('Unexpected ordinary command API '+path);
 };
 return {get claim(){return record.claims[0]},set evidence(bucket){evidenceBucket=bucket},command:async(action,request)=>{
  const output=await callRunnerControl('relay_runner_coordinate',{project:'relay',action,request,expected_record_sha:revision},{EVIDENCE:evidenceBucket},api);
  return contextualPresentation(await withCardProjectIcon('relay_runner_coordinate',output,{},api),{operation:{name:'relay_runner_coordinate',kind:'command'}});
 }};
}

test('ordinary coordinate command mounts project shell at zero, one and many updates and carries submitted design evidence',async()=>{
 const {continuityCardProjection}=await import('../scripts/relay-continuity.mjs');
 const {createHash}=await import('node:crypto'),{mkdir,writeFile,readFile}=await import('node:fs/promises');
 const f=await ordinaryCommands();
 let data=await f.command('claim',{id:'ordinary',owner:'fixture-host',branch:'relay/ordinary',paths:['src/'],resources:[],goal:'Overlay design submission',acceptance:'Review the actual preview',next_action:'Prepare the design',category:'design',primary_role:'art-director',supporting_roles:['verifier']});
 const plan={schema:1,authorization:'Fixture test only',objective_digest:createHash('sha256').update(JSON.stringify({goal:f.claim.goal,acceptance:f.claim.acceptance})).digest('hex'),environment:{fixture:true},criteria:['preview'],stages:[{id:'design',kind:'implementation',criteria:['preview'],depends_on:[],prompt:'PRIVATE DESIGN PROMPT',inputs:['src/'],verify:['verify-design']}]};
 const journal={schema:1,plan_digest:createHash('sha256').update(JSON.stringify(plan)).digest('hex'),private_result:'PRIVATE RESULT',stages:{}};
 const imageBrowser=await chromium.launch();let preview;
 try{const page=await imageBrowser.newPage({viewport:{width:640,height:360}});await page.setContent('<style>body{background:#272826;color:#eee;font:20px system-ui;padding:32px}h1{color:#d98c68}</style><small>RENDERED TEST DESIGN</small><h1>Overlay controls</h1><p>Source-bound submission preview</p><button>Open settings</button>');preview=await page.screenshot();}finally{await imageBrowser.close();}
 const objects=new Map(),bucket={put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{json:async()=>JSON.parse(objects.get(k))}:null};
 const meta=await storeEvidence(bucket,{requestId:'ordinary-design',targetUrl:'https://relay.loew.fi',kind:'screenshot',screenshotBytes:preview,context:{project:'relay',assignment:'ordinary',commit_sha:source,environment:'preview'},viewport:{width:640,height:360}});
 f.evidence=bucket;
 const captures=[];
 const inspect=async(name,expected)=>{for(const [width,theme] of [[760,'light'],[760,'dark'],[360,'light'],[360,'dark']]){
  const {browser,page}=await mount(data,{width,theme,imageBytes:preview.toString('base64')});try{
   assert.equal(await page.locator('#card').getAttribute('data-family'),'assignment');assert.equal(await page.locator('#feature-title').textContent(),'relay');assert.equal(await page.locator('#card-project img').count(),1);assert.equal(await page.locator('.family-update').count(),expected);
   assert.equal(await page.locator('#feature-mark [data-staff]').count(),0);assert.equal(await page.locator('#card').evaluate(n=>n.scrollWidth>innerWidth),false);
   const assignedLead=contextCardModel(data).identity.lead,lead=page.getByRole('group',{name:'Assigned lead',exact:true});assert.equal(await lead.getAttribute('data-staff'),assignedLead.id);assert.equal(await lead.locator('.family-lead-name').textContent(),assignedLead.name);assert.ok((await lead.locator('.family-lead-role').textContent()).includes(assignedLead.role));
   assert.equal((await page.locator('#card').textContent()).includes('PRIVATE'),false);
   if(!expected){assert.equal(await page.locator('.family-empty').count(),0);assert.match(await page.locator('#family-plan-empty').textContent(),/Plan pending/);assert.equal(await page.locator('#family-plan-empty').isVisible(),true);assert.equal(await page.locator('.family-avatar').count(),0);}
   if(name==='submitted'){await page.locator('.family-capture img').waitFor();assert.equal(await page.locator('.family-name').first().textContent(),'Valentina');assert.equal(await page.locator('#plan-panel').isVisible(),true);}
   if(name==='unavailable')assert.match(await page.locator('.family-media-note').allTextContents().then(x=>x.join(' ')),/Design preview unavailable: Rendering service unavailable at submission/);
   if(process.env.EXPECTED_SOURCE_SHA){if(width===360&&['submitted','unavailable'].includes(name)){const track=page.locator('.family-track');await track.evaluate(n=>n.scrollLeft=n.scrollWidth);await page.clock.runFor(50);}await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});const bytes=await page.locator('#card').screenshot(),path='qa-evidence/context-cards/ordinary-'+name+'-'+width+'-'+theme+'.png';await mkdir('qa-evidence/context-cards',{recursive:true});await writeFile(path,bytes);captures.push({path,width,theme,source_sha:process.env.EXPECTED_SOURCE_SHA,resource:relayContextCardResource().uri,resource_sha256:createHash('sha256').update(relayContextCardResource().text).digest('hex'),sha256:createHash('sha256').update(bytes).digest('hex'),fixture:'canonical-coordinate-to-DOM; native host unverified'});}
  }finally{await browser.close();}
 }};
 await inspect('no-updates',0);
 const publish=async(state,update)=>{journal.stages.design={state:'dispatching',observation:{state,owner:{staff:'valentina',team:'inspector'},source_sha:source,observed_at:new Date().toISOString(),input_digest:'c'.repeat(64),evidence:'sha256:'+'d'.repeat(64),update}};data=await f.command('amend',{id:f.claim.id,owner:f.claim.owner,reason:'Publish explicitly authored design observation',card_steps:continuityCardProjection({plan,journal,assignment:f.claim})});};
 await publish('running',{text:'Design work has started.',artifacts:[],preview:{state:'pending'}});await inspect('one-update',1);
 await publish('blocked',{text:'The design is submitted for review.',artifacts:[{evidence_id:meta.evidence_id,source_sha:source,caption:'Rendered test design submission',kind:'design'}],preview:{state:'attached'}});await inspect('submitted',2);
 await publish('blocked',{text:'A later design submission has no rendered sample.',artifacts:[],preview:{state:'unavailable',reason:'Rendering service unavailable at submission'}});await inspect('unavailable',3);
 if(captures.length)await writeFile('qa-evidence/context-cards/ordinary-receipt.json',JSON.stringify({source_sha:process.env.EXPECTED_SOURCE_SHA,captures},null,2));
});

test('Inspector capture producer preserves exact binding through receipt publication and public model',async()=>{
 const objects=new Map(),bucket={put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{json:async()=>JSON.parse(objects.get(k))}:null};
 const meta=await storeEvidence(bucket,{requestId:'card-fixture',targetUrl:'https://relay.loew.fi',kind:'screenshot',screenshotBytes:Buffer.from(png,'base64'),context:{project:'relay',assignment:'card-demo',commit_sha:source,environment:'preview'},viewport:{width:760,height:900}});
 const stored=await getVisualEvidence(bucket,meta.evidence_id);assert.equal(stored.context.assignment,'card-demo');assert.equal(stored.context.commit_sha,source);
 const data=fixture(1,{artifact:{...artifact,evidence_id:meta.evidence_id}}),m=contextCardModel(data);assert.equal(m.updates[0].artifacts[0].evidence_id,stored.evidence_id);assert.equal(m.updates[0].assignment,stored.context.assignment);assert.equal(m.updates[0].source_sha,stored.context.commit_sha);
});
test('no-plan failure and product messages do not invent a crew, plan or progress',()=>{
 for(const data of [{ok:false,error:{message:'The worker stopped.'}},{project:'relay',claim:{id:'failed',primary_staff:'nico',state:'failed',goal:'Repair the build'}}]){const m=contextCardModel(data);assert.equal(m.updates.length,0);assert.equal(m.plan.steps.length,0);assert.equal(m.family,data.claim?'assignment':'product');}
 assert.equal(contextCardModel({ok:true}).family,'product');assert.equal(contextCardModel(fixture(1)).family,'assignment');assert.equal(contextCardModel(fixture(3)).family,'assignment');
});
test('desktop/mobile family fits, uses actual attributed people and surfaced keyboard carousel',async()=>{
 for(const width of [760,360]){const {browser,page}=await mount(fixture(),{width});try{
  assert.equal(await page.locator('.family-brand').evaluate(n=>getComputedStyle(n).color),'rgb(181, 71, 31)','Relay product brand does not inherit the current staff/status accent');
  assert.equal(await page.locator('.family-message').first().evaluate(n=>getComputedStyle(n).fontSize),'14px');assert.equal(await page.locator('.family-relation').count(),0);assert.equal(await page.locator('.family-step').count(),0);
  assert.equal(await page.locator('.family-update').count(),3);assert.deepEqual(await page.locator('.family-name').allTextContents(),['Valentina','Nico','Roman']);
  assert.equal(await page.locator('.family-message .family-media-note').first().textContent(),'No visual is attached to this update.');
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
 for(const data of [{ok:true},{project:'relay',claim:{id:'failed',primary_staff:'nico',primary_team:'runner',state:'failed',goal:'Repair the failed build',next_action:'Inspect the failed check.'}}]){const {browser,page}=await mount(data);try{assert.equal(await page.locator('#family-crew').isVisible(),false);if(data.claim)assert.equal(await page.locator('.family-empty').count(),0);assert.match(await page.locator('#family-plan-empty').textContent(),/Plan pending/);assert.equal(await page.locator('#plan-panel').isVisible(),false);assert.equal(await page.locator('#details').evaluate(n=>n.open),false);assert.ok((await page.locator('#card').boundingBox()).height<850);}finally{await browser.close();}}
});

 test('partial explicit assignment retains labeled lead without inventing an authored update; generic staff fields stay product-only',()=>{
 const m=contextCardModel({project:'relay',claim:{primary_staff:'julian',goal:'Coordinate review',state:'active'}});
 assert.equal(m.family,'assignment');assert.equal(m.identity.lead.id,'julian');assert.equal(m.identity.relationship,'Assignment lead');assert.equal(m.identity.current_owner,null);assert.deepEqual(m.updates,[]);
 const partial=contextCardModel({project:'relay',claims:[{state:'active',goal:'Late input recovered'}]});assert.equal(partial.family,'assignment');assert.equal(partial.title,'Late input recovered');assert.equal(partial.identity.lead,null);
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

test('single-staff variant retains padded portrait and message insets',async()=>{
 const {browser,page}=await mount(individual(fixture(1)),{width:360});try{
  assert.equal(await page.locator('#plan-panel').isVisible(),false);assert.equal(await page.locator('.family-crew-heading').count(),0);assert.equal(await page.locator('.family-range').count(),0);assert.equal(await page.locator('.family-nav').count(),0);assert.equal(await page.locator('.family-track').count(),0);assert.equal(await page.locator('.insight').isVisible(),false);
  const card=await page.locator('.family-update').boundingBox(),avatar=await page.locator('.family-avatar').boundingBox(),message=await page.locator('.family-message').boundingBox();
  assert.ok(avatar.x-card.x>=14&&avatar.y-card.y>=14,'portrait stays inside the surfaced card');assert.ok(message.x-card.x>=14&&card.x+card.width-message.x-message.width>=14,'message preserves both card insets');
 }finally{await browser.close();}
});

test('explicit individual context never persists when the same one-update assignment is reopened',async()=>{
 const data=fixture(1),{browser,page}=await mount(data);try{
  assert.equal(await page.locator('#plan-panel').isVisible(),true);assert.equal(await page.locator('.family-track').count(),1);
  await page.evaluate(data=>render(data),individual(data));assert.equal(await page.locator('#card').getAttribute('data-family'),'single');assert.equal(await page.locator('#plan-panel').isVisible(),false);assert.equal(await page.locator('.family-track').count(),0);
  await page.evaluate(data=>render(data),data);assert.equal(await page.locator('#card').getAttribute('data-family'),'assignment');assert.equal(await page.locator('#plan-panel').isVisible(),true);assert.equal(await page.locator('.family-track').count(),1);assert.equal(await page.locator('.family-crew-heading').isVisible(),true);
 }finally{await browser.close();}
});

test('canonical tool presentation selects all four compact product brands without fabricated staff or overview',async()=>{
 for(const [tool,product]of [['relay_source_inventory','relay'],['relay_runner_coordinate','runner'],['relay_verify_browser_capture','inspector'],['relay_night_shift','night-shift']]){
  const data=contextualPresentation({ok:true,state:'completed'},{operation:{name:tool,kind:'query'}}),model=contextCardModel(data);assert.equal(model.family,'product');assert.equal(model.product,product);assert.equal(model.identity.lead,null);
  const {browser,page}=await mount(data,{width:360});try{
   assert.equal(await page.locator('#feature-title').textContent(),product==='night-shift'?'night shift':product);assert.equal(await page.locator('#feature-mark').getAttribute('data-staff'),'');assert.equal(await page.locator('#feature-mark>img').count(),1);assert.equal(await page.locator('#plan-panel').isVisible(),false);assert.equal(await page.locator('#family-crew').isVisible(),false);assert.equal(await page.locator('.insight').isVisible(),false);assert.equal(await page.locator('.summary').evaluate(n=>getComputedStyle(n).fontSize),'16px');
  }finally{await browser.close();}
 }
});

test('overview to single preserves reachable keyboard focus and restores overview plan on expansion',async()=>{
 for(const target of ['button','track']){const {browser,page}=await mount(fixture(3));try{
  if(target==='button')await page.getByRole('button',{name:'Next updates',exact:true}).focus();else await page.locator('.family-track').focus();
  await page.evaluate(data=>render(data),individual(fixture(1)));await page.clock.runFor(50);
  assert.equal(await page.locator('.family-update-details summary').evaluate(n=>n===document.activeElement),true);assert.equal(await page.locator('#plan-panel').isVisible(),false);assert.equal(await page.locator('.family-nav').count(),0);
  await page.evaluate(data=>render(data),fixture(3));await page.clock.runFor(50);assert.equal(await page.locator('#plan-panel').isVisible(),true);assert.equal(await page.locator('.family-update-details summary').first().evaluate(n=>n===document.activeElement),true);
 }finally{await browser.close();}}
});

test('card family boundary table distinguishes actual assignment context, explorer, CI and generic product operations',()=>{
 const ci={schema:'relay-ci-card/v1',status:'running',telemetry:'unreported',run:{id:'1'},tests:{},suites:[],jobs:{total:0}};
 const cases=[
  ['ordinary ID',{claim:{id:'a',state:'active',goal:'Actual assignment'}},'assignment'],
  ['partial claim',{claim:{state:'active',goal:'Actual partial assignment'}},'assignment'],
  ['partial queue',{queue:[{state:'queued',goal:'Actual queued assignment'}]},'assignment'],
  ['partial progress',{progress:[{state:'working',goal:'Actual progress assignment'}]},'assignment'],
  ['generic goal',{goal:'Not assignment-bound',state:'working'},'product'],
  ['generic failure',{ok:false,error:{message:'Unavailable'}},'product'],
  ['CI Inspector',{ci},'product'],
  ['explorer',{...fixture(2),presentation_view:'explorer',primary_staff:'julian',primary_team:'night-shift',supporting_staff:['nico'],staff_attribution:{primary:{id:'valentina',display_name:'Valentina'}},human:{responsible_staff:{display_name:'Julian',role:'Project Lead'},supporting_staff:[{display_name:'Nico'}]}},'explorer'],
  ['one assignment update',fixture(1),'assignment'],['explicit individual',individual(fixture(1)),'single'],['full overview',fixture(3),'assignment']
 ];
 for(const [label,data,expected]of cases){const m=contextCardModel(data);assert.equal(m.family,expected,label);if(expected==='explorer'){assert.deepEqual(m.updates,[]);assert.deepEqual(m.plan.steps,[]);assert.equal(m.identity.lead,null);assert.equal(m.identity.speaker,null);assert.equal(m.primary_staff,'Relay');assert.equal(m.team,'Relay');}}
 const c=contextCardModel({ci});assert.equal(c.product,'inspector');assert.ok(c.ci);assert.equal(contextCardModel({checks:{check_runs:[]}}).product,'inspector');
});
test('explorer overview and project never borrow one assignment crew; explicit assignment view renders its own updates',async()=>{
 const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:390,height:1000}});const data=fixture(2);
 await page.addInitScript(data=>{window.openai={toolOutput:{schema:'relay-status-explorer/v1',projects:[{id:'relay',name:'Relay',coordination:'enabled'}]},widgetState:{},setWidgetState(state){this.widgetState=state},callTool:async()=>({structuredContent:{project:'relay',progress:[data.claim],queue:[]}})}},data);
 await page.goto('data:text/html,'+encodeURIComponent(relayContextCardResource().text));await page.getByRole('button',{name:/Relay.*1 open/}).waitFor();assert.equal(await page.locator('#family-crew').isVisible(),false);assert.equal(await page.locator('#plan-panel').isVisible(),false);assert.equal(await page.locator('#card').getAttribute('data-family'),'explorer');
 await page.getByRole('button',{name:/Relay.*1 open/}).click();assert.equal(await page.locator('#family-crew').isVisible(),false);await page.getByRole('button',{name:/A clearer overlay, built together/}).click();await page.locator('#banner-content').evaluate(n=>n.open=true);await page.locator('.family-update').first().waitFor();assert.equal(await page.locator('.family-update').count(),2);assert.equal(await page.locator('#card').getAttribute('data-family'),'assignment');
 await page.getByRole('button',{name:'‹ Project',exact:true}).click();assert.equal(await page.locator('#family-crew').isVisible(),false);assert.equal(await page.locator('#plan-panel').isVisible(),false);await page.getByRole('button',{name:'‹ Overall',exact:true}).click();await page.locator('#title').filter({hasText:'Your projects'}).waitFor();assert.equal(await page.locator('#family-crew').isVisible(),false);
 }finally{await browser.close();}
});
