import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants} from 'node:os';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runSuites,redact,REQUIRED_SUITES} from './ci-test-orchestrator.mjs';

const stage=(id,minutes,optional=false)=>({id,timeout_ms:minutes*60000,optional});
export const STAGE_JOBS=Object.freeze({
  quality:[stage('toolchain',2),stage('focused',5),stage('install',15),stage('contracts',10),stage('build',10),stage('runtime',3),stage('browser',15),stage('typecheck',10),stage('suites',0),stage('context-card',10,true)],
  'website-production':[stage('toolchain',2),stage('install',8),stage('build',8),stage('browser',8),stage('production',8),stage('retained',8)],
  'visual-review-preview':[stage('toolchain',2),stage('install',8),stage('checkout',2),stage('build',8),stage('browser',8),stage('visual-review',8)]
});
const MAX_LOG=1024*1024,HALF_LOG=MAX_LOG/2;
const escaped=value=>String(value).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
const error=(code,message)=>Object.assign(Error(message),{code});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function rule(job,id){const value=STAGE_JOBS[job]?.find(stage=>stage.id===id);if(!value||id==='suites')throw error('invalid_stage','Unknown command stage; the five-suite orchestrator retains its own time bounds');return value;}
async function save(path,data){await writeFile(path+'.tmp',JSON.stringify(data,null,2)+'\n');await rename(path+'.tmp',path);}
async function identity(root,env){
  const hash=async path=>{try{return digest(await readFile(join(root,path)));}catch{return null;}};
  let head=null;try{head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}).trim();}catch{}
  const expected=env.RELAY_SOURCE_SHA||env.GITHUB_SHA||null;
  return {source_sha:head,expected_source_sha:expected,source_matches:Boolean(/^[a-f0-9]{40}$/.test(head||'')&&head===expected),node:process.version,platform:process.platform,arch:process.arch,lock_sha256:await hash('package-lock.json'),run_id:env.GITHUB_RUN_ID||null,run_attempt:env.GITHUB_RUN_ATTEMPT||null,job:env.RELAY_CI_JOB||null};
}
export function classifyStage(result){
  const categories={passed:'passed',start_failed:'process-start-failure',timed_out:'timeout',cancelled:'cancellation-observed',signalled:'signal-exit',failed:'command-exit-failure',not_run:'not-run',blocked:'prerequisite-blocked'};
  return {category:categories[result.status]||'unknown',evidence:'process-result',cause:'undetermined',cancellation_actor:'unknown'};
}
export function originalStageExit(result){
  if(result.status==='passed')return 0;
  // A timed-out/cancelled process may catch TERM and exit zero; its observed
  // exit is retained, while the gate still returns a nonzero timeout/cancel code.
  if(result.status==='timed_out')return 124;
  if(result.status==='cancelled')return 130;
  if(Number.isInteger(result.exit_code)&&result.exit_code>0&&result.exit_code<=255)return result.exit_code;
  if(result.signal&&constants.signals[result.signal])return 128+constants.signals[result.signal];
  return 1;
}

