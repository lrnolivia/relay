import test from "node:test";
import assert from "node:assert/strict";
import { classifyInstallLog, diagnoseInstallLog } from "../scripts/classify-install.mjs";

test("classifies lockfile mismatch", () => {
  assert.equal(classifyInstallLog("npm ERR! code EUSAGE\nnpm ci can only install"), "lockfile");
});

test("classifies peer dependency conflict", () => {
  assert.equal(classifyInstallLog("npm ERR! code ERESOLVE unable to resolve dependency tree"), "peer-dependency");
});

test("classifies network trouble", () => {
  assert.equal(classifyInstallLog("npm ERR! code EAI_AGAIN registry.npmjs.org"), "registry-network");
});

test("leaves unknown failures unclassified", () => {
  assert.equal(classifyInstallLog("something strange happened"), "unclassified");
});

test("extracts missing lockfile package", () => {
  const diagnosis = diagnoseInstallLog([
    "npm error code EUSAGE",
    "npm error npm ci can only install packages when your package.json and package-lock.json are in sync.",
    "npm error Missing: @swc/helpers@0.5.23 from lock file"
  ].join("\n"));

  assert.equal(diagnosis.classification, "lockfile");
  assert.equal(diagnosis.reason, "Missing: @swc/helpers@0.5.23 from lock file");
  assert.deepEqual(diagnosis.missing, ["@swc/helpers@0.5.23 from lock file"]);
});
