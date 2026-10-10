import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateSourceBundle,sourceBundleDigest,serializeSourceBundle,validateSourcePath} from '../packages/runner/src/source-checkpoints.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(file,scope)=>scope.some(p=>file===p||(p.endsWith('/')&&file.startsWith(p)));
const macHelper=fileURLToPath(new URL('./relay-source-checkpoint-macos.py',import.meta.url));
let macRuntime;
let macProgram;
const macArguments=operation=>['-I','-S','-B','-c',macProgram,operation];
export async function assertSourceCheckpointRuntime(platform=process.platform){
  if(platform==='linux'){await fs.access('/proc/self/fd');return {platform,descriptor_identity:'proc-fd'};}
  if(platform!=='darwin'||process.platform!=='darwin')throw Error('Source checkpoints require supported Linux or macOS descriptor identity verification');
  if(!macRuntime){
    try{
      // Freeze trusted helper bytes before a coding process can edit its checkout.
      // Isolated Python excludes workspace/PYTHONPATH and site customization imports.
      macProgram=await fs.readFile(macHelper,'utf8');
      const runtime=JSON.parse(execFileSync('python3',macArguments('probe'),{encoding:'utf8',maxBuffer:4096,timeout:5000,stdio:['ignore','pipe','pipe']}));
      if(runtime.platform!=='darwin'||runtime.descriptor_identity!=='F_GETPATH'||runtime.anchored_creation!==true||!path.isAbsolute(runtime.executable)||!/^3\.[0-9]+\.[0-9]+$/.test(runtime.python))throw Error('Invalid runtime');
      macRuntime={...runtime,helper_sha256:sha256(Buffer.from(macProgram))};
    }catch{throw Error('Source checkpoints require installed Python3.9+ with native macOS descriptor primitives');}
  }
  return {...macRuntime};
}
async function descriptorPath(handle){
  if(process.platform==='linux')return fs.realpath('/proc/self/fd/'+handle.fd);
  const runtime=await assertSourceCheckpointRuntime();
  try{return JSON.parse(execFileSync(runtime.executable,macArguments('descriptor'),{encoding:'utf8',maxBuffer:4096,timeout:5000,stdio:['ignore','pipe','pipe',handle.fd]})).path;}
  catch{throw Error('Source descriptor identity verification failed');}
}

async function checkedPath(root,relative,{missing=false}={}){
  validateSourcePath(relative);
  const pieces=relative.split('/');let current=root;
  for(let i=0;i<pieces.length;i++){
    current=path.join(current,pieces[i]);let stat;
    try{stat=await fs.lstat(current);}catch(error){if(missing&&error.code==='ENOENT')return null;throw error;}
    if(stat.isSymbolicLink())throw Error('Source checkpoint refuses symbolic links');
    if(i<pieces.length-1&&!stat.isDirectory())throw Error('Source checkpoint parent is not a directory');
  }
  const actual=await fs.realpath(current);
  if(!actual.startsWith(root+path.sep))throw Error('Source checkpoint escaped its admitted workspace');
  return current;
}

async function fileEntry(root,relative){
  const filename=await checkedPath(root,relative,{missing:true});
  if(!filename)return {path:relative,kind:'deleted'};
  const handle=await fs.open(filename,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  try{
    const before=await handle.stat();if(!before.isFile()||before.nlink!==1)throw Error('Only regular non-hardlinked source files can be checkpointed');
    // Validate the opened descriptor, not merely the path checked before open.
    // A parent swap cannot cause outside bytes to be read through this handle.
    const opened=await descriptorPath(handle);
    if(opened!==path.join(root,relative))throw Error('Source path changed before descriptor validation');
    if(before.size>128*1024)throw Error('Source checkpoint file exceeds bounded capture size');
    const bytes=await handle.readFile(),after=await handle.stat();
    if(await descriptorPath(handle)!==opened)throw Error('Source path changed during capture');
    if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||bytes.length!==after.size)throw Error('Source changed during checkpoint capture');
    return {path:relative,kind:'file',mode:before.mode&0o111?493:420,size:bytes.length,sha256:sha256(bytes),data:bytes.toString('base64')};
  }finally{await handle.close();}
}

