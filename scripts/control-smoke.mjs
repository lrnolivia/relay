// Authenticated, deterministic Relay control smoke. Credentials stay in Actions env.
import fs from 'node:fs/promises';
const { CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET, COORD_PROJECT: project, COORD_ASSIGNMENT: id, COORD_OWNER: owner } = process.env;
if (!CF_ACCESS_CLIENT_ID || !CF_ACCESS_CLIENT_SECRET || !project) throw new Error('Required smoke configuration unavailable');
const headers = {
  'Content-Type': 'application/json',
  Authorization: JSON.stringify({ 'cf-access-client-id': CF_ACCESS_CLIENT_ID, 'cf-access-client-secret': CF_ACCESS_CLIENT_SECRET }),
  'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': CF_ACCESS_CLIENT_SECRET
};
const results = [];
async function rpc(method, params) {
  const response = await fetch('https://relay.loew.fi/mcp', { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: results.length + 1, method, params }), signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Relay HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error('Relay RPC error');
  return body.result;
}
async function call(name, args, expectedError) {
  const result = await rpc('tools/call', { name, arguments: args });
  const data = result.structuredContent;
  if (expectedError ? (!result.isError || data?.error?.class !== expectedError) : (result.isError || data?.ok !== true)) throw new Error(`Smoke criterion failed: ${name}${expectedError ? ` expected ${expectedError}` : ''}`);
  results.push({ tool: name, expected_error: expectedError || null, result: data });
  return data;
}
try {
  const listing = await rpc('tools/list', {});
  for (const name of ['relay_runner_projects', 'relay_runner_project', 'relay_runner_assignments', 'relay_runner_preflight', 'relay_runner_audit', 'relay_runner_coordinate']) if (!listing.tools?.some(t => t.name === name)) throw new Error(`Discovery missing ${name}`);
  await call('relay_runner_projects', {});
  const state = await call('relay_runner_project', { project });
  await call('relay_runner_assignments', { project });
  await call('relay_runner_audit', { project });
  if (id && owner) {
    const claim = state.coordination.claims.find(c => c.id === id && c.owner === owner && c.state === 'active');
    if (!claim) throw new Error('Requested active smoke assignment is unavailable');
    await call('relay_runner_preflight', { project, id, owner, paths: claim.paths });
    await call('relay_runner_preflight', { project, id, owner, paths: ['outside-admitted-scope'] }, 'scope');
    const refreshed = await call('relay_runner_project', { project });
    const renewed = await call('relay_runner_coordinate', { project, action: 'heartbeat', expected_record_sha: refreshed.record_sha, request: { id, owner, next_action: claim.next_action } });
    if (!renewed.receipt?.record_sha || renewed.claim.owner !== owner) throw new Error('Verified mutation receipt missing');
    await call('relay_runner_coordinate', { project, action: 'heartbeat', expected_record_sha: refreshed.record_sha, request: { id, owner, next_action: claim.next_action } }, 'conflict');
    await call('relay_runner_assignments', { project, assignment: id });
  }
  console.log('RELAY_CONTROL_SMOKE=' + JSON.stringify({ ok: true, project, criteria: results.map(r => ({ tool: r.tool, expected_error: r.expected_error, record_sha: r.result.record_sha || null })) }));
} finally {
  await fs.writeFile(process.env.SMOKE_RESULT_PATH || 'relay-control-smoke.json', JSON.stringify({ project, results, checked_at: new Date().toISOString() }, null, 2));
}
