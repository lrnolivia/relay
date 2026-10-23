import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {telemetryEnv} from '../scripts/ci-test-orchestrator.mjs';
import {createTelemetryPublisher, telemetrySuites} from '../scripts/ci-test-telemetry-publish.mjs';
import {foldSuiteEvents, parseTelemetryFromCheckRun} from '../src/ci-test-telemetry.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = 'd'.repeat(40);

test('telemetry env is opt-in and keeps the default TAP stdout', () => {
  const env = {PATH: process.env.PATH};
  assert.equal(telemetryEnv({id: 'web'}, {cwd: root, env}), env);
  const next = telemetryEnv({id: 'web'}, {cwd: root, env: {...env, RELAY_TEST_TELEMETRY_DIR: '/tmp/relay-telemetry', NODE_OPTIONS: '--max-old-space-size=4096'}});
  assert.equal(next.RELAY_TEST_TELEMETRY_FILE, '/tmp/relay-telemetry/web.ndjson');
  assert.equal(next.RELAY_TEST_TELEMETRY_DIR, undefined);
  assert.match(next.NODE_OPTIONS, /^--max-old-space-size=4096 --test-reporter=tap --test-reporter-destination=stdout --test-reporter=\S+ci-test-telemetry-reporter\.mjs --test-reporter-destination=/);
  assert.throws(() => telemetryEnv({id: 'web'}, {cwd: root, env: {RELAY_TEST_TELEMETRY_DIR: '/tmp/with space'}}), /whitespace/);
});

test('a real node:test run reports exact counts, and a nested runner adds none of its own', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'relay-telemetry-'));
  try {
    await writeFile(join(dir, 'inner.test.mjs'), "import test from 'node:test';test('inner one',()=>{});test('inner two',()=>{});\n");
    await writeFile(join(dir, 'outer.test.mjs'), `import test from 'node:test';import {spawnSync} from 'node:child_process';
test('passes',()=>{});
test('skips',{skip:true},()=>{});
test('todo',{todo:true},()=>{});
test('fails',()=>{throw new Error('expected failure')});
test('parent',async t=>{await t.test('child',()=>{});});
test('nested runner',()=>{const r=spawnSync(process.execPath,['--test',${JSON.stringify(join(dir, 'inner.test.mjs'))}],{encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);});
`);
    const env = telemetryEnv({id: 'fixture'}, {cwd: root, env: {...process.env, RELAY_TEST_TELEMETRY_DIR: dir, NODE_TEST_CONTEXT: ''}});
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ['--test', join(dir, 'outer.test.mjs')], {cwd: dir, env, encoding: 'utf8'});
    assert.equal(run.status, 1);
    assert.doesNotMatch(run.stderr, /EINVAL|Unhandled 'error'/);
    assert.equal(run.stderr.trim(), '');
    assert.match(run.stdout, /^TAP version 13/m);
    // An all-passing suite must still exit 0 with the reporter attached.
    await writeFile(join(dir, 'green.test.mjs'), "import test from 'node:test';test('green',()=>{});\n");
    const green = spawnSync(process.execPath, ['--test', join(dir, 'green.test.mjs')], {cwd: dir, env: telemetryEnv({id: 'green'}, {cwd: root, env: {...env, RELAY_TEST_TELEMETRY_DIR: dir}}), encoding: 'utf8'});
    assert.equal(green.status, 0, green.stderr);
    assert.equal(foldSuiteEvents((await readFile(join(dir, 'green.ndjson'), 'utf8')).split('\n').filter(Boolean)).counts.passed, 1);
    const fold = foldSuiteEvents((await readFile(join(dir, 'fixture.ndjson'), 'utf8')).split('\n').filter(Boolean));
    assert.equal(fold.final, true);
    assert.deepEqual(fold.counts, {passed: 4, failed: 1, skipped: 1, todo: 1, cancelled: 0});
    assert.equal(fold.total, 7);
    assert.equal(fold.failures[0].name, 'fails');
    assert.match(fold.failures[0].message, /expected failure/);
    assert.match(run.stdout, /# pass 4/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('suite status comes from required-suite accounting; telemetry only marks started suites running', () => {
  const report = {results: [{id: 'inspector', status: 'passed'}, {id: 'runner', status: 'not_run'}, {id: 'web', status: 'not_run'}]};
  const folds = new Map([['inspector', {counts: {passed: 3}, total: 3, final: true, failures: []}], ['runner', {counts: {passed: 1}, total: null, final: false, failures: []}]]);
  assert.deepEqual(telemetrySuites(report, folds, [{id: 'control', suites: ['inspector', 'runner']}]).map(s => [s.id, s.status, s.group]), [['inspector', 'passed', 'control'], ['runner', 'running', 'control'], ['web', 'not_run', null]]);
});

