import test from "node:test";
import assert from "node:assert/strict";
import { recordQaFeedback, listQaFeedback, consumeQaFeedback, peekFeedback, feedbackApplicability } from "../src/qa-feedback.mjs";

function memoryBucket() {
  const objects = new Map();
  return {
    objects,
    list: async ({ prefix }) => ({ objects: [...objects.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }),
    get: async key => objects.has(key) ? { json: async () => JSON.parse(objects.get(key)) } : null,
    put: async (key, value) => objects.set(key, value)
  };
}

const evidence = {
  evidence_id: "vis_feedback-12345678",
  context: {
    project: "relay",
    assignment: "relay-2.0-test",
    owner: "relay-2.0-test",
    branch: "relay/2.0-test",
    commit_sha: "a".repeat(40)
  }
};

test("QA feedback events are durable, identity-bound and monotonically ordered", async () => {
  const bucket = memoryBucket();
  const first = await recordQaFeedback(bucket, evidence, { overall: "needs_work", notes: "tighten the header" }, "2026-10-01T08:00:00.000Z");
  const second = await recordQaFeedback(bucket, evidence, { overall: "looks_good", notes: "fixed" }, "2026-10-01T08:00:00.000Z");
  assert.ok(second.sequence > first.sequence);
  assert.equal(first.identity.assignment, "relay-2.0-test");
  assert.equal(first.identity.branch, "relay/2.0-test");
  const pending = await listQaFeedback(bucket, { project: "relay", assignment: "relay-2.0-test", owner: "relay-2.0-test", branch: "relay/2.0-test" });
  assert.deepEqual(pending.events.map(item => item.event_id), [first.event_id, second.event_id]);
});

test("consumption acknowledges matching feedback so it is not delivered repeatedly", async () => {
  const bucket = memoryBucket();
  const event = await recordQaFeedback(bucket, evidence, { notes: "move the control" }, "2026-10-01T08:01:00.000Z");
  const consumed = await consumeQaFeedback(bucket, { project: "relay", assignment: "relay-2.0-test", owner: "relay-2.0-test", branch: "relay/2.0-test" });
  assert.deepEqual(consumed.acknowledged, [event.event_id]);
  const again = await listQaFeedback(bucket, { project: "relay", assignment: "relay-2.0-test", owner: "relay-2.0-test", branch: "relay/2.0-test" });
  assert.equal(again.events.length, 0);
});

test("same-assignment feedback from a stale branch is surfaced as a reconciliation conflict", async () => {
  const bucket = memoryBucket();
  await recordQaFeedback(bucket, evidence, { notes: "old branch note" }, "2026-10-01T08:02:00.000Z");
  const pending = await listQaFeedback(bucket, { project: "relay", assignment: "relay-2.0-test", owner: "relay-2.0-test", branch: "relay/other" });
  assert.equal(pending.events.length, 0);
  assert.equal(pending.conflicts.length, 1);
  assert.deepEqual(pending.conflicts[0].conflicts, ["branch"]);
});

test("feedback without trusted assignment or branch identity is never silently applied", async () => {
  const bucket = memoryBucket();
  await recordQaFeedback(bucket, { evidence_id: "vis_feedback-87654321", context: { project: "relay" } }, { notes: "unbound" }, "2026-10-01T08:03:00.000Z");
  const pending = await listQaFeedback(bucket, { project: "relay", assignment: "relay-2.0-test", owner: "relay-2.0-test", branch: "relay/2.0-test" });
  assert.equal(pending.events.length, 0);
});

test('new read path paginates legacy events without consuming or relabelling legacy acknowledgements', async () => {
  const bucket = memoryBucket(); let writes = 0;
  const put = bucket.put;
  bucket.put = async (...args) => { writes++; return put(...args); };
  bucket.list = async ({ prefix, limit, cursor }) => {
    const keys = [...bucket.objects.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = Number(cursor || 0), size = Math.min(limit, 3);
    const page = keys.slice(start, start + size);
    return { objects: page.map(key => ({ key })), truncated: start + page.length < keys.length,
      cursor: String(start + page.length) };
  };
  for (let i = 0; i < 103; i++) await recordQaFeedback(bucket, evidence, { notes: `synthetic legacy ${i}` });
  const before = writes, ids = new Set(); let cursor;
  const target = { ...evidence.context, repository: 'lrnolivia/relay' };
  do {
    const page = await peekFeedback(bucket, target, { cursor, limit: 20 });
    assert.equal(page.events.length, 0);
    page.conflicts.forEach(item => { assert.equal(item.legacy, true); ids.add(item.event_id); });
    cursor = page.next_cursor;
  } while (cursor);
  assert.equal(ids.size, 103); assert.equal(writes, before);
});

test('artifact matching distinguishes stale identity from unavailable native evidence', () => {
  const identity = { ...evidence.context, kind: 'runtime', repository: 'lrnolivia/relay', deployment_id: 'old', runtime_sha256: 'c'.repeat(64) };
  const unavailable = feedbackApplicability(identity, { ...evidence.context, repository: 'lrnolivia/relay' });
  assert.equal(unavailable.routing_matches, true);
  assert.equal(unavailable.safe_to_apply, false);
  assert.deepEqual(unavailable.unverified, ['runtime_identity', 'deployment_id', 'runtime_sha256']);
  const stale = feedbackApplicability(identity, { ...identity, commit_sha: 'b'.repeat(40), deployment_id: 'new' });
  assert.deepEqual(stale.conflicts, ['commit_sha', 'deployment_id']);
});

test('omitted runtime metadata cannot create applicability while explicit source feedback remains usable', () => {
  const target = { ...evidence.context, repository: 'lrnolivia/relay' };
  const unspecified = feedbackApplicability(target, target);
  assert.equal(unspecified.routing_matches, true);
  assert.equal(unspecified.safe_to_apply, false);
  assert.deepEqual(unspecified.unverified, ['artifact_kind']);
  const runtime = feedbackApplicability({ ...target, kind: 'runtime' }, target);
  assert.equal(runtime.safe_to_apply, false);
  assert.deepEqual(runtime.unverified, ['runtime_identity']);
  assert.equal(feedbackApplicability({ ...target, kind: 'source' }, target).safe_to_apply, true);
  const verifiedRuntime = { ...target, runtime_sha256: 'd'.repeat(64) };
  assert.equal(feedbackApplicability({ ...verifiedRuntime, kind: 'runtime' }, verifiedRuntime).safe_to_apply, true);
});

test('runtime applicability handles each missing field, caller-only values, mismatches and verified matches', () => {
  const base = { ...evidence.context, repository: 'lrnolivia/relay', kind: 'runtime' };
  for (const field of ['deployment_id', 'runtime_sha256']) {
    const value = field === 'deployment_id' ? 'verified-deployment' : 'e'.repeat(64);
    const callerOnly = feedbackApplicability({ ...base, [field]: value }, base);
    assert.equal(callerOnly.safe_to_apply, false);
    assert.deepEqual(callerOnly.unverified, ['runtime_identity', field]);
    const targetOnly = feedbackApplicability(base, { ...base, [field]: value });
    assert.equal(targetOnly.safe_to_apply, false);
    assert.deepEqual(targetOnly.unverified, ['runtime_identity']);
    const mismatch = feedbackApplicability({ ...base, [field]: value }, { ...base, [field]: 'different' });
    assert.equal(mismatch.safe_to_apply, false);
    assert.ok(mismatch.conflicts.includes(field));
    assert.equal(feedbackApplicability({ ...base, [field]: value }, { ...base, [field]: value }).safe_to_apply, true);
  }
  const both = { ...base, deployment_id: 'verified-deployment', runtime_sha256: 'e'.repeat(64) };
  assert.equal(feedbackApplicability(both, both).safe_to_apply, true);
  const partlyUnknown = feedbackApplicability(both, { ...base, deployment_id: both.deployment_id });
  assert.equal(partlyUnknown.safe_to_apply, false);
  assert.deepEqual(partlyUnknown.unverified, ['runtime_sha256']);
});
