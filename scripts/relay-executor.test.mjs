import './relay-source-checkpoint.test.mjs';
import test from 'node:test';
import './relay-executor-inbox.test.mjs';
import assert from 'node:assert/strict';
import { codexArguments,executionPrompt,assertScope,createMcpClient } from './relay-executor.mjs';
test('executor uses supported sandboxed CLI and exact-session recovery, with bounded source scope',()=>{
  const args=codexArguments({workspace:'/tmp/fixture'});assert.ok(args.includes('sandbox_mode="workspace-write"'));assert.ok(args.includes('approval_policy="never"'));assert.ok(!args.some(x=>x.includes('bypass')));
  const resume=codexArguments({workspace:'/tmp/fixture',session_id:'exact-session'});assert.deepEqual(resume.slice(-3),['resume','exact-session','-']);
  assert.throws(()=>assertScope(['secrets/file'],['src/']),/outside/);assert.doesNotThrow(()=>assertScope(['src/file.js'],['src/']));
  const prompt=executionPrompt({assignment:'one',objective:{goal:'unchanged',acceptance:['A']},request:'bounded work'},{});
  assert.match(prompt,/unchanged/);assert.match(prompt,/Do not create other agents/);
});
test('executor fails honestly without connection identity and never sends it to another endpoint',async()=>{
  assert.throws(()=>createMcpClient({}),/existing authorized/);
  assert.throws(()=>createMcpClient({token:'fixture',url:'https://evil.example/mcp'}),/canonical/);
  const rpc=createMcpClient({token:'fixture',fetchImpl:async(_url,options)=>Response.json({jsonrpc:'2.0',id:JSON.parse(options.body).id,result:{structuredContent:{ok:true,job:{state:'queued'}}}})});
  assert.equal((await rpc('relay_execution',{})).job.state,'queued');
});