export async function captureSourceBundle({workspace,repository,branch,head_sha,scope}){
  await assertSourceCheckpointRuntime();
  const root=await fs.realpath(workspace);
  if(!Array.isArray(scope)||!scope.length)throw Error('Source checkpoint needs the complete admitted scope');
  for(const entry of scope)validateSourcePath(entry,{prefix:entry.endsWith('/')});
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
  if(git(['rev-parse','HEAD']).trim()!==head_sha||git(['branch','--show-current']).trim()!==branch)throw Error('Source checkpoint branch or baseline changed');
  const inventory=()=>[...new Set([...git(['ls-tree','-r','--name-only','-z',head_sha]).split('\0'),...git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0'),...scope.filter(p=>!p.endsWith('/'))].filter(Boolean).filter(p=>inside(p,scope)))].sort();
  const ignored=git(['ls-files','--others','--ignored','--exclude-standard','-z']).split('\0').filter(Boolean).filter(p=>inside(p,scope));
  if(ignored.length)throw Error('Ignored files inside admitted scope need explicit disposition; checkpoint is blocked');
  const paths=inventory();
  // Exact declared files cannot disappear from both Git and the snapshot unnoticed.
  for(const entry of scope)if(!entry.endsWith('/')&&!paths.includes(entry))throw Error('An admitted source file is not accounted for in the Git inventory');
  if(paths.length>64)throw Error('Source checkpoint exceeds bounded entry count');
  const bundle={schema:1,repository,branch,head_sha,scope:[...scope].sort(),files:[]};
  for(const filename of paths)bundle.files.push(await fileEntry(root,filename));
  validateSourceBundle(bundle,{repository,branch,head_sha,scope});
  // A second pass detects ordinary concurrent edits and inventory additions.
  if(JSON.stringify(paths)!==JSON.stringify(inventory()))throw Error('Source inventory changed during checkpoint capture');
  for(const entry of bundle.files){const again=await fileEntry(root,entry.path);if(JSON.stringify(again)!==JSON.stringify(entry))throw Error('Source bytes changed during checkpoint capture');}
  if(git(['rev-parse','HEAD']).trim()!==head_sha||git(['branch','--show-current']).trim()!==branch)throw Error('Source identity changed during checkpoint capture');
  return bundle;
}

export async function restoreSourceBundle(bundle,{directory,identity}={}){
  const metadata=validateSourceBundle(bundle,identity);
  if(!path.isAbsolute(directory||''))throw Error('Restore directory must be absolute');
  const runtime=await assertSourceCheckpointRuntime();
  // Create-only, one fresh root. Never overlay an existing working tree.
  await fs.mkdir(directory,{mode:0o700});
  const root=await fs.realpath(directory);
  if(process.platform==='darwin'){
    try{
      const result=JSON.parse(execFileSync(runtime.executable,macArguments('restore'),{input:JSON.stringify({root,files:bundle.files}),encoding:'utf8',maxBuffer:4096,timeout:10000,stdio:['pipe','pipe','pipe']}));
      if(result.restored!==true)throw Error('Invalid restore result');
    }catch{throw Error('Restore parent or file descriptor verification failed; source restoration is incomplete');}
  }else for(const entry of bundle.files){
    if(entry.kind==='deleted')continue;
    const parents=[],parts=entry.path.split('/');
    try {
      let parent=await fs.open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);parents.push(parent);
      for(let i=0;i<parts.length-1;i++){
        const anchored='/proc/self/fd/'+parent.fd+'/'+parts[i];
        try{await fs.mkdir(anchored,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}
        parent=await fs.open(anchored,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);parents.push(parent);
        if(await fs.realpath('/proc/self/fd/'+parent.fd)!==path.join(root,...parts.slice(0,i+1)))throw Error('Restore parent changed before source creation');
      }
      const target='/proc/self/fd/'+parent.fd+'/'+parts.at(-1);
      const handle=await fs.open(target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,entry.mode);
      try{
        if(await fs.realpath('/proc/self/fd/'+handle.fd)!==path.join(root,entry.path))throw Error('Restore descriptor escaped fresh root; no bytes written');
        await handle.writeFile(Buffer.from(entry.data,'base64'));await handle.chmod(entry.mode);
      }finally{await handle.close();}
    } finally {for(const handle of parents.reverse())await handle.close();}
  }
  const restored={...bundle,files:[]};
  for(const entry of bundle.files){
    const actual=await fileEntry(root,entry.path);
    if(serializeSourceBundle(actual)!==serializeSourceBundle(entry))throw Error('Restored source differs from its content manifest');
    restored.files.push(actual);
  }
  const restoredDigest=sourceBundleDigest(restored);
  if(restoredDigest!==metadata.digest)throw Error('Restored manifest digest mismatch');
  return {digest:metadata.digest,restored_digest:restoredDigest,restored_file_count:bundle.files.filter(f=>f.kind==='file').length};
}

export async function verifyRemoteSourceCheckpoint({bundle,identity,restoreParent,write,read,ack}){
  const expected=validateSourceBundle(bundle,identity);
  const written=await write(bundle);
  if(!['remote_verified','restore_verified'].includes(written?.job?.checkpoint?.source?.state)||written.job.checkpoint.source.digest!==expected.digest)throw Error('Remote source write/readback was not verified');
  const fetched=await read();
  const actual=validateSourceBundle(fetched?.source_bundle,identity);
  if(actual.digest!==expected.digest)throw Error('Remote source read returned a different snapshot');
  await fs.mkdir(restoreParent,{recursive:true,mode:0o700});
  const directory=path.join(await fs.realpath(restoreParent),'source-restore-'+randomUUID());
  const proof=await restoreSourceBundle(fetched.source_bundle,{directory,identity});
  const result=await ack(proof);
  if(result?.job?.checkpoint?.source?.state!=='restore_verified'||result.job.checkpoint.source.digest!==expected.digest)throw Error('Source restoration receipt was not accepted');
  return {state:'restore_verified',digest:expected.digest,directory,file_count:proof.restored_file_count,job:result.job};
}

// This read-only path does not need the producing checkout, start a process,
// renew a lease, or mutate a completed job. The caller retains its private receipt.
export async function recoverSourceCheckpoint({config,receipt,directory,rpc}) {
  if(!receipt?.job?.id||!receipt.lease_token||receipt.project!==config.project||receipt.assignment!==config.assignment)throw Error('Original private executor receipt is required');
  const common={project:config.project,assignment:config.assignment,expected_owner:config.owner,expected_branch:config.branch,job_id:receipt.job.id};
  const observed=await rpc('relay_execution',{...common,action:'status'}),job=observed?.job;
  if(!job||job.id!==receipt.job.id||job.owner!==config.owner||job.branch!==config.branch)throw Error('Recovery identity changed; no source read');
  const identity={repository:job.repository,branch:job.branch,head_sha:job.initial_head_sha,scope:job.objective.paths};
  const read=await rpc('relay_execution',{...common,action:'source_read',expected_revision:job.revision,executor_id:config.executor_id,lease_token:receipt.lease_token});
  const metadata=validateSourceBundle(read?.source_bundle,identity);
  if(read?.source?.digest!==metadata.digest)throw Error('Recovery readback identity does not match bytes');
  const proof=await restoreSourceBundle(read.source_bundle,{directory,identity});
  return {state:'restore_verified',job_id:job.id,head_sha:job.initial_head_sha,directory,...proof,remote_job_mutated:false,host_execution_verified:false};
}
