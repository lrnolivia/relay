// Structured CI test telemetry shared by the CI reporter/publisher and Relay's CI card.
// Counts come only from node:test events; nothing here estimates or simulates progress.
export const TELEMETRY_SCHEMA = 'relay-test-telemetry/v1';
export const TELEMETRY_CHECK_PREFIX = 'relay-tests / ';
export const TELEMETRY_MARKER = '<!-- relay-test-telemetry/v1 -->';
export const STALE_AFTER_MS = 2 * 60 * 1000;
const OUTCOMES = ['passed', 'failed', 'skipped', 'todo', 'cancelled'];
const SUITE_STATES = new Set(['not_run', 'running', 'passed', 'failed', 'cancelled', 'timed_out', 'blocked', 'start_failed', 'signalled']);
const MAX_FAILURES = 10;
const text = (value, limit) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const zero = () => Object.fromEntries(OUTCOMES.map(key => [key, 0]));

// Fold one suite's reporter NDJSON. Only the first runner's events count, and its final summary is authoritative; running
// counts cover the interval before it arrives. Malformed lines are ignored, not guessed.
export function foldSuiteEvents(lines = []) {
  const running = zero(), failures = [];
  let summary = null, files = 0, started_at = null, ended_at = null, owner;
  for (const line of lines) {
    let event;
    try { event = typeof line === 'string' ? JSON.parse(line) : line; } catch { continue; }
    if (!event || typeof event !== 'object') continue;
    // The suite's own runner starts first; events from a runner nested inside a test are not its counts.
    if (owner === undefined) owner = event.type === 'start' ? event.pid : null;
    if (owner != null && event.pid !== owner) continue;
    if (event.type === 'start' && started_at == null && Number.isFinite(event.at)) started_at = event.at;
    if (event.type === 'end' && Number.isFinite(event.at)) ended_at = event.at;
    if (event.type === 'file') files += 1;
    if (event.type === 'test' && OUTCOMES.includes(event.outcome)) {
      running[event.outcome] += 1;
      if (event.outcome === 'failed' && failures.length < MAX_FAILURES) failures.push({ name: text(event.name, 200) || 'unnamed test', file: text(event.file, 300), line: Number.isSafeInteger(event.line) ? event.line : null, message: text(event.message, 500) });
    }
    if (event.type === 'summary' && event.counts && typeof event.counts === 'object') summary = event.counts;
  }
  const counts = summary ? { passed: count(summary.passed), failed: count(summary.failed), skipped: count(summary.skipped), todo: count(summary.todo), cancelled: count(summary.cancelled) } : running;
  return { counts, reported: OUTCOMES.reduce((sum, key) => sum + counts[key], 0), total: summary ? count(summary.tests) : null, files_done: files, failures, started_at, ended_at, final: Boolean(summary) };
}

// One payload per CI job attempt. Suites the job has not started stay not_run with unknown totals.
export function buildTelemetryPayload({ run = {}, head_sha = null, suites = [], state = 'running', now = Date.now() } = {}) {
  return {
    schema: TELEMETRY_SCHEMA,
    run: { id: text(String(run.id ?? ''), 40), attempt: Number.isSafeInteger(Number(run.attempt)) ? Number(run.attempt) : null, job: text(run.job, 80), url: text(run.url, 300), workflow: text(run.workflow, 120) },
    head_sha: /^[a-f0-9]{40}$/.test(head_sha || '') ? head_sha : null,
    state: state === 'completed' ? 'completed' : 'running',
    updated_at: new Date(now).toISOString(),
    suites: suites.slice(0, 32).map(suite => ({
      id: text(suite.id, 64), group: text(suite.group, 64),
      shard: suite.shard && Number.isSafeInteger(suite.shard.index) && Number.isSafeInteger(suite.shard.total) ? { index: suite.shard.index, total: suite.shard.total } : null,
      status: SUITE_STATES.has(suite.status) ? suite.status : 'not_run',
      counts: Object.fromEntries(OUTCOMES.map(key => [key, count(suite.counts?.[key])])),
      total: Number.isSafeInteger(suite.total) ? suite.total : null,
      files_done: count(suite.files_done),
      failures: (suite.failures || []).slice(0, MAX_FAILURES),
      started_at: Number.isFinite(suite.started_at) ? new Date(suite.started_at).toISOString() : null,
      ended_at: Number.isFinite(suite.ended_at) ? new Date(suite.ended_at).toISOString() : null
    }))
  };
}

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
export function telemetryHeadline(payload) {
  const tests = totalsOf(payload.suites || []);
  const done = (payload.suites || []).filter(s => !['not_run', 'running'].includes(s.status)).length;
  if (payload.state !== 'completed') return `Running · ${plural(tests.passed, 'test')} passed, ${tests.failed} failed, ${tests.skipped} skipped · ${done}/${(payload.suites || []).length} suites done`;
  return tests.failed ? `${plural(tests.failed, 'test')} failed · ${tests.passed} passed, ${tests.skipped} skipped` : `${plural(tests.passed, 'test')} passed · ${tests.skipped} skipped`;
}

