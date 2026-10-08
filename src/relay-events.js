import {durableAutonomy} from './autonomy-control.js';
// Invalidation and safety use separate object identities and storage keys.
// Runner, evidence and Git remain canonical for existing product state.
const WINDOW=250,TTL=24*60*60*1000;
const mutations=new Set(['relay_execution','relay_context','relay_runner_coordinate','relay_runner_action','relay_runner_feedback_submit','relay_runner_feedback_ack','relay_source_create_branch','relay_source_commit_files','relay_source_update_file','relay_source_edit_text','relay_source_append_text','relay_source_open_pull_request','relay_source_pull_request_action','relay_verify_browser_capture','relay_verify_browser_recipe','relay_cloud_upload_version','relay_cloud_deploy_version','relay_cloud_deploy_project_version']);
export function mutationTopics(name,args={}){
 if(name==='relay_night_shift')return ['record','record_source','shift','oversight'].includes(args?.action)?['work','projects','evidence']:null;
 if(name==='relay_execution'&&!['submit','cancel','lease','start','checkpoint','finish','recover'].includes(args?.action))return null;
 if(name==='relay_context'&&!['record','ack','retract'].includes(args?.action))return null;
 return mutations.has(name)?['work','projects','evidence']:null;
}
export function operatorTopics(path,body){
 if(path==='/api/execution/request'||path==='/api/night-shift/request'||path==='/api/feedback/submit')return ['work','evidence','reviews'];
 if(path==='/api/work-review')return body?.action==='set'?['reviews']:null;
 if(/^\/api\/visual\/vis_[a-zA-Z0-9-]+\/qa$/.test(path))return ['evidence','reviews'];
 if(/^\/api\/retained-preview\/rp_[a-f0-9]+\/review$/.test(path))return ['evidence','reviews'];
 if(/^\/api\/workers\/[a-zA-Z0-9_-]+\/(toggle|settings|run|doctor|repair)$/.test(path))return ['workers'];
 return null;
}
export function successfulRpc(body){return Boolean(body&&body.result&&!body.error&&!body.result.isError&&body.result.structuredContent?.ok!==false);}
export function replayFor(state,cursor,now=Date.now()){
 const seq=String(state?.seq||0),events=(state?.events||[]).filter(e=>now-e.at<TTL);
 if(!/^\d{1,20}$/.test(String(cursor||''))||BigInt(cursor)>BigInt(seq))return [{type:'resync',cursor:seq}];
 const after=events.filter(e=>BigInt(e.id)>BigInt(cursor));
 if(BigInt(cursor)<BigInt(seq)&&(!after.length||BigInt(after[0].id)!==BigInt(cursor)+1n))return [{type:'resync',cursor:seq}];
 return after;
}
export function appendEvent(state,input,now=Date.now()){
 const old=state||{seq:'0',events:[]};if(typeof input?.operation_id!=='string'||!/^[-\w]{8,120}$/.test(input.operation_id))throw Error('Invalid event operation');
 if(!Array.isArray(input.topics)||!input.topics.length||input.topics.length>8||input.topics.some(t=>!['work','projects','evidence','reviews','workers'].includes(t)))throw Error('Invalid event topics');
 const previous=old.events.find(e=>e.operation_id===input.operation_id);if(previous)return {state:old,event:previous,duplicate:true};
 const id=String(BigInt(old.seq)+1n);const event={type:'change',id,operation_id:input.operation_id,topics:[...new Set(input.topics)],at:now};
 return {state:{seq:id,events:[...old.events.filter(e=>now-e.at<TTL),event].slice(-WINDOW)},event,duplicate:false};
}
export function streamExpiry(assertion,now=Date.now()){
 // The gateway must validate the signature before this helper is used. Decoding only
 // narrows an already-authorized connection; it never grants identity or access.
 let expires=now+300000;try{const token=JSON.parse(atob(assertion.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(Number.isFinite(token.exp))expires=Math.min(expires,token.exp*1000);}catch{}
 return expires;
}
export async function eventStream(request,env){
 const url=new URL(request.url);if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
 if(request.headers.get('Origin')!==url.origin)return new Response('Same-origin required',{status:403});
 if(!env.RELAY_EVENTS)return new Response('Event transport not configured',{status:503,headers:{'Retry-After':'30'}});
 const expires=streamExpiry(request.headers.get('Cf-Access-Jwt-Assertion')||'');if(expires<=Date.now())return new Response('Identity expired',{status:401});
 const internal=new URL('https://relay-events/connect');if(url.searchParams.has('cursor'))internal.searchParams.set('cursor',url.searchParams.get('cursor'));internal.searchParams.set('expires',String(expires));
 return env.RELAY_EVENTS.get(env.RELAY_EVENTS.idFromName('control-center')).fetch(new Request(internal,{headers:{Upgrade:'websocket'}}));
}
export async function publishInvalidation(env,topics,operationId=crypto.randomUUID()){
 if(!env.RELAY_EVENTS||!topics)return false;
 try{const response=await env.RELAY_EVENTS.get(env.RELAY_EVENTS.idFromName('control-center')).fetch('https://relay-events/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topics,operation_id:operationId}),signal:AbortSignal.timeout(2000)});return response.ok;}catch{return false;}
}
// Legacy-style Durable Object class is intentionally independent of application
// state. Runtime activation requires a separate reviewed binding/migration.
export class RelayEvents {
 constructor(ctx){this.ctx=ctx;ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 async fetch(request){const url=new URL(request.url);
  if(url.pathname==='/autonomy'&&request.method==='POST'){
   const text=await request.text();if(text.length>8192)return new Response('Too large',{status:413});
   try{return Response.json(await durableAutonomy(this.ctx.storage,JSON.parse(text)));}
   catch(error){return Response.json({ok:false,error:error.message},{status:error.status||400});}
  }
  if(url.pathname==='/publish'&&request.method==='POST'){
   const text=await request.text();if(text.length>2048)return new Response('Too large',{status:413});let input;try{input=JSON.parse(text);}catch{return new Response('Invalid JSON',{status:400});}
   let result;try{result=await this.ctx.storage.transaction(async tx=>{const next=appendEvent(await tx.get('ledger'),input);if(!next.duplicate)await tx.put('ledger',next.state);return next;});}catch{return new Response('Event rejected',{status:400});}
   if(!result.duplicate)for(const socket of this.ctx.getWebSockets()){try{if(socket.deserializeAttachment()?.expires<=Date.now()){socket.close(4001,'Reauthenticate');continue;}socket.send(JSON.stringify(result.event));}catch{socket.close(1011,'Reconnect');}}
   return Response.json({ok:true,id:result.event.id});
  }
  if(url.pathname==='/connect'&&request.method==='GET'&&request.headers.get('Upgrade')?.toLowerCase()==='websocket'){
   if(this.ctx.getWebSockets().length>=64)return new Response('Connection limit',{status:503});
   const expires=Math.min(Number(url.searchParams.get('expires')),Date.now()+300000);if(!Number.isFinite(expires)||expires<=Date.now())return new Response('Expired',{status:401});
   const ledger=await this.ctx.storage.get('ledger');const pair=new WebSocketPair();const [client,server]=Object.values(pair);server.serializeAttachment({expires});this.ctx.acceptWebSocket(server);
   for(const event of replayFor(ledger,url.searchParams.get('cursor')))server.send(JSON.stringify(event));
   const alarm=await this.ctx.storage.getAlarm();if(!alarm||alarm>expires)await this.ctx.storage.setAlarm(expires);
   return new Response(null,{status:101,webSocket:client});
  }
  return new Response('Not found',{status:404});
 }
 webSocketMessage(socket){socket.close(1008,'Read-only event channel');}
 webSocketClose(socket,code){try{socket.close(code);}catch{}}
 webSocketError(socket){try{socket.close(1011,'Reconnect');}catch{}}
 async alarm(){let next=Infinity;for(const socket of this.ctx.getWebSockets()){const expires=socket.deserializeAttachment()?.expires||0;if(expires<=Date.now()){try{socket.close(4001,'Reauthenticate');}catch{}}else next=Math.min(next,expires);}if(Number.isFinite(next))await this.ctx.storage.setAlarm(next);}
}
