import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const WORKERS_DIR = path.join(ROOT, "workers");

export async function listWorkerIds() {
  const names = await fs.readdir(WORKERS_DIR);
  return names.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)).sort();
}

export async function loadWorker(id) {
  const raw = await fs.readFile(path.join(WORKERS_DIR, `${id}.json`), "utf8");
  const config = JSON.parse(raw);
  validateWorker(config, id);
  return config;
}

export async function loadAllWorkers() {
  return Promise.all((await listWorkerIds()).map(loadWorker));
}

export async function saveWorker(config) {
  validateWorker(config, config.id);
  await fs.writeFile(
    path.join(WORKERS_DIR, `${config.id}.json`),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8"
  );
}

export function validateWorker(config, expectedId = config?.id) {
  if (!config || typeof config !== "object") throw new Error(`Invalid worker: ${expectedId}`);
  if (config.id !== expectedId) throw new Error(`Worker id mismatch: ${expectedId}`);
  if (!config.name) throw new Error(`${expectedId}: name is required`);
  if (typeof config.enabled !== "boolean") throw new Error(`${expectedId}: enabled must be boolean`);
  if (!Number.isFinite(config.cadence_minutes) || config.cadence_minutes < 60) {
    throw new Error(`${expectedId}: cadence_minutes must be at least 60 in v0.1`);
  }
  if (!config.model?.id) throw new Error(`${expectedId}: model.id is required`);
  if (config.limits?.max_runs_per_day != null && (!Number.isInteger(config.limits.max_runs_per_day) || config.limits.max_runs_per_day < 1)) {
    throw new Error(`${expectedId}: limits.max_runs_per_day must be a positive integer`);
  }
  if (config.limits?.max_tokens_per_day != null && (!Number.isFinite(config.limits.max_tokens_per_day) || config.limits.max_tokens_per_day < 1)) {
    throw new Error(`${expectedId}: limits.max_tokens_per_day must be positive`);
  }
  if (!["none", "low", "medium", "high", "xhigh", "max"].includes(config.model.reasoning_effort)) {
    throw new Error(`${expectedId}: unsupported reasoning effort`);
  }
  if (!config.target?.repository || !config.target?.branch) {
    throw new Error(`${expectedId}: target repository and branch are required`);
  }
  if (config.target.write_mode !== "read_only") {
    throw new Error(`${expectedId}: v0.1 only permits read_only target mode`);
  }
  if (!config.goal?.trim()) throw new Error(`${expectedId}: goal is required`);
}
