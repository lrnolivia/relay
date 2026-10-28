import http from 'node:http';
import https from 'node:https';

// Production verification sends writes exactly once. A dedicated socket avoids
// reusing an idle connection whose peer closed it between verification steps.
// Consume each response completely before exposing it to the next check.
export function createVerificationFetch({onEvent=()=>{},maxResponseBytes=16*1024*1024}={}) {
 return async (url,options={})=>{
  const started=Date.now(),target=new URL(url);
  if(!['http:','https:'].includes(target.protocol))throw Error('Verification requires HTTP(S)');
  const input=new Request(target,{...options,signal:options.signal||AbortSignal.timeout(30000)});
  const event={method:input.method,path:target.pathname.replace(/fl_[a-f0-9]{32}/g,':fixture'),phase:'request',status:null};
  try{
   input.signal.throwIfAborted();
   const body=input.body?Buffer.from(await input.arrayBuffer()):undefined;
   const response=await new Promise((resolve,reject)=>{
    const request=(target.protocol==='https:'?https:http).request(target,{method:input.method,headers:Object.fromEntries(input.headers),agent:false,signal:input.signal},incoming=>{
     event.phase='body';event.status=incoming.statusCode;
     const chunks=[];let bytes=0;
     incoming.on('data',chunk=>{
      bytes+=chunk.length;
      if(bytes>maxResponseBytes){incoming.destroy(Object.assign(Error('Verification response exceeds limit'),{code:'ERR_VERIFY_BODY_LIMIT'}));return;}
      chunks.push(chunk);
     });
     incoming.on('error',reject);
     incoming.on('end',()=>{
      if(incoming.statusCode>=300&&incoming.statusCode<400&&options.redirect!=='manual'){
       reject(Object.assign(Error('Verification redirects must be explicit'),{code:'ERR_VERIFY_REDIRECT'}));return;
      }
      const headers=new Headers();for(let i=0;i<incoming.rawHeaders.length;i+=2)headers.append(incoming.rawHeaders[i],incoming.rawHeaders[i+1]);
      const output=new Response([204,205,304].includes(incoming.statusCode)?null:Buffer.concat(chunks),{status:incoming.statusCode,statusText:incoming.statusMessage,headers});
      Object.defineProperty(output,'url',{value:target.href});
      resolve(output);
     });
    });
    request.on('error',reject);request.end(body);
   });
   event.phase='complete';onEvent({...event,elapsed_ms:Date.now()-started});return response;
  }catch(cause){
   const error=input.signal.aborted?input.signal.reason:cause;
   const diagnostic={...event,elapsed_ms:Date.now()-started,error_code:input.signal.aborted?'TIMEOUT_OR_ABORT':String(cause.code||'TRANSPORT_ERROR').slice(0,80)};
   onEvent(diagnostic);throw Object.assign(error,{verification_transport:diagnostic});
  }
 };
}

// The required heading, data, connection, layout and Files assertions follow
// navigation. An unrelated unfinished resource must not block reaching them.
export function navigateProductionPage(page,url) {
 return page.goto(url,{waitUntil:'domcontentloaded'});
}
