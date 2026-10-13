import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const editor = new URL(process.env.EDITOR_URL);
const canvas = new URL(process.env.CANVAS_URL);
const sha = process.env.HEAD_SHA || '';
const requestId = process.env.REQUEST_ID || '';
const projectId = (process.env.PROJECT_ID || '').trim();
const suffixes = [
  ['.field-preview.loew.fi', editor],
  ['.canvas-preview.loew.fi', canvas],
];

if (!/^[a-f0-9]{40}$/i.test(sha) || !/^[a-zA-Z0-9._-]{1,80}$/.test(requestId)) {
  throw new Error('A full PR head SHA and safe request ID are required');
}
if (projectId && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(projectId)) {
  throw new Error('Invalid field project ID');
}
for (const [suffix, url] of suffixes) {
  if (url.protocol !== 'https:' || !url.hostname.endsWith(suffix) ||
      url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') {
    throw new Error(`Invalid Preview URL for ${suffix}`);
  }
}
const editorName = editor.hostname.slice(0, -suffixes[0][0].length);
const canvasName = canvas.hostname.slice(0, -suffixes[1][0].length);
if (!editorName || editorName !== canvasName) {
  throw new Error('Editor and Canvas must use the same Preview deployment name');
}
if (!/^[a-f0-9]{8}$/.test(editorName)) {
  throw new Error('Use matching immutable deployment URLs from the Cloudflare PR comment');
}

const editorTarget = new URL(
  projectId ? `/qa/work/${encodeURIComponent(projectId)}` : '/builder/noauth',
  editor,
);

const result = {
  request_id: requestId,
  head_sha: sha,
  project_id: projectId || null,
  editor_url: editor.href,
  editor_target: editorTarget.href,
  canvas_url: canvas.href,
  checks: {},
};

async function inspect(url) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  return {
    status: response.status,
    content_type: response.headers.get('content-type') || '',
    headers: Object.fromEntries([
      'cross-origin-resource-policy', 'cross-origin-opener-policy',
      'cross-origin-embedder-policy', 'origin-agent-cluster', 'cf-ray',
    ].map(key => [key, response.headers.get(key)])),
    body_prefix: (await response.text()).slice(0, 160),
  };
}

async function inspectBuild(url) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  return {
    status: response.status,
    content_type: response.headers.get('content-type') || '',
    cf_ray: response.headers.get('cf-ray'),
    body: body.slice(0, 1600),
  };
}

await mkdir('qa-evidence', { recursive: true });
let browser;
try {
  result.checks.editor_http = await inspect(editorTarget);
  result.checks.canvas_http = await inspect(canvas);
  result.checks.editor_build = await inspectBuild(new URL('/api/build', editor));

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message.slice(0, 300)));
  page.on('requestfailed', request => browserErrors.push(`${request.url()} ${request.failure()?.errorText}`.slice(0, 300)));
  const response = await page.goto(editorTarget.href, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.waitForTimeout(5000);
  try {
    await page.getByText('Starting canvas', { exact: true }).waitFor({ state: 'hidden', timeout: 15000 });
  } catch { /* Record the unresolved loading state below. */ }
  const iframe = page.locator('iframe[data-canvas-iframe]').first();
  const iframeSrc = await iframe.getAttribute('src').catch(() => null);
  const scriptSrcs = await page.locator('script[src]').evaluateAll(nodes =>
    nodes.map(node => node instanceof HTMLScriptElement ? node.src : '').filter(Boolean),
  );
  const bundleMarkers = [];
  for (const src of scriptSrcs) {
    try {
      const scriptResponse = await page.request.get(src, { timeout: 15000 });
      const scriptBody = await scriptResponse.text();
      bundleMarkers.push({
        src,
        status: scriptResponse.status(),
        bytes: scriptBody.length,
        has_preview_sandbox_path: scriptBody.includes('/preview-sandbox/index.html'),
        has_field_preview_suffix: scriptBody.includes('.field-preview.loew.fi'),
      });
    } catch (error) {
      bundleMarkers.push({
        src,
        status: 0,
        error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      });
    }
  }
  let firstPaint = false;
  if (iframeSrc?.startsWith(canvas.origin + '/')) {
    try {
      const sandbox = page.frameLocator('iframe[data-canvas-iframe]');
      await sandbox.locator('[data-content-root]').first().waitFor({ state: 'attached', timeout: 20000 });
      await sandbox.locator('[data-viewport]').first().waitFor({ state: 'attached', timeout: 20000 });
      firstPaint = true;
    } catch { /* Record the missing Canvas paint below. */ }
  }
  await page.screenshot({ path: 'qa-evidence/editor.png', fullPage: true });
  result.checks.editor_browser = {
    status: response?.status() ?? 0,
    final_url: page.url(),
    title: await page.title(),
    starting_canvas_visible: await page.getByText('Starting canvas', { exact: true }).isVisible(),
    canvas_iframe_src: iframeSrc,
    canvas_first_paint: firstPaint,
    script_srcs: scriptSrcs,
    bundle_markers: bundleMarkers,
    errors: browserErrors.slice(0, 10),
  };
  const canvasPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const canvasResponse = await canvasPage.goto(canvas.href, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await canvasPage.screenshot({ path: 'qa-evidence/canvas.png', fullPage: true });
  result.checks.canvas_browser = {
    status: canvasResponse?.status() ?? 0,
    title: await canvasPage.title(),
  };
} finally {
  if (browser) await browser.close();
  console.log('LOEW_QA_RESULT=' + JSON.stringify(result));
}

const canvasHeaders = result.checks.canvas_http.headers;
const passed = result.checks.editor_browser.status === 200 &&
  !result.checks.editor_browser.starting_canvas_visible &&
  result.checks.editor_browser.canvas_first_paint &&
  result.checks.canvas_http.status === 200 &&
  result.checks.canvas_http.content_type.includes('text/html') &&
  result.checks.canvas_browser.status === 200 &&
  result.checks.canvas_browser.title === 'Canvas Sandbox' &&
  canvasHeaders['cross-origin-resource-policy'] === 'cross-origin' &&
  canvasHeaders['cross-origin-opener-policy'] === 'same-origin' &&
  canvasHeaders['cross-origin-embedder-policy'] === 'credentialless' &&
  canvasHeaders['origin-agent-cluster'] === '?1';

if (!passed) process.exitCode = 1;
