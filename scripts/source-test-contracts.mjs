import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,posix,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectToolchain} from './release-toolchain.mjs';
import {runSuites,REQUIRED_SUITES,redact} from './ci-test-orchestrator.mjs';

// Reuse the web workspace's locked compiler; do not add a second parser/toolchain.
const require=createRequire(new URL('../apps/web/package.json',import.meta.url));
const ts=require('typescript');
const code=/\.(?:[cm]?js|jsx|tsx?|mts|cts)$/;
const testFile=/\.test\.(?:mjs|cjs|js)$/;
const safePath=path=>typeof path==='string'&&path.length>0&&!path.startsWith('/')&&!path.includes('\\')&&!path.split('/').some(p=>p==='..'||p==='.'||!p);
const match=(path,pattern)=>pattern.endsWith('/**')?path.startsWith(pattern.slice(0,-2)):path===pattern;
const fail=(code,message)=>{const error=Error(message);error.code=code;throw error;};

export function references(path,text,{tolerateSyntax=false}={}){
  const file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
  if(file.parseDiagnostics.length&&!tolerateSyntax)fail('source_parse_failed','Cannot map syntax in '+path);
  const imports=[],resources=[];let dynamic=0;
  const literal=node=>node&&(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))?node.text:null;
  const add=node=>{const value=literal(node);if(value===null)dynamic++;else imports.push(value);};
  const visit=node=>{
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier)add(node.moduleSpecifier);
    if(ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference))add(node.moduleReference.expression);
    if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require')))add(node.arguments[0]);
    if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='URL'&&node.arguments?.length===2&&node.arguments[1].getText(file)==='import.meta.url'){
      const value=literal(node.arguments[0]);if(value===null)dynamic++;else if(value.startsWith('.'))resources.push(value);
    }
    ts.forEachChild(node,visit);
  };
  visit(file);return {imports:[...new Set(imports)],resources:[...new Set(resources)],dynamic,parse_errors:file.parseDiagnostics.length};
}

export function validateManifest(manifest,files){
  if(manifest?.schema!==1||!Array.isArray(manifest.edges)||!Array.isArray(manifest.deferred)||!Array.isArray(manifest.always_tests))fail('invalid_contract_map','Invalid source/test contract manifest');
  const patterns=values=>Array.isArray(values)&&values.length>0&&values.every(value=>safePath(value.replace(/\/\*\*$/,''))&&!value.replace(/\/\*\*$/,'').includes('*'));
  const ids=new Set();
  const known=new Set([...files,...manifest.deferred.flatMap(rule=>rule.paths||[]).filter(path=>typeof path==='string'&&!path.includes('*'))]);
  for(const edge of manifest.edges){
    if(!edge||typeof edge.id!=='string'||ids.has(edge.id)||!patterns(edge.inputs)||!Array.isArray(edge.consumers)||!edge.consumers.length||edge.consumers.some(path=>!safePath(path)||!known.has(path))||typeof edge.reason!=='string'||!edge.reason.trim())fail('invalid_contract_map','Invalid, duplicate or stale reviewed contract edge');
    ids.add(edge.id);
  }
  for(const rule of manifest.deferred)if(!rule||!patterns(rule.paths)||typeof rule.reason!=='string'||!rule.reason.trim())fail('invalid_contract_map','Invalid deferred test prerequisite');
  if(manifest.always_tests.some(path=>!safePath(path)||!testFile.test(path)||!files.has(path)))fail('invalid_contract_map','Mandatory mapping test is missing');
  return manifest;
}

function resolveReference(from,specifier,files){
  const path=posix.normalize(posix.join(posix.dirname(from),specifier));
  if(!safePath(path))return null;
  return [path,...['.js','.mjs','.cjs','.ts','.tsx','.jsx','/index.js','/index.mjs','/index.ts','/index.tsx'].map(ext=>path+ext)].find(path=>files.has(path))||path;
}

