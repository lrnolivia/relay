import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {REQUIRED_SUITES} from '../scripts/ci-test-orchestrator.mjs';
import {SUITE_GROUPS,validateGroups,aggregateGroups,runParallelGroups,prepareSnapshot,copyEvidence} from '../scripts/ci-parallel-suites.mjs';
import {BUILD_OUTPUTS} from '../scripts/release-toolchain.mjs';
const identity={source_sha:'a'.repeat(40),run_id:'123',run_attempt:'1',artifact_set_sha256:'b'.repeat(64)};
const suite=(id,code)=>({id,command:process.execPath,args:['-e',code],required:true,dependsOn:[]});
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'relay-parallel-test-'));t.after(()=>rm(root,{recursive:true,force:true}));const workspaces=[];for(const id of ['first','second']){const cwd=join(root,id);await mkdir(cwd);workspaces.push({id,cwd,temp:join(root,id+'-tmp')});}return {root,workspaces};}
function passing(){return SUITE_GROUPS.map(group=>({schema:1,group:group.id,identity:{...identity},required_suites:[...group.suites],artifact_verified:true,exit_code:0,results:group.suites.map(id=>({id,required:true,status:'passed',exit_code:0}))}));}
test('two balanced groups include every historical required command unchanged, exactly once',()=>{
 assert.equal(SUITE_GROUPS.length,2);assert.deepEqual(SUITE_GROUPS.map(g=>g.suites),[['inspector','runner','layout'],['contracts','web']]);assert.equal(validateGroups(),SUITE_GROUPS);
 for(const groups of [[],[{id:'all',suites:['inspector']}],[{id:'all',suites:REQUIRED_SUITES.map(s=>s.id).concat('web')}],[{id:'same',suites:['inspector']},{id:'same',suites:['runner','layout','contracts','web']}]])assert.throws(()=>validateGroups(groups));
 assert.throws(()=>validateGroups([{id:'first',suites:['one']},{id:'second',suites:['two']}],[suite('one',''),{...suite('two',''),dependsOn:['one']}]),/dependencies/);
});
test('aggregate fails closed on missing, duplicate, stale, cancelled, failed or unverified evidence',()=>{
 assert.equal(aggregateGroups({reports:passing(),identity}).exit_code,0);
 const changes=[r=>r.pop(),r=>r.push(r[0]),r=>r[0].group='unknown',r=>r[0].identity.source_sha='c'.repeat(40),r=>r[0].identity.run_attempt='2',r=>r[0].identity.artifact_set_sha256='c'.repeat(64),r=>r[0].required_suites.reverse(),r=>r[0].results.pop(),r=>r[0].results[0].required=false,r=>r[0].results[0].status='cancelled',r=>r[0].results[0].status='timed_out',r=>r[0].results[0].exit_code=7,r=>r[0].exit_code=1,r=>r[0].artifact_verified=false];
 for(const change of changes){const reports=passing();change(reports);assert.equal(aggregateGroups({reports,identity}).exit_code,1);}
});
test('actual groups overlap while fixture files, temporary files and listening ports remain independent',async t=>{
 const f=await fixture(t),barrier=join(f.root,'barrier');await mkdir(barrier);
 const code=id=>`const fs=require('node:fs'),path=require('node:path'),http=require('node:http');fs.writeFileSync('same-fixture','${id}');fs.writeFileSync(path.join(process.env.TMPDIR,'same-temp'),'${id}');fs.writeFileSync(${JSON.stringify(barrier)}+'/${id}','ready');let attempts=0;const timer=setInterval(()=>{if(fs.readdirSync(${JSON.stringify(barrier)}).length===2){clearInterval(timer);const server=http.createServer();server.listen(0,'127.0.0.1',()=>{fs.writeFileSync('port',String(server.address().port));setTimeout(()=>server.close(),150);});}else if(++attempts>100){clearInterval(timer);process.exit(8)}},10);`;
 const suites=[suite('one',code('one')),suite('two',code('two'))],groups=[{id:'first',suites:['one']},{id:'second',suites:['two']}];
 const report=await runParallelGroups({...f,identity,groups,suites});assert.equal(report.exit_code,0,JSON.stringify(report));
 const ports=[];for(const [i,w] of f.workspaces.entries()){const id=i?'two':'one';assert.equal(await readFile(join(w.cwd,'same-fixture'),'utf8'),id);assert.equal(await readFile(join(w.temp,'same-temp'),'utf8'),id);ports.push(await readFile(join(w.cwd,'port'),'utf8'));}assert.notEqual(ports[0],ports[1]);
});
test('one failed group neither cancels its sibling nor omits later tests in its own group',async t=>{
 const f=await fixture(t),suites=[suite('bad','process.exit(9)'),suite('later',"require('node:fs').writeFileSync('later','ran')"),suite('good',"require('node:fs').writeFileSync('good','ran')")],groups=[{id:'first',suites:['bad','later']},{id:'second',suites:['good']}];
 const report=await runParallelGroups({...f,identity,suites,groups});assert.equal(report.exit_code,1);assert.deepEqual(report.results.map(r=>r.status),['failed','passed','passed']);assert.equal(report.results[0].exit_code,9);
});
test('timeout remains nonpassing while an independent sibling completes',async t=>{
 const f=await fixture(t),suites=[suite('hang','setInterval(()=>{},100)'),suite('good','')],groups=[{id:'first',suites:['hang']},{id:'second',suites:['good']}];
 const report=await runParallelGroups({...f,identity,suites,groups,timeoutMs:250});assert.equal(report.exit_code,1);assert.deepEqual(report.results.map(r=>r.status),['timed_out','passed']);
});
test('cancellation accounts for every suite and cannot produce a successful aggregate',async t=>{
 const f=await fixture(t),controller=new AbortController();controller.abort();
 const suites=[suite('one',''),suite('two','')],groups=[{id:'first',suites:['one']},{id:'second',suites:['two']}];
 const report=await runParallelGroups({...f,identity,suites,groups,signal:controller.signal});assert.equal(report.exit_code,1);assert.ok(report.results.every(r=>r.status==='cancelled'));
});
test('a changed artifact after execution invalidates even passing tests',async t=>{
 const f=await fixture(t),suites=[suite('one',"require('node:fs').writeFileSync('changed','yes')"),suite('two','')],groups=[{id:'first',suites:['one']},{id:'second',suites:['two']}];
 const report=await runParallelGroups({...f,identity,suites,groups,verify:async cwd=>{try{await readFile(join(cwd,'changed'));}catch{return;}throw Error('changed build');}});assert.equal(report.exit_code,1);assert.equal(report.results[0].status,'not_run');assert.equal(report.results[1].status,'passed');
});
test('snapshot uses exact Git HEAD and independent dependency/build bytes without reinstall or rebuild',async t=>{
 const f=await fixture(t),root=f.workspaces[0].cwd,directory=join(f.root,'snapshot');
 const put=async(p,v)=>{await mkdir(join(root,p,'..'),{recursive:true});await writeFile(join(root,p),v);};
 await put('package-lock.json',JSON.stringify({packages:{'':{},'apps/web':{},'node_modules/example':{}}}));await put('tracked','exact source');
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();git(['init']);git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture']);
 const receipt={identity:{source_sha:git(['rev-parse','HEAD'])}};for(const path of BUILD_OUTPUTS)await put(path,'sealed '+path);await put('qa-evidence/toolchain/build.json',JSON.stringify(receipt));await put('node_modules/example/index.js','dependency');await put('apps/web/node_modules/nested/index.js','nested');await mkdir(join(root,'node_modules/@relay'));await symlink('../../apps/web',join(root,'node_modules/@relay/web'));
 const calls=[];await prepareSnapshot({root,directory,receipt,verify:async(_,options)=>calls.push(options.root)});assert.deepEqual(calls,[root,directory]);assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8'}).trim(),receipt.identity.source_sha);
 assert.equal(await readFile(join(directory,'node_modules/@relay/web/node_modules/nested/index.js'),'utf8'),'nested');await writeFile(join(directory,'node_modules/example/index.js'),'changed');assert.equal(await readFile(join(root,'node_modules/example/index.js'),'utf8'),'dependency');
 for(const path of BUILD_OUTPUTS)assert.equal(await readFile(join(directory,path),'utf8'),'sealed '+path);
 await symlink(join(f.root,'first-tmp'),join(root,'node_modules/escape'));await mkdir(join(f.root,'first-tmp'));
 await assert.rejects(prepareSnapshot({root,directory:join(f.root,'unsafe'),receipt,verify:async()=>{}}),/escapes isolated snapshot/);
});
test('evidence merge preserves all groups and refuses overwrites or symlinks',async t=>{
 const f=await fixture(t),[a,b]=f.workspaces.map(w=>w.cwd),dest=join(f.root,'evidence');await writeFile(join(a,'result.json'),'one');await copyEvidence(a,dest);await copyEvidence(a,dest);await writeFile(join(b,'result.json'),'two');await assert.rejects(copyEvidence(b,dest),/Conflicting/);assert.equal(await readFile(join(dest,'result.json'),'utf8'),'one');await symlink(join(a,'result.json'),join(b,'link'));await rm(join(b,'result.json'));await assert.rejects(copyEvidence(b,dest),/regular files/);
});
test('canonical workflow keeps one install/build, standard runner, full gate and all group evidence',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
 assert.equal((workflow.match(/runs-on: ubuntu-latest/g)||[]).length,1);assert.equal((workflow.match(/-- npm ci/g)||[]).length,1);assert.equal((workflow.match(/-- npm run build/g)||[]).length,1);
 assert.match(workflow,/run: node scripts\/ci-parallel-suites.mjs/);assert.match(workflow,/qa-evidence\/parallel-suites\//);assert.match(workflow,/name: quality/);assert.match(workflow,/node scripts\/ci-stage.mjs --summary quality/);assert.doesNotMatch(workflow,/continue-on-error:|NODE_OPTIONS:/);
});
