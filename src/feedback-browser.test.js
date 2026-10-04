import test from 'node:test';
import assert from 'node:assert/strict';
import { handleFeedbackBrowser, feedbackBindingForEvidence } from './feedback-browser.js';
const request=(body,headers={},method='POST')=>new Request('https://relay.loew.fi/api/feedback/submit',{method,headers:{'Content-Type':'application/json',Origin:'https://relay.loew.fi',...headers},...(method==='POST'?{body}: {})});
test('browser feedback enforces authenticated gateway, same origin and bounded JSON',async()=>{
  assert.equal((await handleFeedbackBrowser(request('{}'),{})).status,403);
  const options={authenticated:true,api:()=>{throw Error('must not reach provider');}};
  assert.equal((await handleFeedbackBrowser(request('{}',{Origin:'https://evil.example'}),{},options)).status,403);
  assert.equal((await handleFeedbackBrowser(request('{'),{},options)).status,400);
  assert.equal((await handleFeedbackBrowser(request('x'.repeat(16385)),{},options)).status,413);
  assert.equal((await handleFeedbackBrowser(request('{"authenticated":true}'),{},options)).status,400);
  assert.equal((await handleFeedbackBrowser(request(null,{},'GET'),{},options)).status,405);
  assert.equal((await feedbackBindingForEvidence({context:{project:'relay'}},{},options.api)).available,false);
});
test('assignment reply binding is authenticated, exact-head and read only',async()=>{
 const head='a'.repeat(40),file=value=>({type:'file',sha:'b'.repeat(40),encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')});
 const api=async path=>{
  if(path.includes('projects/fixture.json'))return file({id:'fixture',managed:true,repository:'lrnolivia/fixture',default_branch:'main',implementation:{branch_prefixes:['fixture/'],excluded_branches:['main']},coordination:{record:'coordination/fixture.json',max_active_branches:4,lease_hours:12,status:'enabled'}});
  if(path.includes('coordination/fixture.json'))return file({project:'fixture',claims:[{id:'task',owner:'owner',branch:'fixture/task',state:'active',base_sha:head,lease_until:'2099-01-01T00:00:00Z'}],queue:[],legacy_branches:[]});
  if(path.includes('/git/ref/heads/'))return {object:{sha:head}};
  if(path.includes('/branches?')||path.includes('/pulls?'))return [];
  throw Error('unexpected '+path);
 };
 const make=sha=>new Request('https://relay.loew.fi/api/feedback/binding?project=fixture&assignment=task&head_sha='+sha);
 assert.equal((await handleFeedbackBrowser(make(head),{})).status,403);
 const result=await handleFeedbackBrowser(make(head),{},{authenticated:true,api});assert.equal(result.status,200);
 const body=await result.json();assert.equal(body.available,true);assert.equal(body.args.expected_owner,'owner');assert.equal(body.args.artifact.kind,'source');
 assert.equal((await handleFeedbackBrowser(make('c'.repeat(40)),{},{authenticated:true,api})).status,409);
 assert.equal((await handleFeedbackBrowser(make('bad'),{},{authenticated:true,api})).status,400);
});
