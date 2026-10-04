import { callNightShift } from './night-shift.mjs';
export async function nightShiftBrowser(request,env,{authenticated=false,run=callNightShift,api}={}){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/night-shift/'))return null;
 const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!authenticated)return json({error:'Authenticated Night Shift controls required'},403);
 try{
  let args;
  if(request.method==='GET'&&url.pathname==='/api/night-shift/items'){
   args={action:'read',project:url.searchParams.get('project'),assignment:url.searchParams.get('assignment')};
   if(url.searchParams.has('cursor'))args.cursor=Number(url.searchParams.get('cursor'));
   if(url.searchParams.has('limit'))args.limit=Number(url.searchParams.get('limit'));
  }else if(request.method==='POST'&&url.pathname==='/api/night-shift/request'){
   if(request.headers.get('Origin')!==url.origin)return json({error:'Same-origin Night Shift request required'},403);
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
   const reader=request.body?.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let text='',size=0;
   if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>16384){await reader.cancel();return json({error:'Night Shift request exceeds 16 KiB'},413);}text+=decoder.decode(part.value,{stream:true});}
   args=JSON.parse(text+decoder.decode());
   if(!['record','shift','oversight'].includes(args.action))throw Error('Browser may classify receipts or request Shift; never report process activity');
  }else return json({error:'Night Shift route not found'},404);
  const result=await run(args,env,api);return json(result,result.ok===false?409:200);
 }catch(error){return json({error:error.message,response_class:error.response_class||'unconfirmed',write_started:error.write_started??null},409);}
}
