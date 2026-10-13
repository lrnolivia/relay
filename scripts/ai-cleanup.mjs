import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,realpathSync,renameSync,rmSync,lstatSync,openSync,readSync,closeSync,fstatSync,constants} from 'node:fs';
import {resolve,dirname,relative,join,basename,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AI_CLEANUP_LIMITS,AI_CLEANUP_VERSION,cleanupPath,cleanupPathKind,cleanupBlobSha,scanAiCleanup,prepareAiCleanup,verifyAiCleanupPlan} from '../src/ai-cleanup.js';
import {createHash} from 'node:crypto';

const script=fileURLToPath(import.meta.url);
const run=(program,args,cwd)=>execFileSync(program,args,{cwd,encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
const git=(repo,args)=>run('git',['-C',repo,...args],repo);
const jsonFile=path=>{const bytes=readFileSync(path);if(bytes.length>AI_CLEANUP_LIMITS.output_bytes)throw Error('Input artifact exceeds the bounded window');return JSON.parse(bytes.toString('utf8'));};
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};

export function readCleanupProject(project,repo,request=path=>JSON.parse(run('gh',['api',path],repo))) {
  if(!/^[a-z0-9-]{1,64}$/.test(project))fail('validation','Invalid managed project ID');
  const file=request(`repos/lrnolivia/relay/contents/projects/${project}.json?ref=main`);
  if(file?.type!=='file'||file.encoding!=='base64'||typeof file.content!=='string'||file.content.length>65536||file.truncated)fail('provider','Managed project registration is incomplete');
  const bytes=Buffer.from(file.content.replace(/\s/g,''),'base64');
  if(cleanupBlobSha(bytes)!==file.sha)fail('conflict','Managed project registration byte identity differs');
  const value=JSON.parse(bytes.toString('utf8'));
  if(value?.id!==project||value.managed!==true||!/^lrnolivia\/[A-Za-z0-9_.-]+$/.test(value.repository||''))fail('permission','A registered Lauren-owned project is required');
  return {value,sha:file.sha};
}

export function localCleanupInventory(repo,project,request) {
  const root=realpathSync(git(repo,['rev-parse','--show-toplevel']).trim()),policy=readCleanupProject(project,root,request);
  const remote=git(root,['remote','get-url','origin']).trim();
  const name=remote.replace(/^https:\/\/github\.com\//,'').replace(/^git@github\.com:/,'').replace(/\.git$/,'');
  if(name!==policy.value.repository)fail('permission','Local checkout remote differs from the managed project registration');
  const head=git(root,['rev-parse','HEAD']).trim(),tree=git(root,['rev-parse','HEAD^{tree}']).trim();
  const entries=git(root,['ls-tree','-r','-z',head]).split('\0').filter(Boolean).map(line=>{
    const at=line.indexOf('\t'),[mode,type,blob_sha]=line.slice(0,at).split(' '),path=line.slice(at+1);
    return {path,mode,type,blob_sha};
  });
  if(entries.length>AI_CLEANUP_LIMITS.tree_entries)fail('capacity','Repository inventory exceeds the bounded path window');
  let branch=null;try{branch=git(root,['symbolic-ref','--quiet','--short','HEAD']).trim();}catch{}
  return {schema:1,tool:'AI Cleanup',policy_version:AI_CLEANUP_VERSION,project,repository:policy.value.repository,head_sha:head,tree_sha:tree,policy_sha:policy.sha,branch,coverage:'tracked-path-inventory; no content scanned',complete:true,entries,root};
}

export function localCleanupSnapshot(repo,project,paths,expectedHead,request,{requireClean=false}={}) {
  if(!Array.isArray(paths)||!paths.length||paths.length>AI_CLEANUP_LIMITS.files||new Set(paths).size!==paths.length)fail('validation','Use a bounded explicit unique path scope');paths.forEach(cleanupPath);
  const inventory=localCleanupInventory(repo,project,request),root=inventory.root;
  if(expectedHead!==undefined&&inventory.head_sha!==expectedHead)fail('conflict','Checkout HEAD changed; rescan before patch preparation');
  if(requireClean&&git(root,['status','--porcelain','--untracked-files=all','--',...paths]).trim())fail('conflict','Selected working files have unpublished changes; preserve them and rescan');
  const files=[];let total=0;
  for(const path of [...paths].sort()) {
    const found=inventory.entries.filter(e=>e.path===path);if(found.length!==1)fail('validation','Every declared path must exist in the exact tracked source');const entry=found[0],file={path,mode:entry.mode,blob_sha:entry.blob_sha};
    if(!['100644','100755'].includes(entry.mode)){files.push(file);continue;}
    if(['mandatory_notice','binary_asset','build_or_tool_configuration'].includes(cleanupPathKind(path,project))){files.push({...file,excluded:true});continue;}
    const size=Number(git(root,['cat-file','-s',entry.blob_sha]).trim());
    if(!Number.isSafeInteger(size)||size>AI_CLEANUP_LIMITS.file_bytes||(total+=size)>AI_CLEANUP_LIMITS.total_bytes)fail('capacity','AI Cleanup text window exceeded; choose a smaller file scope');
    const bytes=execFileSync('git',['-C',root,'cat-file','blob',entry.blob_sha],{maxBuffer:AI_CLEANUP_LIMITS.file_bytes+1,stdio:['ignore','pipe','pipe']});
    const content=bytes.toString('utf8');if(!Buffer.from(content,'utf8').equals(bytes))fail('validation','Invalid UTF-8 source requires manual review');files.push({...file,content});
  }
  if(git(root,['rev-parse','HEAD']).trim()!==inventory.head_sha)fail('conflict','Checkout moved during inventory');
  return {schema:1,project,repository:inventory.repository,branch:inventory.branch,head_sha:inventory.head_sha,tree_sha:inventory.tree_sha,policy_sha:inventory.policy_sha,scope:[...paths].sort(),complete:true,files};
}

export function verifyLocalCleanupPlan(repo,project,plan,phase='before',request) {
  if(plan?.project!==project||!['before','after'].includes(phase))fail('validation','Use the same project and an explicit before/after verification phase');
  const snapshot=localCleanupSnapshot(repo,project,plan.scope,plan.head_sha,request,{requireClean:phase==='before'}),expected=verifyAiCleanupPlan(snapshot,plan),root=realpathSync(git(repo,['rev-parse','--show-toplevel']).trim());
  const changes=git(root,['diff','--name-only','HEAD','--',...plan.scope]).trim().split('\n').filter(Boolean);
  if(phase==='after'&&changes.some(path=>!expected.files.some(f=>f.path===path)))fail('conflict','A protected or unselected scoped file changed; stop review application');
  const checks=[...expected.files.map(f=>({path:f.path,mode:f.mode,hash:phase==='before'?f.before_sha256:f.after_sha256,size:Buffer.from(phase==='before'?f.before_base64:f.after_base64,'base64').length})),...expected.migrations.map(m=>({path:m.source_path,mode:m.mode,hash:m.source_sha256,size:Buffer.from(m.content_base64,'base64').length}))];
  for(const check of checks){
    let cursor=root;for(const part of cleanupPath(check.path).split('/')){cursor=join(cursor,part);if(lstatSync(cursor).isSymbolicLink())fail('permission','Source verification refuses symlink redirection');}
    const descriptor=openSync(cursor,constants.O_RDONLY|constants.O_NOFOLLOW);
    try{
      const stat=fstatSync(descriptor);if(!stat.isFile()||(stat.mode&0o111?'100755':'100644')!==check.mode)fail('conflict','Source mode differs from the reviewed artifact');
      if(stat.size!==check.size||stat.size>AI_CLEANUP_LIMITS.file_bytes)fail('conflict','Source bytes differ from the reviewed before/after identity');
      const bytes=Buffer.alloc(check.size+1);let count=0,read;
      while(count<bytes.length&&(read=readSync(descriptor,bytes,count,bytes.length-count,count))>0)count+=read;
      if(count!==check.size||createHash('sha256').update(bytes.subarray(0,count)).digest('hex')!==check.hash)fail('conflict','Source bytes differ from the reviewed before/after identity');
    } finally{closeSync(descriptor);}
  }
  return {schema:1,tool:'AI Cleanup',state:'source_verified',verified:true,phase,project,repository:expected.repository,head_sha:expected.head_sha,plan_sha256:expected.plan_sha256,checked_paths:checks.map(c=>c.path),source_modified:false,migration_source_retained:true};
}

// Publish a new review directory atomically outside the source checkout. Existing
// output directories and source files are never overwritten by this capability.
export function writeCleanupReview(output,artifact,repo) {
  if(Buffer.byteLength(JSON.stringify(artifact))>AI_CLEANUP_LIMITS.output_bytes)fail('capacity','Review artifact exceeds the bounded output window');
  const root=realpathSync(repo),destination=resolve(output),parent=realpathSync(dirname(destination)),actual=join(parent,basename(destination));
  const rel=relative(root,actual);
  if(!(rel==='..'||rel.startsWith('../')||isAbsolute(rel)))fail('permission','Use a new review directory outside the source checkout');
  try {lstatSync(actual);fail('permission','Existing review output is preserved; choose a new directory');} catch(error){if(error.code!=='ENOENT')throw error;}
  const stage=mkdtempSync(join(parent,'.ai-cleanup-review-'));
  try {
    writeFileSync(join(stage,'report.json'),JSON.stringify(artifact,null,2)+'\n',{flag:'wx',mode:0o600});
    if(artifact.state==='review_required') {
      writeFileSync(join(stage,'cleanup.patch'),artifact.patch,{flag:'wx',mode:0o600});
      for(const file of artifact.files)for(const [suffix,key] of [['before','before_base64'],['after','after_base64']]){
        cleanupPath(file.path);const target=join(stage,'files',file.path+'.'+suffix);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,Buffer.from(file[key],'base64'),{flag:'wx',mode:0o600});
      }
      for(const migration of artifact.migrations){cleanupPath(migration.destination_path);const target=join(stage,'migration',migration.destination_path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,Buffer.from(migration.content_base64,'base64'),{flag:'wx',mode:0o600});}
      writeFileSync(join(stage,'README.txt'),'AI Cleanup review artifact. Source remains unchanged.\nReview report.json and cleanup.patch; use git apply --check only on the exact clean source head.\nMigration source is never removed by this patch; publish and verify the external copy and references through separate admitted work.\nRollback: retained before bytes, or git apply -R after checking exact after hashes.\n',{flag:'wx',mode:0o600});
    }
    // mkdir is the no-overwrite reservation; publish the complete artifact as a
    // child directory rather than overwriting a concurrently created output.
    mkdirSync(actual,{mode:0o700});
    renameSync(stage,join(actual,'bundle'));
  } catch(error){rmSync(stage,{recursive:true,force:true});throw error;}
  return join(actual,'bundle');
}

export function runCleanupCli(args,request) {
  const action=args.shift(),options={};
  while(args.length){const key=args.shift(),value=args.shift();if(!['--project','--repo','--scope','--report','--select','--plan','--phase','--out'].includes(key)||value===undefined||key in options)fail('validation','Invalid AI Cleanup CLI option');options[key]=value;}
  const project=options['--project'],repo=resolve(options['--repo']||process.cwd()),out=options['--out'];
  if(!project||!out||!['inventory','scan','prepare','verify'].includes(action))fail('validation','Usage: ai-cleanup.mjs inventory|scan|prepare|verify --project ID --repo PATH --out NEW_REVIEW_DIRECTORY [--scope PATHS_JSON] [--report SCAN_JSON --select IDS_JSON] [--plan PLAN_JSON --phase before|after]');
  const allowed={inventory:['--project','--repo','--out'],scan:['--project','--repo','--out','--scope'],prepare:['--project','--repo','--out','--report','--select'],verify:['--project','--repo','--out','--plan','--phase']}[action];
  if(Object.keys(options).some(key=>!allowed.includes(key))||action==='scan'&&!options['--scope']||action==='prepare'&&(!options['--report']||!options['--select'])||action==='verify'&&(!options['--plan']||!options['--phase']))fail('validation','Missing or unsupported action-specific CLI option');
  let artifact;
  if(action==='inventory')artifact=localCleanupInventory(repo,project,request);
  else if(action==='scan')artifact=scanAiCleanup(localCleanupSnapshot(repo,project,jsonFile(options['--scope']),undefined,request));
  else if(action==='prepare') {
    const report=jsonFile(options['--report']);
    if(report.project!==project)fail('permission','Scan report belongs to another project');
    const snapshot=localCleanupSnapshot(repo,project,report.scope,report.head_sha,request,{requireClean:true});
    artifact=prepareAiCleanup(snapshot,{expected_report_sha256:report.report_sha256,selected_findings:jsonFile(options['--select'])});
  } else artifact=verifyLocalCleanupPlan(repo,project,jsonFile(options['--plan']),options['--phase'],request);
  const directory=writeCleanupReview(out,artifact,repo);
  return {tool:'AI Cleanup',action,head_sha:artifact.head_sha,review_directory:directory,source_modified:false,...(artifact.findings?{findings:artifact.findings.length,patch_candidates:artifact.findings.filter(f=>f.disposition==='patch_candidate').length,migration_proposals:artifact.findings.filter(f=>f.disposition==='migration_proposal').length}:artifact.state==='review_required'?{patch_files:artifact.files.length,migration_proposals:artifact.migrations.length,plan_sha256:artifact.plan_sha256}:artifact.verified?{verified:true,phase:artifact.phase,plan_sha256:artifact.plan_sha256}:{tracked_paths:artifact.entries.length})};
}

if(process.argv[1]&&resolve(process.argv[1])===script){try{console.log(JSON.stringify(runCleanupCli(process.argv.slice(2)),null,2));}catch(error){console.error(error.stderr?.toString().trim()||error.message);process.exitCode=1;}}
