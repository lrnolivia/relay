import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { RUNNER_ENGINE_SHA } from './runner-control-core.js';

const sha = 'a'.repeat(40), revision = 'b'.repeat(40);
const root = new URL('../', import.meta.url);
async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'relay-retirement-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const statePath = join(dir, 'state.json');
  const requestPath = join(dir, 'request.json');
  const state = { engine: RUNNER_ENGINE_SHA, revision: sha, writes: 0, head: sha,
    registration: { id: 'relay', repository: 'lrnolivia/relay', managed: true, default_branch: 'main', implementation: { branch_prefixes: ['relay/'], excluded_branches: ['main'] }, coordination: { status: 'enabled', record: 'coordination/relay.json', max_active_branches: 4, lease_hours: 12 } },
    record: { project: 'relay', claims: [{ id: 'old', owner: 'owner', state: 'held', branch: 'relay/old', goal: 'Retain original objective' }], queue: [], legacy_branches: ['main'] }, ...overrides };
  if (overrides.recordPadding) state.record.retained_history = 'x'.repeat(overrides.recordPadding);
  await writeFile(statePath, JSON.stringify(state));
  // Mock only the gh process boundary; run the actual CLI, schema validation and adapter.
  await writeFile(join(dir, 'gh'), `#!${process.execPath}
const fs = require('node:fs');
const file = process.env.RELAY_TEST_STATE;
const s = JSON.parse(fs.readFileSync(file));
const path = process.argv[3];
const method = process.argv[process.argv.indexOf('--method') + 1];
const output = value => process.stdout.write(JSON.stringify(value));
const fail = status => { process.stderr.write('HTTP ' + status); process.exit(1); };
const blob = (value, sha) => ({ type: 'file', encoding: 'base64', sha, content: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64') });
if (path.includes('projects/relay.json')) output(blob(s.registration, '${sha}'));
else if (path.includes('src/coordination.mjs')) output(blob('', s.engine));
else if (path.endsWith('/pulls/9')) output(s.pr);
else if (path.includes('git/ref/heads/relay%2Fold')) { if (s.headError) fail(s.headError); output({ object: { sha: s.head } }); }
else if (path.includes('coordination/relay.json')) {
  if (method === 'PUT') {
    const body = JSON.parse(fs.readFileSync(0, 'utf8')); s.writes++;
    if (s.conflict) { fs.writeFileSync(file, JSON.stringify(s)); fail(409); }
    if (body.sha !== s.revision) fail(409);
    s.record = JSON.parse(Buffer.from(body.content, 'base64')); s.revision = '${revision}';
    fs.writeFileSync(file, JSON.stringify(s));
    if (s.timeout) fail(504);
    output({ commit: { sha: '${revision}' } });
  } else {
    if (s.unreadable && s.writes) fail(503);
    output(blob(s.writes ? JSON.stringify(s.record, null, 2) + '\\n' : s.record, s.revision));
  }
} else { process.stderr.write('Unexpected endpoint ' + path); process.exit(1); }
`, { mode: 0o755 });
  const request = { expected_record_sha: sha, id: 'old', owner: 'owner', disposition: 'cancelled', operation_id: 'retire-old', reason: 'Abandoned', evidence: 'Writer stopped and work preserved', expected_head_sha: sha };
  return {
    read: async () => JSON.parse(await readFile(statePath, 'utf8')),
    run: async (patch = {}, action = 'retire') => {
      await writeFile(requestPath, JSON.stringify({ ...request, ...patch }));
      return spawnSync(process.execPath, ['scripts/coordinate.mjs', action, 'relay', requestPath], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, RELAY_TEST_STATE: statePath, RELAY_RUNNER_CONTROL_REPOSITORY: 'lrnolivia/relay' } });
    }
  };
}
test('CLI retirement shares exact CAS/readback and reconciles lost responses without double writes', async t => {
  const f = await fixture(t, { timeout: true });
  const first = await f.run();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).receipt.reconciled_after_transport_error, true);
  const replay = await f.run({ expected_record_sha: revision });
  assert.equal(replay.status, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).receipt.replayed, true);
  assert.equal((await f.read()).writes, 1);
});
test('CLI rejects stale revision, forged head, policy drift and permission-denied absence', async t => {
  for (const [options, request] of [[{}, { expected_record_sha: revision }], [{ head: revision }, {}], [{ engine: revision }, {}], [{ headError: 403 }, { expected_head_sha: null }], [{}, { verified_head_sha: sha }]]) {
    const f = await fixture(t, options);
    const result = await f.run(request);
    assert.notEqual(result.status, 0);
    assert.equal((await f.read()).writes, 0);
  }
});
test('CLI writes only once on CAS conflict or unverifiable transport failure', async t => {
  for (const options of [{ conflict: true }, { timeout: true, unreadable: true }]) {
    const f = await fixture(t, options);
    const result = await f.run();
    assert.notEqual(result.status, 0);
    assert.equal((await f.read()).writes, 1);
  }
});
test('candidate engine sync targets the core pin and leaves canonical guard enforced', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'relay-engine-sync-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scripts')); await mkdir(join(dir, 'src'));
  await copyFile(new URL('../scripts/sync-coordination-engine.mjs', import.meta.url), join(dir, 'scripts/sync-coordination-engine.mjs'));
  const engine = Buffer.from('export const example = "candidate";\n');
  await writeFile(join(dir, 'src/coordination.mjs'), engine);
  await writeFile(join(dir, 'src/runner-control-core.js'), `export const RUNNER_ENGINE_SHA = '${sha}';\n`);
  const result = spawnSync(process.execPath, [join(dir, 'scripts/sync-coordination-engine.mjs'), '--local'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readFile(join(dir, 'src/coordination-engine.js')), engine);
  const hash = createHash('sha1').update(`blob ${engine.length}\0`).update(engine).digest('hex');
  assert.match(await readFile(join(dir, 'src/runner-control-core.js'), 'utf8'), new RegExp(hash));
  const workflow = await readFile(new URL('../.github/workflows/coordination.yml', import.meta.url), 'utf8');
  assert.match(workflow, /options: \[[^\]]*retire/);
  assert.match(workflow, /node scripts\/coordinate.mjs/);
});

