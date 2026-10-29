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

test('a full context log archives eligible history into a readable immutable segment and accepts new records',async()=>{
 const objects=new Map();let etag=0,failNextLive=false;
 const bucket={get:async k=>objects.has(k)?{etag:objects.get(k).etag,json:async()=>JSON.parse(objects.get(k).text),text:async()=>objects.get(k).text}:null,put:async(k,text,{onlyIf})=>{
  const prior=objects.get(k);if(onlyIf instanceof Headers?Boolean(prior):onlyIf.etagMatches!==prior?.etag)return null;
  if(failNextLive&&k==='context/v1/fixture.json'){failNextLive=false;return null;}
  objects.set(k,{text,etag:String(++etag)});return {etag:String(etag)};}};
 const file=value=>({type:'file',sha:'b'.repeat(40),encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')});
 const record={project:'fixture',queue:[],legacy_branches:[],claims:[...['sender','recipient'].map(id=>({id,owner:id,branch:'fixture/'+id,state:'active',lease_until:'2099-01-01T00:00:00Z'})),{id:'finished',owner:'finished',branch:'fixture/finished',state:'completed',lease_until:'2026-01-01T00:00:00Z'}]};
 const api=async path=>path.includes('projects/fixture.json')?file({id:'fixture',managed:true,repository:'lrnolivia/fixture',default_branch:'main',coordination:{status:'enabled',record:'coordination/fixture.json',max_active_branches:4,lease_hours:12},implementation:{branch_prefixes:['fixture/'],excluded_branches:['main']}}):path.includes('coordination/fixture.json')?file(record):{sha:'a'.repeat(40)};
 const old=new Date(Date.now()-30*86400000).toISOString(),recent=new Date().toISOString();
 const entries=[],operations=[];
 for(let i=0;i<200;i++){
  // 0-49 acknowledged messages, 50-99 messages to a finished assignment, 100-149 decisions by a finished assignment, 150-159 recent acknowledged messages, 160-199 decisions by a current assignment.
  const kind=i<100||(i>=150&&i<160)?'message':'decision',assignment=i>=100&&i<150?'finished':'sender',recipient=i>=50&&i<100?'finished':'recipient';
  const entry={id:'ctx_'+i.toString(16).padStart(64,'0'),kind,project:'fixture',assignment,owner:assignment,branch:'fixture/'+assignment,content:'Synthetic fixture entry '+i,repository:'lrnolivia/fixture',commit_sha:'a'.repeat(40),source_exists:true,conclusion_verified:false,created_at:i>=150&&i<160?recent:old,
   ...(kind==='message'?{recipient_assignment:recipient,recipient_owner:recipient,recipient_branch:'fixture/'+recipient}:{}),acknowledgements:i<50||(i>=150&&i<160)?[{at:old,owner:'recipient',operation_id:'ack-'+i,kind:'explicit-caller-acknowledgement'}]:[]};
  entries.push(entry);operations.push({id:'op-'+i,intent:'0'.repeat(64),entry_id:entry.id});
  if(entry.acknowledgements.length)operations.push({id:'ack-'+i,intent:'0'.repeat(64),entry_id:entry.id});
 }
 objects.set('context/v1/fixture.json',{text:JSON.stringify({schema:1,revision:260,entries,operations}),etag:String(++etag)});
 const common={project:'fixture',assignment:'sender',expected_owner:'sender',expected_branch:'fixture/sender'};
 const note={...common,action:'record',kind:'decision',content:'Synthetic fixture: new decision after archival.',commit_sha:'a'.repeat(40)};
 await assert.rejects(callContext({...note,expected_revision:260,operation_id:'blocked'},{EVIDENCE:bucket},api),/preserve history before archival/);
 const archive={...common,action:'archive',expected_revision:260,operation_id:'archive-1',older_than_days:7};
 await assert.rejects(callContext({...common,action:'archive',expected_revision:260,operation_id:'archive-0'},{EVIDENCE:bucket},api),/older_than_days/);
 failNextLive=true;await assert.rejects(callContext(archive,{EVIDENCE:bucket},api),/storage changed/);
 assert.equal(JSON.parse(objects.get('context/v1/fixture.json').text).entries.length,200);
 const archived=await callContext(archive,{EVIDENCE:bucket},api);
 assert.equal(archived.ok,true);assert.equal(archived.revision,261);assert.equal(archived.archive.segment,1);assert.equal(archived.archive.entry_count,150);assert.equal(archived.archive.operation_count,200);
 assert.equal([...objects.keys()].filter(k=>k.startsWith('context/v1/archive/fixture/')).length,1);
 assert.equal((await callContext(archive,{EVIDENCE:bucket},api)).replayed,true);
 const live=JSON.parse(objects.get('context/v1/fixture.json').text);assert.equal(live.entries.length,50);assert.equal(live.operations.length,61);
 assert.deepEqual(live.entries.map(x=>x.content),entries.slice(150).map(x=>x.content));
 const segment=JSON.parse(objects.get(archived.archive.key).text);assert.deepEqual(segment.entries,entries.slice(0,150));
 const recorded=await callContext({...note,expected_revision:261,operation_id:'after-archive'},{EVIDENCE:bucket},api);assert.equal(recorded.ok,true);assert.equal(recorded.revision,262);
 const read=await callContext({action:'read',project:'fixture',assignment:'sender'},{EVIDENCE:bucket},api);
 assert.deepEqual(read.archives,[{segment:1,entry_count:150,first_created_at:old,last_created_at:old,archived_at:archived.archive.archived_at}]);
 let cursor=0,pages=0;const history=[];
 do{const page=await callContext({action:'read',project:'fixture',assignment:'sender',archive_segment:1,cursor,limit:20},{EVIDENCE:bucket},api);history.push(...page.entries);cursor=page.next_cursor;pages++;}while(cursor!==null);
 assert.equal(pages,8);assert.deepEqual(history,entries.slice(0,150));
 assert.equal((await callContext({action:'read',project:'fixture',assignment:'finished',archive_segment:1,limit:20},{EVIDENCE:bucket},api)).entries[0].content,'Synthetic fixture entry 50');
 await assert.rejects(callContext({action:'read',project:'fixture',assignment:'sender',archive_segment:2},{EVIDENCE:bucket},api),/segment not found/);
 const replay=await callContext({...common,action:'ack',expected_revision:0,operation_id:'ack-0',entry_id:entries[0].id},{EVIDENCE:bucket},api).catch(error=>error);assert.match(replay.message,/different context intent/);
 await assert.rejects(callContext({...archive,expected_revision:262,operation_id:'archive-2'},{EVIDENCE:bucket},api),/No context entries are eligible/);
 objects.set(archived.archive.key,{text:objects.get(archived.archive.key).text.replace('entry 0','entry X'),etag:String(++etag)});
 await assert.rejects(callContext({action:'read',project:'fixture',assignment:'sender',archive_segment:1},{EVIDENCE:bucket},api),/integrity/);
});

test('relationship proposals remain provisional until a verified bound lead curates; staff loading and retraction preserve provenance',async()=>{
 let stored=null,etag=0;
 const bucket={get:async()=>stored?{etag:String(etag),json:async()=>JSON.parse(stored)}:null,put:async(k,text,{onlyIf})=>{if(onlyIf instanceof Headers?Boolean(stored):onlyIf.etagMatches!==String(etag))return null;stored=text;return {etag:String(++etag)};}};
 const file=value=>({type:'file',sha:'b'.repeat(40),encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')});
 const record={project:'fixture',queue:[],legacy_branches:[],claims:['worker','lead'].map(id=>({id,owner:id,branch:'fixture/'+id,state:'active',primary_staff:id==='lead'?'julian':'ellis',lease_until:'2099-01-01T00:00:00Z'}))};
 const api=async path=>path.includes('projects/fixture.json')?file({id:'fixture',managed:true,repository:'lrnolivia/fixture',default_branch:'main',coordination:{status:'enabled',record:'coordination/fixture.json',max_active_branches:4,lease_hours:12},implementation:{branch_prefixes:['fixture/'],excluded_branches:['main']}}):path.includes('coordination/fixture.json')?file(record):{sha:'a'.repeat(40)};
 const binding={project:'fixture',assignment:'lead',owner:'lead',branch:'fixture/lead',issuer:'verified-issuer',subject:'verified-subject'};
 const env={EVIDENCE:bucket,RELATIONSHIP_CURATOR_BINDING:JSON.stringify(binding)},identity={verifiedPrincipal:{iss:binding.issuer,sub:binding.subject}};
 const args={project:'fixture',assignment:'worker',expected_owner:'worker',expected_branch:'fixture/worker'};
 const proposed=await callContext({...args,action:'record',expected_revision:0,operation_id:'signal',kind:'relationship-signal',content:'Prefers concise progress updates.',commit_sha:'a'.repeat(40),relationship:{staff_id:'ellis',topic:'communication',source:'explicit-feedback',explicit:true,evidence_refs:['user-message:fixture']}},env,api);
 assert.equal(proposed.entry.relationship.durable,false);
 const read=()=>callContext({action:'read',project:'fixture',assignment:'worker'},env,api);
 assert.deepEqual((await read()).staff_relationship.notes,[]);
 const curate={project:'fixture',assignment:'lead',expected_owner:'lead',expected_branch:'fixture/lead',action:'curate',expected_revision:1,operation_id:'curate',entry_id:proposed.entry.id};
 await assert.rejects(callContext(curate,env,api),/verified lead/);
 await assert.rejects(callContext(curate,{EVIDENCE:bucket},api,identity),/verified lead/);
 await assert.rejects(callContext(curate,env,api,{verifiedPrincipal:{iss:binding.issuer,sub:'another'}}),/verified lead/);
 record.claims[0].primary_staff='julian';
 await assert.rejects(callContext({...curate,...args},env,api,identity),/verified lead/);
 record.claims[0].primary_staff='ellis';
 const curated=await callContext(curate,env,api,identity);assert.equal(curated.entry.relationship.durable,true);assert.equal(curated.entry.source_entry_id,proposed.entry.id);assert.equal(curated.entry.conclusion_verified,false);
 assert.equal((await callContext(curate,env,api,identity)).replayed,true);
 await assert.rejects(callContext({...curate,expected_revision:2,operation_id:'curate-again'},env,api,identity),/already has a current curated note/);
 assert.equal((await read()).staff_relationship.notes[0].note,proposed.entry.content);
 assert.deepEqual((await callContext({action:'read',project:'fixture',assignment:'lead'},env,api)).staff_relationship.notes,[]);
 await callContext({...args,action:'retract',expected_revision:2,operation_id:'retract',entry_id:proposed.entry.id},env,api);
 assert.deepEqual((await read()).staff_relationship.notes,[]);
 await assert.rejects(callContext({...curate,expected_revision:3,operation_id:'recurate'},env,api,identity),/current attributed/);
 record.claims[1].owner='successor';await assert.rejects(callContext(curate,env,api,identity),/verified lead/);
});
