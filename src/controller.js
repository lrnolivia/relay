const CAPABILITIES = Object.freeze({
  http: new Set(["http","headers","json","redirects"]),
  "github-chromium": new Set(["render","screenshot","snapshot","interaction","recipe","compare","artifact"]),
  "browser-run": new Set(["render","screenshot","snapshot","interaction","exploratory","session"])
});

const ENGINE_ORDER = Object.freeze(["http","github-chromium","browser-run"]);
const KNOWN_CAPABILITIES = new Set(ENGINE_ORDER.flatMap(engine => [...CAPABILITIES[engine]]));

function cleanCapabilities(value) {
  const items = Array.isArray(value) ? value : [];
  const unique = [...new Set(items.map(item => String(item)))];
  for (const item of unique) {
    if (!KNOWN_CAPABILITIES.has(item)) throw new Error("Unknown evidence capability: " + item);
  }
  return unique;
}

function can(engine, required) {
  const caps = CAPABILITIES[engine];
  return required.every(item => caps.has(item));
}

export function evidenceEngines() {
  return ENGINE_ORDER.map(id => ({ id, capabilities: [...CAPABILITIES[id]] }));
}

export function planEvidenceRequest(input = {}) {
  const required = cleanCapabilities(input.requires);
  const recipe = input.recipe == null ? null : String(input.recipe);
  const exploratory = Boolean(input.exploratory);
  const preferred = input.preferred_engine == null ? null : String(input.preferred_engine);
  if (preferred && !ENGINE_ORDER.includes(preferred)) throw new Error("Unknown preferred evidence engine");

  if (!required.length) required.push(recipe ? "recipe" : "screenshot");
  if (exploratory && !required.includes("exploratory")) required.push("exploratory");

  if (required.every(item => CAPABILITIES.http.has(item))) {
    return {
      ok: true,
      engine: "http",
      reason: "http_only",
      fallback_engine: null,
      workflow: "inspect.yml",
      requires: required
    };
  }

  const deterministic = Boolean(recipe) || (!exploratory && required.includes("recipe"));
  if (deterministic && can("github-chromium", required.filter(item => item !== "exploratory"))) {
    return {
      ok: true,
      engine: "github-chromium",
      reason: recipe ? "deterministic_recipe" : "deterministic_browser_check",
      fallback_engine: null,
      workflow: "evidence.yml",
      requires: required,
      recipe
    };
  }

  if (preferred && can(preferred, required)) {
    const fallback = preferred === "browser-run" && !exploratory && can("github-chromium", required)
      ? "github-chromium"
      : null;
    return {
      ok: true,
      engine: preferred,
      reason: "preferred_capable_engine",
      fallback_engine: fallback,
      workflow: fallback ? "evidence.yml" : null,
      requires: required,
      recipe
    };
  }

  if (exploratory || required.includes("session")) {
    return {
      ok: true,
      engine: "browser-run",
      reason: exploratory ? "exploratory_interaction" : "session_required",
      fallback_engine: recipe && can("github-chromium", required.filter(item => item !== "exploratory" && item !== "session"))
        ? "github-chromium"
        : null,
      workflow: recipe ? "evidence.yml" : null,
      requires: required,
      recipe
    };
  }

  if (can("github-chromium", required)) {
    return {
      ok: true,
      engine: "github-chromium",
      reason: "cheapest_capable_browser",
      fallback_engine: "browser-run",
      workflow: "evidence.yml",
      requires: required,
      recipe
    };
  }

  if (can("browser-run", required)) {
    return {
      ok: true,
      engine: "browser-run",
      reason: "browser_run_only_capable_engine",
      fallback_engine: null,
      workflow: null,
      requires: required,
      recipe
    };
  }

  throw new Error("No evidence engine satisfies the requested capabilities");
}

export function normalizeBrowserCapacityError(error) {
  if(error?.github?.provider==='github')return null;
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = Number(message.match(/status\s*=\s*(\d{3})/i)?.[1] ?? message.match(/\b(429)\b/)?.[1] ?? 0);
  if (status !== 429 && !/rate limit exceeded/i.test(message)) return null;
  const retryAfter = Number(message.match(/retryAfter\s*=\s*(\d+)/i)?.[1] ?? 0) || null;
  return {
    ok: false,
    status: "deferred",
    reason: "browser_capacity",
    engine: "browser-run",
    retry_after: retryAfter,
    fallback_available: true,
    fallback_engine: "github-chromium",
    fallback_workflow: "evidence.yml"
  };
}
