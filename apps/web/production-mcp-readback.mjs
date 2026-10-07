// Production verification uses POST for these two read-only MCP operations.
// Keep this separate from retryable GET readback: an uncertain POST is never replayed.
import assert from 'node:assert/strict';

const endpoint = 'https://relay.loew.fi/mcp';
const plain = value => value != null && Object.getPrototypeOf(value) === Object.prototype;
const onlyKeys = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));

export async function productionMcpRead(method, params, { headers, commitSha }, { fetcher = fetch, timeout = 45000 } = {}) {
  assert.match(commitSha, /^[a-f0-9]{40}$/, 'verification requires an exact source commit');
  assert.ok(Number.isInteger(timeout) && timeout > 0 && timeout <= 45000, 'verification timeout is bounded');
  if (method === 'tools/list') {
    assert.ok(onlyKeys(params, []), 'discovery accepts no parameters');
  } else {
    assert.equal(method, 'tools/call', 'only discovery and exact public source manifests are permitted');
    assert.ok(onlyKeys(params, ['name', 'arguments']), 'unexpected tool-call fields');
    assert.equal(params.name, 'relay_source_tree', 'only the read-only source manifest tool is permitted');
    const args = params.arguments;
    assert.ok(onlyKeys(args, ['repo', 'commit_sha', 'limit', 'cursor']), 'unexpected source-manifest fields');
    assert.equal(args.repo, 'relay', 'verification reads only the public Relay repository');
    assert.equal(args.commit_sha, commitSha, 'manifest must match the exact verified release');
    if (args.limit !== undefined) assert.ok(Number.isInteger(args.limit) && args.limit >= 1 && args.limit <= 500, 'manifest page size is bounded');
    if (args.cursor !== undefined) assert.ok(typeof args.cursor === 'string' && args.cursor.length > 0 && args.cursor.length <= 4096, 'manifest cursor is bounded');
  }
  const requestHeaders = new Headers(headers);
  assert.ok(requestHeaders.get('CF-Access-Client-Id') && requestHeaders.get('CF-Access-Client-Secret'), 'authenticated verification headers are required');
  requestHeaders.set('Content-Type', 'application/json');
  const response = await fetcher(endpoint, {
    method: 'POST', headers: requestHeaders, redirect: 'error', signal: AbortSignal.timeout(timeout),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  assert.equal(response.status, 200, 'authenticated MCP discovery/read must return HTTP 200');
  const value = await response.json();
  assert.equal(value?.jsonrpc, '2.0', 'MCP response uses JSON-RPC 2.0');
  assert.equal(value?.id, 1, 'MCP response matches this request');
  assert.equal(value?.error, undefined, 'MCP read must not return a protocol error');
  assert.ok(plain(value.result), 'MCP read must return a result object');
  return value.result;
}
