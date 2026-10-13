const API = 'https://api.github.com';
const field = 'lrnolivia/field';
const inspector = 'lrnolivia/relay';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const dryRun = process.argv.includes('--dry-run');

if (!token) throw new Error('GITHUB_TOKEN is required');

async function github(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'relay-preview-scheduler',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`GitHub ${response.status} for ${path}: ${(await response.text()).slice(0, 300)}`);
  }
  return response.status === 204 ? null : response.json();
}

async function allPages(path, maxPages = 5, field = null) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const response = await github(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const batch = field ? response[field] : response;
    if (!Array.isArray(batch)) throw new Error(`Expected an array from ${path}`);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

function deploymentForHead(comments, sha) {
  const short = sha.slice(0, 7).toLowerCase();
  for (const comment of [...comments].reverse()) {
    if (!comment.body?.includes('<!-- Preview Deployments -->')) continue;
    const rows = comment.body.match(/<tr>[\s\S]*?<\/tr>/g) || [];
    for (const row of rows) {
      const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(match => match[1]);
      if (cells.length < 3 || cells[2].trim().toLowerCase() !== short) continue;
      if (!cells[0].includes('Build:</b> Success') || !cells[0].includes('Deployment:</b> Success')) continue;
      const urls = [...cells[1].matchAll(/https:\/\/[a-f0-9]{8}\.(?:field|canvas)-preview\.loew\.fi/g)].map(match => match[0]);
      const editor = urls.find(url => url.endsWith('.field-preview.loew.fi'));
      const canvas = urls.find(url => url.endsWith('.canvas-preview.loew.fi'));
      if (editor && canvas && new URL(editor).hostname.slice(0, 8) === new URL(canvas).hostname.slice(0, 8)) {
        return { editor_url: editor, canvas_url: canvas };
      }
    }
  }
  return null;
}

const pulls = await allPages(`/repos/${field}/pulls?state=open`);
const runs = await allPages(`/repos/${inspector}/actions/workflows/qa-preview.yml/runs?event=workflow_dispatch`, 10, 'workflow_runs');
const known = new Set(runs.map(run => run.display_title));
const result = { checked: pulls.length, dispatched: [], already_queued: [], missing_deployment: [] };

for (const pull of pulls) {
  const requestId = `field-pr${pull.number}-${pull.head.sha.slice(0, 7)}`;
  if (known.has(`field Preview QA / ${requestId}`)) {
    result.already_queued.push(requestId);
    continue;
  }
  const comments = await allPages(`/repos/${field}/issues/${pull.number}/comments`, 3);
  const deployment = deploymentForHead(comments, pull.head.sha);
  if (!deployment) {
    result.missing_deployment.push(requestId);
    continue;
  }
  if (!dryRun) {
    await github(`/repos/${inspector}/actions/workflows/qa-preview.yml/dispatches`, {
      method: 'POST',
      body: JSON.stringify({
        ref: 'main',
        inputs: { ...deployment, head_sha: pull.head.sha, request_id: requestId },
      }),
    });
  }
  result.dispatched.push({ request_id: requestId, ...deployment });
}

console.log('LOEW_PREVIEW_SCHEDULER_RESULT=' + JSON.stringify(result));
