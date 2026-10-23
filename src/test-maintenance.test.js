import test from 'node:test';
import assert from 'node:assert/strict';
import { testMaintenanceGuidance, playwrightAgentSetup, TEST_MAINTENANCE_DOC } from './test-maintenance.js';

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

test('Test Agent setup is decided from existing project facts and stays idempotent', () => {
  const pkg = { devDependencies: { '@playwright/test': '1.60.0' } };
  assert.equal(playwrightAgentSetup({ host: 'claude', packageJson: { devDependencies: { vitest: '3' } }, browserUi: false }).state, 'not-applicable');
  assert.match(playwrightAgentSetup({ host: 'codex', packageJson: {}, files: [] }).action, /Do not install/);
  const missing = playwrightAgentSetup({ host: 'claude', packageJson: pkg, files: ['playwright.config.ts'] });
  assert.equal(missing.state, 'agents-missing');assert.equal(missing.action, 'npx playwright init-agents --loop=claude');
  const files = ['playwright.config.ts', '.claude/agents/playwright-test-planner.md', '.claude/agents/playwright-test-generator.md', '.claude/agents/playwright-test-healer.md'];
  const present = playwrightAgentSetup({ host: 'claude', packageJson: pkg, files, generatedFor: '1.60.0' });
  assert.equal(present.state, 'agents-present');assert.match(present.action, /no init needed/);
  assert.equal(playwrightAgentSetup({ host: 'claude', packageJson: pkg, files, generatedFor: '1.59.0' }).state, 'agents-stale');
  // Claude definitions do not satisfy Codex; each host initializes its own loop.
  assert.equal(playwrightAgentSetup({ host: 'codex', packageJson: pkg, files }).action, 'npx playwright init-agents --loop=codex');
  assert.throws(() => playwrightAgentSetup({ host: 'vscode', packageJson: pkg }), /claude or codex/);
});
