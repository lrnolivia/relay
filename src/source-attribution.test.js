import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import worker from './index.js';
import {commitSourceFiles} from './source.js';
import {sourcePullRequestAction} from './source-lifecycle.js';
import {PROJECT_AUTHOR, assertGitHubCommit, attributedCommitBody, verifyAttributedCommit, reconcileAttributedContentsCommit} from './commit-attribution.js';
import {executionPrompt} from '../scripts/relay-executor.mjs';
import {attributedCoordination} from '../scripts/attribution-coordination.mjs';

const H='1'.repeat(40), T='2'.repeat(40), F='3'.repeat(40);
const HUMAN='Co-authored-by: Alex Example <alex@example.com>';
const AI='Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>';
const object=(sha,message='change',extra={})=>({sha,author:{...PROJECT_AUTHOR,type:'User'},committer:PROJECT_AUTHOR,
  commit:{author:PROJECT_AUTHOR,committer:PROJECT_AUTHOR,message,tree:{sha:T}},parents:[{sha:H}],...extra});

function batch(t,wrong=false){
  const writes=[];let body;
  t.mock.method(globalThis,'fetch',async(url,options={})=>{
    const path=String(url).replace('https://api.github.com',''),method=options.method||'GET';
    if(method!=='GET')writes.push({path,method,body:JSON.parse(options.body)});
    if(path==='/repos/lrnolivia/attribution-fixture')return Response.json({default_branch:'main'});
    if(path.endsWith('/git/ref/heads/relay/work'))return Response.json({object:{sha:H}});
    if(path.endsWith('/git/commits/'+H))return Response.json({tree:{sha:T}});
    if(path.endsWith('/git/trees/'+T))return Response.json({tree:[]});
    if(path.endsWith('/git/blobs'))return Response.json({sha:'4'.repeat(40)});
    if(path.endsWith('/git/trees'))return Response.json({sha:T});
    if(path.endsWith('/git/commits')){body=JSON.parse(options.body);return Response.json({sha:F});}
    if(path.endsWith('/commits/'+F))return Response.json(object(F,body.message,wrong?{author:{login:'relay[bot]',id:1},commit:{...object(F).commit,author:{name:'Relay',email:'bot@example.com'},message:body.message}}:{}));
    if(path.endsWith('/git/refs/heads/relay/work'))return Response.json({object:{sha:F}});
    throw Error('Unexpected batch fixture '+path);
  });
  return {writes,get body(){return body;}};
}
test('actual multi-file API writer fixes metadata and preserves a human credit and artifact',async t=>{
  const f=batch(t);const result=await commitSourceFiles({RELAY_GITHUB_TOKEN:'synthetic'},
    {owner:'lrnolivia',repo:'attribution-fixture',branch:'relay/work',message:`change\n\n${AI}\n${HUMAN}`,files:[{path:'file.md',content:'content'}],expectedHeadSha:H});
  assert.equal(result.commit_sha,F);assert.deepEqual(f.body.author,{name:PROJECT_AUTHOR.name,email:PROJECT_AUTHOR.email});
  assert.deepEqual(f.body.committer,f.body.author);assert.match(f.body.message,/Alex Example/);assert.doesNotMatch(f.body.message,/Claude Opus/);
  assert.equal(f.body.tree,T);assert.deepEqual(f.body.parents,[H]);assert.equal(f.writes.at(-1).body.force,false);
});
test('bad provider metadata is rejected before a Git Database ref is advanced',async t=>{
  const f=batch(t,true);await assert.rejects(commitSourceFiles({RELAY_GITHUB_TOKEN:'synthetic'},
    {owner:'lrnolivia',repo:'attribution-fixture',branch:'relay/work',message:'change',files:[{path:'file.md',content:'content'}]}),/Unexpected author/);
  assert.equal(f.writes.some(x=>x.method==='PATCH'),false);
});
test('wrong owner and exact tree/parent/message mismatches fail closed',async()=>{
  await assert.rejects(commitSourceFiles({}, {owner:'someone-else',repo:'repo',branch:'work',message:'change',files:[{path:'f',content:'v'}]}),/only for Lauren/);
  for(const expected of [{tree:'9'.repeat(40)},{parents:['9'.repeat(40)]},{message:'different'}])
    await assert.rejects(verifyAttributedCommit(async()=>object(F),'/repos/lrnolivia/relay',F,expected),/differ/);
});

