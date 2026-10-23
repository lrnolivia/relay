import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TELEMETRY_CHECK_PREFIX, buildTelemetryPayload, foldSuiteEvents, parseTelemetryFromCheckRun, renderCheckRunOutput} from '../src/ci-test-telemetry.js';

// Publishes live suite counts to one observational check run per job attempt. Publishing is
// best effort: a refused or failed request never changes the required-suite result.
export async function readSuiteTelemetry(dir, ids) {
  const folds = new Map();
  for (const id of ids) {
    let raw = null;
    try { raw = await readFile(join(dir, id + '.ndjson'), 'utf8'); } catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
    if (raw != null) folds.set(id, foldSuiteEvents(raw.split('\n').filter(Boolean)));
  }
  return folds;
}

// The orchestrator's accounting decides each suite's status; telemetry only adds counts and
// marks a started-but-unfinished suite as running.
export function telemetrySuites(report, folds, groups = []) {
  return (report?.results || []).map(result => {
    const fold = folds.get(result.id);
    const status = result.status === 'not_run' ? (fold && !fold.final ? 'running' : 'not_run') : result.status;
    return {id: result.id, group: result.group || groups.find(g => g.suites.includes(result.id))?.id || null, status, counts: fold?.counts, total: fold?.total ?? null, files_done: fold?.files_done ?? 0, failures: fold?.failures || [], started_at: fold?.started_at ?? null, ended_at: fold?.ended_at ?? null};
  });
}

export function createTelemetryPublisher({env = process.env, fetchImpl = globalThis.fetch, minIntervalMs = 10000, now = Date.now, log = () => {}} = {}) {
  const token = env.RELAY_TEST_TELEMETRY_TOKEN, repo = env.GITHUB_REPOSITORY, sha = env.RELAY_SOURCE_SHA;
  const runId = env.GITHUB_RUN_ID, attempt = Number(env.GITHUB_RUN_ATTEMPT || 1), job = env.GITHUB_JOB || 'quality';
  const api = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, ''), server = (env.GITHUB_SERVER_URL || 'https://github.com').replace(/\/$/, '');
  const enabled = Boolean(token && /^[\w.-]+\/[\w.-]+$/.test(repo || '') && /^[a-f0-9]{40}$/.test(sha || '') && /^\d+$/.test(runId || '') && Number.isSafeInteger(attempt) && typeof fetchImpl === 'function');
  const name = TELEMETRY_CHECK_PREFIX + job, externalId = `relay-tests:${runId}:${attempt}:${job}`;
  const run = {id: runId, attempt, job, url: `${server}/${repo}/actions/runs/${runId}/attempts/${attempt}`, workflow: env.GITHUB_WORKFLOW || null};
  let checkId = null, last = -Infinity, disabled = !enabled, queue = Promise.resolve();
  const request = async (method, path, body) => {
    const response = await fetchImpl(api + path, {method, headers: {authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json'}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw Error(`GitHub ${method} check run returned ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  // A rerun leaves the previous attempt's observer unfinished only if its runner was lost.
  const supersede = async () => {
    const listing = await request('GET', `/repos/${repo}/commits/${sha}/check-runs?check_name=${encodeURIComponent(name)}&filter=all&per_page=50`);
    for (const old of listing?.check_runs || []) {
      if (old.id === checkId || old.status === 'completed' || old.external_id === externalId) continue;
      const payload = parseTelemetryFromCheckRun(old);
      await request('PATCH', `/repos/${repo}/check-runs/${old.id}`, {status: 'completed', conclusion: 'neutral', output: {title: 'Superseded by attempt ' + attempt, summary: 'This attempt stopped reporting; attempt ' + attempt + ' replaces it.', ...(payload ? {text: renderCheckRunOutput({...payload, state: 'completed'}).text} : {})}});
    }
  };
  const send = async (payload, final) => {
    const output = renderCheckRunOutput(payload);
    if (checkId == null) {
      const created = await request('POST', `/repos/${repo}/check-runs`, {name, head_sha: sha, external_id: externalId, details_url: run.url, status: final ? 'completed' : 'in_progress', ...(final ? {conclusion: 'neutral'} : {}), started_at: new Date(now()).toISOString(), output});
      checkId = created?.id ?? null;
      if (env.RELAY_TEST_TELEMETRY_STATE) { await mkdir(dirname(env.RELAY_TEST_TELEMETRY_STATE), {recursive: true}); await writeFile(env.RELAY_TEST_TELEMETRY_STATE, JSON.stringify({check_run_id: checkId, repository: repo, external_id: externalId}) + '\n'); }
      await supersede().catch(cause => log('Telemetry supersede skipped: ' + cause.message));
      return;
    }
    await request('PATCH', `/repos/${repo}/check-runs/${checkId}`, {...(final ? {status: 'completed', conclusion: 'neutral', completed_at: new Date(now()).toISOString()} : {}), output});
  };
  return {
    enabled, run, name,
    publish(payload, {final = false} = {}) {
      if (disabled || (!final && now() - last < minIntervalMs)) return queue;
      last = now();
      queue = queue.then(() => send({...payload, run, head_sha: sha}, final)).catch(cause => { disabled = true; log('Test telemetry publishing stopped: ' + cause.message); });
      return queue;
    }
  };
}

export function payloadFor({report, folds, groups, run, head_sha, final, now = Date.now()}) {
  return buildTelemetryPayload({run, head_sha, suites: telemetrySuites(report, folds, groups), state: final ? 'completed' : 'running', now});
}

// `--finalize` (an always() workflow step) completes an observer left in_progress by a
// killed process so it can never sit unfinished on the commit.
async function finalize(env = process.env) {
  if (!env.RELAY_TEST_TELEMETRY_STATE || !env.RELAY_TEST_TELEMETRY_TOKEN) return;
  let state;
  try { state = JSON.parse(await readFile(env.RELAY_TEST_TELEMETRY_STATE, 'utf8')); } catch { return; }
  if (!Number.isSafeInteger(state.check_run_id) || state.repository !== env.GITHUB_REPOSITORY) return;
  const api = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
  const headers = {authorization: 'Bearer ' + env.RELAY_TEST_TELEMETRY_TOKEN, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json'};
  const current = await (await fetch(`${api}/repos/${state.repository}/check-runs/${state.check_run_id}`, {headers, signal: AbortSignal.timeout(15000)})).json();
  if (current?.status === 'completed') return;
  const payload = parseTelemetryFromCheckRun(current);
  const output = payload ? {...renderCheckRunOutput({...payload, state: 'completed'}), title: 'Test telemetry ended before a final report'} : {title: 'Test telemetry ended before a final report', summary: 'The publishing process stopped early.'};
  await fetch(`${api}/repos/${state.repository}/check-runs/${state.check_run_id}`, {method: 'PATCH', headers, body: JSON.stringify({status: 'completed', conclusion: 'neutral', output}), signal: AbortSignal.timeout(15000)});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--finalize' || process.argv.length !== 3) { process.stderr.write('Usage: ci-test-telemetry-publish.mjs --finalize\n'); process.exitCode = 2; }
  else finalize().catch(cause => process.stdout.write('::warning::Test telemetry finalize skipped: ' + String(cause.message).slice(0, 200) + '\n'));
}