// The check run carries the payload as fenced JSON after a marker; the conclusion is always
// neutral because the canonical quality job, not this observer, is the merge gate.
export function renderCheckRunOutput(payload) {
  const rows = (payload.suites || []).map(s => `| ${s.id} | ${s.status} | ${s.counts.passed} | ${s.counts.failed} | ${s.counts.skipped} | ${s.total ?? 'unknown'} |`);
  const summary = [telemetryHeadline(payload), '', 'Observational test telemetry; the `quality` job remains the gate.', '', '| suite | status | passed | failed | skipped | total |', '|---|---|---|---|---|---|', ...rows].join('\n');
  const json = JSON.stringify(payload);
  return { title: telemetryHeadline(payload).slice(0, 255), summary: summary.slice(0, 60000), text: (TELEMETRY_MARKER + '\n```json\n' + json + '\n```').slice(0, 65000) };
}

export function parseTelemetryFromCheckRun(run) {
  if (!run || typeof run.name !== 'string' || !run.name.startsWith(TELEMETRY_CHECK_PREFIX)) return null;
  const body = typeof run.output?.text === 'string' ? run.output.text : '';
  const at = body.indexOf(TELEMETRY_MARKER);
  if (at < 0) return null;
  const match = /```json\n([\s\S]*?)\n```/.exec(body.slice(at));
  if (!match) return null;
  try {
    const payload = JSON.parse(match[1]);
    if (payload?.schema !== TELEMETRY_SCHEMA || !Array.isArray(payload.suites)) return null;
    return { ...payload, check_run_id: run.id ?? null, check_status: run.status ?? null };
  } catch { return null; }
}

function totalsOf(suites) {
  const totals = zero();
  for (const suite of suites) for (const key of OUTCOMES) totals[key] += count(suite.counts?.[key]);
  return totals;
}
const at = value => { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : null; };

