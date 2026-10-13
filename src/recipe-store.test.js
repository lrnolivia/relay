import test from "node:test";
import assert from "node:assert/strict";
import { compileTraceRecipe } from "./recipe-store.js";

test("compiles bounded browser traces into versioned deterministic recipes", () => {
  const recipe = compileTraceRecipe({
    id: "field.saved-example",
    title: "Saved example",
    trace: [
      { action: "open", url: "https://field.loew.fi/qa/work/x" },
      { action: "hover", locator: { type: "css", value: "[data-workspace-mode-trigger]" } },
      { action: "click", locator: { type: "text", value: "Float" } },
      { action: "wait", ms: 250 },
      { action: "capture" }
    ]
  });
  assert.equal(recipe.schema_version, 1);
  assert.equal(recipe.recipe_version, 1);
  assert.equal(recipe.origin, "browser-trace");
  assert.deepEqual(recipe.steps.map(step => step.interaction.action), ["hover","click","wait"]);
});

test("rejects traces containing no replayable interactions", () => {
  assert.throws(() => compileTraceRecipe({ id: "field.empty", trace: [{ action: "open" }] }), /replayable/);
});
