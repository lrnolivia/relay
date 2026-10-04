import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { chromium } from "playwright";
import { cardVariantTools, cardVariantDescriptors, cardVariantResource, cardVariantResult, CARD_VARIANT_BUILD } from "./relay-card-variants.js";

test("mount variants change one metadata path, remain read-only, and retain identical static HTML", () => {
  const [a,b,c]=cardVariantTools();
  assert.ok(a._meta.ui.resourceUri); assert.equal(a._meta["openai/outputTemplate"],undefined);
  assert.ok(b._meta["openai/outputTemplate"]); assert.equal(b._meta.ui,undefined);
  assert.ok(c._meta.ui.resourceUri); assert.equal(c._meta["openai/outputTemplate"],undefined);
  const resources=cardVariantDescriptors().map(d=>cardVariantResource(d.uri));
  assert.equal(resources[0].text,resources[1].text);
  assert.doesNotMatch(resources[0].text,/<script/i);
  assert.match(resources[2].text,/<script>/);
  for(const tool of [a,b,c]){
    assert.equal(tool.annotations.readOnlyHint,true);
    const result=cardVariantResult(tool.name,{});
    assert.equal(result.structuredContent.build_id,CARD_VARIANT_BUILD);
    assert.equal(result.structuredContent.variant,tool.outputSchema.properties.variant.const);
    assert.deepEqual(Object.keys(result.structuredContent).sort(),tool.outputSchema.required.slice().sort());
    for(const args of [null,[],true,{write:true}])assert.throws(()=>cardVariantResult(tool.name,args));
  }
  assert.throws(()=>cardVariantResource("ui://unregistered"));
});

test("all actual bundled resources are byte-identical and independent of Worker helpers", async () => {
  const {build}=await import("esbuild");
  const built=await build({entryPoints:[new URL("./relay-card-variants.js",import.meta.url).pathname],bundle:true,write:false,format:"esm",platform:"neutral",keepNames:true});
  const module=await import("data:text/javascript;base64,"+Buffer.from(built.outputFiles[0].text).toString("base64"));
  for(const d of cardVariantDescriptors()){
    const resource=module.cardVariantResource(d.uri);
    assert.deepEqual(resource,cardVariantResource(d.uri));
    assert.doesNotMatch(resource.text,/\b__name\b|fetch\(|<script[^>]+src=|<link/);
  }
});

test("authenticated production endpoint preserves variant metadata, output schemas and resource identity", async t => {
  const {default:worker}=await import("../apps/mcp/index.js");
  const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
  const kid="mount-variant-fixture",encode=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
  const unsigned=encode({alg:"RS256",kid})+"."+encode({iss:"https://loewfi.cloudflareaccess.com",aud:["7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819"],exp:Math.floor(Date.now()/1000)+600});
  const token=unsigned+"."+sign("RSA-SHA256",Buffer.from(unsigned),privateKey).toString("base64url");
  t.mock.method(globalThis,"fetch",async url=>{
    assert.equal(String(url),"https://loewfi.cloudflareaccess.com/cdn-cgi/access/certs");
    return Response.json({keys:[{...publicKey.export({format:"jwk"}),kid}]});
  });
  const rpc=async(method,params={})=>{
    const response=await worker.fetch(new Request("https://relay.loew.fi/mcp",{method:"POST",headers:{"content-type":"application/json","cf-access-jwt-assertion":token},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})}),{});
    assert.equal(response.status,200);return(await response.json()).result;
  };
  const {tools}=await rpc("tools/list");
  assert.equal(tools.length,68);
  for(const expected of cardVariantTools()){
    const actual=tools.find(t=>t.name===expected.name);
    assert.deepEqual(actual.outputSchema,expected.outputSchema);
    assert.deepEqual(actual._meta.ui,expected._meta.ui);
    assert.equal(actual._meta["openai/outputTemplate"],expected._meta["openai/outputTemplate"]);
    assert.deepEqual(actual.securitySchemes,[{type:"oauth2",scopes:[]}]);
    const result=await rpc("tools/call",{name:expected.name,arguments:{}});
    assert.equal(result.structuredContent.variant,expected.outputSchema.properties.variant.const);
    assert.equal((await rpc("tools/call",{name:expected.name,arguments:{write:true}})).isError,true);
  }
  for(const d of cardVariantDescriptors())assert.deepEqual((await rpc("resources/read",{uri:d.uri})).contents,[cardVariantResource(d.uri)]);
});

test("static variants paint without JavaScript and retain horizontal narrow layout", async t => {
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  for(const d of cardVariantDescriptors()){
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:600}});
    const page=await context.newPage();await page.setContent(cardVariantResource(d.uri).text);
    assert.equal(await page.locator("#static").innerText(),"Card appeared");
    const metrics=await page.locator(".card").evaluate(el=>({direction:getComputedStyle(el).flexDirection,width:el.getBoundingClientRect().width,window:innerWidth}));
    assert.equal(metrics.direction,"row");assert.ok(metrics.width<=metrics.window);
    await context.close();
  }
});

test("actual lifecycle variant handles normal, early, absent and invalid host responses", async t => {
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  const tool=cardVariantTools()[2],html=cardVariantResource(cardVariantDescriptors()[2].uri).text;
  for(const mode of ["normal","early","timeout","invalid","no-data"]){
    await t.test(mode,async()=>{
      const context=await browser.newContext();const page=await context.newPage();await page.clock.install();
      const errors=[];page.on("pageerror",e=>errors.push(e.message));
      await page.setContent('<iframe sandbox="allow-scripts" title="Synthetic mount host"></iframe>');
      await page.evaluate(({html,mode,result})=>{
        window.messages=[];
        window.reply=message=>document.querySelector("iframe").contentWindow.postMessage(message,"*");
        window.addEventListener("message",event=>{
          if(event.source!==document.querySelector("iframe").contentWindow||event.data?.jsonrpc!=="2.0")return;
          const m=event.data;window.messages.push(m);
          if(m.method==="ui/initialize"){
            if(mode==="timeout")return;
            if(mode==="early")window.reply({jsonrpc:"2.0",method:"ui/notifications/tool-result",params:result});
            window.reply({jsonrpc:"2.0",id:m.id,result:{protocolVersion:mode==="invalid"?"invalid":"2026-01-26"}});
          }
          if(m.method==="ui/notifications/initialized"&&!["early","no-data"].includes(mode))window.reply({jsonrpc:"2.0",method:"ui/notifications/tool-result",params:result});
        });
        document.querySelector("iframe").srcdoc=html;
      },{html,mode,result:cardVariantResult(tool.name,{})});
      const frame=page.frameLocator("iframe");
      await frame.locator("#script").filter({hasText:"Script started"}).waitFor();
      if(mode==="timeout"){await page.clock.fastForward(11000);assert.equal(await frame.locator("#host").innerText(),"Host did not answer");}
      else if(mode==="invalid")await frame.locator("#host").filter({hasText:"Host initialization failed"}).waitFor();
      else {
        await frame.locator("#host").filter({hasText:"Host connected"}).waitFor();
        if(mode==="no-data"){
          await page.frames()[1].evaluate(result=>window.dispatchEvent(new MessageEvent("message",{source:window,data:{jsonrpc:"2.0",method:"ui/notifications/tool-result",params:result}})),cardVariantResult(tool.name,{}));
          assert.equal(await frame.locator("#data").innerText(),"Waiting for data");
        }else await frame.locator("#data").filter({hasText:"Data arrived"}).waitFor();
      }
      assert.deepEqual(errors,[]);
      await context.close();
    });
  }
});