export async function runStage({job,id,command,args=[],root=process.cwd(),env=process.env,signal,timeoutMs,onOutput=()=>{}}){
  const definition=rule(job,id);
  if(typeof command!=='string'||!command||!Array.isArray(args)||args.some(arg=>typeof arg!=='string'))throw error('invalid_command','Stage requires an executable and argument vector');
  if(timeoutMs!==undefined&&(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>definition.timeout_ms))throw error('invalid_timeout','Stage timeout may only be shortened for a bounded check');
  const directory=resolve(root,'qa-evidence/ci-stages');await mkdir(directory,{recursive:true});
  const path=join(directory,job+'-'+id+'.json'),log=join(directory,job+'-'+id+'.log');
  const receipt={schema:1,kind:'ci-command-stage',job,stage:id,state:'running',started_at:new Date().toISOString(),identity:await identity(root,env),command:[command,...args].map(redact),result:null,exit_code:1,classification:{category:'incomplete',cause:'undetermined',cancellation_actor:'unknown'}};
  const firstChunks=[];let firstBytes=0,tailChunks=[],tailStart=0,tailBytes=0,total=0;
  const output=text=>{
    const bytes=Buffer.from(text);total+=bytes.length;
    if(firstBytes<HALF_LOG){const chunk=bytes.subarray(0,HALF_LOG-firstBytes);firstChunks.push(chunk);firstBytes+=chunk.length;}
    tailChunks.push(bytes);tailBytes+=bytes.length;
    while(tailBytes>HALF_LOG){const remove=Math.min(tailBytes-HALF_LOG,tailChunks[tailStart].length);tailBytes-=remove;if(remove===tailChunks[tailStart].length)tailStart++;else tailChunks[tailStart]=tailChunks[tailStart].subarray(remove);}
    if(tailStart>4096){tailChunks=tailChunks.slice(tailStart);tailStart=0;}
    onOutput(text);
  };
  await save(path,receipt);
  try{
    if(env.GITHUB_ACTIONS==='true'&&(!receipt.identity.source_matches||!receipt.identity.lock_sha256))throw error('source_identity_missing','Canonical stage requires exact checkout and lock identity');
    const childEnv={...env};delete childEnv.NODE_TEST_CONTEXT;
    const report=await runSuites([{id,command,args,required:true,dependsOn:[]}],{cwd:root,env:childEnv,signal,timeoutMs:timeoutMs??definition.timeout_ms,onOutput:output,onReport:async report=>{receipt.result=report.results[0];await save(path,receipt);}});
    receipt.result=report.results[0];receipt.classification=classifyStage(receipt.result);receipt.state=receipt.result.status;receipt.exit_code=originalStageExit(receipt.result);
    const after=await identity(root,env);receipt.source_after={source_sha:after.source_sha,lock_sha256:after.lock_sha256};
    if(receipt.state==='passed'&&(after.source_sha!==receipt.identity.source_sha||after.lock_sha256!==receipt.identity.lock_sha256)){receipt.state='identity_changed';receipt.exit_code=1;receipt.classification={category:'source-identity-change',evidence:'pre/post-identity',cause:'undetermined',cancellation_actor:'unknown'};}
  }catch(cause){receipt.state='evidence_failed';receipt.error={code:cause.code||'stage_evidence_failed',message:redact(cause.message).slice(0,2000)};receipt.classification={category:'evidence-failure',evidence:'wrapper-error',cause:'undetermined',cancellation_actor:'unknown'};receipt.exit_code=1;}
  // Original complete output remains in the hosted job log. Retain bounded,
  // already-redacted bytes here without allowing normal noise to erase failure.
  const truncated=total>MAX_LOG;
  const first=Buffer.concat(firstChunks),tail=Buffer.concat(tailChunks.slice(tailStart));
  const bytes=truncated?Buffer.concat([first,Buffer.from('\n[stage output truncated; complete redacted output is in the job log]\n'),tail]):total<=HALF_LOG?first:Buffer.concat([first,tail.subarray(HALF_LOG-(total-HALF_LOG))]);
  await writeFile(log,bytes);receipt.log={path:'qa-evidence/ci-stages/'+job+'-'+id+'.log',bytes:bytes.length,total_redacted_bytes:total,truncated,sha256:digest(bytes)};receipt.finished_at=new Date().toISOString();await save(path,receipt);
  return receipt;
}

