import test from "node:test";
import assert from "node:assert/strict";
import { validateInteractionShape, validateLoewNavigationForTest, interactBrowserSession } from "./session.js";

test("accepts bounded semantic interactions", () => {
  assert.equal(validateInteractionShape({ action: "click", locator: { type: "text", value: "Stroke" } }), true);
  assert.equal(validateInteractionShape({ action: "press", locator: { type: "role", value: "textbox", name: "Width" }, key: "Enter" }), true);
  assert.equal(validateInteractionShape({ action: "scroll", deltaY: 800 }), true);
});

test("rejects arbitrary or unbounded interaction shapes", () => {
  assert.throws(() => validateInteractionShape({ action: "evaluate" }), /Unsupported/);
  assert.throws(() => validateInteractionShape({ action: "click" }), /requires a locator/);
  assert.throws(() => validateInteractionShape({ action: "press", locator: { type: "text", value: "x" }, key: "F12" }), /Unsupported key/);
  assert.throws(() => validateInteractionShape({ action: "scroll", deltaY: 9000 }), /out of range/);
  assert.throws(() => validateInteractionShape({ action: "wait", waitMs: NaN }), /out of range/);
  assert.throws(() => validateInteractionShape({ action: "click", locator:{type:'text',value:'Recheck'}, waitMs:10001 }), /out of range/);
});

test('semantic wait holds its authenticated CDP connection until settling and records the bounded interval',async()=>{
 const handlers=new Map(),commands=[];let closed=false,credentialAt=0,closedAt=0;
 const socket={accept(){},addEventListener(name,fn){handlers.set(name,fn);},close(){closed=true;closedAt=Date.now();},send(text){
  const command=JSON.parse(text);commands.push(command);
  if(command.method==='Network.setExtraHTTPHeaders'){credentialAt=Date.now();assert.equal(command.params.headers['Cf-Access-Token'],'synthetic-credential');}
  const result=command.method==='Target.attachToTarget'?{sessionId:'attached'}:command.method==='Runtime.evaluate'?{result:{value:{url:'https://ctrl.loew.fi/',title:'Fixture'}}}:{};
  queueMicrotask(()=>handlers.get('message')({data:JSON.stringify({id:command.id,result})}));
 }};
 let meta={session_id:'fixture-session',target_id:'target',status:'open',current_url:'https://ctrl.loew.fi/',viewport:{width:390,height:844},trace:[]};
 const bucket={get:async()=>({json:async()=>meta}),put:async(_key,text)=>{assert.equal(closed,false);meta=JSON.parse(text);}};
 const binding={connectSession:async()=>({webSocket:{fetch:async()=>({webSocket:socket})}})};
 const result=await interactBrowserSession(binding,bucket,{sessionId:'fixture-session',action:'wait',waitMs:30,accessJwt:'synthetic-credential'});
 assert.equal(result.ok,true);assert.equal(closed,true);assert.ok(closedAt-credentialAt>=25);
 assert.equal(meta.trace[0].settle_ms,30);assert.ok(commands.some(x=>x.method==='Network.enable'));
});


test("keeps top-level browser navigation inside loew.fi", () => {
  assert.equal(validateLoewNavigationForTest("https://field.loew.fi/builder/noauth"), true);
  assert.equal(validateLoewNavigationForTest("https://loew.fi/"), true);
  assert.equal(validateLoewNavigationForTest("https://example.com/"), false);
  assert.equal(validateLoewNavigationForTest("http://field.loew.fi/"), false);
});
