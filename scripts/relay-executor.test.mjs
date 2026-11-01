import './relay-source-checkpoint.test.mjs';
import test from 'node:test';
import './relay-executor-inbox.test.mjs';
import './relay-night-shift.test.mjs';
import assert from 'node:assert/strict';
import { codexArguments,executionPrompt,assertScope,createMcpClient } from './relay-executor.mjs';
test('executor uses supported sandboxed CLI and exact-session recovery, with bounded source scope',()=>{
  const args=codexArguments({workspace:'/tmp/fixture'});assert.ok(args.includes('sandbox_mode="workspace-write"'));assert.ok(args.includes('approval_policy="never"'));assert.ok(!args.some(x=>x.includes('bypass')));
  const resume=codexArguments({workspace:'/tmp/fixture',session_id:'exact-session'});assert.deepEqual(resume.slice(-3),['resume','exact-session','-']);
  assert.throws(()=>assertScope(['secrets/file'],['src/']),/outside/);assert.doesNotThrow(()=>assertScope(['src/file.js'],['src/']));
  const prompt=executionPrompt({assignment:'one',objective:{goal:'unchanged',acceptance:['A']},request:'bounded work'},{});
  assert.match(prompt,/unchanged/);assert.match(prompt,/Do not create other agents/);
  assert.match(prompt,/Never read private adapter receipts, RPC bridge files, executor locks or credential files/);
});
test('executor fails honestly without connection identity and never sends it to another endpoint',async()=>{
  assert.throws(()=>createMcpClient({}),/existing authorized/);
  assert.throws(()=>createMcpClient({token:'fixture',url:'https://evil.example/mcp'}),/canonical/);
  for(const timeoutMs of [0,30001,Infinity,'30'])assert.throws(()=>createMcpClient({token:'fixture',timeoutMs}),/bounded/);
  const rpc=createMcpClient({token:'fixture',fetchImpl:async(_url,options)=>Response.json({jsonrpc:'2.0',id:JSON.parse(options.body).id,result:{structuredContent:{ok:true,job:{state:'queued'}}}})});
  assert.equal((await rpc('relay_execution',{})).job.state,'queued');
});
test('large repeated resume histories preserve the current mission, original acceptance and canonical version references',()=>{
  const baseline={goal:'Original rebuild',acceptance:'Original acceptance remains binding'},versions=[{id:'acceptance:0',text:'Original acceptance remains binding'},{id:'acceptance:1',text:'Current additive acceptance',reason:'Explicit user addition'}];
  const assignment={id:'same-assignment',goal:'Current full rebuild',acceptance:'Current additive acceptance',paths:['src/'],resources:['executor'],objective_history:{baseline,acceptance_versions:versions,scope_amendments:Array(30).fill({before:{acceptance:'repeated '.repeat(2000)}})}};
  const latest={project:'relay',assignment,canonical_record_sha:'a'.repeat(40),checkpoint_id:'same-checkpoint',source:{head_sha:'b'.repeat(40)},resume:{instruction:'Continue the original task'}};
  const resume={ok:true,project:'relay',latest,checkpoints:[latest,latest]},context={resume,project_context:{revision:12,entries:[{content:'A pending user instruction'}]}};
  assert.ok(Buffer.byteLength(JSON.stringify(context))>128000);
  const prompt=executionPrompt({assignment:assignment.id,objective:{goal:assignment.goal,acceptance:assignment.acceptance},request:'Bounded existing work'},context,[], '/private/inbox.json');
  assert.ok(Buffer.byteLength(prompt)<128000);const data=JSON.parse(prompt.split('\n\n')[1]);
  assert.equal(data.context.resume.latest.assignment.goal,assignment.goal);assert.equal(data.context.resume.latest.assignment.acceptance,assignment.acceptance);assert.deepEqual(data.context.resume.latest.assignment.objective_history.baseline,baseline);
  assert.deepEqual(data.context.resume.latest.assignment.objective_history.acceptance_versions.map(x=>x.id),versions.map(x=>x.id));assert.deepEqual(data.context.resume.latest.assignment.paths,assignment.paths);assert.deepEqual(data.context.resume.latest.source,latest.source);
  assert.equal(data.context.resume.history_reference.record_sha,latest.canonical_record_sha);assert.equal(data.context.resume.history_reference.checkpoint_id,latest.checkpoint_id);assert.deepEqual(data.context.project_context,context.project_context);assert.equal(data.context.inbox.path,'/private/inbox.json');
  assert.equal(context.resume,resume);assert.equal(resume.latest.assignment,assignment);assert.equal(resume.checkpoints.length,2);
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

// These unchanged tests exercise the bounded worker, now called by the coordinator.
import { runSingleExecution as runExecution, runExecution as runOrdinaryExecution, parseSpecialistReview } from './relay-executor.mjs';
import { operateJob } from '../packages/runner/src/jobs.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
test('executor real fetch body deadline remains a timeout with unknown upstream outcome',async()=>{
  let requests=0;const server=createServer((_request,response)=>{requests++;response.writeHead(200,{'Content-Type':'application/json'});response.flushHeaders();response.write('{');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const origin='http://127.0.0.1:'+server.address().port;
    const rpc=createMcpClient({token:'synthetic fixture only',timeoutMs:200,fetchImpl:(url,options)=>{assert.equal(url,'https://relay.loew.fi/mcp');return fetch(origin,options);}});
    await assert.rejects(rpc('relay_execution',{}),error=>{assert.equal(error.transport_failure.category,'timeout');assert.equal(error.transport_failure.stage,'decode');assert.equal(error.transport_failure.response_received,true);assert.equal(error.transport_failure.side_effects,'unknown');return true;});
    assert.equal(requests,1);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
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
test('oversized protected source is rejected before leasing or starting the coding CLI',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-executor-source-limit-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');
  await fs.mkdir(workspace);const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  const actions=[];let versionRead=false,spawned=false;
  try{
    git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);
    const paths=Array.from({length:65},(_,i)=>`source-${i}.txt`);
    for(const file of paths)await fs.writeFile(path.join(workspace,file),'preserved source\n');
    git(['add','.']);git(['commit','-m','fixture']);
    const job={id:'fixture',state:'queued',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',initial_head_sha:git(['rev-parse','HEAD']),revision:1,objective:{paths}};
    const rpc=async(name,args)=>{assert.equal(name,'relay_execution');actions.push(args.action);assert.equal(args.action,'status','source admission must precede lease');return {job};};
    await assert.rejects(runExecution({workspace,stateDir,rpc,config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',executor_id:'fixture',source_checkpoints:true},getVersion:()=>{versionRead=true;return 'synthetic';},spawnProcess:()=>{spawned=true;throw Error('must not spawn');}}),/bounded entry count/);
    assert.deepEqual(actions,['status']);assert.equal(versionRead,false);assert.equal(spawned,false);
    assert.equal(git(['status','--porcelain']),'');
    const receipt=JSON.parse(await fs.readFile(path.join(stateDir,'receipt.json'),'utf8'));
    assert.equal(receipt.pending,undefined);assert.equal(receipt.lease_token,undefined);
    await assert.rejects(fs.stat(path.join(stateDir,'executor.lock')),error=>error.code==='ENOENT');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('one protected source file larger than 128 KiB is rejected before lease, CLI version read or process start',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-executor-file-limit-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');
  await fs.mkdir(workspace);const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  const actions=[];let versionRead=false,spawned=false;
  try{
    git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);
    const paths=['source.txt'],source=Buffer.alloc(128*1024+1,0x61);
    await fs.writeFile(path.join(workspace,paths[0]),source);
    git(['add','.']);git(['commit','-m','fixture']);
    const job={id:'fixture',state:'queued',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',initial_head_sha:git(['rev-parse','HEAD']),revision:1,objective:{paths}};
    const rpc=async(name,args)=>{assert.equal(name,'relay_execution');actions.push(args.action);assert.equal(args.action,'status','source admission must precede lease');return {job};};
    await assert.rejects(runExecution({workspace,stateDir,rpc,config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',executor_id:'fixture',source_checkpoints:true},getVersion:()=>{versionRead=true;return 'synthetic';},spawnProcess:()=>{spawned=true;throw Error('must not spawn');}}),/Source checkpoint file exceeds bounded capture size/);
    assert.deepEqual(actions,['status']);assert.equal(versionRead,false);assert.equal(spawned,false);
    assert.deepEqual(await fs.readFile(path.join(workspace,paths[0])),source);
    assert.equal(git(['status','--porcelain']),'');assert.equal(git(['rev-parse','HEAD']),job.initial_head_sha);
    const receipt=JSON.parse(await fs.readFile(path.join(stateDir,'receipt.json'),'utf8'));
    assert.equal(receipt.pending,undefined);assert.equal(receipt.lease_token,undefined);
    await assert.rejects(fs.stat(path.join(stateDir,'executor.lock')),error=>error.code==='ENOENT');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('an oversized actual mission is rejected before spawning or recording a running process',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-executor-context-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');await fs.mkdir(workspace);
  const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();let spawned=false;const actions=[];
  try{
    git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);await fs.writeFile(path.join(workspace,'README.md'),'Bounded context fixture\n');git(['add','README.md']);git(['commit','-m','fixture']);
    let job={id:'fixture',state:'queued',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',initial_head_sha:git(['rev-parse','HEAD']),revision:1,objective:{goal:'Preserve this actual mission',acceptance:'x'.repeat(140000),paths:['README.md']}};
    const rpc=async(name,args)=>{
      if(name==='relay_runner_resume')return {ok:true};if(name==='relay_context')return {ok:true,entries:[],revision:0};if(name==='relay_runner_feedback_peek')return {ok:true,feedback:{available:true,events:[],conflicts:[],truncated:false}};
      assert.equal(name,'relay_execution');actions.push(args.action);if(args.action==='lease'){job={...job,state:'leased',revision:2,attempt:1};return {job,lease_token:'synthetic-lease'};}assert.equal(args.action,'status');return {job};
    };
    await assert.rejects(runExecution({config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',executor_id:'fixture',skill_tags:['no-matching-skill']},workspace,stateDir,rpc,getVersion:()=> 'synthetic',spawnProcess:()=>{spawned=true;throw Error('must not spawn');}}),/exceeds 128 KiB before process start/);
    assert.equal(spawned,false);assert.ok(!actions.includes('start'));const journal=JSON.parse(await fs.readFile(path.join(stateDir,'receipt.json'),'utf8'));assert.equal(journal.job.state,'leased');assert.equal(journal.pid,undefined);await assert.rejects(fs.stat(path.join(stateDir,'events-1.jsonl')),error=>error.code==='ENOENT');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
for(const platform of ['win32']) test('executor rejects source protection on '+platform+' before lease or process start',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-executor-platform-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');
  await fs.mkdir(workspace);const actions=[];let spawned=false,versionRead=false;
  try{
    const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
    git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);await fs.writeFile(path.join(workspace,'README.md'),'Synthetic platform fixture\n');git(['add','README.md']);git(['commit','-m','fixture']);
    const job={id:'fixture',state:'queued',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',initial_head_sha:git(['rev-parse','HEAD']),revision:1,objective:{paths:['README.md']},required_capabilities:['codex-cli','source-byte-checkpoints-v1']};
    const rpc=async(name,args)=>{assert.equal(name,'relay_execution');actions.push(args.action);if(args.action!=='status')throw Error('Unexpected mutation: '+args.action);return {job};};
    await assert.rejects(runExecution({config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',source_checkpoints:true},workspace,stateDir,rpc,getPlatform:()=>platform,getVersion:()=>{versionRead=true;return 'synthetic';},spawnProcess:()=>{spawned=true;throw Error('must not spawn');}}),/source checkpoints require supported Linux or macOS/i);
    assert.deepEqual(actions,['status']);assert.equal(versionRead,false);assert.equal(spawned,false);
    await assert.rejects(fs.stat(path.join(stateDir,'executor.lock')),error=>error.code==='ENOENT');
    await assert.rejects(fs.stat(path.join(stateDir,'receipt.json')),error=>error.code==='ENOENT');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

for (const [source_checkpoints,ackMessage] of [[false,false],[true,false],[true,true]]) test((source_checkpoints?'source-protected ':'legacy ')+(ackMessage?'explicit seen ':'')+'actual subprocess lifecycle persists broker start, session, exit and exact receipt without claiming objective completion',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-executor-fixture-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');
  await fs.mkdir(workspace);const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8'}).trim();
  try {
    git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);await fs.writeFile(path.join(workspace,'README.md'),'Synthetic executor fixture\n');git(['add','README.md']);git(['commit','-m','fixture']);
    const values=new Map();let etag=0;
    const bucket={get:async k=>{const v=values.get(k);return v?{etag:v.etag,json:async()=>JSON.parse(v.text)}:null;},put:async(k,text,{onlyIf})=>{const old=values.get(k);if(onlyIf instanceof Headers?Boolean(old):onlyIf.etagMatches!==old?.etag)return null;const tag=String(++etag);values.set(k,{text,etag:tag});return {etag:tag};}};
    const target={state:'active',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',lease_until:'2099-01-01T00:00:00Z',head_sha:git(['rev-parse','HEAD']),goal:'Synthetic process proof',acceptance:['Process receipts verified'],paths:['README.md']};
    await operateJob(bucket,{action:'submit',project:'fixture',assignment:'fixture',expected_owner:'fixture',expected_branch:target.branch,expected_head_sha:target.head_sha,prompt:'Synthetic test only',required_capabilities:['codex-cli',...(source_checkpoints?['source-byte-checkpoints-v1']:[])],operation_id:'submit'},target);
    let reads=0,acks=0;
    const feedback={report_id:'fbr_'+'a'.repeat(64),revision:1,original_text:'Synthetic feedback only',identity:{project:'fixture',assignment:'fixture',owner:'fixture',branch:target.branch,commit_sha:target.head_sha},receipts:[],status:{applicability:{routing_matches:true}}};
    const rpc=async(name,args)=>{
      if(name==='relay_runner_feedback_status')return {ok:true,feedback:structuredClone(feedback)};
      if(name==='relay_runner_feedback_ack'){
        const saved=JSON.parse(await fs.readFile(path.join(stateDir,'receipt.json'),'utf8'));assert.deepEqual(saved.feedback_acknowledgements.pending,args);acks++;
        feedback.receipts.push({kind:'seen',operation_id:args.operation_id,expected_revision:args.expected_revision,represented_owner:'fixture',provenance:'authenticated-caller-reported'});feedback.revision++;return {ok:true,feedback:structuredClone(feedback)};
      }
      if(name==='relay_context'){const content=++reads>2?'new in-run context':'startup context';if(reads===3)await new Promise(resolve=>setTimeout(resolve,150));return {ok:true,entries:[{content}],revision:reads};}
      return name==='relay_runner_feedback_peek'?{ok:true,feedback:{available:true,events:[structuredClone(feedback)],conflicts:[],truncated:false}}:name==='relay_runner_resume'?{ok:true,synthetic:true}:operateJob(bucket,args,target);
    };
    const result=await runExecution({workspace,stateDir,config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',executor_id:'fixture',source_checkpoints,feedback_acknowledgements:source_checkpoints},rpc,pollMs:20,getVersion:()=> 'synthetic adapter test',
      spawnProcess:(_cmd,_args,options)=>spawn(process.execPath,['-e',`let prompt='';process.stdin.on('data',chunk=>prompt+=chunk);process.stdin.on('end',()=>{const data=JSON.parse(prompt.split('\\n\\n')[1]);console.log(JSON.stringify({type:'thread.started',thread_id:'synthetic-session'}));const deadline=Date.now()+5000;const readInbox=()=>{const inbox=JSON.parse(require('fs').readFileSync(data.context.inbox.path,'utf8'));if(inbox.context.entries[0].content!=='new in-run context'){if(Date.now()>=deadline){process.exitCode=2;return;}setTimeout(readInbox,10);return;}console.log(JSON.stringify({type:'synthetic.inbox-read',content:inbox.context.entries[0].content,skillDirectory:data.context.installed_skills?.directory}));${ackMessage?`const report=inbox.feedback.events[0];console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({type:'relay_feedback_seen',nonce:data.context.feedback_acknowledgement.nonce,report_id:report.report_id,expected_revision:report.revision,text_sha256:require('crypto').createHash('sha256').update(report.original_text).digest('hex')})}}));`:''}console.log(JSON.stringify({type:'turn.completed'}));};readInbox();});`],options)});
    assert.equal(result.state,'succeeded');assert.equal(result.objective_completed,false);
    const journal=JSON.parse(await fs.readFile(result.receipt,'utf8'));
    assert.equal(journal.pid,null);assert.equal(journal.session_id,'synthetic-session');assert.equal(journal.job.result.exit_code,0);assert.ok(journal.job.events.some(event=>event.action==='start'));
    if(source_checkpoints)assert.equal(journal.source_checkpoint.state,'restore_verified');
    assert.equal((await fs.stat(result.receipt)).mode&0o777,0o600);
    assert.match(await fs.readFile(path.join(stateDir,'events-1.jsonl'),'utf8'),/new in-run context/);
    assert.equal(journal.inbox.consumption_verified,false);
    // Reading alone never acknowledges. The explicit process request does.
    assert.equal(acks,ackMessage?1:0);if(source_checkpoints)assert.equal(journal.feedback_acknowledgements.receipts.length,ackMessage?1:0);
    assert.equal(journal.skills.installed,true);assert.ok(journal.skills.directory.startsWith(await fs.realpath(stateDir)+path.sep));
    const events=(await fs.readFile(path.join(stateDir,'events-1.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(events.find(event=>event.type==='synthetic.inbox-read').skillDirectory,journal.skills.directory);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('provider adapters use distinct safe CLI arguments and normalize concrete session/outcome events',async()=>{
 const {executorArguments,executorEvent,executionProvider,continuityProposals}=await import('./relay-executor.mjs');
 assert.equal(executionProvider({}),'codex');assert.throws(()=>executionProvider({provider:'native-claude'}),/supported/);
 const args=executorArguments({provider:'claude',workspace:'/task',session_id:'exact-session'});assert.deepEqual(args,['--print','--verbose','--output-format','stream-json','--permission-mode','manual','--resume','exact-session']);assert.doesNotMatch(args.join(' '),/bypass|dangerously|allowedTools|add-dir/);
 assert.equal(executorEvent('claude',{type:'system',subtype:'init',session_id:'claude-session'}).session_id,'claude-session');
 assert.equal(executorEvent('claude',{type:'result',subtype:'success',is_error:false,session_id:'claude-session'}).completed,true);
 assert.equal(executorEvent('claude',{type:'result',subtype:'error_during_execution',is_error:true}).completed,false);
 assert.equal(executorEvent('codex',{type:'turn.completed'}).completed,true);assert.deepEqual(continuityProposals('ordinary worker text'),[]);
});
test('Claude CLI survives a slow broker start without receiving its work prompt before acknowledgement',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-claude-fixture-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');await fs.mkdir(workspace);
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 try{
  git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);await fs.writeFile(path.join(workspace,'README.md'),'fixture');git(['add','.']);git(['commit','-m','fixture']);
  let stored=null,etag=0;const bucket={get:async()=>stored?{etag:String(etag),json:async()=>JSON.parse(stored)}:null,put:async(_key,value,{onlyIf})=>{if(stored&&onlyIf.etagMatches!==String(etag))return null;stored=value;return {etag:String(++etag)};}};
  const target={state:'active',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',lease_until:'2099-01-01T00:00:00Z',head_sha:git(['rev-parse','HEAD']),goal:'Preview feature',acceptance:['Preview works'],paths:['README.md']};
  const proposal={id:'readiness',goal_digest:'a'.repeat(64),kind:'strengthens',reason:'Clarify readiness',relationship:'Strengthens preview',supports:['A'],target_stage:'a',depends_on:['a'],acceptance:['Status updates'],profile:'engineering',paths:['README.md'],description:'Improve readiness status'};
  await operateJob(bucket,{action:'submit',project:'fixture',assignment:'fixture',expected_owner:'fixture',expected_branch:target.branch,expected_head_sha:target.head_sha,prompt:'fixture',required_capabilities:['claude-cli'],operation_id:'fixture-submit'},target);
  let startAccepted=false;
  const rpc=async(name,args)=>{
   if(name==='relay_runner_resume')return {ok:true};
   if(name==='relay_context')return {ok:true,entries:[],revision:0};
   if(name==='relay_runner_feedback_peek')return {ok:true,feedback:{available:true,events:[],conflicts:[],truncated:false}};
   if(args.action==='start')await new Promise(resolve=>setTimeout(resolve,450));
   const result=await operateJob(bucket,args,target);if(args.action==='start')startAccepted=true;return result;
  };
  const result=await runExecution({config:{provider:'claude',project:'fixture',assignment:'fixture',owner:'fixture',branch:target.branch,executor_id:'claude-host',continuity_discovery:{goal_digest:proposal.goal_digest},skill_tags:['no-matching-skill']},workspace,stateDir,rpc,getVersion:()=> 'Claude Code synthetic protocol fixture',spawnProcess:(command,args,options)=>{
   assert.equal(command,'claude');assert.ok(args.includes('manual'));
   const text='RELAY_CONTINUITY_ADDITIONS\n'+JSON.stringify({schema:1,additions:[proposal]});
   const child=spawn(process.execPath,['-e',`let input='';const deadline=setTimeout(()=>process.exit(12),150);process.stdin.on('data',chunk=>{clearTimeout(deadline);input+=chunk;});process.stdin.on('end',()=>{if(!input.trim().startsWith('Execute this existing Relay assignment'))process.exit(13);console.log(JSON.stringify({type:'system',subtype:'init',session_id:'claude-fixture'}));console.log(JSON.stringify({type:'assistant',message:{content:[{type:'text',text:${JSON.stringify(text)}}]}}));console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,session_id:'claude-fixture'}));});`],options);
   const write=child.stdin.write.bind(child.stdin);child.stdin.write=(value,...rest)=>{if(!startAccepted)assert.equal(String(value).trim(),'');return write(value,...rest);};
   const end=child.stdin.end.bind(child.stdin);child.stdin.end=(...args)=>{assert.equal(startAccepted,true);return end(...args);};return child;
  }});
  assert.equal(result.state,'succeeded');assert.equal(result.objective_completed,false);assert.deepEqual(result.continuity_additions,[proposal]);
  const receipt=JSON.parse(await fs.readFile(result.receipt,'utf8'));assert.equal(receipt.provider,'claude');assert.equal(receipt.job.process.adapter,'claude-cli');assert.equal(receipt.job.executor_id,'claude-host');assert.deepEqual(JSON.parse(stored).jobs[0].result.continuity_additions,[proposal]);
  await assert.rejects(runExecution({config:{provider:'codex',project:'fixture',assignment:'fixture',owner:'fixture',branch:target.branch},workspace,stateDir,rpc,getVersion:()=>{throw Error('must not execute');}}),/provider changed/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
for (const provider of ['claude','codex']) test(`${provider} CLI receives its own Test Agents adapter and its test-maintenance report reaches the job result`,async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-maintenance-fixture-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');await fs.mkdir(workspace);
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 try{
  git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);await fs.writeFile(path.join(workspace,'README.md'),'fixture');git(['add','.']);git(['commit','-m','fixture']);
  let stored=null,etag=0;const bucket={get:async()=>stored?{etag:String(etag),json:async()=>JSON.parse(stored)}:null,put:async(_key,value,{onlyIf})=>{if(stored&&onlyIf.etagMatches!==String(etag))return null;stored=value;return {etag:String(++etag)};}};
  const head=git(['rev-parse','HEAD']);
  const target={state:'active',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',lease_until:'2099-01-01T00:00:00Z',head_sha:head,goal:'Remove CSV export',acceptance:['CSV export is gone; Save and Share keep working'],paths:['README.md']};
  await operateJob(bucket,{action:'submit',project:'fixture',assignment:'fixture',expected_owner:'fixture',expected_branch:target.branch,expected_head_sha:head,prompt:'fixture',required_capabilities:[provider+'-cli'],operation_id:'fixture-submit'},target);
  const rpc=async(name,args)=>name==='relay_runner_resume'?{ok:true}:name==='relay_context'?{ok:true,entries:[],revision:0}:name==='relay_runner_feedback_peek'?{ok:true,feedback:{available:true,events:[],conflicts:[],truncated:false}}:operateJob(bucket,args,target);
  const report='RELAY_TEST_MAINTENANCE\n'+JSON.stringify({schema:1,tested_commit:head,run:{id:'local-1'},counts:{passed:3,failed:0,skipped:1,total:4},behaviors:[{id:'csv-export',status:'removed'},{id:'share',status:'unchanged'}],tests:[{id:'csv export is removed',outcome:'passed',behavior:'csv-export',classification:'obsolete-expectation',asserts:'absence',rationale:'Approved removal'},{id:'print preview',outcome:'skipped',rationale:'Covered by native suite'}]});
  const events=provider==='claude'
   ?[{type:'system',subtype:'init',session_id:'s'},{type:'assistant',message:{content:[{type:'text',text:report}]}},{type:'result',subtype:'success',is_error:false,session_id:'s'}]
   :[{type:'thread.started',thread_id:'s'},{type:'item.completed',item:{type:'agent_message',text:report}},{type:'turn.completed'}];
  let prompt='';
  const result=await runExecution({config:{provider,project:'fixture',assignment:'fixture',owner:'fixture',branch:target.branch,executor_id:provider+'-host',skill_tags:['no-matching-skill']},workspace,stateDir,rpc,getVersion:()=>provider+' synthetic protocol fixture',spawnProcess:(command,_args,options)=>{
   assert.equal(command,provider);const child=spawn(process.execPath,['-e',`process.stdin.resume();process.stdin.on('end',()=>{for(const e of ${JSON.stringify(events)})console.log(JSON.stringify(e));});`],options);
   const end=child.stdin.end.bind(child.stdin);child.stdin.end=value=>{prompt=String(value);return end(value);};return child;
  }});
  assert.equal(result.state,'succeeded');
  const data=JSON.parse(prompt.split('\n\n')[1]);
  assert.match(prompt,/follow context\.test_maintenance/);
  assert.deepEqual(data.context.test_maintenance.playwright_test_agents.init,{[provider]:`npx playwright init-agents --loop=${provider}`});
  assert.equal(data.context.test_maintenance.host,provider);
  const summary=JSON.parse(stored).jobs[0].result.summary;
  assert.match(summary,/Test maintenance pass · 3 passed, 0 failed, 1 skipped of 4 · commit [a-f0-9]{12} · run local-1 · skips: print preview \(Covered by native suite\)/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

import {createHash} from 'node:crypto';
import {validateCardStepsPublication,assignmentCardContext} from '../src/relay-card-steps.js';
import {contextCardModel} from '../src/relay-context-card-model.js';
const ordinaryHash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function ordinaryFixture(options={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-ordinary-')),workspace=path.join(root,'checkout'),stateDir=path.join(root,'receipts');await fs.mkdir(workspace);
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);git(['remote','add','origin','https://github.com/lrnolivia/fixture.git']);await fs.writeFile(path.join(workspace,'README.md'),'Synthetic ordinary coordinator fixture\n');git(['add','.']);git(['commit','-m','fixture']);
 const claim={id:'fixture',state:'active',owner:'fixture',branch:'relay/fixture',repository:'lrnolivia/fixture',lease_until:'2099-01-01T00:00:00Z',head_sha:git(['rev-parse','HEAD']),goal:'Review a synthetic fixture',acceptance:'Leave fixture intact and review actual source',paths:['README.md'],resources:[],category:'implementation',primary_role:'builder',primary_staff:'nico',primary_team:'runner',supporting_roles:[],supporting_staff:[],supporting_teams:[],...options.claim};
 const values=new Map();let etag=0,revision=1,spawns=0,staffWrites=0,lostFinish=false;const calls=[],cards=[];
 const bucket={get:async k=>{const v=values.get(k);return v?{etag:v.etag,json:async()=>JSON.parse(v.text)}:null;},put:async(k,text,{onlyIf})=>{const old=values.get(k);if(onlyIf instanceof Headers?Boolean(old):onlyIf.etagMatches!==old?.etag)return null;const tag=String(++etag);values.set(k,{text,etag:tag});return {etag:tag};}};
 const submitted=await operateJob(bucket,{action:'submit',project:'fixture',assignment:'fixture',expected_owner:'fixture',expected_branch:claim.branch,expected_head_sha:claim.head_sha,prompt:'Synthetic original request: inspect README without changing it',required_capabilities:['codex-cli'],operation_id:'ordinary-original'},claim);
 const rpc=async(name,args)=>{
  calls.push({name,args:structuredClone(args)});
  if(name==='relay_autonomy')return {ok:true,state:{held:false,revision:1}};
  if(name==='relay_runner_assignments')return {ok:true,record_sha:revision.toString(16).padStart(40,'0'),claims:[structuredClone(claim)]};
  if(name==='relay_runner_coordinate'){
   assert.equal(args.expected_record_sha,revision.toString(16).padStart(40,'0'));assert.equal(args.request.owner,claim.owner);
   if(args.request.card_steps){claim.card_steps=validateCardStepsPublication(args.request.card_steps,claim,ordinaryHash({goal:claim.goal,acceptance:claim.acceptance}));cards.push(contextCardModel({claim:assignmentCardContext(claim)}));}
   else {staffWrites++;if(options.staffFailure)throw Error('Synthetic lost response before write');for(const key of ['primary_role','primary_staff','primary_team','supporting_roles','supporting_staff','supporting_teams'])claim[key]=args.request[key];}
   revision++;if(options.staffLostAfter&&!args.request.card_steps)throw Error('Synthetic lost staffing response after application');return {ok:true};
  }
  if(name==='relay_runner_resume')return {ok:true,synthetic:true};
  if(name==='relay_context')return {ok:true,entries:[]};
  if(name==='relay_runner_feedback_peek')return {ok:true,feedback:{available:true,events:[],conflicts:[]}};
  assert.equal(name,'relay_execution');const result=await operateJob(bucket,args,claim);if(options.loseFinish&&args.action==='finish'&&!lostFinish){lostFinish=true;throw Error('Synthetic lost finish response after write');}return result;
 };
 const run=()=>runOrdinaryExecution({workspace,stateDir,config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',executor_id:'fixture',job_id:submitted.job.id},rpc,pollMs:10000,getVersion:()=> 'synthetic ordinary CLI test',spawnProcess:(_cmd,args,spawnOptions)=>{
  spawns++;assert.ok(!args.includes('resume'),'independent jobs need separate sessions');
  return spawn(process.execPath,['-e',`let prompt='';process.stdin.on('data',x=>prompt+=x);process.stdin.on('end',()=>{const d=JSON.parse(prompt.slice(prompt.indexOf('\\n\\n')+2));if(!prompt.includes('Do not create other agents or reassign work.'))process.exit(5);console.log(JSON.stringify({type:'thread.started',thread_id:'synthetic-session-'+${spawns}}));const sub=d.context.bounded_specialist?.public_submission;if(sub?.required&&!d.context.specialist_review&&!${Boolean(options.omitDesignUpdate)}){require('fs').writeFileSync(sub.file,JSON.stringify({...sub.binding,source_sha:require('child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),update:{text:'Synthetic design submission for review.',artifacts:[],preview:${options.pendingDesignPreview?"{state:'pending'}":"{state:'unavailable',reason:'The synthetic test worker has no design renderer.'}"}}}));}const b=d.context.specialist_review;if(b){${options.changeSource?"require('fs').appendFileSync('README.md','changed by reviewer');":''}const report={schema:1,verdict:${JSON.stringify(options.verdict||'passed')},initial_job_id:b.initial_job_id,source_fingerprint:${options.forge?"'f'.repeat(64)":"b.source_fingerprint"},findings:'Synthetic subprocess inspected the fixture',evidence:'README exists; this test is synthetic, not an authenticated model run'};${options.noReport?'':"console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'RELAY_SPECIALIST_REVIEW\\n'+JSON.stringify(report)}}));"}}console.log(JSON.stringify({type:'turn.completed'}));});`],spawnOptions);
 }});
 return {root,workspace,stateDir,claim,run,rpc,calls,cards,submitted,get spawns(){return spawns;},get staffWrites(){return staffWrites;},cleanup:()=>fs.rm(root,{recursive:true,force:true})};
}
test('ordinary entry adopts original job, actually launches independent CLI reviewer, validates publisher and renders specialist handoff',async()=>{
 const f=await ordinaryFixture();try{
  const result=await f.run();assert.equal(result.state,'succeeded');assert.equal(result.subobjective_completed,true);assert.equal(result.objective_completed,false);assert.equal(f.spawns,2);assert.equal(f.staffWrites,1);
  assert.equal(result.job_id,f.submitted.job.id);assert.equal(f.claim.card_steps.complete,false);assert.deepEqual(f.claim.card_steps.steps.map(s=>s.state),['passed','passed']);
  const submitted=f.calls.filter(c=>c.name==='relay_execution'&&c.args.action==='submit');assert.equal(submitted.length,1,'only review is newly submitted');
  const original=JSON.parse(await fs.readFile(path.join(f.stateDir,'continuity',f.submitted.job.id,'receipt.json'),'utf8'));assert.equal(original.job.request,f.submitted.job.request);
  assert.ok(f.cards.some(c=>c.identity.speaker?.id==='nico'&&c.plan.current==='run-assigned-worker'));
  assert.ok(f.cards.some(c=>c.identity.speaker?.id==='roman'&&c.identity.lead.id==='nico'&&c.plan.current==='review-current-work'));
  const repeated=await f.run();assert.equal(repeated.state,'succeeded');assert.equal(f.spawns,2,'refresh must not relaunch either worker');
 }finally{await f.cleanup();}
});
for(const [label,options] of [['missing verdict',{noReport:true}],['forged source',{forge:true}],['failed review',{verdict:'failed'}],['reviewer source edit',{changeSource:true}]])test('ordinary review cannot pass with '+label,async()=>{
 const f=await ordinaryFixture(options);try{if(options.changeSource)await assert.rejects(f.run(),/terminal but current source proof/);else{const result=await f.run();assert.equal(result.objective_completed,false);assert.equal(result.subobjective_completed,false);}assert.notEqual(f.claim.card_steps.steps[1].state,'passed');assert.ok(f.spawns<=3);if(options.verdict==='failed')assert.ok(f.cards.some(c=>c.identity.speaker?.id==='roman'&&c.plan.steps.find(s=>s.id==='review-current-work')?.state==='failed'));if(options.changeSource)assert.match(await fs.readFile(path.join(f.workspace,'README.md'),'utf8'),/changed by reviewer/);}finally{await f.cleanup();}
});
test('ordinary bootstrap preserves existing canonical plan and requires its private verifier authority',async()=>{
 const f=await ordinaryFixture({claim:{card_steps:{revision:'existing'}}});try{await assert.rejects(f.run(),/matching private plan/);assert.equal(f.spawns,0);assert.equal(f.staffWrites,0);assert.deepEqual(f.claim.card_steps,{revision:'existing'});}finally{await f.cleanup();}
});
test('uncertain reviewer staffing is saved, reconciled and never replayed or launched',async()=>{
 const f=await ordinaryFixture({staffFailure:true});try{await assert.rejects(f.run(),/Staffing amendment unconfirmed/);await assert.rejects(f.run(),/Staffing amendment unconfirmed/);assert.equal(f.staffWrites,1);assert.equal(f.spawns,0);assert.ok(JSON.parse(await fs.readFile(path.join(f.stateDir,'ordinary.json'),'utf8')).staffing_intent);}finally{await f.cleanup();}
});
test('ordinary entry refuses legacy pending receipt instead of duplicating an existing process',async()=>{
 const f=await ordinaryFixture();try{await fs.mkdir(f.stateDir);await fs.writeFile(path.join(f.stateDir,'receipt.json'),JSON.stringify({pending:{action:'start'}}));await assert.rejects(f.run(),/explicit reconciliation/);assert.equal(f.spawns,0);assert.equal(f.staffWrites,0);}finally{await f.cleanup();}
});
test('ordinary saved plan rejects owner changes and stale source without new specialist launches',async()=>{
 const f=await ordinaryFixture();try{await f.run();await fs.appendFile(path.join(f.workspace,'README.md'),'new source');await assert.rejects(f.run(),/terminal but current source proof/);assert.equal(f.spawns,2);f.claim.owner='other';await assert.rejects(f.run(),/active ownership/);assert.equal(f.spawns,2);}finally{await f.cleanup();}
});
test('ordinary resume reconciles lost canonical finish without another original process or submit',async()=>{
 const f=await ordinaryFixture({loseFinish:true});try{
  const first=await f.run();assert.equal(first.subobjective_completed,false);assert.equal(f.spawns,1);
  const receiptFile=path.join(f.stateDir,'continuity',f.submitted.job.id,'receipt.json');assert.equal(JSON.parse(await fs.readFile(receiptFile,'utf8')).pending.action,'finish');
  const resumed=await f.run();assert.equal(resumed.subobjective_completed,true);assert.equal(f.spawns,2);assert.equal(JSON.parse(await fs.readFile(receiptFile,'utf8')).pending,null);
  assert.equal(f.calls.filter(c=>c.name==='relay_execution'&&c.args.action==='submit').length,1);
  assert.equal(f.calls.filter(c=>c.name==='relay_execution'&&c.args.action==='finish'&&c.args.job_id===f.submitted.job.id).length,1,'readback must not replay finish');
 }finally{await f.cleanup();}
});
test('explicit legacy resume still reaches the original bounded session and leaves specialist review pending',async()=>{
 const f=await ordinaryFixture(),config={project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',executor_id:'fixture',job_id:f.submitted.job.id};
 try{
  const spawnWorker=(good)=> (_cmd,args,options)=>{if(good)assert.ok(args.includes('resume'));return spawn(process.execPath,['-e',`process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'legacy-session'}));${good?"console.log(JSON.stringify({type:'turn.completed'}));":"process.exitCode=1;"}});`],options);};
  const first=await runExecution({workspace:f.workspace,stateDir:f.stateDir,config,rpc:f.rpc,getVersion:()=> 'synthetic',spawnProcess:spawnWorker(false)});assert.equal(first.state,'failed');
  const resumed=await runOrdinaryExecution({workspace:f.workspace,stateDir:f.stateDir,config:{...config,resume:true},rpc:f.rpc,getVersion:()=> 'synthetic',spawnProcess:spawnWorker(true)});
  assert.equal(resumed.state,'succeeded');assert.equal(resumed.specialist_workflow_pending,true);assert.equal(resumed.objective_completed,false);assert.equal(f.staffWrites,0);
 }finally{await f.cleanup();}
});
test('ordinary staffing lost response after application continues only from exact independent readback',async()=>{
 const f=await ordinaryFixture({staffLostAfter:true});try{assert.equal((await f.run()).subobjective_completed,true);assert.equal(f.staffWrites,1);assert.equal(f.spawns,2);}finally{await f.cleanup();}
});
test('ordinary resume refuses a replaced canonical plan without rewriting shared priorities',async()=>{
 const f=await ordinaryFixture();try{await f.run();f.claim.card_steps.revision='f'.repeat(64);await assert.rejects(f.run(),/Canonical priorities changed/);assert.equal(f.spawns,2);assert.equal(f.claim.card_steps.revision,'f'.repeat(64));}finally{await f.cleanup();}
});
test('ordinary design work invokes the admitted design editor and preserves existing support bindings',async()=>{
 const f=await ordinaryFixture({claim:{category:'design',primary_role:'art-director',primary_staff:'valentina',primary_team:'inspector',supporting_roles:['integrator'],supporting_staff:['rafael'],supporting_teams:['source']}});
 try{assert.equal((await f.run()).subobjective_completed,true);assert.deepEqual(f.claim.supporting_staff,['rafael','margot']);assert.deepEqual(f.claim.supporting_teams,['source']);assert.ok(f.cards.some(c=>c.identity.speaker?.id==='margot'&&c.identity.lead.id==='valentina'));assert.equal(f.spawns,2);}finally{await f.cleanup();}
});
for(const [name,options]of [['missing',{omitDesignUpdate:true}],['still pending',{pendingDesignPreview:true}]])test('new ordinary design submission cannot silently pass with '+name+' preview disposition',async()=>{
 const f=await ordinaryFixture({...options,claim:{category:'design',primary_role:'art-director',primary_staff:'valentina',primary_team:'inspector'}});
 try{const result=await f.run();assert.equal(result.subobjective_completed,false);assert.equal(result.objective_completed,false);assert.equal(f.spawns,1,'missing submission must not launch a reviewer or repeat the original process');assert.notEqual(f.claim.card_steps.steps[0].state,'passed');const saved=JSON.parse(await fs.readFile(path.join(f.stateDir,'ordinary.json'),'utf8'));assert.deepEqual(saved.plan.stages[0].public_submission,{schema:1,kind:'design'});await assert.rejects(f.run(),/Design submission requires/);assert.equal(f.spawns,1);}finally{await f.cleanup();}
});
for(const [label,claim,person] of [['integration',{supporting_roles:['integrator'],supporting_staff:['rafael'],supporting_teams:['source']},'rafael'],['release',{category:'release'},'luca']])test('ordinary '+label+' work invokes a relevant specialist through actual process and canonical card',async()=>{
 const f=await ordinaryFixture({claim});try{assert.equal((await f.run()).subobjective_completed,true);assert.ok(f.cards.some(c=>c.identity.speaker?.id===person&&c.plan.current==='review-current-work'));assert.equal(f.spawns,2);}finally{await f.cleanup();}
});
