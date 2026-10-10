import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {captureSourceBundle,restoreSourceBundle,verifyRemoteSourceCheckpoint,assertSourceCheckpointRuntime} from './relay-source-checkpoint.mjs';
import {sourceBundleDigest} from '../packages/runner/src/source-checkpoints.mjs';
import {sourceFixture,bundleOf,identity} from '../packages/runner/src/source-checkpoints.test.mjs';
async function repo(t){const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'relay-source-test-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();git(['init','-b',identity.branch]);git(['config','user.name','Synthetic Fixture']);git(['config','user.email','fixture@example.invalid']);await fs.mkdir(path.join(root,'src'));await fs.writeFile(path.join(root,'src/tracked.js'),'original');await fs.writeFile(path.join(root,'src/deleted.js'),'remove');git(['add','.']);git(['commit','-m','synthetic fixture']);return {root,git,id:{...identity,head_sha:git(['rev-parse','HEAD'])}};}
test('destroyed checkout restores tracked, untracked binary, staged deletion and mode bytes',async t=>{const f=await repo(t);await fs.writeFile(path.join(f.root,'src/tracked.js'),'modified');await fs.chmod(path.join(f.root,'src/tracked.js'),0o755);await fs.writeFile(path.join(f.root,'src/new.bin'),Buffer.from([0,255,1,128]));f.git(['rm','src/deleted.js']);const b=await captureSourceBundle({workspace:f.root,...f.id});assert.equal(b.files.length,3);assert.equal(b.files.find(x=>x.path==='src/deleted.js').kind,'deleted');await fs.rm(f.root,{recursive:true});const directory=f.root+'-restored';t.after(()=>fs.rm(directory,{recursive:true,force:true}));assert.equal((await restoreSourceBundle(b,{directory,identity:f.id})).digest,sourceBundleDigest(b));assert.equal(await fs.readFile(path.join(directory,'src/tracked.js'),'utf8'),'modified');assert.deepEqual(await fs.readFile(path.join(directory,'src/new.bin')),Buffer.from([0,255,1,128]));await assert.rejects(fs.stat(path.join(directory,'src/deleted.js')),e=>e.code==='ENOENT');assert.equal((await fs.stat(path.join(directory,'src/tracked.js'))).mode&0o777,0o755);});
test('unrelated files excluded; ignored selected files and symlinks block complete capture',async t=>{const f=await repo(t);await fs.writeFile(path.join(f.root,'unrelated'),'not selected');assert.equal((await captureSourceBundle({workspace:f.root,...f.id})).files.length,2);await fs.writeFile(path.join(f.root,'.gitignore'),'src/ignored\n');await fs.writeFile(path.join(f.root,'src/ignored'),'secret');await assert.rejects(captureSourceBundle({workspace:f.root,...f.id}),/Ignored/);await fs.unlink(path.join(f.root,'src/ignored'));await fs.symlink('../unrelated',path.join(f.root,'src/link'));await assert.rejects(captureSourceBundle({workspace:f.root,...f.id}),/symbolic/);});
test('new exact paths are explicitly absent; wrong identity and existing restore roots fail',async t=>{const f=await repo(t);const empty=await captureSourceBundle({workspace:f.root,...f.id,scope:['src/new.js']});assert.deepEqual(empty.files,[{path:'src/new.js',kind:'deleted'}]);await assert.rejects(captureSourceBundle({workspace:f.root,...f.id,head_sha:'b'.repeat(40)}));await assert.rejects(captureSourceBundle({workspace:f.root,...f.id,branch:'wrong'}));const b=await captureSourceBundle({workspace:f.root,...f.id});await assert.rejects(restoreSourceBundle(b,{directory:f.root,identity:f.id}),e=>e.code==='EEXIST');assert.equal(await fs.readFile(path.join(f.root,'src/tracked.js'),'utf8'),'original');});
test('same unchanged snapshot can be saved, independently read, restored and acknowledged repeatedly',async t=>{const f=sourceFixture();await f.begin();const parent=await fs.mkdtemp(path.join(os.tmpdir(),'relay-proof-'));t.after(()=>fs.rm(parent,{recursive:true,force:true}));const args={bundle:bundleOf(),identity,restoreParent:parent,write:f.write,read:f.read,ack:f.ack};const first=await verifyRemoteSourceCheckpoint(args),second=await verifyRemoteSourceCheckpoint(args);assert.equal(second.state,'restore_verified');assert.notEqual(first.directory,second.directory);});
test('remote swapped bytes never reach restoration acknowledgement',async t=>{const f=sourceFixture();await f.begin();const parent=await fs.mkdtemp(path.join(os.tmpdir(),'relay-proof-denied-'));t.after(()=>fs.rm(parent,{recursive:true,force:true}));let acked=false;await assert.rejects(verifyRemoteSourceCheckpoint({bundle:bundleOf(),identity,restoreParent:parent,write:f.write,read:async()=>({source_bundle:bundleOf('wrong')}),ack:async()=>{acked=true;}}),/different snapshot/);assert.equal(acked,false);assert.deepEqual(await fs.readdir(parent),[]);});
test('parent-directory swap is rejected before external source bytes are read',async t=>{const f=await repo(t),outside=await fs.mkdtemp(path.join(os.tmpdir(),'relay-outside-'));t.after(()=>fs.rm(outside,{recursive:true,force:true}));await fs.writeFile(path.join(outside,'deleted.js'),'private outside data');const originalOpen=fs.open;let swapped=false,readOutside=false;t.mock.method(fs,'open',async function(filename,...args){if(!swapped&&String(filename)===path.join(f.root,'src/deleted.js')){swapped=true;await fs.rename(path.join(f.root,'src'),path.join(f.root,'original-src'));await fs.symlink(outside,path.join(f.root,'src'));}const handle=await originalOpen.call(fs,filename,...args);if(swapped&&String(filename)===path.join(f.root,'src/deleted.js')){const read=handle.readFile.bind(handle);handle.readFile=(...args)=>{readOutside=true;return read(...args);};}return handle;});await assert.rejects(captureSourceBundle({workspace:f.root,...f.id}),/descriptor/);assert.equal(swapped,true);assert.equal(readOutside,false);});

import {recoverSourceCheckpoint} from './relay-source-checkpoint.mjs';
test('read-only recovery uses retained receipt after terminal job and no producing checkout',async t=>{const f=sourceFixture();await f.begin();await f.write(bundleOf());await f.call('finish',{result:{state:'succeeded',exit_code:0,session_id:'session',head_sha:identity.head_sha,summary:'done'}});f.advance();const parent=await fs.mkdtemp(path.join(os.tmpdir(),'relay-terminal-restore-'));t.after(()=>fs.rm(parent,{recursive:true,force:true}));const directory=path.join(parent,'new'),receipt={job:f.job,lease_token:f.token,project:'relay',assignment:'source-fixture'};const before=f.job.revision,config={project:'relay',assignment:'source-fixture',owner:'owner',branch:identity.branch,executor_id:'fixture'};const result=await recoverSourceCheckpoint({config,receipt,directory,rpc:(_name,args)=>f.call(args.action,args)});assert.equal(result.state,'restore_verified');assert.equal(result.remote_job_mutated,false);assert.equal(f.job.revision,before);assert.equal(await fs.readFile(path.join(directory,'src/example.js'),'utf8'),'first source');await assert.rejects(recoverSourceCheckpoint({config,receipt:{...receipt,lease_token:'wrong'},directory:path.join(parent,'denied'),rpc:(_name,args)=>f.call(args.action,args)}),/lease/);});

test('zero-byte files are manifested and hardlinked source is blocked',async t=>{const f=await repo(t);await fs.writeFile(path.join(f.root,'src/empty'),'');const b=await captureSourceBundle({workspace:f.root,...f.id});assert.equal(b.files.find(x=>x.path==='src/empty').size,0);await fs.link(path.join(f.root,'src/tracked.js'),path.join(f.root,'src/hardlink'));await assert.rejects(captureSourceBundle({workspace:f.root,...f.id}),/hardlinked/);});

test('restore parent swap cannot write selected source through an outside symlink',async t=>{const parent=await fs.mkdtemp(path.join(os.tmpdir(),'relay-restore-race-')),outside=await fs.mkdtemp(path.join(os.tmpdir(),'relay-write-outside-'));t.after(()=>fs.rm(parent,{recursive:true,force:true}));t.after(()=>fs.rm(outside,{recursive:true,force:true}));const directory=path.join(parent,'fresh');if(process.platform==='darwin'){const runtime=await assertSourceCheckpointRuntime();const helper=new URL('./relay-source-checkpoint-macos.py',import.meta.url);execFileSync(runtime.executable,['-I','-S','-B','-c',`import importlib.util,json,os,sys
spec=importlib.util.spec_from_file_location('checkpoint',sys.argv[1]);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
root=os.path.realpath(sys.argv[2]);outside=os.path.realpath(sys.argv[3]);files=json.loads(sys.argv[4]);os.mkdir(root,0o700)
original_open=os.open;swapped=False
def racing_open(name,*args,**kwargs):
 global swapped
 if name=='example.js' and not swapped:
  swapped=True;os.rename(root+'/src',root+'/retained-src');os.symlink(outside,root+'/src')
 return original_open(name,*args,**kwargs)
os.open=racing_open
try:
 module.restore(root,files)
 raise AssertionError('Swap was accepted')
except ValueError as error:
 assert 'descriptor' in str(error)
assert swapped and os.listdir(outside)==[]
assert os.stat(root+'/retained-src/example.js').st_size==0
`,helper.pathname,directory,outside,JSON.stringify(bundleOf().files)],{stdio:['ignore','pipe','pipe']});assert.deepEqual(await fs.readdir(outside),[]);return;}const originalOpen=fs.open;let swapped=false;t.mock.method(fs,'open',async function(filename,...args){if(!swapped&&String(filename).endsWith('/example.js')){swapped=true;await fs.rename(path.join(directory,'src'),path.join(directory,'retained-src'));await fs.symlink(outside,path.join(directory,'src'));}return originalOpen.call(fs,filename,...args);});await assert.rejects(restoreSourceBundle(bundleOf(),{directory,identity}),/descriptor|parent/);assert.deepEqual(await fs.readdir(outside),[]);});


test('source checkpoint runtime reports real descriptor primitives and rejects unsupported hosts',async()=>{
  const runtime=await assertSourceCheckpointRuntime();
  assert.equal(runtime.platform,process.platform);
  assert.equal(runtime.descriptor_identity,process.platform==='darwin'?'F_GETPATH':'proc-fd');
  if(process.platform==='darwin'){assert.ok(path.isAbsolute(runtime.executable));assert.match(runtime.python,/^3\.[0-9]+\.[0-9]+$/);assert.equal(runtime.anchored_creation,true);}
  await assert.rejects(assertSourceCheckpointRuntime('win32'),/supported Linux or macOS/);
});


test('Mac helper bytes stay frozen and workspace Python modules cannot replace descriptor verification',{skip:process.platform!=='darwin'},async t=>{
  const f=await repo(t),adapter=await fs.mkdtemp(path.join(os.tmpdir(),'relay-native-helper-'));
  t.after(()=>fs.rm(adapter,{recursive:true,force:true}));
  await fs.mkdir(path.join(adapter,'scripts'));await fs.mkdir(path.join(adapter,'packages/runner/src'),{recursive:true});
  for(const filename of ['scripts/relay-source-checkpoint.mjs','scripts/relay-source-checkpoint-macos.py','packages/runner/src/source-checkpoints.mjs']){
    await fs.copyFile(new URL('../'+filename,import.meta.url),path.join(adapter,filename));
  }
  const helper=path.join(adapter,'scripts/relay-source-checkpoint-macos.py');
  await fs.writeFile(path.join(adapter,'scripts/json.py'),"raise RuntimeError('Workspace import must never run')\n");
  const output=execFileSync(process.execPath,['--input-type=module','-',path.join(adapter,'scripts/relay-source-checkpoint.mjs'),helper,JSON.stringify({workspace:f.root,...f.id}),path.join(adapter,'restored')],{encoding:'utf8',env:{...process.env,PYTHONPATH:path.join(adapter,'scripts')},input:`
    import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
    const checkpoint=await import(pathToFileURL(process.argv[2]));
    const runtime=await checkpoint.assertSourceCheckpointRuntime();
    await fs.writeFile(process.argv[3],"raise RuntimeError('Changed helper must never run')\\n");
    const request=JSON.parse(process.argv[4]);
    const bundle=await checkpoint.captureSourceBundle(request);
    const proof=await checkpoint.restoreSourceBundle(bundle,{directory:process.argv[5],identity:request});
    console.log(JSON.stringify({runtime,files:proof.restored_file_count}));
  `,stdio:['pipe','pipe','pipe'],timeout:10000});
  const result=JSON.parse(output);assert.equal(result.files,2);assert.match(result.runtime.helper_sha256,/^[a-f0-9]{64}$/);
});
