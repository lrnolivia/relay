import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {evaluateTestMaintenance,parseTestMaintenanceReport,testMaintenanceSummary,TEST_MAINTENANCE_REPORT_PREFIX} from '../src/test-maintenance.js';

// Executes a real fixture suite and reports what the runner actually observed,
// the way a worker does before emitting its RELAY_TEST_MAINTENANCE report.
const fixture=name=>fileURLToPath(new URL('./fixtures/test-maintenance/'+name,import.meta.url));
function run(suite,app){
  const {stdout}=spawnSync(process.execPath,['--test','--test-reporter=tap',fixture(suite)],{encoding:'utf8',env:{...Object.fromEntries(Object.entries(process.env).filter(([k])=>k!=='NODE_TEST_CONTEXT')),NODE_OPTIONS:'',FIXTURE_APP:new URL('./fixtures/test-maintenance/'+app,import.meta.url).href}});
  const tests=[...stdout.matchAll(/^(ok|not ok) \d+ - (.+?)(?: # SKIP (.*))?$/gm)].map(([,status,id,skip])=>({id,outcome:skip!==undefined?'skipped':status==='ok'?'passed':'failed',...(skip!==undefined?{skip_reason:skip}:{})}));
  const total=key=>{const m=stdout.match(new RegExp(`^# ${key} (\\d+)$`,'m'));return m?Number(m[1]):null;};
  return {tests,counts:{passed:total('pass'),failed:total('fail'),skipped:total('skipped'),total:total('tests')}};
}
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const behaviors=[
  {id:'save',status:'unchanged',source:'acceptance: Save keeps working'},
  {id:'share',status:'unchanged',source:'acceptance: Share keeps working'},
  {id:'csv-export',status:'removed',source:'acceptance: Remove CSV export'}
];
const annotate=(observed,extra)=>observed.tests.map(t=>({...t,...extra[t.id],...(t.skip_reason?{rationale:t.skip_reason}:{})}));
const report=(observed,extra,more={})=>({schema:1,tested_commit:head,run:{id:'fixture-local',url:null},counts:observed.counts,behaviors,tests:annotate(observed,extra),...more});
const maintained={
  'save button saves':{behavior:'save',classification:'fixture-drift',rationale:'Approved change renamed the hook data-test="save" to data-testid="save-button"',assertions:{before:2,after:2}},
  'share button shares':{behavior:'share'},
  'csv export is removed':{behavior:'csv-export',classification:'obsolete-expectation',asserts:'absence',rationale:'CSV export removed by approved acceptance; presence test replaced with absence assertion',assertions:{before:2,after:2}}
};

test('obsolete suite fails against the approved change, which is why tests must change with the behavior',()=>{
  const observed=run('obsolete.check.mjs','app-v2.mjs');
  assert.deepEqual(observed.tests.filter(t=>t.outcome==='failed').map(t=>t.id),['save button saves','csv export downloads']);
  assert.equal(observed.counts.failed,2);
  // Leaving them failing without classification is never a pass.
  const evaluation=evaluateTestMaintenance(report(observed,{}));
  assert.equal(evaluation.verdict,'fail');assert.equal(evaluation.unresolved.length,2);
});

test('intentional removal: obsolete test is replaced by an absence assertion and the feature stays removed',()=>{
  const observed=run('maintained.check.mjs','app-v2.mjs');
  assert.deepEqual(observed.counts,{passed:3,failed:0,skipped:1,total:4});
  const evaluation=evaluateTestMaintenance(report(observed,maintained),{head_sha:head});
  assert.equal(evaluation.verdict,'pass',JSON.stringify(evaluation.violations));
  assert.deepEqual(evaluation.counts,observed.counts);
  // The same maintained suite rejects a build that resurrects the feature.
  const resurrected=run('maintained.check.mjs','app-v2-resurrected.mjs');
  assert.equal(resurrected.tests.find(t=>t.id==='csv export is removed').outcome,'failed');
});

test('restoring a removed feature to satisfy the obsolete test is a violation, not a fix',()=>{
  const observed=run('obsolete.check.mjs','app-v2-resurrected.mjs');
  assert.equal(observed.counts.failed,1); // only the selector drift remains
  const evaluation=evaluateTestMaintenance(report(observed,{'csv export downloads':{behavior:'csv-export',asserts:'presence'},'save button saves':{behavior:'save'},'share button shares':{behavior:'share'}}));
  assert.equal(evaluation.verdict,'fail');
  assert.ok(evaluation.violations.some(v=>v.code==='removed-behavior-restored'&&v.test==='csv export downloads'));
});

test('unintended regression still fails after maintenance and cannot be relabelled obsolete',()=>{
  const observed=run('maintained.check.mjs','app-v2-regressed.mjs');
  assert.equal(observed.tests.find(t=>t.id==='share button shares').outcome,'failed');
  const honest=evaluateTestMaintenance(report(observed,{...maintained,'share button shares':{behavior:'share',classification:'regression'}}));
  assert.equal(honest.verdict,'fail');assert.deepEqual(honest.regressions.map(r=>r.test),['share button shares']);
  const relabelled=evaluateTestMaintenance(report(observed,{...maintained,'share button shares':{behavior:'share',classification:'obsolete-expectation',outcome:'deleted',rationale:'not needed'}}));
  assert.equal(relabelled.verdict,'fail');assert.ok(relabelled.violations.some(v=>v.code==='obsolete-without-approved-change'));
  // A healer-style skip of broken functionality stays a visible regression.
  const skipped=evaluateTestMaintenance(report(observed,{...maintained,'share button shares':{behavior:'share',classification:'regression',outcome:'skipped',rationale:'Healer: functionality appears broken'}}));
  assert.equal(skipped.verdict,'fail');assert.ok(skipped.skips.some(s=>s.test==='share button shares'));assert.ok(skipped.coverage_reductions.some(c=>c.behavior==='share'));
});

test('selector repair keeps behavior assertions; weakening them is rejected',()=>{
  const observed=run('maintained.check.mjs','app-v2.mjs');
  const weakened=evaluateTestMaintenance(report(observed,{...maintained,'save button saves':{...maintained['save button saves'],assertions:{before:2,after:1}}}));
  assert.equal(weakened.verdict,'fail');assert.ok(weakened.violations.some(v=>v.code==='assertions-weakened'));
  const unexplained=evaluateTestMaintenance(report(observed,{...maintained,'save button saves':{...maintained['save button saves'],rationale:undefined}}));
  assert.ok(unexplained.violations.some(v=>v.code==='rationale-missing'&&v.test==='save button saves'));
});

test('skips and coverage reductions stay visible with reasons; unknown counts stay unknown',()=>{
  const observed=run('maintained.check.mjs','app-v2.mjs');
  const evaluation=evaluateTestMaintenance(report(observed,maintained));
  assert.deepEqual(evaluation.skips,[{test:'print preview',reason:'Print moved to the native dialog; covered by the native UI suite'}]);
  const summary=testMaintenanceSummary(evaluation);
  assert.match(summary,/3 passed, 0 failed, 1 skipped of 4/);assert.match(summary,/print preview \(Print moved/);
  const reasonless=evaluateTestMaintenance(report(observed,{...maintained,'print preview':{rationale:undefined}},{tests:annotate(observed,maintained).map(t=>t.id==='print preview'?{id:t.id,outcome:'skipped'}:t)}));
  assert.ok(reasonless.violations.some(v=>v.code==='skip-without-reason'));
  const unknown=evaluateTestMaintenance({...report(observed,maintained),counts:{passed:3},tested_commit:null});
  assert.deepEqual(unknown.counts,{passed:3,failed:null,skipped:null,total:null});assert.equal(unknown.verdict,'incomplete');
  assert.match(testMaintenanceSummary(unknown),/3 passed, unknown failed, unknown skipped of unknown · commit unknown/);
  const blanket=evaluateTestMaintenance(report(observed,{...maintained,'share button shares':{behavior:'share',snapshot:'blanket'}}));
  assert.ok(blanket.violations.some(v=>v.code==='blanket-snapshot-update'));
});

test('worker report round-trips through the agent-message prefix',()=>{
  const observed=run('maintained.check.mjs','app-v2.mjs');
  const message=TEST_MAINTENANCE_REPORT_PREFIX+JSON.stringify(report(observed,maintained));
  assert.equal(evaluateTestMaintenance(parseTestMaintenanceReport(message),{head_sha:head}).verdict,'pass');
  assert.equal(parseTestMaintenanceReport('ordinary agent text'),null);
  assert.equal(evaluateTestMaintenance(parseTestMaintenanceReport(TEST_MAINTENANCE_REPORT_PREFIX+'{nope')).verdict,'invalid');
});
