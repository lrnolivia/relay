// Runs inside the existing card closure; all calls remain read-only host tools.
export const LIVE_WORK_SCRIPT=String.raw`(()=>{
  const terminal = new Set(['completed','complete','finished','cancelled','superseded','retired']);
  let frozen=null;
  let target=null, timer=null, flight=null, generation=0, failures=0, disposed=false, canonical=false, link=null;
  let checkedAt=null, newest=0, applying=false, inputKey=null, lastFailure=null;
  const seen=new Set(),list=x=>Array.isArray(x)?x:[];
  const note=document.createElement('p');note.id='card-freshness';note.className='micro';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
  document.querySelector('.actions').prepend(note);
  const diagnostics=document.createElement('pre');diagnostics.id='card-refresh-diagnostics';diagnostics.hidden=true;el.details.append(diagnostics);
  const descriptions={timeout:'The update took too long.',host_unavailable:'This chat has not connected live updates yet.',host_error:'The chat could not request an update.',provider_error:'Relay could not read the latest update.',missing_target:'This assignment was missing from the reply.',wrong_target:'A reply for another assignment was ignored.',stale_response:'An older update was ignored.',cancelled:'The update was cancelled.'};
  function recordFailure(error,bound){const raw=error?.cardDiagnostic||{},code=Object.hasOwn(descriptions,raw.code)?raw.code:'host_error';lastFailure={code,bridge:['openai','mcp','card'].includes(raw.bridge)?raw.bridge:'card',stage:['initialize','read','response'].includes(raw.stage)?raw.stage:'response',...(typeof raw.request==='string'&&/^card-read-[0-9]{1,9}$/.test(raw.request)?{request:raw.request}:{}),...(Number.isFinite(raw.elapsed_ms)?{elapsed_ms:Math.max(0,Math.min(300000,Math.round(raw.elapsed_ms)))}:{}),target:bound.ci?'ci':/^[a-z0-9-]{1,80}$/.test(bound.project)&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(bound.assignment)?bound.project+'/'+bound.assignment:'unavailable'};}
  function failure(code){return Object.assign(Error(code),{cardDiagnostic:{code,bridge:'card',stage:'response'}});}
  const key=t=>t?JSON.stringify(t):'';
  const time=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0;};
  const stamp=data=>time(data.generated_at||data.checked_at||data.ci?.observed_at);
  const stop=()=>{clearTimeout(timer);timer=null;};
  const item=data=>[data.claim,typeof data.assignment==='object'?data.assignment:null,...list(data.progress),...list(data.claims),...list(data.queue)].find(x=>x&&(x.assignment||x.id)===target?.assignment);
  function identify(data){
    const currentInput=JSON.stringify([toolInput?.project,toolInput?.assignment,toolInput?.repo,toolInput?.ref,toolInput?.owner]);
    if(inputKey&&inputKey!==currentInput){el.card._refreshTarget=null;el.card._refreshInputChanged=true;}
    inputKey=currentInput;

    if(data?.ci&&typeof toolInput?.repo==='string'&&typeof toolInput?.ref==='string')return {ci:true,args:{...(typeof toolInput.owner==='string'?{owner:toolInput.owner}:{}),repo:toolInput.repo,ref:toolInput.ref}};
    const navigation=el.card._refreshTarget;
    if(navigation&&(!data.project||data.project===navigation.project))return navigation.level==='assignment'?{project:navigation.project,assignment:navigation.assignment}:null;
    const project=data?.project||data?.work_card?.project;
    const rows=[data?.claim,typeof data?.assignment==='object'?data.assignment:null,...list(data?.progress),...list(data?.claims),...list(data?.queue)].filter(Boolean);
    const ids=[...new Set(rows.map(x=>x.assignment||x.id).filter(x=>typeof x==='string'))];
    const id=data?.work_card?.assignment||(typeof data?.assignment==='string'?data.assignment:null)||(rows.some(x=>(x.assignment||x.id)===toolInput?.assignment)?toolInput.assignment:null)||(ids.length===1?ids[0]:null);
    return typeof project==='string'&&typeof id==='string'?{project,assignment:id}:null;
  }
  function live(){if(frozen)return false;if(!target)return false;if(target.ci)return lastData?.ci?.live===true;return !terminal.has(String(item(lastData)?.state||'').toLowerCase());}
  function status(message){
    if(frozen){note.textContent=frozen.as_of?'Snapshot · '+new Date(frozen.as_of).toLocaleString():'Snapshot unavailable';note.hidden=false;el.refresh.hidden=true;return;}
    const checked=checkedAt?'Checked '+new Date(checkedAt).toLocaleTimeString()+'.':'Not checked yet.';
    note.textContent=message||(!target?'':disposed?'Live updates stopped.':document.hidden?'Live updates paused while hidden. '+checked:!live()?'Final recorded state. '+checked:failures?descriptions[lastFailure?.code||'host_error']+' '+(failures>=5?'Use Refresh to try again.':'Retrying automatically.')+' '+checked:'Live updates every '+(target.ci?'15':'30')+' seconds. '+checked);
    note.hidden=!note.textContent;diagnostics.hidden=!lastFailure;if(lastFailure){el.details.hidden=false;diagnostics.textContent='Live update diagnostics\n'+JSON.stringify(lastFailure,null,2);}else diagnostics.textContent='';
  }
  function schedule(delay){stop();if(disposed||document.hidden||!target||!live()||failures>=5)return;timer=setTimeout(()=>{timer=null;void refresh()},delay??(failures?Math.min(120000,15000*2**failures):target.ci?15000:30000));}
  function valid(data,t){
    if(!data||typeof data!=='object')return false;
    if(t.ci)return data.ci?.schema==='relay-ci-card/v1'&&(!data.ci.head_sha||!/^\w{40}$/.test(t.args.ref)||data.ci.head_sha===t.args.ref);
    return data.project===t.project&&Array.isArray(data.progress)&&[...data.progress,...list(data.queue)].some(x=>(x?.assignment||x?.id)===t.assignment);
  }
  async function refresh(manual=false){
    if(frozen||!target||disposed)return;
    if(manual){failures=0;stop();}
    if(flight)return flight.promise;
    if(document.hidden&&!manual)return;
    const bound=target,epoch=generation;
    const task={promise:null};flight=task;el.refresh.disabled=true;el.refresh.textContent='Refreshing…';
    task.promise=(async()=>{try{
      const result=await callTool(bound.ci?'relay_source_checks':'relay_runner_progress',bound.ci?bound.args:{project:bound.project,assignment:bound.assignment});
      if(disposed||epoch!==generation||key(bound)!==key(target))return;
      const data=unwrap(result);if(!valid(data,bound))throw failure(data?.project&&data.project!==bound.project?'wrong_target':'missing_target');
      if(stamp(data)&&stamp(data)<newest)throw failure('stale_response');
      // A successful read is freshness of the fetch, never proof of work progress.
      checkedAt=stamp(data)||Date.now();canonical=true;failures=0;lastFailure=null;applying=true;
      try{render(result);}finally{applying=false;}
      el.refresh.textContent='Refresh';
    }catch(error){if(epoch===generation&&!disposed){failures++;recordFailure(error,bound);el.refresh.textContent='Try refresh again';}}
    finally{if(flight===task)flight=null;el.refresh.disabled=false;if(!failures)el.refresh.textContent='Refresh';status();schedule(epoch===generation?undefined:0);}})();
    return task.promise;
  }
  function showLink(m){if(!m.ci_link){link?.remove();link=null;return;}if(!link){link=document.createElement('button');link.type='button';link.className='status-drilldown';link.textContent='Open CI run ›';link.addEventListener('click',async()=>{const href=link.dataset.href;try{if(window.openai?.openExternal){await window.openai.openExternal({href,redirectUrl:false});return;}await ready;await rpc('ui/open-link',{url:href});}catch{el.blocker.hidden=false;el.blocker.textContent='Open the run in your browser: '+href;}});}link.dataset.href=m.ci_link;el.rows.append(link)}
  const base=render;
  render=result=>{
    const incoming={...unwrap(result)};
    if(frozen)return;
    if(toolInput?.view==='current')incoming.card_mode='current';
    if(incoming?.card_mode==='snapshot'&&!model(incoming,DIRECTORY).snapshot){
      frozen={as_of:null};stop();generation++;lastData={ok:false,card_mode:'snapshot',error:{message:'The saved snapshot could not be verified. Request a new card.'}};base(lastData);el.refresh.hidden=true;note.textContent='Snapshot unavailable';return;
    }
    if(incoming?.card_mode==='snapshot'&&model(incoming,DIRECTORY).snapshot){
      const saved=window.openai?.widgetState?.relay_snapshot;
      const chosen=saved&&model({...saved.payload,snapshot:saved},DIRECTORY).snapshot&&saved.payload?.project===incoming.snapshot.payload?.project&&(saved.payload?.claim?.id||saved.payload?.claim?.assignment||null)===(incoming.snapshot.payload?.claim?.id||incoming.snapshot.payload?.claim?.assignment||null)?saved:incoming.snapshot;
      frozen=JSON.parse(JSON.stringify(chosen));stop();generation++;
      const data={...frozen.payload,card_mode:'snapshot',snapshot:frozen};lastData=data;base(data);
      el.card.dataset.snapshotId=frozen.id;el.card.dataset.cardMode='snapshot';
      if(window.openai?.setWidgetState)Promise.resolve(window.openai.setWidgetState({...window.openai.widgetState,relay_snapshot:frozen})).catch(()=>{});
      status();return;
    }
    el.card.dataset.cardMode='current';
    let data=incoming;if(!data||typeof data!=='object')return;
    const next=identify(data),changed=key(next)!==key(target),signature=JSON.stringify(data);
    if(!applying&&!changed&&seen.has(signature))return;
    if(!applying&&!changed&&newest&&stamp(data)&&stamp(data)<newest)return;
    if(!changed&&!el.card._refreshInputChanged&&target&&canonical&&valid(data,target)&&(result?.isError||data.ok===false||data.isError||data.error)){failures++;recordFailure(failure('provider_error'),target);status();schedule();return;}
    if(changed){generation++;stop();target=next;failures=0;lastFailure=null;canonical=false;checkedAt=null;newest=0;seen.clear();}
    else if(!applying)generation++;
    seen.clear();seen.add(signature);
    // A newer routing notification requests fresh observation; it cannot replace
    // already observed progress with an Assigned snapshot while that read runs.
    if(!applying&&!changed&&canonical&&target&&!target.ci&&!Array.isArray(data.progress)){status();schedule(0);return;}
    newest=Math.max(newest,stamp(data));
    if(Array.isArray(data.progress)||data.ci){checkedAt=stamp(data)||checkedAt;canonical=true;if(target&&data.ok!==false&&!data.isError&&!data.error&&valid(data,target)){failures=0;lastFailure=null;}}
    if(target&&!target.ci&&Array.isArray(data.progress)){const rows=data.progress.filter(x=>(x?.assignment||x?.id)===target.assignment);data={...data,progress:rows,queue:rows.length?[]:list(data.queue).filter(x=>(x?.assignment||x?.id)===target.assignment),claims:[],claim:undefined};}
    base(data);showLink(model(data,DIRECTORY));status();
    if(!flight)schedule(changed&&!data.work_card&&!data.ci?350:undefined);
  };
  // Capture before both the ordinary and explorer button handlers: one target,
  // one in-flight read, regardless of manual/automatic trigger.
  window.addEventListener('click',event=>{if(event.target.closest?.('#refresh')&&target){event.preventDefault();event.stopImmediatePropagation();void refresh(true);}},true);
  document.addEventListener('visibilitychange',()=>{stop();status();if(!document.hidden){failures=0;schedule(0);}});
  window.addEventListener('online',()=>{failures=0;schedule(0);});
  window.addEventListener('pagehide',()=>{disposed=true;generation++;stop();});
  window.addEventListener('pageshow',()=>{if(disposed){disposed=false;failures=0;schedule(0);}});
  document.addEventListener('relay:target-change',()=>{const nav=el.card._refreshTarget,next=nav?.level==='assignment'?{project:nav.project,assignment:nav.assignment}:null;if(key(next)===key(target))return;generation++;stop();target=next;failures=0;lastFailure=null;canonical=false;newest=0;checkedAt=null;seen.clear();status();schedule(0);});
  if(lastData)render(lastData);
})();`.split("\n").filter(line=>!line.trimStart().startsWith("//")).map(line=>line.trim()).join("\n");
