import { workspaceLink, CTRL_ORIGIN } from './workspace-links.js';
import {captureMotionLayout,settleMotionLayout} from "./field-springs.js";
import {projectInGroup} from "./project-groups.js";
import {glyph} from './glyphs.js';
import {reviewKey,effectiveReview,selectWork,reviewTransition} from './work-view-model.js';
import {iconSlot,hydrateProjectIcons} from '../../apps/web/public/project-icons.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={pending:'Need review',completed:'Completed',stale:'Stale',archived:'Archived',all:'All'};
const names={relay:'relay',field:'field',loewfi:'loew.fi',rtxforge:'rtxForge','bazzite-custom':'loewOS',gamebridge:'GameBridge'};
const name=id=>names[id]||id.replace(/[-_]+/g,' ');
export function projectBadge(project){return '<span class="work-project-badge">'+iconSlot(project)+'<strong>'+escape(name(project))+'</strong></span>';}
function safeHref(value){try{const url=new URL(value,location.origin);return url.origin===CTRL_ORIGIN?url.href:url.origin===location.origin?url.pathname+url.search+url.hash:'';}catch{return '';}}
async function request(action,items){
 const response=await fetch('/api/work-review',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({action,items}),signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw new Error('Review storage returned '+response.status+'. Refresh before trying again.');
 return response.json();
}
export function bindWorkViewer(root,{id,defaultView='list',onOpen,initialFilter='pending',predicates={},extensionControls=[]}={}){
 let items=[],records={},loaded=false,incomplete=true,project='',view=defaultView,query={filter:initialFilter,search:'',sort:'time',direction:'desc',extensions:{}},selection=new Set(),scope='selected',pending=null,undo=[],busy=false,message='',generation=0,disposed=false;
 const storageKey='relay.work-view.'+id;let anchorRestored=false;const fresh=new Set();
 try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved){view=['list','visual'].includes(saved.view)?saved.view:defaultView;const prior=saved.query||{};query={...query,filter:Object.hasOwn(labels,prior.filter)?prior.filter:initialFilter,search:typeof prior.search==='string'?prior.search:'',sort:['time','importance'].includes(prior.sort)?prior.sort:'time',direction:['asc','desc'].includes(prior.direction)?prior.direction:'desc',extensions:prior.extensions&&typeof prior.extensions==='object'&&!Array.isArray(prior.extensions)?prior.extensions:{}};}}catch{}
 const save=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({view,query}));}catch{}};
 const visible=()=>selectWork(items,{...query,project},records,predicates);
 const targets=()=>scope==='selected'?items.filter(item=>selection.has(reviewKey(item))):scope==='all-projects'?selectWork(items,{...query,project:''},records,predicates):visible();
 const changedTargets=action=>targets().filter(item=>action==='clear-stale'?effectiveReview(item,records[reviewKey(item)]).status==='stale'&&!effectiveReview(item,records[reviewKey(item)]).archived:action==='clear-complete'?effectiveReview(item,records[reviewKey(item)]).status==='completed'&&!effectiveReview(item,records[reviewKey(item)]).archived:true);
 function render(){
  if(disposed)return;
  const motionBefore=captureMotionLayout(root);
  const focus=root.contains(document.activeElement)?document.activeElement:null,focusName=focus?.getAttribute('data-focus'),start=focus?.selectionStart,end=focus?.selectionEnd;
  const anchor=[...root.querySelectorAll('[data-work-key]')].find(node=>node.getBoundingClientRect().bottom>0);
  const anchorKey=anchor?.dataset.workKey,anchorY=anchor?.getBoundingClientRect().top;
  const rows=visible(),visibleKeys=new Set(rows.map(reviewKey)),hidden=[...selection].filter(key=>!visibleKeys.has(key)).length;
  root.removeAttribute('aria-live');root.className='work-viewer'+(root.id==='review-list'?' review-list':'');root.dataset.summaryState=loaded&&(items.length||!incomplete)?'ready':'loading';root.dataset.summaryNeeds=String(items.filter(item=>projectInGroup(item.project,project)&&!effectiveReview(item,records[reviewKey(item)]).archived&&effectiveReview(item,records[reviewKey(item)]).status==='pending').length);root.dataset.summaryVisible=String(rows.length);root.dataset.view=view;root.setAttribute('aria-busy',String(busy));
  root.innerHTML=`<div class="work-view-controls">
   <div class="work-filter-bar" role="group" aria-label="Review status">${Object.entries(labels).map(([value,label])=>`<button type="button" data-filter="${value}" data-focus="filter-${value}" aria-pressed="${query.filter===value}">${label}</button>`).join('')}</div>
   <div class="work-query-bar"><label>Search<input data-focus="search" name="search" type="search" value="${escape(query.search)}" placeholder="Find work"></label>
   <label>Sort<select data-focus="sort" name="sort"><option value="time" ${query.sort==='time'?'selected':''}>Time</option><option value="importance" ${query.sort==='importance'?'selected':''}>Importance</option></select></label>
   <label>Order<select data-focus="direction" name="direction"><option value="desc" ${query.direction==='desc'?'selected':''}>${query.sort==='time'?'Newest first':'Highest first'}</option><option value="asc" ${query.direction==='asc'?'selected':''}>${query.sort==='time'?'Oldest first':'Lowest first'}</option></select></label>
   ${extensionControls.map(control=>`<label>${escape(control.label)}<select name="extension:${escape(control.key)}" data-focus="extension:${escape(control.key)}"><option value="">All</option>${control.options.map(option=>`<option value="${escape(option.value)}" ${query.extensions[control.key]===option.value?'selected':''}>${escape(option.label)}</option>`).join('')}</select></label>`).join('')}
   <div class="work-view-switch" role="group" aria-label="Work presentation">${['list','visual'].map(value=>`<button type="button" data-view="${value}" data-focus="view-${value}" aria-pressed="${view===value}">${value==='list'?'List':'Visual'}</button>`).join('')}</div></div>
   <p class="work-query-help">Time follows source activity. Importance uses reported priority; missing values stay unranked. Review status never changes the source task.</p>
   <div class="work-selection-bar"><label><input type="checkbox" data-select-visible data-focus="select-visible" ${rows.length&&rows.every(item=>selection.has(reviewKey(item)))?'checked':''}>Select these ${rows.length} items</label><span>${selection.size} selected${hidden?' · '+hidden+' outside these results':''}</span><button type="button" data-clear-selection ${!selection.size?'disabled':''}>Clear selection</button></div>
   <div class="work-bulk-bar"><label>Action scope<select name="scope" data-focus="scope"><option value="selected" ${scope==='selected'?'selected':''}>Selected items</option><option value="filtered" ${scope==='filtered'?'selected':''}>Current filtered results</option><option value="all-projects" ${scope==='all-projects'?'selected':''}>All projects · matching loaded results</option></select></label>
   ${[['pending','Reopen'],['completed','Mark complete'],['stale','Mark stale'],['clear-complete','Clear complete'],['clear-stale','Clear stale'],['restore','Restore']].map(([action,label])=>`<button type="button" data-bulk="${action}" ${busy||!loaded||!changedTargets(action).length?'disabled':''}>${label}</button>`).join('')}</div>
   ${incomplete?'<p class="work-query-help">Some source results are unavailable or this feed is bounded. Actions affect only the exact loaded items shown in the confirmation.</p>':''}
   ${pending?`<div class="work-confirm" role="group" aria-label="Confirm review changes"><strong>${escape(pending.label)}: ${pending.items.length} item${pending.items.length===1?'':'s'} in ${new Set(pending.items.map(item=>item.project)).size} project(s)</strong><p>${escape(pending.scope)}. ${escape(query.search?'Search: '+query.search+'. ':'')}Source tasks and PRs remain unchanged.</p><button type="button" data-confirm ${busy?'disabled':''}>Apply to these ${pending.items.length} items</button><button type="button" data-cancel ${busy?'disabled':''}>Cancel</button></div>`:''}
   <div class="work-message" role="status">${escape(message)}${!loaded&&!busy?'<button type="button" data-refresh>Refresh review state</button>':''}${undo.length?'<button type="button" data-undo '+(busy?'disabled':'')+'>Undo last change</button>':''}</div>
  </div>
  <div class="work-results" aria-label="Work items">${rows.length?rows.map(item=>{
   const key=reviewKey(item),review=effectiveReview(item,records[key]),url=safeHref(item.href||'');
   const title=item.kind==='evidence'?`<button type="button" class="work-open review-open" aria-label="Open ${escape(item.title)}" data-review-id="${escape(item.id)}" data-open="${escape(key)}">${escape(item.title)}</button>`:url?`<a class="work-open" href="${escape(url)}" data-anchor="${escape(key)}">${escape(item.title)}</a>`:`<strong>${escape(item.title)}</strong>`;
   const image=item.screenshot&&safeHref(item.screenshot);
   return `<article class="work-item${item.kind==='evidence'?' review-row':''}" data-work-key="${escape(key)}" data-new-work="${fresh.has(key)}" tabindex="-1"><label class="work-select"><input type="checkbox" data-select="${escape(key)}" data-focus="select-${escape(key)}" ${selection.has(key)?'checked':''} aria-label="Select ${escape(item.title)} in ${escape(name(item.project))}"></label>
    <div class="work-item-visual" aria-hidden="true">${image?`<img src="${escape(image)}" alt="" loading="lazy">`:glyph(item.kind==='check'?'moon':item.sourceState==='blocked'?'repair':'play')}</div>
    <div class="work-item-copy">${projectBadge(item.project)}<h3>${title}</h3><p>${escape(item.detail)}</p><p class="work-next"><span>${item.detail&&['blocked','failed'].includes(item.sourceState)?'Blocked':'Next'}</span> ${escape(item.next)}</p>
    <div class="work-item-meta"><span>Review: ${review.archived?'Archived · ':''}${labels[review.status]}</span><span>Source: ${escape(item.sourceState)}</span><time ${item.time==null?'':`datetime="${new Date(item.time).toISOString()}"`}>${item.time==null?'Time unknown':new Date(item.time).toLocaleString()}</time><span>${escape(item.priority||'Unranked')}</span></div>
    <details><summary>Details</summary><div class="work-source-detail"><code>${escape(item.id)}</code>${item.source?.identities?.branch?`<p>Branch: ${escape(item.source.identities.branch)}</p>`:''}${item.source?.identities?.head_sha?`<p>Head: ${escape(item.source.identities.head_sha)}</p>`:''}${item.source?.identities?.pr?`<p>PR: ${escape(item.source.identities.pr)}</p>`:''}<p>${escape(item.source?.next_action||item.source?.runtime?.last_summary||'')}</p></div></details></div></article>`;
  }).join(''):`<div class="empty-card"><strong>${items.length?'No matching work.':incomplete?'Waiting for source results.':'No work to show yet.'}</strong><p>${items.length?'Try All or change your search.':'Work appears when Relay receives source activity.'}</p></div>`}</div>`;
  settleMotionLayout(root,motionBefore);
  for(const item of rows)fresh.delete(reviewKey(item));
  void hydrateProjectIcons(root);
  if(focusName){const next=[...root.querySelectorAll('[data-focus]')].find(node=>node.dataset.focus===focusName);next?.focus({preventScroll:true});if(start!=null&&typeof next?.setSelectionRange==='function')try{next.setSelectionRange(start,end);}catch{}}
  if(anchorKey&&focusName?.startsWith('view-')){const next=[...root.querySelectorAll('[data-work-key]')].find(node=>node.dataset.workKey===anchorKey);if(next)window.scrollBy(0,next.getBoundingClientRect().top-anchorY);}
 }
 async function loadRecords(){
  if(busy){loaded=false;return;}
  const gen=++generation;loaded=false;render();
  try{
   const found={};
   for(let start=0;start<items.length;start+=100){const response=await request('read',items.slice(start,start+100).map(({project,kind,id})=>({project,kind,id})));if(response.results.some(row=>!row.ok))throw new Error('Some review states could not load. Refresh before changing them.');for(const row of response.results){const item=items.find(candidate=>reviewKey(candidate)===row.key),legacy=item?.source?.qaReview;found[row.key]=row.record?{...row.record,etag:row.etag}:legacy?{etag:null,source_revision:item.revision,status:legacy.disposition==='archived'?'stale':['completed','stale'].includes(legacy.disposition)?legacy.disposition:legacy.overall?'completed':'pending',archived:legacy.disposition==='archived'}:{etag:null};}}
   if(disposed||gen!==generation)return;records=found;loaded=true;message='';render();
  }catch(error){if(!disposed&&gen===generation){message=error.message;render();}}
 }
 async function apply(changes,isUndo=false){
  if(busy)return;busy=true;pending=null;message='Saving review changes…';render();const accepted=[],errors=[];
  try{
   for(let start=0;start<changes.length;start+=100){const batch=changes.slice(start,start+100);const response=await request('set',batch.map(change=>change.payload));
    for(const row of response.results){const change=batch.find(entry=>entry.key===row.key);if(row.ok){records[row.key]={...row.record,etag:row.etag};accepted.push({key:row.key,item:change.item,before:change.before,after:records[row.key]});}else errors.push(row.error);}
   }
   undo=isUndo?[]:accepted;message=`${accepted.length} review item(s) updated.`+(errors.length?' '+errors.length+' not changed: '+errors[0]:'');
  }catch(error){loaded=false;message='The save result is uncertain. Refresh review state before trying again. '+error.message;undo=isUndo?[]:accepted;}
  finally{busy=false;render();if(!loaded)void loadRecords();}
 }
 function newWork(event){for(const item of event.detail||[])fresh.add(reviewKey(item));}
 function reveal(){
  const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('item');if(!requested)return;
  const item=items.find(item=>item.id===requested&&projectInGroup(item.project,project));
  if(!item){message='This item is no longer available in the loaded results.';render();return;}
  query.filter='all';query.search='';save();render();const node=[...root.querySelectorAll('[data-work-key]')].find(node=>node.dataset.workKey===reviewKey(item));node?.focus({preventScroll:true});node?.scrollIntoView({block:'center'});
 }
 function click(event){
  const button=event.target.closest('button,a');if(!button)return;
  if(button.hasAttribute('data-refresh'))void loadRecords();
  if(button.dataset.filter){query.filter=button.dataset.filter;pending=null;save();render();}
  if(button.dataset.view){view=button.dataset.view;save();render();}
  if(button.hasAttribute('data-clear-selection')){selection.clear();pending=null;render();}
  if(button.dataset.bulk){const action=button.dataset.bulk;pending={action,label:button.textContent,items:changedTargets(action).map(item=>({...item})),scope:scope==='selected'?`${selection.size} selected, including ${[...selection].filter(key=>!visible().some(item=>reviewKey(item)===key)).length} outside these results`:scope==='all-projects'?'All projects, matching loaded results':`Current results in ${project?name(project):'all projects'}`};render();root.querySelector('[data-confirm]')?.focus();}
  if(button.hasAttribute('data-cancel')){pending=null;render();}
  if(button.hasAttribute('data-confirm')&&pending){const action=pending.action.startsWith('clear-')?'archive':pending.action;void apply(pending.items.map(item=>{const key=reviewKey(item),before=effectiveReview(item,records[key]),after=reviewTransition(before,action);return {key,item,before,payload:{project:item.project,kind:item.kind,id:item.id,source_revision:item.revision,expected_etag:records[key]?.etag??null,operation_id:crypto.randomUUID(),...after}};}));}
  if(button.hasAttribute('data-undo'))void apply(undo.map(entry=>({key:entry.key,item:entry.item,before:effectiveReview(entry.item,entry.after),payload:{project:entry.item.project,kind:entry.item.kind,id:entry.item.id,source_revision:entry.item.revision,expected_etag:entry.after.etag,operation_id:crypto.randomUUID(),...entry.before}})),true);
  if(button.dataset.open)onOpen?.(items.find(item=>reviewKey(item)===button.dataset.open));
  if(button.dataset.anchor)try{sessionStorage.setItem(storageKey+'.anchor',button.dataset.anchor);}catch{}
 }
 function change(event){
  const control=event.target;
  if(control.matches('[data-select-visible]')){for(const item of visible())control.checked?selection.add(reviewKey(item)):selection.delete(reviewKey(item));pending=null;render();return;}
  if(control.dataset.select){control.checked?selection.add(control.dataset.select):selection.delete(control.dataset.select);pending=null;render();return;}
  if(control.name==='scope'){scope=control.value;pending=null;render();return;}
  if(['sort','direction'].includes(control.name)){query[control.name]=control.value;pending=null;save();render();}
  if(control.name?.startsWith('extension:')){query.extensions[control.name.slice(10)]=control.value;save();render();}
 }
 function input(event){if(event.target.name==='search'){query.search=event.target.value;pending=null;save();render();}}
 window.addEventListener('relay:work-arrivals',newWork);window.addEventListener('hashchange',reveal);root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('input',input);
 return {
  update(next,{project:nextProject='',incomplete:partial=false}={}){const identity=next.map(item=>reviewKey(item)+':'+item.revision).join('|'),old=items.map(item=>reviewKey(item)+':'+item.revision).join('|');items=next;project=nextProject;incomplete=partial;if(identity!==old){pending=null;loaded=false;}render();if(identity!==old||!loaded)void loadRecords();if(!anchorRestored&&items.length){anchorRestored=true;let saved;try{saved=sessionStorage.getItem(storageKey+'.anchor');}catch{}const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('item');const node=[...root.querySelectorAll('[data-work-key]')].find(node=>requested?items.find(item=>item.id===requested&&reviewKey(item)===node.dataset.workKey):node.dataset.workKey===saved);if(node){node.focus({preventScroll:true});node.scrollIntoView({block:'center'});}}},
  refresh(){void loadRecords();},
  destroy(){window.removeEventListener('relay:work-arrivals',newWork);window.removeEventListener('hashchange',reveal);disposed=true;generation++;root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('input',input);}
 };
}
