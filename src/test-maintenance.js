// Canonical intent-aware test-maintenance workflow shared by Claude and Codex.
// Relay supplies approved intent and evaluates the worker's report; every test
// runner (Playwright Test Agents included) executes in the worker's project
// environment, never inside this server.

export const TEST_MAINTENANCE_VERSION = 1;
export const TEST_MAINTENANCE_DOC = 'lrnolivia/relay@main/docs/relay/TEST_MAINTENANCE_20261023.md';
export const TEST_MAINTENANCE_REPORT_PREFIX = 'RELAY_TEST_MAINTENANCE\n';
export const BEHAVIOR_STATUSES = ['unchanged', 'changed', 'removed', 'unresolved'];
export const CLASSIFICATIONS = ['regression', 'obsolete-expectation', 'fixture-drift', 'unresolved'];
const OUTCOMES = ['passed', 'failed', 'skipped', 'updated', 'deleted'];
const HOSTS = ['claude', 'codex'];
const REPORT_LIMIT = 65536;
// Work that cannot change code or tests does not need the workflow.
const NO_SOURCE_CHANGE = new Set(['design', 'research', 'coordination']);

const STEPS = [
  'Intent first: before editing any test, compare the approved goal, acceptance, acceptance_additions and amendments with the source diff. Mark each affected behavior unchanged, changed, removed or unresolved. Existing tests are evidence, not authority over approved requirements.',
  'Classify every failing or affected test: regression (unchanged behavior broke: fix the code, keep the test), obsolete-expectation (asserts a behavior the approved change removed or changed: update or delete it and add an absence/replacement assertion where meaningful), fixture-drift (selector, fixture or data shape moved while the behavior is unchanged: repair the locator/fixture without weakening behavior assertions), unresolved (no approved basis: leave it failing and report it).',
  'Change tests, fixtures, snapshots and test plans in the same change as the behavior. Preserve coverage of unchanged behavior.',
  'Never restore an intentionally removed feature to satisfy an obsolete test. Never blanket-update snapshots, weaken assertions, add skip/only/quarantine or loosen timeouts to get green CI.',
  'Every deleted or replaced assertion, changed snapshot, skipped or quarantined test and coverage reduction needs a one-line rationale tied to the approved change. Unexplained failures stay regressions or unresolved requirements.',
  'Authorized changes need no extra user approval: classify, update and report. Only unresolved requirements go back to the coordinator.',
  `Report with an agent message starting ${JSON.stringify(TEST_MAINTENANCE_REPORT_PREFIX)} followed by JSON (schema 1, see the canonical doc): tested_commit, run identity, actual counts (null when unknown, never estimated), behaviors, and per-test outcome/classification/rationale. Relay evaluates it and carries the verdict on the assignment card.`
];

const SUITES = {
  'browser-ui': 'Playwright Test. Use the official Playwright Test Agents (planner, generator, healer) when the project is set up for them.',
  'unit-integration': 'The project\'s existing runner (node:test, vitest, jest, pytest, cargo test, go test, ...). Do not port these to Playwright.',
  'native-ui': 'Native tooling for GTK/Windows/macOS UI (AT-SPI/dogtail, UI Automation/WinAppDriver, XCUITest, ...). Playwright does not drive native UI.'
};

function playwrightAdapter(host) {
  const hosts = HOSTS.includes(host) ? [host] : HOSTS;
  return {
    applies_when: 'The project has browser UI or existing Playwright E2E tests. Skip for native-only and non-browser projects.',
    reference: 'https://playwright.dev/docs/test-agents',
    inspect_first: [
      'package.json and lockfile for @playwright/test or playwright (version) and playwright.config.*',
      'existing Test Agent definitions (planner/generator/healer files under .claude/, .codex/, .github/ or the host\'s agent directory) and specs/ plus tests/seed.spec.*',
      'whether the definitions were generated for the Playwright version now in the lockfile',
      'npx --no-install playwright init-agents --help: confirm the installed CLI lists this host in its --loop choices; current website documentation may describe a newer package'
    ],
    init: Object.fromEntries(hosts.map(h => [h, `npx playwright init-agents --loop=${h}`])),
    run_init_only_when: 'The installed CLI supports this host AND definitions for this host are missing or Playwright changed version since they were generated. Otherwise reuse them; do not reinstall or regenerate per assignment.',
    unsupported_loop: 'Report unsupported when the installed CLI lacks this host, or unknown until its help is inspected. Do not upgrade Playwright or substitute another host merely to make the command work. Playwright 1.60.0 supports Claude but not the Codex loop advertised by the current website documentation.',
    preserve: 'Run from the project root on the assignment branch, review the generated diff, keep existing playwright.config, seed test, specs and customized agent files, and commit the definitions with the project. Respect host permission prompts; do not install browsers, global packages or MCP servers on the user\'s machine unless that is already authorized.',
    not_equivalent: 'Adding the Playwright MCP server (microsoft/playwright-mcp) only gives browser tools. It is not the planner/generator/healer setup.',
    healer_skips: 'The healer may mark a test skipped when it believes functionality is broken. Treat that as a regression report, not a fix: keep the skip visible with its reason or restore the behavior.',
    report: 'If setup is missing and not authorized here, say so in the report (playwright_agents: "missing" with the blocker). Never claim the agents ran when they did not.'
  };
}

