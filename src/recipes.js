import { openBrowserSession, interactBrowserSession, captureBrowserSession, closeBrowserSession } from "./session.js";
import { normalizeBrowserCapacityError } from "./controller.js";
import { getBuiltInRecipe, listBuiltInRecipes } from "./recipe-catalog.js";

function assertRealProjectRoute(url) {
  if (!/^\/qa\/work\/[^/]+/.test(url.pathname)) throw new Error("Field QA recipes require /qa/work/{projectId}");
}

function browserInteractions(step) {
  if (step.action === "first-paint") return [{ action: "wait", waitMs: 1200 }];
  if (step.action === "workspace-layout") {
    return [
      { action: "hover", locator: { type: "css", value: "[data-workspace-mode-trigger]" } },
      { action: "click", locator: { type: "text", value: step.value } },
      { action: "wait", waitMs: 350 }
    ];
  }
  if (step.action === "interaction") return [step.interaction];
  throw new Error("Recipe step is not supported by Browser Run");
}

export function listBrowserRecipes() {
  return listBuiltInRecipes();
}

export async function runBrowserRecipe(binding, bucket, { recipe: recipeId, url, accessJwt, requestId, context }) {
  const recipe = getBuiltInRecipe(recipeId);
  if (!recipe) throw new Error("Unknown built-in browser recipe");
  assertRealProjectRoute(url);
  let opened;
  try {
    opened = await openBrowserSession(binding, bucket, {
      url, accessJwt,
      context: { ...(context || {}), project: context?.project || "field", route_kind: "qa-work", surface: context?.surface || "editor" }
    });
    for (const step of recipe.steps) {
      for (const interaction of browserInteractions(step)) {
        await interactBrowserSession(binding, bucket, { sessionId: opened.session_id, targetId: opened.target_id, accessJwt, ...interaction });
      }
    }
    const evidence = await captureBrowserSession(binding, bucket, {
      sessionId: opened.session_id, targetId: opened.target_id, accessJwt, requestId,
      context: { ...(context || {}), project: context?.project || "field", route_kind: "qa-work", surface: context?.surface || "editor" }
    });
    return { ...evidence, recipe: recipeId, recipe_version: recipe.recipe_version };
  } catch (error) {
    const capacity = normalizeBrowserCapacityError(error);
    if (capacity) return { ...capacity, recipe: recipeId, recipe_version: recipe.recipe_version };
    throw error;
  } finally {
    if (opened?.session_id) { try { await closeBrowserSession(binding, bucket, opened.session_id); } catch {} }
  }
}
