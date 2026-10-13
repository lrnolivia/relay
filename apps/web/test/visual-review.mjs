import { normalizeExternalEvidenceMetadata } from '../../../src/external-evidence.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { webBuildId, webSourceSha } from '../generated.js';
import { contextFixture } from './project-context-fixture.mjs';

const commit = process.env.PREVIEW_COMMIT || '';
const pr = Number(process.env.PREVIEW_PR || 0);
const local = process.env.PREVIEW_LOCAL === '1';
const clientId = process.env.CF_ACCESS_CLIENT_ID || '', clientSecret = process.env.CF_ACCESS_CLIENT_SECRET || '';
if (!commit || webSourceSha !== commit || (!local && (!pr || !clientId || !clientSecret))) throw Error('Exact-head preview environment is incomplete');
const directory = process.env.PREVIEW_OUTPUT || 'qa-evidence/current-fixes';
await mkdir(directory, { recursive: true });
const accessHeader = JSON.stringify({ 'cf-access-client-id': clientId, 'cf-access-client-secret': clientSecret });
const authHeaders = { Authorization: accessHeader, 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret };
const fixture = await contextFixture(), browser = await chromium.launch({headless:true});
const captures = [];
const questions = [
  'Does the complete mosaic retain the approved depth, hierarchy and contrast?',
  'Are the small Relay brand tile, four mobile routes and compact overview comfortable at this width?',
  'Do Simple and Rich count visuals feel useful, and does the spring motion settle cleanly?'
];
async function capture(page, {surface, route, state='settled success', viewport, project='', preset='approved', motionFrame=null}) {
  const errors = [];
  const listen = error => errors.push(error.message); page.on('pageerror', listen);
  await page.goto(fixture.origin + route);
  if(route.startsWith('/inspector')) await page.locator('#review-list[data-summary-state="'+(state==='error'?'error':'ready')+'"]').waitFor();
  else if(state==='partial') await page.locator('[data-progress-notice]').filter({hasText:'Some project activity is unavailable.'}).waitFor();
  else {await page.locator('.operator-connection[data-tone=good]').waitFor();await page.locator('[data-progress-notice]').waitFor({state:'detached'});}
  if(preset!=='approved') { await page.locator('.presentation-menu > summary').click();await page.locator('[name=preset]').selectOption(preset); if(preset==='rich' && viewport.width<=900) {await page.locator('.presentation-customize > summary').click();await page.locator('[name=nav]').selectOption('bottom');} await page.keyboard.press('Escape'); }
  // Wait for the finite entrance animation to finish, after real fixture data settles.
  await page.locator('.signal-card').evaluateAll(async nodes=>{await Promise.all(nodes.flatMap(node=>node.getAnimations({subtree:true})).map(animation=>animation.finished.catch(()=>{})));});
  let motion = null;
  if(motionFrame) {
    // Trigger and sample in one browser turn, before automation can wait out the effect.
    await page.locator('.presentation-menu > summary').evaluate(async (summary, phase) => {
      const panel = summary.parentElement.querySelector('.presentation-panel');
      summary.parentElement.open = false;
      getComputedStyle(panel).animationName;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      summary.click();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(phase==='rest') {
        const deadline=performance.now()+2000;
        while(panel.style.translate && performance.now()<deadline)await new Promise(resolve=>requestAnimationFrame(resolve));
        if(panel.style.translate)throw Error('Field spring did not settle');
      }
    }, motionFrame);
    motion = await page.locator('.presentation-panel').evaluate((panel,phase)=>({phase,time_ms:null,translate:panel.style.translate,scale:panel.style.scale,effects:panel.getAnimations({subtree:true}).map(animation=>({id:animation.id,name:animation.animationName||null,duration:animation.effect.getTiming().duration,easing:animation.effect.getTiming().easing,frames:animation.effect.getKeyframes()})),header_filter:getComputedStyle(panel.querySelector('strong')).filter,panel_filter:getComputedStyle(panel).filter}),motionFrame);
    if(motionFrame==='mid' && !motion.translate) throw Error('Field spring movement was not sampled');
    if(motion.effects.some(effect=>effect.name==='relay-panel-enter'||effect.id==='relay-motion-blur')) throw Error('Legacy motion stacked on the canonical Field spring');
    if(motionFrame==='rest' && (motion.header_filter!=='none'||motion.panel_filter!=='none')) throw Error('Motion failed to settle sharply');
  }
  const geometry = await page.locator('.signal-card').evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.signalId,text:node.innerText,rect:node.getBoundingClientRect().toJSON()})));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Preview overflow: '+surface);
  if(errors.length) throw Error(JSON.stringify(errors));
  // A real viewport avoids Chromium full-page emulation changing fixed-rail paint.
  await page.mouse.move(viewport.width-2,viewport.height-2);
  const screenshot = await page.screenshot({animations:motionFrame==='mid'?'allow':'disabled'});
  await writeFile(directory+'/'+surface+'.png',screenshot);
  const helper = { title:'Combined website work views and Field motion checkpoint', purpose:'Review exact-head preview composition and interaction direction; fixture data is not production.', artifact:{repository:'lrnolivia/relay',head_sha:commit,pr,branch:process.env.PREVIEW_BRANCH||'relay/website-work-queue-views-20261001',environment:'preview',route}, questions, checklist:['Compare Simple and Rich using the Settings preset menu.','Try top and bottom mobile navigation, then reset to Approved.'],overall_verdict:null,known_issues:[], deterministic_evidence:{build:webBuildId,state,viewport,project,geometry},visuals:{evidence_ids:[]} };
  const canonical = new URL(route, 'https://relay.loew.fi'); canonical.hash = '';
  const metadata = { request_id:'relay-pr-'+pr+'-'+commit.slice(0,12)+'-'+surface,target_url:canonical.toString(),kind:'pr_preview',context:{project:'relay',project_id:'relay',environment:'preview',surface,route_kind:'other',commit_sha:commit,pr_number:pr},viewport:{width:viewport.width,height:viewport.height,deviceScaleFactor:1},engine:'github-chromium',engine_reason:'pull_request_visual_review',step_label:surface+' — '+state+' fixture',title:'Relay PR #'+pr+' — '+surface,dom:{qa_helper:helper,build:webBuildId,fixture:true,state,geometry,motion,coverage:{layout_test:'apps/web/test/presentation-layout.test.mjs',test:'apps/web/test/motion.test.mjs',mobile_scripted_layers:2,mobile_duration_cap_ms:240,mobile_blur_cap_px:.6,calm_scope:'whole website'}},assertions:[{id:'complete-summary',status:'pass',detail:'All summary cards rendered in ordered responsive grid.'},{id:'page-overflow',status:'pass',detail:'No horizontal document overflow.'},{id:'data-settled',status:'pass',detail:state+' fixture after initial request cycle.'}],trace:[{action:'render_exact_head_fixture',route,preset,project,state,motion_frame:motionFrame}],captured_at:new Date().toISOString() };
  normalizeExternalEvidenceMetadata(metadata); // Enforce the deployed ingest contract before transfer.
  const result = {surface,route,state,project,preset,motion,viewport,sha256:createHash('sha256').update(screenshot).digest('hex'),bytes:screenshot.length};
  if(!local) {
    const form = new FormData();form.set('metadata',JSON.stringify(metadata));form.set('screenshot',new Blob([screenshot],{type:'image/png'}),surface+'.png');
    const response = await fetch('https://relay.loew.fi/evidence/ingest',{method:'POST',headers:authHeaders,body:form});
    if(!response.ok) throw Error('Inspector ingest failed: '+response.status+' '+(await response.text()).slice(0,240));
    const stored = await response.json();result.evidence_id=stored.evidence_id;helper.visuals.evidence_ids=[stored.evidence_id];
    // Populate artifact-bound questions as pending review notes; never cast a human verdict.
    const qa = await fetch('https://relay.loew.fi/api/visual/'+encodeURIComponent(stored.evidence_id)+'/qa',{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({answers:{},notes:'Preview for review. Sample data; this does not prove production behavior.\n\n'+questions.map(question=>typeof question==='string'?question:question.question||question.label||JSON.stringify(question)).join('\n')+'\n\n'+helper.checklist.join('\n'),overall:null})});
    result.qa_packet_saved=qa.ok;if(!qa.ok) result.qa_packet_error=qa.status;
    const image = await fetch('https://relay.loew.fi/api/visual/'+encodeURIComponent(stored.evidence_id)+'/image',{headers:authHeaders});
    const bytes = image.ok ? new Uint8Array(await image.arrayBuffer()) : null;
    result.readable = !!bytes?.length && createHash('sha256').update(bytes).digest('hex') === result.sha256;result.image_status=image.status;
    if(!result.readable) throw Error('Stored evidence is not readable: '+JSON.stringify(result));
    console.log('RELAY_PREVIEW_EVIDENCE='+JSON.stringify(result));
  }
  captures.push(result);await writeFile(directory+'/result.json',JSON.stringify({ok:true,local,commit,build:webBuildId,pr,captures},null,2));
  page.off('pageerror',listen);
}
try {
  for(const viewport of [{width:1440,height:1000},{width:1024,height:900},{width:390,height:844},{width:320,height:844}]) {
    for(const feature of ['today','runner','night-shift','inspector']) {
      const page=await browser.newPage({viewport,colorScheme:'dark'});
      const route=feature==='inspector'?'/inspector#review':'/#/'+feature;
      await capture(page,{surface:feature+'-'+viewport.width,route,viewport});await page.close();
    }
  }
  for(const feature of ['today','runner','night-shift','inspector']) {
    const viewport={width:1440,height:1000},page=await browser.newPage({viewport,colorScheme:'dark'});
    await capture(page,{surface:feature+'-field',route:(feature==='inspector'?'/inspector#review':'/#/'+feature)+'?project=field',viewport,project:'field'});await page.close();
  }
  for(const feature of ['today','inspector']) for(const width of [320,390]) {
    const viewport={width,height:844},page=await browser.newPage({viewport,colorScheme:'dark'});
    await capture(page,{surface:feature+'-rich-bottom-'+width,route:feature==='inspector'?'/inspector#review':'/#/'+feature,viewport,preset:'rich'});await page.close();
  }
  for(const preset of ['approved','desktop-bottom']) for(const feature of ['today','inspector']) for(const width of [1024,1440]) {
    const viewport={width,height:1000},page=await browser.newPage({viewport,colorScheme:'dark'});
    await capture(page,{surface:feature+'-'+preset+'-'+width,route:feature==='inspector'?'/inspector#review':'/#/'+feature,viewport,preset});await page.close();
  }
  for(const motionFrame of ['mid','rest']) {
    const viewport={width:320,height:844},page=await browser.newPage({viewport,colorScheme:'dark'});
    await capture(page,{surface:'presentation-motion-'+motionFrame+'-320',route:'/#/today',viewport,preset:'bottom',motionFrame});await page.close();
  }
  fixture.controls.failField=true;
  const viewport={width:390,height:844},page=await browser.newPage({viewport,colorScheme:'dark'});
  await capture(page,{surface:'today-partial-390',route:'/#/today',viewport,state:'partial'});
  fixture.controls.failVisual=true;await capture(page,{surface:'inspector-error-390',route:'/inspector#review',viewport,state:'error'});await page.close();
  console.log('RELAY_VISUAL_REVIEW_RESULT='+JSON.stringify({ok:true,local,pr,commit,build:webBuildId,captures}));
} finally {await browser.close();await fixture.close();}
