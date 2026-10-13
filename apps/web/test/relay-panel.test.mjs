import test from 'node:test';
import assert from 'node:assert/strict';
import { relayPanelResponse } from '../panel-api.js';
import { validateUiRequest } from '../api.js';
const request=()=>new Request('https://relay.loew.fi/api/relay/refresh',{method:'POST',headers:{Origin:'https://relay.loew.fi'}});
test('connection check proves the server handshake and schema, never an unobserved client refresh',async()=>{
  const calls=[];
  const rpc=async method=>{calls.push(method);return method==='initialize'?{serverInfo:{name:'relay',version:'fixture'},capabilities:{tools:{}}}:method==='tools/list'?{tools:[{name:'one',inputSchema:{type:'object'}}]}:{};};
  const result=await (await relayPanelResponse(request(),{rpc})).json();
  assert.equal(result.ok,true);assert.equal(result.tools.count,1);assert.match(result.tools.schema_sha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(calls,['initialize','ping','tools/list']);
  assert.equal(result.refresh.notification_sent,false);assert.equal(result.refresh.client_refresh_verified,false);assert.equal(result.refresh.client_receipt,null);
  assert.equal(result.refresh.next_action,'manual-settings');
  assert.equal(validateUiRequest({path:'/api/relay/check',method:'POST',body:{}}).method,'POST');
  assert.equal((await relayPanelResponse(request(),{rpc:async()=>{throw Error('outage');}})).status,503);
});
