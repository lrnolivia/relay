import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { relayContextCardResource } from '../src/relay-chat-ui.js';
import { webSourceSha } from '../apps/web/generated.js';

const expected=process.env.EXPECTED_SOURCE_SHA;
assert.match(expected||'',/^[a-f0-9]{40}$/);assert.equal(webSourceSha,expected);
const directory='qa-evidence/context-cards';await mkdir(directory,{recursive:true});
const resource=relayContextCardResource(),browser=await chromium.launch(),captures=[];
const origin='https://relay-card-fixture.test';
const clientId=process.env.CF_ACCESS_CLIENT_ID,clientSecret=process.env.CF_ACCESS_CLIENT_SECRET;
const auth=clientId&&clientSecret?{Authorization:JSON.stringify({'cf-access-client-id':clientId,'cf-access-client-secret':clientSecret}),'CF-Access-Client-Id':clientId,'CF-Access-Client-Secret':clientSecret}:null;
const fixtures={
 runner:{project:'relay',claim:{id:'sample-runner',primary_team:'runner',primary_staff:'ellis',goal:'The release is moving',state:'active',progress_percent:68,next_action:'Review the captured desktop and phone layouts.'},human:{what_changed:'The approved interface is built. Verification is checking the last interactions.'}},
 inspector:{project:'relay',claim:{id:'sample-inspector',primary_team:'inspector',primary_staff:'nico',goal:'Ready for your review',state:'waiting-for-human',next_action:'Review the exact build in Inspector.'},human:{what_changed:'Screenshots and an interactive preview are available. This sample does not claim a human approval.'}},
 relay:{project:'relay',claim:{id:'sample-relay',primary_team:'relay',primary_staff:'julian',goal:'Current project state',state:'active'},human:{what_changed:'Progress is not reported yet. The card shows the known state without inventing a percentage.'}},
 'night-shift':{project:'relay',claim:{id:'sample-night',primary_team:'night-shift',primary_staff:'mara',goal:'Waiting on a dependency',state:'held',next_action:'Resume when the required service responds.'},human:{what_changed:'The last verified state stays visible while the next check is pending.'}},
 blocked:{project:'relay',ok:false,claim:{id:'sample-blocked',primary_team:'inspector',primary_staff:'nico',state:'blocked',goal:'A long project name still needs a clear, readable explanation'},error:{message:'The preview could not be verified. Source remains unchanged; inspect the reported failure before retrying.'}},
 empty:{project:'relay',checks:{check_runs:[]}},
 complete:{project:'relay',claim:{id:'sample-complete',primary_team:'runner',primary_staff:'ellis',state:'completed',goal:'Verification finished',next_action:'Obsolete next action must stay hidden.'}},
 jobs:{project:'relay',claims:[{id:'relay-card-polish-20261003',primary_team:'runner',primary_staff:'ellis',state:'active',goal:'Continue the full project implementation and review every source and runtime detail. '.repeat(8),next_action:'Review the captured layout and current job status.'},{id:'relay-feedback-delivery-20261003',state:'working',primary_staff:'roman'},{id:'old-task',state:'completed',primary_staff:'nico'}]},
 loading:null,
};
try {
 const cases=[['runner',768,'dark'],['inspector',768,'light'],['relay',390,'dark'],['night-shift',390,'light'],['blocked',320,'dark'],['empty',320,'light'],['complete',390,'dark'],['loading',390,'light'],['jobs',390,'dark'],['jobs',768,'light']];
 for(const [name,width,theme] of cases){
  const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'}),errors=[],unexpected=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({fixture})=>{
   if(window.parent===window)return;
   window.__calls=[];
   window.openai={toolInput:fixture?{project:'relay'}:{},toolOutput:fixture,
    callTool:async(name,args)=>{window.__calls.push({name,args});return name==='relay_runner_progress'?{structuredContent:{project:'relay',progress:[{assignment:'sample-refreshed',primary_team:'runner',primary_staff:'ellis',state:'working',goal:'Refreshed canonical state',progress_percent:70}]}}:{}},
    openExternal:async({href})=>{window.__calls.push({name:"openExternal",href})},
    notifyIntrinsicHeight:height=>{window.__reportedHeight=height}
   };
  },{fixture:fixtures[name]});
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url===origin+'/card')return route.fulfill({contentType:'text/html',body:resource.text,headers:{'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https://relay.loew.fi; font-src data:; connect-src https://relay.loew.fi"}});
   if(url===origin+'/host')return route.fulfill({contentType:'text/html',body:`<!doctype html><style>html,body{margin:0;background:${theme==='dark'?'#141412':'#ffffff'}}iframe{display:block;border:0;width:100%;height:1000px}</style><script>addEventListener('message',event=>{const frame=document.querySelector('iframe');if(event.source!==frame?.contentWindow)return;const msg=event.data;if(msg?.method==='ui/initialize')frame.contentWindow.postMessage({jsonrpc:'2.0',id:msg.id,result:{protocolVersion:'2026-01-26'}},'*');});</script><iframe src="/card" title="Relay context card"></iframe>`});
   unexpected.push(url);return route.abort();
  });
  await page.goto(origin+'/host');const frame=page.frameLocator('iframe');
  await frame.locator('#feature-title').waitFor();
  if(fixtures[name])await frame.locator('#title').filter({hasText:name==='jobs'?'relay card polish':name==='empty'?'Verification':fixtures[name].claim?.goal||'Relay update'}).waitFor();
  await frame.locator('body').evaluate(async()=>{await document.fonts.load('400 36px "Momo Trust Display"');await document.fonts.load('400 14px Inter');await document.fonts.load('600 14px Inter');await document.fonts.ready;await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve})));});
  const geometry=await frame.locator('body').evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,font:document.fonts.check('400 36px "Momo Trust Display"'),headingFont:getComputedStyle(document.querySelector('h1')).fontFamily,bodyFont:getComputedStyle(document.body).fontFamily,interLoaded:document.fonts.check('400 14px Inter'),outerPadding:parseFloat(getComputedStyle(document.querySelector('#card')).paddingLeft),actionsInHero:Boolean(document.querySelector('.hero #open-relay')),nextInHero:Boolean(document.querySelector('.hero #next')),buttons:[...document.querySelectorAll('.actions button')].filter(el=>!el.hidden).map(el=>({label:el.textContent,height:el.getBoundingClientRect().height})),images:[...document.querySelectorAll('.feature-mark img')].map(img=>({loaded:img.complete&&img.naturalWidth>0,source:img.src.slice(0,22)})),glyphMotion:getComputedStyle(document.querySelector('.feature-mark'),'::after').animationName,percent:document.querySelector('#meter').hidden?null:document.querySelector('#metric').textContent,diagnosticsExpanded:document.querySelector('#details').open}));
  await writeFile(directory+'/'+name+'-'+width+'-geometry.json',JSON.stringify(geometry,null,2));
  assert.equal(geometry.overflow,false);assert.ok(geometry.font);assert.match(geometry.headingFont,/Momo/);assert.match(geometry.bodyFont,/Inter/);assert.ok(geometry.interLoaded);assert.ok(geometry.outerPadding>=12);assert.ok(geometry.actionsInHero);assert.ok(geometry.nextInHero);assert.ok(geometry.buttons.length<=2);assert.ok(geometry.buttons.every(button=>button.height>=44));assert.equal(geometry.glyphMotion,'none');assert.equal(geometry.diagnosticsExpanded,false);if(name!=='loading')assert.ok(geometry.images.every(image=>image.loaded));
  if(['relay','inspector','night-shift','blocked','empty','complete'].includes(name))assert.equal(geometry.percent,null);
  if(name==='jobs'){assert.equal(await frame.locator('#metric').textContent(),'2');assert.match(await frame.locator('#rows').textContent(),/relay card polish/);assert.doesNotMatch(await frame.locator('#rows').textContent(),/Ellis|Roman/);}
  if(name==='complete')assert.equal(await frame.locator('#next').isVisible(),false);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  const surface=`context-card-${name}-${width}-${theme}`,screenshot=await frame.locator('#card').screenshot();
  await writeFile(directory+'/'+surface+'.png',screenshot);
  const capture={surface,theme,width,fixture:true,source_sha:expected,resource:resource.uri,sha256:createHash('sha256').update(screenshot).digest('hex'),geometry};
  if(auth){
   const metadata={kind:'pr_preview',target_url:'https://relay.loew.fi/inspector',context:{project:'relay',environment:'preview',surface,commit_sha:expected,...(process.env.PREVIEW_PR?{pr_number:Number(process.env.PREVIEW_PR)}:{})},viewport:{width,height:1000},engine:'github-chromium',engine_reason:'contextual_card_fixture_verification',step_label:surface+' · sample data · native host not verified',title:'Context card visual parity · '+expected.slice(0,7),dom:{fixture:true,resource_uri:resource.uri,geometry,qa_helper:{title:'Context card visual parity',purpose:'Compare the card with the approved Inspector composition. This is sample data in a Chromium host fixture, not proof of native ChatGPT mounting.',artifact:{repository:'lrnolivia/relay',head_sha:expected,environment:'preview'},questions:['Do the larger product mark, Momo title and compact content match the approved card?','Are status, next action and buttons readable on the phone?'],checklist:['Check both light and dark captures.','The existing Linux native-client mounting task remains separate.'],overall_verdict:null,known_issues:['Actual Linux native ChatGPT mount is not verified by these captures.'],visuals:{evidence_ids:[]}}},assertions:[{id:'no-overflow',status:'pass',detail:'Card fits the tested viewport.'},{id:'embedded-assets',status:'pass',detail:'Momo and product artwork render without external network requests.'}],trace:[{action:'render_context_card_fixture',source_sha:expected,resource_uri:resource.uri,state:name}]};
   const form=new FormData();form.set('metadata',JSON.stringify(metadata));form.set('screenshot',new Blob([screenshot],{type:'image/png'}),surface+'.png');
   const uploaded=await fetch('https://relay.loew.fi/evidence/ingest',{method:'POST',headers:auth,body:form,signal:AbortSignal.timeout(45000)});assert.ok(uploaded.ok,'Inspector ingest: '+uploaded.status);const stored=await uploaded.json();capture.evidence_id=stored.evidence_id;
   const image=await fetch('https://relay.loew.fi/api/visual/'+stored.evidence_id+'/image',{headers:auth,signal:AbortSignal.timeout(45000)});assert.ok(image.ok);assert.equal(createHash('sha256').update(new Uint8Array(await image.arrayBuffer())).digest('hex'),capture.sha256);capture.readback_verified=true;
  }
  captures.push(capture);
  if(name==='runner'){
   await frame.locator('#refresh').click();await frame.locator('#title').filter({hasText:'Refreshed canonical state'}).waitFor();await frame.locator('#open-relay').click();
   const calls=await frame.locator('body').evaluate(()=>window.__calls);assert.deepEqual(calls.map(call=>call.name),['relay_runner_progress','openExternal']);
   await page.keyboard.press('Shift+Tab');
   assert.equal(await frame.locator('#refresh').evaluate(el=>document.activeElement===el),true);
   assert.equal(await frame.locator('#refresh').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
  }
  await page.close();
 }
 const receipt={ok:true,source_sha:expected,resource:resource.uri,coverage:'Chromium MCP host fixtures; not native ChatGPT consumer proof',captures};
 await writeFile(directory+'/receipt.json',JSON.stringify(receipt,null,2));console.log('CONTEXT_CARD_VISUAL_RESULT='+JSON.stringify(receipt));
} finally {await browser.close();}
