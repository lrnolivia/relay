// Process-local, bounded acceleration for authenticated GitHub reads. Critical
// readers always revalidate upstream; only explicit display reads use a short TTL.
export function createGitHubReadCache({clock=Date.now,maxEntries=128,maxBytes=16*1024*1024,maxEntryBytes=4*1024*1024,displayTtlMs=15000}={}) {
  const entries=new Map(),inflight=new Map(),cooldowns=new Map();
  let bytes=0,epoch=0,overflowCooldown=null;
  const counters={network_requests:0,cache_hits:0,coalesced:0,not_modified:0,blocked:0};
  let lastQuota=null;
  const drop=key=>{const entry=entries.get(key);if(entry){bytes-=entry.bytes;entries.delete(key);}};
  const invalidate=scope=>{epoch++;for(const [key,entry]of entries)if(entry.scope===scope)drop(key);for(const key of inflight.keys())if(key.startsWith(scope+'\0'))inflight.delete(key);};
  const observe=(callback,event,entry={})=>{counters[event]++;try{callback?.({event,observed_at:entry.observed_at||new Date(clock()).toISOString(),quota:entry.quota||null});}catch{/* Diagnostics must not change transport outcomes. */}};
  const quota=metadata=>{
    const out={};
    for(const field of ['rate_limit_limit','rate_limit_used','rate_limit_remaining','rate_limit_reset','retry_after_seconds','installation_id'])if(Number.isSafeInteger(metadata?.[field])&&metadata[field]>=0)out[field]=metadata[field];
    if(/^[a-z_]{1,40}$/.test(metadata?.rate_limit_resource||''))out.rate_limit_resource=metadata.rate_limit_resource;
    if(['github_app_jwt','github_app_installation','legacy_token','public_read'].includes(metadata?.auth_mode))out.auth_mode=metadata.auth_mode;
    return Object.keys(out).length?out:null;
  };
  function block(budgetKey,metadata,status=429){
    const reset=metadata?.rate_limit_reset,delay=metadata?.retry_after_seconds;
    let until=Math.max(reset?reset*1000:0,delay?clock()+delay*1000:0);
    if(until<=clock())until=clock()+60000;
    for(const [key,value]of cooldowns)if(value.until<=clock())cooldowns.delete(key);
    if(cooldowns.size<128||cooldowns.has(budgetKey))cooldowns.set(budgetKey,{until,status,quota:metadata});
    else if(!overflowCooldown||overflowCooldown.until<until)overflowCooldown={until,status,quota:null};
  }
  function remember(key,scope,result){
    drop(key);
    if(result.cacheable===false||typeof result.etag!=='string'||result.etag.length>500)return;
    const size=Buffer.byteLength(JSON.stringify(result.value));if(size>maxEntryBytes||size>maxBytes)return;
    while(entries.size>=maxEntries||bytes+size>maxBytes)drop(entries.keys().next().value);
    entries.set(key,{scope,value:structuredClone(result.value),etag:result.etag,bytes:size,at:clock(),observed_at:new Date(clock()).toISOString(),quota:quota(result.quota)});bytes+=size;
  }
  async function request({scope,budget=scope,resource='core',path,method='GET',mode='revalidate',execute,onObservation}){
    const key=scope+'\0'+path,budgetKey=budget+'\0'+resource;
    const keys=[budgetKey,budget+'\0secondary'];
    for(const key of keys)if(cooldowns.get(key)?.until<=clock())cooldowns.delete(key);
    if(overflowCooldown?.until<=clock())overflowCooldown=null;
    const deadline=[...keys.map(key=>cooldowns.get(key)),overflowCooldown].filter(Boolean).sort((a,b)=>b.until-a.until)[0];
    if(deadline){
      if(deadline.until>clock()){
        observe(onObservation,'blocked',{quota:deadline.quota});
        const error=new Error('GitHub rate limit reset pending; no upstream request sent');
        Object.assign(error,{status:deadline.status,code:'rate_limit',github:{...deadline.quota,request_attempted:false,retry_at:new Date(deadline.until).toISOString()}});throw error;
      }
      cooldowns.delete(budgetKey);
    }
    if(!['GET','HEAD'].includes(method))invalidate(scope);
    const cached=method==='GET'&&mode!=='none'?entries.get(key):null;
    if(cached&&mode==='display'&&clock()-cached.at<displayTtlMs){observe(onObservation,'cache_hits',cached);return structuredClone(cached.value);}
    if(method==='GET'&&mode==='display'&&inflight.has(key)){
      observe(onObservation,'coalesced');return structuredClone(await inflight.get(key));
    }
    const generation=epoch;
    const run=async()=>{
      observe(onObservation,'network_requests');
      try{
        const result=await execute(cached?.etag);
        const observedQuota=quota(result.quota);if(observedQuota)lastQuota={...observedQuota,observed_at:new Date(clock()).toISOString()};
        if(observedQuota?.rate_limit_remaining===0)block(budgetKey,observedQuota);
        try{onObservation?.({event:'quota',observed_at:new Date(clock()).toISOString(),quota:observedQuota});}catch{}
        if(result.status===304){
          if(!cached)throw Object.assign(new Error('GitHub returned304 without a matching authenticated cached representation'),{status:502});
          observe(onObservation,'not_modified',{quota:observedQuota});
          if(epoch===generation)remember(key,scope,{...result,value:cached.value,etag:result.etag||cached.etag});
          return structuredClone(cached.value);
        }
        if(method==='GET'&&mode!=='none'&&epoch===generation)remember(key,scope,result);
        return structuredClone(result.value);
      }catch(error){
        drop(key);
        const observedQuota=quota(error.github);if(observedQuota)lastQuota={...observedQuota,observed_at:new Date(clock()).toISOString()};
        if(error.status===401||(error.status===403&&error.code!=='rate_limit'))invalidate(scope);
        if(error.code==='rate_limit'){
          block(observedQuota?.rate_limit_remaining===0?budgetKey:budget+'\0secondary',observedQuota,error.status||429);
          const pending=cooldowns.get(budgetKey)||cooldowns.get(budget+'\0secondary')||overflowCooldown;
          if(pending)error.github={...error.github,retry_at:new Date(pending.until).toISOString()};
        }
        throw error;
      }finally{if(!['GET','HEAD'].includes(method))invalidate(scope);}
    };
    const promise=run();
    if(method==='GET'&&mode==='display'&&inflight.size<maxEntries)inflight.set(key,promise);
    try{return await promise;}finally{if(inflight.get(key)===promise)inflight.delete(key);}
  }
  return {request,metrics:()=>({...counters,cache_entries:entries.size,cache_bytes:bytes,last_quota:lastQuota?{...lastQuota}:null})};
}
