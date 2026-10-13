import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverReview, deliveryLabel } from '../public/qa-delivery.js';

test('reload retry preserves operation and replies retain the previous report', async () => {
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const evidence={evidence_id:'vis_fixture'},review={notes:' exact\nwords ',answers:{q:'no'}};
  const binding={available:true,args:{project:'relay',assignment:'fixture',expected_owner:'owner',expected_branch:'relay/test',artifact:{repository:'lrnolivia/relay',commit_sha:'a'.repeat(40)}}};
  let calls=[],fail=true,n=0;
  const api=async (url,options)=>{
    if(options){const body=JSON.parse(options.body);calls.push(body);if(fail){fail=false;throw Error('lost response');}return {ok:true,feedback:{report_id:'report-'+calls.length,status:{queued:true}}};}
    return {ok:true,feedback:{report_id:'report-'+calls.length,status:{seen:{at:'now'}}}};
  };
  const input={evidence,review,binding,api,storage,uuid:()=>String(++n)};
  await assert.rejects(deliverReview(input),/lost response/);
  const delivered=await deliverReview(input);
  assert.equal(calls[0].operation_id,calls[1].operation_id);
  assert.match(calls[1].original_text,/ exact\nwords /);
  assert.equal(delivered.label,'Seen by the assignment caller');
  await deliverReview({...input,review:{...review,notes:'a reply'}});
  assert.notEqual(calls[2].operation_id,calls[1].operation_id);
  assert.equal(calls[2].related_report_id,'report-2');
  assert.equal(deliveryLabel({status:{historical_review:true}}),'Saved with completed work · no new execution queued');
  const before=calls.length;
  assert.equal((await deliverReview({...input,binding:{available:false}})).sent,false);
  assert.equal(calls.length,before);
});

test('storage failure prevents an unrepeatable submission', async()=>{
  let writes=0;
  await assert.rejects(deliverReview({evidence:{evidence_id:'x'},review:{},binding:{available:true,args:{}},storage:{getItem:()=>null,setItem:()=>{throw Error('storage full');}},api:async()=>{writes++;},uuid:()=> 'one'}),/storage full/);
  assert.equal(writes,0);
});
