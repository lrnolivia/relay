import test from 'node:test';
import assert from 'node:assert/strict';
import { callContext } from './context-service.mjs';
test('durable project context verifies source, preserves messages and requires explicit recipient acknowledgement',async()=>{
 let stored=null,etag=0;
 const bucket={get:async()=>stored?{etag:String(etag),json:async()=>JSON.parse(stored)}:null,put:async(k,text,{onlyIf})=>{if(onlyIf instanceof Headers?Boolean(stored):onlyIf.etagMatches!==String(etag))return null;stored=text;return {etag:String(++etag)};}};
 const file=value=>({type:'file',sha:'b'.repeat(40),encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')});
 const record={project:'fixture',queue:[],legacy_branches:[],claims:['sender','recipient'].map(id=>({id,owner:id,branch:'fixture/'+id,state:'active',lease_until:'2099-01-01T00:00:00Z'}))};
 const api=async path=>path.includes('projects/fixture.json')?file({id:'fixture',managed:true,repository:'lrnolivia/fixture',default_branch:'main',coordination:{status:'enabled',record:'coordination/fixture.json',max_active_branches:4,lease_hours:12},implementation:{branch_prefixes:['fixture/'],excluded_branches:['main']}}):path.includes('coordination/fixture.json')?file(record):{sha:'a'.repeat(40)};
 const common={project:'fixture',assignment:'sender',expected_owner:'sender',expected_branch:'fixture/sender'};
 const input={...common,action:'record',expected_revision:0,operation_id:'one',kind:'message',recipient_assignment:'recipient',content:'Synthetic fixture: inspect the exact source.',commit_sha:'a'.repeat(40)};
 const first=await callContext(input,{EVIDENCE:bucket},api);assert.equal(first.revision,1);assert.equal(first.native_delivery_verified,false);assert.equal(first.executor_started,false);
 assert.equal((await callContext(input,{EVIDENCE:bucket},api)).replayed,true);
 const read=await callContext({action:'read',project:'fixture',assignment:'recipient'},{EVIDENCE:bucket},api);assert.equal(read.entries.length,1);assert.deepEqual(read.entries[0].acknowledgements,[]);
 await assert.rejects(callContext({...common,action:'ack',operation_id:'wrong',expected_revision:1,entry_id:first.entry.id},{EVIDENCE:bucket},api),/recipient changed/);
 const ack=await callContext({action:'ack',project:'fixture',assignment:'recipient',expected_owner:'recipient',expected_branch:'fixture/recipient',expected_revision:1,operation_id:'ack',entry_id:first.entry.id},{EVIDENCE:bucket},api);
 assert.equal(ack.entry.acknowledgements.length,1);assert.equal(ack.entry.conclusion_verified,false);
 await assert.rejects(callContext({...input,operation_id:'stale'},{EVIDENCE:bucket},api),/revision changed/);
});