// Combine both source snapshots: deleting an import/fixture must not erase its
// previous callers from the audit. This is dependency evidence, not a proof of
// all runtime links; string-built resources need reviewed edges below.
export function planTests({before,after,changed,manifest}){
  const files=new Set([...Object.keys(before),...Object.keys(after)]);
  validateManifest(manifest,files);
  if(!Array.isArray(changed)||changed.some(path=>!safePath(path)))fail('invalid_changed_path','Changed paths must be repository-relative files');
  const reverse=new Map(),forward=new Map(),runtime=new Map(),external=new Map(),unresolved=[];
  const edge=(consumer,input,isImport=false)=>{if(!reverse.has(input))reverse.set(input,new Set());reverse.get(input).add(consumer);if(!forward.has(consumer))forward.set(consumer,new Set());forward.get(consumer).add(input);if(isImport){if(!runtime.has(consumer))runtime.set(consumer,new Set());runtime.get(consumer).add(input);}};
  for(const [snapshot,sources] of [['base',before],['head',after]])for(const [path,text] of Object.entries(sources)){
    if(!code.test(path))continue;
    const refs=references(path,text,{tolerateSyntax:true});
    if(refs.parse_errors)unresolved.push({path,snapshot,kind:'syntax-error',count:refs.parse_errors});
    if(refs.dynamic)unresolved.push({path,snapshot,kind:'nonliteral-module-or-resource',count:refs.dynamic});
    for(const specifier of [...refs.imports,...refs.resources]){
      if(!specifier.startsWith('.')){if(!external.has(path))external.set(path,new Set());external.get(path).add(specifier);continue;}
      const dependency=resolveReference(path,specifier,files);
      if(dependency)edge(path,dependency,refs.imports.includes(specifier));
      if(!dependency||!files.has(dependency))unresolved.push({path,snapshot,kind:'untracked-relative-reference',specifier});
    }
  }
  for(const rule of manifest.edges)for(const input of files)if(rule.inputs.some(pattern=>match(input,pattern)))for(const consumer of rule.consumers)edge(consumer,input);
  // Missing/deleted input paths still activate reviewed resource/config edges.
  for(const input of changed)for(const rule of manifest.edges)if(rule.inputs.some(pattern=>match(input,pattern)))for(const consumer of rule.consumers)edge(consumer,input);
  const closure=(seeds,graph)=>{const seen=new Set(seeds),queue=[...seen];for(let i=0;i<queue.length;i++)for(const next of graph.get(queue[i])||[])if(!seen.has(next)){seen.add(next);queue.push(next);}return seen;};
  const affected=closure(changed,reverse),selected=[],deferred=[];
  const broken=unresolved.find(ref=>ref.kind==='syntax-error'&&ref.snapshot==='head'&&affected.has(ref.path));
  if(broken)fail('source_parse_failed','Affected source cannot be parsed: '+broken.path);
  const tests=[...new Set([...affected].filter(path=>testFile.test(path)).concat(manifest.always_tests))].sort();
  for(const path of tests){
    const reasons=[];
    if(!(path in after))reasons.push('Test removed from candidate; historical callers retained in audit');
    const dependencies=closure([path],forward);
    const modules=closure([path],runtime);
    if([...modules].some(path=>[...external.get(path)||[]].some(name=>/^(?:@playwright\/|playwright(?:\/|$))/.test(name))))reasons.push('Browser runtime required');
    if([...modules].some(path=>/\.(?:tsx?|jsx|mts|cts)$/.test(path)))reasons.push('Compilation or module loader required');
    for(const rule of manifest.deferred)if([...dependencies].some(path=>rule.paths.some(pattern=>match(path,pattern))))reasons.push(rule.reason);
    if(reasons.length)deferred.push({path,reasons:[...new Set(reasons)]});else selected.push(path);
  }
  const unmapped=changed.filter(path=>!tests.some(test=>closure([path],reverse).has(test))).sort();
  return {selected_tests:selected,deferred_tests:deferred,affected_paths:[...affected].sort(),unmapped_changed_paths:unmapped,unresolved_references:unresolved.filter(ref=>affected.has(ref.path)||ref.kind==='syntax-error'),full_required_suites:REQUIRED_SUITES.map(suite=>suite.id),limits:['Static literal imports/reexports/requires and import.meta.url resources, plus reviewed resource/config edges only','Unmapped paths, dynamic links and deferred tests remain subject to all five full suites; early success is not full acceptance']};
}

