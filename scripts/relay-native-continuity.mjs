import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {runContinuityExecution} from './relay-continuity.mjs';
import {expansionDigest,validateContinuityAdditions} from '../packages/runner/src/continuity-expansion.mjs';

const LIMIT=1024*1024;
const terminal=new Set(['succeeded','failed','cancelled']);
const bindings=['project','assignment','owner','branch'];
const digest=expansionDigest;
async function privateDirectory(directory){
 directory=path.resolve(directory);await fs.mkdir(directory,{recursive:true,mode:0o700});
 for(let p=directory;;p=path.dirname(p)){if((await fs.lstat(p)).isSymbolicLink())throw Error('Native channel cannot traverse a symlink');if(path.dirname(p)===p)break;}
 const st=await fs.stat(directory);if((st.mode&0o077)!==0||st.uid!==process.getuid?.())throw Error('Native channel requires a private owned directory');return directory;
}
async function readJSON(filename){
 let st=await fs.lstat(filename);
 // Atomic link publication may briefly have two names until temp cleanup.
 for(let i=0;st.nlink===2&&i<5;i++){await new Promise(r=>setTimeout(r,2));st=await fs.lstat(filename);}
 if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>LIMIT||(st.mode&0o077)!==0)throw Error('Invalid private native packet');
 return JSON.parse(await fs.readFile(filename,'utf8'));
}
async function writeOnce(filename,value,{exclusive=false}={}){
 const bytes=JSON.stringify(value)+'\n';if(Buffer.byteLength(bytes)>LIMIT)throw Error('Native packet exceeds bound');
 const temporary=filename+'.tmp-'+randomUUID();await fs.writeFile(temporary,bytes,{flag:'wx',mode:0o600});
 try{await fs.link(temporary,filename);}
 catch(e){
  await fs.unlink(temporary);if(e.code!=='EEXIST')throw e;
  if(exclusive)throw Error('Native work is already started; reconcile, do not execute again');
  if(digest(await readJSON(filename))!==digest(value))throw Error('Native packet identity changed; reconcile original intent');return;
 }
 await fs.unlink(temporary);
}
function validateBinding(config){
 for(const key of bindings)if(typeof config[key]!=='string'||!config[key]||config[key].length>240)throw Error('Exact native assignment binding required');
 if(config.provider&&config.provider!=='codex')throw Error('This adapter is the existing Codex native task, not a Claude native integration');
}
function authorizeRpc(name,args,config){
 const same=()=>args.project===config.project&&args.assignment===config.assignment;
 if(name==='relay_autonomy'&&args.action==='status'&&['global',config.project].includes(args.scope))return;
 if(['relay_runner_assignments','relay_execution'].includes(name)&&same()&&(name!=='relay_execution'||args.action==='status'))return;
 if(name==='relay_runner_coordinate'&&args.action==='amend'&&args.project===config.project&&args.request?.id===config.assignment&&args.request.owner===config.owner&&args.expected_record_sha&&Object.keys(args.request).every(k=>['id','owner','paths','acceptance_additions','reason','next_action'].includes(k)))return;
 throw Error('Native transport request exceeds its bound continuation tools');
}
function validateReply(request,value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Buffer.byteLength(JSON.stringify(value))>LIMIT)throw Error('Native reply must be a bounded object');
 if(request.kind==='execute'){
  if(Object.keys(value).some(k=>!['state','summary','head_sha','continuity_additions'].includes(k))||!terminal.has(value.state)||typeof value.summary!=='string'||!value.summary.trim()||value.summary.length>2000||!/^[a-f0-9]{40}$/.test(value.head_sha||''))throw Error('Native work requires a terminal attributed report, never a process or objective claim');
  validateContinuityAdditions(value.continuity_additions||[]);
 }else if(request.kind==='review'){
  if(Object.keys(value).some(k=>!['verdict','preserves_goal','goal_digest','within_authority','sensitive_permissions','paid_services','canonical_key','reason'].includes(k))||!['admit','reject','authority-required'].includes(value.verdict))throw Error('Native coordinator review is a decision, not executable worker data');
 }
 return value;
}

