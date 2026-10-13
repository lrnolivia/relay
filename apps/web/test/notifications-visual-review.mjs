// Exact-head fixture evidence. Credentialed Inspector ingest is reserved for CI.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { contextFixture } from './project-context-fixture.mjs';
import { webBuildId,webSourceSha } from '../generated.js';
import { normalizeExternalEvidenceMetadata } from '../../../src/external-evidence.js';
const commit=process.env.PREVIEW_COMMIT,pr=Number(process.env.PREVIEW_PR||0),local=process.env.PREVIEW_LOCAL==='1';
if(!commit||commit!==webSourceSha)throw Error('Exact-head build identity required');
const clientId=process.env.CF_ACCESS_CLIENT_ID,clientSecret=process.env.CF_ACCESS_CLIENT_SECRET;
if(!local&&(!pr||!clientId||!clientSecret))throw Error('CI Inspector credentials and draft PR identity required');
const directory=process.env.PREVIEW_OUTPUT||'qa-evidence/notifications-review';await mkdir(directory,{recursive:true});
const fixture=await contextFixture(),browser=await chromium.launch();const captures=[];
const evidence={evidence_id:'vis_context-capture-relay',screenshot_url:'/api/visual/vis_context-capture-relay/image',context:{project:'relay'},viewport:{width:1440,height:900}};
const questions=[{id:'context',prompt:'Is the next action clear?',reason:'Review the saved source context.'},{id:'result',prompt:'Is the result readable?',reason:'Review the exact captured output.'}];
async function capture(page,surface,route,state){
  await page.locator('.signal-card,.qa-companion,.notification-menu').evaluateAll(async nodes=>{await Promise.all(nodes.flatMap(node=>node.getAnimations({subtree:true})).filter(animation=>animation.effect.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow: '+surface);
  const png=await page.screenshot({animations:'disabled'});await writeFile(directory+'/'+surface+'.png',png);
  const target=new URL(route,'https://relay.loew.fi');target.hash='';
  const viewport=page.viewportSize(),metadata={request_id:'relay-pr-'+pr+'-'+commit.slice(0,12)+'-'+surface,target_url:target.toString(),kind:'pr_preview',context:{project:'relay',project_id:'relay',environment:'preview',surface,route_kind:'other',commit_sha:commit,pr_number:pr},viewport:{...viewport,deviceScaleFactor:1},engine:'github-chromium',engine_reason:'pull_request_visual_review',step_label:surface+' — '+state+' fixture',title:'Relay notification/review preview',dom:{build:webBuildId,fixture:true,state,qa_helper:{title:'Notification and review controls',purpose:'Review exact-head local fixture composition; this is not production acceptance.',artifact:{repository:'lrnolivia/relay',head_sha:commit,pr,branch:'relay/website-notifications-review-20261001',environment:'preview',route},questions:['Are notification importance and actual source easy to read?','Are review navigation, save feedback and preview controls reachable at this width?'],overall_verdict:null}},assertions:[{id:'page-overflow',status:'pass',detail:'No horizontal document overflow.'},{id:'data-settled',status:'pass',detail:state+' fixture after initial request cycle.'}],trace:[{action:'render_exact_head_fixture',route,state}],captured_at:new Date().toISOString()};normalizeExternalEvidenceMetadata(metadata);
  const result={surface,route,state,viewport,sha256:createHash('sha256').update(png).digest('hex'),bytes:png.length};
  if(!local){const authHeaders={'CF-Access-Client-Id':clientId,'CF-Access-Client-Secret':clientSecret,Authorization:JSON.stringify({'cf-access-client-id':clientId,'cf-access-client-secret':clientSecret})};const form=new FormData();form.set('metadata',JSON.stringify(metadata));form.set('screenshot',new Blob([png],{type:'image/png'}),surface+'.png');const response=await fetch('https://relay.loew.fi/evidence/ingest',{method:'POST',headers:authHeaders,body:form});if(!response.ok)throw Error('Inspector ingest failed: '+response.status);const stored=await response.json();result.evidence_id=stored.evidence_id;const image=await fetch('https://relay.loew.fi/api/visual/'+encodeURIComponent(stored.evidence_id)+'/image',{headers:authHeaders});if(!image.ok)throw Error('Registered evidence unreadable');result.registered_sha256=createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex');if(result.registered_sha256!==result.sha256)throw Error('Registered evidence bytes differ');}
  captures.push(result);
}
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:740}]){
  const page=await browser.newPage({viewport,colorScheme:'dark',reducedMotion:'reduce'});let review={answers:{},notes:'A human note on this exact capture.',overall:null},fail=false;
  await page.route('**/api/visual/*/qa',async route=>{if(route.request().method()==='POST'){if(fail)return route.fulfill({status:503,json:{error:'Fixture save unavailable'}});review={...route.request().postDataJSON(),updated_at:new Date().toISOString()};return route.fulfill({json:{review}});}return route.fulfill({json:{evidence,questions,review}});});
  await page.route('**/api/visual/*/live',route=>route.fulfill({json:{live:{active:false,embeddable:false}}}));
  await page.goto(fixture.origin+'/#/today');await page.locator('.operator-connection[data-tone=good]').waitFor();await page.locator('[data-progress-notice]').waitFor({state:'detached'});await page.locator('.notification-toasts .notification-message').waitFor();await capture(page,'toast-'+viewport.width,'/#/today','settled success with observed worker attention');
  await page.getByRole('button',{name:/^Notifications/}).click();await capture(page,'menu-'+viewport.width,'/#/today','retained attention');await page.keyboard.press('Escape');
  await page.goto(fixture.origin+'/inspector#review?evidence='+evidence.evidence_id);await page.locator('.qa-question').filter({hasText:'next action'}).waitFor();await capture(page,'review-first-'+viewport.width,'/inspector#review?evidence='+evidence.evidence_id,'captured fallback');
  await page.getByRole('button',{name:'Yes, clear',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Yes, clear',exact:true}).click();await page.locator('.qa-companion [data-qa-save-state]').filter({hasText:'Saved'}).waitFor();await page.locator('.qa-companion [data-qa-save-state]').scrollIntoViewIfNeeded();await capture(page,'review-final-'+viewport.width,'/inspector#review?evidence='+evidence.evidence_id,'confirmed saved');
  await page.getByRole('button',{name:'Notes',exact:true}).click();await capture(page,'review-notes-'+viewport.width,'/inspector#review?evidence='+evidence.evidence_id,'separate notes popout');
  fail=true;await page.locator('.qa-notes textarea').fill('Preserved after failed write.');await page.locator('.qa-notes-popout [data-qa-retry]').waitFor();await page.locator('.qa-notes-popout [data-qa-retry]').scrollIntoViewIfNeeded();await capture(page,'review-failed-'+viewport.width,'/inspector#review?evidence='+evidence.evidence_id,'explicit save failure with retry');
  await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:'Hide questions'}).click();await capture(page,'review-unobstructed-'+viewport.width,'/inspector#review?evidence='+evidence.evidence_id,'panel hidden, captured fallback');await page.close();
  const livePage=await browser.newPage({viewport,colorScheme:'dark',reducedMotion:'reduce'});
  await livePage.route('**/api/visual/*/qa',route=>route.fulfill({json:{evidence,questions,review}}));
  await livePage.route('**/api/visual/*/live',route=>route.fulfill({json:{live:{active:true,embeddable:true,status:200,url:fixture.origin+'/blocked-preview'}}}));
  await livePage.route('**/blocked-preview',route=>route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':"frame-ancestors 'none'"},body:'<main>Refused browser embedding fixture</main>'}));
  await livePage.goto(fixture.origin+'/inspector#review?evidence='+evidence.evidence_id);await livePage.locator('.qa-question').waitFor();await livePage.locator('.qa-preview-state').filter({hasText:'Checking live preview'}).waitFor();
  await capture(livePage,'live-unverified-'+viewport.width,'/inspector#review?evidence='+evidence.evidence_id,'partial: authorized metadata, browser readiness unverified');
  await livePage.locator('.qa-preview-state').filter({hasText:'Live preview unconfirmed'}).waitFor();
  if(await livePage.locator('.qa-preview-picker select').inputValue()!=='captured')throw Error('Unconfirmed live preview failed to fall back');
  await capture(livePage,'live-fallback-'+viewport.width,'/inspector#review?evidence='+evidence.evidence_id,'partial: refused embedding, bounded captured fallback');await livePage.close();

 }
 await writeFile(directory+'/result.json',JSON.stringify({commit,build:webBuildId,pr,fixture:true,captures},null,2));console.log(JSON.stringify({commit,build:webBuildId,captures:captures.length,registered:captures.filter(item=>item.evidence_id).length}));
}finally{await browser.close();await fixture.close();}
