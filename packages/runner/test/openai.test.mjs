import test from "node:test";
import assert from "node:assert/strict";
import { parseRunnerStatus, responseText } from "../src/openai.mjs";

test("responseText extracts assistant output from a Responses API payload", () => {
  const text = responseText({
    output: [
      { type: "reasoning", summary: [] },
      { type: "message", role: "assistant", content: [{ type: "output_text", text: "Findings\nChanged.\n\nStatus: CONTINUE" }] }
    ]
  });
  assert.equal(text, "Findings\nChanged.\n\nStatus: CONTINUE");
});

test("responseText prefers output_text when present", () => {
  assert.equal(responseText({ output_text: "hello", output: [] }), "hello");
});
