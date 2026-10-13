import test from 'node:test';
import assert from 'node:assert/strict';
import { executionBrowser } from './execution-browser.mjs';
test('Shift transport requires authenticated same-origin bounded requests and cannot impersonate executor reports',async()=>{
 const env={},url='https://relay.loew.fi/api/execution/request';let calls=0;
 const options={authenticated:true,run:async args=>{calls++;return {ok:true,job:{state:'queued'},operation_id:args.operation_id};}};
 const req=(body,origin='https://relay.loew.fi')=>new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await executionBrowser(req({action:'submit'}),env)).status,403);
 assert.equal((await executionBrowser(req({action:'submit'},'https://elsewhere.example'),env,options)).status,403);
 assert.equal((await executionBrowser(req({action:'start'}),env,options)).status,409);
 assert.equal((await executionBrowser(req({action:'submit',prompt:'x'.repeat(17000)}),env,options)).status,413);
 const result=await executionBrowser(req({action:'submit',operation_id:'unchanged'}),env,options);assert.equal((await result.json()).operation_id,'unchanged');assert.equal(calls,1);
});
