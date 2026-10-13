import test from "node:test";
import assert from "node:assert/strict";
import { validateUiRequest, callUiApi } from "../api.js";
import { handleApi } from "../../../packages/runner/src/cloudflare-worker.mjs";
import { consumeQaFeedback } from "../../../packages/runner/src/qa-feedback.mjs";
import app from "../../mcp/index.js";

test("UI transport limits methods, routes, inputs and cannot carry trusted identity", () => {
  for (const args of [
    { path: "/api/../admin" }, { path: "/api/%2e%2e/admin" }, { path: "https://evil.example/api/workers" },
    { path: "/api/projects", method: "POST" }, { path: "/api/workers", method: "DELETE" },
    { path: "/api/workers", authenticatedMcp: true }, { path: "/api/workers?token=secret" }
  ]) assert.throws(() => validateUiRequest(args));
  assert.equal(validateUiRequest({ path: "/api/workers/field/toggle", method: "POST", body: { enabled: false } }).method, "POST");
  assert.equal(validateUiRequest({ path: "/api/night-shift/items?project=relay&assignment=fixture&cursor=0&limit=20" }).method, "GET");
  assert.equal(validateUiRequest({ path: "/api/feedback/binding?project=relay&assignment=fixture&head_sha="+'a'.repeat(40) }).method, "GET");
  assert.throws(()=>validateUiRequest({path:'/api/night-shift/items',method:'POST'}));
});

test("web API fails closed without a verified identity and rejects cross-origin writes", async () => {
  const denied = await app.fetch(new Request("https://relay.loew.fi/api/projects"), {});
  assert.equal(denied.status, 401);
  const crossOrigin = await handleApi(new Request("https://relay.loew.fi/api/workers/field/toggle", {
    method: "POST", headers: { Origin: "https://evil.example", "Cf-Access-Jwt-Assertion": "edge-verified" }
  }), {});
  assert.equal(crossOrigin.status, 403);
});

test("MCP review transport writes to the existing evidence-bound QA key and reads it back", async () => {
  const id = "vis_12345678-abcd";
  const evidence = { evidence_id: id, step_label: "Relay navigation", context: { project: "relay", assignment: "relay-2.0-fixture", owner: "relay-2.0-fixture", branch: "relay/2.0-fixture", commit_sha: "a".repeat(40) } };
  const objects = new Map([["records/" + id + ".json", evidence]]);
  const bucket = {
    list: async ({ prefix }) => ({ objects: [...objects.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }),
    get: async key => objects.has(key) ? { json: async () => objects.get(key) } : null,
    put: async (key, value) => objects.set(key, JSON.parse(value))
  };
  objects.set("visual/test/" + id + ".json", evidence);
  const result = await callUiApi({ path: "/api/visual/" + id + "/qa", method: "POST", body: { answers: { intent: "yes" }, overall: "looks_good" } }, { EVIDENCE: bucket });
  assert.equal(result.status, 200);
  assert.equal(result.body.review.evidence_id, id);
  assert.equal(result.body.feedback.identity.assignment, "relay-2.0-fixture");
  assert.equal(result.body.feedback.identity.branch, "relay/2.0-fixture");
  const consumed = await consumeQaFeedback(bucket, { project: "relay", assignment: "relay-2.0-fixture", owner: "relay-2.0-fixture", branch: "relay/2.0-fixture" });
  assert.equal(consumed.events.length, 1);
  assert.deepEqual(consumed.acknowledged, [result.body.feedback.event_id]);
  const repeated = await consumeQaFeedback(bucket, { project: "relay", assignment: "relay-2.0-fixture", owner: "relay-2.0-fixture", branch: "relay/2.0-fixture" });
  assert.equal(repeated.events.length, 0);
  const read = await callUiApi({ path: "/api/visual/" + id + "/qa" }, { EVIDENCE: bucket });
  assert.equal(read.body.review.overall, "looks_good");
  assert.equal(read.body.evidence.context.commit_sha, "a".repeat(40));
});