export function summarizeStages({job,outcomes,receipts,suites,identity}){
  if(!STAGE_JOBS[job]||!outcomes||typeof outcomes!=='object'||Array.isArray(outcomes))throw error('invalid_stage_summary','Job and explicit stage outcomes required');
  const valid=new Set(['success','failure','cancelled','skipped','']);
  if(Object.values(outcomes).some(value=>!valid.has(value)))throw error('invalid_stage_summary','Unsupported workflow stage outcome');
  const results=STAGE_JOBS[job].map(definition=>{
    const id=definition.id,outcome=outcomes[id]??'',receipt=receipts[id];
    if(id==='suites'){
      const required=REQUIRED_SUITES.map(s=>s.id);
      const complete=suites?.identity?.source_sha===identity.source_sha&&suites.identity.run_id===identity.run_id&&suites.identity.run_attempt===identity.run_attempt&&JSON.stringify(suites.required_suites)===JSON.stringify(required)&&suites.results?.length===required.length&&suites.results.every((r,i)=>r.id===required[i]&&r.required===true&&r.status==='passed'&&r.exit_code===0)&&suites.exit_code===0;
      return {id,outcome,status:outcome==='success'&&complete?'passed':outcome==='skipped'?'blocked':outcome==='cancelled'?'cancelled':outcome==='failure'?'failed':'evidence_missing',receipt:'qa-evidence/test-workflow/result.json'};
    }
    if(outcome==='skipped')return {id,outcome,status:definition.optional?'skipped':'blocked',optional:definition.optional};
    if(!receipt||receipt.job!==job||receipt.stage!==id||receipt.identity?.source_sha!==identity.source_sha||receipt.identity?.run_id!==identity.run_id||receipt.identity?.run_attempt!==identity.run_attempt)return {id,outcome,status:outcome==='cancelled'?'cancelled':'evidence_missing'};
    return {id,outcome,status:outcome==='success'&&receipt.state==='passed'&&receipt.exit_code===0&&receipt.result?.status==='passed'&&receipt.result?.exit_code===0?'passed':receipt.state==='passed'?'outcome_mismatch':receipt.state,original_exit_code:receipt.result?.exit_code??null,signal:receipt.result?.signal??null,classification:receipt.classification,diagnostic:receipt.result?.diagnostic||receipt.error?.message||'See retained stage receipt'};
  });
  const external=Object.entries(outcomes).filter(([id])=>!STAGE_JOBS[job].some(stage=>stage.id===id)).map(([id,outcome])=>({id,outcome,status:outcome==='success'?'passed':outcome==='skipped'?'skipped':outcome==='cancelled'?'cancelled':'failed',evidence:'workflow-outcome',cause:'undetermined',cancellation_actor:'unknown'}));
  const complete=results.every(result=>result.status==='passed'||result.optional&&result.status==='skipped')&&external.every(result=>result.status==='passed'||result.status==='skipped');
  return {schema:1,kind:'ci-stage-summary',job,identity,results,external_steps:external,state:complete?'passed':'nonpassing',exit_code:complete?0:1,limits:['Classification describes observed process/workflow state; it does not identify the responsible actor or root cause','Bootstrap, upload and hard job cancellation failures may prevent local receipts; consult the hosted job log and check conclusion']};
}
export async function finalizeStages({job,root=process.cwd(),env=process.env}){
  const directory=resolve(root,'qa-evidence/ci-stages');await mkdir(directory,{recursive:true});
  const receipts={};for(const stage of STAGE_JOBS[job]||[]){try{receipts[stage.id]=JSON.parse(await readFile(join(directory,job+'-'+stage.id+'.json')));}catch{}}
  let suites;try{suites=JSON.parse(await readFile(resolve(root,'qa-evidence/test-workflow/result.json')));}catch{}
  const summary=summarizeStages({job,outcomes:JSON.parse(env.RELAY_STAGE_OUTCOMES||'{}'),receipts,suites,identity:await identity(root,env)});
  await save(join(directory,job+'-summary.json'),summary);return summary;
}
async function main(){
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    let receipt;
    if(process.argv[2]==='--summary'&&process.argv.length===4)receipt=await finalizeStages({job:process.argv[3]});
    else if(process.argv[3]==='--'&&process.argv.length>=5)receipt=await runStage({job:process.env.RELAY_CI_JOB,id:process.argv[2],command:process.argv[4],args:process.argv.slice(5),signal:controller.signal,onOutput:text=>process.stdout.write(text)});
    else throw error('invalid_cli','Use ci-stage.mjs <stage> -- <command> [arguments], or --summary <job>');
    if(receipt.exit_code!==0)process.stderr.write('::error title=CI stage '+escaped(receipt.stage||receipt.job)+' '+escaped(receipt.state)+'::'+escaped(receipt.result?.diagnostic||receipt.error?.message||'Stage evidence is incomplete; see retained summary and hosted job log')+'\n');
    process.exitCode=receipt.exit_code;
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(cause=>{process.stderr.write('::error title=CI stage evidence failure::'+escaped(redact(cause.message))+'\n');process.exitCode=1;});
