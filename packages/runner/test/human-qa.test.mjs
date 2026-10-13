import test from "node:test";
import assert from "node:assert/strict";
import {
  isSafeLoewUrl,
  qaQuestionsForEvidence,
  normalizeQaReview,
  frameEmbeddingPolicy,
  inspectLivePreview
} from "../src/human-qa.mjs";

test("human QA only accepts HTTPS loew.fi targets", () => {
  assert.equal(isSafeLoewUrl("https://field.loew.fi/qa/work/123"), true);
  assert.equal(isSafeLoewUrl("https://abc.field-preview.loew.fi/qa/work/123"), true);
  assert.equal(isSafeLoewUrl("http://field.loew.fi/"), false);
  assert.equal(isSafeLoewUrl("https://example.com/"), false);
});

test("human QA questions target the evidence context", () => {
  const questions = qaQuestionsForEvidence({
    step_label: "Focus",
    context: { surface: "editor", environment: "preview" },
    viewport: { width: 390, height: 844 }
  });
  assert.equal(questions[0].id, "focus-clear");
  assert.equal(questions.some(item => item.id === "mobile-fit"), true);
  assert.equal(questions.some(item => item.id === "preview-ready"), true);
  assert.ok(questions.length <= 4);
});

test("QA review keeps known answers and rejects invalid verdicts", () => {
  const questions = [{ id: "intent" }];
  const review = normalizeQaReview({
    answers: { intent: "yes", ignored: "no" },
    overall: "looks_good",
    notes: "ship it",
    disposition: "completed"
  }, questions, "2026-09-30T12:00:00.000Z");

  assert.deepEqual(review.answers, { intent: "yes" });
  assert.equal(review.overall, "looks_good");
  assert.equal(review.disposition, "completed");
  assert.equal(review.updated_at, "2026-09-30T12:00:00.000Z");
  assert.throws(() => normalizeQaReview({ overall: "perfect" }, questions), /verdict/);
  assert.throws(() => normalizeQaReview({ disposition: "deleted" }, questions), /disposition/);
});

test("frame policy blocks cross-origin SAMEORIGIN previews", () => {
  const headers = new Headers({ "x-frame-options": "SAMEORIGIN" });
  const policy = frameEmbeddingPolicy(
    headers,
    "https://field.loew.fi/qa/work/123",
    "https://runner.loew.fi/api/visual/x/live"
  );
  assert.equal(policy.embeddable, false);
});

test("frame policy accepts explicit loew.fi wildcard ancestors", () => {
  const headers = new Headers({ "content-security-policy": "default-src 'self'; frame-ancestors https://*.loew.fi" });
  const policy = frameEmbeddingPolicy(
    headers,
    "https://field.loew.fi/qa/work/123",
    "https://runner.loew.fi/api/visual/x/live"
  );
  assert.equal(policy.embeddable, true);
});

test("live preview probe reports active embeddable previews", async () => {
  const fetcher = async () => new Response("", {
    status: 200,
    headers: { "content-type": "text/html" }
  });
  const result = await inspectLivePreview(
    { target_url: "https://field.loew.fi/qa/work/123" },
    "https://runner.loew.fi/api/visual/x/live",
    fetcher
  );
  assert.equal(result.active, true);
  assert.equal(result.embeddable, true);
  assert.equal(result.status, 200);
});