export function diffPaths({root,base,head}){
  if(!/^[a-f0-9]{40}$/.test(base||'')||/^0+$/.test(base)||!/^[a-f0-9]{40}$/.test(head||''))fail('invalid_source_range','Mapping requires exact nonzero base/head commit SHAs');
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
  for(const sha of [base,head])if(git(['rev-parse',sha+'^{commit}']).trim()!==sha)fail('invalid_source_range','Source range must identify commits');
  return git(['diff','--no-renames','--name-only','-z',base,head,'--']).split('\0').filter(Boolean);
}

function snapshot(root,sha){
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
  const paths=git(['ls-tree','-r','--name-only','-z',sha]).split('\0').filter(Boolean);
  return Object.fromEntries(paths.map(path=>[path,code.test(path)?git(['show',sha+':'+path]):'']));
}

export async function verifySourceTestContracts({root=process.cwd(),env=process.env,signal,onOutput=()=>{}}={}){
  const output=resolve(root,'qa-evidence/source-test-contracts/result.json');await mkdir(dirname(output),{recursive:true});
  const receipt={schema:1,kind:'source-test-contracts',state:'running',full_acceptance:false};
  const save=async()=>{await writeFile(output+'.tmp',JSON.stringify(receipt,null,2)+'\n');await rename(output+'.tmp',output);};
  await save();
  try{
    receipt.identity=await inspectToolchain({root,env});
    const head=receipt.identity.source_sha;
    // PR uses its exact base tip, push its exact before tip. Manual runs audit
    // HEAD's parent; the selected range is always retained in the receipt.
    const base=env.RELAY_CONTRACT_BASE_SHA||execFileSync('git',['rev-parse','HEAD^'],{cwd:root,encoding:'utf8',timeout:10000}).trim();
    const changed=diffPaths({root,base,head});receipt.range={base_sha:base,head_sha:head,changed_paths:changed};
    const bytes=await readFile(resolve(root,'test/source-test-contracts.json'));
    receipt.manifest_sha256=createHash('sha256').update(bytes).digest('hex');receipt.parser_version=require('typescript/package.json').version;
    receipt.plan=planTests({before:snapshot(root,base),after:snapshot(root,head),changed,manifest:JSON.parse(bytes)});
    await save();
    if(!receipt.plan.selected_tests.length)fail('no_focused_tests','No runnable named tests selected; mapping cannot report early success');
    const suites=[{id:'affected-nonbrowser-tests',command:process.execPath,args:['--test',...receipt.plan.selected_tests.map(path=>resolve(root,path))],required:true,dependsOn:[]}];
    // Node's internal child-v8 marker otherwise skips a nested --test run and
    // exits zero. The real failing-caller control guards actual test execution.
    const childEnv={...env};delete childEnv.NODE_TEST_CONTEXT;
    receipt.tests=await runSuites(suites,{cwd:root,env:childEnv,signal,timeoutMs:8*60*1000,identity:receipt.identity,onOutput,onReport:async tests=>{receipt.tests=tests;await save();}});
    await inspectToolchain({root,env});
    receipt.state=receipt.tests.exit_code===0?'passed':'failed';receipt.exit_code=receipt.tests.exit_code;await save();return receipt;
  }catch(error){receipt.state='blocked';receipt.exit_code=1;receipt.error={code:error.code||'contract_mapping_failed',message:redact(error.message).slice(0,2000)};await save();throw error;}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  verifySourceTestContracts({signal:controller.signal,onOutput:text=>process.stdout.write(text)}).then(receipt=>{process.exitCode=receipt.exit_code;console.log('Source/test mapping: '+receipt.plan.selected_tests.length+' named early tests; '+receipt.plan.deferred_tests.length+' deferred tests; '+receipt.plan.unmapped_changed_paths.length+' unmapped paths; full suites still required');}).catch(error=>{process.stderr.write('::error title=Source/test mapping blocked::'+redact(error.message).replaceAll('%','%25').replaceAll('\n','%0A').replaceAll('\r','%0D')+'\n');process.exitCode=1;}).finally(()=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);});
}
