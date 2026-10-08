import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { synchronizeProject, synchronizeRegistry } from './runner-sync.mjs';
test('sync is model-free, non-owning, exact-artifact aware and recommendations deduplicate',async()=>{
  const head='a'.repeat(40),merge='b'.repeat(40),registration={repository:'lrnolivia/fixture',default_branch:'main'};
  const record={claims:[{id:'completed',owner:'owner',branch:'fixture/task',state:'completed',pr:1,work_accounted:true,merged_head_sha:head,merge_commit_sha:merge},{id:'held',owner:'other',branch:'fixture/held',state:'held'}],queue:[{id:'completed',owner:'owner',state:'claimed'}]};
  const original=structuredClone(record);
  const api=async path=>{
    if(path.includes('/check-runs'))return {total_count:1,check_runs:[{name:'quality',head_sha:head,status:'completed',conclusion:'success'}]};
    if(path.includes('/deployments'))return [];
    if(path.includes('/pulls?'))return [];
    return {number:1,merged:true,state:'closed',merge_commit_sha:merge,head:{sha:head,ref:'fixture/task',repo:{full_name:registration.repository}},base:{ref:'main',repo:{full_name:registration.repository}}};
  };
  const a=await synchronizeProject('fixture',registration,record,api),b=await synchronizeProject('fixture',registration,record,api);
  assert.deepEqual(record,original);assert.equal(a.model_calls,0);assert.equal(a.coordination_writes,0);
  assert.equal(a.observations[1].record_state,'held');assert.equal(a.observations[1].execution,'unobserved');
  assert.equal(a.recommendations[0].action,'reconcile-completed-queue');assert.equal(a.recommendations[0].id,b.recommendations[0].id);
  record.queue[0].owner='other';
  assert.equal((await synchronizeProject('fixture',registration,record,api)).recommendations[0].action,'inspect-merged-ownership');
  const unavailable=await synchronizeProject('fixture',registration,record,()=>{throw Error('outage');});
  assert.equal(unavailable.recommendations.length,0);assert.equal(unavailable.observations[0].source,'unavailable');
});

test('registry sync reads omitted large Contents bytes through the canonical verified blob without writes',async()=>{
  const record={project:'relay',claims:[{id:'task',owner:'owner',branch:'relay/task',state:'active'}],queue:[],padding:'x'.repeat(1048576)};
  const bytes=Buffer.from(JSON.stringify(record)),sha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const file=value=>({type:'file',sha:'a'.repeat(40),encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')});
  const calls=[];let corrupt=false,denied=false;
  const api=async(path,options)=>{
    calls.push({path,options});
    if(path.endsWith('/contents/projects?ref=main'))return [{type:'file',name:'relay.json'},{type:'file',name:'other.json'}];
    if(path.includes('/contents/projects/')){const id=path.includes('relay.json')?'relay':'other';return file({id,managed:true,repository:'lrnolivia/'+id,default_branch:'main',coordination:{status:'enabled',record:'coordination/'+id+'.json'}});}
    if(path.includes('/contents/coordination/relay.json'))return {type:'file',sha,encoding:'none',content:'',size:bytes.length};
    if(path.includes('/contents/coordination/other.json'))return file({project:'other',claims:[],queue:[]});
    if(path.endsWith('/git/blobs/'+sha)){
      if(denied)throw Object.assign(Error('Provider denied'),{status:403});
      const content=corrupt?Buffer.from('invalid'):bytes;
      return {encoding:'base64',sha,size:bytes.length,content:content.toString('base64')};
    }
    if(path.includes('/pulls?'))return [];
    throw Error('Unexpected provider path');
  };
  const good=await synchronizeRegistry(api);
  assert.equal(good.model_calls,0);
  assert.equal(good.projects[0].record_sha,sha);
  assert.equal(good.projects[0].observations[0].source,'no_matching_pr');
  assert.equal(good.projects[0].coordination_writes,0);
  assert.equal(good.projects[0].worker_execution,false);
  assert.equal(calls.filter(x=>x.path.includes('/git/blobs/')).length,1);
  assert.ok(calls.every(x=>x.options===undefined));
  for(const failure of ['corrupt','denied']){
    corrupt=failure==='corrupt';denied=failure==='denied';calls.length=0;
    const bad=await synchronizeRegistry(api);
    assert.equal(bad.projects[0].source,'unavailable');
    assert.deepEqual(bad.projects[0].recommendations,[]);
    assert.equal(bad.projects[1].project,'other');
    assert.deepEqual(bad.projects[1].observations,[]);
    assert.equal(calls.filter(x=>x.path.includes('/git/blobs/')).length,1);
    assert.ok(calls.every(x=>x.options===undefined));
  }
});

test('incomplete registry listing fails without inventing a complete synchronization receipt',async()=>{
  await assert.rejects(synchronizeRegistry(async()=>({})),/inventory is incomplete/);
});

test('listed closed PRs require matching detail merge proof; preview SHAs and changed heads never reconcile ownership',async()=>{
  const head='a'.repeat(40),merge='b'.repeat(40),registration={repository:'lrnolivia/relay',default_branch:'main'};
  const record={claims:[{id:'task',owner:'owner',branch:'relay/task',state:'completed',work_accounted:true,merged_head_sha:head,merge_commit_sha:merge}],queue:[{id:'task',owner:'owner',state:'claimed'}]};
  const listed={number:202,state:'closed',merge_commit_sha:merge,head:{sha:head,ref:'relay/task',repo:{full_name:registration.repository}},base:{ref:'main',repo:{full_name:registration.repository}}};
  let detail={...listed,merged:true};const calls=[];
  const api=async path=>{
    calls.push(path);
    if(path.includes('/pulls?'))return [listed];
    if(path.endsWith('/pulls/202'))return detail;
    if(path.includes('/check-runs'))return {total_count:0,check_runs:[]};
    if(path.includes('/deployments'))return [];
    throw Error('Unexpected path');
  };
  const merged=await synchronizeProject('relay',registration,record,api);
  assert.equal(merged.observations[0].pr_state,'merged');
  assert.equal(merged.recommendations[0].action,'reconcile-completed-queue');
  assert.equal(calls.filter(x=>x.endsWith('/pulls/202')).length,1);
  detail={...listed,merged:false};calls.length=0;
  const closed=await synchronizeProject('relay',registration,record,api);
  assert.equal(closed.observations[0].pr_state,'closed');
  assert.equal(closed.observations[0].merge_sha,null);
  assert.deepEqual(closed.recommendations,[]);
  assert.ok(calls.some(x=>x.includes('/deployments?sha='+head)));
  detail={...listed,merged:true,head:{...listed.head,sha:'c'.repeat(40)}};
  const changed=await synchronizeProject('relay',registration,record,api);
  assert.equal(changed.observations[0].source,'unavailable');
  assert.deepEqual(changed.recommendations,[]);
});