// Guidance delivered on resume, preflight and executor start. It is bounded,
// deterministic for the same host, and contains no project-specific claims.
export function testMaintenanceGuidance({ host = null, category = null } = {}) {
  if (NO_SOURCE_CHANGE.has(category)) return null;
  return {
    version: TEST_MAINTENANCE_VERSION,
    canonical: TEST_MAINTENANCE_DOC,
    host: HOSTS.includes(host) ? host : 'any',
    steps: STEPS,
    suites: SUITES,
    playwright_test_agents: playwrightAdapter(host),
    report_prefix: TEST_MAINTENANCE_REPORT_PREFIX
  };
}

// Decide what the worker should do about Test Agents from facts it read in
// its own checkout. Pure: Relay never reads or writes the worker's machine.
export function playwrightAgentSetup({ host, packageJson = null, files = [], browserUi = null, generatedFor = null, supportedLoops = null } = {}) {
  if (!HOSTS.includes(host)) throw new Error('Test Agent setup needs an explicit claude or codex host');
  const deps = { ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) };
  const version = deps['@playwright/test'] || deps.playwright || null;
  const config = files.some(f => /(^|\/)playwright\.config\.[cm]?[jt]s$/.test(f));
  if (browserUi === false && !version && !config) return { state: 'not-applicable', action: 'Keep the project\'s native/unit/integration tooling.' };
  if (!version) return { state: 'playwright-missing', action: 'Playwright Test is not a project dependency. Do not install it unless the assignment authorizes adding browser E2E coverage; report the gap instead.' };
  const roles = ['planner', 'generator', 'healer'];
  const dirs = { claude: /(^|\/)\.claude\//, codex: /(^|\/)\.(codex|agents)\/|(^|\/)\.github\// };
  const found = roles.filter(role => files.some(f => dirs[host].test(f) && f.toLowerCase().includes(role)));
  if (found.length === roles.length && (!generatedFor || generatedFor === version)) return { state: 'agents-present', version, action: 'Reuse existing definitions; no init needed.' };
  if (!Array.isArray(supportedLoops) || !supportedLoops.every(x => typeof x === 'string')) return { state: 'loop-unverified', version, action: 'Inspect npx --no-install playwright init-agents --help and record its supported loops before recommending initialization.' };
  if (!supportedLoops.includes(host)) return { state: 'loop-unsupported', version, host, action: 'The installed Playwright CLI does not support this host. Do not upgrade or substitute another host without an authorized dependency change; report the limitation.' };
  const command = `npx playwright init-agents --loop=${host}`;
  if (found.length < roles.length) return { state: 'agents-missing', version, missing: roles.filter(r => !found.includes(r)), action: command };
  if (generatedFor && generatedFor !== version) return { state: 'agents-stale', version, generated_for: generatedFor, action: `${command} (Playwright changed; regenerate and review the diff)` };
}

const int = v => v === null || (Number.isSafeInteger(v) && v >= 0);
const text = (v, max = 500) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

export function parseTestMaintenanceReport(message) {
  if (typeof message !== 'string' || !message.startsWith(TEST_MAINTENANCE_REPORT_PREFIX)) return null;
  if (Buffer.byteLength(message) > REPORT_LIMIT) return { invalid: 'Report exceeds its bounded contract' };
  try { return JSON.parse(message.slice(TEST_MAINTENANCE_REPORT_PREFIX.length)); }
  catch { return { invalid: 'Report is not JSON' }; }
}

