import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { projectCiPolicy, planCiRoute, projectCiRoute } from './ci-routing.js';

const now = Date.parse('2026-10-08T09:00:00Z');
const source = 'a'.repeat(40), trusted = 'b'.repeat(40);
const registration = {id:'relay',repository:'lrnolivia/relay',managed:true,default_branch:'main',ci:{pc:{
  host:'lomachine',label:'relay-private-quality',workflow:'pc-quality.yml',source_refs:['main','relay/task'],
  isolation:'ephemeral-vm',required_capabilities:['node-22.23.3','chromium']
}}};
const request = {mode:'auto',source_sha:source,source_ref:'relay/task'};
const receipt = {schema:1,project:'relay',repository:'lrnolivia/relay',host:'lomachine',label:'relay-private-quality',workflow:'pc-quality.yml',workflow_sha:trusted,
  source_sha:source,source_ref:'relay/task',checked_at:new Date(now).toISOString(),isolation:'ephemeral-vm',approved:true,online:true,gaming:false,busy:false,capacity_available:true,
  dispatch_state:'not-dispatched',capabilities:['node-22.23.3','chromium'],runner_name:'one-job'};
const runner = {name:'one-job',status:'online',busy:false,labels:[{name:'relay-private-quality'}]};
const plan = overrides => planCiRoute({registration,request,receipt,runner,now,...overrides});

test('every registered managed project and future registration receives PC modes without claiming activation', async () => {
  for (const name of await readdir(new URL('../projects/',import.meta.url))) {
    const value = JSON.parse(await readFile(new URL('../projects/'+name,import.meta.url)));
    if (value.alias_of) continue;
    const policy = projectCiPolicy(value);
    assert.equal(policy.available,value.managed===true,name);
    assert.deepEqual(policy.modes,['auto','pc','hosted']);
    assert.equal(policy.dispatches_work,false);
    assert.equal(policy.explicit_pc_fallback,false);
  }
  assert.equal(projectCiPolicy({managed:true}).available,true);
  assert.equal(projectCiPolicy({managed:true}).pc_configured,false);
});

test('automatic PC plan binds trusted workflow, reviewed source, capacity and live runner without dispatch', () => {
  const actual = plan();
  assert.equal(actual.route,'pc');
  assert.equal(actual.workflow_sha,trusted);
  assert.equal(actual.source_sha,source);
  assert.equal(actual.dispatched,false);
  assert.equal(actual.reservation_required,true);
});

test('auto falls back before dispatch but explicit PC waits on every unavailable boundary', () => {
  const cases = [
    {registration:{...registration,ci:undefined}},
    {receipt:null}, {runner:null},
    ...[{source_sha:'c'.repeat(40)},{source_ref:'other'},{repository:'lrnolivia/other'},{workflow:'other.yml'},
      {checked_at:new Date(now-60001).toISOString()},{checked_at:new Date(now+1).toISOString()},
      {checked_at:'invalid'},{isolation:'host'},{approved:false},{online:false},{gaming:true},{busy:true},
      {capacity_available:false},{capabilities:['chromium']},{dispatch_state:undefined}].map(change=>({receipt:{...receipt,...change}})),
    {runner:{...runner,busy:true}},{runner:{...runner,status:'offline'}},{runner:{...runner,labels:[]}},
    {registration:{...registration,ci:{pc:{...registration.ci.pc,source_refs:['main']}}}}
  ];
  for(const boundary of cases){
    assert.equal(plan(boundary).route,'hosted',JSON.stringify(boundary));
    assert.equal(plan({...boundary,request:{...request,mode:'pc'}}).route,'waiting',JSON.stringify(boundary));
  }
});

test('holds and unknown/running/completed dispatch state never start a hosted duplicate', () => {
  for(const mode of ['auto','pc','hosted']){
    assert.equal(plan({request:{...request,mode},blocked:'held'}).route,'blocked');
    for(const dispatch_state of ['unknown','running','completed','failed']){
      assert.equal(plan({request:{...request,mode},receipt:{...receipt,dispatch_state}}).route,'reconcile');
    }
  }
  assert.equal(plan({request:{...request,mode:'hosted'}}).route,'hosted');
  assert.equal(plan({registration:{...registration,managed:false},request:{...request,mode:'hosted'}}).route,'blocked');
});

test('server queries private receipt and current workflow/runner; changed main and partial inventories fail closed', async () => {
  let workflow_sha=trusted, total_count=1; const paths=[], keys=[];
  const env={EVIDENCE:{get:async key=>{keys.push(key);return {json:async()=>receipt};}}};
  const api=async path=>{paths.push(path);return path.includes('/git/ref/')?{object:{sha:workflow_sha}}:{total_count,runners:[runner]};};
  assert.equal((await projectCiRoute(registration,request,env,api,{now})).plan.route,'pc');
  assert.deepEqual(keys,['ci-host/v1/lomachine/relay.json']);
  assert.equal(paths.length,2);
  workflow_sha=source;
  assert.equal((await projectCiRoute(registration,request,env,api,{now})).plan.route,'blocked');
  workflow_sha=trusted;total_count=101;
  await assert.rejects(projectCiRoute(registration,request,env,api,{now}),/inventory is incomplete/);
  await assert.rejects(projectCiRoute(registration,request,env,async()=>{throw Object.assign(Error('Provider denied'),{status:403});},{now}),/Provider denied/);
  paths.length=0;
  assert.equal((await projectCiRoute(registration,{...request,mode:'hosted'},env,api,{now})).plan.route,'hosted');
  assert.equal(paths.length,0);
  keys.length=0;
  assert.equal((await projectCiRoute(registration,request,env,api,{now,blocked:'held'})).plan.route,'blocked');
  assert.equal(keys.length,0);
});
