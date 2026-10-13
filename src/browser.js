const DEFAULT_VIEWPORT = Object.freeze({ width: 1440, height: 900, deviceScaleFactor: 1 });
const MAX_BROWSER_TIMEOUT_MS = 30000;

export function normalizeViewport(input = {}) {
  const width = Number(input.width ?? DEFAULT_VIEWPORT.width);
  const height = Number(input.height ?? DEFAULT_VIEWPORT.height);
  const deviceScaleFactor = Number(input.deviceScaleFactor ?? DEFAULT_VIEWPORT.deviceScaleFactor);
  if (!Number.isFinite(width) || width < 320 || width > 3840) throw new Error("Viewport width must be between 320 and 3840");
  if (!Number.isFinite(height) || height < 240 || height > 2160) throw new Error("Viewport height must be between 240 and 2160");
  if (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor < 1 || deviceScaleFactor > 2) throw new Error("deviceScaleFactor must be between 1 and 2");
  return { width: Math.round(width), height: Math.round(height), deviceScaleFactor };
}

export function normalizeSelector(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 512 || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error("Invalid selector");
  }
  return value;
}

export function browserHeaders(accessJwt) {
  if (typeof accessJwt !== "string" || !accessJwt) throw new Error("Missing Access token");
  return { "Cf-Access-Token": accessJwt };
}

export function browserRequestOptions({ url, accessJwt, viewport, timeoutMs = 20000, selector = null, fullPage = false }) {
  if (!(url instanceof URL)) throw new Error("Validated URL required");
  const timeout = Math.min(MAX_BROWSER_TIMEOUT_MS, Math.max(1000, Number(timeoutMs) || 20000));
  const out = {
    url: url.toString(),
    setExtraHTTPHeaders: browserHeaders(accessJwt),
    viewport: normalizeViewport(viewport),
    gotoOptions: { waitUntil: "networkidle2", timeout },
    screenshotOptions: { fullPage: Boolean(fullPage) }
  };
  const normalizedSelector = normalizeSelector(selector);
  if (normalizedSelector) out.selector = normalizedSelector;
  return out;
}

export async function runQuickAction(binding, action, options) {
  if (!binding || typeof binding.quickAction !== "function") {
    throw new Error("Browser Run binding unavailable");
  }
  const response = await binding.quickAction(action, options);
  if (!(response instanceof Response)) throw new Error("Browser Run returned an invalid response");
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    const error = new Error(`Browser Run ${action} failed with status=${response.status}: ${detail}`);
    error.status = response.status;
    const retryAfter = Number(response.headers.get("retry-after") || detail.match(/retryAfter\s*=\s*(\d+)/i)?.[1] || 0);
    if (retryAfter) error.retryAfter = retryAfter;
    throw error;
  }
  return response;
}