// Evaluate a worker report against approved intent. Violations fail the
// verdict; nothing here asks a human to approve an already authorized change.
export function evaluateTestMaintenance(report, { head_sha = null } = {}) {
  const violations = [], notes = [];
  const add = (list, code, test, detail) => list.push({ code, ...(test ? { test } : {}), detail });
  if (!report || typeof report !== 'object' || report.invalid) return { verdict: 'invalid', violations: [{ code: 'invalid-report', detail: report?.invalid || 'Missing report' }], notes, skips: [], coverage_reductions: [], regressions: [], unresolved: [], counts: null };
  if (report.schema !== 1) add(violations, 'invalid-report', null, 'schema must be 1');
  const behaviors = new Map();
  for (const b of Array.isArray(report.behaviors) ? report.behaviors : []) {
    if (!text(b?.id, 120) || !BEHAVIOR_STATUSES.includes(b.status)) { add(violations, 'invalid-behavior', null, 'Each behavior needs an id and status unchanged|changed|removed|unresolved'); continue; }
    if (behaviors.has(b.id)) { add(violations, 'duplicate-behavior', null, 'Each behavior id must have one unambiguous intent'); continue; }
    behaviors.set(b.id, b);
  }
  if (!behaviors.size) add(violations, 'intent-missing', null, 'Compare approved intent with the diff and list affected behaviors before changing tests');
  const skips = [], coverage = [], regressions = [], unresolved = [];
  for (const b of behaviors.values()) if (b.status === 'unresolved') unresolved.push({ behavior: b.id, detail: b.note || 'No approved basis' });
  for (const t of Array.isArray(report.tests) ? report.tests : []) {
    const id = text(t?.id, 300) ? t.id : '(unnamed)';
    if (!OUTCOMES.includes(t?.outcome)) { add(violations, 'invalid-test', id, 'outcome must be passed|failed|skipped|updated|deleted'); continue; }
    if (t.classification !== undefined && !CLASSIFICATIONS.includes(t.classification)) { add(violations, 'invalid-test', id, 'unknown classification'); continue; }
    const behavior = behaviors.get(t.behavior);
    const reason = text(t.rationale) ? t.rationale : null;
    const before = t.assertions?.before, after = t.assertions?.after;
    const reduced = Number.isInteger(before) && Number.isInteger(after) && after < before;
    if (['updated', 'deleted'].includes(t.outcome)) {
      if (!reason) add(violations, 'rationale-missing', id, 'Deleted or replaced assertions need a rationale tied to the approved change');
      if (!behavior) add(violations, 'behavior-missing', id, 'Modified assertions must identify their approved behavior');
      if (t.outcome === 'deleted' && behavior?.status === 'unchanged') add(violations, 'unchanged-test-deleted', id, 'Preserve coverage of approved unchanged behavior');
    }
    if (t.outcome === 'failed') {
      const cls = t.classification || 'unresolved';
      if (cls === 'regression') regressions.push({ test: id, behavior: t.behavior || null, detail: reason || 'Approved-unchanged behavior fails' });
      else if (cls === 'unresolved') unresolved.push({ test: id, detail: reason || 'Unclassified failure' });
      else add(violations, 'failing-after-maintenance', id, `A ${cls} test must be updated, not left failing`);
    }
    if (t.classification === 'obsolete-expectation') {
      if (!behavior || !['changed', 'removed'].includes(behavior.status)) add(violations, 'obsolete-without-approved-change', id, 'Only a behavior the approved change removed or changed can make a test obsolete');
      if (behavior?.status === 'removed' && t.outcome === 'updated' && t.asserts !== 'absence') add(notes, 'absence-assertion-suggested', id, 'Consider asserting the removed behavior is absent');
    }
    if (behavior?.status === 'removed' && t.asserts === 'presence' && t.outcome === 'passed') add(violations, 'removed-behavior-restored', id, 'A test passes by asserting a behavior the approved change removed; do not resurrect it');
    if (t.classification === 'fixture-drift') {
      if (behavior && behavior.status !== 'unchanged') add(violations, 'fixture-drift-on-changed-behavior', id, 'Behavior changed; classify as obsolete-expectation with a rationale');
      if (reduced) add(violations, 'assertions-weakened', id, `Fixture repair reduced behavior assertions ${before} -> ${after}`);
      if (!reason) add(violations, 'rationale-missing', id, 'Fixture or selector repair needs a rationale');
    }
    if (t.snapshot === 'blanket') add(violations, 'blanket-snapshot-update', id, 'Update snapshots individually with a rationale');
    else if (t.snapshot === 'updated') {
      if (!reason) add(violations, 'rationale-missing', id, 'Changed snapshots need a rationale');
      if (behavior?.status === 'unchanged' && t.classification !== 'fixture-drift') add(violations, 'snapshot-changed-for-unchanged-behavior', id, 'Snapshot changed but approved behavior is unchanged');
    }
    if (t.outcome === 'skipped' || t.quarantined) {
      skips.push({ test: id, reason });
      if (!reason) add(violations, 'skip-without-reason', id, 'Skipped or quarantined tests need a visible reason');
      if (t.classification === 'regression') regressions.push({ test: id, behavior: t.behavior || null, detail: `Skipped regression: ${reason || 'no reason'}` });
      if (behavior?.status === 'unchanged') coverage.push({ test: id, behavior: behavior.id, reason });
    }
    if (reduced && t.classification !== 'fixture-drift') {
      coverage.push({ test: id, behavior: t.behavior || null, reason, assertions: { before, after } });
      if (!reason) add(violations, 'rationale-missing', id, 'Coverage reduction needs a rationale');
      if (behavior?.status === 'unchanged') add(violations, 'assertions-weakened', id, 'Assertions reduced for unchanged behavior');
    }
    if (t.outcome === 'deleted' && t.classification !== 'obsolete-expectation') {
      coverage.push({ test: id, behavior: t.behavior || null, reason });
    }
  }
  const c = report.counts && typeof report.counts === 'object' ? report.counts : {};
  const counts = Object.fromEntries(['passed', 'failed', 'skipped', 'total'].map(k => [k, c[k] === undefined ? null : c[k]]));
  if (!Object.values(counts).every(int)) add(violations, 'invalid-counts', null, 'Counts are non-negative integers or null when unknown');
  else if (counts.total !== null && ['passed', 'failed', 'skipped'].reduce((s, k) => s + (counts[k] || 0), 0) > counts.total) add(violations, 'inconsistent-counts', null, 'passed+failed+skipped exceeds total');
  // A partial per-test list cannot erase an actual runner failure.
  if (Number.isSafeInteger(counts.failed) && counts.failed > 0) add(violations, 'reported-test-failure', null, 'The runner reported failed tests; missing details do not establish a pass');
  if (Object.values(counts).some(v => v === null)) add(notes, 'counts-incomplete', null, 'Runner counts are unknown; preserve them without claiming a pass');
  if (!Array.isArray(report.tests) || !report.tests.length) add(notes, 'affected-tests-missing', null, 'No affected-test evidence was reported');
  const commit = /^[a-f0-9]{40}$/.test(report.tested_commit || '') ? report.tested_commit : null;
  if (!commit) add(notes, 'tested-commit-unknown', null, 'Exact tested commit was not reported');
  else if (head_sha && commit !== head_sha) add(notes, 'tested-commit-differs', null, `Tests ran on ${commit.slice(0, 12)}, head is ${head_sha.slice(0, 12)}`);
  const run = report.run && typeof report.run === 'object' ? { id: report.run.id ?? null, url: report.run.url ?? null } : null;
  if (!(text(run?.id, 300) || Number.isSafeInteger(run?.id) && run.id > 0)) add(notes, 'run-identity-unknown', null, 'An actual run identity was not reported');
  const incomplete = notes.some(n => ['tested-commit-unknown', 'tested-commit-differs', 'counts-incomplete', 'affected-tests-missing', 'run-identity-unknown'].includes(n.code));
  const verdict = violations.length || regressions.length || unresolved.length ? 'fail' : incomplete ? 'incomplete' : 'pass';
  return { verdict, tested_commit: commit, run, counts, playwright_agents: report.playwright_agents ?? null, violations, notes, skips, coverage_reductions: coverage, regressions, unresolved };
}

