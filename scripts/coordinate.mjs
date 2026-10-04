import { createHash } from 'node:crypto';
import { coordinationOutcome } from './coordination-report.mjs';
import fs from 'node:fs/promises';
import { callRunnerControl } from '../src/runner-control.js';
import { execFileSync } from 'node:child_process';
import { transition, evaluate, occupying, retired } from '../src/coordination.mjs';

const [action, project, inputFile] = process.argv.slice(2);
if (!['queue', 'claim', 'rescope', 'heartbeat', 'hold', 'handoff', 'complete', 'retire', 'reconcile', 'audit', 'cleanup', 'preflight', 'pr-gate'].includes(action) || !/^[a-z0-9-]+$/.test(project ?? '')) throw new Error('Usage: node scripts/coordinate.mjs <action> <project> [request.json]');
// gh handles macOS keychain auth locally and GH_TOKEN in Actions; no credential output.
function api(endpoint, method = 'GET', body) {
  const args = ['api', endpoint, '--method', method];
  if (body) args.push('--input', '-');
  const output = execFileSync('gh', args, { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  return output.trim() ? JSON.parse(output) : null;
}
async function pages(endpoint) {
  const result = [];
  for (let page = 1; ; page++) {
    const items = api(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(items)) throw new Error('Expected a complete paginated inventory.');
    result.push(...items);
    if (items.length < 100) return result;
  }
}
const control = process.env.RELAY_RUNNER_CONTROL_REPOSITORY || 'lrnolivia/relay';
const recordPath = `coordination/${project}.json`;
function read(file) {
  let remote = api(`repos/${control}/contents/${file}?ref=main`);
  if (remote?.type === 'file' && remote.encoding === 'none' && !remote.truncated &&
      /^[a-f0-9]{40}$/.test(remote.sha) && Number.isSafeInteger(remote.size) &&
      remote.size > 0 && remote.size <= 8 * 1024 * 1024) {
    const blob = api(`repos/${control}/git/blobs/${remote.sha}`);
    if (blob?.encoding !== 'base64' || blob.sha !== remote.sha || blob.truncated ||
        typeof blob.content !== 'string' || blob.content.length > 12 * 1024 * 1024) throw new Error('Runner blob response is incomplete');
    const bytes = Buffer.from(blob.content.replace(/\s/g, ''), 'base64');
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (bytes.length !== remote.size || blob.size !== remote.size || hash !== remote.sha) throw new Error('Runner blob identity verification failed');
    remote = { ...remote, encoding: 'base64', content: blob.content };
  }
  if (remote?.type !== 'file' || remote.encoding !== 'base64' || !remote.sha || remote.truncated) throw new Error('Runner file response is incomplete');
  return { sha: remote.sha, value: JSON.parse(Buffer.from(remote.content, 'base64').toString('utf8')) };
}
const registration = read(`projects/${project}.json`).value;
const policy = { ...registration.coordination, repository: registration.repository,
  branch_prefixes: registration.implementation.branch_prefixes,
  excluded_branches: registration.implementation.excluded_branches };
if (!Number.isInteger(policy.max_active_branches) || !policy.lease_hours) throw new Error('Project has no enabled coordination policy.');
function save(snapshot, value) {
  return api(`repos/${control}/contents/${recordPath}`, 'PUT', {
    branch: 'main', sha: snapshot.sha, message: `coordination: ${action} ${project}`,
    content: Buffer.from(`${JSON.stringify(value, null, 2)}\n`).toString('base64')
  });
}
function mergedProof(claim, number) {
  const pr = api(`repos/${policy.repository}/pulls/${number}`);
  if (!pr.merged || pr.base.ref !== registration.default_branch || pr.base.repo.full_name !== policy.repository || pr.head.repo?.full_name !== policy.repository || pr.head.ref !== claim.branch) throw new Error('PR is not merged into the registered main from the claimed branch.');
  return pr;
}

if (['retire', 'reconcile', 'handoff', 'complete'].includes(action)) {
  if (!inputFile) throw new Error('A JSON lifecycle request file is required.');
  const { expected_record_sha, ...request } = JSON.parse(await fs.readFile(inputFile, 'utf8'));
  if (!/^[a-f0-9]{40}$/.test(expected_record_sha || '')) throw new Error('Lifecycle mutation requires expected_record_sha.');
  const receipt = await callRunnerControl('relay_runner_coordinate', {
    project, action, expected_record_sha, request
  }, process.env, async (path, options) => {
    try { return api(path.replace(/^\//, ''), options?.method || 'GET', options?.body); }
    catch (error) {
      const status = /HTTP (\d{3})/.exec(error.stderr?.toString() || '');
      if (status) error.status = Number(status[1]);
      throw error;
    }
  });
  console.log(JSON.stringify(receipt, null, 2));
} else if (['queue', 'claim', 'rescope', 'heartbeat', 'hold'].includes(action)) {
  if (!inputFile) throw new Error('A JSON request file is required.');
  const request = JSON.parse(await fs.readFile(inputFile, 'utf8'));
  request.action = action;
  if (action === 'claim') {
    request.base_sha = api(`repos/${policy.repository}/git/ref/heads/${registration.default_branch}`).object.sha;
    // Existing historical branches are recovered through an explicit migration, never repurposed by a new claim.
    if (read(recordPath).value.legacy_branches.includes(request.branch)) throw new Error('Historical branch is reserved for recovery; resume its owner or use a fresh bounded task.');
    if ((await pages(`repos/${policy.repository}/branches`)).some((b) => b.name === request.branch)) throw new Error('New-task admission must precede branch creation. Reconcile an existing unregistered branch first.');
  }
  // SHA compare-and-swap: two simultaneous acquisitions cannot both win.
  for (let attempt = 0; attempt < 2; attempt++) {
    const snapshot = read(recordPath);
    const next = transition(snapshot.value, request, policy);
    try {
      save(snapshot, next);
    } catch (error) {
      if (attempt === 0 && /HTTP (409|422)/.test(error.stderr?.toString() ?? '')) continue;
      throw error;
    }
    const collection = action === 'queue' ? 'queue' : 'claims';
    const verified = read(recordPath).value[collection].find((c) => c.id === request.id);
    const expected = next[collection].find((c) => c.id === request.id);
    if (verified?.owner !== expected?.owner || verified?.state !== expected?.state) throw new Error('Post-write verification failed. Refresh before editing.');
    console.log(JSON.stringify({ ok: true, claim: verified }, null, 2));
    break;
  }
} else if (action === 'pr-gate') {
  const request = JSON.parse(await fs.readFile(inputFile, 'utf8'));
  if (!Number.isInteger(request.pr) || request.pr < 1) throw new Error('PR number is required.');
  const pr = api(`repos/${policy.repository}/pulls/${request.pr}`);
  const record = read(recordPath).value;
  if (pr.base.ref !== registration.default_branch || pr.head.repo?.full_name !== policy.repository) throw new Error('Admission requires a registered same-repository task targeting main.');
  const claim = record.claims.find((c) => c.branch === pr.head.ref && occupying(c));
  if (!claim && record.legacy_branches.includes(pr.head.ref)) {
    console.log(JSON.stringify({ ok: true, legacy_recovery: true, pr: pr.number, sha: pr.head.sha, note: 'Frozen recovery inventory exemption; existing consolidation and QA policy still applies.' }, null, 2));
  } else {
    if (!claim || claim.state !== 'active' || new Date(claim.lease_until) <= new Date()) throw new Error('PR has no live active Runner claim. Acquire/renew ownership before publication.');
    pr.files = (await pages(`repos/${policy.repository}/pulls/${pr.number}/files`)).map((f) => f.filename);
    const findings = evaluate(record, policy, [{ name: claim.branch }], [pr]);
    const blockers = findings.filter((f) => f.type === 'budget' || f.assignment === claim.id || f.assignments?.includes(claim.id));
    if (blockers.length) throw new Error(`Admission failed: ${JSON.stringify(blockers)}`);
    console.log(JSON.stringify({ ok: true, assignment: claim.id, owner: claim.owner, pr: pr.number, sha: pr.head.sha }, null, 2));
  }
} else {
  const snapshot = read(recordPath);
  const branches = await pages(`repos/${policy.repository}/branches`);
  const prs = await pages(`repos/${policy.repository}/pulls?state=open`);
  for (const pr of prs) pr.files = (await pages(`repos/${policy.repository}/pulls/${pr.number}/files`)).map((f) => f.filename);
  const findings = evaluate(snapshot.value, policy, branches, prs);
  const report = { project, checked_at: new Date().toISOString(), active: snapshot.value.claims.filter(occupying).length,
    budget: policy.max_active_branches, total_branches: branches.length, legacy_branches: snapshot.value.legacy_branches.length, findings };
  if (action === 'preflight') {
    if (!inputFile) throw new Error('Preflight requires a request with id, owner and current changed paths.');
    const request = JSON.parse(await fs.readFile(inputFile, 'utf8'));
    const claim = snapshot.value.claims.find((c) => c.id === request.id && c.owner === request.owner && occupying(c));
    if (!claim || claim.state !== 'active' || new Date(claim.lease_until) <= new Date()) throw new Error('A live active claim is required before edits or publication.');
    if (!Array.isArray(request.paths) || !request.paths.length || request.paths.some((p) => !claim.paths.some((s) => p === s || (s.endsWith('/') && p.startsWith(s))))) throw new Error('Changed paths must be supplied and fit the claim.');
    if (findings.some((f) => f.type === 'budget' || f.assignment === claim.id || f.assignments?.includes(claim.id))) throw new Error('Coordination gate failed. Inspect audit findings before continuing.');
    report.admitted = claim.id;
  }
  if (action === 'cleanup') {
    report.deleted = [];
    for (const claim of snapshot.value.claims.filter((c) => c.state === 'completed' && c.work_accounted)) {
      if (policy.excluded_branches.includes(claim.branch) || snapshot.value.legacy_branches.includes(claim.branch)) continue;
      if (snapshot.value.claims.some((c) => (occupying(c) || retired(c)) && c.branch === claim.branch)) continue;
      if (!branches.some((b) => b.name === claim.branch)) continue;
      const pr = mergedProof(claim, claim.pr);
      if (pr.head.sha !== claim.merged_head_sha || pr.merge_commit_sha !== claim.merge_commit_sha) throw new Error('Merged evidence changed; cleanup stopped.');
      // Re-read ownership and head just before deletion. Protected branches remain protected by GitHub.
      const current = read(recordPath).value;
      const currentClaim = current.claims.find((c) => c.id === claim.id);
      if (!currentClaim || currentClaim.state !== 'completed' || !currentClaim.work_accounted || current.claims.some((c) => (occupying(c) || retired(c)) && c.branch === claim.branch)) throw new Error('Ownership changed; cleanup stopped.');
      const ref = api(`repos/${policy.repository}/git/ref/heads/${encodeURIComponent(claim.branch)}`);
      if (ref.object.sha !== claim.merged_head_sha) { report.findings.push({ type: 'post_merge_commits', branch: claim.branch }); continue; }
      api(`repos/${policy.repository}/git/refs/heads/${encodeURIComponent(claim.branch)}`, 'DELETE');
      if ((await pages(`repos/${policy.repository}/branches`)).some((b) => b.name === claim.branch)) throw new Error('Branch deletion did not verify.');
      report.deleted.push(claim.branch);
    }
  }
  if (['audit', 'cleanup'].includes(action)) {
    const outcome = coordinationOutcome(action, report);
    console.log(JSON.stringify(outcome.report, null, 2));
    process.exitCode = outcome.exitCode;
  } else console.log(JSON.stringify(report, null, 2));
}
