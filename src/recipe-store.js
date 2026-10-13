import { validateInteractionShape, getBrowserSessionTrace } from "./session.js";
import { getBuiltInRecipe, listBuiltInRecipes, RECIPE_SCHEMA_VERSION } from "./recipe-catalog.js";

const RECIPE_ID = /^[a-z0-9][a-z0-9._-]{2,80}$/;
const SAVED_PREFIX = "recipes/";
const ALLOWED_TRACE_ACTIONS = new Set(["click","double_click","hover","type","press","select","scroll","wait"]);

function safeText(value, max = 160) {
  if (value == null || value === "") return null;
  return String(value).replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || null;
}

function assertRecipeId(value) {
  const id = String(value || "");
  if (!RECIPE_ID.test(id)) throw new Error("Invalid recipe id");
  return id;
}

function recipeKey(id) {
  return SAVED_PREFIX + assertRecipeId(id) + ".json";
}

function interactionFromTrace(entry) {
  const action = String(entry?.action || "");
  if (!ALLOWED_TRACE_ACTIONS.has(action)) return null;
  if (action === "wait") {
    const waitMs = Math.min(10000, Math.max(0, Number(entry.ms ?? entry.waitMs) || 500));
    const args = { action, waitMs };
    validateInteractionShape(args);
    return args;
  }
  const args = {
    action,
    locator: entry.locator || null,
    value: entry.value,
    key: entry.key,
    deltaX: entry.delta_x ?? entry.deltaX,
    deltaY: entry.delta_y ?? entry.deltaY
  };
  validateInteractionShape(args);
  return args;
}

export function compileTraceRecipe({ id, title, description, trace }) {
  const recipeId = assertRecipeId(id);
  if (!Array.isArray(trace)) throw new Error("Recipe trace required");
  const interactions = trace.map(interactionFromTrace).filter(Boolean).slice(0, 80);
  if (!interactions.length) throw new Error("Trace has no replayable interactions");
  return {
    id: recipeId,
    schema_version: RECIPE_SCHEMA_VERSION,
    recipe_version: 1,
    title: safeText(title, 120) || recipeId,
    description: safeText(description, 240) || "Saved from a bounded loew inspector browser trace.",
    real_project: true,
    verified: false,
    engine: "github-chromium",
    origin: "browser-trace",
    created_at: new Date().toISOString(),
    steps: interactions.map((interaction, index) => ({
      id: "step-" + String(index + 1).padStart(2, "0"),
      label: interaction.action + " " + (index + 1),
      action: "interaction",
      interaction
    }))
  };
}

export async function saveRecipe(bucket, recipe) {
  if (!bucket?.put) throw new Error("Evidence R2 binding unavailable");
  const normalized = compileTraceRecipe({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    trace: recipe.steps?.map(step => step.interaction || step)
  });
  normalized.created_at = recipe.created_at || normalized.created_at;
  await bucket.put(recipeKey(normalized.id), JSON.stringify(normalized), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "private, max-age=0, no-store" },
    customMetadata: { recipeId: normalized.id, version: String(normalized.recipe_version) }
  });
  return normalized;
}

export async function getSavedRecipe(bucket, id) {
  if (!bucket?.get) throw new Error("Evidence R2 binding unavailable");
  const object = await bucket.get(recipeKey(id));
  if (!object) return null;
  const recipe = await object.json();
  return recipe && recipe.id === id ? recipe : null;
}

export async function getRecipe(bucket, id) {
  return getBuiltInRecipe(id) || await getSavedRecipe(bucket, id);
}

export async function listRecipes(bucket) {
  const builtins = listBuiltInRecipes();
  if (!bucket?.list) return builtins;
  const page = await bucket.list({ prefix: SAVED_PREFIX, limit: 100 });
  const saved = [];
  for (const object of page.objects || []) {
    if (!object.key.endsWith(".json")) continue;
    const item = await bucket.get(object.key);
    if (!item) continue;
    try {
      const recipe = await item.json();
      if (recipe?.id && RECIPE_ID.test(recipe.id)) {
        saved.push({
          id: recipe.id,
          schema_version: recipe.schema_version,
          recipe_version: recipe.recipe_version,
          title: recipe.title,
          description: recipe.description,
          real_project: true,
          verified: Boolean(recipe.verified),
          engine: recipe.engine || "github-chromium",
          origin: recipe.origin || "saved",
          step_count: Array.isArray(recipe.steps) ? recipe.steps.length : 0
        });
      }
    } catch {}
  }
  return [...builtins, ...saved].sort((a,b) => a.id.localeCompare(b.id));
}

export async function saveRecipeFromSession(bucket, { sessionId, recipeId, title, description }) {
  const session = await getBrowserSessionTrace(bucket, sessionId);
  const recipe = compileTraceRecipe({ id: recipeId, title, description, trace: session.trace });
  await bucket.put(recipeKey(recipe.id), JSON.stringify(recipe), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "private, max-age=0, no-store" },
    customMetadata: { recipeId: recipe.id, version: String(recipe.recipe_version) }
  });
  return recipe;
}
