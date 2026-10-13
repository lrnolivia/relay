import fs from "node:fs/promises";
import path from "node:path";
import { diagnoseInstallLog } from "./classify-install.mjs";

const [id, logPath, testDiagnosticPath] = process.argv.slice(2);
if (!id || !logPath) {
  throw new Error("Usage: node scripts/persist-dependency-state.mjs <worker-id> <npm-ci-log> [test-diagnostic-log]");
}

const statePath = path.join("state", `${id}.json`);
const state = JSON.parse(await fs.readFile(statePath, "utf8"));
const log = await fs.readFile(logPath, "utf8").catch(() => "");
const diagnosis = diagnoseInstallLog(log);
const testDiagnostic = testDiagnosticPath
  ? await fs.readFile(testDiagnosticPath, "utf8").catch(() => "")
  : "";

const install = process.env.INSTALL_OUTCOME ?? "unknown";
const repairGenerate = process.env.REPAIR_GENERATE_OUTCOME ?? "skipped";
const repairInstall = process.env.REPAIR_INSTALL_OUTCOME ?? "skipped";
const build = process.env.BUILD_OUTCOME ?? "skipped";
const tests = process.env.TESTS_OUTCOME ?? "skipped";
const lint = process.env.LINT_OUTCOME ?? "skipped";
const effectiveInstallSucceeded = install === "success" || repairInstall === "success";

let dependencyHealth = "failed";
if (install === "success") dependencyHealth = "healthy";
else if (repairInstall === "success") dependencyHealth = "repairable";

let projectHealth = "blocked";
if (effectiveInstallSucceeded) {
  projectHealth = [build, tests, lint].every((value) => value === "success") ? "healthy" : "failed";
}

state.dependency_health = dependencyHealth;
state.project_health = projectHealth;
state.dependency = {
  checked_at: new Date().toISOString(),
  classification: install === "success" ? "none" : diagnosis.classification,
  reason: install === "success" ? "Clean npm ci succeeded." : diagnosis.reason,
  missing: diagnosis.missing,
  node: process.env.DOCTOR_NODE ?? null,
  npm: process.env.DOCTOR_NPM ?? null,
  workflow_url: process.env.DOCTOR_WORKFLOW_URL ?? null,
  repair_verified: repairInstall === "success" && build === "success",
  checks: {
    initial_install: install,
    repair_lockfile_generation: repairGenerate,
    repaired_clean_install: repairInstall,
    build,
    tests,
    lint,
    test_diagnostic: testDiagnostic ? testDiagnostic.slice(-2000) : null
  }
};

state.last_summary =
  dependencyHealth === "healthy" && projectHealth === "healthy"
    ? "Dependency Doctor passed clean install, build, tests, and lint."
    : dependencyHealth === "repairable" && projectHealth === "healthy"
      ? `Dependency Doctor found a ${diagnosis.classification} issue and verified the lockfile repair through clean install, build, tests, and lint.`
      : dependencyHealth === "repairable"
        ? `The lockfile repair restores a clean install, but project verification is not healthy. ${testDiagnostic ? "Test isolation diagnostics were captured." : "Inspect build, tests, and lint."}`
        : dependencyHealth === "healthy"
          ? "Dependencies install cleanly, but project verification is not healthy."
          : `Dependency Doctor failed: ${diagnosis.reason}`;

if (dependencyHealth === "repairable" && state.dependency.repair_verified && projectHealth === "healthy") {
  state.next_focus = "Open a verified package-lock-only repair PR.";
} else if (dependencyHealth === "repairable" && state.dependency.repair_verified) {
  state.next_focus = "Dependency repair is verified through install and build; project tests/lint have separate failures. Repair may open a draft PR with those warnings.";
} else if (dependencyHealth === "repairable") {
  state.next_focus = "The dependency issue is repairable, but the repair has not cleared install/build verification.";
} else if (dependencyHealth === "healthy" && projectHealth === "healthy") {
  state.next_focus = "Dependency baseline is healthy; continue with the controlled field agent pilot.";
} else if (effectiveInstallSucceeded && projectHealth === "failed") {
  state.next_focus = "Dependency install is healthy; inspect the failing build/test/lint stage.";
} else {
  state.next_focus = "Resolve the dependency diagnosis before enabling the field agent.";
}

state.updated_at = new Date().toISOString();
await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  dependency_health: state.dependency_health,
  project_health: state.project_health,
  dependency: state.dependency
}, null, 2));