const count = v => v === null ? 'unknown' : String(v);

export function testMaintenanceSummary(evaluation) {
  if (!evaluation) return null;
  const c = evaluation.counts || {};
  const parts = [`Test maintenance ${evaluation.verdict}`, `${count(c.passed ?? null)} passed, ${count(c.failed ?? null)} failed, ${count(c.skipped ?? null)} skipped of ${count(c.total ?? null)}`, `commit ${evaluation.tested_commit ? evaluation.tested_commit.slice(0, 12) : 'unknown'}`];
  parts.push(`run ${evaluation.run?.id ?? 'unknown'}`);
  if (evaluation.verdict === 'incomplete') parts.push(`incomplete: ${(evaluation.notes || []).map(n => n.code).join(', ')}`);
  if (evaluation.regressions?.length) parts.push(`${evaluation.regressions.length} regression(s)`);
  if (evaluation.unresolved?.length) parts.push(`${evaluation.unresolved.length} unresolved`);
  if (evaluation.skips?.length) parts.push(`skips: ${evaluation.skips.map(s => `${s.test} (${s.reason || 'no reason'})`).join('; ')}`);
  if (evaluation.coverage_reductions?.length) parts.push(`${evaluation.coverage_reductions.length} coverage reduction(s)`);
  if (evaluation.violations?.length) parts.push(`violations: ${[...new Set(evaluation.violations.map(v => v.code))].join(', ')}`);
  return parts.join(' · ').slice(0, 900);
}
