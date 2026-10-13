import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSnapshot, normalizeEvidenceContext } from "./evidence.js";

test("summarizes rendered snapshot without returning full page content", () => {
  const summary = summarizeSnapshot({
    content: "<html><head><title>field</title></head><body><main><button>Stroke</button></main></body></html>",
    accessibilityTree: { role: "WebArea", children: [{ role: "button", name: "Stroke" }] }
  });
  assert.equal(summary.title, "field");
  assert.ok(summary.dom.html_bytes > 0);
  assert.ok(summary.dom.element_tag_count >= 6);
  assert.equal(summary.accessibility.available, true);
  assert.ok(summary.accessibility.node_count >= 2);
});


test("normalizes authoritative deployment context without inference", () => {
  assert.deepEqual(normalizeEvidenceContext({
    project: "field",
    project_id: "project-123",
    environment: "qa",
    surface: "editor",
    route_kind: "qa-work",
    commit_sha: "abcdef1234567",
    pr_number: 89,
    deployment_id: "deploy-123"
  }), {
    assignment: null, owner: null, branch: null,
    project: "field",
    project_id: "project-123",
    environment: "qa",
    surface: "editor",
    route_kind: "qa-work",
    commit_sha: "abcdef1234567",
    pr_number: 89,
    deployment_id: "deploy-123"
  });
  assert.throws(() => normalizeEvidenceContext({ environment: "maybe" }), /environment/);
});

test('routing context survives capture as assertions and rejects invalid values', () => {
  const context = { project: 'relay', assignment: 'task-id', owner: 'actual-task:123', branch: 'relay/' + 'a'.repeat(200) };
  const normalized = normalizeEvidenceContext(context);
  for (const key of ['project', 'assignment', 'owner', 'branch']) assert.equal(normalized[key], context[key]);
  assert.equal(normalized.routing_verified, undefined);
  assert.throws(() => normalizeEvidenceContext({ assignment: 'bad value' }), /context/);
  assert.throws(() => normalizeEvidenceContext({ owner: 'a'.repeat(101) }), /context/);
});
