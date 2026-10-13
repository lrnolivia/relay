import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const tombstone = fs.readFileSync(new URL("../LOEW_CHAT_BIBLE_CURRENT.md", import.meta.url), "utf8");
const bible = fs.readFileSync(new URL("../LOEW_CHAT_BIBLE.md", import.meta.url), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("../contracts/manifest.json", import.meta.url), "utf8"));
const humanQa = JSON.parse(fs.readFileSync(new URL("../contracts/human-qa-helper.json", import.meta.url), "utf8"));
const humanQaDoc = fs.readFileSync(new URL("../docs/HUMAN_QA_HELPER.md", import.meta.url), "utf8");
const nightShift = fs.readFileSync(new URL("../night-shift/CONTRACT.md", import.meta.url), "utf8");
const blockers = fs.readFileSync(new URL("../night-shift/BLOCKER_POLICY.md", import.meta.url), "utf8");

test("universal manifest points to the single Bible", () => {
  assert.equal(manifest.contract, "LOEW_CHAT_BIBLE.md");
  assert.equal(manifest.version, "2026-09-30.2");
  assert.equal(manifest.single_bible, true);
  assert.ok(manifest.retired_contracts.includes("LOEW_CHAT_BIBLE_CURRENT.md"));
  assert.equal(manifest.watchdog.identical_failure_attempts, 2);
  assert.equal(manifest.qa_authority.runner_first, true);
  assert.equal(manifest.qa_authority.project_qa_is_overlay, true);
  assert.equal(manifest.qa_authority.helper_contract, "contracts/human-qa-helper.json");
  assert.equal(manifest.qa_authority.helper_docs, "docs/HUMAN_QA_HELPER.md");
  assert.equal(manifest.qa_authority.agents_populate_questions_and_checklists, true);
  assert.equal(manifest.qa_authority.deterministic_checks_remain_agent_owned, true);
  assert.equal(manifest.target_resolution.runner_project_registry_first, true);
});

test("Bible keeps core recovery invariants", () => {
  const lower = bible.toLowerCase();
  for (const phrase of [
    "mandatory bootstrap for every invocation",
    "failure fingerprint",
    "bounded retry budget",
    "loop watchdog",
    "pre-mutation sanity gate",
    "post-mutation sanity gate",
    "blocked assignment as a scheduling event",
    "third identical retry"
  ]) {
    assert.ok(lower.includes(phrase), "missing invariant: " + phrase);
  }
});

test("Bible keeps QA loop escape and danger-zone law", () => {
  const lower = bible.toLowerCase();
  for (const phrase of [
    "qa self-correction",
    "qa loop watchdog",
    "when to abandon automated qa",
    "danger zone preview",
    "human qa required",
    "browser run",
    "github chromium",
    "automatic promotion"
  ]) {
    assert.ok(lower.includes(phrase), "missing QA invariant: " + phrase);
  }
  assert.ok(bible.includes("DANGER ZONE — HUMAN QA REQUIRED"));
  assert.ok(bible.toLowerCase().includes("project qa documents are overlays only"));
  assert.ok(bible.includes("lrnolivia/field"));
  assert.ok(bible.includes("/qa/work/<projectId>"));
  assert.ok(bible.includes("/builder/noauth"));
  assert.ok(tombstone.toLowerCase().includes("status: **tombstone**"));
  assert.ok(tombstone.includes("LOEW_CHAT_BIBLE.md"));
});

test("Night Shift policies inherit the universal law", () => {
  assert.ok(nightShift.includes("LOEW_CHAT_BIBLE.md"));
  assert.ok(blockers.toLowerCase().includes("failure fingerprint"));
  assert.ok(blockers.toLowerCase().includes("same fingerprint"));
});


test("human QA helper keeps targeted review responsibilities explicit", () => {
  assert.equal(humanQa.name, "runner-human-qa-helper");
  assert.equal(humanQa.questions.min_items, 1);
  assert.equal(humanQa.questions.max_items, 6);
  assert.equal(humanQa.checklist.max_items, 10);
  assert.ok(humanQa.questions.rules.some(rule => rule.includes("human judgment")));
  assert.ok(humanQa.questions.rules.some(rule => rule.includes("Do not ask the user to verify tests")));
  assert.ok(humanQa.agent_population.required_behavior.some(rule => rule.includes("Generate the questions/checklist")));
  assert.ok(humanQa.review_lifecycle.no_gate_bypass.includes("never overrides"));
  assert.match(humanQaDoc, /Default to \*\*2–4 questions\*\*/);
  assert.match(humanQaDoc, /Do not send routine machine-verifiable work to the user/);
  assert.match(humanQaDoc, /The helper exists to reduce review effort/);
});
