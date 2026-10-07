import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { callRunnerControl, runnerControlTools, runnerControlError, RUNNER_ENGINE_SHA, runnerControlRepository } from './runner-control.js';
const sha = 'a'.repeat(40);
const newSha = 'b'.repeat(40);
const defaultRequest = { id: 'task', owner: 'worker', branch: 'relay/task', paths: ['src/'], resources: ['relay-control'], goal: 'Native tools', acceptance: 'Policy enforced', next_action: 'Implement' };
function fixture(options = {}) {
  let record = { schema: 1, project: 'relay', claims: options.claims || [], queue: options.queue || [], legacy_branches: ['main', 'old-task'] };
  let revision = sha;
  const writes = [];
  const calls = [];
  const registration = { id: 'relay', repository: 'lrnolivia/relay', managed: true, default_branch: 'main', implementation: { branch_prefixes: ['relay/'], excluded_branches: ['main'] }, coordination: { status: 'enabled', record: 'coordination/relay.json', max_active_branches: 4, lease_hours: 12 } };
  const file = (value, revision = sha) => ({ type: 'file', sha: revision, encoding: 'base64', content: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64') });
  const api = async (path, request) => {
    calls.push(path);
    if (path.includes('src/coordination.mjs')) return file('', options.engineSha || RUNNER_ENGINE_SHA);
    if (path.includes('projects/relay.json')) return file(registration);
    if (path.includes('coordination/relay.json')) {
      if (request?.method === 'PUT') {
        writes.push(request);
        if (options.conflict) { revision = newSha; throw Object.assign(new Error('Conflict'), { status: 409 }); }
        if (options.writeError) throw options.writeError;
        record = JSON.parse(Buffer.from(request.body.content, 'base64').toString('utf8'));
        revision = newSha;
        if (options.timeout) throw Object.assign(new Error('Timed out'), { name: 'TimeoutError' });
        return { commit: { sha: 'c'.repeat(40) } };
      }
      if (options.readbackUnavailable && writes.length) throw new Error('outage');
      // Preserve exact serialization used by the writer on readback.
      return writes.length ? file(`${JSON.stringify(record, null, 2)}\n`, revision) : file(record, revision);
    }
    if (path.includes('/branches?')) return options.branches || [];
    if (path.includes('/git/ref/heads/relay%2Ftask')) {
      if (options.headError) throw Object.assign(new Error('Head unavailable'), { status: options.headError, ...(options.headGithub ? { github: options.headGithub } : {}) });
      return { object: { sha: options.head || sha } };
    }
    if (path.includes('/git/ref/heads/main')) return { object: { sha } };
    if (path.includes('/pulls?state=open')) return [];
    if (path.endsWith('/pulls/9')) return options.pr || { merged: false };
    throw new Error(`Unexpected path ${path}`);
  };
  return { api, writes, calls, get record() { return record; } };
}
const coordinate = (f, action, request = defaultRequest, expected_record_sha = sha) => callRunnerControl('relay_runner_coordinate', { project: 'relay', action, request, expected_record_sha }, {}, f.api);
const claim = (extra = {}) => ({ ...defaultRequest, state: 'active', base_sha: sha, created_at: new Date().toISOString(), lease_until: new Date(Date.now() + 3600000).toISOString(), ...extra });

test('canonical teams survive queue claim heartbeat and audited amendment under machine ownership', async () => {
  const f=fixture();
  const {branch,...queuedRequest}=defaultRequest;
  await coordinate(f,'queue',{...queuedRequest,category:'design',primary_role:'art-director',supporting_roles:['builder','verifier']});
  const queued=f.record.queue[0];
  assert.equal(queued.primary_team,'inspector');
  assert.deepEqual(queued.supporting_teams,['runner']);
  await coordinate(f,'claim',defaultRequest,newSha);
  assert.equal(f.record.claims[0].primary_team,'inspector');
  assert.equal(f.record.claims[0].primary_staff,'valentina');
  await coordinate(f,'heartbeat',{id:'task',owner:'worker',next_action:'Continue the design'},newSha);
  assert.equal(f.record.claims[0].primary_team,'inspector');
  await coordinate(f,'amend',{id:'task',owner:'worker',supporting_teams:['runner','release'],reason:'Add publication support'},newSha);
  assert.equal(f.record.claims[0].primary_staff,'valentina');
  assert.ok(f.record.claims[0].amendments.at(-1).fields.includes('supporting_teams'));
  await assert.rejects(coordinate(f,'amend',{id:'task',owner:'another-owner',primary_team:'runner',reason:'Attempt takeover'},newSha),/another owner/);
});

test('generated policy is byte-exact Runner source with correct Git blob provenance', async () => {
  const source = await readFile(new URL('./coordination-engine.js', import.meta.url));
  const hash = createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex');
  assert.equal(hash, RUNNER_ENGINE_SHA);
  assert.deepEqual(source, await readFile(new URL('./coordination.mjs', import.meta.url)));
});
test('definitions describe reads and bounded writes with strict server validation', async () => {
  assert.equal(runnerControlTools.length, 15);
  assert.ok(runnerControlTools.some(tool => tool.name === 'relay_runner_resume'));
  assert.ok(runnerControlTools.some(tool => tool.name === 'relay_runner_updates'));
  const coordinateTool = runnerControlTools.find(tool => tool.name === 'relay_runner_coordinate');
  const request = coordinateTool.inputSchema.properties.request.properties;
  assert.ok(request.category);
  assert.ok(request.labels);
  assert.ok(request.tags);
  assert.ok(request.primary_role);
  assert.ok(request.supporting_roles);
  const f = fixture();
  await assert.rejects(coordinate(f, 'release'), /unsupported/);
  await assert.rejects(coordinate(f, 'claim', { ...defaultRequest, merged_head_sha: sha }), /unsupported/);
  await assert.rejects(coordinate(f, 'claim', { ...defaultRequest, base_sha: sha }), /resolved automatically from live main/);
  await assert.rejects(coordinate(f, 'claim', { ...defaultRequest, paths: ['../secrets'] }), /Scopes/);
  assert.equal(f.writes.length, 0);
});
test('claim derives live base and writes only Runner coordination with exact CAS and readback receipt', async () => {
  const f = fixture();
  const result = await coordinate(f, 'claim');
  assert.equal(result.claim.base_sha, sha);
  assert.equal(result.receipt.previous_record_sha, sha);
  assert.equal(result.record_sha, newSha);
  assert.equal(result.receipt.commit_sha, 'c'.repeat(40));
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].body.sha, sha);
  assert.equal(f.writes[0].body.branch, 'main');
});
test('held and expired reservations deny overlapping paths and semantic resources', async () => {
  for (const c of [claim({ id: 'existing', owner: 'other', branch: 'relay/other', state: 'held' }), claim({ id: 'existing', owner: 'other', branch: 'relay/other', lease_until: '2000-01-01' })]) {
    const f = fixture({ claims: [c] });
    await assert.rejects(coordinate(f, 'claim'), /Ownership overlaps/);
    await assert.rejects(coordinate(f, 'claim', { ...defaultRequest, paths: ['other/file'] }), /Ownership overlaps/);
    assert.equal(f.writes.length, 0);
  }
});
test('owner cannot take another claim; branch budget and duplicate identities enforced', async () => {
  const f = fixture({ claims: [claim({ owner: 'other' })] });
  await assert.rejects(coordinate(f, 'heartbeat', { id: 'task', owner: 'worker', next_action: 'Renew' }), /another owner/);
  const full = fixture({ claims: Array.from({ length: 4 }, (_, i) => claim({ id: `existing-${i}`, owner: `owner-${i}`, branch: `relay/${i}`, paths: [`other-${i}/`], resources: [] })) });
  await assert.rejects(coordinate(full, 'claim'), /budget reached/);
  const duplicate = fixture({ claims: [claim()] });
  await assert.rejects(coordinate(duplicate, 'claim'), /already exists/);
});
test('stale revision and concurrent CAS conflict never automatically resubmit', async () => {
  const stale = fixture();
  await assert.rejects(coordinate(stale, 'claim', defaultRequest, newSha), /Record changed/);
  assert.equal(stale.writes.length, 0);
  const race = fixture({ conflict: true });
  await assert.rejects(coordinate(race, 'claim'), error => error.code === 'conflict');
  assert.equal(race.writes.length, 1);
});
test('timeout after successful write is reconciled through exact readback without duplicate write', async () => {
  const f = fixture({ timeout: true });
  const result = await coordinate(f, 'claim');
  assert.equal(result.ok, true);
  assert.equal(result.receipt.reconciled_after_transport_error, true);
  assert.equal(f.writes.length, 1);
  await assert.rejects(coordinate(f, 'claim'), /Record changed/);
  assert.equal(f.writes.length, 1);
});
test('unavailable readback reports uncertainty instead of success or retry', async () => {
  const f = fixture({ timeout: true, readbackUnavailable: true });
  await assert.rejects(coordinate(f, 'claim'), error => error.code === 'uncertain_write');
  assert.equal(f.writes.length, 1);
});
test('unconfirmed coordinator writes retain bounded provider facts without changing uncertainty or replay policy', async () => {
  for (const status of [401, 403, 429, 500]) {
    const writeError = Object.assign(new Error('Bearer private-token raw provider body'), { status,
      github: { provider: 'github', status, method: 'PUT', endpoint: '/repos/lrnolivia/relay/contents/coordination/relay.json', phase: 'resource_request', auth_mode: 'github_app_installation', installation_id: 123, rate_limit_remaining: 0, retry_after_seconds: 60, token: 'private-token', headers: { authorization: 'Bearer private-token' } } });
    const f = fixture({ claims: [claim()], writeError });
    await assert.rejects(coordinate(f, 'rescope', { id: 'task', owner: 'worker', paths: ['src/', 'apps/web/vite.config.ts'], resources: ['relay-control'], next_action: 'Verify scope' }), error => {
      const result = runnerControlError(error);
      assert.equal(result.error.class, 'uncertain_write');
      assert.equal(result.error.record_sha, sha);
      assert.equal(result.error.retryable, false);
      assert.match(result.error.recovery, /never replay blindly/);
      assert.equal(result.error.upstream.status, status);
      assert.equal(result.error.upstream.method, 'PUT');
      assert.equal(result.error.upstream.retry_after_seconds, 60);
      assert.equal(result.error.upstream.auth_mode, 'github_app_installation');
      assert.doesNotMatch(JSON.stringify(result), /private-token|authorization|raw provider body/);
      return true;
    });
    assert.equal(f.writes.length, 1);assert.deepEqual(f.record.claims[0].paths, ['src/']);
    const read = await callRunnerControl('relay_runner_assignments', { project: 'relay' }, {}, f.api);
    assert.equal(read.ok, true);assert.equal(read.error, undefined);
  }
});
test('transport-only write failures do not invent an HTTP status or expose arbitrary exception text', async () => {
  const writeError=Object.assign(new Error('Private timeout detail'), { name:'TimeoutError',github:{provider:'github',method:'PUT',endpoint:'/repos/lrnolivia/relay/contents/coordination/relay.json',phase:'resource_request',auth_mode:'github_app_installation'} });
  const f=fixture({writeError});
  await assert.rejects(coordinate(f,'claim'),error=>{
    const result=runnerControlError(error);assert.equal(result.error.class,'uncertain_write');assert.equal(result.error.upstream.status,undefined);assert.doesNotMatch(JSON.stringify(result),/Private timeout/);return true;
  });
  assert.equal(f.writes.length,1);
});
test('verified matching readback wins over captured write diagnostics without a duplicate mutation', async () => {
  const f=fixture();
  const api=async(path,options)=>{
    const value=await f.api(path,options);
    if(options?.method==='PUT')throw Object.assign(new Error('Response lost after write'),{status:500,github:{provider:'github',status:500,method:'PUT',endpoint:'/repos/lrnolivia/relay/contents/coordination/relay.json',phase:'resource_request',auth_mode:'github_app_installation'}});
    return value;
  };
  const result=await callRunnerControl('relay_runner_coordinate',{project:'relay',action:'claim',request:defaultRequest,expected_record_sha:sha},{},api);
  assert.equal(result.ok,true);assert.equal(result.receipt.reconciled_after_transport_error,true);assert.equal(result.error,undefined);assert.equal(f.writes.length,1);
});
test('changed canonical engine fails closed before write', async () => {
  const f = fixture({ engineSha: newSha });
  await assert.rejects(coordinate(f, 'claim'), error => error.code === 'policy_drift');
  assert.equal(f.writes.length, 0);
});
test('existing and frozen legacy branches cannot be repurposed as new admission', async () => {
  const f = fixture({ branches: [{ name: defaultRequest.branch }] });
  await assert.rejects(coordinate(f, 'claim'), /precede branch/);
  const legacy = fixture();
  await assert.rejects(coordinate(legacy, 'claim', { ...defaultRequest, branch: 'old-task' }), /reserved/);
});
test('completion uses provider merged identity and denies unmerged or wrong branch', async () => {
  const request = { id: 'task', owner: 'worker', pr: 9, evidence: 'https://github.com/lrnolivia/relay/pull/9', work_accounted: true };
  const pr = { merged: true, base: { ref: 'main', repo: { full_name: 'lrnolivia/relay' } }, head: { ref: defaultRequest.branch, sha, repo: { full_name: 'lrnolivia/relay' } }, merge_commit_sha: newSha };
  const f = fixture({ claims: [claim()], pr });
  const result = await coordinate(f, 'complete', request);
  assert.equal(result.claim.state, 'completed');
  assert.equal(result.claim.merge_commit_sha, newSha);
  const wrong = fixture({ claims: [claim()], pr: { ...pr, head: { ...pr.head, ref: 'wrong' } } });
  await assert.rejects(coordinate(wrong, 'complete', request), /claimed same-repository PR/);
  assert.equal(wrong.writes.length, 0);
  const notMerged = fixture({ claims: [claim()] });
  await assert.rejects(coordinate(notMerged, 'complete', request), /claimed same-repository PR/);
});
test('preflight requires current owner, active lease and complete scoped paths', async () => {
  const args = { project: 'relay', id: 'task', owner: 'worker', paths: ['src/index.js'] };
  const f = fixture({ claims: [claim()], branches: [{ name: defaultRequest.branch }] });
  assert.equal((await callRunnerControl('relay_runner_preflight', args, {}, f.api)).admitted, 'task');
  await assert.rejects(callRunnerControl('relay_runner_preflight', { ...args, paths: ['other/file'] }, {}, f.api), /exceed/);
  const expired = fixture({ claims: [claim({ lease_until: '2000-01-01' })] });
  await assert.rejects(callRunnerControl('relay_runner_preflight', args, {}, expired.api), /live active/);
});
test('assignment lookup tells the truth about held and expired owner reservation', async () => {
  const f = fixture({ claims: [claim({ state: 'held', lease_until: '2000-01-01' })] });
  const result = await callRunnerControl('relay_runner_assignments', { project: 'relay', assignment: 'task' }, {}, f.api);
  assert.equal(result.claims[0].reserved, true);
  assert.equal(result.claims[0].lease_expired, true);
});
test('provider failure classification never echoes provider secrets', () => {
  const result = runnerControlError(Object.assign(new Error('token secret'), { status: 403 }));
  assert.equal(result.error.class, 'permission');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('Runner exposes allowlisted upstream provenance and distinguishes evidenced GitHub rate limits', () => {
  const input = Object.assign(new Error('token secret'), { status: 403, code: 'rate_limit', github: {
    provider: 'github', status: 403, method: 'GET', endpoint: '/repos/lrnolivia/fixture/git/ref/heads/task',
    phase: 'resource_request', auth_mode: 'github_app_installation', rate_limit_remaining: 0, retry_after_seconds: 60,
    Authorization: 'secret', body: 'secret', unknown: 'secret'
  } });
  const result = runnerControlError(input);
  assert.equal(result.error.class, 'rate_limit'); assert.equal(result.error.retryable, false);
  assert.equal(result.error.upstream.status, 403);
  assert.equal(result.error.upstream.phase, 'resource_request');
  assert.equal(result.error.upstream.retry_after_seconds, 60);
  assert.match(result.error.recovery, /existing local Git\/gh/);
  assert.match(result.error.recovery, /canonical policy, ownership and admission/);
  assert.match(result.error.recovery, /supported CAS operation/);
  assert.match(result.error.recovery, /do not bypass authentication, permission or approval denials/);
  assert.match(result.error.recovery, /account-wide quota/);
  assert.doesNotMatch(runnerControlError(Object.assign(new Error('hidden'), {status:403})).error.recovery, /another already-authorized transport/);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(runnerControlError(Object.assign(new Error('hidden'), { github: { ...input.github, endpoint: '/path?secret=query' } })).error.upstream.endpoint, undefined);
});


test('Runner control authority is configurable for Relay migration and validates owner scope', async () => {
  const f = fixture();
  const env = { RELAY_RUNNER_CONTROL_REPOSITORY: 'lrnolivia/relay' };
  const result = await callRunnerControl('relay_runner_project', { project: 'relay' }, env, f.api);
  assert.equal(result.ok, true);
  assert.ok(f.calls.some(path => path.startsWith('/repos/lrnolivia/relay/contents/projects/relay.json')));
  assert.equal(runnerControlRepository(env), 'lrnolivia/relay');
  assert.throws(
    () => runnerControlRepository({ RELAY_RUNNER_CONTROL_REPOSITORY: 'other/relay' }),
    /Invalid Runner control repository binding/
  );
});


test('claim and amend persist canonical taxonomy metadata', async () => {
  const f = fixture();
  const claimed = await coordinate(f, 'claim', {
    ...defaultRequest,
    category: 'architecture',
    labels: [{ key: 'area', value: 'Runner' }],
    tags: ['recovery'],
    primary_role: 'architect',
    supporting_roles: ['verifier']
  });
  assert.equal(claimed.claim.category, 'architecture');
  assert.deepEqual(claimed.claim.labels, [{ key: 'area', value: 'Runner' }]);
  assert.deepEqual(claimed.claim.tags, ['recovery']);
  assert.equal(claimed.claim.primary_role, 'architect');
  assert.deepEqual(claimed.claim.supporting_roles, ['verifier']);

  const amended = await coordinate(f, 'amend', {
    id: 'task',
    owner: 'worker',
    reason: 'route verification work',
    category: 'qa-verification',
    tags: ['verification'],
    primary_role: 'verifier',
    supporting_roles: [],
    primary_staff: 'roman',
    supporting_staff: []
  }, newSha);
  assert.equal(amended.assignment.category, 'qa-verification');
  assert.deepEqual(amended.assignment.tags, ['verification']);
  assert.equal(amended.assignment.primary_role, 'verifier');
  assert.equal(amended.assignment.amendment_count, 1);
  assert.deepEqual(amended.assignment.amendments[0].fields, ['category', 'tags', 'primary_role', 'supporting_roles', 'primary_staff', 'supporting_staff']);
});

test('staff is canonical across queue claim amend and handoff, without staff authorization', async () => {
  const f=fixture();
  const {branch,...queueRequest}=defaultRequest;
  const queued=await coordinate(f,'queue',{...queueRequest,primary_role:'coordinator',supporting_roles:['verifier'],primary_staff:'Julian',supporting_staff:['Roman']});
  assert.equal(queued.assignment.primary_staff,'julian');
  const claimed=await coordinate(f,'claim',defaultRequest,newSha);
  assert.equal(claimed.assignment.primary_staff,'julian');
  assert.deepEqual(claimed.assignment.supporting_staff,['roman']);
  const amended=await coordinate(f,'amend',{id:'task',owner:'worker',primary_staff:'Julian',supporting_staff:[],reason:'Verifier finished this phase'},newSha);
  assert.deepEqual(amended.assignment.amendments[0].before.supporting_staff,['roman']);
  assert.deepEqual(amended.assignment.amendments[0].after.supporting_staff,[]);
  await assert.rejects(coordinate(f,'amend',{id:'task',owner:'julian',goal:'Take over',reason:'Staff name is not ownership'},newSha),/another owner/);
  const handed=await coordinate(f,'handoff',{id:'task',owner:'worker',successor:'successor-machine',next_action:'Resume the same team'},newSha);
  assert.equal(handed.claim.owner,'successor-machine');
  assert.equal(handed.claim.primary_staff,'julian');
  assert.equal(handed.claim.branch,defaultRequest.branch);
});

const retirement = (extra = {}) => ({ id: 'task', owner: 'worker', disposition: 'cancelled', reason: 'Experiment abandoned', evidence: 'Writers stopped; branch and PR retained', operation_id: 'retire-task-1', expected_head_sha: sha, ...extra });
test('retire verifies branch head and record CAS, with exact readback and idempotent replay', async () => {
  const f = fixture({ claims: [claim({ state: 'held' })], timeout: true });
  const result = await coordinate(f, 'retire', retirement());
  assert.equal(result.assignment.state, 'cancelled');
  assert.equal(result.receipt.reconciled_after_transport_error, true);
  assert.equal(f.writes[0].body.sha, sha);
  const replay = await coordinate(f, 'retire', retirement(), newSha);
  assert.equal(replay.receipt.replayed, true);
  assert.deepEqual(replay.assignment.retirement, result.assignment.retirement);
  assert.equal(f.writes.length, 1);
  await assert.rejects(coordinate(f, 'retire', retirement({ reason: 'Different' }), newSha), /different intent/);
  await assert.rejects(coordinate(f, 'heartbeat', { id: 'task', owner: 'worker', next_action: 'Resume' }, newSha), /active claim/);
});
test('retire treats only confirmed 404 as absent and never accepts caller-verified heads', async () => {
  const absent = fixture({ claims: [claim()], headError: 404 });
  assert.equal((await coordinate(absent, 'retire', retirement({ expected_head_sha: null }))).assignment.state, 'cancelled');
  for (const options of [{ head: newSha }, { headError: 403 }, { headError: 500 }]) {
    const f = fixture({ claims: [claim()], ...options });
    await assert.rejects(coordinate(f, 'retire', retirement()));
    assert.equal(f.writes.length, 0);
  }
  const f = fixture({ claims: [claim()] });
  await assert.rejects(coordinate(f, 'retire', retirement({ verified_head_sha: sha })), /unsupported/);
  await assert.rejects(coordinate(f, 'retire', retirement({ owner: 'someone-else' })), /owner/);
  await assert.rejects(coordinate(f, 'retire', retirement(), newSha), /Record changed/);
  assert.equal(f.writes.length, 0);
});

test('retirement requests authenticated lookup and rejects acquisition/public404 with zero writes', async () => {
  for (const github of [
    { phase: 'installation_discovery', auth_mode: 'github_app_jwt' },
    { phase: 'token_mint', auth_mode: 'github_app_jwt' },
    { phase: 'resource_request', auth_mode: 'public_read' }
  ]) {
    const f = fixture({ claims: [claim()], headError: 404, headGithub: github });
    await assert.rejects(coordinate(f, 'retire', retirement({ expected_head_sha: null })));
    assert.equal(f.writes.length, 0);
  }
  const f = fixture({ claims: [claim()], headError: 404, headGithub: { phase: 'resource_request', auth_mode: 'github_app_installation' } });
  const api = async (path, options) => {
    if (path.includes('/git/ref/heads/relay%2Ftask')) assert.equal(options.requireAuthenticated, true);
    return f.api(path, options);
  };
  const result = await callRunnerControl('relay_runner_coordinate', { project: 'relay', action: 'retire', expected_record_sha: sha,
    request: retirement({ expected_head_sha: null }) }, {}, api);
  assert.equal(result.assignment.state, 'cancelled'); assert.equal(f.writes.length, 1);
});
test('retire preserves drift and conflict guards and reports uncertain readback without retry', async () => {
  for (const [options, code, writes] of [[{ engineSha: newSha }, 'policy_drift', 0], [{ conflict: true }, 'conflict', 1], [{ readbackUnavailable: true, timeout: true }, 'uncertain_write', 1]]) {
    const f = fixture({ claims: [claim()], ...options });
    await assert.rejects(coordinate(f, 'retire', retirement()), error => error.code === code);
    assert.equal(f.writes.length, writes);
  }
});
test('queued retirement makes no branch request and returns its terminal assignment', async () => {
  const f = fixture({ queue: [{ id: 'task', owner: 'worker', state: 'queued', goal: 'Keep intent' }] });
  const { expected_head_sha, ...request } = retirement();
  const result = await coordinate(f, 'retire', request);
  assert.equal(result.assignment.goal, 'Keep intent');
  assert.equal(result.assignment.state, 'cancelled');
  assert.equal(f.calls.some(path => path.includes('/git/ref/')), false);
});

const completedClaim = () => claim({ state: 'completed', pr: 9, merged_head_sha: sha, merge_commit_sha: newSha, work_accounted: true, evidence: 'Merged slice, physical QA deferred', completed_at: '2026-10-01T00:00:00Z' });
const mergedLifecyclePr = () => ({ merged: true, base: { ref: 'main', repo: { full_name: 'lrnolivia/relay' } }, head: { ref: defaultRequest.branch, sha, repo: { full_name: 'lrnolivia/relay' } }, merge_commit_sha: newSha });
const reconcileRequest = { id: 'task', owner: 'worker', pr: 9 };
const reconciliationFixture = (overrides = {}) => fixture({ claims: [completedClaim()], queue: [{ ...defaultRequest, state: 'claimed', acceptance: 'Original full acceptance', amendments: [{ reason: 'Retained' }] }], pr: mergedLifecyclePr(), ...overrides });
test('reconcile verifies original provider identity and preserves both records with no-write replay', async () => {
  const f = reconciliationFixture({ timeout: true });
  const before = structuredClone(f.record);
  const result = await coordinate(f, 'reconcile', reconcileRequest);
  assert.equal(result.receipt.reconciled_after_transport_error, true);
  assert.equal(result.assignment.state, 'completed');
  assert.equal(f.record.queue[0].state, 'completed');
  assert.deepEqual(f.record.claims, before.claims);
  assert.equal(f.record.queue[0].acceptance, before.queue[0].acceptance);
  assert.deepEqual(f.record.queue[0].amendments, before.queue[0].amendments);
  const replay = await coordinate(f, 'reconcile', reconcileRequest, newSha);
  assert.equal(replay.receipt.replayed, true);
  assert.equal(f.writes.length, 1);
});
test('reconcile rejects unmerged or changed provenance, ownership and stale CAS with zero writes', async () => {
  const pr = mergedLifecyclePr();
  for (const overrides of [
    { pr: { ...pr, merged: false } }, { pr: { ...pr, merge_commit_sha: sha } },
    { pr: { ...pr, head: { ...pr.head, sha: newSha } } },
    { pr: { ...pr, head: { ...pr.head, ref: 'relay/other' } } },
    { pr: { ...pr, head: { ...pr.head, repo: { full_name: 'another/repo' } } } },
    { claims: [claim()] }, { queue: [{ ...defaultRequest, owner: 'old-owner', state: 'claimed' }] },
    { engineSha: newSha }
  ]) {
    const f = reconciliationFixture(overrides);
    await assert.rejects(coordinate(f, 'reconcile', reconcileRequest));
    assert.equal(f.writes.length, 0);
  }
  const f = reconciliationFixture();
  await assert.rejects(coordinate(f, 'reconcile', reconcileRequest, newSha), /Record changed/);
  await assert.rejects(coordinate(f, 'reconcile', { ...reconcileRequest, owner: 'other' }));
  await assert.rejects(coordinate(f, 'reconcile', { ...reconcileRequest, merged_head_sha: sha }), /unsupported/);
  assert.equal(f.writes.length, 0);
});
test('reconcile CAS conflicts and uncertain readback never retry writes', async () => {
  for (const [overrides, code] of [[{ conflict: true }, 'conflict'], [{ readbackUnavailable: true }, 'uncertain_write']]) {
    const f = reconciliationFixture(overrides);
    await assert.rejects(coordinate(f, 'reconcile', reconcileRequest), error => error.code === code);
    assert.equal(f.writes.length, 1);
  }
});
test('queued handoff returns actual assignment without branches, PRs or an execution claim', async () => {
  const f = fixture({ queue: [{ ...defaultRequest, state: 'queued', acceptance: 'Full scope' }] });
  const result = await coordinate(f, 'handoff', { id: 'task', owner: 'worker', successor: 'actual-chat', next_action: 'Read full scope and claim when admitted' });
  assert.equal(result.assignment.owner, 'actual-chat');
  assert.equal(result.assignment.state, 'queued');
  assert.equal(result.assignment.acceptance, 'Full scope');
  assert.equal(f.record.claims.length, 0);
  assert.equal(f.calls.some(path => /\/branches|\/pulls|\/git\/ref/.test(path)), false);
  await assert.rejects(coordinate(f, 'handoff', { id: 'task', owner: 'worker', successor: 'other', next_action: 'Steal' }, newSha), /another owner/);
});

test('large coordination reads resolve an immutable verified blob without changing ownership gates', async () => {
  const f=fixture({claims:[claim()]});
  const bytes=Buffer.from(JSON.stringify({...f.record,padding:'x'.repeat(1024*1024)}));
  const digest=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const contents={type:'file',sha:digest,size:bytes.length,encoding:'none',content:''};
  const blob={sha:digest,size:bytes.length,encoding:'base64',content:bytes.toString('base64')};
  const api=async(path,options)=>path.includes('/contents/coordination/relay.json')?contents:path.endsWith('/git/blobs/'+digest)?blob:f.api(path,options);
  const read=await callRunnerControl('relay_runner_assignments',{project:'relay'}, {},api);
  assert.equal(read.record_sha,digest);
  assert.equal(read.claims[0].owner,'worker');
  const request={project:'relay',id:'task',owner:'worker',paths:['src/a.js']};
  assert.equal((await callRunnerControl('relay_runner_preflight',request,{},api)).admitted,'task');
  await assert.rejects(callRunnerControl('relay_runner_preflight',{...request,owner:'intruder'}, {},api),/live active owner/);
  await assert.rejects(callRunnerControl('relay_runner_preflight',{...request,paths:['elsewhere/a.js']}, {},api),/exceed the claim/);
  assert.equal(f.writes.length,0);
  for (const bad of [{...blob,content:Buffer.from('wrong').toString('base64')},{...blob,sha:'0'.repeat(40)},{...blob,truncated:true},{...blob,size:1}]) {
    const broken=async(path,options)=>path.endsWith('/git/blobs/'+digest)?bad:api(path,options);
    await assert.rejects(callRunnerControl('relay_runner_assignments',{project:'relay'}, {},broken),/blob/);
  }
});
