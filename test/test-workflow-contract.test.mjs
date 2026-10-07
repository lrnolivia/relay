import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {REQUIRED_SUITES,redact,runSuites} from '../scripts/ci-test-orchestrator.mjs';

const suite=(id,code,dependsOn=[])=>({id,command:process.execPath,args:['-e',code],required:true,dependsOn});

test('all original five suite commands remain required and none is filtered',()=>{
  assert.deepEqual(REQUIRED_SUITES.map(s=>[s.id,s.command,...s.args]),[
    ['inspector','npm','run','test:inspector'],['runner','npm','run','test:runner'],
    ['layout','npm','run','test:layout'],['contracts','npm','run','test:contracts'],
    ['web','npm','test','--workspace','@relay/web']
  ]);
  assert.ok(REQUIRED_SUITES.every(s=>s.required===true&&s.dependsOn.length===0));
});

test('two independent failures and one pass all execute with original exits',async()=>{
  let output='';const report=await runSuites([
    suite('first',"console.log('first failure');process.exit(3)"),
    suite('middle',"console.log('middle pass')"),
    suite('last',"console.error('last failure');process.exit(7)")
  ],{onOutput:t=>output+=t,identity:{source_sha:'a'.repeat(40)}});
  assert.deepEqual(report.results.map(r=>r.status),['failed','passed','failed']);
  assert.deepEqual(report.results.map(r=>r.exit_code),[3,0,7]);
  assert.equal(report.exit_code,1);assert.equal(report.nonpassing,2);
  assert.match(output,/middle pass/);assert.match(output,/last failure/);
  assert.equal(report.identity.source_sha,'a'.repeat(40));
});

test('a broken prerequisite blocks only its declared dependents',async()=>{
  let output='';const report=await runSuites([
    suite('setup','process.exit(2)'),suite('dependent',"console.log('must not run')",['setup']),
    suite('unrelated',"console.log('still runs')")
  ],{onOutput:t=>output+=t});
  assert.deepEqual(report.results.map(r=>r.status),['failed','blocked','passed']);
  assert.deepEqual(report.results[1].blocked_by,['setup']);
  assert.doesNotMatch(output,/must not run/);assert.match(output,/still runs/);assert.equal(report.exit_code,1);
});

test('all passing required suites are the only green aggregate',async()=>{
  const report=await runSuites([suite('one',''),suite('two','')]);
  assert.equal(report.exit_code,0);assert.equal(report.passed,2);assert.equal(report.nonpassing,0);
});

test('missing executable stays nonpassing and does not hide independent work',async()=>{
  const bad={id:'missing',command:'__relay_missing_command_20261007__',args:[],dependsOn:[],required:true};
  const report=await runSuites([bad,suite('later','')]);
  assert.equal(report.results[0].status,'start_failed');assert.equal(report.results[0].exit_code,null);
  assert.equal(report.results[1].status,'passed');assert.equal(report.exit_code,1);
});

test('timeout is not a pass and later independent suites run',async()=>{
  const report=await runSuites([suite('stuck','setInterval(()=>{},100)'),suite('later','')],{timeoutMs:200});
  assert.equal(report.results[0].status,'timed_out');assert.equal(report.results[1].status,'passed');assert.equal(report.exit_code,1);
});

test('POSIX timeout terminates the suite process group including subprocess pipes',{skip:process.platform==='win32'},async()=>{
  const code="require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},100)'],{stdio:['ignore','inherit','inherit']});setInterval(()=>{},100)";
  const started=Date.now();const report=await runSuites([suite('tree',code),suite('later','')],{timeoutMs:250});
  assert.equal(report.results[0].status,'timed_out');assert.equal(report.results[1].status,'passed');
  assert.ok(Date.now()-started<3000,'process-group teardown must not leave inherited pipes hanging');
});

test('explicit cancellation accounts for every required suite without running later ones',async()=>{
  const controller=new AbortController();setTimeout(()=>controller.abort(),80);
  const report=await runSuites([suite('current','setInterval(()=>{},100)'),suite('later',"throw Error('must not run')")],{signal:controller.signal});
  assert.deepEqual(report.results.map(r=>r.status),['cancelled','cancelled']);assert.equal(report.exit_code,1);
});

