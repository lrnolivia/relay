import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {STAGE_JOBS,runStage,classifyStage,originalStageExit,summarizeStages,finalizeStages,qualityPlan,writeQualityPlan} from '../scripts/ci-stage.mjs';
import {REQUIRED_SUITES} from '../scripts/ci-test-orchestrator.mjs';

async function root(t){const dir=await mkdtemp(join(tmpdir(),'relay-ci-stage-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
const command=code=>({job:'quality',id:'install',command:process.execPath,args:['-e',code],env:{...process.env,GITHUB_ACTIONS:'false'},timeoutMs:2000});
test('command failure preserves exit 7, classification and persisted redacted diagnostics',async t=>{
  const dir=await root(t),r=await runStage({...command("console.error('AssertionError: token=SYNTHETIC_SECRET');process.exit(7)"),root:dir});
  assert.equal(r.state,'failed');assert.equal(r.exit_code,7);assert.equal(r.result.exit_code,7);assert.equal(r.classification.category,'command-exit-failure');assert.equal(r.classification.cause,'undetermined');
  const log=await readFile(join(dir,r.log.path),'utf8'),saved=await readFile(join(dir,'qa-evidence/ci-stages/quality-install.json'),'utf8');assert.doesNotMatch(log+saved,/SYNTHETIC_SECRET/);assert.match(log,/AssertionError/);assert.equal(JSON.parse(saved).result.exit_code,7);
});
test('success captures exactly the emitted log without duplication',async t=>{
  const dir=await root(t),r=await runStage({...command("process.stdout.write('first\\nsecond\\n')"),root:dir});assert.equal(r.exit_code,0);assert.equal(r.state,'passed');assert.equal(await readFile(join(dir,r.log.path),'utf8'),'first\nsecond\n');
});
test('missing executable and signal exit are distinct observed failure classes',async t=>{
  const dir=await root(t),missing=await runStage({...command(''),command:'__relay_no_executable__',root:dir});assert.equal(missing.state,'start_failed');assert.equal(missing.classification.category,'process-start-failure');assert.notEqual(missing.exit_code,0);
  const killed=await runStage({...command("process.kill(process.pid,'SIGTERM')"),root:dir});assert.equal(killed.state,'signalled');assert.equal(killed.result.signal,'SIGTERM');assert.equal(killed.exit_code,143);assert.equal(killed.classification.category,'signal-exit');
});
test('timeout cannot pass even when terminated code reports exit zero',async t=>{
  const dir=await root(t),r=await runStage({...command("process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},100)"),root:dir,timeoutMs:1000});assert.equal(r.state,'timed_out');assert.equal(r.result.exit_code,0);assert.equal(r.exit_code,124);assert.equal(r.classification.category,'timeout');
});
test('observed cancellation does not invent a user or provider cause',async t=>{
  const dir=await root(t),controller=new AbortController();controller.abort();const r=await runStage({...command(''),root:dir,signal:controller.signal});assert.equal(r.state,'cancelled');assert.equal(r.exit_code,130);assert.equal(r.classification.cancellation_actor,'unknown');assert.equal(r.classification.cause,'undetermined');
});
test('large logs retain bounded head/tail with failure and secrets removed',async t=>{
  const dir=await root(t),r=await runStage({...command("process.stdout.write('HEAD\\n'+('normal '.repeat(100)+'\\n').repeat(2000),()=>{console.error('Error: password=SYNTHETIC_PASSWORD TAIL');process.exit(9)});"),root:dir});const log=await readFile(join(dir,r.log.path),'utf8');assert.equal(r.exit_code,9);assert.equal(r.log.truncated,true);assert.ok(r.log.bytes<=1024*1024+256);assert.match(log,/HEAD/);assert.match(log,/TAIL/);assert.match(r.result.diagnostic,/Error/);assert.doesNotMatch(log+JSON.stringify(r),/SYNTHETIC_PASSWORD/);
});
test('medium log reconstruction neither omits nor duplicates overlapping chunks',async t=>{
  const dir=await root(t),text=('abcd'.repeat(1000)+'\n').repeat(180),r=await runStage({...command("process.stdout.write(('abcd'.repeat(1000)+'\\n').repeat(180))"),root:dir});assert.equal(r.log.truncated,false);const actual=await readFile(join(dir,r.log.path));assert.equal(actual.length,Buffer.byteLength(text));assert.equal(createHash('sha256').update(actual).digest('hex'),createHash('sha256').update(text).digest('hex'));
});
test('middle failure survives truncation and later passing test titles containing Error',async t=>{
  const dir=await root(t),r=await runStage({...command("const noise=('normal '.repeat(100)+'\\n').repeat(1000);process.stdout.write(noise+'Error: middle-cause token=SYNTHETIC_MIDDLE\\n'+noise+'ok 1 - Error: expected passing fixture\\n'.repeat(40),()=>process.exit(9));"),root:dir});
  const log=await readFile(join(dir,r.log.path),'utf8');assert.equal(r.log.truncated,true);assert.doesNotMatch(log,/middle-cause/);assert.match(r.failure_excerpt,/middle-cause/);assert.doesNotMatch(r.failure_excerpt,/SYNTHETIC_MIDDLE|passing fixture/);assert.ok(r.failure_excerpt.length<8192);assert.equal(r.exit_code,9);
});
test('canonical identity failure executes no command and saves nonpassing evidence',async t=>{
  const dir=await root(t),r=await runStage({...command("throw Error('MUST_NOT_RUN')"),root:dir,env:{...process.env,GITHUB_ACTIONS:'true',RELAY_SOURCE_SHA:'a'.repeat(40)}});assert.equal(r.state,'evidence_failed');assert.equal(r.error.code,'source_identity_missing');assert.equal(r.exit_code,1);assert.doesNotMatch(r.error.message,/MUST_NOT_RUN/);assert.match(r.identity.source_error.message,/not a git repository/);
});
test('successful command cannot retain stale lock identity after changing its bytes',async t=>{
  const dir=await root(t);await writeFile(join(dir,'package-lock.json'),'before');const r=await runStage({...command("require('node:fs').writeFileSync('package-lock.json','after')"),root:dir});assert.equal(r.state,'identity_changed');assert.equal(r.exit_code,1);assert.equal(r.result.exit_code,0);assert.equal(r.classification.category,'source-identity-change');
});
test('stage CLI returns original exit and escaped annotation with retained receipt',async t=>{
  const dir=await root(t),env={...process.env,GITHUB_ACTIONS:'false',RELAY_CI_JOB:'quality',GITHUB_REPOSITORY:'example/fixture',GITHUB_RUN_ID:'123'};delete env.NODE_TEST_CONTEXT;
  const r=spawnSync(process.execPath,[new URL('../scripts/ci-stage.mjs',import.meta.url).pathname,'install','--',process.execPath,'-e',"console.error('Error: token=SYNTHETIC_TOKEN');process.exit(11)"],{cwd:dir,env,encoding:'utf8'});assert.equal(r.status,11);assert.match(r.stderr,/::error title=CI stage install failed::/);assert.doesNotMatch(r.stdout+r.stderr,/SYNTHETIC_TOKEN/);assert.match(r.stderr,/Retained run log: https:\/\/github.com\/example\/fixture\/actions\/runs\/123/);
});
const identity={source_sha:'a'.repeat(40),run_id:'fixture',run_attempt:'1'};
function passing(){const job='quality',outcomes={},receipts={};for(const {id} of STAGE_JOBS[job]){outcomes[id]='success';if(id!=='suites')receipts[id]={job,stage:id,state:'passed',exit_code:0,identity:{...identity},result:{status:'passed',exit_code:0},classification:{category:'passed'}};}
  const suites={identity:{...identity},required_suites:REQUIRED_SUITES.map(s=>s.id),results:REQUIRED_SUITES.map(s=>({id:s.id,required:true,status:'passed',exit_code:0})),exit_code:0};return {job,outcomes,receipts,suites,identity};}
test('summary requires all five exact-source required suites and every required stage',()=>{
  const good=passing();assert.equal(summarizeStages(good).exit_code,0);
  for(const change of [x=>x.suites.results.pop(),x=>x.suites.identity.source_sha='b'.repeat(40),x=>x.suites.results[0].status='failed',x=>delete x.receipts.build,x=>x.outcomes.build='failure',x=>x.receipts.install.identity.run_id='old-run']){const value=passing();change(value);assert.equal(summarizeStages(value).exit_code,1);}
});
test('skipped conditional checks remain skipped and blocked prerequisites remain nonpassing',()=>{
  const value=passing();value.outcomes['context-card']='skipped';const r=summarizeStages(value);assert.equal(r.exit_code,0);assert.equal(r.results.find(x=>x.id==='context-card').status,'skipped');
  value.outcomes.build='skipped';assert.equal(summarizeStages(value).exit_code,1);assert.equal(summarizeStages(value).results.find(x=>x.id==='build').status,'blocked');
});
test('bootstrap failure and cancellation are reported from explicit workflow outcomes',()=>{
  for(const outcome of ['failure','cancelled']){const value=passing();value.outcomes['node-setup']=outcome;const r=summarizeStages(value);assert.equal(r.exit_code,1);assert.equal(r.external_steps[0].cancellation_actor,'unknown');assert.equal(r.external_steps[0].evidence,'workflow-outcome');}
});
test('failed stage cannot be relabelled success, even with a successful workflow outcome',()=>{
  const value=passing();value.receipts.build.state='failed';value.receipts.build.exit_code=9;assert.equal(summarizeStages(value).exit_code,1);
  assert.equal(classifyStage({status:'cancelled'}).cancellation_actor,'unknown');assert.equal(originalStageExit({status:'timed_out',exit_code:0}),124);
});
test('missing summary evidence cannot pass and finalizer retains its exact gap',async t=>{
  const dir=await root(t),r=await finalizeStages({job:'quality',root:dir,env:{RELAY_STAGE_OUTCOMES:'{"install":"failure"}'}});assert.equal(r.exit_code,1);assert.ok(r.results.every(result=>result.status!=='passed'));assert.equal(JSON.parse(await readFile(join(dir,'qa-evidence/ci-stages/quality-summary.json'))).state,'nonpassing');
});
test('unsupported job, stage, timeout and workflow outcome reject the operation',async t=>{
  const dir=await root(t);await assert.rejects(runStage({...command(''),root:dir,id:'unknown'}),{code:'invalid_stage'});await assert.rejects(runStage({...command(''),root:dir,timeoutMs:16*60000}),{code:'invalid_timeout'});
  const value=passing();value.outcomes.install='invented';assert.throws(()=>summarizeStages(value),{code:'invalid_stage_summary'});
});
test('applicable downstream gates cannot be skipped or satisfied by missing evidence',()=>{
  for(const flags of [{production:true,preview:false,contextCard:false},{production:false,preview:true,contextCard:true},{production:false,preview:false,contextCard:false}]){
    const plan=qualityPlan(flags),good=passing();good.requiredStages=plan.required_stages;
    for(const stage of STAGE_JOBS.quality.filter(stage=>stage.optional&&!plan.required_stages.includes(stage.id)))good.outcomes[stage.id]='skipped';
    assert.equal(summarizeStages(good).exit_code,0);
    for(const id of plan.required_stages){
      const skipped=structuredClone(good);skipped.outcomes[id]='skipped';assert.equal(summarizeStages(skipped).exit_code,1,id);
      const missing=structuredClone(good);delete missing.receipts[id];if(id==='suites')missing.suites=null;assert.equal(summarizeStages(missing).exit_code,1,id);
    }
  }
  assert.throws(()=>qualityPlan({production:true,preview:true,contextCard:false}),{code:'invalid_stage_plan'});
  assert.throws(()=>qualityPlan({production:'false',preview:false,contextCard:false}),{code:'invalid_stage_plan'});
  for(const requiredStages of [[],['unknown'],[...qualityPlan({production:false,preview:false,contextCard:false}).required_stages,'build']])assert.throws(()=>summarizeStages({...passing(),requiredStages}),{code:'invalid_stage_plan'});
});
test('applicability is saved before execution and rejects implicit or stale hosted decisions',async t=>{
  const dir=await root(t),env={RELAY_CI_PRODUCTION_REQUIRED:'true',RELAY_CI_PREVIEW_REQUIRED:'false',RELAY_CI_CARD_REQUIRED:'false',GITHUB_OUTPUT:join(dir,'outputs')};
  const plan=await writeQualityPlan({root:dir,env});assert.ok(plan.required_stages.includes('production'));assert.ok(plan.required_stages.includes('retained'));assert.ok(plan.required_stages.includes('reuse'));assert.ok(!plan.required_stages.includes('visual-review'));
  assert.deepEqual(JSON.parse(await readFile(join(dir,'qa-evidence/ci-stages/quality-plan.json'))),plan);assert.match(await readFile(env.GITHUB_OUTPUT,'utf8'),/production_required=true\n/);
  await assert.rejects(writeQualityPlan({root:dir,env:{...env,RELAY_CI_PREVIEW_REQUIRED:undefined}}),{code:'invalid_stage_plan'});
  for(const hosted of [{GITHUB_ACTIONS:'true'},{GITHUB_ACTIONS:'true',GITHUB_RUN_ID:'new-run',RELAY_REQUIRED_STAGES:JSON.stringify(plan.required_stages)}]){
    const blocked=await finalizeStages({job:'quality',root:dir,env:hosted});assert.equal(blocked.exit_code,1);assert.equal(blocked.error.code,'invalid_stage_plan');assert.equal(JSON.parse(await readFile(join(dir,'qa-evidence/ci-stages/quality-summary.json'))).state,'nonpassing');
  }
});
test('hosted finalization requires the original exact-source plan including every release gate',async t=>{
  const dir=await root(t);await writeFile(join(dir,'package-lock.json'),'{}');
  const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git(['init']);git(['add','.']);git(['-c','user.name=Relay fixture','-c','user.email=fixture@example.invalid','commit','-m','Synthetic applicability fixture']);
  const env={GITHUB_ACTIONS:'true',RELAY_SOURCE_SHA:git(['rev-parse','HEAD']),GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',RELAY_CI_PRODUCTION_REQUIRED:'true',RELAY_CI_PREVIEW_REQUIRED:'false',RELAY_CI_CARD_REQUIRED:'true'};
  const plan=await writeQualityPlan({root:dir,env}),value=passing(),directory=join(dir,'qa-evidence/ci-stages');
  for(const stage of STAGE_JOBS.quality){if(!plan.required_stages.includes(stage.id))value.outcomes[stage.id]='skipped';if(value.receipts[stage.id]){value.receipts[stage.id].identity=plan.identity;await writeFile(join(directory,'quality-'+stage.id+'.json'),JSON.stringify(value.receipts[stage.id]));}}
  value.suites.identity=plan.identity;await mkdir(join(dir,'qa-evidence/test-workflow'),{recursive:true});await writeFile(join(dir,'qa-evidence/test-workflow/result.json'),JSON.stringify(value.suites));
  env.RELAY_REQUIRED_STAGES=JSON.stringify(plan.required_stages);env.RELAY_STAGE_OUTCOMES=JSON.stringify(value.outcomes);assert.equal((await finalizeStages({job:'quality',root:dir,env})).exit_code,0);
  value.outcomes.retained='skipped';assert.equal((await finalizeStages({job:'quality',root:dir,env:{...env,RELAY_STAGE_OUTCOMES:JSON.stringify(value.outcomes)}})).exit_code,1);
  for(const mutate of [p=>p.identity.run_id='old',p=>p.identity.source_sha='b'.repeat(40),p=>p.identity.lock_sha256='changed',p=>p.production_required=false,p=>p.required_stages=p.required_stages.filter(id=>id!=='retained')]){
    const changed=structuredClone(plan);mutate(changed);await writeFile(join(directory,'quality-plan.json'),JSON.stringify(changed));const blocked=await finalizeStages({job:'quality',root:dir,env});assert.equal(blocked.exit_code,1);assert.equal(blocked.error.code,'invalid_stage_plan');assert.equal(blocked.classification.category,'applicability-evidence-failure');
  }
});
test('a failed Git lookup retains its original cause before any hosted gate can run',async t=>{
  const dir=await root(t),env={GITHUB_ACTIONS:'true',RELAY_SOURCE_SHA:'a'.repeat(40),RELAY_CI_PRODUCTION_REQUIRED:'false',RELAY_CI_PREVIEW_REQUIRED:'true',RELAY_CI_CARD_REQUIRED:'false'};
  await assert.rejects(writeQualityPlan({root:dir,env}),cause=>cause.code==='source_identity_missing'&&/not a git repository/.test(cause.message));
  const blocked=JSON.parse(await readFile(join(dir,'qa-evidence/ci-stages/quality-plan.json')));assert.equal(blocked.state,'blocked');assert.equal(blocked.exit_code,1);assert.match(blocked.identity.source_error.message,/not a git repository/);
  const summary=await finalizeStages({job:'quality',root:dir,env});assert.equal(summary.exit_code,1);assert.match(summary.error.message,/not a git repository/);
});
test('one canonical runner reuses its exact build and retains every applicable gate',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  assert.deepEqual([...workflow.matchAll(/^  ([a-z][\w-]+):$/mg)].map(match=>match[1]).filter(name=>!['workflow_dispatch','pull_request','push'].includes(name)),['quality']);
  assert.match(workflow,/Summarize observed CI stage outcomes\n\s+if: always\(\)/);assert.match(workflow,/Preserve redacted CI stage evidence\n\s+if: always\(\)/);
  for(const text of ['node scripts/ci-stage.mjs toolchain -- npm run check:toolchain','node scripts/ci-stage.mjs install -- npm ci','node scripts/ci-stage.mjs build -- npm run build'])assert.equal(workflow.split(text).length-1,1);
  assert.match(workflow,/node scripts\/ci-stage.mjs reuse -- node scripts\/release-toolchain.mjs verify-build/);
  assert.ok(workflow.indexOf('id: verify-reuse')<workflow.indexOf('id: verify-production'));assert.ok(workflow.indexOf('id: verify-reuse')<workflow.indexOf('id: verify-visual-review'));
  assert.match(workflow,/RELAY_REQUIRED_STAGES: \$\{\{ steps.production-scope.outputs.required_stages \}\}/);
  for(const [id,command] of [['production','node apps/web/verify-production.mjs'],['retained','node scripts/retain-web-preview.mjs'],['visual-review','node scripts/retain-web-preview.mjs']])assert.ok(workflow.includes('ci-stage.mjs '+id+' -- '+command));
  assert.match(workflow,/let required=process.env.EVENT_NAME==='workflow_dispatch'/);assert.match(workflow,/required=needsProductionVerification/);
  assert.match(workflow,/RELAY_CI_PREVIEW_REQUIRED:.*github.event.pull_request.draft == true/);assert.match(workflow,/RELAY_CI_CARD_REQUIRED:/);assert.match(workflow,/await writeQualityPlan/);
  assert.ok(workflow.indexOf('id: checkout-identity')<workflow.indexOf('id: production-scope'));assert.match(workflow,/git config --global --add safe.directory "\$GITHUB_WORKSPACE"/);assert.doesNotMatch(workflow,/safe.directory ['"]\*/);assert.match(workflow,/test "\$source_head" = "\$RELAY_SOURCE_SHA"/);
  assert.doesNotMatch(workflow,/playwright install/);assert.match(workflow,/const browser=await chromium.launch\(\)/);
  assert.match(workflow,/run: npm test/);assert.doesNotMatch(workflow,/ci-stage.mjs suites/);assert.doesNotMatch(workflow,/continue-on-error:/);assert.equal(STAGE_JOBS.quality.find(stage=>stage.id==='suites').timeout_ms,0,'five-suite orchestration retains independent 15-minute bounds');
});
