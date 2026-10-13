import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {cp,lstat,mkdir,mkdtemp,readFile,readdir,realpath,rename,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {REQUIRED_SUITES,runSuites,redact} from './ci-test-orchestrator.mjs';
import {BUILD_OUTPUTS,verifyBuild} from './release-toolchain.mjs';

// Last healthy run 37758371704: 24.5s control / 26.0s interface.
// Serial execution remains within each group; only separate snapshots overlap.
export const SUITE_GROUPS=Object.freeze([
  Object.freeze({id:'control',suites:Object.freeze(['inspector','runner','layout'])}),
  Object.freeze({id:'interface',suites:Object.freeze(['contracts','web'])})
]);
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const missing=(suite,diagnostic)=>({id:suite.id,required:true,status:'not_run',exit_code:null,diagnostic});
async function save(file,value){await mkdir(dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n');await rename(temp,file);}
export function validateGroups(groups=SUITE_GROUPS,suites=REQUIRED_SUITES){
  const ids=new Set(),covered=[];
  for(const group of groups){
    if(!group||!/^[a-z][a-z0-9-]*$/.test(group.id)||ids.has(group.id)||!Array.isArray(group.suites)||!group.suites.length)throw Error('Invalid or duplicate suite group');
    ids.add(group.id);covered.push(...group.suites);
  }
  if(!groups.length||covered.length!==suites.length||new Set(covered).size!==covered.length||!equal([...covered].sort(),suites.map(s=>s.id).sort()))throw Error('Groups must cover every required suite exactly once');
  for(const group of groups)for(const id of group.suites){const s=suites.find(s=>s.id===id);if(s.dependsOn.some(dep=>!group.suites.slice(0,group.suites.indexOf(id)).includes(dep)))throw Error('Cross-group or reordered dependencies cannot run independently');}
  return groups;
}
export function aggregateGroups({reports,identity,groups=SUITE_GROUPS,suites=REQUIRED_SUITES}){
  validateGroups(groups,suites);
  const errors=[],bySuite=new Map();
  if(reports.some(r=>!groups.some(g=>g.id===r.group))||new Set(reports.map(r=>r.group)).size!==reports.length)errors.push('Unknown or duplicate group evidence');
  for(const group of groups){
    const report=reports.find(r=>r.group===group.id);
    if(!report){errors.push('Missing group '+group.id);continue;}
    if(!equal(report.identity,identity)||!equal(report.required_suites,group.suites)||!equal(report.results?.map(r=>r.id),group.suites)||report.results.some(r=>r.required!==true)||report.artifact_verified!==true){errors.push('Incomplete, stale or changed artifact evidence for '+group.id);continue;}
    if(report.exit_code!==0)errors.push('Nonpassing group '+group.id);
    for(const result of report.results)bySuite.set(result.id,{...result,group:group.id});
  }
  const results=suites.map(s=>bySuite.get(s.id)||missing(s,'Missing verified exact-artifact group result'));
  const passed=results.filter(r=>r.status==='passed'&&r.exit_code===0).length;
  return {schema:1,identity,required_suites:suites.map(s=>s.id),results,groups:groups.map(g=>({id:g.id,suites:g.suites,report:'qa-evidence/test-workflow/'+g.id+'.json'})),errors,passed,nonpassing:suites.length-passed,exit_code:errors.length===0&&passed===suites.length?0:1};
}
export async function copyEvidence(source,destination){
  let entries;try{entries=await readdir(source,{withFileTypes:true});}catch(cause){if(cause.code==='ENOENT')return;throw cause;}
  for(const entry of entries){
    const from=join(source,entry.name),to=join(destination,entry.name);
    if(entry.isSymbolicLink()||!entry.isDirectory()&&!entry.isFile())throw Error('Evidence must contain regular files and directories');
    if(entry.isDirectory()){await copyEvidence(from,to);continue;}
    await mkdir(dirname(to),{recursive:true});
    const bytes=await readFile(from);let previous;try{previous=await readFile(to);}catch(cause){if(cause.code!=='ENOENT')throw cause;}
    if(previous&&!previous.equals(bytes))throw Error('Conflicting suite evidence: '+to);
    if(!previous)await writeFile(to,bytes,{flag:'wx'});
  }
}
async function assertLocalDependencies(directory,path){
  const stat=await lstat(path);
  if(stat.isSymbolicLink()){const target=relative(directory,await realpath(path));if(target==='..'||target.startsWith('../')||target.startsWith('/'))throw Error('Dependency symlink escapes isolated snapshot');return;}
  if(stat.isDirectory())for(const entry of await readdir(path))await assertLocalDependencies(directory,join(path,entry));
  else if(!stat.isFile())throw Error('Dependencies must contain files, directories or local symlinks');
}
export async function prepareSnapshot({root,directory,receipt,env=process.env,verify=verifyBuild}){
  await verify(receipt,{root,env});
  execFileSync('git',['clone','--quiet','--shared','--no-checkout','--',root,directory],{stdio:['ignore','pipe','pipe'],timeout:60000});
  execFileSync('git',['checkout','--quiet','--detach',receipt.identity.source_sha],{cwd:directory,stdio:['ignore','pipe','pipe'],timeout:60000});
  // Relative workspace symlinks remain relative to this independent copy.
  const lock=JSON.parse(await readFile(join(root,'package-lock.json')));
  const packages=Object.keys(lock.packages).filter(p=>!p.split('/').includes('node_modules'));
  if(packages.some(p=>p!==''&&(p.startsWith('/')||p.includes('\\')||p.split('/').some(part=>!part||part==='.'||part==='..'))))throw Error('Dependency roots must be repository-relative paths');
  const modules=packages.map(p=>join(p,'node_modules'));
  for(const path of modules){let stat;try{stat=await lstat(join(root,path));}catch(cause){if(cause.code==='ENOENT')continue;throw cause;}if(!stat.isDirectory())throw Error('Installed dependency root must be a directory');await cp(join(root,path),join(directory,path),{recursive:true,verbatimSymlinks:true});}
  for(const path of [...BUILD_OUTPUTS,'qa-evidence/toolchain/build.json']){await mkdir(dirname(join(directory,path)),{recursive:true});await cp(join(root,path),join(directory,path));}
  for(const path of modules){try{await lstat(join(directory,path));}catch(cause){if(cause.code==='ENOENT')continue;throw cause;}await assertLocalDependencies(directory,join(directory,path));}
  await verify(receipt,{root:directory,env});
  return directory;
}
export async function runParallelGroups({workspaces,identity,env=process.env,signal,groups=SUITE_GROUPS,suites=REQUIRED_SUITES,timeoutMs,onOutput=()=>{},onReport=async()=>{},verify=async()=>{}}){
  validateGroups(groups,suites);
  const reports=new Map();
  await onReport(aggregateGroups({reports:[],identity,groups,suites}));
  await Promise.all(groups.map(async group=>{
    const workspace=workspaces.find(w=>w.id===group.id),selected=group.suites.map(id=>suites.find(s=>s.id===id));
    let report={schema:1,group:group.id,identity,required_suites:group.suites,results:selected.map(s=>missing(s,'Group has not started')),artifact_verified:false,exit_code:1};
    const publish=async()=>{reports.set(group.id,report);await onReport(aggregateGroups({reports:[...reports.values()],identity,groups,suites}),report);};
    try{
      if(!workspace)throw Error('Missing isolated group workspace');
      await mkdir(workspace.temp,{recursive:true});await verify(workspace.cwd);
      const childEnv={...env,TMPDIR:workspace.temp,TMP:workspace.temp,TEMP:workspace.temp,npm_config_cache:join(workspace.temp,'npm-cache'),RELAY_QA_OUTPUT:join(workspace.cwd,'qa-evidence/relay-motion')};
      delete childEnv.NODE_TEST_CONTEXT;
      const result=await runSuites(selected,{cwd:workspace.cwd,env:childEnv,signal,identity,timeoutMs,onOutput:text=>onOutput(group.id,text),onReport:async partial=>{report={...partial,group:group.id,artifact_verified:false};await publish();}});
      report={...result,group:group.id,artifact_verified:false};
      await verify(workspace.cwd);report.artifact_verified=true;
    }catch(cause){report={...report,exit_code:1,error:redact(cause.message)};}
    await publish();
  }));
  return aggregateGroups({reports:[...reports.values()],identity,groups,suites});
}
async function main(){
  if(process.argv.length!==2)throw Error('The parallel gate does not allow suite filtering or custom commands');
  if(process.env.RELAY_CI_PARALLEL_CHILD==='true')throw Error('Nested canonical parallel gates are not allowed');
  const root=process.cwd(),env={...process.env,RELAY_CI_PARALLEL_CHILD:'true'},controller=new AbortController(),stop=()=>controller.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const output=join(root,'qa-evidence/test-workflow/result.json');let parent,identity={source_sha:env.RELAY_SOURCE_SHA||null,run_id:env.GITHUB_RUN_ID||null,run_attempt:env.GITHUB_RUN_ATTEMPT||null},report;
  const started=Date.now();
  try{
    const receipt=JSON.parse(await readFile(join(root,'qa-evidence/toolchain/build.json')));
    await verifyBuild(receipt,{root,env});
    identity={...identity,source_sha:receipt.identity.source_sha,node:process.version,platform:process.platform,arch:process.arch,lock_sha256:hash(await readFile(join(root,'package-lock.json'))),manifest_sha256:hash(JSON.stringify(REQUIRED_SUITES)),artifact_set_sha256:receipt.artifact_set_sha256,build_receipt_sha256:hash(JSON.stringify(receipt)),complete:true};
    report=aggregateGroups({reports:[],identity});await save(output,report);
    parent=await mkdtemp(join(env.RUNNER_TEMP||tmpdir(),'relay-ci-suites-'));
    if(!relative(root,parent).startsWith('..'))throw Error('Suite workspaces must be outside the canonical checkout');
    const workspaces=[];
    // Copy once per group; npm install/build/browser installation never repeat.
    for(const group of SUITE_GROUPS){const cwd=join(parent,group.id);await prepareSnapshot({root,directory:cwd,receipt,env});workspaces.push({id:group.id,cwd,temp:join(parent,group.id+'-tmp')});}
    const prepared=Date.now();
    report=await runParallelGroups({workspaces,identity,env,signal:controller.signal,verify:cwd=>verifyBuild(receipt,{root:cwd,env}),onOutput:(group,text)=>process.stdout.write(text.split('\n').map(line=>line?'['+group+'] '+line:'').join('\n')),onReport:async(aggregate,group)=>{if(group)await save(join(root,'qa-evidence/test-workflow',group.group+'.json'),group);await save(output,aggregate);}});
    // Preserve each group's evidence before publishing the historical artifact paths.
    for(const workspace of workspaces){
      const evidence=join(workspace.cwd,'qa-evidence');
      await copyEvidence(evidence,join(root,'qa-evidence/parallel-suites',workspace.id));
      for(const entry of await readdir(evidence,{withFileTypes:true}))if(!['toolchain','test-workflow'].includes(entry.name))await copyEvidence(join(evidence,entry.name),join(root,'qa-evidence',entry.name));
    }
    await verifyBuild(receipt,{root,env});
    report.timing={prepare_ms:prepared-started,parallel_and_evidence_ms:Date.now()-prepared,total_ms:Date.now()-started};
  }catch(cause){report={...(report||aggregateGroups({reports:[],identity})),exit_code:1,error:redact(cause.message)};}
  finally{if(parent)await rm(parent,{recursive:true,force:true}).catch(cause=>{report={...report,exit_code:1,cleanup_error:redact(cause.message)};});process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
  await save(output,report);
  for(const result of report.results)process.stdout.write('::notice::Required suite '+result.id+': '+result.status+'; original exit '+result.exit_code+'\n');
  if(report.exit_code)process.stderr.write('::error::Parallel suite gate is nonpassing; see required-suite accounting and both group logs\n');
  process.stdout.write('::notice::Parallel suite timing '+JSON.stringify(report.timing||{})+'\n');process.exitCode=report.exit_code;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(cause=>{process.stderr.write(redact(cause.message)+'\n');process.exitCode=1;});
