import test from "node:test";
import assert from "node:assert/strict";
import { queuedProgress, progressResponse, PROGRESS_CONTRACT_VERSION } from "./progress-api.js";

test("1.8 consumer contract keeps queued intent separate from observed progress", () => {
  const q = queuedProgress({id:"q",next_action:"later"});
  const response = progressResponse("relay", [], [q]);
  assert.equal(PROGRESS_CONTRACT_VERSION, "1.7.5");
  assert.equal(response.observed_progress, true);
  assert.equal(response.queue[0].observed, false);
});

import { createHash } from "node:crypto";
import { callProgress } from "./progress-api.js";
function progressFixture(overrides = {}) {
  const record = Buffer.from(JSON.stringify({ claims: [], queue: [], legacy_branches: [], retained_evidence: "x".repeat(1024 * 1024) }));
  const sha = createHash("sha1").update(`blob ${record.length}\0`).update(record).digest("hex");
  const registration = Buffer.from(JSON.stringify({ repository: "lrnolivia/relay", coordination: { record: "coordination/relay.json" } }));
  const calls = [];
  const api = async path => {
    calls.push(path);
    if (path.includes("/contents/projects/")) return { type: "file", encoding: "base64", sha: "a".repeat(40), content: registration.toString("base64") };
    if (path.includes("/contents/coordination/")) return { type: "file", encoding: "none", sha, size: record.length, ...overrides.file };
    if (path.includes("/git/blobs/")) return { sha, size: record.length, encoding: "base64", content: record.toString("base64"), ...overrides.blob };
    if (path.includes("/branches?") || path.includes("/pulls?")) return [];
    throw new Error("Unexpected path " + path);
  };
  return { api, calls, sha };
}
test("live progress resolves the exact large ledger blob rather than reporting an incomplete file", async () => {
  const fixture = progressFixture();
  const result = await callProgress({ project: "relay" }, {}, fixture.api);
  assert.equal(result.observed_progress, true);
  assert.deepEqual(result.progress, []);
  assert.deepEqual(fixture.calls.filter(path => path.includes('/git/blobs/')), [`/repos/lrnolivia/relay/git/blobs/${fixture.sha}`]);
});
test("progress rejects a substituted immutable blob", async () => {
  const fixture = progressFixture({ blob: { content: Buffer.from('{}').toString('base64') } });
  await assert.rejects(callProgress({ project: "relay" }, {}, fixture.api), /identity verification failed/);
});
test("progress refuses oversized or truncated ledgers without fetching arbitrary bytes", async () => {
  for (const file of [{ size: 8 * 1024 * 1024 + 1 }, { truncated: true }]) {
    const fixture = progressFixture({ file });
    await assert.rejects(callProgress({ project: "relay" }, {}, fixture.api), /incomplete/);
    assert.equal(fixture.calls.some(path => path.includes('/git/blobs/')), false);
  }
});
