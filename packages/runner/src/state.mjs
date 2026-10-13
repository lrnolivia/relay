import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const STATE_DIR = path.join(ROOT, "state");
const REPORTS_DIR = path.join(ROOT, "reports");

export function defaultState(id) {
  return {
    id,
    status: "idle",
    session_id: null,
    previous_response_id: null,
    last_context_fingerprint: null,
    last_output_id: null,
    run_count: 0,
    last_run_at: null,
    next_run_at: null,
    last_summary: null,
    next_focus: null,
    last_error: null,
    last_usage: null,
    budget: {
      day: null,
      runs: 0,
      tokens: 0,
      last_accounted_response_id: null
    },
    dependency_health: "unknown",
    updated_at: new Date().toISOString()
  };
}

export async function loadState(id) {
  try {
    return JSON.parse(await fs.readFile(path.join(STATE_DIR, `${id}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return defaultState(id);
    throw error;
  }
}

export async function saveState(state) {
  state.updated_at = new Date().toISOString();
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(STATE_DIR, `${state.id}.json`),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8"
  );
}

export async function appendReport(id, markdown) {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const file = path.join(REPORTS_DIR, `${id}.md`);
  let current = `# ${id} runner report\n`;
  try {
    current = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.writeFile(file, `${current.trimEnd()}\n\n${markdown.trim()}\n`, "utf8");
}

export function nextRunFrom(now, cadenceMinutes) {
  return new Date(now + cadenceMinutes * 60_000).toISOString();
}

export function isDue(config, state, now = Date.now()) {
  if (!config.enabled) return false;
  if (["running", "blocked", "complete"].includes(state.status)) return false;
  if (!state.next_run_at) return true;
  return Date.parse(state.next_run_at) <= now;
}
