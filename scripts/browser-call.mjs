import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function retrySeconds(value, now = Date.now()) {
  if (value == null || value === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? Math.ceil(seconds) : null;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - now) / 1000)) : null;
}

export function classifyResponse(httpStatus, text, retryAfter = null) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { /* HTTP errors may return HTML. */ }
  const result = parsed?.result?.structuredContent;
  const failed = reason => ({
    ...result, ok: false, status: 'failed', reason: result?.reason || reason,
    http_status: httpStatus, ...(parsed?.error ? { rpc_error_code: parsed.error.code } : {})
  });
  const deferred = (reason, extra = {}) => ({
    ...extra, ok: false, status: 'deferred', reason, http_status: httpStatus,
    retry_after: retrySeconds(extra.retry_after) ?? retrySeconds(retryAfter),
    classification: 'BLOCKED/UNVERIFIED — HARNESS', qa_passed: false
  });
  if (httpStatus === 429) return deferred('rate_limit');
  if ([502, 503, 504].includes(httpStatus)) return deferred('provider_outage');
  if (httpStatus !== 200) return failed([401, 403].includes(httpStatus) ? 'auth' : 'http_error');
  if (!parsed || parsed.error || parsed.result?.isError) return failed('inspector_error');
  if (result?.status === 'deferred' && result?.reason === 'browser_capacity' && result?.ok === false) {
    return deferred('browser_capacity', result);
  }
  if (result?.ok !== true || ['failed', 'deferred', 'cancelled'].includes(result?.status)) return failed('inspector_error');
  return { ...result, status: 'complete', http_status: httpStatus };
}

// Only stateless reads can be replayed after an explicit gateway error. A timeout
// may conceal a successful write; session/evidence mutations are never replayed.
export async function callBrowser(body, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), env = process.env } = {}) {
  const request = JSON.parse(body);
  const safeToRetry = ['browser_snapshot', 'browser_screenshot'].includes(request.params?.name);
  for (let attempt = 1; attempt <= 2; attempt++) {
    let response;
    try {
      response = await fetchImpl('https://relay.loew.fi/mcp', {
        method: 'POST', signal: AbortSignal.timeout(60000), body,
        headers: {
          Authorization: JSON.stringify({ 'cf-access-client-id': env.CF_ACCESS_CLIENT_ID, 'cf-access-client-secret': env.CF_ACCESS_CLIENT_SECRET }),
          'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
          'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
          'Content-Type': 'application/json'
        }
      });
      const outcome = classifyResponse(response.status, await response.text(), response.headers.get('retry-after'));
      const delay = outcome.retry_after ?? 2;
      if (safeToRetry && attempt === 1 && outcome.reason === 'provider_outage' && delay <= 10) {
        await sleep(delay * 1000);
        continue;
      }
      return { ...outcome, attempts: attempt, request_id: request.id };
    } catch {
      return { ok: false, status: 'failed', reason: 'transport_unknown_outcome', attempts: attempt, request_id: request.id };
    }
  }
}

export function recordOutcome(outcome, env = process.env) {
  fs.mkdirSync('qa-evidence', { recursive: true });
  fs.writeFileSync('qa-evidence/browser-result.json', JSON.stringify(outcome, null, 2) + '\n');
  console.log('LOEW_INSPECTOR_RESULT=' + JSON.stringify(outcome));
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `status=${outcome.status}\nqa_passed=${outcome.ok === true}\n`);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY,
    `### Inspector browser operation: ${outcome.status}\n\n` +
    (outcome.status === 'deferred' ? '**QA is blocked/unverified. This is not a QA pass.**\n\n' : '') +
    `Result and retry/fallback metadata: \`qa-evidence/browser-result.json\`.\n`);
  if (outcome.status === 'deferred') console.warn('::warning::Inspector deferred by provider capacity; QA remains unverified. See browser-result.json before retrying.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const body = fs.readFileSync(process.argv[2], 'utf8');
  const outcome = await callBrowser(body);
  recordOutcome(outcome);
  process.exitCode = outcome.status === 'failed' ? 1 : 0;
}
