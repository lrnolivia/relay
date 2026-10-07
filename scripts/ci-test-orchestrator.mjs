import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Every historical required suite stays in the gate. Sequential execution avoids
// shared browser/fixture resource races; a suite failure does not stop siblings.
export const REQUIRED_SUITES = Object.freeze([
  {id:'inspector',command:'npm',args:['run','test:inspector']},
  {id:'runner',command:'npm',args:['run','test:runner']},
  {id:'layout',command:'npm',args:['run','test:layout']},
  {id:'contracts',command:'npm',args:['run','test:contracts']},
  {id:'web',command:'npm',args:['test','--workspace','@relay/web']}
].map(suite=>Object.freeze({...suite,args:Object.freeze(suite.args),required:true,dependsOn:Object.freeze([])})));

export function redact(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g,'')
    .replace(/\b(authorization|proxy-authorization|cookie|set-cookie)\s*:\s*[^\r\n]*/gi,'$1: [redacted]')
    .replace(/\bBearer\s+[^\s,;]+/gi,'Bearer [redacted]')
    .replace(/((?:token|authorization|cookie|secret|password|api[_-]?key)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}\]]+)/gi,'$1[redacted]')
    .replace(/https?:\/\/[^\s"'<>]+/g,url=>url.replace(/(https?:\/\/)[^/@]+@/,'$1[redacted]@').replace(/([?&])[^#]*/,'$1[redacted]').replace(/#.*/,'#[redacted]'));
}

function validate(suites, timeoutMs) {
  if (!Array.isArray(suites)||!suites.length) throw Error('A nonempty required-suite manifest is mandatory');
  if (!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30*60*1000) throw Error('Invalid bounded suite timeout');
  const seen=new Set();
  for (const s of suites) {
    if (!s||!/^[a-z][a-z0-9-]{0,63}$/.test(s.id)||seen.has(s.id)||typeof s.command!=='string'||!s.command||!Array.isArray(s.args)||s.args.some(a=>typeof a!=='string')||s.required!==true) throw Error('Invalid or duplicate required suite');
    if (!Array.isArray(s.dependsOn)||s.dependsOn.some(id=>!seen.has(id))) throw Error('Dependencies must name earlier required suites');
    seen.add(s.id);
  }
}

function execute(suite,{cwd,env,timeoutMs,signal,onOutput}) {
  return new Promise(resolveResult=>{
    const start=Date.now(); let child, done=false, timedOut=false, cancelled=false, spawnError=null, timer, killer, settle, forcedPipes=false;
    let tail='', failureLines=[], truncated=false;
    const pending={stdout:'',stderr:''},discarding={stdout:false,stderr:false};
    const emit=line=>{
      const safe=redact(line); onOutput(safe+'\n');
      tail=(tail+safe+'\n').slice(-8192);
      if (/not ok\b|error|fail|timeout|assert|expected|received/i.test(safe)) {
        failureLines.push(safe.slice(0,600)); if(failureLines.length>12)failureLines.shift();
      }
    };
    const flush=(kind,end=false)=>{
      let at; while((at=pending[kind].indexOf('\n'))>=0){
        if(discarding[kind]||at>32768){emit('[oversized output line omitted]');truncated=true;}else emit(pending[kind].slice(0,at));
        pending[kind]=pending[kind].slice(at+1);discarding[kind]=false;
      }
      if(pending[kind].length>32768){pending[kind]='';discarding[kind]=true;truncated=true;}
      if(end&&(pending[kind]||discarding[kind])){emit(discarding[kind]?'[oversized output line omitted]':pending[kind]);pending[kind]='';discarding[kind]=false;}
    };
    const terminate=signal=>{try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')spawnError=String(error.message);}};
    const kill=()=>{if(child&&!done){terminate('SIGTERM');killer=setTimeout(()=>{if(!done)terminate('SIGKILL');},500);settle=setTimeout(()=>{if(!done){forcedPipes=true;child.stdout?.destroy();child.stderr?.destroy();finish(child.exitCode,child.signalCode);}},1000);}};
    const abort=()=>{cancelled=true;kill();};
    const finish=async(code,exitSignal)=>{
      if(done)return;done=true;clearTimeout(timer);clearTimeout(killer);clearTimeout(settle);signal?.removeEventListener('abort',abort);
      // The leader can close its pipes before a detached descendant exits.
      // Finish group teardown even after leader close, before starting a sibling.
      if((timedOut||cancelled)&&child?.pid&&process.platform!=='win32'){
        await new Promise(resolveWait=>setTimeout(resolveWait,100));terminate('SIGKILL');
      }
      flush('stdout',true);flush('stderr',true);
      const status=cancelled?'cancelled':timedOut?'timed_out':spawnError?'start_failed':code===0?'passed':exitSignal?'signalled':'failed';
      resolveResult({id:suite.id,required:true,command:[suite.command,...suite.args].map(redact),status,exit_code:!spawnError&&Number.isInteger(code)?code:null,signal:exitSignal||null,duration_ms:Date.now()-start,output_truncated:truncated,forced_pipe_close:forcedPipes,process_cleanup:(timedOut||cancelled)?(process.platform==='win32'?'direct-child-only':'process-group-only'):null,diagnostic:redact(spawnError||failureLines.join('\n')||tail).slice(-8192)});
    };
    if(signal?.aborted){cancelled=true;finish(null,null);return;}
    try {child=spawn(suite.command,suite.args,{cwd,env,stdio:['ignore','pipe','pipe'],shell:false,detached:process.platform!=='win32'});}
    catch(error){spawnError=String(error.message);finish(null,null);return;}
    for(const kind of ['stdout','stderr'])child[kind].setEncoding('utf8').on('data',chunk=>{pending[kind]+=chunk;flush(kind);});
    child.on('error',error=>{spawnError=String(error.message);});
    child.on('close',finish);
    signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>{timedOut=true;kill();},timeoutMs);
  });
}

export async function runSuites(suites=REQUIRED_SUITES,{cwd=process.cwd(),env=process.env,timeoutMs=15*60*1000,signal,onOutput=()=>{},onReport=async()=>{},identity={}}={}) {
  validate(suites,timeoutMs);
  const results=[];
  const report=()=>({schema:1,identity,required_suites:suites.map(s=>s.id),results:[...results,...suites.slice(results.length).map(s=>({id:s.id,required:true,status:'not_run',exit_code:null,diagnostic:'Required suite has no completed result yet'}))],passed:results.filter(r=>r.status==='passed').length,nonpassing:suites.length-results.filter(r=>r.status==='passed').length,exit_code:results.length===suites.length&&results.every(r=>r.status==='passed')?0:1});
  await onReport(report());
  for(const suite of suites){
    const failedDependencies=suite.dependsOn.filter(id=>results.find(r=>r.id===id)?.status!=='passed');
    if(failedDependencies.length||signal?.aborted){
      results.push({id:suite.id,required:true,command:[suite.command,...suite.args].map(redact),status:signal?.aborted?'cancelled':'blocked',exit_code:null,signal:null,duration_ms:0,blocked_by:failedDependencies,diagnostic:signal?.aborted?'Run cancelled before this suite started':'Required prerequisite did not pass'});await onReport(report());continue;
    }
    results.push(await execute(suite,{cwd,env,timeoutMs,signal,onOutput}));
    await onReport(report());
  }
  return report();
}

const escapeCommand=value=>String(value).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
async function main(){
  const blocked=process.argv[2]==='--blocked';
  if(process.argv.length!==(blocked?3:2))throw Error('Suite filtering or custom commands are not supported by the required-suite CLI');
  const controller=new AbortController(); const stop=()=>controller.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const hash=async path=>{try{return createHash('sha256').update(await readFile(path)).digest('hex');}catch{return null;}};
  const source=process.env.RELAY_SOURCE_SHA||process.env.GITHUB_SHA||null;
  const identity={source_sha:/^[a-f0-9]{40}$/.test(source||'')?source:null,node:process.version,platform:process.platform,arch:process.arch,lock_sha256:await hash('package-lock.json'),manifest_sha256:createHash('sha256').update(JSON.stringify(REQUIRED_SUITES)).digest('hex'),run_id:process.env.GITHUB_RUN_ID||null,run_attempt:process.env.GITHUB_RUN_ATTEMPT||null};
  identity.complete=Boolean(identity.source_sha&&identity.lock_sha256);
  try{
    const output=resolve('qa-evidence/test-workflow/result.json');await mkdir(dirname(output),{recursive:true});
    const save=async report=>{await writeFile(output+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(output+'.tmp',output);};
    if(blocked){
      const prerequisites=Object.fromEntries(['toolchain','focused','install','browser','build','typecheck','runtime'].map(id=>[id,process.env['RELAY_SETUP_'+id.toUpperCase()]||'unknown']));
      const blockedBy=Object.keys(prerequisites).filter(id=>prerequisites[id]!=='success');
      const report={schema:1,identity,required_suites:REQUIRED_SUITES.map(s=>s.id),prerequisites,results:REQUIRED_SUITES.map(s=>({id:s.id,required:true,status:'blocked',exit_code:null,blocked_by:blockedBy,diagnostic:'Shared CI prerequisite did not pass; no suite was launched'})),passed:0,nonpassing:REQUIRED_SUITES.length,exit_code:1};
      await save(report);process.stdout.write('::error::Required suites blocked by shared setup: '+blockedBy.join(', ')+'\n');process.exitCode=1;return;
    }
    if(process.env.GITHUB_ACTIONS==='true'&&!identity.complete)throw Error('Canonical CI requires exact source and lockfile identity');
    const report=await runSuites(REQUIRED_SUITES,{signal:controller.signal,identity,onOutput:text=>process.stdout.write(text),onReport:save});
    for(const result of report.results){
      process.stdout.write('::notice::'+escapeCommand(`Required suite ${result.id}: ${result.status}; original exit ${result.exit_code}`)+'\n');
      if(result.status!=='passed')process.stdout.write('::error title='+escapeCommand(`Required suite ${result.id} ${result.status}`)+'::'+escapeCommand(result.diagnostic||'See retained full job log')+'\n');
    }
    process.stdout.write('::notice::Required-suite accounting '+JSON.stringify({passed:report.passed,nonpassing:report.nonpassing,required:report.required_suites.length})+'\n');
    process.exitCode=report.exit_code;
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{process.stderr.write(redact(error.message)+'\n');process.exitCode=1;});
