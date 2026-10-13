import test from 'node:test';
import assert from 'node:assert/strict';
import { callBrowser, classifyResponse, retrySeconds } from './browser-call.mjs';

const rpc = value => JSON.stringify({ result: { structuredContent: value } });
const body = name => JSON.stringify({ id: 'test-request', params: { name } });
const reply = (status, text, retry = null) => ({ status, text: async () => text, headers: { get: () => retry } });

test('Browser Run capacity remains deferred, unverified, with retry and fallback metadata', () => {
  const result = classifyResponse(200, rpc({ ok: false, status: 'deferred', reason: 'browser_capacity', retry_after: 7574, fallback_engine: 'github-chromium' }));
  assert.equal(result.status, 'deferred');
  assert.equal(result.ok, false);
  assert.equal(result.qa_passed, false);
  assert.equal(result.retry_after, 7574);
  assert.equal(result.fallback_engine, 'github-chromium');
});

test('auth, assertions, RPC errors, malformed success, and contradictory results remain failures', () => {
  for (const [status, text] of [[403, '{}'], [200, rpc({ ok: false, reason: 'assertion' })], [200, '{'], [200, JSON.stringify({ error: { code: -1 } })], [200, rpc({ ok: true, status: 'failed' })], [200, JSON.stringify({ result: { isError: true, structuredContent: { ok: false, status: 'deferred', reason: 'browser_capacity' } } })]]) {
    assert.equal(classifyResponse(status, text).status, 'failed');
  }
  assert.equal(classifyResponse(200, rpc({ ok: true, screenshot: 'evidence.png' })).status, 'complete');
});

test('HTTP quota and gateway outage preserve numeric or date Retry-After', () => {
  assert.equal(classifyResponse(429, '<html>capacity</html>', '120').retry_after, 120);
  assert.equal(classifyResponse(503, 'Unavailable').status, 'deferred');
  assert.equal(retrySeconds('Tue, 29 Sep 2026 23:00:05 GMT', Date.parse('2026-09-29T23:00:00Z')), 5);
  assert.equal(retrySeconds('-5'), null);
});

test('one gateway retry for a stateless read; no third attempt', async () => {
  let calls = 0; const delays = [];
  const result = await callBrowser(body('browser_snapshot'), { env: {}, fetchImpl: async () => { calls++; return reply(503, 'Unavailable', '3'); }, sleep: async ms => delays.push(ms) });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [3000]);
  assert.equal(result.status, 'deferred');
  assert.equal(result.attempts, 2);
});

test('capacity, long Retry-After, mutations and uncertain writes never replay', async () => {
  for (const [name, status, text, retry] of [['browser_snapshot', 429, '{}', '1'], ['browser_screenshot', 503, '{}', '120'], ['browser_open', 503, '{}', null], ['browser_interact', 503, '{}', null], ['browser_recipe', 503, '{}', null], ['browser_capture', 503, '{}', null], ['browser_close', 503, '{}', null], ['browser_snapshot', 200, rpc({ ok: false, status: 'deferred', reason: 'browser_capacity' }), null]]) {
    let calls = 0;
    await callBrowser(body(name), { env: {}, fetchImpl: async () => { calls++; return reply(status, text, retry); }, sleep: async () => assert.fail('must not wait') });
    assert.equal(calls, 1, name);
  }
  let calls = 0;
  const result = await callBrowser(body('browser_open'), { env: {}, fetchImpl: async () => { calls++; throw Error('secret must not appear'); } });
  assert.equal(calls, 1);
  assert.equal(result.reason, 'transport_unknown_outcome');
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('bounded read retry can recover without hiding a subsequent assertion failure', async () => {
  for (const ok of [true, false]) {
    let calls = 0;
    const result = await callBrowser(body('browser_snapshot'), { env: {}, fetchImpl: async () => ++calls === 1 ? reply(502, '{}') : reply(200, rpc({ ok })), sleep: async () => {} });
    assert.equal(result.status, ok ? 'complete' : 'failed');
    assert.equal(calls, 2);
  }
});
