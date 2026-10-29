import test from 'node:test';
import assert from 'node:assert/strict';
import { callContext, contextTool } from './context-service.mjs';
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


function lifecycleFixture(){
 const objects=new Map();let serial=0,afterPut=null;
 const bucket={get:async k=>{const x=objects.get(k);return x?{etag:x.etag,json:async()=>JSON.parse(x.text),text:async()=>x.text}:null;},put:async(k,text,{onlyIf})=>{const old=objects.get(k);if(onlyIf instanceof Headers?!!old:old?.etag!==onlyIf.etagMatches)return null;const value={text,etag:String(++serial)};objects.set(k,value);if(k==='context/v1/fixture.json'&&afterPut)afterPut();return value;}};
 const file=value=>({type:'file',sha:'b'.repeat(40),encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')});
 const claims=['sender','recipient','other'].map(id=>({id,owner:id,branch:'fixture/'+id,state:'active',lease_until:'2099-01-01T00:00:00Z'}));
 const coordination={project:'fixture',queue:[],legacy_branches:[],claims};
 const api=async path=>path.includes('projects/fixture.json')?file({id:'fixture',managed:true,repository:'lrnolivia/fixture',default_branch:'main',coordination:{status:'enabled',record:'coordination/fixture.json',max_active_branches:4,lease_hours:12},implementation:{branch_prefixes:['fixture/'],excluded_branches:['main']}}):path.includes('coordination/fixture.json')?file(coordination):{sha:'a'.repeat(40)};
 let n=0;
 const call=args=>callContext(args,{EVIDENCE:bucket},api);
 const read=(assignment='recipient',extras={})=>call({action:'read',project:'fixture',assignment,...extras});
 const write=async(assignment,action,extras={})=>{const claim=claims.find(x=>x.id===assignment),revision=JSON.parse(objects.get('context/v1/fixture.json')?.text||'{"revision":0}').revision;return call({project:'fixture',assignment,action,expected_owner:claim.owner,expected_branch:claim.branch,expected_revision:revision,operation_id:'operation-'+(++n),...extras});};
 const message=(extras={})=>write('sender','record',{kind:'message',recipient_assignment:'recipient',content:'Unresolved blocker',commit_sha:'a'.repeat(40),...extras});
 return {objects,bucket,claims,call,read,write,message,setAfterPut(fn){afterPut=fn;}};
}
test('explicit inbox lifecycle preserves unresolved ack, evidence, audit and reversible archive',async()=>{
 const f=lifecycleFixture(),created=await f.message(),id=created.entry.id;
 assert.equal((await f.read('recipient',{view:'inbox'})).entries[0].inbox_state,'new');
 await f.write('recipient','ack',{entry_id:id});assert.equal((await f.read('recipient',{view:'inbox'})).entries[0].inbox_state,'acknowledged');
 await assert.rejects(f.write('recipient','archive',{entry_id:id,reason:'clear'}),/explicitly resolved/);
 await assert.rejects(f.write('other','resolve',{entry_id:id,reason:'clear',commit_sha:'a'.repeat(40)}),/recipient changed/);
 await assert.rejects(f.write('recipient','resolve',{entry_id:id,reason:'fixed'}),/exact source evidence/);
 await f.write('recipient','resolve',{entry_id:id,reason:'Verified fix',commit_sha:'a'.repeat(40)});assert.equal((await f.read('recipient',{view:'inbox'})).entries.length,0);
 await f.write('recipient','archive',{entry_id:id,reason:'Completed'});assert.equal((await f.read()).entries.length,0);assert.equal((await f.read('recipient',{view:'history'})).entries[0].content,'Unresolved blocker');
 await f.write('recipient','reopen',{entry_id:id,reason:'Regression'});assert.equal((await f.read('recipient',{view:'inbox'})).entries[0].inbox_state,'new');
 const audit=await f.read('recipient',{view:'audit',entry_id:id});assert.deepEqual(audit.entries.map(x=>x.action),['record','ack','resolve','archive','reopen']);assert.equal(audit.entries[2].event.commit_sha,'a'.repeat(40));
 await assert.rejects(f.read('other',{view:'audit',entry_id:id}),/unavailable/);
});
test('completed recipient blockers remain history and handoff conflicts stay visible but not actionable',async()=>{
 const f=lifecycleFixture(),id=(await f.message()).entry.id;f.claims[1].state='completed';assert.equal((await f.read('recipient',{view:'inbox'})).entries[0].id,id);
 f.claims[1].state='active';f.claims[1].owner='successor';const entry=(await f.read('recipient',{view:'inbox'})).entries[0];assert.equal(entry.id,id);assert.equal(entry.reconciliation_required,true);
 await assert.rejects(f.write('recipient','ack',{entry_id:id}),/recipient changed/);
});
test('page tokens bind revision, assignment, view and owner; legacy numeric remains compatible',async()=>{
 const f=lifecycleFixture();for(let i=0;i<4;i++)await f.message();const first=await f.read('recipient',{view:'inbox',limit:2});assert.ok(first.next_page_token);const second=await f.read('recipient',{view:'inbox',limit:2,page_token:first.next_page_token});assert.equal(new Set([...first.entries,...second.entries].map(x=>x.id)).size,4);
 await assert.rejects(f.read('other',{view:'inbox',page_token:first.next_page_token}),/page changed/);
 await assert.rejects(f.read('recipient',{view:'history',page_token:first.next_page_token}),/page changed/);
 f.claims[1].owner='successor';await assert.rejects(f.read('recipient',{view:'inbox',page_token:first.next_page_token}),/page changed/);f.claims[1].owner='recipient';
 await f.write('recipient','ack',{entry_id:first.entries[0].id});await assert.rejects(f.read('recipient',{view:'inbox',page_token:first.next_page_token}),/page changed/);
 assert.equal((await f.read('recipient',{cursor:2,limit:2})).entries.length,2);
 await assert.rejects(f.read('recipient',{page_token:'not-json'}),/page changed/);
});
test('recipient handoff during commit produces retained reconciliation receipt',async()=>{
 const f=lifecycleFixture();f.setAfterPut(()=>{f.claims[1].owner='successor';});const result=await f.message();assert.equal(result.ok,false);assert.equal(result.reconcile_required,true);assert.equal((await f.read('recipient',{view:'inbox'})).entries[0].reconciliation_required,true);
});
test('stage one refuses capacity migration without modifying full live records',async()=>{
 const f=lifecycleFixture();f.objects.set('context/v1/fixture.json',{etag:'seed',text:JSON.stringify({schema:1,revision:600,entries:[],operations:Array.from({length:600},(_,i)=>({id:'old'+i,intent:'old'}))})});
 await assert.rejects(f.message(),/rollback baseline/);await assert.rejects(f.write('sender','compact'),/rollback baseline/);assert.equal(JSON.parse(f.objects.get('context/v1/fixture.json').text).revision,600);
});
test('activated storage supports legacy-runtime rollback reader, replay and lifecycle beyond old caps',async()=>{
 const {readFile}=await import('node:fs/promises');const code=await readFile(new URL('./context-storage.mjs',import.meta.url),'utf8');const active=await import('data:text/javascript;base64,'+Buffer.from(code.replace('CONTEXT_ROLLOVER_ENABLED = false','CONTEXT_ROLLOVER_ENABLED = true')).toString('base64'));
 const f=lifecycleFixture();const original={action:'record',project:'fixture',assignment:'sender',expected_owner:'sender',expected_branch:'fixture/sender',expected_revision:0,operation_id:'exact-replay',kind:'message',recipient_assignment:'recipient',content:'Original pending',commit_sha:'a'.repeat(40)};
 const first=await f.call(original),legacy=JSON.parse(f.objects.get('context/v1/fixture.json').text);
 for(let i=1;i<200;i++)legacy.entries.push({...first.entry,id:'ctx_'+i.toString(16).padStart(64,'0'),content:'pending '+i});
 for(let i=1;i<600;i++)legacy.operations.push({id:'old-'+i,intent:'old-'+i,entry_id:first.entry.id});legacy.revision=600;f.objects.set('context/v1/fixture.json',{etag:'seed',text:JSON.stringify(legacy)});
 const store=await active.openContext(f.bucket,'fixture');await store.migrate();store.record.revision++;await store.commit();
 assert.equal((await f.call(original)).replayed,true);await assert.rejects(f.call({...original,content:'Changed'}),/different context intent/);
 await f.message();await f.write('recipient','ack',{entry_id:first.entry.id});let token=null,total=0;do{const page=await f.read('recipient',{view:'inbox',...(token?{page_token:token}:{})});total+=page.entries.length;token=page.next_page_token;}while(token);assert.equal(total,201);
 await f.write('recipient','resolve',{entry_id:first.entry.id,reason:'fixed',commit_sha:'a'.repeat(40)});await f.write('recipient','archive',{entry_id:first.entry.id,reason:'done'});await f.write('recipient','reopen',{entry_id:first.entry.id,reason:'still blocked'});assert.equal((await f.read('recipient',{view:'history'})).storage_schema,2);
 await assert.rejects(f.read('recipient',{cursor:20}),/migrated/);
 // No caller can smuggle an uncommitted root through a token.
 const page=await f.read('recipient',{view:'inbox',limit:1}),tampered=JSON.parse(Buffer.from(page.next_page_token,'base64url'));tampered.after='../other';await assert.rejects(f.read('recipient',{view:'inbox',page_token:Buffer.from(JSON.stringify(tampered)).toString('base64url')}),/page changed/);
});

test('context discovery explicitly discloses commands and bounded non-read-only semantics',()=>{
 assert.match(contextTool.description,/QUERY \/ COMMAND/);
 assert.equal(contextTool.annotations.readOnlyHint,false);
 assert.equal(contextTool.inputSchema.additionalProperties,false);
});
