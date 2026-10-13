// Isolated mount variants. Existing production cards and diagnostic controls are unchanged.
export const CARD_VARIANT_BUILD = "20261002.1";
const variants = [
  { id: "static-standard", name: "relay_test_card_static_standard", title: "relay · test A: standard static" },
  { id: "static-compat", name: "relay_test_card_static_compat", title: "relay · test B: compatibility static" },
  { id: "lifecycle-standard", name: "relay_test_card_lifecycle_standard", title: "relay · test C: standard lifecycle" }
].map(v => ({ ...v, uri: `ui://relay/mount-variants/${CARD_VARIANT_BUILD}/${v.id}.html` }));
export const isCardVariantTool = name => variants.some(v => v.name === name);
export const isCardVariantUri = uri => variants.some(v => v.uri === uri);
export function cardVariantTools() {
  return variants.map(v => ({
    name: v.name, title: v.title,
    description: `READ-ONLY CARD TEST ${v.id}. Use only when the user asks to test this specific card variant. No project data or execution is changed. A successful tool response is not proof the card appeared.`,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: { type: "object", properties: {
      schema: {type:"string", const:"relay-card-mount-variant/v1"},
      variant: {type:"string", const:v.id}, build_id:{type:"string", const:CARD_VARIANT_BUILD},
      sample_id:{type:"string"}, observed_at:{type:"string"}
    }, required:["schema","variant","build_id","sample_id","observed_at"], additionalProperties:false },
    annotations: { readOnlyHint:true, destructiveHint:false, openWorldHint:false, idempotentHint:true },
    _meta: v.id === "static-compat" ? {"openai/outputTemplate":v.uri} : {ui:{resourceUri:v.uri}}
  }));
}
export function cardVariantDescriptors() {
  return variants.map(v => ({uri:v.uri,name:`relay-mount-${v.id}`,title:v.title,mimeType:"text/html;profile=mcp-app"}));
}
export function cardVariantResult(name, args) {
  const v = variants.find(v => v.name === name);
  if (!v) throw new Error("Unknown card variant");
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length) throw new Error("Card variants accept no arguments");
  const data = {schema:"relay-card-mount-variant/v1",variant:v.id,build_id:CARD_VARIANT_BUILD,sample_id:crypto.randomUUID(),observed_at:new Date().toISOString()};
  return {structuredContent:data,content:[{type:"text",text:`Relay test ${v.id}, build ${CARD_VARIANT_BUILD}, answered. This is server evidence only. Report whether a card appears; no work started. Sample ${data.sample_id}.`}]};
}
const SHELL = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0;background:transparent;color:#f5f1eb;font:14px/1.45 system-ui,sans-serif}.card{margin:8px;padding:16px;border-radius:16px;background:#211f1d;display:flex;align-items:flex-start;gap:16px;min-width:0}.mark{flex:none;font-size:26px;color:#e6b68b}.body{min-width:0;flex:1}h1{font-size:18px;margin:0 0 6px}p{margin:4px 0;overflow-wrap:anywhere}.hint{font-size:12px;color:#ccc3ba}#milestones{padding:0;margin:8px 0 0;list-style:none}li{overflow-wrap:anywhere}</style></head><body>
<main class="card"><span class="mark" aria-hidden="true">●</span><section class="body"><h1>relay · mount proof</h1><p id="static">Card appeared</p><p class="hint">A and B deliberately contain no scripts. C adds lifecycle markers below.</p><ul id="milestones"></ul></section></main>
<!--PROGRAM--></body></html>`;
const SCRIPT = String.raw`<script>
(function () {
  const list=document.getElementById("milestones");
  function line(id,text){let el=document.getElementById(id);if(!el){el=document.createElement("li");el.id=id;list.append(el)}el.textContent=text}
  line("script","Script started");line("host","Waiting for host");line("data","Waiting for data");
  let stopped=false, connected=false, pendingResult=null;
  const initId="relay-mount-variant-init";
  const timer=setTimeout(()=>{if(!stopped&&!connected)line("host","Host did not answer");},10000);
  const post=message=>window.parent.postMessage({jsonrpc:"2.0",...message},"*");
  function accept(result){const d=result&&result.structuredContent;
    if(result?.isError||!d||d.schema!=="relay-card-mount-variant/v1"||d.variant!=="lifecycle-standard"||d.build_id!=="20261002.1"||typeof d.sample_id!=="string"){line("data","Returned data did not match this test");return}
    line("data","Data arrived");
  }
  function onMessage(event){if(stopped||event.source!==window.parent||event.data?.jsonrpc!=="2.0")return;
    const m=event.data;
    if(m.method==="ui/resource-teardown"&&m.id!=null){stopped=true;clearTimeout(timer);window.removeEventListener("message",onMessage);post({id:m.id,result:{}});return}
    if(m.method==="ui/notifications/tool-cancelled"){stopped=true;clearTimeout(timer);line("data","Test cancelled");window.removeEventListener("message",onMessage);return}
    if(m.id===initId){clearTimeout(timer);
      if(m.error||m.result?.protocolVersion!=="2026-01-26"){line("host","Host initialization failed");return}
      connected=true;line("host","Host connected");post({method:"ui/notifications/initialized",params:{}});
      post({method:"ui/notifications/size-changed",params:{height:Math.ceil(document.body.scrollHeight)}});
      if(pendingResult)accept(pendingResult);return;
    }
    if(m.method==="ui/notifications/tool-result"){pendingResult=m.params;if(connected)accept(pendingResult)}
  }
  window.addEventListener("message",onMessage);
  post({id:initId,method:"ui/initialize",params:{appInfo:{name:"relay-mount-variant",version:"20261002.1"},appCapabilities:{},protocolVersion:"2026-01-26"}});
})();
</script>`;
export function cardVariantResource(uri) {
  const v=variants.find(v=>v.uri===uri);if(!v)throw new Error("Unknown card variant resource");
  return {uri,mimeType:"text/html;profile=mcp-app",text:SHELL.replace("<!--PROGRAM-->",v.id==="lifecycle-standard"?SCRIPT:""),
    _meta:{ui:{prefersBorder:false,csp:{connectDomains:[],resourceDomains:[]}},"openai/widgetDescription":"Isolated Relay mount test. Server success is not proof of visible UI."}};
}
