import test from "node:test";
import assert from "node:assert/strict";
import { evidenceEngines, planEvidenceRequest, normalizeBrowserCapacityError } from "./controller.js";

test("routes HTTP-only checks to the cheap HTTP engine", () => {
  assert.equal(planEvidenceRequest({ requires: ["http","headers"] }).engine, "http");
});

test("routes deterministic recipes to GitHub Chromium", () => {
  const plan = planEvidenceRequest({ recipe: "field.stage0", requires: ["render","interaction","screenshot","recipe"] });
  assert.equal(plan.engine, "github-chromium");
  assert.equal(plan.workflow, "evidence.yml");
});

test("reserves Browser Run for exploratory session work", () => {
  const plan = planEvidenceRequest({ requires: ["render","interaction","session"], exploratory: true });
  assert.equal(plan.engine, "browser-run");
});

test("normalizes Cloudflare Browser Run 429s as deferred capacity", () => {
  const result = normalizeBrowserCapacityError(new Error("Rate limit exceeded (status=429, retryAfter=55649)"));
  assert.equal(result.status, "deferred");
  assert.equal(result.retry_after, 55649);
  assert.equal(result.fallback_engine, "github-chromium");
});

test("exposes explicit engine capabilities", () => {
  const engines = evidenceEngines();
  assert.equal(engines.some(engine => engine.id === "github-chromium" && engine.capabilities.includes("recipe")), true);
});

test('GitHub quota and permission failures are never Browser Run capacity',()=>{
  for(const code of ['rate_limit',undefined])assert.equal(normalizeBrowserCapacityError(Object.assign(
    new Error('API rate limit exceeded for installation ID166454233'),{status:403,code,github:{provider:'github'}})),null);
});
