import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTelemetryPayload, foldSuiteEvents, parseTelemetryFromCheckRun, renderCheckRunOutput, summarizeCiChecks } from './ci-test-telemetry.js';

const sha = 'c'.repeat(40);
const T0 = Date.parse('2026-10-23T05:00:00Z');
const observer = ({ id = '91', attempt = 1, job = 'quality', state = 'running', suites, now = T0 + 60000, status = 'in_progress' }) => ({
  name: 'relay-tests / ' + job, status, head_sha: sha,
  output: renderCheckRunOutput(buildTelemetryPayload({ run: { id, attempt, job, url: `https://github.com/lrnolivia/relay/actions/runs/${id}/attempts/${attempt}` }, head_sha: sha, state, suites, now }))
});
const job = (fields = {}) => ({ name: 'quality', head_sha: sha, status: 'in_progress', started_at: new Date(T0).toISOString(), html_url: 'https://github.com/lrnolivia/relay/actions/runs/91/job/1', ...fields });

test('suite folding uses runner events, prefers the final summary and ignores malformed lines', () => {
  const running = foldSuiteEvents([
    JSON.stringify({ type: 'start', at: T0 }),
    JSON.stringify({ type: 'test', outcome: 'passed', name: 'a' }),
    JSON.stringify({ type: 'test', outcome: 'skipped', name: 'b' }),
    JSON.stringify({ type: 'test', outcome: 'failed', name: 'c', file: 'src/x.test.js', line: 4, message: 'boom' }),
    'not json', JSON.stringify({ type: 'test', outcome: 'invented' }),
    JSON.stringify({ type: 'file', file: 'src/x.test.js' })
  ]);
  assert.deepEqual(running.counts, { passed: 1, failed: 1, skipped: 1, todo: 0, cancelled: 0 });
  assert.equal(running.total, null);
  assert.equal(running.final, false);
  assert.equal(running.files_done, 1);
  assert.deepEqual(running.failures, [{ name: 'c', file: 'src/x.test.js', line: 4, message: 'boom' }]);
  const final = foldSuiteEvents([JSON.stringify({ type: 'test', outcome: 'passed' }), JSON.stringify({ type: 'summary', counts: { tests: 7, passed: 4, failed: 1, skipped: 1, todo: 1, cancelled: 0 } })]);
  assert.deepEqual(final.counts, { passed: 4, failed: 1, skipped: 1, todo: 1, cancelled: 0 });
  assert.equal(final.total, 7);
  assert.equal(final.final, true);
});

test('check run payload round-trips and only relay-tests observers are parsed', () => {
  const run = observer({ suites: [{ id: 'inspector', status: 'passed', counts: { passed: 3 }, total: 3 }] });
  const parsed = parseTelemetryFromCheckRun(run);
  assert.equal(parsed.suites[0].counts.passed, 3);
  assert.equal(parsed.run.attempt, 1);
  assert.match(run.output.title, /^Running · 3 tests passed, 0 failed, 0 skipped · 1\/1 suites done/);
  assert.equal(parseTelemetryFromCheckRun({ ...run, name: 'quality' }), null);
  assert.equal(parseTelemetryFromCheckRun({ ...run, output: { text: 'no payload' } }), null);
});

test('job counts and test counts stay separate and unknown totals stay unknown while running', () => {
  const ci = summarizeCiChecks({ check_runs: [job(), observer({ suites: [{ id: 'inspector', status: 'passed', counts: { passed: 300, skipped: 4 }, total: 304 }, { id: 'runner', status: 'running', counts: { passed: 12, failed: 1 }, failures: [{ name: 'lease renews', message: 'expected 2' }] }, { id: 'web', status: 'not_run' }] })] }, { now: T0 + 90000 });
  assert.equal(ci.status, 'running');
  assert.deepEqual({ total: ci.jobs.total, running: ci.jobs.running, passed: ci.jobs.passed }, { total: 1, running: 1, passed: 0 });
  assert.deepEqual({ passed: ci.tests.passed, failed: ci.tests.failed, skipped: ci.tests.skipped }, { passed: 312, failed: 1, skipped: 4 });
  assert.equal(ci.tests.total, null);
  assert.equal(ci.tests.totals_known, false);
  assert.deepEqual([ci.suites_done, ci.suites_total], [1, 3]);
  assert.equal(ci.failures[0].suite, 'runner');
  assert.equal(ci.elapsed_ms, 90000);
  assert.equal(ci.live, true);
  assert.equal(ci.stale, false);
});

