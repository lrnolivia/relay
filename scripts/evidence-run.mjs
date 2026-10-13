import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { getBuiltInRecipe } from "../src/recipe-catalog.js";

const target = new URL(process.env.TARGET_URL || "");
const requestId = process.env.REQUEST_ID || "";
const projectId = process.env.PROJECT_ID || "";
const suiteId = process.env.SUITE || "field.stage0";
const environment = process.env.ENVIRONMENT || "qa";
const clientId = process.env.CF_ACCESS_CLIENT_ID || "";
const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET || "";
const commitSha = process.env.COMMIT_SHA || "";
const prNumber = process.env.PR_NUMBER ? Number(process.env.PR_NUMBER) : null;
const deploymentId = process.env.DEPLOYMENT_ID || "";
const ingestBase = process.env.INSPECTOR_BRIDGE || "https://relay.loew.fi";

if (!/^[a-zA-Z0-9._-]{1,80}$/.test(requestId)) throw new Error("Safe request id required");
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(projectId)) throw new Error("Valid project id required");
if (!clientId || !clientSecret) throw new Error("Inspector bridge credentials required");
const isQaWork = target.pathname === "/qa/work/" + encodeURIComponent(projectId);
const isBuilderSmoke = environment === "smoke" &&
  target.hostname === "field.loew.fi" &&
  target.pathname === "/builder/noauth";
if (target.protocol !== "https:" || !(target.hostname === "field.loew.fi" || target.hostname.endsWith(".field-preview.loew.fi")) ||
    target.username || target.password || target.port || target.search || target.hash ||
    (!isQaWork && !isBuilderSmoke)) {
  throw new Error("TARGET_URL must be field /qa/work/{projectId}, or field.loew.fi/builder/noauth for smoke runs");
}
const routeKind = isBuilderSmoke ? "builder-smoke" : "qa-work";

const runId = "run_" + crypto.randomUUID();
const startedAt = new Date().toISOString();
const accessHeader = JSON.stringify({
  "cf-access-client-id": clientId,
  "cf-access-client-secret": clientSecret
});
const authHeaders = {
  "Authorization": accessHeader,
  "CF-Access-Client-Id": clientId,
  "CF-Access-Client-Secret": clientSecret
};

async function loadRecipe() {
  const builtIn = getBuiltInRecipe(suiteId);
  if (builtIn) return builtIn;
  const response = await fetch(ingestBase + "/recipe/" + encodeURIComponent(suiteId), { headers: authHeaders });
  if (!response.ok) throw new Error("Unknown evidence recipe: " + suiteId);
  const payload = await response.json();
  if (!payload?.recipe?.steps?.length) throw new Error("Stored recipe has no steps");
  return payload.recipe;
}

const recipe = await loadRecipe();
const steps = recipe.steps;

