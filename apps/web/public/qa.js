import { deliverReview } from './qa-delivery.js';
import { loadingMarkup } from "./loading.js";
import { qaEscape, renderQaPanel, renderQaPreview } from "./qa-panel.js";
import { createQaFloat } from "./qa-float.js";
import { createQaViewport } from "./qa-viewport.js";
import { createQaContrast } from "./qa-contrast.js";
import { splitReviewNotes, joinReviewNotes } from './qa-notes.js';
import { publishNotification, resolveNotification } from '../../../packages/shared-ui/notifications.js';

const visualContent = document.querySelector('#visual-content');
const visualHeadingTools = document.querySelector('.visual-heading-tools');
let stage=null, state=null, questionIndex=0, previewMode='captured';
let viewportController=null, floatController=null, contrastController=null, historyToken=null;
let returnFocus=null, background=[];
let previewCheck=null;
const sessions = new Map();
const draftKey = id => 'relay.qa.draft.v1.' + id;
async function api(url, options = {}) {
  const response=await fetch(url,{headers:{'Content-Type':'application/json',Accept:'application/json'},signal:AbortSignal.timeout(15000),...options});
  const text=await response.text(); let body;
  try { body=text ? JSON.parse(text) : {}; } catch { body={error:'Unexpected response.'}; }
  if (!response.ok) throw new Error(body.error?.message || body.error || 'Request failed (' + response.status + ').');
  return body;
}
function selectedEvidenceId() {
  const active = visualContent && visualContent.querySelector("[data-evidence-id].active");
  if (active && active.dataset.evidenceId) return active.dataset.evidenceId;
  const image = visualContent && visualContent.querySelector('img[src*="/api/visual/vis_"]');
  if (!image) return null;
  const match = image.getAttribute("src").match(/\/api\/visual\/(vis_[a-zA-Z0-9-]+)\/image/);
  return match ? match[1] : null;
}

function ensureLaunch() {
  if (!visualHeadingTools || document.querySelector("#qa-review-launch")) return;
  const button = document.createElement("button");
  button.id = "qa-review-launch";
  button.className = "qa-launch";
  button.type = "button";
  button.textContent = "Review full screen";
  button.addEventListener("click", function () {
    const id = selectedEvidenceId();
    if (id) openQa(id);
  });
  visualHeadingTools.prepend(button);
}

function syncLaunch() {
  ensureLaunch();
  const button = document.querySelector("#qa-review-launch");
  if (!button) return;
  const id = selectedEvidenceId();
  button.disabled = !id;
  button.title = id ? "Review this capture in full-screen QA mode" : "Choose a capture first";
}

if (visualContent) {
  new MutationObserver(syncLaunch).observe(visualContent, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });
}
document.addEventListener("click", function () { setTimeout(syncLaunch, 0); });
syncLaunch();


