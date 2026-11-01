// Shared by the embedded card and deterministic bridge tests. Never serialize raw host errors.
export const CARD_HOST_SCRIPT=String.raw`function createCardHost({native,ready,rpc,unwrap,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}) {
 let sequence=0;const ownedErrors=new WeakSet();
 return async function callTool(name,args){
  const start=now(),request='card-read-'+(++sequence);
  const fail=(code,bridge,stage)=>{const error=Object.assign(Error(code),{cardDiagnostic:{code,bridge,stage,request,elapsed_ms:Math.max(0,Math.min(300000,now()-start))}});ownedErrors.add(error);return error;};
  const checked=(result,bridge)=>{const data=unwrap(result);if(result?.isError||data?.ok===false||data?.error)throw fail('provider_error',bridge,'response');return result;};
  const classify=(error,bridge,stage)=>ownedErrors.has(error)?error:fail(error?.name==='AbortError'?'cancelled':error?.code==='RELAY_HOST_TIMEOUT'?'timeout':stage==='initialize'?'host_unavailable':'host_error',bridge,stage);
  const host=native();
  if(typeof host?.callTool==='function'){
   let timer;
   try{return checked(await Promise.race([Promise.resolve().then(()=>host.callTool(name,args)),new Promise((_,reject)=>{timer=setTimer(()=>reject(fail('timeout','openai','read')),12000);})]),'openai');}
   catch(error){
    // Only explicit pre-dispatch non-support permits a second bridge. An
    // unknown timeout or rejected read is never replayed through MCP.
    if(!(error?.code==='METHOD_NOT_SUPPORTED'&&error?.dispatched===false))throw classify(error,'openai','read');
   }finally{clearTimer(timer);}
  }
  try{await ready();}catch(error){throw classify(error,'mcp','initialize');}
  try{return checked(await rpc('tools/call',{name,arguments:args}),'mcp');}catch(error){throw classify(error,'mcp','read');}
 };
}`;