test('CLI preserves a large coordination record whose base64 response exceeds the default 1 MiB buffer', async t => {
  const f = await fixture(t, { recordPadding: 820000 });
  const result = await f.run();
  assert.equal(result.status, 0, result.stderr);
  const state = await f.read();
  assert.equal(state.writes, 1);
  assert.equal(state.record.retained_history.length, 820000);
  assert.equal(state.record.claims[0].state, 'cancelled');
});

test('CLI cleanup protects a shared retired branch at both eligibility and pre-delete reread', async t => {
  for (const disposition of ['cancelled', 'superseded']) {
    for (const phase of ['initial', 'reread']) {
      const dir = await mkdtemp(join(tmpdir(), 'relay-retired-cleanup-'));
      t.after(() => rm(dir, { recursive: true, force: true }));
      const statePath = join(dir, 'state.json');
      await writeFile(statePath, JSON.stringify({ reads: 0, deletes: 0, disposition, phase }));
      await writeFile(join(dir, 'gh'), `#!${process.execPath}
const fs = require('node:fs');
const file = process.env.RELAY_CLEANUP_STATE, s = JSON.parse(fs.readFileSync(file));
const path = process.argv[3], method = process.argv[process.argv.indexOf('--method') + 1];
const head = '${sha}', merge = '${revision}';
const old = { id:'old', owner:'old-owner', state:'completed', branch:'relay/reused', work_accounted:true, pr:9, merged_head_sha:head, merge_commit_sha:merge };
const retired = { id:'new', owner:'new-owner', state:s.disposition, branch:'relay/reused', paths:['src/file.js'],resources:[] };
const blob = value => ({type:'file',encoding:'base64',sha:head,content:Buffer.from(JSON.stringify(value)).toString('base64')});
let result;
if(path.includes('projects/relay.json')) result=blob({repository:'lrnolivia/relay',default_branch:'main',implementation:{branch_prefixes:['relay/'],excluded_branches:['main']},coordination:{max_active_branches:4,lease_hours:12}});
else if(path.includes('coordination/relay.json')) { s.reads++; result=blob({claims:s.phase==='initial'||s.reads>1?[old,retired]:[old],queue:[],legacy_branches:['main']}); }
else if(path.includes('/branches?')) result=s.deletes?[]:[{name:'relay/reused',commit:{sha:head}}];
else if(path.includes('/pulls?state=open')) result=[];
else if(path.endsWith('/pulls/9')) result={merged:true,base:{ref:'main',repo:{full_name:'lrnolivia/relay'}},head:{ref:'relay/reused',sha:head,repo:{full_name:'lrnolivia/relay'}},merge_commit_sha:merge};
else if(path.includes('/git/ref/heads/')) result={object:{sha:head}};
else if(path.includes('/git/refs/heads/')&&method==='DELETE') {s.deletes++;result=null;}
else {process.stderr.write('Unexpected endpoint '+path);process.exit(1);}
fs.writeFileSync(file,JSON.stringify(s));process.stdout.write(JSON.stringify(result));
`, { mode: 0o755 });
      const run = spawnSync(process.execPath, ['scripts/coordinate.mjs', 'cleanup', 'relay'], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, RELAY_CLEANUP_STATE: statePath, RELAY_RUNNER_CONTROL_REPOSITORY: 'lrnolivia/relay' } });
      assert.equal(JSON.parse(await readFile(statePath, 'utf8')).deletes, 0, `${disposition} at ${phase}`);
      if (phase === 'initial') { assert.equal(run.status, 0, run.stderr); assert.deepEqual(JSON.parse(run.stdout).deleted, []); }
      else { assert.notEqual(run.status, 0); assert.match(run.stderr, /Ownership changed/); }
    }
  }
});

