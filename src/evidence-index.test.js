import test from 'node:test';
import assert from 'node:assert/strict';
import {storeEvidence} from './evidence.js';
import {evidenceIndexKey,readEvidenceIndex,readRecentEvidenceIndex,writeEvidenceIndex} from './evidence-index.js';
import {getVisualEvidence,getVisualImage,listVisualEvidence} from '../packages/runner/src/visual-evidence.mjs';
function bucket(entries=[]){const objects=new Map(entries),calls=[];return {objects,calls,async put(key,value){objects.set(key,value);},async get(key){calls.push(['get',key]);if(!objects.has(key))return null;const data=objects.get(key);return {json:async()=>typeof data==='string'?JSON.parse(data):data,body:data,size:1,httpMetadata:{contentType:'image/png'}};},async list({prefix='',limit=1000,cursor}={}){calls.push(['list',prefix,cursor]);const keys=[...objects.keys()].filter(k=>k.startsWith(prefix)).sort();const start=cursor?Number(cursor):0,items=keys.slice(start,start+limit);return {objects:items.map(key=>({key})),truncated:start+limit<keys.length,cursor:start+limit<keys.length?String(start+limit):undefined};}};}
function record(id,time='2026-10-02T07:00:00.000Z'){return {evidence_id:id,captured_at:time,metadata_key:'visual/2026/10/02/'+id+'.json',screenshot_key:'visual/2026/10/02/'+id+'.png',context:{project:'relay',environment:'preview'}};}
test('new evidence writes additive direct and chronological indexes after original payloads',async()=>{const b=bucket();const r=await storeEvidence(b,{targetUrl:'https://relay.loew.fi',kind:'test',screenshotBytes:new Uint8Array([1]),context:{project:'relay'}});assert.ok(b.objects.has(r.metadata_key));assert.ok(b.objects.has(r.screenshot_key));assert.deepEqual(await readEvidenceIndex(b,r.evidence_id),JSON.parse(JSON.stringify(r)));assert.equal((await readRecentEvidenceIndex(b)).records[0].evidence_id,r.evidence_id);assert.equal((await getVisualImage(b,r.evidence_id)).size,1);});
test('exact historical ID resolves beyond first1000 objects without changing stored evidence',async()=>{const b=bucket(Array.from({length:1200},(_,i)=>['visual/2026/09/01/a'+String(i).padStart(5,'0')+'.png','old']));const r=record('vis_legacy12345');b.objects.set(r.metadata_key,JSON.stringify(r));b.objects.set(r.screenshot_key,'image');const before=[...b.objects];assert.equal((await getVisualEvidence(b,r.evidence_id)).evidence_id,r.evidence_id);assert.ok(b.calls.filter(c=>c[0]==='list').length>=2);assert.ok(await getVisualImage(b,r.evidence_id));assert.deepEqual([...b.objects],before);});
test('indexed captures sort by timestamp across days and avoid scans for exact identity',async()=>{const b=bucket();for(const [id,time]of [['vis_old123456','2026-10-01T23:59:59Z'],['vis_new123456','2026-10-02T00:00:01Z']]){const r=record(id,time);b.objects.set(r.metadata_key,JSON.stringify(r));await writeEvidenceIndex(b,r);}assert.deepEqual((await readRecentEvidenceIndex(b)).records.map(r=>r.evidence_id),['vis_new123456','vis_old123456']);b.calls.length=0;assert.ok(await getVisualEvidence(b,'vis_new123456'));assert.equal(b.calls.some(c=>c[0]==='list'),false);});
test('legacy list windows disclose partial coverage while exact lookups remain available',async()=>{const b=bucket();for(let i=0;i<700;i++){const r=record('vis_'+String(i).padStart(9,'0'));b.objects.set(r.metadata_key,JSON.stringify(r));b.objects.set(r.screenshot_key,'png');}const result=await listVisualEvidence(b,60);assert.equal(result.partial,true);assert.equal(result.coverage,'bounded-cursor-page');assert.ok(result.next_cursor);assert.ok(result.count>0&&result.count<=60);assert.ok(await getVisualEvidence(b,'vis_000000001'));assert.ok(b.calls.filter(c=>c[0]==='get').length<130);});
test('invalid IDs, corrupt indexes and pagination failure do not expose arbitrary objects or false absence',async()=>{assert.throws(()=>evidenceIndexKey('../secrets'));const b=bucket([[evidenceIndexKey('vis_broken123'),'not-json']]);assert.equal(await readEvidenceIndex(b,'vis_broken123'),null);assert.equal(await getVisualEvidence(b,'vis_missing123'),null);const stuck={get:async()=>null,list:async()=>({objects:[],truncated:true,cursor:'same'})};await assert.rejects(()=>getVisualEvidence(stuck,'vis_missing123'),/cursor/);await assert.rejects(()=>listVisualEvidence(stuck),/cursor/);});
test('project index avoids unrelated metadata and cursors preserve every historical match without duplicates',async()=>{
 const b=bucket();
 for(let i=0;i<240;i++) {const r=record('vis_index'+String(i).padStart(8,'0'));r.context.project=i%2?'field':'relay';b.objects.set(r.metadata_key,JSON.stringify(r));await writeEvidenceIndex(b,r);}
 for(let i=0;i<30;i++){const r=record('vis_legacy'+String(i).padStart(8,'0'));r.context.project='field';b.objects.set(r.metadata_key,JSON.stringify(r));}
 b.calls.length=0;
 const first=await listVisualEvidence(b,20,{project:'field'});
 assert.equal(first.count,20);assert.ok(b.calls.filter(x=>x[0]==='get').every(x=>x[1].startsWith('evidence-index/v1/project/field/')));
 const ids=first.evidence.map(x=>x.evidence_id);let cursor=first.next_cursor, pages=0;
 while(cursor){b.calls.length=0;const next=await listVisualEvidence(b,20,{project:'field',cursor});ids.push(...next.evidence.map(x=>x.evidence_id));cursor=next.next_cursor;assert.ok(b.calls.length<=65);assert.ok(++pages<100);}
 assert.equal(ids.length,150);assert.equal(new Set(ids).size,150);
 await assert.rejects(()=>listVisualEvidence(b,20,{project:'relay',cursor:first.next_cursor}),/mismatched/);
});

test('interrupted catalog writes keep the original capture discoverable exactly once',async()=>{
 for(let failure=1;failure<=4;failure++){
  const b=bucket(),r=record('vis_partial1234');b.objects.set(r.metadata_key,JSON.stringify(r));
  const put=b.put.bind(b);let n=0;b.put=async(...args)=>{if(++n===failure)throw Error('synthetic storage failure');return put(...args);};
  await assert.rejects(writeEvidenceIndex(b,r),/synthetic storage/);
  let cursor,ids=[];do{const page=await listVisualEvidence(b,20,{project:'relay',cursor});ids.push(...page.evidence.map(x=>x.evidence_id));cursor=page.next_cursor;}while(cursor);
  assert.deepEqual(ids,[r.evidence_id]);
 }
});
