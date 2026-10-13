import { resolveFeedbackTarget } from './feedback-control.js';
import { callRunnerControl } from './runner-control.js';

const response = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

// The gateway supplies authenticated=true only after its existing Access check.
// Never accept a claimed actor, owner, or authentication flag from the JSON body.
export async function handleFeedbackBrowser(request, env, { authenticated = false, api } = {}) {
  const url = new URL(request.url);
  if (!['/api/feedback/submit', '/api/feedback/status', '/api/feedback/binding'].includes(url.pathname)) return null;
  if (!authenticated) return response({ error: { class: 'auth', message: 'Authenticated feedback is required' } }, 403);
  try {
    let args, name;
    if (url.pathname.endsWith('/binding')) {
      if (request.method !== 'GET') return response({error:{class:'validation',message:'GET required'}},405);
      const scope={project:url.searchParams.get('project'),assignment:url.searchParams.get('assignment')};
      const head=url.searchParams.get('head_sha');
      if (![...url.searchParams.keys()].every(key=>['project','assignment','head_sha'].includes(key)) || !/^[a-z0-9-]{1,80}$/.test(scope.project||'') || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(scope.assignment||'') || !/^[a-f0-9]{40}$/.test(head||''))
        return response({error:{class:'validation',message:'An exact project, assignment and displayed source version are required'}},400);
      let target=await resolveFeedbackTarget(scope,env,api);
      if(target.terminal)target=await resolveFeedbackTarget({...scope,review_mode:'historical'},env,api);
      if(target.historical?!target.completed_commits.includes(head):target.commit_sha!==head)
        return response({available:false,reason:'Work changed since this view loaded. Refresh before replying.'},409);
      return response({available:true,args:{...scope,expected_owner:target.owner,expected_branch:target.branch,...(target.historical?{review_mode:'historical'}:{}),artifact:{repository:target.repository,commit_sha:head,kind:'source',...(target.pr?{pr:target.pr}:{})}}});
    }
    if (url.pathname.endsWith('/submit')) {
      if (request.method !== 'POST') return response({ error: { class: 'validation', message: 'POST required' } }, 405);
      if (request.headers.get('Origin') !== url.origin) return response({ error: { class: 'permission', message: 'Same-origin feedback required' } }, 403);
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return response({ error: { class: 'validation', message: 'JSON required' } }, 415);
      const reader = request.body?.getReader(), chunks = []; let bytes = 0;
      if (reader) while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 16384) { await reader.cancel(); return response({ error: { class: 'validation', message: 'Feedback exceeds 16 KiB' } }, 413); }
        chunks.push(value);
      }
      const body = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      try { args = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
      catch { return response({ error: { class: 'validation', message: 'Invalid JSON' } }, 400); }
      name = 'relay_runner_feedback_submit';
    } else {
      if (request.method !== 'GET') return response({ error: { class: 'validation', message: 'GET required' } }, 405);
      args = Object.fromEntries(url.searchParams); name = 'relay_runner_feedback_status';
    }
    const result = await callRunnerControl(name, args, {
      ...env, RELAY_FEEDBACK_ACTOR: 'access-protected-browser-caller-unattributed'
    }, api);
    return response(result, result.ok ? 200 : 409);
  } catch (error) {
    const code = error.code || 'provider';
    const status = { validation: 400, auth: 403, permission: 403, conflict: 409, not_found: 404, capacity: 429 }[code] || 503;
    return response({ error: { class: code, message: ['validation', 'conflict', 'not_found'].includes(code) ? error.message : 'Feedback service unavailable; preserve the operation id and inspect status before retrying' } }, status);
  }
}

// Bind from the capture's explicit assignment and owner. Never guess a recipient.
export async function feedbackBindingForEvidence(evidence, env, api) {
  const c = evidence.context || {};
  if (!c.project || !(c.assignment || c.assignment_id) || !c.owner || !c.branch || !/^[a-f0-9]{40}$/.test(c.commit_sha || ''))
    return { available: false, reason: 'This capture lacks an exact assignment, owner, branch or commit. Review notes can still be saved.' };
  const scope = { project: c.project, assignment: c.assignment || c.assignment_id };
  try {
    let target = await resolveFeedbackTarget(scope, env, api);
    if (target.terminal) target = await resolveFeedbackTarget({ ...scope, review_mode: 'historical' }, env, api);
    if (target.owner !== c.owner || target.branch !== c.branch || (c.repository && c.repository !== target.repository))
      return { available: false, reason: 'The captured assignment identity changed. Review saved separately; refresh the work item before routing.' };
    if (target.historical && !target.completed_commits.includes(c.commit_sha)) return { available: false, reason: 'The capture does not match the completed artifact.' };
    return { available: true, args: { ...scope, expected_owner: c.owner, expected_branch: c.branch,
      ...(target.historical ? { review_mode: 'historical' } : {}), artifact: { repository: target.repository, commit_sha: c.commit_sha,
        kind: 'runtime', ...(c.pr_number ? { pr: c.pr_number } : {}), ...(c.deployment_id ? { deployment_id: c.deployment_id } : {}),
        ...(c.runtime_sha256 ? { runtime_sha256: c.runtime_sha256 } : {}) } } };
  } catch { return { available: false, reason: 'Assignment identity could not be verified. Review notes can still be saved.' }; }
}
