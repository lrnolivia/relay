import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExternalEvidenceMetadata, normalizeEvidenceRun } from "./external-evidence.js";

test("normalizes GitHub Chromium evidence into the shared contract", () => {
  const result = normalizeExternalEvidenceMetadata({
    target_url: "https://field.loew.fi/qa/work/project-1",
    engine: "github-chromium",
    engine_reason: "deterministic_recipe",
    run_id: "run_12345678",
    step_index: 1,
    step_total: 7,
    context: { project: "field", environment: "qa", route_kind: "qa-work" },
    viewport: { width: 1440, height: 900 }
  });
  assert.equal(result.engine, "github-chromium");
  assert.equal(result.run_id, "run_12345678");
});

test("rejects non-loew evidence targets", () => {
  assert.throws(() => normalizeExternalEvidenceMetadata({
    target_url: "https://example.com/",
    engine: "github-chromium"
  }), /loew.fi/);
});

test("normalizes run lifecycle states", () => {
  const run = normalizeEvidenceRun({
    run_id: "run_12345678",
    status: "running",
    engine: "github-chromium",
    step_total: 7,
    step_completed: 2
  });
  assert.equal(run.status, "running");
  assert.equal(run.step_completed, 2);
});