// This is a credential-free rendezvous with the ALREADY RUNNING native task.
// It never starts a model/agent, grants a tool, or impersonates an OS process.
export async function openNativeChannel({directory,config,workspace,waitMs=300000}){
 validateBinding(config);if(!Number.isInteger(waitMs)||waitMs<1||waitMs>600000)throw Error('Native wait must be bounded');
 directory=await privateDirectory(directory);workspace=await fs.realpath(workspace);
 if(directory===workspace||directory.startsWith(workspace+path.sep))throw Error('Native channel must remain outside source');
 const manifest={schema:1,adapter:'codex-native-tools',binding:Object.fromEntries(bindings.map(k=>[k,config[k]])),workspace,plan_digest:digest(config.continuity)};
 await writeOnce(path.join(directory,'manifest.json'),manifest);
 const exchange=async(kind,data,{stable=false}={})=>{
  if((await fs.readdir(directory)).filter(x=>x.endsWith('.request.json')).length>=512)throw Error('Native channel request budget exhausted; checkpoint and reconcile');
  const request={schema:1,kind,binding:manifest.binding,data,nonce:stable?null:randomUUID()},id=digest(request),packet={...request,id};
  await writeOnce(path.join(directory,id+'.request.json'),packet);
  // One owner is waiting at a time; this pointer is not the durable intent.
  await fs.writeFile(path.join(directory,'current.json.tmp'),JSON.stringify({id})+'\n',{mode:0o600});await fs.rename(path.join(directory,'current.json.tmp'),path.join(directory,'current.json'));
  const until=Date.now()+waitMs;
  while(Date.now()<until){
   try{const reply=await readJSON(path.join(directory,id+'.response.json'));if(reply.request_digest!==id)throw Error('Native reply is for another request');if(reply.error)throw Error('Native tool request failed; reconcile original intent');return validateReply(packet,reply.value);}
   catch(e){if(e.code!=='ENOENT')throw e;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Native host reply unavailable; original request retained without replay');
 };
 let snapshot=null;
 const rpc=async(name,args)=>{
  authorizeRpc(name,args,config);
  // Every control gate starts with a NEW parallel native snapshot. The two
  // remaining reads consume that exact snapshot once; no cross-gate cache.
  if(name==='relay_autonomy'&&args.scope==='global'){
   snapshot=await exchange('snapshot',{project:config.project,assignment:config.assignment});return snapshot.global;
  }
  if(name==='relay_autonomy'&&snapshot){const value=snapshot.project;return value;}
  if(name==='relay_runner_assignments'&&snapshot){const value=snapshot.assignments;snapshot=null;return value;}
  return exchange('rpc',{name,args},{stable:name==='relay_runner_coordinate'});
 };
 const nativeHost={
  review:(proposal,context)=>exchange('review',{proposal,context}),
  execute:async(pending,stage,context)=>{
   const value=await exchange('execute',{pending,stage,context},{stable:true});
   return {...value,adapter:'codex-native-tools',host:os.hostname(),objective_completed:false,process_verified:false,execution_evidence_source:'native-task-reported; acceptance checked by configured verifier'};
  },
  reconcile:async pending=>{
   const files=await fs.readdir(directory);
   for(const file of files.filter(x=>/^[a-f0-9]{64}\.request\.json$/.test(x))){const q=await readJSON(path.join(directory,file));if(q.kind!=='execute'||q.data.pending.operation_id!==pending.operation_id)continue;
    try{const r=await readJSON(path.join(directory,q.id+'.response.json'));if(r.request_digest!==q.id||r.error)return null;return validateReply(q,r.value);}catch(e){if(e.code==='ENOENT')return null;throw e;}
   }
   return null;
  }
 };
 return {directory,rpc,nativeHost};
}
export async function pendingNativeRequest(directory){
 directory=await privateDirectory(directory);const pointer=await readJSON(path.join(directory,'current.json'));
 if(!/^[a-f0-9]{64}$/.test(pointer.id||''))throw Error('Invalid native request id');
 const request=await readJSON(path.join(directory,pointer.id+'.request.json'));
 const {id,...intent}=request;if(id!==pointer.id||digest(intent)!==id)throw Error('Native intent digest mismatch');
 const manifest=await readJSON(path.join(directory,'manifest.json'));if(digest(manifest.binding)!==digest(request.binding))throw Error('Native request assignment changed');
 if(request.kind==='rpc')authorizeRpc(request.data.name,request.data.args,manifest.binding);
 else if(request.kind==='snapshot'){if(request.data.project!==manifest.binding.project||request.data.assignment!==manifest.binding.assignment)throw Error('Native snapshot binding changed');}
 else if(!['review','execute'].includes(request.kind))throw Error('Unknown native request kind');
 let state='pending';for(const [suffix,label] of [['started','started'],['response','answered']])try{await readJSON(path.join(directory,id+'.'+suffix+'.json'));state=label;}catch(e){if(e.code!=='ENOENT')throw e;}
 return {request,state};
}
export async function beginNativeWork(directory,id){
 const p=await pendingNativeRequest(directory);if(p.request.id!==id||p.request.kind!=='execute'||p.state!=='pending')throw Error('Native work is already started/answered or request changed; reconcile, do not execute again');
 await writeOnce(path.join(directory,id+'.started.json'),{request_digest:id,operation_id:p.request.data.pending.operation_id,at:new Date().toISOString()},{exclusive:true});
}
export async function replyNativeRequest(directory,id,value){
 const p=await pendingNativeRequest(directory);if(p.request.id!==id)throw Error('Native reply target changed');validateReply(p.request,value);
 if(p.request.kind==='execute'&&p.state==='pending')throw Error('Persist native work start before reporting its result');
 await writeOnce(path.join(directory,id+'.response.json'),{request_digest:id,value});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [action,a,b,c]=process.argv.slice(2);
 if(action==='run'){
  const config=JSON.parse(await fs.readFile(a,'utf8')),channel=await openNativeChannel({directory:path.join(c,'native-channel'),config,workspace:b});
  const result=await runContinuityExecution({config,workspace:b,stateDir:c,rpc:channel.rpc,nativeHost:channel.nativeHost});console.log(JSON.stringify(result,null,2));
 }else if(action==='pending')console.log(JSON.stringify(await pendingNativeRequest(a)));
 else if(action==='begin')await beginNativeWork(a,b);
 else if(action==='reply')await replyNativeRequest(a,b,JSON.parse(await fs.readFile(c,'utf8')));
 else throw Error('Usage: relay-native-continuity.mjs run CONFIG CHECKOUT PRIVATE_RECEIPTS; pending CHANNEL; begin CHANNEL ID; reply CHANNEL ID PRIVATE_RESPONSE_FILE');
}
