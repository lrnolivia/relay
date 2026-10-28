import test from 'node:test';
import assert from 'node:assert/strict';
import { testMaintenanceGuidance, playwrightAgentSetup, TEST_MAINTENANCE_DOC, evaluateTestMaintenance, testMaintenanceSummary } from './test-maintenance.js';

test('one canonical workflow with minimal host adapters for Claude and Codex', () => {
  const claude = testMaintenanceGuidance({ host: 'claude' }), codex = testMaintenanceGuidance({ host: 'codex' });
  assert.equal(claude.canonical, TEST_MAINTENANCE_DOC);
  assert.deepEqual(claude.steps, codex.steps);
  assert.deepEqual(claude.suites, codex.suites);
  assert.deepEqual(claude.playwright_test_agents.init, { claude: 'npx playwright init-agents --loop=claude' });
  assert.deepEqual(codex.playwright_test_agents.init, { codex: 'npx playwright init-agents --loop=codex' });
  assert.equal(Object.keys(testMaintenanceGuidance().playwright_test_agents.init).length, 2);
  assert.match(claude.playwright_test_agents.not_equivalent, /not the planner\/generator\/healer/);
  assert.match(claude.suites['native-ui'], /does not drive native UI/);
  assert.match(claude.steps.join(' '), /need no extra user approval/);
  assert.equal(testMaintenanceGuidance({ category: 'research' }), null);
  assert.ok(Buffer.byteLength(JSON.stringify(testMaintenanceGuidance())) < 8192);
});

const head = 'a'.repeat(40);
const observed = () => ({schema:1,tested_commit:head,run:{id:'local-review'},counts:{passed:1,failed:0,skipped:0,total:1},behaviors:[{id:'share',status:'unchanged'}],tests:[{id:'share works',behavior:'share',outcome:'passed'}]});

test('failed runner counts cannot pass when affected-test details omit the failure', () => {
  const report = {...observed(),counts:{passed:0,failed:1,skipped:0,total:1},tests:[]};
  const result = evaluateTestMaintenance(report,{head_sha:head});
  assert.equal(result.verdict,'fail');
  assert.ok(result.violations.some(v=>v.code==='reported-test-failure'));
});

test('current-source pass requires exact identity, run identity and known runner counts', () => {
  assert.equal(evaluateTestMaintenance(observed(),{head_sha:head}).verdict,'pass');
  const stale = evaluateTestMaintenance(observed(),{head_sha:'b'.repeat(40)});
  assert.equal(stale.verdict,'incomplete');
  assert.ok(stale.notes.some(n=>n.code==='tested-commit-differs'));
  assert.match(testMaintenanceSummary(stale),/tested-commit-differs/);
  for(const change of [{tested_commit:null},{run:null},{counts:{passed:1}},{tests:[]}]) {
    assert.equal(evaluateTestMaintenance({...observed(),...change},{head_sha:head}).verdict,'incomplete');
  }
  assert.match(testMaintenanceSummary(evaluateTestMaintenance(observed())),/run local-review/);
});

test('every replaced assertion needs a rationale even without an obsolete classification', () => {
  const report = {...observed(),tests:[{id:'share works',behavior:'share',outcome:'updated'}]};
  const result = evaluateTestMaintenance(report,{head_sha:head});
  assert.equal(result.verdict,'fail');
  assert.ok(result.violations.some(v=>v.code==='rationale-missing'));
  assert.equal(evaluateTestMaintenance({...report,tests:[{...report.tests[0],rationale:'Add a stronger assertion for the preserved Share behavior'}]}).verdict,'pass');
});

test('a reason does not justify deleting coverage for approved unchanged behavior', () => {
  const report = {...observed(),tests:[{id:'share works',behavior:'share',outcome:'deleted',rationale:'not needed'}]};
  const result = evaluateTestMaintenance(report,{head_sha:head});
  assert.equal(result.verdict,'fail');
  assert.ok(result.violations.some(v=>v.code==='unchanged-test-deleted'));
  assert.equal(result.coverage_reductions[0].test,'share works');
});