async function postRun(status, completed, extra = {}) {
  const body = {
    run_id: runId,
    request_id: requestId,
    label: suiteId,
    project: "field",
    project_id: projectId,
    environment,
    suite: suiteId,
    recipe_version: recipe.recipe_version,
    engine: "github-chromium",
    engine_reason: "deterministic_recipe",
    status,
    step_total: steps.length,
    step_completed: completed,
    created_at: startedAt,
    ...extra
  };
  const response = await fetch(ingestBase + "/evidence/run", {
    method: "POST",
    headers: { ...authHeaders, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("Unable to update evidence run: " + response.status + " " + (await response.text()).slice(0, 240));
  return response.json();
}

async function uploadCapture({ step, index, screenshot, title, dom, accessibility, assertions, errors, stepStatus, viewport }) {
  const context = {
    project: "field",
    project_id: projectId,
    environment,
    surface: "editor",
    route_kind: routeKind,
    commit_sha: commitSha || null,
    pr_number: Number.isInteger(prNumber) && prNumber > 0 ? prNumber : null,
    deployment_id: deploymentId || null
  };
  const metadata = {
    request_id: requestId,
    target_url: target.toString(),
    kind: "qa_capture",
    context,
    viewport: { width: viewport?.width || 1440, height: viewport?.height || 900, deviceScaleFactor: 1 },
    engine: "github-chromium",
    engine_reason: "deterministic_recipe",
    run_id: runId,
    run_label: suiteId,
    suite: suiteId,
    recipe_version: recipe.recipe_version,
    step_id: step.id,
    step_label: step.label,
    step_index: index + 1,
    step_total: steps.length,
    title,
    dom,
    accessibility,
    assertions,
    trace: [{ action: step.action, value: step.value || null, status: stepStatus }],
    errors
  };
  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  form.set("screenshot", new Blob([screenshot], { type: "image/png" }), step.id + ".png");
  const response = await fetch(ingestBase + "/evidence/ingest", {
    method: "POST",
    headers: authHeaders,
    body: form
  });
  if (!response.ok) throw new Error("Unable to ingest evidence: " + response.status + " " + (await response.text()).slice(0, 240));
  return response.json();
}

async function waitForFirstPaint(page) {
  try {
    await page.getByText("Starting canvas", { exact: true }).waitFor({ state: "hidden", timeout: 15000 });
  } catch {}
  const iframe = page.locator("iframe[data-canvas-iframe]").first();
  const src = await iframe.getAttribute("src").catch(() => null);
  if (!src) throw new Error("Canvas iframe missing");
  const sandbox = page.frameLocator("iframe[data-canvas-iframe]");
  await sandbox.locator("[data-content-root]").first().waitFor({ state: "attached", timeout: 20000 });
  await sandbox.locator("[data-viewport]").first().waitFor({ state: "attached", timeout: 20000 });
}

async function clickLayout(page, value) {
  const control = page.locator("[data-workspace-layout-control]").first();
  const trigger = control.locator("[data-workspace-mode-trigger]").first();
  if (await trigger.getAttribute("aria-expanded") !== "true") {
    await trigger.hover({ timeout: 7000 });
    await page.waitForTimeout(180);
  }

  const option = control.getByRole("button").filter({ hasText: value }).first();
  await option.waitFor({ state: "visible", timeout: 7000 });
  await option.click({ timeout: 7000 });
  await page.waitForTimeout(350);
}

function locatorFor(page, locator) {
  if (!locator || typeof locator !== "object") throw new Error("Recipe interaction requires a locator");
  if (locator.type === "css") return page.locator(locator.value).first();
  if (locator.type === "text") return page.getByText(locator.value, { exact: true }).first();
  if (locator.type === "test_id") return page.getByTestId(locator.value).first();
  if (locator.type === "role") return page.getByRole(locator.value, { name: locator.name || undefined, exact: true }).first();
  throw new Error("Unsupported recipe locator");
}

async function runInteraction(page, interaction) {
  if (interaction.action === "wait") {
    await page.waitForTimeout(Math.min(10000, Math.max(0, Number(interaction.waitMs) || 500)));
    return;
  }
  const target = interaction.locator ? locatorFor(page, interaction.locator) : null;
  if (interaction.action === "click") return target.click({ timeout: 7000 });
  if (interaction.action === "double_click") return target.dblclick({ timeout: 7000 });
  if (interaction.action === "hover") return target.hover({ timeout: 7000 });
  if (interaction.action === "type") return target.fill(String(interaction.value ?? ""), { timeout: 7000 });
  if (interaction.action === "press") return target.press(String(interaction.key || ""), { timeout: 7000 });
  if (interaction.action === "select") return target.selectOption({ label: String(interaction.value ?? "") }, { timeout: 7000 });
  if (interaction.action === "scroll") {
    if (target) return target.scrollIntoViewIfNeeded({ timeout: 7000 });
    return page.mouse.wheel(Number(interaction.deltaX) || 0, Number(interaction.deltaY) || 0);
  }
  throw new Error("Unsupported recipe interaction");
}

async function ensureInspectorMode(page, mode) {
  const compact = page.locator("[data-workspace-right-toggle]").first();
  const expandedBody = page.locator("[data-workspace-right-body]").first();

  if (mode === "compact") {
    if (!await compact.isVisible().catch(() => false)) {
      const collapse = page.locator('[data-workspace-collapse][data-side="right"]').first();
      await collapse.waitFor({ state: "visible", timeout: 7000 });
      await collapse.click({ timeout: 7000 });
      await compact.waitFor({ state: "visible", timeout: 7000 });
    }
    return;
  }

  if (await compact.isVisible().catch(() => false)) {
    const expand = compact.locator('[data-workspace-collapse][data-side="right"]').first();
    await expand.waitFor({ state: "visible", timeout: 7000 });
    await expand.click({ timeout: 7000 });
  }
  await expandedBody.waitFor({ state: "visible", timeout: 7000 });
}

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function pushAssertion(assertions, id, pass, detail) {
  assertions.push({ id, status: pass ? "pass" : "fail", detail });
  if (!pass) throw new Error(detail);
}

async function compactInspectorAssertions(page, step, assertions) {
  const viewport = step.viewport || { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.waitForTimeout(220);
  await ensureInspectorMode(page, "compact");
  await page.waitForTimeout(220);

  const compact = page.locator("[data-workspace-right-toggle]").first();
  const leftRail = page.locator("[data-left-menu-rail]").first();
  const design = compact.getByRole("button", { name: /open design inspector/i }).first();
  const main = compact.locator("[data-inspector-compact-main-tools]").first();
  const actions = compact.locator("[data-inspector-compact-actions]").first();
  const autoHide = actions.locator("[data-workspace-autohide]").first();
  const collapse = actions.locator("[data-workspace-collapse]").first();

  for (const locator of [compact,leftRail,design,main,actions,autoHide,collapse]) {
    await locator.waitFor({ state: "visible", timeout: 7000 });
  }

  const [shell,left,button,mainRect,actionsRect,autoRect,collapseRect] = await Promise.all([
    compact.boundingBox(), leftRail.boundingBox(), design.boundingBox(), main.boundingBox(),
    actions.boundingBox(), autoHide.boundingBox(), collapse.boundingBox()
  ]);
  if (!shell || !left || !button || !mainRect || !actionsRect || !autoRect || !collapseRect) {
    throw new Error("Compact Inspector geometry could not be measured");
  }

  const right = viewport.width - (shell.x + shell.width);
  const bottom = viewport.height - (shell.y + shell.height);
  const inset = (shell.width - button.width) / 2;

  pushAssertion(assertions, "inspector.compact.shell-width",
    Math.abs(shell.width - 52) <= 1,
    "Compact Inspector width=" + round1(shell.width) + "px; expected 52px.");
  pushAssertion(assertions, "inspector.compact.left-right-parity",
    Math.abs(shell.width - left.width) <= 1,
    "Right rail=" + round1(shell.width) + "px; left rail=" + round1(left.width) + "px.");
  pushAssertion(assertions, "inspector.compact.control-width",
    Math.abs(button.width - 32) <= 1,
    "Design control width=" + round1(button.width) + "px; expected 32px.");
  pushAssertion(assertions, "inspector.compact.optical-inset",
    Math.abs(inset - 10) <= 1,
    "Optical side inset=" + round1(inset) + "px; expected 10px.");
  pushAssertion(assertions, "inspector.compact.viewport-margins",
    shell.y >= 11.5 && right >= 11.5 && bottom >= 11.5,
    "Compact margins top=" + round1(shell.y) + " right=" + round1(right) + " bottom=" + round1(bottom) + ".");
  pushAssertion(assertions, "inspector.compact.actions-visible",
    actionsRect.y >= shell.y - 0.5 &&
      actionsRect.y + actionsRect.height <= shell.y + shell.height + 0.5 &&
      autoRect.height > 0 && collapseRect.height > 0,
    "Compact workspace actions stay visible inside the shell at " + viewport.width + "×" + viewport.height + ".");
  pushAssertion(assertions, "inspector.compact.no-overlap",
    mainRect.y + mainRect.height <= actionsRect.y + 0.5,
    "Main tools bottom=" + round1(mainRect.y + mainRect.height) + "; actions top=" + round1(actionsRect.y) + ".");

  assertions.push({
    id: "inspector.compact.geometry",
    status: "info",
    detail: JSON.stringify({
      viewport,
      shell: { x: round1(shell.x), y: round1(shell.y), width: round1(shell.width), height: round1(shell.height) },
      left_width: round1(left.width),
      control_width: round1(button.width),
      optical_inset: round1(inset),
      margins: { right: round1(right), bottom: round1(bottom) },
      main_height: round1(mainRect.height),
      actions_y: round1(actionsRect.y)
    }).slice(0, 300)
  });
}

async function expandedInspectorAssertions(page, step, assertions) {
  const viewport = step.viewport || { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.waitForTimeout(220);
  await ensureInspectorMode(page, "expanded");
  await page.waitForTimeout(260);

  const header = page.locator("[data-workspace-right-header]").first();
  const body = page.locator("[data-workspace-right-body]").first();
  const toolbar = page.locator("#bottom-toolbar-container").first();
  for (const locator of [header,body,toolbar]) await locator.waitFor({ state: "visible", timeout: 7000 });

  const [headRect,bodyRect,toolbarRect] = await Promise.all([
    header.boundingBox(), body.boundingBox(), toolbar.boundingBox()
  ]);
  if (!headRect || !bodyRect || !toolbarRect) throw new Error("Expanded Inspector geometry could not be measured");

  const right = viewport.width - (headRect.x + headRect.width);
  const inspectorBottom = viewport.height - (bodyRect.y + bodyRect.height);
  const toolbarBottom = viewport.height - (toolbarRect.y + toolbarRect.height);

  pushAssertion(assertions, "inspector.expanded.viewport-margins",
    headRect.y >= 11.5 && right >= 11.5 && inspectorBottom >= 11.5,
    "Expanded margins top=" + round1(headRect.y) + " right=" + round1(right) + " bottom=" + round1(inspectorBottom) + ".");
  pushAssertion(assertions, "inspector.expanded.toolbar-bottom",
    Math.abs(inspectorBottom - toolbarBottom) <= 1,
    "Inspector bottom=" + round1(inspectorBottom) + "px; toolbar bottom=" + round1(toolbarBottom) + "px.");

  assertions.push({
    id: "inspector.expanded.geometry",
    status: "info",
    detail: JSON.stringify({
      viewport,
      header: { x: round1(headRect.x), y: round1(headRect.y), width: round1(headRect.width), height: round1(headRect.height) },
      body: { y: round1(bodyRect.y), height: round1(bodyRect.height) },
      margins: { right: round1(right), inspector_bottom: round1(inspectorBottom), toolbar_bottom: round1(toolbarBottom) }
    }).slice(0, 300)
  });
}

async function dragBoundsAssertions(page, step, assertions) {
  const viewport = step.viewport || { width: 1000, height: 620 };
  await page.setViewportSize(viewport);
  await page.waitForTimeout(220);
  await ensureInspectorMode(page, "expanded");
  await page.waitForTimeout(220);

  const header = page.locator("[data-workspace-right-header]").first();
  const body = page.locator("[data-workspace-right-body]").first();
  const handle = page.locator("[data-right-pane-drag-handle]").first();
  await handle.waitFor({ state: "visible", timeout: 7000 });

  async function dragBy(dx, dy) {
    const box = await handle.boundingBox();
    if (!box) throw new Error("Floating Inspector drag handle missing");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(180);
  }

  await dragBy(-5000, -5000);
  const upper = await header.boundingBox();
  if (!upper) throw new Error("Inspector disappeared after upper-left drag");
  pushAssertion(assertions, "inspector.drag.upper-left-bound",
    upper.x >= 11.5 && upper.y >= 11.5,
    "Upper-left drag stopped at x=" + round1(upper.x) + " y=" + round1(upper.y) + ".");

  await dragBy(5000, 5000);
  const [lowerHead,lowerBody] = await Promise.all([header.boundingBox(), body.boundingBox()]);
  if (!lowerHead || !lowerBody) throw new Error("Inspector disappeared after lower-right drag");
  const right = viewport.width - (lowerHead.x + lowerHead.width);
  const bottom = viewport.height - (lowerBody.y + lowerBody.height);
  pushAssertion(assertions, "inspector.drag.lower-right-bound",
    right >= 11.5 && bottom >= 11.5,
    "Lower-right drag stopped with right=" + round1(right) + " bottom=" + round1(bottom) + " margins.");

  assertions.push({
    id: "inspector.drag.geometry",
    status: "info",
    detail: JSON.stringify({
      viewport,
      upper_left: { x: round1(upper.x), y: round1(upper.y) },
      lower_right: { right: round1(right), bottom: round1(bottom) }
    })
  });
}

async function executeStep(page, step) {
  const assertions = [];
  if (step.action === "first-paint") {
    await waitForFirstPaint(page);
    assertions.push({ id: "canvas.first-paint", status: "pass", detail: "Canvas content root and viewport attached." });
    return assertions;
  }
  if (step.action === "workspace-layout") {
    await clickLayout(page, step.value);
    const control = page.locator("[data-workspace-layout-control]").first();
    const trigger = control.locator("[data-workspace-mode-trigger]").first();
    await trigger.waitFor({ state: "visible", timeout: 7000 });
    const activeLabel = (await trigger.getAttribute("aria-label")) || "";
    const pass = activeLabel.toLowerCase().includes(step.value.toLowerCase());
    assertions.push({ id: "workspace.mode", status: pass ? "pass" : "fail", detail: step.value + " layout " + (pass ? "is active." : "did not become active.") });
    if (!pass) throw new Error(step.value + " workspace layout did not become active");
    return assertions;
  }
  if (step.action === "interaction") {
    await runInteraction(page, step.interaction);
    assertions.push({ id: "interaction.completed", status: "pass", detail: step.interaction.action + " completed." });
    return assertions;
  }
  if (step.action === "inspector-geometry") {
    if (step.mode === "compact") await compactInspectorAssertions(page, step, assertions);
    else await expandedInspectorAssertions(page, step, assertions);
    return assertions;
  }
  if (step.action === "inspector-drag-bounds") {
    await dragBoundsAssertions(page, step, assertions);
    return assertions;
  }
  throw new Error("Unsupported recipe step: " + step.action);
}

async function snapshotSummaries(page) {
  const html = await page.content();
  const elementCount = await page.locator("*").count();
  let aria = null;
  try {
    const text = await page.locator("body").ariaSnapshot({ timeout: 5000 });
    aria = {
      available: true,
      line_count: String(text || "").split("\n").filter(Boolean).length,
      bytes: Buffer.byteLength(String(text || ""))
    };
  } catch {
    aria = { available: false, line_count: 0, bytes: 0 };
  }
  return {
    dom: { html_bytes: Buffer.byteLength(html), element_tag_count: elementCount },
    accessibility: aria
  };
}

let browser;
let completed = 0;
let failed = 0;
const captures = [];
await mkdir("qa-evidence", { recursive: true });
try {
  await postRun("running", 0);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const runtimeErrors = [];
  page.on("pageerror", error => runtimeErrors.push("page: " + error.message.slice(0, 260)));
  page.on("requestfailed", request => runtimeErrors.push(("request: " + request.url() + " " + (request.failure()?.errorText || "")).slice(0, 300)));

  const response = await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 25000 });
  if ((response?.status() || 0) !== 200) throw new Error("Editor QA route returned " + (response?.status() || 0));
  await page.waitForTimeout(1200);

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const beforeErrors = runtimeErrors.length;
    let stepStatus = "pass";
    let stepError = null;
    let assertions = [];
    try {
      assertions = await executeStep(page, step);
    } catch (error) {
      stepStatus = "failed";
      stepError = error instanceof Error ? error.message : String(error);
      failed += 1;
    }

    const summaries = await snapshotSummaries(page);
    const screenshot = await page.screenshot({ fullPage: true });
    const viewport = page.viewportSize() || { width: 1440, height: 900 };
    await writeFile(
      "qa-evidence/" + String(index + 1).padStart(2, "0") + "-" + step.id + ".png",
      screenshot,
    );
    const errors = runtimeErrors.slice(beforeErrors, beforeErrors + 20);
    if (stepError) errors.unshift(stepError);
    const stored = await uploadCapture({
      step,
      index,
      screenshot,
      title: await page.title(),
      dom: summaries.dom,
      accessibility: summaries.accessibility,
      assertions,
      errors,
      stepStatus,
      viewport
    });
    completed += 1;
    captures.push({
      evidence_id: stored.evidence_id,
      step_id: step.id,
      status: stepStatus
    });
    await postRun("running", completed, failed ? { error: failed + " step(s) failed" } : {});
  }

  const status = failed ? "failed" : "complete";
  await postRun(status, completed, failed ? { error: failed + " step(s) failed" } : {});
  const finalResult = {
    ok: !failed,
    run_id: runId,
    request_id: requestId,
    suite: suiteId,
    engine: "github-chromium",
    status,
    captures
  };
  await writeFile("qa-evidence/result.json", JSON.stringify(finalResult, null, 2));
  console.log("LOEW_EVIDENCE_RESULT=" + JSON.stringify(finalResult));
  if (failed) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  try { await postRun("failed", completed, { error: message.slice(0, 500) }); } catch {}
  console.log("LOEW_EVIDENCE_RESULT=" + JSON.stringify({
    ok: false,
    run_id: runId,
    request_id: requestId,
    suite: suiteId,
    engine: "github-chromium",
    status: "failed",
    error: message
  }));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