test('a signal exit remains nonpassing instead of becoming zero',async()=>{
  const report=await runSuites([suite('signal',"process.kill(process.pid,'SIGTERM')"),suite('later','')]);
  assert.equal(report.results[0].status,'signalled');assert.equal(report.results[0].exit_code,null);
  assert.equal(report.results[1].status,'passed');assert.equal(report.exit_code,1);
});

test('noise does not erase final failure and evidence stays bounded and redacted',async()=>{
  let output='';const code="console.log('normal line\\n'.repeat(4000));console.error('Error: token=synthetic-secret Bearer test-token https://example.test/path?secret=abc');process.exit(9)";
  const report=await runSuites([suite('noisy',code)],{onOutput:t=>output+=t});const result=report.results[0];
  assert.match(result.diagnostic,/Error:/);assert.ok(result.diagnostic.length<=8192);
  assert.doesNotMatch(JSON.stringify(report)+output,/synthetic-secret|test-token|secret=abc/);
  assert.match(output,/normal line/);assert.equal(result.exit_code,9);
});

test('redaction spans stdout chunks until a complete line arrives',async()=>{
  let output='';await runSuites([suite('split',"process.stdout.write('token=');setTimeout(()=>console.log('hidden-value'),20)")],{onOutput:t=>output+=t});
  assert.doesNotMatch(output,/hidden-value/);assert.match(output,/redacted/);
  assert.doesNotMatch(redact('password=hunter2 cookie=session-data'),/hunter2|session-data/);
});

test('authorization, cookies, URL userinfo and quoted values cannot leak',async()=>{
  const samples=['Authorization: Basic SYNTHETIC_BASIC','Cookie: session=SYNTHETIC_SESSION; csrf=SYNTHETIC_CSRF','https://SYNTHETIC_USER:SYNTHETIC_PASS@example.test/path?token=SYNTHETIC_QUERY',`password="SYNTHETIC FIRST LAST"`,`secret='SYNTHETIC QUOTED VALUE'`];
  for(const sample of samples)assert.equal(redact(sample).includes('SYNTHETIC'),false,sample.split(':')[0]);
  let output='';const report=await runSuites([suite('headers',`console.error(${JSON.stringify(samples.join('\n'))});process.exit(1)`) ],{onOutput:t=>output+=t});
  assert.equal((output+JSON.stringify(report)).includes('SYNTHETIC'),false);
});

test('oversized sensitive lines discard every suffix until newline',async()=>{
  let output='';const code="process.stdout.write('token='+'x'.repeat(40000));setTimeout(()=>console.log('SYNTHETIC_SUFFIX\\nnext ordinary line'),30)";
  const report=await runSuites([suite('oversized',code)],{onOutput:t=>output+=t});
  assert.equal(output.includes('SYNTHETIC_SUFFIX'),false);assert.equal(report.results[0].diagnostic.includes('SYNTHETIC_SUFFIX'),false);
  assert.match(output,/oversized output line omitted/);assert.match(output,/next ordinary line/);assert.equal(report.results[0].output_truncated,true);
});

test('incomplete accounting is persisted before execution and after every result',async()=>{
  const snapshots=[];const report=await runSuites([suite('first','process.exit(2)'),suite('second','')],{onReport:r=>snapshots.push(structuredClone(r))});
  assert.equal(snapshots.length,3);assert.equal(snapshots[0].results.length,2);assert.equal(snapshots[0].exit_code,1);
  assert.deepEqual(snapshots[1].results.map(r=>r.status),['failed','not_run']);assert.equal(report.exit_code,1);
  await assert.rejects(runSuites([suite('one','')],{onReport:()=>{throw Error('disk failed')}}),/disk failed/);
});

