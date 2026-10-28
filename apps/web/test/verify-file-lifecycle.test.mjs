import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyFileLifecycle} from '../verify-file-lifecycle.mjs';

test('an uncertain file mutation is recorded once and the synthetic file is cleaned up',async()=>{
 const id='fl_'+'a'.repeat(32),calls=[];
 const fetcher=async(path,options)=>{
  calls.push({path,method:options.method});
  if(calls.length===1)return Response.json({capabilities:{rename:true,delete:true,restore:true},file_policy:{rename:'ready_only',deletion:'soft',restore_until:'original_expiry'}});
  if(options.method==='POST')return Response.json({file:{id,expires_at:100}}, {status:201});
  if(options.method==='PATCH')throw Object.assign(new DOMException('timeout','TimeoutError'),{verification_transport:{method:'PATCH',path:'/api/files/:fixture',phase:'request',status:null,error_code:'TIMEOUT_OR_ABORT'}});
  assert.equal(options.method,'DELETE');return Response.json({ok:true});
 };
 await assert.rejects(verifyFileLifecycle(fetcher,{requestId:'fixture'}),error=>{
  assert.equal(error.name,'TimeoutError');assert.equal(error.receipt.ok,false);
  assert.deepEqual(error.receipt.checks.at(-2),{path:'/:fixture',method:'PATCH',status:null,outcome:'transport-error',transport:{method:'PATCH',path:'/api/files/:fixture',phase:'request',status:null,error_code:'TIMEOUT_OR_ABORT'}});
  assert.equal(error.receipt.cleanup.status,200);return true;
 });
 assert.deepEqual(calls.map(c=>c.method),['GET','POST','PATCH','DELETE']);
});
