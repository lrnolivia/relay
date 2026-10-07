import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile,rename,lstat,realpath} from 'node:fs/promises';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

export const BUILD_OUTPUTS=Object.freeze(['apps/web/generated.js','apps/web/generated-react.js','apps/web/generated-inspector.js']);
export const BUILD_INPUTS=Object.freeze(['package.json','package-lock.json','.node-version','wrangler.jsonc','apps/web/build.mjs','scripts/release-toolchain.mjs']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>hash(JSON.stringify(stable(value)));
const fail=(code,message)=>{const error=Error(message);error.code=code;throw error;};
const json=(bytes,name)=>{try{return JSON.parse(bytes);}catch{fail('invalid_input',name+' must be valid JSON');}};
export function validateToolchain({manifest,lock,nodePin,nodeVersion,npmVersion}){
  const node=String(nodePin).trim();
  if(!/^\d+\.\d+\.\d+$/.test(node)||manifest.engines?.node!==node)fail('invalid_pin','Node must have one exact matching .node-version and engines pin');
  const npm=/^npm@(\d+\.\d+\.\d+)$/.exec(manifest.packageManager||'')?.[1];
  if(!npm||manifest.engines?.npm!==npm)fail('invalid_pin','npm must have one exact matching packageManager and engines pin');
  if(String(nodeVersion).replace(/^v/,'')!==node)fail('node_mismatch','Expected Node '+node+'; activate the pinned official toolchain before install or build');
  if(npmVersion!==npm)fail('npm_mismatch','Expected npm '+npm+'; activate the pinned official toolchain before install or build');
  if(lock.lockfileVersion!==3||!lock.packages?.[''])fail('invalid_lock','A complete npm v3 root lockfile is required');
  const root=lock.packages[''];
  for(const key of ['name','version','dependencies','devDependencies','optionalDependencies','engines','workspaces']){
    if(digest(manifest[key]??null)!==digest(root[key]??null))fail('lock_manifest_mismatch','Root lockfile and package.json differ in '+key+'; regenerate the lock intentionally');
  }
  return {node,npm};
}
export function sourceIdentity(env){
  const values=['RELAY_SOURCE_SHA','WORKERS_CI_COMMIT_SHA','GITHUB_SHA'].map(key=>[key,env[key]]).filter(([,v])=>v);
  const preferred=env.RELAY_SOURCE_SHA||env.WORKERS_CI_COMMIT_SHA||env.GITHUB_SHA;
  if(!/^[a-f0-9]{40}$/.test(preferred||''))fail('source_missing','Exact 40-character source SHA is required for build evidence');
  // GITHUB_SHA may be the PR synthetic merge SHA; explicit exact-head identities win.
  if(env.RELAY_SOURCE_SHA&&env.WORKERS_CI_COMMIT_SHA&&env.RELAY_SOURCE_SHA!==env.WORKERS_CI_COMMIT_SHA)fail('source_mismatch','Explicit source-head identities disagree');
  if(values.some(([,v])=>! /^[a-f0-9]{40}$/.test(v)))fail('source_invalid','Source identities must be exact commit SHAs');
  return preferred;
}
async function bytesAt(root,path){
  const file=resolve(root,path),actualRoot=await realpath(root);
  let stat,actual;
  try{stat=await lstat(file);actual=await realpath(file);}catch{fail('path_missing','Required release path is missing: '+path);}
  const rel=relative(actualRoot,actual);
  if(stat.isSymbolicLink()||!stat.isFile()||rel.startsWith('..')||rel.startsWith('/'))fail('path_invalid','Release evidence requires an in-workspace regular file: '+path);
  const bytes=await readFile(file);if(!bytes.length)fail('path_empty','Required release path is empty: '+path);
  return bytes;
}
async function fileRecord(root,path){const bytes=await bytesAt(root,path);return {path,bytes:bytes.length,sha256:hash(bytes)};}
async function readCheckout(root){
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:1024*1024}).trim();
  try{
    if(await realpath(git(['rev-parse','--show-toplevel']))!==await realpath(root))fail('checkout_root_mismatch','Release workspace must be the actual Git repository root');
    const tracked=new Set(git(['ls-tree','-r','--name-only','HEAD','--',...BUILD_INPUTS]).split('\n'));
    if(BUILD_INPUTS.some(path=>!tracked.has(path)))fail('checkout_input_untracked','Every declared build input must be tracked in the exact HEAD');
    return {head_sha:git(['rev-parse','HEAD']),tree_sha:git(['rev-parse','HEAD^{tree}']),dirty_paths:[...git(['diff','--name-only','HEAD','--']).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean).filter(path=>!path.startsWith('qa-evidence/'))};
  }catch(error){if(['checkout_root_mismatch','checkout_input_untracked'].includes(error.code))throw error;fail('checkout_unavailable','Exact Git checkout identity could not be established');}
}
export function validateCheckout(checkout,source){
  if(!checkout||checkout.head_sha!==source||! /^[a-f0-9]{40}$/.test(checkout.tree_sha||''))fail('checkout_mismatch','Actual Git checkout does not match the exact source identity');
  if(!Array.isArray(checkout.dirty_paths)||checkout.dirty_paths.length)fail('checkout_dirty','Tracked changes or untracked source would invalidate exact commit provenance; preserve and commit them first');
  return {head_sha:checkout.head_sha,tree_sha:checkout.tree_sha,state:'clean-tracked-and-untracked-source'};
}
export async function inspectToolchain({root=process.cwd(),nodeVersion=process.version,npmVersion,env=process.env,checkout}={}){
  if(npmVersion===undefined){try{npmVersion=execFileSync(process.platform==='win32'?'npm.cmd':'npm',['--version'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim();}catch{fail('npm_unavailable','npm version could not be read from the active toolchain');}}
  const manifest=json(await bytesAt(root,'package.json'),'package.json'),lock=json(await bytesAt(root,'package-lock.json'),'package-lock.json');
  const versions=validateToolchain({manifest,lock,nodePin:(await bytesAt(root,'.node-version')).toString(),nodeVersion,npmVersion});
  const inputs=await Promise.all(BUILD_INPUTS.map(path=>fileRecord(root,path)));
  const source_sha=sourceIdentity(env),source_checkout=validateCheckout(checkout??await readCheckout(root),source_sha);
  const identity={schema:1,versions,platform:process.platform,arch:process.arch,inputs,source_sha,source_checkout,commands:['npm ci','npm run build']};
  return {...identity,identity_sha256:digest(identity)};
}
export async function recordBuild(options={}){
  const root=options.root||process.cwd(),identity=await inspectToolchain(options);
  const artifacts=await Promise.all(BUILD_OUTPUTS.map(path=>fileRecord(root,path)));
  const generated=(await bytesAt(root,'apps/web/generated.js')).toString();
  if(!generated.includes('export const webSourceSha='+JSON.stringify(identity.source_sha)+';'))fail('artifact_source_mismatch','Generated web payload does not contain the exact build source SHA');
  return {schema:1,kind:'relay-web-build',identity,artifacts,artifact_set_sha256:digest(artifacts),runtime_verified:false};
}
export async function verifyBuild(receipt,options={}){
  const current=await recordBuild(options);
  if(digest(receipt)!==digest(current))fail('stale_build','Build bytes, source, inputs or toolchain changed; rebuild and rerun affected checks');
  return current;
}
const output='qa-evidence/toolchain/build.json';
async function save(root,path,value){const file=resolve(root,path);await mkdir(dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(file+'.tmp',file);}
async function main(){
  const mode=process.argv[2];if(process.argv.length!==3||!['check','record-build','verify-build'].includes(mode))fail('invalid_command','Use check, record-build or verify-build');
  const options={};
  if(mode==='check')await save(process.cwd(),'qa-evidence/toolchain/preflight.json',await inspectToolchain(options));
  if(mode==='record-build')await save(process.cwd(),output,await recordBuild(options));
  if(mode==='verify-build')await verifyBuild(json(await bytesAt(process.cwd(),output),output),options);
  process.stdout.write('Relay release toolchain '+mode+' passed\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(async error=>{
  const code=/^[a-z_]+$/.test(error.code||'')?error.code:'unavailable';
  const message=code==='unavailable'?'Unable to read required release inputs':error.message;
  await save(process.cwd(),'qa-evidence/toolchain/failure.json',{schema:1,stage:'release-toolchain',state:'blocked',class:'setup_or_artifact',code,message,runtime_verified:false}).catch(()=>{});
  const escape=value=>String(value).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
  process.stderr.write('::error title=Release toolchain '+escape(code)+'::'+escape(message)+'\n');process.exitCode=1;
});
