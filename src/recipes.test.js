import test from "node:test";
import assert from "node:assert/strict";
import { listBrowserRecipes } from "./recipes.js";

test("ships bounded real-project field QA recipes", () => {
  const recipes = listBrowserRecipes();
  const ids = recipes.map(recipe => recipe.id);
  for (const id of ["field.canvas-first-paint","field.full","field.focus","field.float","field.stage0"]) assert.ok(ids.includes(id));
  assert.equal(recipes.every(recipe => recipe.verified), true);
  assert.equal(recipes.every(recipe => recipe.real_project), true);
});