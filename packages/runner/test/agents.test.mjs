import test from "node:test";
import assert from "node:assert/strict";
import { parseRunnerStatus, responseText } from "../src/openai.mjs";

test("parseRunnerStatus uses the final explicit Status line", () => {
  assert.equal(parseRunnerStatus("Status: CONTINUE\nMore work\nStatus: COMPLETE"), "COMPLETE");
});

test("parseRunnerStatus rejects loose status words", () => {
  assert.equal(parseRunnerStatus("This is not COMPLETE yet."), null);
  assert.equal(parseRunnerStatus("BLOCKED by nothing, actually."), null);
});

test("responseText returns null when no assistant text exists", () => {
  assert.equal(responseText({ output: [{ type: "reasoning", summary: [] }] }), null);
});