function buildStage() {
  const node=document.createElement('section');
  node.className='qa-stage'; node.setAttribute('role','dialog'); node.setAttribute('aria-modal','true'); node.setAttribute('aria-label','Inspector review');
  node.innerHTML='<div class="qa-preview">' + loadingMarkup('preview','Loading review surface') + '</div>' +
    '<button type="button" class="qa-exit">Exit review</button>' +
    '<label class="qa-preview-picker"><span>Preview</span><select aria-label="Preview mode" disabled><option>Loading…</option></select></label>' +
    '<span class="qa-preview-state" role="status"></span>' +
    '<button type="button" class="qa-fit" aria-label="Fit preview" title="Fit preview">↔</button><button type="button" class="qa-panel-toggle" aria-label="Hide questions" title="Hide questions" aria-expanded="true">−</button>' +
    '<aside class="qa-companion" aria-label="Review questions"><div class="qa-review-loading">Loading review…</div></aside>';
  returnFocus=document.activeElement;
  background=Array.from(document.body.children).map(element=>({element,inert:element.inert}));
  background.forEach(({element})=>element.inert=true);
  document.body.append(node);document.body.classList.add('qa-open');
  node.querySelector('.qa-exit').addEventListener('click',()=>closeQa());
  node.querySelector('.qa-preview-picker select').addEventListener('change',event=>setView(event.target.value));
  node.querySelector('.qa-fit').addEventListener('click',()=>viewportController?.fit());
  node.querySelector('.qa-panel-toggle').addEventListener('click',event=>{
    const panel=node.querySelector('.qa-companion');panel.hidden=!panel.hidden;
    event.currentTarget.textContent=panel.hidden ? '?' : '−';
    event.currentTarget.setAttribute('aria-label',panel.hidden ? 'Show questions' : 'Hide questions');
    event.currentTarget.title=panel.hidden ? 'Show questions' : 'Hide questions';
    event.currentTarget.setAttribute('aria-expanded',String(!panel.hidden));
    if (!panel.hidden) requestAnimationFrame(()=>{floatController?.restore();floatController?.refresh();});
  });
  node.querySelector('.qa-exit').focus();
  return node;
}
function persistDraft(s) {
  try { sessionStorage.setItem(draftKey(s.evidence.evidence_id),JSON.stringify({review:s.review}));s.draftAvailable=true; }
  catch { s.draftAvailable=false; }
}
function setSaveState(s, status, error='') {
  s.saveStatus=status;s.saveError=error;
  if (state!==s || !stage) return;
  const labels={unsaved:'Not saved yet',saving:'Saving…',saved:'Saved',failed:'Save failed. Your responses are still here.'};
  stage.querySelectorAll('[data-qa-save-state]').forEach(output=>{output.textContent=labels[status] || status;output.dataset.state=status;if(error)output.textContent+=' '+error;if(s.dirty && s.draftAvailable===false)output.textContent+=' Reload recovery is unavailable in this browser. Keep this review open until saved.';});
  stage.querySelectorAll('[data-qa-retry]').forEach(retry=>retry.hidden=status!=='failed');
  requestAnimationFrame(()=>{if(state===s && stage && !stage.querySelector('.qa-companion').hidden)floatController?.refresh();});
}
function edited() { state.revision++;state.dirty=true;persistDraft(state);setSaveState(state,'saving'); }
function handlers() {
  return {
    answer(id,answer){edited();state.review.answers={...(state.review.answers||{}),[id]:answer};state.review.overall=null;persistDraft(state);repaintPanel('[data-qa-answer="'+answer+'"]');queueSave(100);},
    notes(notes){state.humanNotes=notes;state.review.notes=joinReviewNotes(state.noteParts.prefix,notes);edited();queueSave(650);},
    navigate(direction){questionIndex=Math.max(0,Math.min((state.questions||[]).length-1,questionIndex+direction));repaintPanel('.qa-question');},
    retry(){if(state.routingFailed)void handlers().finish();else void saveReview(state);},
    retained(){void reviewRetained();},
    async finish(){
      const active=state;
      if(!await saveReview(active)||state!==active)return;
      try {
        active.routingFailed=false;
        const delivery=await deliverReview({evidence:active.evidence,review:active.review,binding:active.feedbackBinding,api,storage:sessionStorage});
        if(state!==active)return;
        publishNotification({id:'qa:saved:'+active.evidence.evidence_id,feature:'inspector',project:active.evidence.context?.project||'',title:'Review saved',message:delivery.label,severity:'info',href:'/inspector#review?evidence='+encodeURIComponent(active.evidence.evidence_id),action:'Open review'});
        closeQa();
      } catch(error) { if(state===active){active.routingFailed=true;setSaveState(active,'failed','Notes saved. Feedback routing needs retry: '+error.message);} }
    }
  };
}
function repaintPanel(focusSelector) {
  if(!stage||!state)return;
  renderQaPanel(stage,state,questionIndex,handlers());setSaveState(state,state.saveStatus,state.saveError);
  if(focusSelector){const target=stage.querySelector(focusSelector);if(target){if(!target.matches('button,input,textarea'))target.tabIndex=-1;target.focus();}}
  requestAnimationFrame(()=>{if(!stage?.querySelector('.qa-companion').hidden)floatController?.refresh();});
}
function setView(mode) {
  if(!stage||!state)return;
  previewCheck?.abort();previewCheck=null;
  viewportController?.destroy();previewMode=renderQaPreview(stage,state,mode);
  viewportController=createQaViewport(stage,{mode:previewMode==='retained'?'live':previewMode});
  const select=stage.querySelector('.qa-preview-picker select'),canLive=Boolean(state.live?.active&&state.live?.embeddable&&state.live?.url);
  select.innerHTML='<option value="captured">Captured</option>'+(state.live.retained?'<option value="retained" '+(!state.live.retained.available?'disabled':'')+'>'+ (state.live.retained.available?'Retained build':'Retained · expired')+'</option>':'')+(state.evidence.video_url?'<option value="video">Recording</option>':'')+'<option value="live" '+(!canLive?'disabled':'')+'>'+(canLive?'Live':state.live.renderUnconfirmed?'Live unconfirmed':'Live unavailable')+'</option>';
  select.value=previewMode;select.disabled=false;
  stage.querySelector('.qa-preview-state').textContent=previewMode==='retained'?'Checking retained build · sample data…':previewMode==='live'?'Checking live preview…':previewMode==='video'?'Recorded evidence':'Captured evidence'+(state.live.renderUnconfirmed?' · live preview unconfirmed':!canLive?' · live preview unavailable':'');
  let direct=stage.querySelector('.qa-open-live');
  if(!direct){direct=document.createElement('a');direct.className='qa-open-live';direct.textContent='Open interactive preview';direct.target='_blank';direct.rel='noopener noreferrer';stage.append(direct);}
  let target;try{target=new URL(state.live?.retained?.available?state.live.retained.url:state.live?.url,location.origin);}catch{}
  const allowed=Boolean((state.live?.active||state.live?.retained?.available)&&target?.protocol==='https:'&&(target.hostname==='loew.fi'||target.hostname.endsWith('.loew.fi')));
  direct.hidden=!allowed||Boolean(state.live.retained);if(allowed)direct.href=target.href;else direct.removeAttribute('href');
  const frame=stage.querySelector('[data-qa-live-preview]');
  if(frame) checkLiveFrame(frame);
}
function checkLiveFrame(frame) {
  const currentStage=stage,currentState=state,check=new AbortController(),retained=frame.hasAttribute('data-qa-retained-preview');previewCheck=check;
  const current=()=>stage===currentStage && state===currentState && frame.isConnected && !check.signal.aborted;
  const fallback=(hard=false)=>{
    if(!current())return;
    if(retained){currentStage.querySelector('.qa-preview-state').textContent='Retained preview unconfirmed · Captured is still available.';return;}
    currentState.live={...currentState.live,renderUnconfirmed:true};
    if(hard||expectedOrigin===location.origin){setView('captured');currentStage.querySelector('.qa-preview-state').textContent='Live preview unconfirmed · captured evidence';}
    else currentStage.querySelector('.qa-preview-state').textContent='Live unconfirmed · open directly or choose Captured.';
  };
  // A browser may fire load for an error page and never fire iframe error.
  // Cross-origin frames without a readiness protocol remain explicitly unverified.
  // Keep the user's selected frame; never replace an available preview just because DOM access is blocked.
  let timer,navigation=0,nonce='';
  const expectedOrigin=retained?'null':new URL(currentState.live.url,location.origin).origin;
  window.addEventListener('message',event=>{
    if(!current()||event.source!==frame.contentWindow||event.origin!==expectedOrigin||!nonce||event.data?.nonce!==nonce)return;
    if(retained&&event.data?.type==='relay-retained-route') {
      const {entry,hash}=event.data;
      if(!['app','inspector'].includes(entry)||typeof hash!=='string'||hash.length>1000||!(entry==='inspector'?/^#review(?:\?.*)?$/:/^#\/(today|runner|night-shift)(?:[/?].*)?$/).test(hash))return;
      currentState.retainedNav={entry,hash};const url=new URL(currentState.live.retained.url,location.origin);url.searchParams.set('entry',entry);url.hash=hash;frame.src=url.href;return;
    }
    if(event.data?.type!=='relay-preview-ready')return;
    clearTimeout(timer);currentState.live={...currentState.live,renderUnconfirmed:false};currentStage.querySelector('.qa-preview-state').textContent=retained?'Retained '+currentState.live.retained.source_sha.slice(0,7)+' · sample data · ready':'Interactive preview ready';
  },{signal:check.signal});
  const waitForFrame=()=>{
    if(!current())return;
    navigation++;nonce=crypto.randomUUID();clearTimeout(timer);currentStage.querySelector('.qa-preview-state').textContent=retained?'Checking retained build · sample data…':'Checking live preview…';
    frame.contentWindow?.postMessage({type:'relay-preview-check',nonce},retained?'*':expectedOrigin);
    timer=setTimeout(fallback,8000);
  };
  waitForFrame();
  check.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});
  const confirm=async()=>{
    if(!current()||retained)return;
    const confirmingNavigation=navigation;
    let documentInFrame,target;
    try {
      target=new URL(currentState.live.url,location.origin);
      documentInFrame=frame.contentDocument;
      const rendered=new URL(documentInFrame?.location.href || 'about:blank');
      if(target.origin!==location.origin || rendered.origin!==target.origin || rendered.pathname!==target.pathname || rendered.search!==target.search || documentInFrame.readyState!=='complete' || !documentInFrame.body?.childElementCount)return;
    } catch { return; }
    try {
      const response=await fetch(target.href,{credentials:'same-origin',redirect:'error',cache:'no-store',signal:check.signal});
      if(!current() || navigation!==confirmingNavigation || frame.contentDocument!==documentInFrame)return;
      if(!response.ok){fallback(true);return;}
      // Confirm both an accessible rendered document and a successful HTTP
      // response. This is embedding readiness, not application-health proof.
      clearTimeout(timer);currentStage.querySelector('.qa-preview-state').textContent='Live preview';
    } catch { if(current() && navigation===confirmingNavigation)fallback(true); }
  };
  frame.addEventListener('load',()=>{waitForFrame();void confirm();},{signal:check.signal});
  frame.addEventListener('error',fallback,{signal:check.signal});
  void confirm();
}
export async function openQa(evidenceId) {
  if(stage)closeQa({popHistory:false});
  stage=buildStage();historyToken='relay-qa-'+Date.now().toString(36);history.pushState({...history.state,relayQaToken:historyToken,evidenceId},'',location.href);
  const openingStage=stage;
  const openingSession=sessions.get(evidenceId);
  const openingRevision=openingSession?.revision,openingConfirmation=openingSession?.confirmation || 0;
  const openingPending=Boolean(openingSession?.dirty || openingSession?.promise);
  try {
    const [payload,livePayload]=await Promise.all([api('/api/visual/'+encodeURIComponent(evidenceId)+'/qa'),api('/api/visual/'+encodeURIComponent(evidenceId)+'/live').catch(()=>({live:{active:false,embeddable:false}}))]);
    if(stage!==openingStage)return;
    const pending=sessions.get(evidenceId);
    let draft=null;try{draft=JSON.parse(sessionStorage.getItem(draftKey(evidenceId))||'null');}catch{}
    const changedWhileOpening=pending===openingSession && (openingPending || pending?.revision!==openingRevision || (pending?.confirmation || 0)!==openingConfirmation);
    const newerConfirmed=pending?.review.updated_at && (!payload.review?.updated_at || Date.parse(pending.review.updated_at)>Date.parse(payload.review.updated_at));
    state=pending && (pending.dirty || pending.promise || changedWhileOpening || newerConfirmed) ? pending : {evidence:payload.evidence,questions:payload.questions||[],review:draft?.review||payload.review||{answers:{},notes:'',overall:null},revision:0,confirmation:0,dirty:Boolean(draft),saveStatus:draft?'failed':payload.review?.updated_at?'saved':'unsaved',saveError:draft?'Recovered unsaved responses. Retry to save them.':'',timer:null,promise:null};
    state.feedbackBinding=payload.feedback_binding;state.evidence=payload.evidence;state.questions=payload.questions||[];state.live=livePayload.live||{};
    state.noteParts=splitReviewNotes(state.review.notes||'');state.humanNotes=state.noteParts.notes;
    sessions.set(evidenceId,state);
    const unanswered=state.questions.findIndex(question=>!state.review.answers?.[question.id]);questionIndex=unanswered>=0?unanswered:Math.max(0,state.questions.length-1);
    previewMode=state.live.retained?.available?'retained':state.live.active&&state.live.embeddable&&state.live.url?'live':state.evidence.video_url?'video':'captured';
    setView(previewMode);repaintPanel();
    contrastController=createQaContrast(stage);floatController=createQaFloat(stage,{onDockChange(edge){void contrastController?.update(edge);}});
    requestAnimationFrame(()=>floatController?.refresh());
  } catch(error) {
    if(stage!==openingStage)return;
    stage.querySelector('.qa-preview').innerHTML='<div class="qa-surface-error">Could not open this review. '+qaEscape(error.message)+'</div>';
    stage.querySelector('.qa-companion').innerHTML='<h2 class="qa-question">Could not open this review.</h2><p>'+qaEscape(error.message)+'</p>';
    publishNotification({id:'qa:open:'+evidenceId,feature:'inspector',title:'Review unavailable',message:'This review could not load. Try opening it again.',severity:'warning',href:'/inspector#review?evidence='+encodeURIComponent(evidenceId),action:'Open review'});
  }
}
function queueSave(delay=500) {const active=state;clearTimeout(active.timer);active.timer=setTimeout(()=>saveReview(active),delay);setSaveState(active,'saving');}
async function saveReview(active=state) {
  if(!active?.evidence)return false;
  clearTimeout(active.timer);active.timer=null;
  if(active.promise){active.saveAgain=true;return active.promise;}
  if(!active.dirty)return true;
  active.promise=(async()=>{
    do {
      active.saveAgain=false;const revision=active.revision;
      const review={answers:{...(active.review.answers||{})},notes:active.review.notes||'',overall:active.review.overall||null,disposition:active.review.disposition||null};
      setSaveState(active,'saving');
      try {
        const payload=await api('/api/visual/'+encodeURIComponent(active.evidence.evidence_id)+'/qa',{method:'POST',body:JSON.stringify({...review,feedback_transport:'schema2'})});
        if(!payload.review?.updated_at)throw new Error('The server did not confirm this save.');
        active.confirmation=(active.confirmation || 0)+1;
        if(active.revision===revision){active.review.updated_at=payload.review.updated_at;active.dirty=false;try{sessionStorage.removeItem(draftKey(active.evidence.evidence_id));}catch{}setSaveState(active,'saved');resolveNotification('qa:save:'+active.evidence.evidence_id);}
        else active.saveAgain=true;
      } catch(error) {
        persistDraft(active);setSaveState(active,'failed',error.message);
        publishNotification({id:'qa:save:'+active.evidence.evidence_id,feature:'inspector',project:active.evidence.context?.project||'',title:'Review was not saved',message:'Your responses are still here. Open the review and retry saving.',severity:'error',href:'/inspector#review?evidence='+encodeURIComponent(active.evidence.evidence_id),action:'Retry in review'});
        return false;
      }
    } while(active.saveAgain&&active.dirty);
    return !active.dirty;
  })();
  try{return await active.promise;}finally{active.promise=null;}
}
function closeQa({popHistory=true}={}) {
  const token=historyToken,active=state;
  if(active?.dirty)void saveReview(active);
  previewCheck?.abort();previewCheck=null;
  viewportController?.destroy();floatController?.destroy();contrastController?.destroy();
  viewportController=floatController=contrastController=null;
  stage?.remove();stage=null;state=null;historyToken=null;document.body.classList.remove('qa-open');
  background.forEach(({element,inert})=>element.inert=inert);background=[];
  if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;
  if(popHistory&&token&&history.state?.relayQaToken===token)history.back();
}
window.addEventListener('popstate',()=>{if(stage)closeQa({popHistory:false});});
window.addEventListener('keydown',event=>{
  if(!stage)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeQa();}
  if(event.key==='Tab'){
    const nodes=Array.from(stage.querySelectorAll('button:not(:disabled),select:not(:disabled),textarea,a[href]')).filter(node=>!node.closest('[hidden],dialog:not([open])'));
    if(!nodes.length)return;
    if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0].focus();}
  }
});
window.addEventListener('pagehide',()=>{if(state?.dirty)persistDraft(state);});


async function reviewRetained(){
 const active=state,retained=active?.live?.retained;if(!retained||active.retainedBusy)return;
 active.retainedBusy=true;repaintPanel();
 try{
  if(active.dirty&&!await saveReview(active))throw Error('Save your notes before reviewing the build.');
  const result=await api('/api/retained-preview/'+retained.id+'/review',{method:'POST',body:JSON.stringify({action:retained.state==='pending'?'approve':'reopen',expected_etag:retained.etag,operation_id:crypto.randomUUID()})});
  active.live.retained=result;
  if(state===active){setView(result.available?'retained':'captured');stage.querySelector('.qa-preview-state').textContent=result.state==='pending'?'Build review reopened · retained pending approval':'Build approved · retained for 30 days';}
 }catch(error){
  try{active.live.retained=await api('/api/retained-preview/'+retained.id);}catch{}
  if(state===active)stage.querySelector('.qa-preview-state').textContent=error.message+' Review status refreshed where available; no automatic retry.';
 }finally{active.retainedBusy=false;if(state===active)repaintPanel('[data-retained-review]');}
}
