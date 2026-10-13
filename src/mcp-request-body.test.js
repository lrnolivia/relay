import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import worker from "./relay-entry.js";

test("complete source payloads over 16 KB reach guarded tool validation in both entry paths", async t => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "source-body-limit";
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = encode({ alg: "RS256", kid }) + "." + encode({
    iss: "https://loewfi.cloudflareaccess.com",
    aud: ["7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819"],
    exp: Math.floor(Date.now() / 1000) + 600
  });
  const token = payload + "." + sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64url");
  let providerCalls = 0;
  t.mock.method(globalThis, "fetch", async url => {
    if (String(url) === "https://loewfi.cloudflareaccess.com/cdn-cgi/access/certs") {
      return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid }] });
    }
    providerCalls++;
    throw new Error("No external writes allowed in this regression");
  });
  for (const name of ["relay_source_commit_files", "relay_source_edit_text"]) {
    const response = await worker.fetch(new Request("https://relay.loew.fi/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-access-jwt-assertion": token },
      body: JSON.stringify({ jsonrpc: "2.0", id: name, method: "tools/call",
        params: { name, arguments: { content: "x".repeat(40000) } } })
    }), {});
    assert.equal(response.status, 200, name + " must reach the existing argument validator");
    const body = await response.json();
    assert.equal(body.result?.isError, true, "invalid write arguments remain refused");
  }
  const malformed = await worker.fetch(new Request("https://relay.loew.fi/mcp", {
    method: "POST", headers: { "content-type": "application/json", "cf-access-jwt-assertion": token }, body: "{"
  }), {});
  assert.equal((await malformed.json()).error.code, -32700);
  assert.equal(providerCalls, 0);
});

import { MAX_MCP_REQUEST_BYTES as LIMIT, readMcpBody, mcpBodyErrorResponse } from "./mcp-request-body.js";
function request(body, headers = {}) {
  return new Request("https://relay.loew.fi/mcp", {
    method: "POST", headers: { "content-type": "application/json", ...headers },
    body, ...(body instanceof ReadableStream ? { duplex: "half" } : {})
  });
}
test("body reader accepts exact byte ceiling and caches the consumed body", async () => {
  const input = "x".repeat(LIMIT);
  const req = request(input);
  assert.equal(await readMcpBody(req), input);
  assert.equal(await readMcpBody(req), input);
});
test("declared oversize rejects before reading and cancels stream", async () => {
  let read = false, cancelled = false;
  const body = new ReadableStream({ pull() { read = true; }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  await assert.rejects(readMcpBody(request(body, { "content-length": String(LIMIT + 1) })), { status: 413 });
  assert.equal(read, false);
  assert.equal(cancelled, true);
});
test("missing or false small length cannot bypass actual byte ceiling", async () => {
  for (const headers of [{}, { "content-length": "1" }]) {
    let count = 0, cancelled = false;
    const body = new ReadableStream({
      pull(controller) { count++; controller.enqueue(new Uint8Array(65536)); },
      cancel() { cancelled = true; }
    }, { highWaterMark: 0 });
    await assert.rejects(readMcpBody(request(body, headers)), { status: 413 });
    assert.equal(count, LIMIT / 65536 + 1);
    assert.equal(cancelled, true);
  }
});
test("UTF-8 uses byte sizes and preserves characters split across chunks", async () => {
  const bytes = new TextEncoder().encode("A😀éZ");
  const body = new ReadableStream({
    start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); }
  });
  assert.equal(await readMcpBody(request(body)), "A😀éZ");
  await assert.rejects(readMcpBody(request("é".repeat(LIMIT / 2 + 1))), { status: 413 });
});
test("invalid UTF-8 and broken streams fail without partial results", async () => {
  const invalid = new ReadableStream({ start(c) { c.enqueue(Uint8Array.of(0xff)); c.close(); } });
  await assert.rejects(readMcpBody(request(invalid)), { status: 400 });
  const broken = new ReadableStream({ pull(c) { c.error(new Error("broken stream")); } });
  await assert.rejects(readMcpBody(request(broken)), { status: 400 });
});
test("largest supported source batch with worst-case JSON escaping fits", async () => {
  const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "relay_source_commit_files", arguments: {
      repo: "field", branch: "field/test", expected_head_sha: "a".repeat(40),
      message: "complete source batch", files: [
        { path: "one.txt", content: "\u0000".repeat(500000) },
        { path: "two.txt", content: "\u0000".repeat(500000) }
      ]
    } } });
  assert.ok(new TextEncoder().encode(payload).length > 6000000);
  assert.ok(new TextEncoder().encode(payload).length < LIMIT);
  assert.equal(await readMcpBody(request(payload)), payload);
});
test("oversize endpoint response explains byte ceiling and makes no provider request", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("No provider call expected"); });
  const response = await worker.fetch(request("x", { "content-length": String(LIMIT + 1) }), {});
  assert.equal(response.status, 413);
  const body = await response.json();
  assert.equal(body.max_request_bytes, LIMIT);
  assert.match(body.recovery, /No source write was attempted/);
});
test("in-limit requests still require authentication and malformed JSON stays rejected", async () => {
  const response = await worker.fetch(request(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", padding: "x".repeat(40000) })), {});
  assert.equal(response.status, 401);
  const malformed = await worker.fetch(request("{"), {});
  assert.equal(malformed.status, 401);
});
