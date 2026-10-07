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
  const rpc=createMcpClient({token:'fixture',fetchImpl:async()=>Response.json({result:{structuredContent:{ok:true,job:{state:'queued'}}}})});
  assert.equal((await rpc('relay_execution',{})).job.state,'queued');
});

import { runExecution } from './relay-executor.mjs';
import { operateJob } from '../packages/runner/src/jobs.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
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
