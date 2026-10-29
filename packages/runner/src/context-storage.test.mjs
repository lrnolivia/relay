import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ContextTree,openContext,contextHash,CONTEXT_ROLLOVER_ENABLED} from './context-storage.mjs';
function fixture(){const objects=new Map();let sequence=0,fail=false;return {objects,setFail(){fail=true;},bucket:{async get(k){const item=objects.get(k);return item?{etag:item.etag,json:async()=>JSON.parse(item.text),text:async()=>item.text}:null;},async put(k,text,{onlyIf}){const old=objects.get(k);if(onlyIf instanceof Headers?!!old:old?.etag!==onlyIf.etagMatches)return null;if(fail&&k==='context/v1/p.json'){fail=false;return null;}const result={text,etag:String(++sequence)};objects.set(k,result);return result;}}};}
async function gatedOff(){const source=await readFile(new URL('./context-storage.mjs',import.meta.url),'utf8');return import('data:text/javascript;base64,'+Buffer.from(source.replace('CONTEXT_ROLLOVER_ENABLED = true','CONTEXT_ROLLOVER_ENABLED = false')).toString('base64'));}

test('bounded immutable tree preserves keyed values and stable pages across updates',async()=>{
 const {bucket,objects}=fixture(),tree=new ContextTree(bucket,'p'),items=Array.from({length:650},(_,i)=>[contextHash('operation-'+i),{id:i}]);
 const root=await tree.build(items);let cursor='',all=[];do{const page=await tree.page(root,cursor,20);all.push(...page.items);cursor=page.next;}while(cursor);
 assert.equal(all.length,650);assert.equal(new Set(all.map(x=>x[0])).size,650);
 const next=await tree.set(root,items[0][0],{id:'changed'});assert.deepEqual(await tree.get(root,items[0][0]),{id:0});assert.deepEqual(await tree.get(next,items[0][0]),{id:'changed'});
 for(const {text} of objects.values()){const node=JSON.parse(text);if(node.kind==='leaf')assert.ok(node.items.length<=32);else assert.ok(Object.keys(node.children).length<=16);}
});
test('rollover activation gate and exact 200 entry/600 operation recovery preserve all receipts',async()=>{
 const f=fixture(),legacy={schema:1,revision:600,entries:Array.from({length:200},(_,i)=>({id:'entry'+i,kind:'message',content:'pending'+i,acknowledgements:[]})),operations:Array.from({length:600},(_,i)=>({id:'op'+i,intent:'intent'+i,entry_id:'entry'+i%200}))};
 f.objects.set('context/v1/p.json',{text:JSON.stringify(legacy),etag:'seed'});
 const {openContext:closedOpen,CONTEXT_ROLLOVER_ENABLED:closedGate}=await gatedOff();assert.equal(CONTEXT_ROLLOVER_ENABLED,true);assert.equal(closedGate,false);const closed=await closedOpen(f.bucket,'p');await assert.rejects(closed.migrate(),/rollback baseline/);assert.equal(JSON.parse(f.objects.get('context/v1/p.json').text).schema,1);
 const activeOpen=openContext,active=await activeOpen(f.bucket,'p');await active.migrate();await active.putEntry({id:'entry200',kind:'message',content:'new pending'});await active.putOperation({id:'op600',intent:'new'});active.record.revision++;
 f.setFail();await assert.rejects(active.commit(),/storage changed/);assert.equal(JSON.parse(f.objects.get('context/v1/p.json').text).entries.length,200);
 const retry=await activeOpen(f.bucket,'p');await retry.migrate();await retry.putEntry({id:'entry200',kind:'message',content:'new pending'});await retry.putOperation({id:'op600',intent:'new'});retry.record.revision++;await retry.commit();
 // Compatibility baseline must read AND write activated storage with gate false.
 const rollback=await closedOpen(f.bucket,'p');assert.equal(rollback.record.schema,2);for(let i=0;i<200;i++)assert.equal((await (await closedOpen(f.bucket,'p')).entry('entry'+i)).content,'pending'+i);for(let i=0;i<600;i++)assert.equal((await (await closedOpen(f.bucket,'p')).operation('op'+i)).intent,'intent'+i);
 await rollback.putOperation({id:'rollback-write',intent:'safe'});rollback.record.revision++;await rollback.commit();assert.equal((await (await closedOpen(f.bucket,'p')).operation('rollback-write')).intent,'safe');
});
test('CAS conflict keeps winner and rejects unreachable candidate; corrupted nodes fail closed',async()=>{
 const f=fixture(),a=await openContext(f.bucket,'p'),b=await openContext(f.bucket,'p');await a.putEntry({id:'a'});a.record.revision++;await a.commit();await b.putEntry({id:'b'});b.record.revision++;await assert.rejects(b.commit(),/storage changed/);assert.equal((await openContext(f.bucket,'p')).record.entries[0].id,'a');
 const tree=new ContextTree(f.bucket,'p'),root=await tree.build([[contextHash('x'),{id:'x'}]]),key='context/v2/p/nodes/'+root;f.objects.get(key).text+=' ';
 await assert.rejects(new ContextTree(f.bucket,'p').get(root,contextHash('x')),/integrity/);
});
test('malformed graphs and traversal budgets cannot create unbounded reads',async()=>{
 const f=fixture(),tree=new ContextTree(f.bucket,'p');const empty=await tree.save({kind:'branch',children:{}});await assert.rejects(new ContextTree(f.bucket,'p').page(empty),/Invalid context branch/);
 const leaf=await tree.save({kind:'leaf',items:[[contextHash('x'),{}]]});const repeated=await tree.save({kind:'branch',children:{a:leaf,b:leaf}});await assert.rejects(new ContextTree(f.bucket,'p').page(repeated),/Invalid context branch/);
 const budget=new ContextTree(f.bucket,'p');budget.visits=2048;await assert.rejects(budget.node(leaf),/budget/);
});
test('missing or invalid committed roots fail closed instead of presenting an empty inbox',async()=>{
 const f=fixture();for(const malformed of [{},{entries_root:'bad',operations_root:null},{entries_root:null},{entries_root:null,operations_root:3}]){f.objects.set('context/v1/p.json',{etag:'seed',text:JSON.stringify({schema:2,format:'relay-context-tree-v1',revision:4,relationships:[],...malformed})});await assert.rejects(openContext(f.bucket,'p'),/root manifest/);}
});