// CI card summary from one commit's check runs. Job counts and test counts stay separate;
// retries keep only the newest attempt per workflow run, and a suite reported by two jobs
// of one attempt counts once (the most recently updated report).
export function summarizeCiChecks(checks = {}, { now = Date.now() } = {}) {
  const runs = Array.isArray(checks.check_runs) ? checks.check_runs.filter(r => r && typeof r === 'object') : [];
  const jobs = runs.filter(r => !String(r.name || '').startsWith(TELEMETRY_CHECK_PREFIX));
  const payloads = runs.map(parseTelemetryFromCheckRun).filter(Boolean);
  const newest = new Map();
  for (const p of payloads) { const id = p.run?.id || 'unknown'; newest.set(id, Math.max(newest.get(id) ?? -Infinity, p.run?.attempt ?? 0)); }
  const current = payloads.filter(p => (p.run?.attempt ?? 0) === newest.get(p.run?.id || 'unknown'));
  const suites = new Map();
  for (const p of current) for (const s of p.suites) {
    const key = s.id + (s.shard ? '#' + s.shard.index + '/' + s.shard.total : '');
    const previous = suites.get(key);
    if (!previous || (at(p.updated_at) ?? 0) >= (at(previous.updated_at) ?? 0)) suites.set(key, { ...s, key, updated_at: p.updated_at, run_id: p.run?.id ?? null, attempt: p.run?.attempt ?? null });
  }
  const suiteList = [...suites.values()];
  const tests = totalsOf(suiteList);
  const allFinal = suiteList.length > 0 && suiteList.every(s => Number.isSafeInteger(s.total) && !['not_run', 'running'].includes(s.status));
  const jobStatus = { total: jobs.length, queued: jobs.filter(j => j.status === 'queued' || j.status === 'waiting' || j.status === 'pending').length, running: jobs.filter(j => j.status === 'in_progress').length, passed: jobs.filter(j => j.status === 'completed' && ['success', 'neutral', 'skipped'].includes(j.conclusion)).length, failed: jobs.filter(j => j.status === 'completed' && ['failure', 'timed_out', 'action_required', 'startup_failure'].includes(j.conclusion)).length, cancelled: jobs.filter(j => j.status === 'completed' && j.conclusion === 'cancelled').length };
  const status = !jobs.length ? 'queued' : jobStatus.running || jobStatus.queued ? (jobStatus.running ? 'running' : 'queued') : 'completed';
  const conclusion = status !== 'completed' ? null : jobStatus.failed ? 'failure' : jobStatus.cancelled ? 'cancelled' : 'success';
  const starts = jobs.map(j => at(j.started_at)).filter(n => n != null), ends = jobs.map(j => at(j.completed_at)).filter(n => n != null);
  const started = starts.length ? Math.min(...starts) : null;
  const finished = status === 'completed' && ends.length ? Math.max(...ends) : null;
  const latestTelemetry = Math.max(...current.map(p => at(p.updated_at) ?? 0), 0) || null;
  const telemetryLive = current.some(p => p.state === 'running');
  const runId = current[0]?.run?.id || null;
  const failures = suiteList.flatMap(s => (s.failures || []).map(f => ({ ...f, suite: s.id }))).slice(0, MAX_FAILURES);
  const failedJobs = jobs.filter(j => j.status === 'completed' && ['failure', 'timed_out', 'action_required', 'startup_failure'].includes(j.conclusion)).slice(0, 5).map(j => ({ name: text(j.name, 120), url: text(j.html_url, 300), conclusion: j.conclusion, annotations: (j.failure_details?.annotations || []).slice(0, 3).map(a => ({ title: text(a.title, 200), message: text(a.message, 300), path: text(a.path, 200) })) }));
  return {
    schema: 'relay-ci-card/v1',
    status, conclusion,
    head_sha: runs.find(r => /^[a-f0-9]{40}$/.test(r.head_sha || ''))?.head_sha || null,
    run: { id: runId, attempt: current[0]?.run?.attempt ?? null, url: current[0]?.run?.url || jobs[0]?.html_url || null },
    jobs: { ...jobStatus, current: jobs.filter(j => j.status !== 'completed').slice(0, 4).map(j => text(j.name, 120)) },
    suites: suiteList.slice(0, 12).map(s => ({ id: s.id, key: s.key, status: s.status, counts: s.counts, total: s.total, files_done: s.files_done })),
    tests: { ...tests, reported: Object.values(tests).reduce((a, b) => a + b, 0), total: allFinal ? suiteList.reduce((sum, s) => sum + s.total, 0) : null, totals_known: allFinal },
    suites_done: suiteList.filter(s => !['not_run', 'running'].includes(s.status)).length,
    suites_total: suiteList.length,
    telemetry: !current.length ? 'not-reported' : 'reported',
    stale: telemetryLive && latestTelemetry != null && now - latestTelemetry > STALE_AFTER_MS,
    observed_at: new Date(now).toISOString(),
    telemetry_updated_at: latestTelemetry ? new Date(latestTelemetry).toISOString() : null,
    started_at: started ? new Date(started).toISOString() : null,
    elapsed_ms: started ? Math.max(0, (finished ?? now) - started) : null,
    live: status !== 'completed' || telemetryLive,
    failures, failed_jobs: failedJobs
  };
}
