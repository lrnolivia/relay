import test from "node:test";
import assert from "node:assert/strict";
import { freshness } from "./operations.js";

const now = new Date("2026-09-30T22:00:00Z");
test("progress freshness uses 5/10/20 minute semantics", () => {
  assert.equal(freshness("2026-09-30T21:57:00Z", now).state, "fresh");
  assert.equal(freshness("2026-09-30T21:53:00Z", now).state, "delayed");
  assert.equal(freshness("2026-09-30T21:48:00Z", now).state, "possibly-stale");
  assert.equal(freshness("2026-09-30T21:39:00Z", now).state, "stale");
});
