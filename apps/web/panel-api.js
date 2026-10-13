import { createHash } from 'node:crypto';
import { RELAY_PLUGIN_SETTINGS } from './public/relay-connection.js';
export async function relayPanelResponse(request,{rpc,sourceSha=null}={}) {
  const url=new URL(request.url);
  if(!['/api/relay/check','/api/relay/refresh'].includes(url.pathname))return null;
  if(request.method!=='POST')return Response.json({error:'POST required'},{status:405});
  if(request.headers.get('Origin')!==url.origin)return Response.json({error:'Same-origin required'},{status:403});
  if(typeof rpc!=='function')return Response.json({error:'Authenticated MCP transport unavailable'},{status:503});
  const started=performance.now();
  try {
    const initialize=await rpc('initialize'),ping=await rpc('ping'),list=await rpc('tools/list');
    if(!initialize.serverInfo||!ping||!Array.isArray(list.tools)||!list.tools.length)throw Error('MCP returned an incomplete handshake');
    const schema_sha256=createHash('sha256').update(JSON.stringify(list.tools.map(({name,inputSchema})=>({name,inputSchema})).sort((a,b)=>a.name.localeCompare(b.name)))).digest('hex');
    return Response.json({ok:true,checked_at:new Date().toISOString(),elapsed_ms:Math.round(performance.now()-started),server:initialize.serverInfo,source_sha:sourceSha,
      tools:{count:list.tools.length,schema_sha256,server_list_verified:true,client_list_verified:false},
      refresh:{notification_supported:initialize.capabilities?.tools?.listChanged===true,notification_sent:false,client_receipt:null,authenticated_host_refresh_available:false,client_refresh_verified:false,
        next_action:'manual-settings',settings_url:RELAY_PLUGIN_SETTINGS,
        message:'Server tool schema checked. This website has no authenticated host refresh channel. Open the existing Relay plugin settings to refresh it; opening settings is not a refresh receipt.'}
    },{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({ok:false,checked_at:new Date().toISOString(),elapsed_ms:Math.round(performance.now()-started),error:'Relay did not complete its authenticated MCP handshake. Try again after restoring the connection.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
