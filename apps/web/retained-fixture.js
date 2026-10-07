import {reviewBatch} from '../../packages/runner/src/work-review.mjs';
import {workerSource} from '../../packages/shared-ui/work-view-model.js';
// This adapter is bundled ONLY into retained review documents, never production
// web assets. CSP and the opaque HTTP sandbox enforce the network/storage boundary.
const config=window.__RETAINED_BUILD__||{},now=config.created_at||'2026-10-02T00:00:00.000Z';
function memoryStorage(){const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(String(key))??null,setItem(key,value){if(values.size<100&&String(value).length<=32768)values.set(String(key),String(value));},removeItem:key=>values.delete(String(key)),clear:()=>values.clear()};}
for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{value:memoryStorage(),configurable:false});
const projects=[{id:'relay',name:'relay',managed:true},{id:'field',name:'field',managed:true}];
const progress={relay:[{assignment:'sample-layout',goal:'Review the retained interface',state:'working',stage:'implementation',next_action:'Try the controls using sample data',last_meaningful_progress_at:now,events:[]}],field:[{assignment:'sample-review',goal:'Check the portrait editing direction',state:'waiting-for-human',stage:'review',waiting_reason:'Sample review item',next_action:'Inspect the example without changing a real project',last_meaningful_progress_at:now,events:[]}]};
const workers=[{id:'relay',enabled:true,runtime:{status:'idle',last_run_at:now,next_run_at:null,last_summary:'This is synthetic preview activity.'}},{id:'field',enabled:false,runtime:{status:'idle',last_run_at:now,last_summary:'No worker runs from this retained build.'}}];
const sampleImage='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 480"><rect width="720" height="480" fill="#151412"/><rect x="30" y="30" width="90" height="420" rx="20" fill="#25231f"/><rect x="146" y="30" width="544" height="86" rx="20" fill="#ff6f78"/><rect x="146" y="138" width="264" height="144" rx="20" fill="#25231f"/><rect x="428" y="138" width="262" height="144" rx="20" fill="#25231f"/><rect x="146" y="302" width="544" height="148" rx="20" fill="#25231f"/><circle cx="75" cy="76" r="19" fill="#3bcb8d"/><text x="170" y="85" fill="#151412" font-family="sans-serif" font-size="28">sample capture</text></svg>');
const evidence=projects.map(p=>({evidence_id:'vis_retained-sample-'+p.id,captured_at:now,title:p.name+' example capture',step_label:p.name+' sample preview',target_url:'https://relay.loew.fi',screenshot_url:'/api/visual/vis_retained-sample-'+p.id+'/image',context:{project:p.id,environment:'preview',commit_sha:config.source_sha},dom:{fixture:true}}));
const values=new Map(),qa=new Map();let sequence=0;
const bucket={async get(key){const item=values.get(key);return item?{etag:item.etag,json:async()=>JSON.parse(item.body)}:null;},async put(key,body,options){const previous=values.get(key);if(options.onlyIf.etagMatches&&previous?.etag!==options.onlyIf.etagMatches||options.onlyIf.etagDoesNotMatch==='*'&&previous)return null;const etag=String(++sequence);values.set(key,{etag,body});return {etag};}};
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
window.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href),method=String(options.method||input.method||'GET').toUpperCase();
 if(url.origin!==location.origin)return respond({error:'External requests are unavailable in a retained preview.'},403);
 let body;try{body=typeof options.body==='string'?JSON.parse(options.body):null;}catch{return respond({error:'Invalid sample request'},400);}
 if(url.pathname==='/api/work-review'&&method==='POST')return respond(await reviewBatch(bucket,body,item=>item.kind==='evidence'?evidence.find(e=>e.evidence_id===item.id):item.kind==='check'?workerSource(workers.find(w=>w.id===item.id)):(progress[item.project]||[]).find(p=>p.assignment===item.id)));
 if(method==='GET'&&url.pathname==='/api/projects')return respond({projects});
 if(method==='GET'&&url.pathname==='/api/workers')return respond(workers);
 const project=url.pathname.match(/^\/api\/projects\/(relay|field)$/);if(method==='GET'&&project)return respond({project:projects.find(p=>p.id===project[1]),coordination:{claims:progress[project[1]].map(p=>({id:p.assignment,state:'active'})),queue:[]}});
 if(/\/api\/projects\/[^/]+\/icon$/.test(url.pathname))return respond({status:'unavailable'});
 const work=url.pathname.match(/^\/api\/progress\/(relay|field)$/);if(method==='GET'&&work)return respond({project:work[1],progress:progress[work[1]].filter(p=>!url.searchParams.get('assignment')||p.assignment===url.searchParams.get('assignment')),queue:[]});
 if(method==='GET'&&url.pathname==='/api/visual')return respond({evidence,partial:false});
 const review=url.pathname.match(/^\/api\/visual\/(vis_retained-sample-(?:relay|field))\/(qa|live)$/);
 if(review){const item=evidence.find(e=>e.evidence_id===review[1]);if(review[2]==='live')return respond({live:{active:false,embeddable:false,reason:'Synthetic preview; no mutable live connection.'}});if(method==='POST')qa.set(review[1],{...body,updated_at:new Date().toISOString()});return respond({ok:true,evidence:{...item,screenshot_url:sampleImage},questions:[{id:'sample-review',prompt:'Does this sample layout feel clear?',reason:'Your preview answers stay in memory.',answers:['yes','no','not_sure']}],review:qa.get(review[1])||null});}
 return respond({error:'Unavailable in this synthetic preview. No live request was sent.'},410);
};
// Non-fetch image loads also stay local. The CSP blocks any attempted network
// image; these exact fixture-only paths become embedded sample artwork.
const images=()=>document.querySelectorAll('img[src^="/api/visual/"]').forEach(img=>{img.src=sampleImage;});
new MutationObserver(images).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
let challenge='';
window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='relay-preview-check'||typeof event.data.nonce!=='string'||event.data.nonce.length>100)return;
 challenge=event.data.nonce;const nonce=challenge;let attempts=0;
 const ready=()=>{if(challenge!==nonce||++attempts>200)return;if(!document.querySelector('.relay-home,[data-relay-ctrl-handoff]')||document.querySelector('.live-telemetry')?.getAttribute('data-loading')==='true')return setTimeout(ready,25);parent.postMessage({type:'relay-preview-ready',nonce:challenge,retained:true},event.origin);};ready();
});
function announce(message){let node=document.querySelector('#retained-notice');if(!node){node=document.createElement('div');node.id='retained-notice';node.setAttribute('role','status');node.style.cssText='position:fixed;bottom:8px;right:8px;max-width:280px;padding:8px 12px;border-radius:12px;background:#292621;color:#f6f2ed;font:12px/1.4 sans-serif;z-index:2147483647;pointer-events:none';document.body.append(node);}node.textContent=message;}
function changeDocument(entry,hash){
 if(parent!==window&&challenge){parent.postMessage({type:'relay-retained-route',nonce:challenge,entry,hash},location.origin);return;}
 const next=new URL(location.href);next.searchParams.set('entry',entry);next.hash=hash;location.assign(next.href);
}
document.addEventListener('click',event=>{
 const control=event.target instanceof Element?event.target.closest('a[href],[data-nav]'):null;if(!control)return;
 const nav=control.getAttribute('data-nav');if(nav){event.preventDefault();event.stopImmediatePropagation();changeDocument('app','#/'+({today:'today',projects:'runner','night-shift':'night-shift'}[nav]||'today'));return;}
 const href=control.getAttribute('href');if(!href)return;let target;try{target=new URL(href,location.origin);}catch{return;}
 if(target.origin===location.origin&&target.pathname==='/inspector'){event.preventDefault();event.stopImmediatePropagation();changeDocument('inspector',target.hash||'#review');return;}
 if(target.origin===location.origin&&target.pathname==='/'&&/^#\/(today|runner|night-shift)(?:[/?].*)?$/.test(target.hash)){
  if(config.entry==='inspector'){event.preventDefault();event.stopImmediatePropagation();changeDocument('app',target.hash);}return;
 }
 if(target.origin!==location.origin||!href.startsWith('#')){event.preventDefault();event.stopImmediatePropagation();announce('Preview only. External destinations and real actions are not opened.');}
},true);
if(parent===window)document.addEventListener('DOMContentLoaded',()=>announce('Retained '+String(config.source_sha||'').slice(0,7)+' · sample data · changes reset on reload'),{once:true});
window.__retainedFixture={data_mode:'synthetic',reviewRecordCount:()=>values.size};
