import test from "node:test";
import assert from "node:assert/strict";
import { applyWorkerSettings, publicWorkerSettings } from "../src/settings.mjs";

const base = {
  cadence_minutes: 60,
  model: { id: "gpt-5.6-sol", reasoning_effort: "medium", web_search: true },
  limits: { max_runs_per_day: 12, max_tokens_per_day: 250000 }
};

test("settings updates only whitelisted operational knobs", () => {
  const next = applyWorkerSettings(base, {
    cadence_minutes: 120,
    model_id: "gpt-5.6-sol",
    reasoning_effort: "high",
    web_search: false,
    max_runs_per_day: 8,
    max_tokens_per_day: 180000
  });
  assert.equal(next.cadence_minutes, 120);
  assert.equal(next.model.reasoning_effort, "high");
  assert.equal(next.model.web_search, false);
  assert.equal(next.limits.max_runs_per_day, 8);
  assert.equal(next.limits.max_tokens_per_day, 180000);
});

test("settings rejects secret-like or authority-changing fields", () => {
  assert.throws(() => applyWorkerSettings(base, { OPENAI_API_KEY: "nope" }), /Unsupported setting/);
  assert.throws(() => applyWorkerSettings(base, { target: { write_mode: "write" } }), /Unsupported setting/);
});

test("settings enforces safe bounds and reasoning enum", () => {
  assert.throws(() => applyWorkerSettings(base, { cadence_minutes: 30 }), /between 60 and 1440/);
  assert.throws(() => applyWorkerSettings(base, { max_runs_per_day: 99 }), /between 1 and 24/);
  assert.throws(() => applyWorkerSettings(base, { reasoning_effort: "extreme" }), /low, medium, or high/);
});

test("public settings never expose unrelated config", () => {
  const result = publicWorkerSettings({ ...base, secret: "hidden" });
  assert.deepEqual(Object.keys(result).sort(), [
    "cadence_minutes",
    "max_runs_per_day",
    "max_tokens_per_day",
    "model_id",
    "reasoning_effort",
    "web_search"
  ]);
});