test('modified assertions require an unambiguous behavior binding', () => {
  const missing = {...observed(),tests:[{id:'share works',outcome:'updated',rationale:'Renamed fixture'}]};
  assert.equal(evaluateTestMaintenance(missing).verdict,'fail');
  const duplicate = {...observed(),behaviors:[{id:'share',status:'unchanged'},{id:'share',status:'removed'}]};
  assert.ok(evaluateTestMaintenance(duplicate).violations.some(v=>v.code==='duplicate-behavior'));
});

test('Test Agent setup is decided from existing project facts and stays idempotent', () => {
  const pkg = { devDependencies: { '@playwright/test': '1.60.0' } };
  assert.equal(playwrightAgentSetup({ host: 'claude', packageJson: { devDependencies: { vitest: '3' } }, browserUi: false }).state, 'not-applicable');
  assert.match(playwrightAgentSetup({ host: 'codex', packageJson: {}, files: [] }).action, /Do not install/);
  const missing = playwrightAgentSetup({ host: 'claude', packageJson: pkg, files: ['playwright.config.ts'], supportedLoops: ['claude'] });
  assert.equal(missing.state, 'agents-missing');assert.equal(missing.action, 'npx playwright init-agents --loop=claude');
  const files = ['playwright.config.ts', '.claude/agents/playwright-test-planner.md', '.claude/agents/playwright-test-generator.md', '.claude/agents/playwright-test-healer.md'];
  const present = playwrightAgentSetup({ host: 'claude', packageJson: pkg, files, generatedFor: '1.60.0' });
  assert.equal(present.state, 'agents-present');assert.match(present.action, /no init needed/);
  assert.equal(playwrightAgentSetup({ host: 'claude', packageJson: pkg, files, generatedFor: '1.59.0', supportedLoops: ['claude'] }).state, 'agents-stale');
  // Claude definitions do not satisfy Codex; its installed loop support must be checked.
  assert.equal(playwrightAgentSetup({ host: 'codex', packageJson: pkg, files }).state, 'loop-unverified');
  assert.throws(() => playwrightAgentSetup({ host: 'vscode', packageJson: pkg }), /claude or codex/);
});

test('Test Agent setup never recommends a loop the installed CLI does not support', () => {
  const installed = { host: 'codex', packageJson: { devDependencies: { playwright: '1.60.0' } }, supportedLoops: ['claude', 'copilot', 'opencode', 'vscode', 'vscode-legacy'] };
  const unsupported = playwrightAgentSetup(installed);
  assert.equal(unsupported.state, 'loop-unsupported');
  assert.doesNotMatch(unsupported.action, /init-agents --loop=codex/);
  assert.match(unsupported.action, /Do not upgrade/);
  const files = ['.codex/agents/playwright-test-planner.md', '.codex/agents/playwright-test-generator.md', '.codex/agents/playwright-test-healer.md'];
  assert.equal(playwrightAgentSetup({...installed,files,generatedFor:'1.59.0'}).state, 'loop-unsupported');
  assert.equal(playwrightAgentSetup({...installed,files,generatedFor:'1.60.0'}).state, 'agents-present');
  assert.equal(playwrightAgentSetup({...installed,host:'claude'}).state, 'agents-missing');
});

test('unknown installed loop support requires inspection before initialization', () => {
  const unknown = playwrightAgentSetup({ host: 'codex', packageJson: { devDependencies: { '@playwright/test': '1.60.0' } } });
  assert.equal(unknown.state, 'loop-unverified');
  assert.match(unknown.action, /--no-install playwright init-agents --help/);
  const guidance = testMaintenanceGuidance({host:'codex'}).playwright_test_agents;
  assert.match(guidance.run_init_only_when, /supports/);
  assert.match(guidance.unsupported_loop, /Do not upgrade/);
});