test('CLI reconciles through the guarded adapter and preserves original acceptance on replay', async t => {
  const claim = { id: 'old', owner: 'owner', state: 'completed', branch: 'relay/old', pr: 9, work_accounted: true, evidence: 'Verified merge', completed_at: '2026-10-01T00:00:00Z', merged_head_sha: sha, merge_commit_sha: revision };
  const record = { project: 'relay', claims: [claim], queue: [{ id: 'old', owner: 'owner', state: 'claimed', acceptance: 'Full original scope' }], legacy_branches: ['main'] };
  const pr = { merged: true, base: { ref: 'main', repo: { full_name: 'lrnolivia/relay' } }, head: { ref: 'relay/old', sha, repo: { full_name: 'lrnolivia/relay' } }, merge_commit_sha: revision };
  const request = { disposition: undefined, operation_id: undefined, reason: undefined, evidence: undefined, expected_head_sha: undefined, pr: 9 };
  const f = await fixture(t, { record, pr, timeout: true });
  const first = await f.run(request, 'reconcile');
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).assignment.state, 'completed');
  const replay = await f.run({ ...request, expected_record_sha: revision }, 'reconcile');
  assert.equal(replay.status, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).receipt.replayed, true);
  assert.equal((await f.read()).writes, 1);
  assert.equal((await f.read()).record.queue[0].acceptance, 'Full original scope');
  for (const options of [{ conflict: true }, { engine: revision }, { pr: { ...pr, merged: false } }]) {
    const rejected = await fixture(t, { record, pr, ...options });
    const result = await rejected.run(request, 'reconcile');
    assert.notEqual(result.status, 0);
    assert.equal((await rejected.read()).writes, options.conflict ? 1 : 0);
  }
});
test('CLI queued handoff uses exact CAS and returns queued ownership without creating a claim', async t => {
  const f = await fixture(t, { record: { project: 'relay', claims: [], queue: [{ id: 'old', owner: 'owner', state: 'queued', acceptance: 'Full scope' }], legacy_branches: ['main'] } });
  const request = { disposition: undefined, operation_id: undefined, reason: undefined, evidence: undefined, expected_head_sha: undefined, successor: 'actual-chat', next_action: 'Read and admit' };
  const result = await f.run(request, 'handoff');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).assignment.owner, 'actual-chat');
  assert.equal((await f.read()).record.claims.length, 0);
  assert.equal((await f.read()).record.queue[0].state, 'queued');
});
test('CLI completion now requires explicit revision and synchronizes the queue through verified PR proof', async t => {
  const record = { project: 'relay', claims: [{ id: 'old', owner: 'owner', state: 'active', branch: 'relay/old' }], queue: [{ id: 'old', owner: 'owner', state: 'claimed', acceptance: 'Full scope' }], legacy_branches: ['main'] };
  const pr = { merged: true, base: { ref: 'main', repo: { full_name: 'lrnolivia/relay' } }, head: { ref: 'relay/old', sha, repo: { full_name: 'lrnolivia/relay' } }, merge_commit_sha: revision };
  const f = await fixture(t, { record, pr });
  const request = { disposition: undefined, operation_id: undefined, reason: undefined, expected_head_sha: undefined, pr: 9, work_accounted: true };
  const missingRevision = await f.run({ ...request, expected_record_sha: undefined }, 'complete');
  assert.notEqual(missingRevision.status, 0);
  assert.equal((await f.read()).writes, 0);
  const completed = await f.run(request, 'complete');
  assert.equal(completed.status, 0, completed.stderr);
  assert.equal((await f.read()).record.queue[0].state, 'completed');
  assert.equal((await f.read()).record.queue[0].acceptance, 'Full scope');
});

test('CLI read resolves large immutable blobs and rejects identity drift before admission', async () => {
  const source=await readFile(new URL('../scripts/coordinate.mjs',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function read(file) {'),source.indexOf('\nconst registration = read('));
  const bytes=Buffer.from(JSON.stringify({project:'relay',padding:'x'.repeat(1024*1024)}));
  const sha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const metadata={type:'file',encoding:'none',sha,size:bytes.length};
  const blob={encoding:'base64',sha,size:bytes.length,content:bytes.toString('base64')};
  const calls=[];
  const api=path=>{calls.push(path);return path.includes('/git/blobs/')?blob:metadata;};
  const read=new Function('api','control','createHash','Buffer',`${code}; return read;`)(api,'lrnolivia/relay',createHash,Buffer);
  assert.equal(read('coordination/relay.json').value.project,'relay');
  assert.equal(calls[1],`repos/lrnolivia/relay/git/blobs/${sha}`);
  blob.content=Buffer.from('{}').toString('base64');
  assert.throws(()=>read('coordination/relay.json'),/identity verification/);
  metadata.size=9*1024*1024;
  assert.throws(()=>read('coordination/relay.json'),/response is incomplete/);
});
