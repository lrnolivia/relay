import test from "node:test";
import assert from "node:assert/strict";
import { isEvidenceId, isRunId, metadataKeys, normalizeVisualFilters, compareEvidenceRecords, selectBaselineEvidence, reviewRunRecords, evidenceAssertionState, BASELINE_POLICY } from "../src/visual-evidence.mjs";

test("accepts inspector evidence ids only", () => {
  assert.equal(isEvidenceId("vis_88eb03ad-3cc9-44e3-8493-0912850e3653"), true);
  assert.equal(isEvidenceId("../../secret"), false);
  assert.equal(isEvidenceId("worker_123"), false);
});

test("selects capture metadata and excludes session records", () => {
  const keys = metadataKeys([
    { key: "visual/2026/09/29/vis_a1234567.json" },
    { key: "visual/2026/09/29/vis_a1234567.png" },
    { key: "sessions/some-session.json" },
    { key: "other/vis_a1234567.json" }
  ]);
  assert.deepEqual(keys, ["visual/2026/09/29/vis_a1234567.json"]);
});


test("normalizes visual evidence filters", () => {
  assert.deepEqual(normalizeVisualFilters({ project: "field", environment: "qa", pr: "89" }), {
    project: "field",
    environment: "qa",
    pr: 89,
    run: null
  });
  assert.throws(() => normalizeVisualFilters({ environment: "weird" }), /environment/);
  assert.throws(() => normalizeVisualFilters({ project: "../field" }), /filter/);
});


test("compares structured evidence without claiming pixel equality", () => {
  const base = {
    viewport: { width: 1440, height: 900 },
    context: { project: "field", surface: "editor" },
    dom: { html_bytes: 1000, element_tag_count: 40 },
    accessibility: { available: true, node_count: 25 }
  };
  assert.equal(compareEvidenceRecords(base, structuredClone(base)).result, "pass");
  const changed = compareEvidenceRecords(base, { ...structuredClone(base), dom: { html_bytes: 1010, element_tag_count: 41 } });
  assert.equal(changed.result, "changed");
  assert.equal(changed.dom.changed, true);
});


test("accepts normalized evidence run ids", () => {
  assert.equal(isRunId("run_12345678"), true);
  assert.equal(isRunId("../../run"), false);
});

test("normalizes run filters", () => {
  assert.deepEqual(normalizeVisualFilters({ run: "run_12345678" }), {
    project: null,
    environment: null,
    pr: null,
    run: "run_12345678"
  });
});


test("compares GitHub Chromium accessibility summaries by line count and bytes", () => {
  const base = {
    viewport: { width: 1440, height: 900 },
    context: { project: "field", surface: "editor" },
    dom: { html_bytes: 1000, element_tag_count: 40 },
    accessibility: { available: true, line_count: 87, bytes: 2697 }
  };
  assert.equal(compareEvidenceRecords(base, structuredClone(base)).accessibility.changed, false);
  const changed = compareEvidenceRecords(base, { ...structuredClone(base), accessibility: { available: true, line_count: 88, bytes: 2700 } });
  assert.equal(changed.accessibility.changed, true);
});

test("selects the previous same-step project/environment evidence as baseline", () => {
  const current = {
    evidence_id: "vis_current123",
    run_id: "run_current123",
    suite: "field.stage0",
    step_id: "full",
    captured_at: "2026-09-29T10:00:00.000Z",
    context: { project: "field", environment: "qa" },
    assertions: [{ id: "workspace.mode", status: "pass" }]
  };
  const older = { ...structuredClone(current), evidence_id: "vis_older1234", run_id: "run_older1234", captured_at: "2026-09-29T09:00:00.000Z" };
  const newest = { ...structuredClone(older), evidence_id: "vis_newer1234", run_id: "run_newer1234", captured_at: "2026-09-29T09:30:00.000Z" };
  assert.equal(selectBaselineEvidence([older, newest, current], current).evidence_id, "vis_newer1234");
});

test("run review reports assertion failures before visual comparison and first divergence", () => {
  const run = { run_id: "run_current123", status: "complete" };
  const base = {
    evidence_id: "vis_base12345",
    run_id: "run_base12345",
    suite: "field.stage0",
    step_id: "full",
    step_label: "Full",
    step_index: 1,
    captured_at: "2026-09-29T09:00:00.000Z",
    context: { project: "field", environment: "qa", surface: "editor" },
    viewport: { width: 1440, height: 900 },
    dom: { html_bytes: 1000, element_tag_count: 40 },
    accessibility: { available: true, line_count: 20, bytes: 500 },
    assertions: [{ id: "workspace.mode", status: "pass" }]
  };
  const current = { ...structuredClone(base), evidence_id: "vis_current123", run_id: "run_current123", captured_at: "2026-09-29T10:00:00.000Z", assertions: [{ id: "workspace.mode", status: "fail", detail: "mode mismatch" }] };
  assert.equal(evidenceAssertionState(current), "failed");
  const review = reviewRunRecords(run, [base, current]);
  assert.equal(review.baseline_policy, BASELINE_POLICY);
  assert.equal(review.result, "failed");
  assert.equal(review.first_divergence.step_id, "full");
  assert.equal(review.steps[0].baseline_evidence_id, "vis_base12345");
});


test("ignores tiny serialization drift when structure and accessibility shape are stable", () => {
  const base = {
    viewport: { width: 1440, height: 900 },
    context: { project: "field", surface: "editor" },
    dom: { html_bytes: 106880, element_tag_count: 528 },
    accessibility: { available: true, line_count: 88, bytes: 2711 }
  };
  const current = {
    viewport: { width: 1440, height: 900 },
    context: { project: "field", surface: "editor" },
    dom: { html_bytes: 107099, element_tag_count: 528 },
    accessibility: { available: true, line_count: 88, bytes: 2706 }
  };
  const comparison = compareEvidenceRecords(base, current);
  assert.equal(comparison.result, "pass");
  assert.equal(comparison.dom.changed, false);
  assert.equal(comparison.accessibility.changed, false);
});

test("still reports materially different DOM byte drift when structure count is unchanged", () => {
  const base = {
    viewport: { width: 1440, height: 900 },
    context: { project: "field", surface: "editor" },
    dom: { html_bytes: 1000, element_tag_count: 40 },
    accessibility: { available: true, line_count: 20, bytes: 500 }
  };
  const current = {
    ...structuredClone(base),
    dom: { html_bytes: 1010, element_tag_count: 40 }
  };
  assert.equal(compareEvidenceRecords(base, current).result, "changed");
});
