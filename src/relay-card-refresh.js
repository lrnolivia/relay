// Runs inside the existing card closure; all calls remain read-only host tools.
export const LIVE_WORK_SCRIPT=String.raw`(()=>{
  const terminal = new Set(['completed','complete','finished','cancelled','superseded','retired']);
  let target=null, timer=null, flight=null, generation=0, failures=0, disposed=false, canonical=false, link=null;
  let checkedAt=null, newest=0, applying=false;
  const seen=new Set();
  const note=document.createElement('p');note.id='card-freshness';note.className='micro';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
  document.querySelector('.actions').before(note);
  const key=t=>t?JSON.stringify(t):'';
  const time=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0;};
  const stamp=data=>time(data.generated_at||data.checked_at||data.ci?.observed_at);
  const stop=()=>{clearTimeout(timer);timer=null;};
  const item=data=>[data.claim,typeof data.assignment==='object'?data.assignment:null,...data.progress||[],...data.claims||[],...data.queue||[]].find(x=>x&&(x.assignment||x.id)===target?.assignment);
  function identify(data){
    if(data?.ci&&typeof toolInput?.repo==='string'&&typeof toolInput?.ref==='string')return {ci:true,args:{...(typeof toolInput.owner==='string'?{owner:toolInput.owner}:{}),repo:toolInput.repo,ref:toolInput.ref}};
    const navigation=el.card._refreshTarget;
    if(navigation)return navigation.level==='assignment'?{project:navigation.project,assignment:navigation.assignment}:null;
    const project=data?.project||data?.work_card?.project;
    const rows=[data?.claim,typeof data?.assignment==='object'?data.assignment:null,...data?.progress||[],...data?.claims||[],...data?.queue||[]].filter(Boolean);
    const id=data?.work_card?.assignment||(typeof data?.assignment==='string'?data.assignment:null)||(rows.some(x=>(x.assignment||x.id)===toolInput?.assignment)?toolInput.assignment:null)||(rows.length===1?(rows[0].assignment||rows[0].id):null);
    return typeof project==='string'&&typeof id==='string'?{project,assignment:id}:null;
  }
  function live(){if(!target)return false;if(target.ci)return lastData?.ci?.live===true;return !terminal.has(String(item(lastData)?.state||'').toLowerCase());}
  function status(message){
    const checked=checkedAt?'Checked '+new Date(checkedAt).toLocaleTimeString()+'.':'Not checked in this card yet.';
    note.textContent=message||(!target?'':disposed?'Live updates stopped.':document.hidden?'Live updates paused while hidden. '+checked:!live()?'Final recorded state. '+checked:failures>=5?'Live updates paused after repeated connection failures. Use Refresh to retry. '+checked:failures?'Connection unavailable; retrying automatically. '+checked:'Live updates every '+(target.ci?'15':'30')+' seconds. '+checked);
    note.hidden=!note.textContent;
  }
  function schedule(delay){stop();if(disposed||document.hidden||!target||!live()||failures>=5)return;timer=setTimeout(()=>{timer=null;void refresh()},delay??(failures?Math.min(120000,15000*2**failures):target.ci?15000:30000));}
  function valid(data,t){
    if(!data||typeof data!=='object')return false;
    if(t.ci)return data.ci?.schema==='relay-ci-card/v1'&&(!data.ci.head_sha||!/^\w{40}$/.test(t.args.ref)||data.ci.head_sha===t.args.ref);
    return data.project===t.project&&Array.isArray(data.progress)&&data.progress.some(x=>(x.assignment||x.id)===t.assignment);
  }
  async function refresh(manual=false){
    if(!target||disposed)return;
    if(manual){failures=0;stop();}
    if(flight)return flight.promise;
    if(document.hidden&&!manual)return;
    const bound=target,epoch=generation;
    const task={promise:null};flight=task;el.refresh.disabled=true;el.refresh.textContent='Refreshing…';
    task.promise=(async()=>{try{
      const result=await callTool(bound.ci?'relay_source_checks':'relay_runner_progress',bound.ci?bound.args:{project:bound.project,assignment:bound.assignment});
      if(disposed||epoch!==generation||key(bound)!==key(target))return;
      const data=unwrap(result);if(!valid(data,bound))throw Error('Relay did not return the requested current status. The previous view is preserved.');
      if(stamp(data)&&stamp(data)<newest)throw Error('An older status response was ignored. The previous view is preserved.');
      // A successful read is freshness of the fetch, never proof of work progress.
      checkedAt=stamp(data)||Date.now();canonical=true;failures=0;applying=true;
      try{render(result);}finally{applying=false;}
      el.refresh.textContent='Refresh';
    }catch(error){if(epoch===generation&&!disposed){failures++;el.refresh.textContent='Try refresh again';}}
    finally{if(flight===task)flight=null;el.refresh.disabled=false;if(!failures)el.refresh.textContent='Refresh';status();schedule(epoch===generation?undefined:0);}})();
    return task.promise;
  }
  function showLink(m){if(!m.ci_link){link?.remove();link=null;return;}if(!link){link=document.createElement('button');link.type='button';link.className='status-drilldown';link.textContent='Open CI run ›';link.addEventListener('click',async()=>{const href=link.dataset.href;try{if(window.openai?.openExternal){await window.openai.openExternal({href,redirectUrl:false});return;}await ready;await rpc('ui/open-link',{url:href});}catch{el.blocker.hidden=false;el.blocker.textContent='Open the run in your browser: '+href;}});}link.dataset.href=m.ci_link;el.rows.append(link)}
  const base=render;
  render=function(result){
    let data=unwrap(result);if(!data||typeof data!=='object')return;
    const next=identify(data),changed=key(next)!==key(target),signature=JSON.stringify(data);
    if(!applying&&!changed&&seen.has(signature))return;
    if(!applying&&!changed&&newest&&stamp(data)&&stamp(data)<newest)return;
    if(changed){generation++;stop();target=next;failures=0;canonical=false;checkedAt=null;newest=0;seen.clear();}
    else if(!applying)generation++;
    seen.clear();seen.add(signature);
    // A newer routing notification requests fresh observation; it cannot replace
    // already observed progress with an Assigned snapshot while that read runs.
    if(!applying&&!changed&&canonical&&target&&!target.ci&&!Array.isArray(data.progress)){status();schedule(0);return;}
    newest=Math.max(newest,stamp(data));
    if(Array.isArray(data.progress)||data.ci){checkedAt=stamp(data)||checkedAt;canonical=true;}
    if(target&&!target.ci&&Array.isArray(data.progress))data={...data,progress:data.progress.filter(x=>(x.assignment||x.id)===target.assignment),queue:[],claims:[],claim:undefined};
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
  document.addEventListener('relay:target-change',()=>{const next=identify(lastData||{});if(key(next)===key(target))return;generation++;stop();target=next;canonical=false;newest=0;checkedAt=null;seen.clear();status();schedule(0);});
  if(lastData)render(lastData);
})();`.split("\n").filter(line=>!line.trimStart().startsWith("//")).map(line=>line.trim()).join("\n");