test('a rerun replaces the previous attempt and a suite reported twice in one attempt counts once', () => {
  const suites = n => [{ id: 'inspector', status: 'passed', counts: { passed: n }, total: n }];
  const ci = summarizeCiChecks({ check_runs: [
    job({ status: 'completed', conclusion: 'success', completed_at: new Date(T0 + 300000).toISOString() }),
    observer({ attempt: 1, state: 'running', suites: suites(10), now: T0 + 10000 }),
    observer({ attempt: 2, state: 'completed', status: 'completed', suites: suites(20), now: T0 + 200000 }),
    observer({ attempt: 2, job: 'quality-shard', state: 'completed', status: 'completed', suites: suites(20), now: T0 + 100000 })
  ] }, { now: T0 + 400000 });
  assert.equal(ci.run.attempt, 2);
  assert.equal(ci.tests.passed, 20);
  assert.equal(ci.tests.total, 20);
  assert.equal(ci.tests.totals_known, true);
  assert.equal(ci.status, 'completed');
  assert.equal(ci.conclusion, 'success');
  assert.equal(ci.jobs.total, 1, 'observers never count as jobs');
  assert.equal(ci.live, false);
});

test('distinct shards add up, stale telemetry is flagged and missing telemetry is explicit', () => {
  const shard = (index, passed) => ({ id: 'web', shard: { index, total: 2 }, status: 'passed', counts: { passed }, total: passed });
  const sharded = summarizeCiChecks({ check_runs: [job(), observer({ state: 'running', suites: [shard(1, 5), shard(2, 7)], now: T0 })] }, { now: T0 + 3 * 60000 });
  assert.equal(sharded.tests.passed, 12);
  assert.equal(sharded.stale, true);
  const silent = summarizeCiChecks({ check_runs: [job({ status: 'completed', conclusion: 'failure', failure_details: { annotations: [{ title: 'Required suite web failed', message: 'See log' }] } })] });
  assert.equal(silent.telemetry, 'not-reported');
  assert.equal(silent.conclusion, 'failure');
  assert.equal(silent.failed_jobs[0].annotations[0].message, 'See log');
  assert.equal(summarizeCiChecks({ check_runs: [] }).status, 'queued');
  assert.equal(summarizeCiChecks({ check_runs: [job({ status: 'completed', conclusion: 'cancelled' })] }).conclusion, 'cancelled');
});

test('a runner nested inside a test cannot add failures or a summary to its parent suite', () => {
  const event = (pid, body) => JSON.stringify({ ...body, pid });
  const fold = foldSuiteEvents([
    event(10, { type: 'start', at: T0 }),
    event(10, { type: 'test', outcome: 'passed', name: 'outer' }),
    event(22, { type: 'start', at: T0 + 5 }),
    event(22, { type: 'test', outcome: 'failed', name: 'caller contract', message: '1 !== 0' }),
    event(22, { type: 'summary', counts: { tests: 1, failed: 1 } }),
    event(10, { type: 'summary', counts: { tests: 1, passed: 1 } })
  ]);
  assert.deepEqual(fold.failures, []);
  assert.deepEqual(fold.counts, { passed: 1, failed: 0, skipped: 0, todo: 0, cancelled: 0 });
  assert.equal(fold.total, 1);
});