const responseFor=(options,result)=>({jsonrpc:'2.0',id:JSON.parse(options.body).id,...result});
test('executor transport retains observed HTTP classes and rate windows without identity fallback or replay',async()=>{
  for(const [status,headers,category] of [[401,{},'auth'],[403,{},'permission'],[403,{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1791348961'},'rate_limit'],[429,{'retry-after':'60'},'rate_limit'],[503,{},'provider'],[404,{},'http']]){
    let requests=0;const rpc=createMcpClient({token:'private fixture credential',fetchImpl:async(url,options)=>{requests++;assert.equal(url,'https://relay.loew.fi/mcp');assert.equal(options.headers.Authorization,'Bearer private fixture credential');return new Response('raw provider token=do-not-log',{status,headers});}});
    await assert.rejects(rpc('relay_execution',{action:'checkpoint',operation_id:'fixture'}),error=>{
      const e=error.transport_failure;assert.equal(e.category,category);assert.equal(e.stage,'http');assert.equal(e.http_status,status);assert.equal(e.request_attempted,true);assert.equal(e.response_received,true);assert.equal(e.side_effects,'unknown');assert.equal(e.cancellation_actor,'unknown');assert.equal(e.remote_result,'unknown');assert.doesNotMatch(JSON.stringify(error)+error.message,/do-not-log|private fixture/);
      if(status===429)assert.equal(e.retry_after_seconds,60);if(headers['x-ratelimit-reset'])assert.equal(e.rate_limit_reset,1791348961);return true;
    });assert.equal(requests,1);
  }
});
test('executor separates timeout, observed cancellation and unknown transport failure without attributing an actor',async()=>{
  for(const [name,category] of [['TimeoutError','timeout'],['AbortError','cancellation_observed'],['Error','transport']]){
    const rpc=createMcpClient({token:'fixture',fetchImpl:async()=>{throw new DOMException('raw secret=do-not-log',name);}});
    await assert.rejects(rpc('relay_execution',{}),error=>{assert.equal(error.transport_failure.category,category);assert.equal(error.transport_failure.stage,'request');assert.equal(error.transport_failure.response_received,false);assert.equal(error.transport_failure.side_effects,'unknown');assert.equal(error.transport_failure.cancellation_actor,'unknown');assert.equal(error.transport_failure.cause,'undetermined');assert.doesNotMatch(error.message,/do-not-log/);return true;});
  }
});
test('executor rejects local serialization before dispatch and unconfirmed or mismatched response envelopes',async()=>{
  let calls=0;const rpc=createMcpClient({token:'fixture',fetchImpl:async()=>{calls++;return Response.json({});}});const cyclic={};cyclic.self=cyclic;
  for(const [name,args] of [['invalid',{}],['relay_execution',cyclic],['relay_execution',null]])await assert.rejects(rpc(name,args),error=>{assert.equal(error.transport_failure.category,'local_validation');assert.equal(error.transport_failure.request_attempted,false);assert.equal(error.transport_failure.side_effects,'not_dispatched');return true;});
  assert.equal(calls,0);
  for(const result of [{},{jsonrpc:'2.0',id:'different',result:{structuredContent:{ok:true}}},'invalid JSON']){
    const rpc=createMcpClient({token:'fixture',fetchImpl:async()=>new Response(typeof result==='string'?result:JSON.stringify(result))});
    await assert.rejects(rpc('relay_execution',{}),error=>{assert.equal(error.transport_failure.category,'invalid_response');assert.equal(error.transport_failure.stage,'decode');assert.equal(error.transport_failure.side_effects,'unknown');return true;});
  }
  for(const structuredContent of [[],{job:{}},null]){
    const rpc=createMcpClient({token:'fixture',fetchImpl:async(_url,options)=>Response.json(responseFor(options,{result:{structuredContent}}))});
    await assert.rejects(rpc('relay_execution',{}),error=>error.transport_failure.category==='unconfirmed_result');
  }
});
test('executor preserves structured tool rejection classes and numeric evidence without retaining provider messages',async()=>{
  for(const category of ['permission','ownership','scope','validation','rate_limit','uncertain_write']){
    const rpc=createMcpClient({token:'fixture',fetchImpl:async(_url,options)=>Response.json(responseFor(options,{result:{isError:true,structuredContent:{ok:false,error:{class:category,message:'secret=do-not-log',upstream:{retry_after_seconds:90,rate_limit_reset:1791348961,endpoint:'secret endpoint'}}}}}))});
    await assert.rejects(rpc('relay_execution',{}),error=>{const e=error.transport_failure;assert.equal(e.category,category);assert.equal(e.remote_result,'rejected');assert.equal(e.stage,'tool-result');assert.equal(e.retry_after_seconds,90);assert.equal(e.side_effects,'unknown');assert.doesNotMatch(JSON.stringify(e)+error.message,/do-not-log|secret endpoint/);return true;});
  }
  const rpc=createMcpClient({token:'fixture',fetchImpl:async(_url,options)=>Response.json(responseFor(options,{error:{code:-32602,message:'token=do-not-log'}}))});
  await assert.rejects(rpc('relay_execution',{}),error=>error.transport_failure.category==='validation'&&error.transport_failure.jsonrpc_code===-32602);
});
test('executor bounds response bytes and distinguishes response read cancellation from malformed JSON',async()=>{
  const large=createMcpClient({token:'fixture',fetchImpl:async()=>new Response('x'.repeat(1024*1024+1))});
  await assert.rejects(large('relay_execution',{}),error=>error.transport_failure.category==='response_limit');
  for(const [name,category] of [['AbortError','cancellation_observed'],['TimeoutError','timeout'],['Error','invalid_response']]){
    const rpc=createMcpClient({token:'fixture',fetchImpl:async()=>new Response(new ReadableStream({start(controller){controller.error(new DOMException('token=do-not-log',name));}}))});
    await assert.rejects(rpc('relay_execution',{}),error=>error.transport_failure.category===category&&error.transport_failure.response_received===true);
  }
});

import { runExecution } from './relay-executor.mjs';
import { operateJob } from '../packages/runner/src/jobs.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
test('failed executor lease preserves the exact pending operation and classified private receipt without spawning',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-executor-denial-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');
  await fs.mkdir(workspace);const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8'}).trim();
  try{
    git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);await fs.writeFile(path.join(workspace,'README.md'),'Synthetic denial fixture\n');git(['add','README.md']);git(['commit','-m','fixture']);
    const attempts=[];let spawned=false;
    const rpc=createMcpClient({token:'do-not-log-private-token',fetchImpl:async(_url,options)=>{
      const args=JSON.parse(options.body).params.arguments;attempts.push(args);
      if(args.action==='status')return Response.json(responseFor(options,{result:{structuredContent:{ok:true,job:{id:'fixture',state:'queued',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',initial_head_sha:git(['rev-parse','HEAD']),revision:1,objective:{paths:['README.md']}}}}}));
      return new Response('provider password=do-not-log',{status:403});
    }});
    await assert.rejects(runExecution({config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',executor_id:'fixture'},workspace,stateDir,rpc,getVersion:()=> 'synthetic',spawnProcess:()=>{spawned=true;throw Error('must not spawn');}}),error=>error.transport_failure.category==='permission');
    assert.equal(spawned,false);assert.deepEqual(attempts.map(x=>x.action),['status','lease']);
    const text=await fs.readFile(path.join(stateDir,'receipt.json'),'utf8'),journal=JSON.parse(text);
    assert.deepEqual(journal.pending,attempts[1]);assert.equal(journal.last_transport_failure.category,'permission');assert.equal(journal.last_transport_failure.side_effects,'unknown');assert.equal(journal.last_transport_failure.http_status,403);assert.ok(journal.last_transport_failure.observed_at);assert.doesNotMatch(text,/do-not-log|password/);
    assert.equal((await fs.stat(path.join(stateDir,'receipt.json'))).mode&0o777,0o600);await assert.rejects(fs.stat(path.join(stateDir,'executor.lock')),error=>error.code==='ENOENT');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
for (const source_checkpoints of [false,true]) test((source_checkpoints?'source-protected ':'legacy ')+'actual subprocess lifecycle persists broker start, session, exit and exact receipt without claiming objective completion',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-executor-fixture-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');
  await fs.mkdir(workspace);const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8'}).trim();
  try {
    git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);await fs.writeFile(path.join(workspace,'README.md'),'Synthetic executor fixture\n');git(['add','README.md']);git(['commit','-m','fixture']);
    const values=new Map();let etag=0;
    const bucket={get:async k=>{const v=values.get(k);return v?{etag:v.etag,json:async()=>JSON.parse(v.text)}:null;},put:async(k,text,{onlyIf})=>{const old=values.get(k);if(onlyIf instanceof Headers?Boolean(old):onlyIf.etagMatches!==old?.etag)return null;const tag=String(++etag);values.set(k,{text,etag:tag});return {etag:tag};}};
    const target={state:'active',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',lease_until:'2099-01-01T00:00:00Z',head_sha:git(['rev-parse','HEAD']),goal:'Synthetic process proof',acceptance:['Process receipts verified'],paths:['README.md']};
    await operateJob(bucket,{action:'submit',project:'fixture',assignment:'fixture',expected_owner:'fixture',expected_branch:target.branch,expected_head_sha:target.head_sha,prompt:'Synthetic test only',required_capabilities:['codex-cli',...(source_checkpoints?['source-byte-checkpoints-v1']:[])],operation_id:'submit'},target);
    let reads=0;
    const rpc=async(name,args)=>name==='relay_context'?{ok:true,entries:[{content:++reads>2?'new in-run context':'startup context'}],revision:reads}:name==='relay_runner_feedback_peek'?{ok:true,feedback:{available:true,events:[],conflicts:[],truncated:false}}:name==='relay_runner_resume'?{ok:true,synthetic:true}:operateJob(bucket,args,target);
    const result=await runExecution({workspace,stateDir,config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',executor_id:'fixture',source_checkpoints},rpc,pollMs:20,getVersion:()=> 'synthetic adapter test',
      spawnProcess:(_cmd,_args,options)=>spawn(process.execPath,['-e',`let prompt='';process.stdin.on('data',chunk=>prompt+=chunk);process.stdin.on('end',()=>{const data=JSON.parse(prompt.split('\\n\\n')[1]);console.log(JSON.stringify({type:'thread.started',thread_id:'synthetic-session'}));setTimeout(()=>{const inbox=JSON.parse(require('fs').readFileSync(data.context.inbox.path,'utf8'));console.log(JSON.stringify({type:'synthetic.inbox-read',content:inbox.context.entries[0].content}));console.log(JSON.stringify({type:'turn.completed'}));},100);});`],options)});
    assert.equal(result.state,'succeeded');assert.equal(result.objective_completed,false);
    const journal=JSON.parse(await fs.readFile(result.receipt,'utf8'));
    assert.equal(journal.pid,null);assert.equal(journal.session_id,'synthetic-session');assert.equal(journal.job.result.exit_code,0);assert.ok(journal.job.events.some(event=>event.action==='start'));
    if(source_checkpoints)assert.equal(journal.source_checkpoint.state,'restore_verified');
    assert.equal((await fs.stat(result.receipt)).mode&0o777,0o600);
    assert.match(await fs.readFile(path.join(stateDir,'events-1.jsonl'),'utf8'),/new in-run context/);
    assert.equal(journal.inbox.consumption_verified,false);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