test('blocked CLI writes all required outcomes without launching any suite',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'relay-blocked-fixture-'));try{
    const result=spawnSync(process.execPath,[new URL('../scripts/ci-test-orchestrator.mjs',import.meta.url).pathname,'--blocked'],{cwd:dir,env:{...process.env,RELAY_SOURCE_SHA:'a'.repeat(40),RELAY_SETUP_INSTALL:'failure',RELAY_SETUP_BROWSER:'skipped',RELAY_SETUP_BUILD:'skipped',RELAY_SETUP_TYPECHECK:'skipped'},encoding:'utf8'});
    assert.equal(result.status,1);const report=JSON.parse(await readFile(join(dir,'qa-evidence/test-workflow/result.json'),'utf8'));
    assert.equal(report.results.length,5);assert.ok(report.results.every(r=>r.status==='blocked'&&r.exit_code===null));
    assert.equal(report.identity.complete,false);assert.equal(report.exit_code,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('POSIX timeout kills uncooperative same-group descendants even after leader closes',{skip:process.platform!=='linux'},async()=>{
  let output='',pid;const code="const c=require('node:child_process').spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},100)\"],{stdio:'ignore'});console.log('descendant='+c.pid);setInterval(()=>{},100)";
  try{
    const report=await runSuites([suite('ignored-pipes',code)],{timeoutMs:300,onOutput:t=>output+=t});pid=Number(/descendant=(\d+)/.exec(output)?.[1]);assert.ok(pid>0);
    let live=false;try{const stat=await readFile('/proc/'+pid+'/stat','utf8');live=!/\) Z /.test(stat);}catch{}
    assert.equal(live,false,'same-process-group descendant must not survive timeout');assert.equal(report.results[0].status,'timed_out');
  }finally{if(pid)try{process.kill(pid,'SIGKILL');}catch{}}
});

test('escaped descendants cannot keep inherited pipes pending indefinitely',{skip:process.platform==='win32'},async()=>{
  let output='',pid;const code="const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},100)'],{detached:true,stdio:['ignore','inherit','inherit']});console.log('escaped='+c.pid);setInterval(()=>{},100)";
  try{
    const started=Date.now();const report=await runSuites([suite('escaped',code)],{timeoutMs:200,onOutput:t=>output+=t});pid=Number(/escaped=(\d+)/.exec(output)?.[1]);
    assert.ok(pid>0);assert.ok(Date.now()-started<3000);assert.equal(report.results[0].status,'timed_out');assert.equal(report.results[0].forced_pipe_close,true);assert.equal(report.results[0].process_cleanup,'process-group-only');
  }finally{if(pid)try{process.kill(-pid,'SIGKILL');}catch{}}
});

test('forced pipe settlement preserves an already observed original exit',{skip:process.platform==='win32'},async()=>{
  let output='',pid;const code="const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},100)'],{detached:true,stdio:['ignore','inherit','inherit']});console.log('escaped='+c.pid);setTimeout(()=>process.exit(7),30)";
  try{
    const report=await runSuites([suite('exited-leader',code)],{timeoutMs:200,onOutput:t=>output+=t});pid=Number(/escaped=(\d+)/.exec(output)?.[1]);
    assert.ok(pid>0);assert.equal(report.results[0].status,'timed_out');assert.equal(report.results[0].exit_code,7);assert.equal(report.results[0].forced_pipe_close,true);
  }finally{if(pid)try{process.kill(-pid,'SIGKILL');}catch{}}
});

test('manifest rejects cycles, unknown prerequisites, duplicate or optional required suites',async()=>{
  await assert.rejects(runSuites([suite('first','',['unknown'])]),/Dependencies/);
  await assert.rejects(runSuites([suite('same',''),suite('same','')]),/duplicate/);
  await assert.rejects(runSuites([{...suite('optional',''),required:false}]),/required suite/);
  await assert.rejects(runSuites([]),/nonempty/);
  await assert.rejects(runSuites([suite('one','')],{timeoutMs:0}),/timeout/);
});

test('root command and CI retain the real gate and always upload suite accounting',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
  const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  assert.equal(pkg.scripts.test,'node scripts/ci-test-orchestrator.mjs');
  assert.equal(pkg.scripts['test:workflow'],'node --test test/test-workflow-contract.test.mjs');
  assert.match(workflow,/RELAY_SOURCE_SHA: \$\{\{ github.event.pull_request.head.sha \|\| github.sha \}\}/);
  assert.match(workflow,/name: Preserve required-suite accounting\n\s+if: always\(\)/);
  assert.match(workflow,/qa-evidence\/test-workflow\//);assert.match(workflow,/if-no-files-found: error/);
  assert.equal((workflow.match(/'test\/\*\*'/g)||[]).length,2);
  assert.match(workflow,/Account for suites blocked by setup/);assert.match(workflow,/ci-test-orchestrator.mjs --blocked/);
  assert.match(workflow,/timeout-minutes: 95/);
  assert.doesNotMatch(workflow,/continue-on-error:/);
});
