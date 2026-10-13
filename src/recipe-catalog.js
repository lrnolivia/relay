export const RECIPE_SCHEMA_VERSION = 1;

const BUILT_INS = Object.freeze({
  "field.canvas-first-paint": Object.freeze({
    id: "field.canvas-first-paint",
    schema_version: RECIPE_SCHEMA_VERSION,
    recipe_version: 1,
    title: "Canvas first paint",
    description: "Load a real field project and verify the Canvas reaches stable first paint.",
    real_project: true,
    verified: true,
    engine: "github-chromium",
    steps: Object.freeze([
      Object.freeze({ id: "canvas-first-paint", label: "Canvas first paint", action: "first-paint" })
    ])
  }),
  "field.full": Object.freeze({
    id: "field.full",
    schema_version: RECIPE_SCHEMA_VERSION,
    recipe_version: 1,
    title: "Full",
    description: "Switch the field workspace to Full and capture it.",
    real_project: true,
    verified: true,
    engine: "github-chromium",
    steps: Object.freeze([
      Object.freeze({ id: "full", label: "Full", action: "workspace-layout", value: "Full" })
    ])
  }),
  "field.focus": Object.freeze({
    id: "field.focus",
    schema_version: RECIPE_SCHEMA_VERSION,
    recipe_version: 1,
    title: "Focus",
    description: "Switch the field workspace to Focus and capture it.",
    real_project: true,
    verified: true,
    engine: "github-chromium",
    steps: Object.freeze([
      Object.freeze({ id: "focus", label: "Focus", action: "workspace-layout", value: "Focus" })
    ])
  }),
  "field.float": Object.freeze({
    id: "field.float",
    schema_version: RECIPE_SCHEMA_VERSION,
    recipe_version: 1,
    title: "Float",
    description: "Switch the field workspace to Float and capture it.",
    real_project: true,
    verified: true,
    engine: "github-chromium",
    steps: Object.freeze([
      Object.freeze({ id: "float", label: "Float", action: "workspace-layout", value: "Float" })
    ])
  }),
  "field.media-toolbar": Object.freeze({
    id: "field.media-toolbar",
    schema_version: RECIPE_SCHEMA_VERSION,
    recipe_version: 1,
    title: "Media toolbar and Insert separation",
    description: "Verify Media opens from the bottom toolbar and is absent from the Insert sidebar.",
    real_project: true,
    verified: true,
    engine: "github-chromium",
    steps: Object.freeze([
      Object.freeze({ id: "canvas-first-paint", label: "Canvas first paint", action: "first-paint" }),
      Object.freeze({
        id: "media-open",
        label: "Open toolbar Media",
        action: "interaction",
        interaction: Object.freeze({
          action: "click",
          locator: Object.freeze({ type: "css", value: "[data-toolbar-tool=\"media\"]" })
        })
      }),
      Object.freeze({
        id: "media-close",
        label: "Close toolbar Media",
        action: "interaction",
        interaction: Object.freeze({
          action: "click",
          locator: Object.freeze({ type: "css", value: "[data-toolbar-tool=\"media\"]" })
        })
      }),
      Object.freeze({
        id: "insert-open",
        label: "Open Insert sidebar",
        action: "interaction",
        interaction: Object.freeze({
          action: "click",
          locator: Object.freeze({ type: "css", value: "[data-left-menu-item=\"insert\"]" })
        })
      })
    ])
  }),
  "field.inspector-compact": Object.freeze({
    id: "field.inspector-compact",
    schema_version: RECIPE_SCHEMA_VERSION,
    recipe_version: 1,
    title: "Floating Inspector geometry",
    description: "Verify compact and expanded floating Inspector geometry, responsive short-window behavior, and hard viewport margins.",
    real_project: true,
    verified: true,
    engine: "github-chromium",
    steps: Object.freeze([
      Object.freeze({ id: "canvas-first-paint", label: "Canvas first paint", action: "first-paint" }),
      Object.freeze({ id: "float", label: "Float workspace", action: "workspace-layout", value: "Float" }),
      Object.freeze({ id: "compact-900", label: "Compact Inspector · 1440×900", action: "inspector-geometry", mode: "compact", viewport: Object.freeze({ width: 1440, height: 900 }) }),
      Object.freeze({ id: "compact-620", label: "Compact Inspector · 1000×620", action: "inspector-geometry", mode: "compact", viewport: Object.freeze({ width: 1000, height: 620 }) }),
      Object.freeze({ id: "compact-440", label: "Compact Inspector · 1000×440", action: "inspector-geometry", mode: "compact", viewport: Object.freeze({ width: 1000, height: 440 }) }),
      Object.freeze({ id: "expanded-900", label: "Expanded Inspector · 1440×900", action: "inspector-geometry", mode: "expanded", viewport: Object.freeze({ width: 1440, height: 900 }) }),
      Object.freeze({ id: "drag-bounds", label: "Floating Inspector hard margins", action: "inspector-drag-bounds", viewport: Object.freeze({ width: 1000, height: 620 }) })
    ])
  }),
  "field.stage0": Object.freeze({
    id: "field.stage0",
    schema_version: RECIPE_SCHEMA_VERSION,
    recipe_version: 1,
    title: "Stage 0 visual sweep",
    description: "One-browser real-project sweep of Canvas first paint plus Full, Focus, and Float.",
    real_project: true,
    verified: true,
    engine: "github-chromium",
    steps: Object.freeze([
      Object.freeze({ id: "canvas-first-paint", label: "Canvas first paint", action: "first-paint" }),
      Object.freeze({ id: "full", label: "Full", action: "workspace-layout", value: "Full" }),
      Object.freeze({ id: "focus", label: "Focus", action: "workspace-layout", value: "Focus" }),
      Object.freeze({ id: "float", label: "Float", action: "workspace-layout", value: "Float" })
    ])
  })
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getBuiltInRecipe(id) {
  return BUILT_INS[id] ? clone(BUILT_INS[id]) : null;
}

export function listBuiltInRecipes() {
  return Object.values(BUILT_INS).map(recipe => ({
    id: recipe.id,
    schema_version: recipe.schema_version,
    recipe_version: recipe.recipe_version,
    title: recipe.title,
    description: recipe.description,
    real_project: recipe.real_project,
    verified: recipe.verified,
    engine: recipe.engine,
    step_count: recipe.steps.length
  }));
}
