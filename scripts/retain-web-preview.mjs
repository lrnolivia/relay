import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {webAssets,webBuildId,webSourceSha} from '../apps/web/generated.js';
import {createRetainedBundle} from '../apps/web/retained-bundle.mjs';
const expected=process.env.EXPECTED_SOURCE_SHA,clientId=process.env.CF_ACCESS_CLIENT_ID,clientSecret=process.env.CF_ACCESS_CLIENT_SECRET;
if(!/^[a-f0-9]{40}$/.test(expected||'')||expected!==webSourceSha||!clientId||!clientSecret)throw Error('Exact retained preview environment is incomplete');
const origin='https://relay.loew.fi',directory='qa-evidence/retained';await mkdir(directory,{recursive:true});
const headers={Authorization:JSON.stringify({'cf-access-client-id':clientId,'cf-access-client-secret':clientSecret}),'CF-Access-Client-Id':clientId,'CF-Access-Client-Secret':clientSecret};
const createdAt=execFileSync('git',['show','-s','--format=%cI',expected],{encoding:'utf8'}).trim();
const {bundle,sha256}=await createRetainedBundle({webAssets,sourceSha:expected,buildId:webBuildId,createdAt});
const id='rp_'+sha256;
let uploadError=null;
try{const upload=await fetch(origin+'/api/retained-preview',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(bundle),signal:AbortSignal.timeout(60000)});if(!upload.ok)throw Error('Retained upload failed: '+upload.status+' '+(await upload.text()).slice(0,200));const receipt=await upload.json();assert.equal(receipt.id,id);assert.equal(receipt.sha256,sha256);}catch(error){uploadError=error;}
// A lost upload response is reconciled by immutable identity, never blindly replayed.
const manifestResponse=await fetch(origin+'/api/retained-preview/'+id,{headers,signal:AbortSignal.timeout(45000)});
if(!manifestResponse.ok)throw uploadError||Error('Retained manifest readback failed: '+manifestResponse.status);
const manifest=await manifestResponse.json();assert.equal(manifest.sha256,sha256);assert.equal(manifest.source_sha,expected);assert.equal(manifest.data_mode,'synthetic');assert.ok(manifest.available);
const browser=await chromium.launch(),captures=[];
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}])for(const entry of ['app','inspector']){
  const page=await browser.newPage({viewport,colorScheme:'dark',reducedMotion:'reduce'});
  const hash=entry==='app'?'#/':'',url=origin+manifest.url+'?entry='+entry+hash;
  await page.route(origin+'/**',route=>route.continue({headers:{...route.request().headers(),...headers}}));
  const response=await page.goto(url);assert.ok(response.ok());assert.match(response.headers()['content-security-policy'],/sandbox allow-scripts;/);assert.doesNotMatch(response.headers()['content-security-policy'],/allow-same-origin/);
  if(entry==='app'){await page.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();await page.locator('.live-telemetry[data-loading=false]').waitFor();assert.equal(await page.getByRole('button',{name:'Open files',exact:true}).isDisabled(),true);}else await page.getByRole('heading',{name:'Inspector is in CTRL',exact:true}).waitFor();
  assert.equal(await page.locator('.operator-nav,.work-viewer,#review-list').count(),0,'new previews never expose retired full panels');
  const isolation=await page.evaluate(()=>({origin:window.origin,fixture:window.__retainedFixture?.data_mode,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(isolation.origin,'null');assert.equal(isolation.fixture,'synthetic');assert.equal(isolation.overflow,false);
  if(entry==='app'){await page.getByRole('button',{name:'connect your AI'}).click();await page.getByRole('heading',{name:'Connect your AI'}).waitFor();await page.getByLabel('Add Relay to AI').getByRole('button',{name:'Close',exact:true}).click();}
  const screenshot=await page.screenshot(),surface='retained-'+entry+'-'+viewport.width;
  await writeFile(directory+'/'+surface+'.png',screenshot);
  const metadata={kind:'retained_interactive_preview',target_url:origin+(entry==='inspector'?'/inspector':'/'),context:{project:'relay',environment:'preview',surface,commit_sha:expected},viewport,engine:'github-chromium',engine_reason:'retained_exact_build_verification',step_label:surface+' · exact retained build · sample data',title:'Retained '+expected.slice(0,7)+' · '+entry+' · sample data',dom:{fixture:true,data_mode:'synthetic',retained_preview:{id,entry,hash,sha256},build:webBuildId,qa_helper:{title:'Retained interactive build',purpose:'Try this exact build using sample data. Preview changes cannot affect real projects.',artifact:{repository:'lrnolivia/relay',head_sha:expected,environment:'preview',retained_build:id},questions:['Does the Relay connection and telemetry landing page remain clear at this width?','Does the compatibility page identify CTRL without showing a duplicate panel?'],checklist:['Inspect the Relay landing page and open/close connection guidance. Files and real connection actions are unavailable in the sample preview.','Preview changes reset; approve the build separately only when you are ready.'],overall_verdict:null,known_issues:[],visuals:{evidence_ids:[]}}},assertions:[{id:'opaque-origin',status:'pass',detail:'Browser window origin is null under HTTP sandbox.'},{id:'exact-bundle',status:'pass',detail:'Content-addressed manifest readback matches exact build.'},{id:'synthetic-data',status:'pass',detail:'Fixture adapter is active; no production API transport.'}],trace:[{action:'render_retained_build',url,source_sha:expected,data_mode:'synthetic'}]};
  const form=new FormData();form.set('metadata',JSON.stringify(metadata));form.set('screenshot',new Blob([screenshot],{type:'image/png'}),surface+'.png');
  const ingested=await fetch(origin+'/evidence/ingest',{method:'POST',headers,body:form,signal:AbortSignal.timeout(45000)});assert.ok(ingested.ok,'retained evidence upload: '+ingested.status);const evidence=await ingested.json();
  const linked=await fetch(origin+'/api/visual/'+evidence.evidence_id+'/live',{headers,signal:AbortSignal.timeout(45000)});assert.ok(linked.ok);assert.equal((await linked.json()).live?.retained?.id,id);
  const image=await fetch(origin+'/api/visual/'+evidence.evidence_id+'/image',{headers,signal:AbortSignal.timeout(45000)});assert.ok(image.ok);const returned=new Uint8Array(await image.arrayBuffer());const hashBytes=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(hashBytes(returned),hashBytes(screenshot));
  captures.push({surface,evidence_id:evidence.evidence_id,sha256:hashBytes(screenshot),bytes:screenshot.length});await page.close();
 }
 const receipt={ok:true,source_sha:expected,web_build:webBuildId,retained_id:id,bundle_sha256:sha256,url:origin+manifest.url,state:manifest.state,data_mode:'synthetic',captures};await writeFile(directory+'/receipt.json',JSON.stringify(receipt,null,2));console.log('RETAINED_PREVIEW_RESULT='+JSON.stringify(receipt));
}finally{await browser.close();}
