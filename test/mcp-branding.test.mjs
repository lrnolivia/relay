import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { brandInitializeResponse, relayIcon } from "../apps/mcp/branding.js";

const request = (method) => new Request("https://relay.loew.fi/mcp", {
  method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 7, method })
});
const result = { protocolVersion: "2025-03-26", capabilities: { tools: {} },
  serverInfo: { name: "relay", version: "1.6.0" }, instructions: "Existing guidance" };

test("initialize advertises the exact shipped embedded PNG and preserves protocol identity", async () => {
  const response = await brandInitializeResponse(request("initialize"), new Response(
    JSON.stringify({ jsonrpc: "2.0", id: 7, result }),
    { headers: { "Content-Type": "application/json", "Content-Length": "1", "X-Test": "retained" } }
  ));
  const payload = await response.json();
  assert.equal(payload.id, 7);
  assert.deepEqual(payload.result.capabilities, result.capabilities);
  assert.equal(payload.result.protocolVersion, result.protocolVersion);
  assert.equal(payload.result.instructions, result.instructions);
  assert.equal(payload.result.serverInfo.version, result.serverInfo.version);
  assert.equal(payload.result.serverInfo.name, "relay");
  assert.equal(payload.result.serverInfo.description, "Coordinate loew.fi projects, deployments, and QA.");
  assert.deepEqual(payload.result.serverInfo.icons, [relayIcon]);
  assert.equal(response.headers.get("X-Test"), "retained");
  assert.equal(response.headers.get("Content-Length"), null);
  const bytes = Buffer.from(relayIcon.src.split(",")[1], "base64");
  assert.equal(bytes.readUInt32BE(16), 1024);
  assert.equal(bytes.readUInt32BE(20), 1024);
  const expectedHash = "e1c4eee7c4a3579dd6142c076068d3e36f9292bbdbc6edce1f062d94588eea02";
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash);
});

test("tool responses and authentication failures pass through unchanged", async () => {
  const response = new Response('{"result":{"content":[]}}');
  assert.equal(await brandInitializeResponse(request("tools/call"), response), response);
  const denied = new Response('{"error":"invalid_token"}', { status: 401 });
  assert.equal(await brandInitializeResponse(request("initialize"), denied), denied);
});

test("malformed requests and RPC errors remain unchanged", async () => {
  const response = new Response('{"jsonrpc":"2.0","error":{"code":-32600}}');
  assert.equal(await brandInitializeResponse(request("initialize"), response), response);
  const malformed = new Request("https://relay.loew.fi/mcp", { method: "POST", body: "invalid" });
  assert.equal(await brandInitializeResponse(malformed, response), response);
});
