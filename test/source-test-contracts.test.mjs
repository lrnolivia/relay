import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {references,planTests,validateManifest,diffPaths,verifySourceTestContracts} from '../scripts/source-test-contracts.mjs';
import {REQUIRED_SUITES} from '../scripts/ci-test-orchestrator.mjs';
import {BUILD_INPUTS} from '../scripts/release-toolchain.mjs';

const manifest={schema:1,always_tests:[],edges:[],deferred:[]};
const plan=(before,after,changed,map=manifest)=>planTests({before,after,changed,manifest:map});
test('parser follows literal imports, reexports, requires, dynamic imports and file URL fixtures',()=>{
  const refs=references('fixture.ts',`// import 'fake';\nconst s="require('fake')"; import type {Type} from './types'; export {value} from './module.js'; const a=require('./common.cjs'); import('./lazy.js'); import(variable); const f=new URL('./fixture.json',import.meta.url);`);
  assert.deepEqual(refs.imports,['./types','./module.js','./common.cjs','./lazy.js']);assert.deepEqual(refs.resources,['./fixture.json']);assert.equal(refs.dynamic,1);
  assert.throws(()=>references('broken.mjs','import {'),{code:'source_parse_failed'});
});
test('changed implementation reaches tests through callers and reexports, with cycles bounded',()=>{
  const files={'lib.js':'export const x=1;','caller.js':"export * from './lib.js'; import './loop.js';",'loop.js':"import './caller.js';",'named.test.mjs':"import './caller.js';",'unrelated.test.mjs':''};
  const r=plan(files,files,['lib.js']);assert.deepEqual(r.selected_tests,['named.test.mjs']);assert.deepEqual(r.unmapped_changed_paths,[]);
});
test('imported fixture modules and file URL data select their consuming named tests',()=>{
  const files={'fixture.json':'','shared.test.mjs':"export const fixture=new URL('./fixture.json',import.meta.url);",'consumer.test.mjs':"import './shared.test.mjs';"};
  assert.deepEqual(plan(files,files,['fixture.json']).selected_tests,['consumer.test.mjs','shared.test.mjs']);
});
test('removed imports and files retain base-side caller evidence',()=>{
  const before={'old.js':'','caller.js':"import './old.js';",'named.test.mjs':"import './caller.js';"};
  const after={'caller.js':'','named.test.mjs':"import './caller.js';"};
  assert.deepEqual(plan(before,after,['old.js','caller.js']).selected_tests,['named.test.mjs']);
  assert.match(plan(before,{},['named.test.mjs']).deferred_tests[0].reasons[0],/removed/);
});
test('reviewed non-import configuration and resource edges include deleted inputs',()=>{
  const files={'named.test.mjs':''};
  const map={...manifest,edges:[{id:'resource',inputs:['assets/**','config.json'],consumers:['named.test.mjs'],reason:'Reviewed fixture contract'}]};
  assert.deepEqual(plan(files,files,['assets/deleted.svg'],map).selected_tests,['named.test.mjs']);
  assert.deepEqual(plan(files,files,['config.json'],map).selected_tests,['named.test.mjs']);
});
test('browser and generated/compiled dependencies are deferred without dropping full suites',()=>{
  const files={'browser-helper.js':"import {chromium} from 'playwright';",'browser.test.mjs':"import './browser-helper.js';",'payload.test.mjs':"import './generated.js';",'types.ts':'','compiled.test.mjs':"import './types';"};
  const map={...manifest,deferred:[{paths:['generated.js'],reason:'Build required'}]};
  const r=plan(files,files,Object.keys(files),map);assert.deepEqual(r.selected_tests,[]);assert.equal(r.deferred_tests.length,3);assert.deepEqual(r.full_required_suites,REQUIRED_SUITES.map(s=>s.id));
  assert.match(r.deferred_tests.find(t=>t.path==='browser.test.mjs').reasons[0],/Browser/);assert.deepEqual(r.deferred_tests.find(t=>t.path==='payload.test.mjs').reasons,['Build required']);
});
test('reading browser or TypeScript source as a fixture does not require its runtime',()=>{
  const files={'browser.ts':"import 'playwright';",'source.test.mjs':"const source=new URL('./browser.ts',import.meta.url);"};
  assert.deepEqual(plan(files,files,['browser.ts']).selected_tests,['source.test.mjs']);
});
test('unmapped source and dynamic links are explicit limits, never full-acceptance claims',()=>{
  const files={'unknown.js':'','dynamic.js':'import(variable);','named.test.mjs':"import './dynamic.js';"};
  const r=plan(files,files,['unknown.js','dynamic.js']);assert.deepEqual(r.unmapped_changed_paths,['unknown.js']);assert.ok(r.unresolved_references.some(ref=>ref.kind==='nonliteral-module-or-resource'));assert.match(r.limits.join(' '),/not full acceptance/);
});
test('stale consumers, duplicate edges and traversal patterns reject the manifest',()=>{
  const good={id:'one',inputs:['config.json'],consumers:['named.test.mjs'],reason:'Reviewed contract'};
  for(const edges of [[{...good,consumers:['missing.test.mjs']}],[good,good],[{...good,inputs:['../private/**']}],[{...good,inputs:['src/*.js']}],[{...good,reason:''}]])assert.throws(()=>validateManifest({...manifest,edges},new Set(['named.test.mjs'])),{code:'invalid_contract_map'});
  assert.throws(()=>plan({}, {},['../outside']),{code:'invalid_changed_path'});
});
test('mandatory map tests run even when no changed path has an import edge',()=>{
  const files={'map.test.mjs':''};assert.deepEqual(plan(files,files,['notes.md'],{...manifest,always_tests:['map.test.mjs']}).selected_tests,['map.test.mjs']);
});
test('unrelated baseline syntax is visible, while affected broken source blocks the gate',()=>{
  const files={'broken.js':'import {','named.test.mjs':"import './good.js';",'good.js':''};
  const r=plan(files,files,['good.js']);assert.deepEqual(r.selected_tests,['named.test.mjs']);assert.ok(r.unresolved_references.some(ref=>ref.path==='broken.js'&&ref.kind==='syntax-error'));
  assert.throws(()=>plan(files,files,['broken.js']),{code:'source_parse_failed'});
});
test('exact diff includes rename source/destination and deletions; missing or symbolic ranges reject',async t=>{
  const root=await mkdtemp(join(tmpdir(),'relay-source-map-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git(['init']);await writeFile(join(root,'old.js'),'// old');await writeFile(join(root,'deleted.js'),'// delete');git(['add','.']);git(['-c','user.name=Relay fixture','-c','user.email=fixture@example.invalid','commit','-m','base']);const base=git(['rev-parse','HEAD']);
  git(['mv','old.js','new.js']);git(['rm','deleted.js']);git(['-c','user.name=Relay fixture','-c','user.email=fixture@example.invalid','commit','-m','head']);const head=git(['rev-parse','HEAD']);
  assert.deepEqual(diffPaths({root,base,head}).sort(),['deleted.js','new.js','old.js']);
  for(const invalid of ['HEAD','0'.repeat(40),'a'.repeat(40)])assert.throws(()=>diffPaths({root,base:invalid,head}));
});
test('preflight failures retain a nonpassing receipt rather than claiming an empty plan passed',async t=>{
  const root=await mkdtemp(join(tmpdir(),'relay-map-failure-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await assert.rejects(verifySourceTestContracts({root,env:{}}));const receipt=JSON.parse(await readFile(join(root,'qa-evidence/source-test-contracts/result.json')));assert.equal(receipt.state,'blocked');assert.equal(receipt.exit_code,1);assert.equal(receipt.full_acceptance,false);
});
test('real source range selects and executes a failing caller test with its original exit',async t=>{
  const root=await mkdtemp(join(tmpdir(),'relay-map-execution-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const put=async(path,text)=>{await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),text);};
  for(const path of BUILD_INPUTS)await put(path,await readFile(new URL('../'+path,import.meta.url)));
  await put('.gitignore','qa-evidence/\n');await put('lib.js','export const value=0;');
  await put('caller.js',"export {value} from './lib.js';");
  await put('named.test.mjs',"import test from 'node:test';import assert from 'node:assert/strict';import {value} from './caller.js';test('caller contract',()=>assert.equal(value,0));");
  await put('test/source-test-contracts.json',JSON.stringify({...manifest,always_tests:['named.test.mjs']}));
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const commit=()=>{git(['add','.']);git(['-c','user.name=Relay fixture','-c','user.email=fixture@example.invalid','commit','-m','source contract fixture']);return git(['rev-parse','HEAD']);};
  git(['init']);const base=commit();await put('lib.js','export const value=1;');const head=commit();
  const r=await verifySourceTestContracts({root,env:{...process.env,RELAY_SOURCE_SHA:head,RELAY_CONTRACT_BASE_SHA:base,WORKERS_CI_COMMIT_SHA:'',GITHUB_SHA:''}});
  assert.equal(r.state,'failed');assert.equal(r.exit_code,1);assert.equal(r.tests.results[0].exit_code,1);assert.deepEqual(r.plan.selected_tests,['named.test.mjs']);assert.deepEqual(r.range.changed_paths,['lib.js']);assert.equal(r.range.head_sha,head);assert.match(r.tests.results[0].diagnostic,/caller contract|Assertion/);assert.equal(r.full_acceptance,false);
});
test('CI maps exact source range before build/browser and preserves mapping/blocking evidence',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  assert.ok(workflow.indexOf('id: setup-contracts')>workflow.indexOf('id: setup-install'));
  assert.ok(workflow.indexOf('id: setup-contracts')<workflow.indexOf('id: setup-build'));assert.ok(workflow.indexOf('id: setup-contracts')<workflow.indexOf('id: setup-browser'));
  assert.match(workflow,/RELAY_CONTRACT_BASE_SHA: \$\{\{ github.event.pull_request.base.sha \|\| github.event.before \}\}/);
  assert.match(workflow,/steps\.setup-contracts\.outcome != 'success'/);assert.match(workflow,/RELAY_SETUP_CONTRACTS:/);assert.match(workflow,/Preserve source and named-test contract mapping\n\s+if: always\(\)/);assert.doesNotMatch(workflow,/continue-on-error:/);
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));assert.equal(pkg.scripts['test:source-contracts'],'node scripts/source-test-contracts.mjs');
  assert.deepEqual(REQUIRED_SUITES.map(s=>s.id),['inspector','runner','layout','contracts','web']);
});
