import { createHash } from "node:crypto";
import { buildContext, renderContext } from "./context.mjs";
import { createResponse, hasOpenAiCredential, isCredentialError, parseRunnerStatus, responseText } from "./openai.mjs";
import { appendReport, isDue, loadState, nextRunFrom, saveState } from "./state.mjs";

function reportBlock(text) {
  return "## " + new Date().toISOString() + "\n\n" + text;
}

function contextFingerprint(packet) {
  return createHash("sha256").update(JSON.stringify(packet)).digest("hex");
}

function localDay(config, now = new Date()) {
  const timezone = config.timezone ?? "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function budgetState(config, state, now = new Date()) {
  const day = localDay(config, now);
  const budget = state.budget ?? {
    day,
    runs: 0,
    tokens: 0,
    last_accounted_response_id: null
  };
  if (budget.day !== day) {
    budget.day = day;
    budget.runs = 0;
    budget.tokens = 0;
    budget.last_accounted_response_id = null;
  }
  state.budget = budget;
  return budget;
}

function budgetBlockReason(config, state) {
  const budget = budgetState(config, state);
  const maxRuns = config.limits?.max_runs_per_day;
  const maxTokens = config.limits?.max_tokens_per_day;
  if (maxRuns != null && budget.runs >= maxRuns) {
    return "Daily run budget reached (" + budget.runs + "/" + maxRuns + ").";
  }
  if (maxTokens != null && budget.tokens >= maxTokens) {
    return "Daily token budget reached (" + budget.tokens + "/" + maxTokens + ").";
  }
  return null;
}

async function waitForCredential(state) {
  const message = "OPENAI_API_KEY is not configured in Relay GitHub Actions secrets.";
  if (state.status === "waiting_credentials" && state.last_error === message) return state;
  state.status = "waiting_credentials";
  state.last_error = message;
  await saveState(state);
  return state;
}

export async function runWorker(config, { force = false } = {}) {
  const state = await loadState(config.id);

  if (!force && !isDue(config, state)) return state;
  if (["running", "blocked", "complete"].includes(state.status)) return state;

  if (!hasOpenAiCredential()) return waitForCredential(state);

  const budgetReason = budgetBlockReason(config, state);
  if (budgetReason) {
    state.status = "blocked";
    state.last_error = budgetReason;
    await saveState(state);
    return state;
  }

  const packet = await buildContext(config);
  const fingerprint = contextFingerprint(packet);

  if (!force && state.last_context_fingerprint === fingerprint) {
    if (state.status === "waiting_credentials") {
      state.status = "idle";
      state.last_error = null;
      await saveState(state);
    }
    return state;
  }

  const prompt = [
    "# Runner job: " + config.name,
    "Target: " + config.target.repository + "@" + config.target.branch,
    "Write mode: " + config.target.write_mode,
    "",
    "## Goal",
    config.goal,
    "",
    "## Current repository context",
    renderContext(packet),
    "",
    state.previous_response_id
      ? "Continue from prior runner context, but reason from the fresh repository packet above. Focus only on material changes, unresolved risks, or the safest next action."
      : "Begin with a bounded first cycle. Establish current-state findings and the safest next focus without trying to solve the entire project."
  ].join("\n");

  try {
    const response = await createResponse(config, prompt, state.previous_response_id ?? null);

    if (response.status && response.status !== "completed") {
      state.status = "blocked";
      state.last_error = "OpenAI response ended with status " + response.status + ": " + JSON.stringify(response.incomplete_details ?? response.error ?? {}).slice(0, 500);
      await saveState(state);
      return state;
    }

    const text = responseText(response);
    if (!text) {
      state.status = "blocked";
      state.last_error = "OpenAI response completed without assistant text.";
      await saveState(state);
      return state;
    }

    const budget = budgetState(config, state);
    budget.runs += 1;
    budget.tokens += Number(response.usage?.total_tokens ?? 0);
    budget.last_accounted_response_id = response.id ?? null;

    state.previous_response_id = response.id ?? state.previous_response_id ?? null;
    state.last_output_id = response.id ?? null;
    state.last_usage = response.usage ?? null;
    state.last_context_fingerprint = fingerprint;
    state.run_count = Number(state.run_count ?? 0) + 1;
    state.last_run_at = new Date().toISOString();
    state.next_run_at = nextRunFrom(Date.now(), config.cadence_minutes);
    state.last_summary = text.slice(0, 1200);
    state.last_error = null;

    await appendReport(config.id, reportBlock(text));

    const declaredStatus = parseRunnerStatus(text);
    if (declaredStatus === "COMPLETE") state.status = "complete";
    else if (declaredStatus === "BLOCKED") state.status = "blocked";
    else if (declaredStatus === "CONTINUE") state.status = "idle";
    else {
      state.status = "blocked";
      state.last_error = "Runner output omitted the required final Status line.";
    }
  } catch (error) {
    if (isCredentialError(error)) {
      state.status = "waiting_credentials";
      state.last_error = "OpenAI API credential is missing or invalid.";
    } else {
      state.status = "blocked";
      state.last_error = error.message;
    }
  }

  await saveState(state);
  return state;
}
