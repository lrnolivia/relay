import {expireTransfers,expireBrowserFiles} from '../../src/file-transfer.js';
import { relayPanelResponse } from '../web/panel-api.js';
import {eventStream,publishInvalidation,mutationTopics,successfulRpc,operatorTopics} from '../../src/relay-events.js';
export {RelayEvents} from '../../src/relay-events.js';
import { brandInitializeResponse } from "./branding.js";
import gateway from "../../packages/inspector/index.js";
import runner from "../../packages/runner/src/cloudflare-worker.mjs";
import { webAssets, webBuildId, webSourceSha } from "../web/generated.js";

export default {
  async scheduled(event,env,ctx) {
    ctx.waitUntil(expireTransfers(env.EVIDENCE));
    ctx.waitUntil(expireBrowserFiles(env.EVIDENCE));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const legacyPath=url.pathname.replace(/\/$/,"");
    const workspaceRoute=/^\/(?:today|now|runner|night-shift|inspector)(?:\/|$)/.test(legacyPath);
    if(workspaceRoute&&["GET","HEAD"].includes(request.method)){
      const destination=legacyPath.replace(/^\/today(?=\/|$)/,'/now');
      return Response.redirect("https://ctrl.loew.fi/#"+destination+url.search,308);
    }
    if(url.pathname==='/relay-app.js'&&['GET','HEAD'].includes(request.method))return new Response(request.method==='HEAD'?null:'This legacy Relay interface is retired. Open https://ctrl.loew.fi/',{status:410,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    if (url.pathname.startsWith("/api/")) {
      // Binary transports validate the same JWT in the gateway, without copying a
      // multi-megabyte Content-Length onto the small JSON authentication probe.
      if(url.pathname.startsWith('/api/files')||url.pathname==='/api/release-recovery')return gateway.fetch(request,env);
      // Verify the same identity as native MCP before exposing operator API routes.
      const auth = await gateway.fetch(new Request(url.origin + "/mcp", {
        method: "POST", headers: new Headers({ ...Object.fromEntries(request.headers), "Content-Type": "application/json" }),
        body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "tools/call", params: { name: "__relay_web_auth_probe__", arguments: {} } })
      }), env);
      if (auth.status !== 200) return auth;
      if(url.pathname==='/api/events')return eventStream(request,env);
      const panel=await relayPanelResponse(request,{sourceSha:webSourceSha,rpc:async method=>{
        const response=await gateway.fetch(new Request(url.origin+'/mcp',{method:'POST',headers:new Headers({...Object.fromEntries(request.headers),'Content-Type':'application/json'}),body:JSON.stringify({jsonrpc:'2.0',id:0,method})}),env);
        if(response.status!==200)throw Error('Authenticated MCP unavailable');
        const body=await response.json();if(body.error)throw Error('MCP discovery failed');return body.result;
      }});
      if(panel)return panel;
      let topics=null;if(env.RELAY_EVENTS&&request.method==='POST'){try{topics=operatorTopics(url.pathname,await request.clone().json());}catch{}}
      const response=await runner.fetch(request,env);
      if(response.ok&&topics)await publishInvalidation(env,topics);
      return response;
    }
    const asset = webAssets[url.pathname];
    if (asset && ["GET", "HEAD"].includes(request.method)) return new Response(request.method === "HEAD" ? null : asset.text, {
      headers: { "Content-Type": asset.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Relay-Web-Build": webBuildId, "X-Relay-Release-Compatibility":"relay-autonomy-v1", ...(webSourceSha ? { "X-Relay-Source-Sha": webSourceSha } : {}) }
    });
    const identityRequest = url.pathname === "/mcp" && request.method === "POST" ? request.clone() : null;
    let eventTopics=null;
    if(identityRequest&&env.RELAY_EVENTS){try{const body=await identityRequest.clone().json();if(body.method==='tools/call')eventTopics=mutationTopics(body.params?.name,body.params?.arguments);}catch{}}
    const response = await gateway.fetch(request, env);
    if(eventTopics&&response.ok&&response.headers.get('Content-Type')?.includes('application/json')){try{if(successfulRpc(await response.clone().json()))await publishInvalidation(env,eventTopics);}catch{}}
    if(response.ok&&request.method==='POST'&&['/evidence/ingest','/evidence/run'].includes(url.pathname))await publishInvalidation(env,['evidence']);
    return identityRequest ? brandInitializeResponse(identityRequest, response) : response;
  }
};
