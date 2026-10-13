import test from 'node:test';
import assert from 'node:assert/strict';
import {writeWorkReview,readWorkReview,reviewBatch} from '../src/work-review.mjs';
import {sourceRevision} from '../../shared-ui/work-view-model.js';
function bucket(){const objects=new Map();let sequence=0;return {objects,async get(key){const v=objects.get(key);return v?{etag:v.etag,json:async()=>JSON.parse(v.body)}:null;},async put(key,body,options){const v=objects.get(key);if(options.onlyIf.etagMatches && v?.etag!==options.onlyIf.etagMatches)return null;if(options.onlyIf.etagDoesNotMatch==='*'&&v)return null;const etag=String(++sequence);objects.set(key,{body,etag});return {etag};}};}
const source={assignment:'a',goal:'Review this',state:'working'};
async function request(){return {project:'relay',kind:'assignment',id:'a',source_revision:await sourceRevision(source),status:'completed',archived:false,expected_etag:null,operation_id:'op-1'};}
test('review changes only metadata, uses CAS, supports replay reconciliation and retains undo history',async()=>{
 const b=bucket(),input=await request(),first=await writeWorkReview(b,input,async()=>source);
 assert.equal(source.state,'working');assert.equal(b.objects.size,1);
 assert.equal((await writeWorkReview(b,input,async()=>source)).etag,first.etag);
 await assert.rejects(writeWorkReview(b,{...input,operation_id:'op-2'},async()=>source),e=>e.status===409);
 const archived=await writeWorkReview(b,{...input,expected_etag:first.etag,operation_id:'op-3',archived:true},async()=>source);
 assert.equal(archived.record.history.length,1);
 const undone=await writeWorkReview(b,{...input,expected_etag:archived.etag,operation_id:'op-4'},async()=>source);
 assert.equal(undone.record.archived,false);
 await assert.rejects(writeWorkReview(b,{...input,expected_etag:undone.etag,operation_id:'op-5'},async()=>({...source,state:'complete'})),e=>e.status===409);
});
test('concurrent changes have one winner and invalid identities or missing sources never write',async()=>{
 const b=bucket(),input=await request();
 const results=await Promise.allSettled([writeWorkReview(b,input,async()=>source),writeWorkReview(b,{...input,operation_id:'other'},async()=>source)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 await assert.rejects(readWorkReview(b,{...input,id:'../secret'}));
 await assert.rejects(writeWorkReview(b,{...input,id:'missing'},async()=>null),e=>e.status===404);
 await assert.rejects(reviewBatch(b,{action:'read',items:[input,input]},async()=>source));
 const batch=await reviewBatch(b,{action:'read',items:[input]},async()=>source);assert.equal(batch.results[0].record.status,'completed');
});
