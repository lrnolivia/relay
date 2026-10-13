import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("evidence workflow offers the stage0 multi-capture suite", async () => {
  const workflow = await readFile(new URL("../.github/workflows/evidence.yml", import.meta.url), "utf8");
  assert.match(workflow, /field\.stage0/);
  assert.match(workflow, /scripts\/evidence-run\.mjs/);
});

test("evidence runner uses one Chromium launch for the suite", async () => {
  const source = await readFile(new URL("./evidence-run.mjs", import.meta.url), "utf8");
  assert.equal((source.match(/chromium\.launch/g) || []).length, 1);
  assert.match(source, /LOEW_EVIDENCE_RESULT=/);
});


test("workspace layout recipes expand the real field layout control", async () => {
  const source = await readFile(new URL("./evidence-run.mjs", import.meta.url), "utf8");
  assert.match(source, /data-workspace-layout-control/);
  assert.match(source, /data-workspace-mode-trigger/);
  assert.match(source, /filter\(\{ hasText: value \}\)/);
});


test("evidence runner resolves recipes from the versioned catalog or Inspector store", async () => {
  const source = await readFile(new URL("./evidence-run.mjs", import.meta.url), "utf8");
  assert.match(source, /getBuiltInRecipe/);
  assert.match(source, /\/recipe\//);
  assert.match(source, /recipe_version/);
  assert.match(source, /workspace\.mode/);
});


test("workspace layout recipe reuses an already-expanded control between suite steps", async () => {
  const source = await readFile(new URL("./evidence-run.mjs", import.meta.url), "utf8");
  assert.match(source, /getAttribute\("aria-expanded"\) !== "true"/);
  assert.doesNotMatch(source, /await control\.locator\("\[data-workspace-mode-trigger\]"\)\.hover/);
});


test("workspace mode assertion reads the collapsed trigger's active-layout label", async () => {
  const source = await readFile(new URL("./evidence-run.mjs", import.meta.url), "utf8");
  assert.match(source, /trigger\.waitFor\(\{ state: "visible"/);
  assert.match(source, /trigger\.getAttribute\("aria-label"\)/);
  assert.match(source, /activeLabel\.toLowerCase\(\)\.includes\(step\.value\.toLowerCase\(\)\)/);
});


test("evidence runner keeps read-only QA and editable builder smoke as separate lanes", async () => {
  const source = await readFile(new URL("./evidence-run.mjs", import.meta.url), "utf8");
  assert.match(source, /isBuilderSmoke/);
  assert.match(source, /builder\\/noauth/);
  assert.match(source, /routeKind = isBuilderSmoke/);
  assert.match(source, /qa-evidence/);
});


test("compact Inspector recipe verifies responsive geometry and hard margins", async () => {
  const source = await readFile(new URL("./evidence-run.mjs", import.meta.url), "utf8");
  assert.match(source, /data-workspace-right-toggle/);
  assert.match(source, /data-inspector-compact-main-tools/);
  assert.match(source, /data-inspector-compact-actions/);
  assert.match(source, /inspector\.compact\.shell-width/);
  assert.match(source, /inspector\.compact\.optical-inset/);
  assert.match(source, /inspector\.expanded\.toolbar-bottom/);
  assert.match(source, /inspector\.drag\.upper-left-bound/);
  assert.match(source, /inspector\.drag\.lower-right-bound/);
  assert.match(source, /page\.setViewportSize/);
});

test("evidence viewport metadata follows each deterministic recipe step", async () => {
  const source = await readFile(new URL("./evidence-run.mjs", import.meta.url), "utf8");
  assert.match(source, /const viewport = page\.viewportSize\(\)/);
  assert.match(source, /width: viewport\?\.width/);
  assert.match(source, /height: viewport\?\.height/);
});
