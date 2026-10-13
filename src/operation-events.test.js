import test from "node:test";
import assert from "node:assert/strict";
import { progressEvent, dedupeProgressEvents } from "./operation-events.js";

test("progress events are stable and deduplicated", () => {
  const a = progressEvent("source-commit", "2026-09-30T21:00:00Z", { head_sha: "a" });
  const b = progressEvent("source-commit", "2026-09-30T21:00:00Z", { head_sha: "a" });
  assert.equal(a.id, b.id);
  assert.equal(dedupeProgressEvents([a,b]).length, 1);
});
