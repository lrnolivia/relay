// Execution remains an authenticated backend capability; the duplicate Shift UI is retired.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../mcp/index.js';

test('retired workspace documents never redirect mutations or expose private execution APIs',async()=>{
 for(const method of ['POST','PUT','PATCH','DELETE'])for(const path of ['/today','/runner','/runner/relay/exact-task','/night-shift','/inspector']){
  const response=await worker.fetch(new Request('https://relay.loew.fi'+path,{method}),{});
  assert.notEqual(response.status,308);assert.equal(response.headers.get('Location'),null);
 }
 for(const path of ['/api/execution/jobs','/api/projects','/api/files','/api/panel']){
  const response=await worker.fetch(new Request('https://relay.loew.fi'+path),{});assert.equal(response.status,401,path);
 }
 const mcp=await worker.fetch(new Request('https://relay.loew.fi/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})}),{});
 assert.equal(mcp.status,401);assert.match(mcp.headers.get('WWW-Authenticate'),/Bearer/);
});