function fakeGitHub({fail = false, existing = []} = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({method: init.method, path: new URL(url).pathname + new URL(url).search, body, auth: init.headers.authorization});
    if (fail) return {ok: false, status: 403, json: async () => ({})};
    if (init.method === 'GET') return {ok: true, status: 200, json: async () => ({check_runs: existing})};
    return {ok: true, status: init.method === 'POST' ? 201 : 200, json: async () => ({id: 501})};
  };
  return {calls, fetchImpl};
}
const ciEnv = {RELAY_TEST_TELEMETRY_TOKEN: 'token-value', GITHUB_REPOSITORY: 'lrnolivia/relay', RELAY_SOURCE_SHA: sha, GITHUB_RUN_ID: '88', GITHUB_RUN_ATTEMPT: '2', GITHUB_JOB: 'quality'};
const payload = state => ({schema: 'relay-test-telemetry/v1', state, suites: [{id: 'inspector', status: state === 'completed' ? 'passed' : 'running', counts: {passed: 2, failed: 0, skipped: 0, todo: 0, cancelled: 0}, total: state === 'completed' ? 2 : null, failures: []}]});

test('publisher creates one observer, throttles updates, always concludes neutral and supersedes a lost attempt', async () => {
  let clock = 1000;
  const lost = {id: 400, status: 'in_progress', external_id: 'relay-tests:88:1:quality', name: 'relay-tests / quality', output: {text: ''}};
  const {calls, fetchImpl} = fakeGitHub({existing: [lost]});
  const publisher = createTelemetryPublisher({env: ciEnv, fetchImpl, now: () => clock, minIntervalMs: 10000});
  assert.equal(publisher.enabled, true);
  await publisher.publish(payload('running'));
  clock += 2000; await publisher.publish(payload('running'));
  clock += 20000; await publisher.publish(payload('running'));
  await publisher.publish(payload('completed'), {final: true});
  const create = calls.find(c => c.method === 'POST');
  assert.equal(create.path, '/repos/lrnolivia/relay/check-runs');
  assert.deepEqual([create.body.name, create.body.status, create.body.external_id, create.body.head_sha], ['relay-tests / quality', 'in_progress', 'relay-tests:88:2:quality', sha]);
  assert.equal(create.body.details_url, 'https://github.com/lrnolivia/relay/actions/runs/88/attempts/2');
  assert.equal(parseTelemetryFromCheckRun({name: create.body.name, output: create.body.output}).run.attempt, 2);
  const superseded = calls.find(c => c.method === 'PATCH' && c.path.endsWith('/400'));
  assert.deepEqual([superseded.body.status, superseded.body.conclusion], ['completed', 'neutral']);
  const own = calls.filter(c => c.method === 'PATCH' && c.path.endsWith('/501'));
  assert.equal(own.length, 2, 'the 2s update was throttled; the 22s update and the final were sent');
  assert.deepEqual([own.at(-1).body.status, own.at(-1).body.conclusion], ['completed', 'neutral']);
  assert.ok(calls.every(c => c.auth === 'Bearer token-value'));
});

test('publishing is disabled without CI identity and a refused request never throws', async () => {
  assert.equal(createTelemetryPublisher({env: {...ciEnv, RELAY_TEST_TELEMETRY_TOKEN: ''}}).enabled, false);
  const warnings = [];
  const {calls, fetchImpl} = fakeGitHub({fail: true});
  const publisher = createTelemetryPublisher({env: ciEnv, fetchImpl, log: message => warnings.push(message)});
  await publisher.publish(payload('running'));
  await publisher.publish(payload('completed'), {final: true});
  assert.equal(calls.length, 1, 'a refused create stops further publishing');
  assert.match(warnings[0], /403/);
});

test('re-deriving telemetry env replaces inherited reporter flags instead of stacking them', () => {
  const once = telemetryEnv({id: 'web'}, {cwd: root, env: {RELAY_TEST_TELEMETRY_DIR: '/tmp/a', NODE_OPTIONS: '--enable-source-maps'}});
  const twice = telemetryEnv({id: 'web'}, {cwd: root, env: {...once, RELAY_TEST_TELEMETRY_DIR: '/tmp/a'}});
  assert.equal(twice.NODE_OPTIONS, once.NODE_OPTIONS);
  assert.equal(once.NODE_OPTIONS.match(/--test-reporter=/g).length, 2);
});
