import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {spawnSync} from 'node:child_process';
import { chromium } from 'playwright';
import { contextCardModel, relayContextCardResource, contextualPresentation } from '../src/relay-chat-ui.js';
import {appendCardUpdates} from '../src/relay-card-updates.js';
import {assignmentCardContext,validateCardStepsPublication} from '../src/relay-card-steps.js';
import { webSourceSha } from '../apps/web/generated.js';

const expected=process.env.EXPECTED_SOURCE_SHA;
assert.match(expected||'',/^[a-f0-9]{40}$/);assert.equal(webSourceSha,expected);
// Capture the real ordinary command/publication path at this exact source too;
// the static visual samples below alone do not prove ordinary workflow delivery.
const ordinary=spawnSync(process.execPath,['--test','--test-name-pattern=^ordinary coordinate command','src/relay-card-family.test.js'],{env:{...process.env,EXPECTED_SOURCE_SHA:expected},encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
assert.equal(ordinary.status,0,'Ordinary coordinate DOM captures failed: '+ordinary.stdout+'\n'+ordinary.stderr);
const ordinaryReceipt=JSON.parse(await readFile('qa-evidence/context-cards/ordinary-receipt.json','utf8'));assert.equal(ordinaryReceipt.source_sha,expected);assert.equal(ordinaryReceipt.captures.length,16);
const directory='qa-evidence/context-cards';await mkdir(directory,{recursive:true});
const resource=relayContextCardResource(),browser=await chromium.launch(),captures=[];
const origin='https://relay-card-fixture.test';
const clientId=process.env.CF_ACCESS_CLIENT_ID,clientSecret=process.env.CF_ACCESS_CLIENT_SECRET;
const auth=clientId&&clientSecret?{Authorization:JSON.stringify({'cf-access-client-id':clientId,'cf-access-client-secret':clientSecret}),'CF-Access-Client-Id':clientId,'CF-Access-Client-Secret':clientSecret}:null;
const revision='a'.repeat(64),source=expected,now=new Date('2026-11-01T00:00:00Z');
const projectManifest=JSON.parse(await readFile('apps/web/public/relay.assets.json','utf8')),projectAsset=projectManifest.variants.primary;
const projectBytes=await readFile(projectAsset.path);assert.equal(projectBytes.length,projectAsset.bytes);assert.equal(createHash('sha256').update(projectBytes).digest('hex'),projectAsset.sha256);
const projectIcon={project:'relay',name:'Relay',status:'found',icon:{...projectAsset,repository:'lrnolivia/relay',blob_sha:createHash('sha1').update(Buffer.concat([Buffer.from('blob '+projectBytes.length+'\0'),projectBytes])).digest('hex'),data_url:'data:image/png;base64,'+projectBytes.toString('base64')}};
function familyFixture(count=3,{id='card-demo',artifact=null}={}){
 let record={id,owner:'fixture-host',branch:'relay/fixture',state:'active',goal:'A clearer overlay, built together',primary_staff:'julian',primary_team:'night-shift',supporting_staff:['valentina','nico','roman'],supporting_teams:['inspector','runner'],lease_until:'2026-11-02T00:00:00Z'};
 const people=['valentina','nico','roman','julian'],teams=['inspector','runner','inspector','night-shift'];
 for(let i=0;i<count;i++){
  const pub={schema:'relay-card-steps/v1',assignment:id,revision,objective_digest:revision,publisher:{owner:record.owner,branch:record.branch},sequence:i+1,complete:false,steps:[{id:'stage-'+i,label:['Design the overlay','Build the change','Review the result','Coordinate the next step'][i],depends_on:[],state:i===2?'blocked':'running',receipt:{id:'event-'+i,assignment:id,step_id:'stage-'+i,plan_revision:revision,input_digest:revision,evidence:'sha256:'+revision,source_sha:source,observed_at:now.toISOString(),owner:{staff:people[i],team:teams[i]},update:{text:['The spacing and hierarchy are ready for review.','The interaction is implemented. Verification is next.','One keyboard issue needs attention before acceptance.','The next priorities are recorded.'][i],artifacts:i===0&&artifact?[artifact]:[]}}}]};
  pub.steps.unshift(...(record.card_steps?.steps||[]));
  const validated=validateCardStepsPublication(pub,record,revision,now);record={...record,card_updates:appendCardUpdates(record,validated,now),card_steps:validated};
 }
 return {project:'relay',project_icon:projectIcon,claim:assignmentCardContext(record)};
}
const fixtures={
 'refresh-provider':{project:'relay',__refreshFailure:true,claim:{id:'refresh-proof',primary_staff:'nico',primary_team:'runner',goal:'Last recorded work stays visible',state:'active'}},
 runner:{project:'relay',claim:{id:'sample-runner',primary_team:'runner',primary_staff:'ellis',goal:'The release is moving',state:'active',progress_percent:68,next_action:'Review the captured desktop and phone layouts.'},human:{what_changed:'The approved interface is built. Verification is checking the last interactions.'}},
 inspector:{project:'relay',claim:{id:'sample-inspector',primary_team:'inspector',primary_staff:'nico',goal:'Ready for your review',state:'waiting-for-human',next_action:'Review the exact build in Inspector.'},human:{what_changed:'Screenshots and an interactive preview are available. This sample does not claim a human approval.'}},
 relay:{project:'relay',claim:{id:'sample-relay',primary_team:'relay',primary_staff:'julian',goal:'Current project state',state:'active'},human:{what_changed:'Progress is not reported yet. The card shows the known state without inventing a percentage.'}},
 'night-shift':{project:'relay',claim:{id:'sample-night',primary_team:'night-shift',primary_staff:'mara',goal:'Waiting on a dependency',state:'held',next_action:'Resume when the required service responds.'},human:{what_changed:'The last verified state stays visible while the next check is pending.'}},
 blocked:{project:'relay',ok:false,claim:{id:'sample-blocked',primary_team:'inspector',primary_staff:'nico',state:'blocked',goal:'A long project name still needs a clear, readable explanation'},error:{message:'The preview could not be verified. Source remains unchanged; inspect the reported failure before retrying.'}},
 empty:{project:'relay',checks:{check_runs:[]}},
 complete:{project:'relay',claim:{id:'sample-complete',primary_team:'runner',primary_staff:'ellis',state:'completed',goal:'Verification finished',next_action:'Obsolete next action must stay hidden.'}},
 jobs:{project:'relay',claims:[{id:'relay-card-polish-20261003',primary_team:'runner',primary_staff:'ellis',state:'active',goal:'Continue the full project implementation and review every source and runtime detail. '.repeat(8),next_action:'Review the captured layout and current job status.'},{id:'relay-feedback-delivery-20261003',state:'working',primary_staff:'roman'},{id:'old-task',state:'completed',primary_staff:'nico'}]},
 generic:{ok:true},
 'product-relay':contextualPresentation({ok:true,state:'completed'},{operation:{name:'relay_source_inventory',kind:'query'}}),
 'product-runner':contextualPresentation({ok:true,state:'working'},{operation:{name:'relay_runner_coordinate',kind:'command'}}),
 'product-inspector':contextualPresentation({ok:true,state:'completed'},{operation:{name:'relay_verify_browser_capture',kind:'query'}}),
 'product-night-shift':contextualPresentation({ok:true,state:'waiting-for-human'},{operation:{name:'relay_night_shift',kind:'query'}}),
 loading:null,
 'family-full':familyFixture(3),
 'family-single':{...familyFixture(1),presentation_view:'individual',presentation_update_id:'event-0'},
 'family-media':familyFixture(3,{artifact:{evidence_id:'vis_fixturepreview',source_sha:expected,caption:'Fixture overlay capture',kind:'design'}}),
};
const leadCases=['nico','valentina','roman','julian','luca','imani'].map(id=>'lead-'+id);
for(const name of leadCases){const data=familyFixture(0);data.claim.primary_staff=name.slice(5);data.claim.primary_team='source';fixtures[name]=data;}
fixtures['lead-avatar-unavailable']={...fixtures['lead-nico']};
fixtures['lead-no-assignee']={project:'relay',project_icon:projectIcon,claim:{id:'lead-none',state:'active',goal:'An assignment awaiting its lead',primary_team:'runner'}};
leadCases.push('lead-avatar-unavailable','lead-no-assignee');
try {
 const visualPage=await browser.newPage({viewport:{width:640,height:360}});await visualPage.setContent('<!doctype html><style>body{margin:0;background:#151718;color:#eee;font:18px system-ui;padding:28px}main{background:#282b2c;border-radius:20px;padding:24px}h2{color:#92c8bf;font-size:26px}button{border:1px solid #7a9e99;border-radius:9px;background:#303b3b;color:white;padding:12px 18px}</style><main><small>RENDERED TEST FIXTURE · NOT LIVE PRODUCT</small><h2>Overlay controls</h2><p>Preview the spacing, hierarchy and keyboard controls.</p><button>Open settings</button></main>');const fixtureImage=(await visualPage.screenshot()).toString('base64');await visualPage.close();
 const cases=[['refresh-provider',360,'dark'],['refresh-provider',760,'light'],['runner',768,'dark'],['inspector',768,'light'],['relay',390,'dark'],['night-shift',390,'light'],['blocked',320,'dark'],['empty',320,'light'],['complete',390,'dark'],['loading',390,'light'],['jobs',390,'dark'],['jobs',768,'light'],['generic',360,'dark'],['generic',760,'light'],['family-full',760,'dark'],['family-full',360,'light'],['family-single',760,'light'],['family-single',360,'dark'],['family-media',760,'dark'],['family-media',360,'light'],...['product-relay','product-runner','product-inspector','product-night-shift'].flatMap(name=>[[name,360,'dark'],[name,760,'light']])];
 cases.push(...leadCases.flatMap(name=>[360,760].flatMap(width=>['light','dark'].map(theme=>[name,width,theme]))));
 for(const [name,width,theme] of cases){
  const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'}),errors=[],unexpected=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({fixture,fixtureImage,source})=>{
   if(window.parent===window)return;
   window.__calls=[];window.__manualRefresh=false;
   window.openai={toolInput:fixture?{project:'relay'}:{},toolOutput:fixture,
    callTool:async(name,args)=>{window.__calls.push({name,args});if(name==='relay_ui_request')return {structuredContent:args.path.endsWith('/image')?{status:200,content_type:'image/png',base64:fixtureImage}:{status:200,body:{evidence_id:'vis_fixturepreview',context:{project:'relay',assignment:'card-demo',commit_sha:source}}}};if(name==='relay_runner_progress'&&!window.__manualRefresh&&fixture?.__refreshFailure)return {structuredContent:{ok:false,error:{message:'Private provider text must not leak'}}};if(name==='relay_runner_progress'&&!window.__manualRefresh)return {structuredContent:fixture};return name==='relay_runner_progress'?{structuredContent:{project:'relay',progress:[{assignment:args.assignment||fixture?.claim?.id||'sample-runner',primary_team:'runner',primary_staff:'ellis',state:'working',goal:'Refreshed canonical state',progress_percent:70}]}}:{}},
    openExternal:async({href})=>{window.__calls.push({name:"openExternal",href})},
    notifyIntrinsicHeight:height=>{window.__reportedHeight=height}
   };
  },{fixture:fixtures[name],fixtureImage,source:expected});
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url===origin+'/card')return route.fulfill({contentType:'text/html',body:resource.text,headers:{'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https://relay.loew.fi; font-src data:; connect-src https://relay.loew.fi"}});
   if(url===origin+'/host')return route.fulfill({contentType:'text/html',body:`<!doctype html><style>html,body{margin:0;background:${theme==='dark'?'#141412':'#ffffff'}}iframe{display:block;border:0;width:100%;height:1000px}</style><script>addEventListener('message',event=>{const frame=document.querySelector('iframe');if(event.source!==frame?.contentWindow)return;const msg=event.data;if(msg?.method==='ui/initialize')frame.contentWindow.postMessage({jsonrpc:'2.0',id:msg.id,result:{protocolVersion:'2026-01-26'}},'*');});</script><iframe src="/card" title="Relay context card"></iframe>`});
   unexpected.push(url);return route.abort();
  });
  await page.goto(origin+'/host');const frame=page.frameLocator('iframe');
  await frame.locator('#feature-title').waitFor({state:'attached'});
  if(fixtures[name]){const expectedModel=contextCardModel(fixtures[name]);if(expectedModel.family==='product'&&!expectedModel.ci)await frame.locator('#summary').filter({hasText:expectedModel.summary}).waitFor();else await frame.locator('#title').filter({hasText:expectedModel.title}).waitFor();}
  if(name==='refresh-provider'){await frame.locator('#card-freshness').filter({hasText:'Relay could not read the latest update.'}).waitFor();assert.equal(await frame.locator('#details').evaluate(n=>n.open),false);assert.ok(!(await frame.locator('body').textContent()).includes('Private provider text'));}
  await frame.locator('body').evaluate(async()=>{await document.fonts.load('400 36px "Momo Trust Display"');await document.fonts.load('400 14px Inter');await document.fonts.load('600 14px Inter');await document.fonts.ready;await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve})));});
  if(name==='lead-avatar-unavailable'){await frame.locator('.family-lead-portrait img').evaluate(img=>img.dispatchEvent(new Event('error')));assert.equal(await frame.locator('.family-lead-portrait').getAttribute('data-state'),'unavailable');assert.equal(await frame.locator('.family-lead-portrait').textContent(),'N');}
  const geometry=await frame.locator('body').evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,font:document.fonts.check('400 36px "Momo Trust Display"'),headingFont:getComputedStyle(document.querySelector('h1')).fontFamily,bodyFont:getComputedStyle(document.body).fontFamily,interLoaded:document.fonts.check('400 14px Inter'),outerPadding:parseFloat(getComputedStyle(document.querySelector('#card')).paddingLeft),actionsAfterHero:Boolean(document.querySelector('.actions #open-relay')&&(document.querySelector('.hero').compareDocumentPosition(document.querySelector('.actions'))&Node.DOCUMENT_POSITION_FOLLOWING)),nextInHero:Boolean(document.querySelector('.hero #next')),buttons:[...document.querySelectorAll('.actions button')].filter(el=>!el.hidden).map(el=>({label:el.textContent,height:el.getBoundingClientRect().height})),images:[...document.querySelectorAll('.feature-mark img')].map(img=>({loaded:img.complete&&img.naturalWidth>0,source:img.src.slice(0,22)})),glyphMotion:getComputedStyle(document.querySelector('.feature-mark'),'::after').animationName,percent:document.querySelector('#meter').hidden?null:document.querySelector('#metric').textContent,diagnosticsExpanded:document.querySelector('#details').open}));
  await writeFile(directory+'/'+name+'-'+width+'-geometry.json',JSON.stringify(geometry,null,2));
  assert.equal(geometry.overflow,false);assert.ok(geometry.font);assert.match(geometry.headingFont,/Momo/);assert.match(geometry.bodyFont,/Inter/);assert.ok(geometry.interLoaded);assert.ok(geometry.outerPadding>=12);assert.ok(geometry.actionsAfterHero);assert.ok(geometry.nextInHero);assert.ok(geometry.buttons.length<=2);assert.ok(geometry.buttons.every(button=>button.height>=44));assert.equal(geometry.glyphMotion,'none');assert.equal(geometry.diagnosticsExpanded,false);if(name!=='loading')assert.ok(geometry.images.every(image=>image.loaded));
  if(['relay','inspector','night-shift','blocked','empty','complete'].includes(name))assert.equal(geometry.percent,null);
  // Ordinary multi-assignment responses show the selected assignment, not a fabricated active-job hero.
  if(name==='jobs'){assert.equal(await frame.locator('.insight').isVisible(),false);assert.equal(await frame.locator('#plan-panel').isVisible(),false);assert.equal(await frame.locator('#rows').textContent(),'');assert.match(await frame.locator('#title').textContent(),/relay card polish/);}
  if(fixtures[name]){const model=contextCardModel(fixtures[name]),identity=model.identity;assert.equal(await frame.locator('#feature-title').textContent(),model.family==='product'?(model.product==='night-shift'?'night shift':model.product):model.family==='assignment'?(model.project_label||model.project||'Assignment'):identity.speaker?.name||identity.team_label);if(model.family==='assignment'){assert.equal(await frame.locator('#feature-mark').getAttribute('data-staff'),'');if(identity.lead){assert.equal(await frame.locator('#family-assignment-lead .family-lead-name').textContent(),identity.lead.name);assert.equal(await frame.locator('#family-assignment-lead').getAttribute('data-staff'),identity.lead.id);assert.ok((await frame.locator('#family-assignment-lead .family-lead-role').textContent()).includes('Assigned lead'));}if(model.project_icon)assert.ok(geometry.images.length>0);}else if(identity.speaker){assert.ok((await frame.locator('#team').textContent()).includes(identity.relationship));assert.equal(await frame.locator('#feature-mark').getAttribute('data-staff'),identity.speaker.id);assert.ok(geometry.images.length>0);}}
  if(name==='generic'){assert.equal(await frame.locator('#feature-mark').getAttribute('data-staff'),'');assert.equal(await frame.locator('#feature-title').evaluate(el=>getComputedStyle(el).color),theme==='dark'?'rgb(240, 100, 59)':'rgb(181, 71, 31)');}
  if(name.startsWith('family-')&&name!=='family-single')await frame.locator('#banner-content').evaluate(n=>n.open=true);
  if(name.startsWith('family-')){assert.equal(await frame.locator('.family-update').count(),name==='family-single'?1:3);assert.equal(await frame.locator('#family-crew').isVisible(),true);assert.equal(await frame.locator('.card-header').isVisible(),false);if(name==='family-media')await frame.locator('.family-capture img').waitFor();}
  if(name==='family-single'){assert.equal(await frame.locator('#plan-panel').isVisible(),false);assert.equal(await frame.locator('.family-range').count(),0);assert.equal(await frame.locator('.family-nav').count(),0);assert.equal(await frame.locator('.family-track').count(),0);}
  if(name.startsWith('product-')){assert.equal(await frame.locator('#feature-title').textContent(),name==='product-night-shift'?'night shift':name.slice(8));assert.equal(await frame.locator('#feature-mark').getAttribute('data-staff'),'');assert.equal(await frame.locator('.insight').isVisible(),false);assert.equal(await frame.locator('#family-crew').isVisible(),false);}
  if(name==='complete')assert.equal(await frame.locator('#next').isVisible(),false);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  // The test host must honor intrinsic card height just like ui/notifications/size-changed.
  // A fixed iframe silently crops the footer even when element screenshots are requested.
  await frame.locator('body').evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));});
  const captureHeight=await frame.locator('#card').evaluate(card=>Math.ceil(card.getBoundingClientRect().bottom)+2);
  assert.ok(captureHeight>0&&captureHeight<6000,'card has bounded intrinsic height');
  await page.locator('iframe').evaluate((node,height)=>node.style.height=height+'px',captureHeight);
  await page.setViewportSize({width,height:Math.max(1000,captureHeight)});
  geometry.capture_height=captureHeight;
  if(width>=620&&['lead-nico','lead-no-assignee','lead-avatar-unavailable','relay','runner'].includes(name))assert.ok(captureHeight<=Math.min(width*.75,300),'sparse desktop banner stays shallow');
  if(name.startsWith('family-')&&name!=='family-single'&&width<520){const widths=await frame.locator('.step-copy').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));assert.ok(widths.every(w=>w>=180),'phone priority text has full-row width');}
  const surface=`context-card-${name}-${width}-${theme}`,screenshot=await frame.locator('#card').screenshot();
  await writeFile(directory+'/'+surface+'.png',screenshot);
  const capture={surface,theme,width,fixture:true,source_sha:expected,resource:resource.uri,sha256:createHash('sha256').update(screenshot).digest('hex'),geometry};
  if(auth){
   const metadata={kind:'pr_preview',target_url:'https://relay.loew.fi/inspector',context:{project:'relay',assignment:fixtures[name]?.claim?.id||null,environment:'preview',surface,commit_sha:expected,...(process.env.PREVIEW_PR?{pr_number:Number(process.env.PREVIEW_PR)}:{})},viewport:{width,height:captureHeight},engine:'github-chromium',engine_reason:'contextual_card_fixture_verification',step_label:surface+' · sample data · native host not verified',title:'Context card visual parity · '+expected.slice(0,7),dom:{fixture:true,resource_uri:resource.uri,geometry,qa_helper:{title:'Context card visual parity',purpose:'Compare the card with the approved Inspector composition. This is sample data in a Chromium host fixture, not proof of native ChatGPT mounting.',artifact:{repository:'lrnolivia/relay',head_sha:expected,environment:'preview'},questions:['Do the larger product mark, Momo title and compact content match the approved card?','Are status, next action and buttons readable on the phone?'],checklist:['Check both light and dark captures.','The existing Linux native-client mounting task remains separate.'],overall_verdict:null,known_issues:['Actual Linux native ChatGPT mount is not verified by these captures.'],visuals:{evidence_ids:[]}}},assertions:[{id:'no-overflow',status:'pass',detail:'Card fits the tested viewport.'},{id:'embedded-assets',status:'pass',detail:'Momo and product artwork render without external network requests.'}],trace:[{action:'render_context_card_fixture',source_sha:expected,resource_uri:resource.uri,state:name}]};
   const form=new FormData();form.set('metadata',JSON.stringify(metadata));form.set('screenshot',new Blob([screenshot],{type:'image/png'}),surface+'.png');
   const uploaded=await fetch('https://relay.loew.fi/evidence/ingest',{method:'POST',headers:auth,body:form,signal:AbortSignal.timeout(45000)});assert.ok(uploaded.ok,'Inspector ingest: '+uploaded.status);const stored=await uploaded.json();capture.evidence_id=stored.evidence_id;
   const image=await fetch('https://relay.loew.fi/api/visual/'+stored.evidence_id+'/image',{headers:auth,signal:AbortSignal.timeout(45000)});assert.ok(image.ok);assert.equal(createHash('sha256').update(new Uint8Array(await image.arrayBuffer())).digest('hex'),capture.sha256);capture.readback_verified=true;
  }
  captures.push(capture);
  if(name==='runner'){
   await frame.locator('body').evaluate(()=>{window.__calls=[];window.__manualRefresh=true});
   await frame.locator('#card-menu').evaluate(n=>n.open=true);await frame.locator('#refresh').click();await frame.locator('#title').filter({hasText:'Refreshed canonical state'}).waitFor();await frame.locator('#open-relay').click();
   const calls=await frame.locator('body').evaluate(()=>window.__calls);assert.deepEqual(calls.map(call=>call.name),['relay_runner_progress','openExternal']);
   await frame.locator('#card-menu').evaluate(n=>n.open=true);await frame.locator('#refresh').focus();
   assert.equal(await frame.locator('#refresh').evaluate(el=>document.activeElement===el),true);
   assert.equal(await frame.locator('#refresh').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
  }
  await page.close();
 }
 const receipt={ok:true,source_sha:expected,resource:resource.uri,coverage:'Chromium MCP host fixtures; not native ChatGPT consumer proof',captures};
 await writeFile(directory+'/receipt.json',JSON.stringify(receipt,null,2));console.log('CONTEXT_CARD_VISUAL_RESULT='+JSON.stringify(receipt));
} finally {await browser.close();}
