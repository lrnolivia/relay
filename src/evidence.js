import { writeEvidenceIndex } from "./evidence-index.js";
const SAFE_REQUEST_ID = /^[a-zA-Z0-9._-]{1,80}$/;
const SAFE_CONTEXT_TEXT = /^[a-zA-Z0-9._:/-]{1,240}$/;
const RETENTION_DAYS = 30;

function safeRequestId(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !SAFE_REQUEST_ID.test(value)) throw new Error("Invalid request_id");
  return value;
}

function safeContextText(value, max = 128) {
  if (value == null || value === "") return null;
  const text = String(value);
  if (text.length > max || !SAFE_CONTEXT_TEXT.test(text)) throw new Error("Invalid evidence context");
  return text;
}

export function normalizeEvidenceContext(value = null) {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid evidence context");
  const environment = value.environment ?? "unknown";
  if (!["production","preview","qa","smoke","unknown"].includes(environment)) throw new Error("Invalid evidence environment");
  const routeKind = value.route_kind ?? "other";
  if (!["qa-work","builder-smoke","runner","other"].includes(routeKind)) throw new Error("Invalid evidence route kind");
  const prNumber = value.pr_number == null ? null : Number(value.pr_number);
  if (prNumber != null && (!Number.isInteger(prNumber) || prNumber < 1 || prNumber > 1000000)) throw new Error("Invalid PR number");
  return {
    project: safeContextText(value.project, 80),
    assignment: safeContextText(value.assignment, 100),
    owner: safeContextText(value.owner, 100),
    branch: safeContextText(value.branch, 240),
    project_id: safeContextText(value.project_id, 128),
    environment,
    surface: safeContextText(value.surface, 80),
    route_kind: routeKind,
    commit_sha: safeContextText(value.commit_sha, 64),
    pr_number: prNumber,
    deployment_id: safeContextText(value.deployment_id, 128)
  };
}

function datePrefix(now = new Date()) {
  const iso = now.toISOString();
  return iso.slice(0, 10).replaceAll("-", "/");
}

export function decodeBase64Bytes(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("Snapshot returned no screenshot");
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function countAccessibilityNodes(value) {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countAccessibilityNodes(item), 0);
  if (!value || typeof value !== "object") return 0;
  return 1 + Object.values(value).reduce((sum, item) => sum + countAccessibilityNodes(item), 0);
}

export function summarizeSnapshot(result = {}) {
  const html = typeof result.content === "string" ? result.content : "";
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
  const tagCount = (html.match(/<[a-z][^>]*>/gi) || []).length;
  return {
    title,
    dom: {
      html_bytes: new TextEncoder().encode(html).byteLength,
      element_tag_count: tagCount
    },
    accessibility: {
      node_count: countAccessibilityNodes(result.accessibilityTree ?? result.accessibility_tree ?? null),
      available: Boolean(result.accessibilityTree ?? result.accessibility_tree)
    }
  };
}

export async function storeEvidence(bucket, {
  requestId,
  targetUrl,
  kind,
  screenshotBytes,
  browserMs,
  viewport,
  selector = null,
  fullPage = false,
  durationMs,
  context = null,
  engine = "browser-run",
  engineReason = "direct_browser_capture",
  extra = {}
}) {
  if (!bucket || typeof bucket.put !== "function") throw new Error("Evidence R2 binding unavailable");
  if (!(screenshotBytes instanceof Uint8Array) || screenshotBytes.byteLength === 0) throw new Error("Screenshot evidence is empty");
  const capturedAt = new Date().toISOString();
  const expiresAt = new Date(Date.parse(capturedAt) + RETENTION_DAYS * 86400000).toISOString();
  const normalizedContext = normalizeEvidenceContext(context);
  const id = `vis_${crypto.randomUUID()}`;
  const prefix = `visual/${datePrefix(new Date(capturedAt))}/${id}`;
  const screenshotKey = `${prefix}.png`;
  const metadataKey = `${prefix}.json`;
  const metadata = {
    ok: true,
    evidence_id: id,
    request_id: safeRequestId(requestId),
    kind,
    target_url: targetUrl,
    captured_at: capturedAt,
    expires_at: expiresAt,
    retention_days: RETENTION_DAYS,
    context: normalizedContext,
    engine,
    engine_reason: engineReason,
    viewport,
    selector,
    full_page: Boolean(fullPage),
    browser_ms: browserMs,
    duration_ms: durationMs,
    screenshot_key: screenshotKey,
    metadata_key: metadataKey,
    screenshot_bytes: screenshotBytes.byteLength,
    ...extra
  };
  await Promise.all([
    bucket.put(screenshotKey, screenshotBytes, {
      httpMetadata: { contentType: "image/png", cacheControl: "private, max-age=0, no-store" },
      customMetadata: { evidenceId: id, kind, capturedAt }
    }),
    bucket.put(metadataKey, JSON.stringify(metadata), {
      httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "private, max-age=0, no-store" },
      customMetadata: { evidenceId: id, kind, capturedAt }
    })
  ]);
  await writeEvidenceIndex(bucket, metadata);
  return metadata;
}