function mergeFixture({badFinal=false,badHead=false,red=false,timeout=false,botPr=false}={}){
  let merged=false;const mutations=[];
  const pr=()=>({state:merged?'closed':'open',commits:2,title:'Reviewed change',user:botPr?{login:'relay[bot]',id:1}:PROJECT_AUTHOR,head:{sha:badHead?'9'.repeat(40):H},merged_at:merged?'2026-10-13T00:00:00Z':null,merge_commit_sha:merged?F:null});
  const request=async(_env,path,options={})=>{
    if(path==='/user')return PROJECT_AUTHOR;
    if(path.includes(PROJECT_AUTHOR.witness_sha))return object(PROJECT_AUTHOR.witness_sha);
    if(path.endsWith('/pulls/5'))return pr();
    if(path.endsWith('/commits/'+H))return object(H);
    if(path.includes('/check-runs?'))return {check_runs:[{name:'quality',status:'completed',conclusion:red?'failure':'success'}]};
    if(path.includes('/statuses/'))return [];
    if(path.includes('/pulls/5/commits?'))return [{sha:'a'.repeat(40),author:{type:'User',login:'alex'},commit:{author:{name:'Alex Example',email:'alex@example.com'},message:`source\n\nSigned-off-by: Alex Example <alex@example.com>\n${AI}\n${HUMAN}`}},{...object(H),author:{...PROJECT_AUTHOR,type:'User'}}];
    if(path.endsWith('/pulls/5/merge')){mutations.push(options.body);merged=true;if(timeout)throw Error('response lost');return {merged:true,sha:F};}
    if(path.endsWith('/commits/'+F))return object(F,mutations[0].commit_message,badFinal?{author:{login:'relay[bot]',id:1},commit:{...object(F).commit,author:{name:'Relay',email:'bot@example.com'}}}:{});
    throw Error('Unexpected merge fixture '+path);
  };return {request,mutations};
}
const mergeArgs={repo:'relay',number:5,action:'merge',expected_head_sha:H};
test('App-authenticated merge and squash never call merge or fall back to another identity',async()=>{
  for(const method of ['merge','squash']){
    const f=mergeFixture();await assert.rejects(sourcePullRequestAction({RELAY_GITHUB_APP_ID:'existing-app',RELAY_GITHUB_APP_PRIVATE_KEY:'synthetic',RELAY_GITHUB_TOKEN:'unused'}, {...mergeArgs,merge_method:method},f.request),/App-authenticated merge/);
    assert.equal(f.mutations.length,0);
  }
});
test('existing verified human routes bind merge and squash final metadata and retain human coauthors',async()=>{
  for(const method of ['merge','squash']){
    const f=mergeFixture();const result=await sourcePullRequestAction({RELAY_GITHUB_TOKEN:'synthetic-human'}, {...mergeArgs,merge_method:method},f.request);
    assert.equal(result.final_commit_sha,F);assert.equal(result.attribution.author.email,PROJECT_AUTHOR.email);
    assert.equal(f.mutations[0].sha,H);assert.equal(f.mutations[0].merge_method,method);assert.match(f.mutations[0].commit_message,/Alex Example/);assert.doesNotMatch(f.mutations[0].commit_message,/Claude/);
    assert.match(f.mutations[0].commit_message,/Signed-off-by: Alex Example/);
  }
});
test('wrong final author, stale head, red checks, App PR creator and unsupported rebase never report compliance',async()=>{
  for(const [options,pattern,writes] of [[{badFinal:true},/Unexpected author/,1],[{badHead:true},/head changed/,0],[{red:true},/not green/,0],[{botPr:true},/App-created/,0]]){
    const f=mergeFixture(options);await assert.rejects(sourcePullRequestAction({RELAY_GITHUB_TOKEN:'synthetic-human'},mergeArgs,f.request),pattern);assert.equal(f.mutations.length,writes);
  }
  const f=mergeFixture();await assert.rejects(sourcePullRequestAction({RELAY_GITHUB_TOKEN:'synthetic-human'},{...mergeArgs,merge_method:'rebase'},f.request),/unverified/);assert.equal(f.mutations.length,0);
});
test('lost merge response reconciles the exact final object without a second mutation',async()=>{
  const f=mergeFixture({timeout:true});const result=await sourcePullRequestAction({RELAY_GITHUB_TOKEN:'synthetic-human'},mergeArgs,f.request);
  assert.equal(result.reconciled_after_transport_error,true);assert.equal(result.final_commit_sha,F);assert.equal(f.mutations.length,1);
});
test('Contents reconciliation requires both before/after blobs and the exact metadata',async()=>{
  for(const mismatch of [false,true]){
    const api=async path=>{
      if(path.includes('/commits?'))return [{sha:F}];
      if(path.endsWith('/commits/'+F))return object(F,'coordination: hold relay');
      if(path.endsWith('?ref='+H))return {sha:mismatch?'9'.repeat(40):'a'.repeat(40)};
      if(path.endsWith('?ref='+F))return {sha:'b'.repeat(40)};
      throw Error('Unexpected reconciliation fixture');
    };
    const operation=reconcileAttributedContentsCommit(api,'/repos/lrnolivia/relay','coordination/relay.json',{branch:'main',sha:'a'.repeat(40),message:'coordination: hold relay'},'b'.repeat(40));
    if(mismatch)await assert.rejects(operation,/unavailable/);else assert.equal((await operation).sha,F);
  }
});
test('bootstrap refuses another identity before any control mutation',async()=>{
  let writes=0;await assert.rejects(attributedCoordination({project:'relay',action:'hold',request:{owner:'worker'}},async(path,options)=>{
    if(options?.method)writes++;
    return path==='/user'?{login:'other',id:1}:object(PROJECT_AUTHOR.witness_sha);
  }),/not Lauren/);assert.equal(writes,0);
});
test('executor prompt propagates the mandatory rule without changing the admitted objective',()=>{
  const prompt=executionPrompt({assignment:'task',owner:'worker',repository:'lrnolivia/relay',branch:'relay/work',objective:{acceptance:'Original objective'}},{},[]);
  assert.match(prompt,/Mandatory prospective attribution/);assert.match(prompt,/Pass this rule to every delegated worker/);assert.match(prompt,/Original objective/);assert.match(prompt,/presentation label/);
  for(const workflow of ['runner','field-dependency-doctor','field-dependency-repair']){
    const text=readFileSync(new URL(`../.github/workflows/${workflow}.yml`,import.meta.url),'utf8');
    assert.match(text,/git config --local user.name "Lauren Olivia"/);assert.match(text,/project-attribution.mjs check HEAD/);
    assert.ok(text.indexOf('project-attribution.mjs check HEAD')<text.indexOf('git push'));
  }
});
test('authenticated actual MCP Contents write supplies and verifies exact author metadata',async t=>{
  const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),kid='attribution-mcp';
  const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const unsigned=encode({alg:'RS256',kid})+'.'+encode({iss:'https://loewfi.cloudflareaccess.com',aud:['7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819'],exp:Math.floor(Date.now()/1000)+600});
  const token=unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),privateKey).toString('base64url');let body;
  t.mock.method(globalThis,'fetch',async(url,options={})=>{
    const path=String(url);
    if(path.endsWith('/cdn-cgi/access/certs'))return Response.json({keys:[{...publicKey.export({format:'jwk'}),kid}]});
    if(path.endsWith('/repos/lrnolivia/attribution-mcp'))return Response.json({default_branch:'main'});
    if(path.endsWith('/contents/file.md')){body=JSON.parse(options.body);return Response.json({commit:{sha:F}});}
    if(path.endsWith('/commits/'+F))return Response.json(object(F,body.message));
    throw Error('Unexpected MCP fixture '+path);
  });
  const request=new Request('https://relay.loew.fi/mcp',{method:'POST',headers:{'content-type':'application/json','cf-access-jwt-assertion':token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'relay_source_update_file',arguments:{repo:'attribution-mcp',branch:'relay/work',path:'file.md',content:'content',message:`change\n\n${AI}\n${HUMAN}`}}})});
  const result=await(await worker.fetch(request,{RELAY_GITHUB_TOKEN:'synthetic-mcp'})).json();assert.equal(result.result?.isError,undefined,JSON.stringify(result));
  assert.deepEqual(body.author,attributedCommitBody({message:'change'}).author);assert.deepEqual(body.committer,body.author);assert.match(body.message,/Alex Example/);assert.doesNotMatch(body.message,/Claude/);
  const unauth=new Request('https://relay.loew.fi/mcp',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal((await worker.fetch(unauth,{})).status,401);
});
