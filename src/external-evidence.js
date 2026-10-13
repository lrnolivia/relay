import { normalizeEvidenceContext, storeEvidence } from "./evidence.js";

const RUN_ID_RE = /^run_[a-zA-Z0-9._-]{8,128}$/;
const SAFE_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;
const RUN_STATES = new Set(["requested","queued","running","captured","comparing","complete","deferred","failed","cancelled"]);
const ENGINES = new Set(["http","github-chromium","browser-run"]);

function safeText(value, max = 160) {
  if (value == null || value === "") return null;
  const text = String(value)
    .replace(/[\x00-\x1f\x7f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return text || null;
}

function validateTarget(value) {
  const url = new URL(String(value));
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (host !== "loew.fi" && !host.endsWith(".loew.fi")) ||
      url.username || url.password || url.port || url.hash) {
    throw new Error("Evidence target must be HTTPS loew.fi");
  }
  return url.toString();
}

function runKey(runId) {
  if (!RUN_ID_RE.test(runId)) throw new Error("Invalid evidence run id");
  return "runs/" + runId + ".json";
}

export function normalizeExternalEvidenceMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid evidence metadata");
  const engine = String(value.engine || "");
  if (!ENGINES.has(engine)) throw new Error("Invalid evidence engine");
  const runId = value.run_id == null ? null : String(value.run_id);
  if (runId && !RUN_ID_RE.test(runId)) throw new Error("Invalid evidence run id");
  const stepIndex = value.step_index == null ? null : Number(value.step_index);
  const stepTotal = value.step_total == null ? null : Number(value.step_total);
  if (stepIndex != null && (!Number.isInteger(stepIndex) || stepIndex < 1 || stepIndex > 1000)) throw new Error("Invalid step index");
  if (stepTotal != null && (!Number.isInteger(stepTotal) || stepTotal < 1 || stepTotal > 1000)) throw new Error("Invalid step total");
  return {
    request_id: safeText(value.request_id, 80),
    target_url: validateTarget(value.target_url),
    kind: safeText(value.kind || "screenshot", 48),
    context: normalizeEvidenceContext(value.context),
    viewport: {
      width: Math.max(320, Math.min(3840, Number(value.viewport?.width) || 1440)),
      height: Math.max(240, Math.min(2160, Number(value.viewport?.height) || 900)),
      deviceScaleFactor: Math.max(1, Math.min(2, Number(value.viewport?.deviceScaleFactor) || 1))
    },
    engine,
    engine_reason: safeText(value.engine_reason, 120),
    run_id: runId,
    run_label: safeText(value.run_label, 120),
    suite: safeText(value.suite, 120),
    recipe_version: value.recipe_version == null ? null : Math.max(1, Math.min(1000000, Number(value.recipe_version) || 1)),
    step_id: safeText(value.step_id, 120),
    step_label: safeText(value.step_label, 120),
    step_index: stepIndex,
    step_total: stepTotal,
    title: safeText(value.title, 200),
    dom: value.dom && typeof value.dom === "object" ? value.dom : null,
    accessibility: value.accessibility && typeof value.accessibility === "object" ? value.accessibility : null,
    assertions: Array.isArray(value.assertions) ? value.assertions.slice(0, 40).map(item => ({
      id: safeText(item?.id, 120),
      status: ["pass","fail","info"].includes(item?.status) ? item.status : "info",
      detail: safeText(item?.detail, 300)
    })) : [],
    trace: Array.isArray(value.trace) ? value.trace.slice(0, 100) : [],
    errors: Array.isArray(value.errors) ? value.errors.slice(0, 20).map(item => safeText(item, 300)) : []
  };
}

export async function ingestExternalEvidence(request, bucket) {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json" } });
  const form = await request.formData();
  const rawMetadata = form.get("metadata");
  const screenshot = form.get("screenshot");
  if (typeof rawMetadata !== "string") throw new Error("metadata field required");
  if (!(screenshot instanceof File) || screenshot.type !== "image/png") throw new Error("PNG screenshot required");
  if (screenshot.size <= 0 || screenshot.size > 12 * 1024 * 1024) throw new Error("Screenshot size out of bounds");
  const metadata = normalizeExternalEvidenceMetadata(JSON.parse(rawMetadata));
  const bytes = new Uint8Array(await screenshot.arrayBuffer());
  const stored = await storeEvidence(bucket, {
    requestId: metadata.request_id,
    targetUrl: metadata.target_url,
    kind: metadata.kind,
    screenshotBytes: bytes,
    browserMs: null,
    viewport: metadata.viewport,
    durationMs: null,
    context: metadata.context,
    engine: metadata.engine,
    engineReason: metadata.engine_reason,
    extra: {
      run_id: metadata.run_id,
      run_label: metadata.run_label,
      suite: metadata.suite,
      recipe_version: metadata.recipe_version,
      step_id: metadata.step_id,
      step_label: metadata.step_label,
      step_index: metadata.step_index,
      step_total: metadata.step_total,
      title: metadata.title,
      dom: metadata.dom,
      accessibility: metadata.accessibility,
      assertions: metadata.assertions,
      trace: metadata.trace,
      errors: metadata.errors
    }
  });
  return new Response(JSON.stringify(stored), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

export function normalizeEvidenceRun(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid evidence run");
  const runId = String(value.run_id || "");
  if (!RUN_ID_RE.test(runId)) throw new Error("Invalid evidence run id");
  const state = String(value.status || "");
  if (!RUN_STATES.has(state)) throw new Error("Invalid evidence run state");
  const engine = value.engine == null ? null : String(value.engine);
  if (engine && !ENGINES.has(engine)) throw new Error("Invalid evidence engine");
  const now = new Date().toISOString();
  return {
    run_id: runId,
    request_id: safeText(value.request_id, 80),
    label: safeText(value.label, 120),
    project: safeText(value.project, 80),
    project_id: value.project_id && SAFE_ID_RE.test(String(value.project_id)) ? String(value.project_id) : null,
    environment: safeText(value.environment || "unknown", 32),
    suite: safeText(value.suite, 120),
    engine,
    engine_reason: safeText(value.engine_reason, 120),
    status: state,
    step_total: Math.max(0, Math.min(1000, Number(value.step_total) || 0)),
    step_completed: Math.max(0, Math.min(1000, Number(value.step_completed) || 0)),
    retry_after: value.retry_after == null ? null : Math.max(0, Number(value.retry_after) || 0),
    fallback_engine: value.fallback_engine == null ? null : safeText(value.fallback_engine, 48),
    error: safeText(value.error, 500),
    created_at: safeText(value.created_at, 40) || now,
    updated_at: now
  };
}

export async function upsertEvidenceRun(request, bucket) {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json" } });
  const raw = await request.text();
  if (raw.length > 32768) throw new Error("Evidence run payload too large");
  const next = normalizeEvidenceRun(JSON.parse(raw));
  const key = runKey(next.run_id);
  const existingObject = await bucket.get(key);
  let existing = null;
  if (existingObject) {
    try { existing = await existingObject.json(); } catch {}
  }
  if (existing?.created_at) next.created_at = existing.created_at;
  await bucket.put(key, JSON.stringify(next), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "private, max-age=0, no-store" },
    customMetadata: { runId: next.run_id, status: next.status, updatedAt: next.updated_at }
  });
  return new Response(JSON.stringify({ ok: true, run: next }), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
