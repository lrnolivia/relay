const REASONING_EFFORTS = new Set(["low", "medium", "high"]);
const SETTINGS_KEYS = new Set([
  "cadence_minutes",
  "model_id",
  "reasoning_effort",
  "web_search",
  "max_runs_per_day",
  "max_tokens_per_day"
]);

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    badRequest(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function applyWorkerSettings(config, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    badRequest("Settings body must be a JSON object.");
  }

  const unknown = Object.keys(input).filter((key) => !SETTINGS_KEYS.has(key));
  if (unknown.length) badRequest(`Unsupported setting: ${unknown.join(", ")}`);
  if (!Object.keys(input).length) badRequest("At least one setting is required.");

  const next = JSON.parse(JSON.stringify(config));

  if ("cadence_minutes" in input) {
    next.cadence_minutes = integer(input.cadence_minutes, "cadence_minutes", 60, 1440);
  }

  if ("model_id" in input) {
    if (typeof input.model_id !== "string" || !/^gpt-[a-z0-9._-]{2,72}$/i.test(input.model_id)) {
      badRequest("model_id must be a valid gpt-* model identifier.");
    }
    next.model.id = input.model_id;
  }

  if ("reasoning_effort" in input) {
    if (!REASONING_EFFORTS.has(input.reasoning_effort)) {
      badRequest("reasoning_effort must be low, medium, or high.");
    }
    next.model.reasoning_effort = input.reasoning_effort;
  }

  if ("web_search" in input) {
    if (typeof input.web_search !== "boolean") badRequest("web_search must be boolean.");
    next.model.web_search = input.web_search;
  }

  if ("max_runs_per_day" in input) {
    next.limits.max_runs_per_day = integer(input.max_runs_per_day, "max_runs_per_day", 1, 24);
  }

  if ("max_tokens_per_day" in input) {
    next.limits.max_tokens_per_day = integer(input.max_tokens_per_day, "max_tokens_per_day", 10000, 2000000);
  }

  return next;
}

export function publicWorkerSettings(config) {
  return {
    cadence_minutes: config.cadence_minutes,
    model_id: config.model.id,
    reasoning_effort: config.model.reasoning_effort,
    web_search: Boolean(config.model.web_search),
    max_runs_per_day: config.limits?.max_runs_per_day ?? null,
    max_tokens_per_day: config.limits?.max_tokens_per_day ?? null
  };
}
