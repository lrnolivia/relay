import '../scripts/relay-native-continuity.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {runContinuityExecution} from '../scripts/relay-continuity.mjs';
import {continuityObjectiveDigest,expansionDigest} from '../packages/runner/src/continuity-expansion.mjs';

test('lost canonical amendment reply is reconciled and a fresh coordinator recovers supporting acceptance without duplicate work',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'relay-canonical-expansion-')),workspace=path.join(root,'checkout');await fs.mkdir(workspace);
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 try{
  git(['init','-b','relay/fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);await fs.writeFile(path.join(workspace,'README.md'),'baseline');git(['add','.']);git(['commit','-m','baseline']);
  const objective={goal:'Build the assigned preview',acceptance:'Preview verified and shipped'},proposal={id:'readiness',goal_digest:expansionDigest(objective.goal),kind:'strengthens',reason:'Clarify when preview is ready',relationship:'Strengthens original preview acceptance A',supports:['A'],target_stage:'a',depends_on:['a'],acceptance:['Readiness indicator verified'],profile:'engineering',paths:['src/readiness.js'],description:'Add readiness indicator'};
  const command=id=>[process.execPath,'-e',`require('node:fs').appendFileSync('${id}.txt','once\\n')`],verify=id=>[process.execPath,'-e',`if(!require('node:fs').existsSync('${id}.txt'))process.exit(1)`];
  const plan={schema:1,authorization:'Complete original feature through shipping',objective_digest:continuityObjectiveDigest(objective.goal,objective.acceptance),criteria:['A','B'],environment:{node:'fixture'},stages:[{id:'a',kind:'implementation',criteria:['A'],depends_on:[],prompt:'Build preview',inputs:['README.md'],command:command('a'),verify:verify('a')},{id:'ship',kind:'ship',criteria:['B'],depends_on:['a'],prompt:'Ship preview',inputs:['README.md'],command:command('ship'),verify:verify('ship')}],expansion:{enabled:true,authorization:'Add directly strengthening features while preserving preview goal',original_goal:objective.goal,allowed_paths:['src/'],profiles:{engineering:{kind:'implementation',inputs:['README.md','src/'],command:command('support'),verify:verify('support')}},review:[process.execPath,'-e',`let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const {proposal:p}=JSON.parse(s);process.stdout.write(JSON.stringify({verdict:'admit',preserves_goal:true,goal_digest:p.goal_digest,within_authority:true,sensitive_permissions:false,paid_services:false,canonical_key:p.id,reason:'Direct support within authorized feature'}))})`]}};
  let assignment={...objective,id:'fixture',owner:'fixture',branch:'relay/fixture',state:'active',lease_until:new Date(Date.now()+3600000).toISOString(),paths:['README.md']},revision='a'.repeat(40),amendments=0;
  const rpc=async(name,args)=>{
   if(name==='relay_autonomy')return {ok:true,state:{held:false,revision:0}};
   if(name==='relay_runner_assignments')return {ok:true,record_sha:revision,claims:[structuredClone(assignment)]};
   if(name==='relay_runner_coordinate'){
    amendments++;assert.equal(args.action,'amend');assert.equal(args.expected_record_sha,revision);assert.equal(args.request.goal,undefined);assert.equal(args.request.acceptance,undefined);
    assignment={...assignment,paths:args.request.paths,acceptance_additions:args.request.acceptance_additions};revision='b'.repeat(40);throw Error('Lost reply after committed amendment');
   }
   throw Error('Command profiles must not launch an agent');
  };
  const run=(stateDir,additions)=>runContinuityExecution({config:{project:'fixture',assignment:'fixture',owner:'fixture',branch:'relay/fixture',continuity:plan,continuity_additions:additions},workspace,stateDir:path.join(root,stateDir),rpc,runExecution:()=>{throw Error('No agent permitted in fixture');}});
  const first=await run('receipts',[proposal]);assert.equal(first.objective_completed,true);assert.equal(amendments,1);assert.equal(assignment.acceptance_additions[0].proposal.id,'readiness');
  assert.equal((await run('receipts',[proposal])).objective_completed,true);assert.equal(amendments,1);
  // A new provider/coordinator has canonical acceptance but no former local journal.
  delete plan.expansion.review;
  const recovered=await run('fresh-receipts',[]);assert.equal(recovered.objective_completed,true);assert.equal(recovered.additions[0].status,'admitted');assert.equal(amendments,1);
  for(const id of ['a','support','ship'])assert.equal(await fs.readFile(path.join(workspace,id+'.txt'),'utf8'),'once\n');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
