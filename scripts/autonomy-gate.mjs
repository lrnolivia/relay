import { pathToFileURL } from 'node:url';

// This probe intentionally uses one canonical origin and never follows redirects.
// It must be called immediately before each publication by connected CLI/CI paths.
export async function checkAutonomy(project,request=fetch,{env=process.env}={}) {
 if(!/^[a-z0-9-]{1,80}$/.test(project||'')||project==='global')throw Error('A canonical project is required');
 const id=env.CF_ACCESS_CLIENT_ID,secret=env.CF_ACCESS_CLIENT_SECRET;
 if(Boolean(id)!==Boolean(secret)||[id,secret].some(value=>value!==undefined&&(typeof value!=='string'||value.length>5000||/[\r\n]/.test(value))))throw Error('Incomplete safety transport identity; publication stopped');
 const headers=id?{'CF-Access-Client-Id':id,'CF-Access-Client-Secret':secret}:{};
 const receipts=[];
 for(const scope of ['global',project]){
  let response;
  try{response=await request('https://relay.loew.fi/autonomy-status?scope='+scope,{headers,redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(5000)});}
  catch{throw Error('Safety transport unavailable for '+scope+'; publication stopped');}
  if(!response.ok)throw Error('Safety state unavailable for '+scope+'; publication stopped');
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Invalid safety response for '+scope+'; publication stopped');
  let state;
  try{
   const reader=response.body.getReader(),chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw Error('Response too large');}chunks.push(value);}}
   finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   state=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }catch{throw Error('Invalid safety response for '+scope+'; publication stopped');}
  if(!state||typeof state!=='object')throw Error('Invalid safety state for '+scope+'; publication stopped');
  if(state.schema!==1||state.scope!==scope||state.enforced!==true||typeof state.held!=='boolean'||!Number.isSafeInteger(state.revision)||state.revision<0)throw Error('Invalid safety state for '+scope+'; publication stopped');
  if(state.held)throw Error('Autonomous publication held for '+scope);
  receipts.push({scope,revision:state.revision});
 }
 return {ok:true,checked_at:new Date().toISOString(),receipts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await checkAutonomy(process.argv[2])));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
