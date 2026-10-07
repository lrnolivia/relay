import test from 'node:test';
import assert from 'node:assert/strict';
import { productionMcpRead } from '../production-mcp-readback.mjs';
import { readback } from '../readback.mjs';

const sha = '1e043b6f2e8d6912846c8c7ec39464bbb1c10823';
const context = { commitSha: sha, headers: { 'CF-Access-Client-Id': 'fixture-id', 'CF-Access-Client-Secret': 'fixture-secret' } };
const manifest = (args = {}) => ({ name: 'relay_source_tree', arguments: { repo: 'relay', commit_sha: sha, limit: 500, ...args } });
const envelope = result => Response.json({ jsonrpc: '2.0', id: 1, result });

test('authenticated discovery and exact-commit pagination use one bounded POST per read', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://relay.loew.fi/mcp');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.get('CF-Access-Client-Id'), 'fixture-id');
    assert.equal(options.headers.get('CF-Access-Client-Secret'), 'fixture-secret');
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    requests.push(JSON.parse(options.body));
    return envelope({ ok: true });
  };
  assert.deepEqual(await productionMcpRead('tools/list', {}, context, { fetcher }), { ok: true });
  await productionMcpRead('tools/call', manifest(), context, { fetcher });
  await productionMcpRead('tools/call', manifest({ cursor: 'opaque-next-page' }), context, { fetcher });
  assert.deepEqual(requests, [
    { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: manifest() },
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: manifest({ cursor: 'opaque-next-page' }) }
  ]);
});

test('mutations, private repositories and unbound commits fail before sending', async () => {
  const fetcher = async () => assert.fail('invalid read must not execute');
  for (const [method, params] of [
    ['notifications/initialized', {}], ['tools/list', { cursor: 'x' }],
    ['tools/call', { ...manifest(), name: 'relay_source_update_file' }],
    ['tools/call', manifest({ repo: 'private-project' })],
    ['tools/call', manifest({ commit_sha: 'a'.repeat(40) })],
    ['tools/call', manifest({ owner: 'another-owner' })],
    ['tools/call', manifest({ limit: 501 })], ['tools/call', manifest({ cursor: '' })],
    ['tools/call', manifest({ cursor: 'x'.repeat(4097) })],
    ['tools/call', { ...manifest(), extra: true }]
  ]) await assert.rejects(productionMcpRead(method, params, context, { fetcher }));
  await assert.rejects(productionMcpRead('tools/list', {}, { ...context, commitSha: 'main' }, { fetcher }));
  await assert.rejects(productionMcpRead('tools/list', {}, { ...context, headers: {} }, { fetcher }));
  await assert.rejects(productionMcpRead('tools/list', {}, context, { fetcher, timeout: 45001 }));
});

test('transport, timeout, body and protocol failures never replay an MCP POST', async () => {
  for (const failure of [
    async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); },
    async () => { throw new DOMException('timeout', 'TimeoutError'); },
    async () => ({ status: 200, json: async () => { throw new Error('body reset'); } }),
    async () => new Response('not json'),
    async () => Response.json({ jsonrpc: '2.0', id: 1, error: { code: -32603 } }),
    async () => Response.json({ jsonrpc: '2.0', id: 2, result: {} }),
    async () => Response.json({ jsonrpc: '1.0', id: 1, result: {} }),
    async () => envelope(null)
  ]) {
    let calls = 0;
    await assert.rejects(productionMcpRead('tools/list', {}, context, { fetcher: async () => { calls++; return failure(); } }));
    assert.equal(calls, 1);
  }
});

test('HTTP denials, redirects and transient failures neither parse nor replay', async () => {
  for (const status of [302, 401, 403, 404, 429, 500, 503]) {
    let calls = 0;
    await assert.rejects(productionMcpRead('tools/list', {}, context, { fetcher: async () => {
      calls++; return { status, json: async () => assert.fail('failed HTTP response must not be parsed') };
    } }));
    assert.equal(calls, 1);
  }
});

test('GET readback still rejects POST and request bodies before fetching', async () => {
  const fetcher = async () => assert.fail('GET helper must not send a POST');
  await assert.rejects(readback('https://relay.loew.fi/mcp', { method: 'POST' }, { fetcher }), /GET only/);
  await assert.rejects(readback('https://relay.loew.fi/mcp', { body: '{}' }, { fetcher }), /request body/);
});
