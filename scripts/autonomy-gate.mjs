import { pathToFileURL } from 'node:url';

// This probe intentionally uses one canonical origin and never follows redirects.
// It must be called immediately before each publication by connected CLI/CI paths.
export async function checkAutonomy(project,request=fetch) {
 if(!/^[a-z0-9-]{1,80}$/.test(project||'')||project==='global')throw Error('A canonical project is required');
 const receipts=[];
 for(const scope of ['global',project]){
  const response=await request('https://relay.loew.fi/autonomy-status?scope='+scope,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Safety state unavailable for '+scope+'; publication stopped');
  const state=await response.json();
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
