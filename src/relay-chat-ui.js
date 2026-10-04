import { STAFF } from './staff-registry.js';
import { contextCardBrandAssets } from '../apps/web/generated.js';
import { styleContextCard } from './relay-context-card-style.js';
export const RELAY_CONTEXT_CARD_URI = 'ui://relay/context-card/v15.html';
export const RELAY_CONTEXT_CARD_TOOL = 'relay_render_context_card';
export const RELAY_STATUS_CARD_URI = 'ui://relay/status-card/v3-legacy-bridge.html';
export const RELAY_STATUS_CARD_TOOL = 'relay_show_legacy_bridge_card';
const CONTROL_URI = 'ui://relay/control-center/v2.html';
const DIRECTORY = Object.fromEntries(STAFF.map(p => [p.id, p.display_name]));
const CONTEXTUAL_TOOLS = new Set([
  'relay_runner_project','relay_runner_assignments','relay_runner_progress','relay_runner_resume','relay_runner_updates','relay_runner_coordinate','relay_runner_preflight',
  'relay_source_inventory','relay_source_pull_request','relay_source_checks','relay_source_pull_request_action',
  'relay_cloud_worker','relay_cloud_project','relay_cloud_deploy_version','relay_cloud_deploy_project_version',
  'relay_verify_browser_snapshot','relay_verify_browser_screenshot','relay_verify_evidence_plan','relay_verify_browser_capture',RELAY_CONTEXT_CARD_TOOL,RELAY_STATUS_CARD_TOOL
]);
export function relayContextCardDescriptor() {
  return { uri: RELAY_CONTEXT_CARD_URI, name: 'relay-context-card', title: 'Relay contextual status card', description: 'Compact staff, progress, handoff, blocker and QA context.', mimeType: 'text/html;profile=mcp-app' };
}
export function relayContextCardTool() {
  return {
    name: RELAY_CONTEXT_CARD_TOOL,
    title: 'Show Relay status card',
    description: 'RENDER TOOL — visibly mount a compact Relay status card in ChatGPT. Omit project for the overall report; navigate projects and assignments inside the same card, without posting follow-up messages. Optionally show an existing Inspector QA screenshot by exact evidence id, or the latest stored QA screenshot for the project. Relay re-reads canonical Runner state server-side and reuses canonical Inspector evidence; it never invents progress or captures a second image. This is read-only and safe to retry.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[a-z0-9-]+$' },
        assignment: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$' },
        evidence_id: { type: 'string', minLength: 12, maxLength: 132, pattern: '^vis_[a-zA-Z0-9-]{8,128}$', description: 'Optional existing Inspector visual-evidence id to show inside the card.' },
        show_qa: { type: 'boolean', description: 'When true and no evidence_id is supplied, show the latest existing Inspector QA screenshot for the project when available.' }
      },
      required: [],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    _meta: {
      ui: { resourceUri: RELAY_CONTEXT_CARD_URI, visibility: ['model','app'] },
      'openai/outputTemplate': RELAY_CONTEXT_CARD_URI,
      'openai/widgetAccessible': true,
      'openai/toolInvocation/invoking': 'Opening Relay…',
      'openai/toolInvocation/invoked': 'Relay card ready.'
    }
  };
}
export function validateRelayContextCardArguments(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Card arguments must be an object');
  for (const key of Object.keys(args)) if (!['project','assignment','evidence_id','show_qa'].includes(key)) throw new Error('Unsupported card argument: '+key);
  if (args.project !== undefined && (typeof args.project !== 'string' || !/^[a-z0-9-]{1,80}$/.test(args.project))) throw new Error('Invalid card project');
  if (args.assignment !== undefined && !args.project) throw new Error('Assignment requires a project');
  if (args.assignment !== undefined && (typeof args.assignment !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(args.assignment))) throw new Error('Invalid card assignment');
  if (args.evidence_id !== undefined && (typeof args.evidence_id !== 'string' || !/^vis_[a-zA-Z0-9-]{8,128}$/.test(args.evidence_id))) throw new Error('Invalid card evidence id');
  if (args.show_qa !== undefined && typeof args.show_qa !== 'boolean') throw new Error('Invalid card show_qa flag');
  return args;
}
export function isContextualRelayTool(name) {
  return CONTEXTUAL_TOOLS.has(name);
}
export function contextualizeRelayTool(tool) {
  if (!tool || tool.name !== RELAY_CONTEXT_CARD_TOOL) return tool;
  const meta = tool._meta || {};
  return { ...tool, _meta: { ...meta,
    ui: { ...(meta.ui || {}), resourceUri: RELAY_CONTEXT_CARD_URI, visibility: meta.ui?.visibility || ['model','app'] },
    'openai/outputTemplate': RELAY_CONTEXT_CARD_URI, 'openai/widgetAccessible': true,
    'openai/toolInvocation/invoking': meta['openai/toolInvocation/invoking'] || 'Opening Relay…',
    'openai/toolInvocation/invoked': meta['openai/toolInvocation/invoked'] || 'Relay card ready.'
  }};
}
// Pure model shared by the real iframe and deterministic consumer tests.
export function contextCardModel(data = {}, directory = DIRECTORY) {
  const states = { active:'Active', working:'Working', queued:'Up next', held:'On hold', completed:'Finished', complete:'Finished', blocked:'Blocked', failed:'Failed', 'waiting-for-human':'Needs your review', 'waiting-on-external-system':'Waiting on system', 'reserved-but-idle':'Reserved', 'possibly-stale':'May be stale' };
  const checkpoints = data.checkpoints || [];
  const first = data.claim || (typeof data.assignment === 'object' ? data.assignment : null) || data.claims?.find(x=>x.state!=='completed') || data.claims?.[0] || data.queue?.[0] || data.progress?.[0] || data.latest?.assignment || checkpoints[0]?.assignment || data.coordination?.claims?.find(x=>x.state!=='completed') || {};
  const checkpoint = data.latest || checkpoints[0] || {};
  const technicalNote = text => /[a-f0-9]{24,40}|relay_[a-z_]+|version_id|commit_sha|Worker version|PR #\d+/.test(String(text || ''));
  const human = data.human || {};
  const compactText = (value, limit=140) => { const text=String(value || '').replace(/\s+/g,' ').trim(); return text.length<=limit?text:text.slice(0,limit-1).replace(/\s+\S*$/,'')+'…'; };
  const jobTitle = item => {
    const explicit=item.title || item.display_name;
    const goal=String(item.goal || '').trim();
    if(explicit)return compactText(explicit,72);
    if(goal && goal.length<=90 && !technicalNote(goal))return goal;
    const id=String(item.id || item.assignment || '').replace(/-20\d{6}(?:-.*)?$/,'').replace(/[-_]+/g,' ').trim();
    return compactText(id || goal || 'untitled job',72);
  };
  const name = id => directory[id] || 'Unassigned staff';
  const primary = human.responsible_staff?.display_name || (first.primary_staff ? name(first.primary_staff) : data.primary_staff ? name(data.primary_staff) : 'Relay');
  const supporting = human.supporting_staff?.map(x=>x.display_name) || (first.supporting_staff || data.supporting_staff || []).map(name);
  const team = (first.primary_team ? first.primary_team+" · " : "") + primary + (supporting.length ? ' with ' + supporting.join(', ') : '');
  const status = data.ok === false || data.isError ? 'blocked' : first.state || data.state || checkpoint.state || (human.health === 'blocked' ? 'blocked' : 'recorded');
  const error = typeof data.error === 'string' ? data.error : data.error?.message;
  const checks = Array.isArray(data.checks?.check_runs) ? data.checks.check_runs : Array.isArray(data.check_runs) ? data.check_runs : null;
  const pr = data.pull_request || (data.number && data.head ? data : null);
  const fullTitle = human.outcome || first.goal || data.project || data.script || 'Relay update';
  let title = String(fullTitle).length > 90 ? jobTitle(first) : fullTitle;
  let summary = human.what_changed || error || first.waiting_reason || data.message || first.next_action || checkpoint.next_action || 'Exact Relay result recorded.';
  if (technicalNote(summary) && !error && !first.waiting_reason) summary = checkpoint.identities?.merge_commit_sha ? 'The source change is merged. The next verification gate is ready.' : 'Canonical work state is available. Exact source and runtime details are recorded below.';
  const fullSummary = summary;
  summary = compactText(summary,150);
  let label = states[status] || status;
  let tone = ['blocked','failed','officially-stale'].includes(status) ? 'bad' : status.includes('wait') || status === 'held' ? 'wait' : ['active','working'].includes(status) ? 'info' : ['completed','complete'].includes(status) ? 'good' : 'quiet';
  const jobs = (data.progress || data.claims || data.queue || []).filter(x=>!['completed','complete','cancelled','retired','superseded'].includes(x.state));
  const activeJobs = jobs.filter(x=>['active','working'].includes(x.state));
  let rows = (activeJobs.length ? activeJobs : jobs).slice(0,3).map(x=>({label:jobTitle(x), text:states[x.state] || x.state || 'Recorded'}));
  if (checks) {
    const failed = checks.find(x=>x.status==='completed' && !['success','neutral','skipped'].includes(x.conclusion));
    const running = checks.find(x=>x.status!=='completed');
    title = 'Verification'; label = failed ? 'Failed' : running ? 'Running' : checks.length ? 'Checks complete' : 'No checks recorded'; tone=failed?'bad':running?'info':checks.length?'good':'quiet';
    summary = failed ? failed.name+' failed.' : running ? running.name+' is running.' : checks.length ? 'Recorded checks are complete.' : 'Verification is unconfirmed.';
    rows = checks.slice(0,3).map(x=>({label:x.name,text:x.conclusion||x.status}));
  }
  if (pr) { title=pr.title||'Source change'; label=pr.merged?'Merged':pr.draft?'Draft':'In review'; tone=pr.merged?'good':pr.draft?'quiet':'info'; summary=pr.merged?'The source change is merged.':'The source change is awaiting its next gate.'; }
  const blocker = human.blocker || error || (status==='blocked' ? first.waiting_reason || 'The next gate needs attention.' : null);
  const qa = human.qa || checkpoint.qa_context || data.qa || null;
  const handoff = data.action === 'handoff' ? 'Ownership handed to '+(data.claim?.owner || 'the recorded successor')+'.' : data.handoff?.summary || null;
  const identities = first.identities || checkpoint.identities || data.identities || {};
  const evidence = { assignment:first.id || first.assignment || (typeof data.assignment==='string'?data.assignment:null), owner:first.owner, branch:first.branch || identities.branch, head_sha:identities.head_sha || identities.pr_head_sha || pr?.head?.sha, pr:pr?.number || identities.pr, merge_commit_sha:pr?.merge_commit_sha || identities.merge_commit_sha, version_id:data.version_id, deployment_id:data.deployment?.id, evidence_id:data.evidence_id || data.evidence?.evidence_id, record_sha:data.record_sha, goal:first.goal || fullTitle, summary:fullSummary, next_action:first.next_action || checkpoint.next_action || null };
  const normalize = value => String(value || '').trim().replace(/\s+/g,' ').toLowerCase();
  const rawNext = human.next_step || first.next_action || checkpoint.next_action || null;
  const terminal = ['completed','complete','finished'].includes(String(status).toLowerCase()) || Boolean(pr?.merged);
  let nextStep = terminal ? null : technicalNote(rawNext) ? 'Verify the refreshed chat connection before continuing.' : compactText(rawNext,120);
  if (nextStep && (normalize(rawNext) === normalize(fullSummary) || normalize(nextStep) === normalize(summary) || normalize(summary).includes(normalize(nextStep)))) nextStep = null;
  if (rows.length === 1 && rows[0].label === primary && normalize(rows[0].text) === normalize(label)) rows = [];
  const primaryTeam = first.primary_team || data.primary_team || (checks ? 'inspector' : pr ? 'source' : 'relay');
  const feature = ['relay','runner','inspector','night-shift','source','cloud','release','skills'].includes(primaryTeam) ? primaryTeam : 'relay';
  const signal = tone === 'bad' ? 'danger' : tone === 'wait' ? 'external' : tone === 'info' ? 'working' : tone === 'good' ? 'steady' : 'quiet';
  const rawPercent = first.progress_percent ?? first.percent ?? first.completion?.percent ?? data.progress_percent ?? null;
  const hasPercent = typeof rawPercent === 'number' || typeof rawPercent === 'string' && rawPercent.trim() !== '';
  const percent = hasPercent && Number.isFinite(Number(rawPercent)) && Number(rawPercent) >= 0 && Number(rawPercent) <= 100 ? Math.round(Number(rawPercent)) : null;
  let metric = percent != null ? percent+'%' : label;
  let metric_label = percent != null ? 'completion' : 'current state';
  if (!checks && !pr && jobs.length && percent == null) { metric=String(data.coverage?.active ?? activeJobs.length); metric_label='active jobs'; }
  if (checks) { const done=checks.filter(x=>x.status==='completed').length; metric=checks.length ? done+'/'+checks.length : label; metric_label=checks.length ? 'checks reported' : 'verification'; }
  if (pr?.number) { metric='#'+pr.number; metric_label=pr.merged?'merged pull request':pr.draft?'draft pull request':'pull request'; }
  return { title, feature, primary_staff:primary, team, label, tone, signal, summary, rows, blocker, qa, handoff, next_step:nextStep, metric, metric_label, percent, evidence:Object.fromEntries(Object.entries(evidence).filter(([,v])=>v!=null)), refresh:Boolean(data.project) };
}
// UI responses must not repeat the full historical coordination ledger.
export function compactContextCardResult(result = {}) {
  const text = (value, limit = 420) => typeof value === 'string' ? value.slice(0, limit) : undefined;
  const fields = ['id','assignment','owner','state','primary_staff','primary_team','branch','updated_at','created_at','completed_at','last_meaningful_progress_at'];
  const projectItem = item => {
    const out = {};
    for (const key of fields) if (typeof item?.[key] === 'string') out[key] = text(item[key], 180);
    for (const key of ['goal','next_action','waiting_reason','recovery_action']) if (item?.[key]) out[key] = text(item[key]);
    if (Array.isArray(item?.supporting_staff)) out.supporting_staff = item.supporting_staff.slice(0, 4).map(x => text(x, 80)).filter(Boolean);
    if (typeof item?.progress_percent === 'number' && Number.isFinite(item.progress_percent)) out.progress_percent = item.progress_percent;
    if (item?.lease_expired === true) out.lease_expired = true;
    return out;
  };
  const claims = Array.isArray(result.claims) ? result.claims : [];
  const queue = Array.isArray(result.queue) ? result.queue : [];
  const rank = item => ['waiting-for-human','active','working','held','queued','completed'].indexOf(item.state);
  const current = claims.filter(item => !['completed','cancelled','superseded','retired'].includes(item.state));
  const selected = (current.length ? current : claims.slice(-3)).slice().sort((a,b) => Number(Boolean(a.lease_expired))-Number(Boolean(b.lease_expired)) || rank(a)-rank(b)).slice(0, 3);
  const out = {ok:result.ok !== false, schema:'relay-context-card/v1', project:text(result.project,80), checked_at:text(result.checked_at,80), record_sha:text(result.record_sha,80), claims:selected.map(projectItem), queue:queue.filter(item=>item.state==='queued').slice(0,3).map(projectItem), coverage:{claims:claims.length,active:current.filter(item=>['active','working'].includes(item.state)).length,queued:queue.filter(item=>item.state==='queued').length,shown:selected.length}};
  if (result.error) out.error = {message:text(typeof result.error==='string'?result.error:result.error.message)};
  return out;
}

export function contextualPresentation(data) {
  const m=contextCardModel(data);
  return { ...data, human: data.human || { outcome:m.title, health:m.blocker?'blocked':m.tone==='wait'||m.label==='recorded'?'waiting':'healthy', staff:m.team, what_changed:m.summary, next_step:m.next_step, blocker:m.blocker, qa:m.qa } };
}
// Stable browser model source: Worker bundlers must never serialize their transformed functions into an iframe.
// Parity with contextCardModel is verified on actual bundled resources in relay-chat-ui.test.js.
const CONTEXT_CARD_BROWSER_MODEL = String.raw`function contextCardModel(data = {}, directory = DIRECTORY) {
  const states = { active:'Active', working:'Working', queued:'Up next', held:'On hold', completed:'Finished', complete:'Finished', blocked:'Blocked', failed:'Failed', 'waiting-for-human':'Needs your review', 'waiting-on-external-system':'Waiting on system', 'reserved-but-idle':'Reserved', 'possibly-stale':'May be stale' };
  const checkpoints = data.checkpoints || [];
  const first = data.claim || (typeof data.assignment === 'object' ? data.assignment : null) || data.claims?.find(x=>x.state!=='completed') || data.claims?.[0] || data.queue?.[0] || data.progress?.[0] || data.latest?.assignment || checkpoints[0]?.assignment || data.coordination?.claims?.find(x=>x.state!=='completed') || {};
  const checkpoint = data.latest || checkpoints[0] || {};
  const technicalNote = text => /[a-f0-9]{24,40}|relay_[a-z_]+|version_id|commit_sha|Worker version|PR #\d+/.test(String(text || ''));
  const human = data.human || {};
  const compactText = (value, limit=140) => { const text=String(value || '').replace(/\s+/g,' ').trim(); return text.length<=limit?text:text.slice(0,limit-1).replace(/\s+\S*$/,'')+'…'; };
  const jobTitle = item => {
    const explicit=item.title || item.display_name;
    const goal=String(item.goal || '').trim();
    if(explicit)return compactText(explicit,72);
    if(goal && goal.length<=90 && !technicalNote(goal))return goal;
    const id=String(item.id || item.assignment || '').replace(/-20\d{6}(?:-.*)?$/,'').replace(/[-_]+/g,' ').trim();
    return compactText(id || goal || 'untitled job',72);
  };
  const name = id => directory[id] || 'Unassigned staff';
  const primary = human.responsible_staff?.display_name || (first.primary_staff ? name(first.primary_staff) : data.primary_staff ? name(data.primary_staff) : 'Relay');
  const supporting = human.supporting_staff?.map(x=>x.display_name) || (first.supporting_staff || data.supporting_staff || []).map(name);
  const team = (first.primary_team ? first.primary_team+" · " : "") + primary + (supporting.length ? ' with ' + supporting.join(', ') : '');
  const status = data.ok === false || data.isError ? 'blocked' : first.state || data.state || checkpoint.state || (human.health === 'blocked' ? 'blocked' : 'recorded');
  const error = typeof data.error === 'string' ? data.error : data.error?.message;
  const checks = Array.isArray(data.checks?.check_runs) ? data.checks.check_runs : Array.isArray(data.check_runs) ? data.check_runs : null;
  const pr = data.pull_request || (data.number && data.head ? data : null);
  const fullTitle = human.outcome || first.goal || data.project || data.script || 'Relay update';
  let title = String(fullTitle).length > 90 ? jobTitle(first) : fullTitle;
  let summary = human.what_changed || error || first.waiting_reason || data.message || first.next_action || checkpoint.next_action || 'Exact Relay result recorded.';
  if (technicalNote(summary) && !error && !first.waiting_reason) summary = checkpoint.identities?.merge_commit_sha ? 'The source change is merged. The next verification gate is ready.' : 'Canonical work state is available. Exact source and runtime details are recorded below.';
  const fullSummary = summary;
  summary = compactText(summary,150);
  let label = states[status] || status;
  let tone = ['blocked','failed','officially-stale'].includes(status) ? 'bad' : status.includes('wait') || status === 'held' ? 'wait' : ['active','working'].includes(status) ? 'info' : ['completed','complete'].includes(status) ? 'good' : 'quiet';
  const jobs = (data.progress || data.claims || data.queue || []).filter(x=>!['completed','complete','cancelled','retired','superseded'].includes(x.state));
  const activeJobs = jobs.filter(x=>['active','working'].includes(x.state));
  let rows = (activeJobs.length ? activeJobs : jobs).slice(0,3).map(x=>({label:jobTitle(x), text:states[x.state] || x.state || 'Recorded'}));
  if (checks) {
    const failed = checks.find(x=>x.status==='completed' && !['success','neutral','skipped'].includes(x.conclusion));
    const running = checks.find(x=>x.status!=='completed');
    title = 'Verification'; label = failed ? 'Failed' : running ? 'Running' : checks.length ? 'Checks complete' : 'No checks recorded'; tone=failed?'bad':running?'info':checks.length?'good':'quiet';
    summary = failed ? failed.name+' failed.' : running ? running.name+' is running.' : checks.length ? 'Recorded checks are complete.' : 'Verification is unconfirmed.';
    rows = checks.slice(0,3).map(x=>({label:x.name,text:x.conclusion||x.status}));
  }
  if (pr) { title=pr.title||'Source change'; label=pr.merged?'Merged':pr.draft?'Draft':'In review'; tone=pr.merged?'good':pr.draft?'quiet':'info'; summary=pr.merged?'The source change is merged.':'The source change is awaiting its next gate.'; }
  const blocker = human.blocker || error || (status==='blocked' ? first.waiting_reason || 'The next gate needs attention.' : null);
  const qa = human.qa || checkpoint.qa_context || data.qa || null;
  const handoff = data.action === 'handoff' ? 'Ownership handed to '+(data.claim?.owner || 'the recorded successor')+'.' : data.handoff?.summary || null;
  const identities = first.identities || checkpoint.identities || data.identities || {};
  const evidence = { assignment:first.id || first.assignment || (typeof data.assignment==='string'?data.assignment:null), owner:first.owner, branch:first.branch || identities.branch, head_sha:identities.head_sha || identities.pr_head_sha || pr?.head?.sha, pr:pr?.number || identities.pr, merge_commit_sha:pr?.merge_commit_sha || identities.merge_commit_sha, version_id:data.version_id, deployment_id:data.deployment?.id, evidence_id:data.evidence_id || data.evidence?.evidence_id, record_sha:data.record_sha, goal:first.goal || fullTitle, summary:fullSummary, next_action:first.next_action || checkpoint.next_action || null };
  const normalize = value => String(value || '').trim().replace(/\s+/g,' ').toLowerCase();
  const rawNext = human.next_step || first.next_action || checkpoint.next_action || null;
  const terminal = ['completed','complete','finished'].includes(String(status).toLowerCase()) || Boolean(pr?.merged);
  let nextStep = terminal ? null : technicalNote(rawNext) ? 'Verify the refreshed chat connection before continuing.' : compactText(rawNext,120);
  if (nextStep && (normalize(rawNext) === normalize(fullSummary) || normalize(nextStep) === normalize(summary) || normalize(summary).includes(normalize(nextStep)))) nextStep = null;
  if (rows.length === 1 && rows[0].label === primary && normalize(rows[0].text) === normalize(label)) rows = [];
  const primaryTeam = first.primary_team || data.primary_team || (checks ? 'inspector' : pr ? 'source' : 'relay');
  const feature = ['relay','runner','inspector','night-shift','source','cloud','release','skills'].includes(primaryTeam) ? primaryTeam : 'relay';
  const signal = tone === 'bad' ? 'danger' : tone === 'wait' ? 'external' : tone === 'info' ? 'working' : tone === 'good' ? 'steady' : 'quiet';
  const rawPercent = first.progress_percent ?? first.percent ?? first.completion?.percent ?? data.progress_percent ?? null;
  const hasPercent = typeof rawPercent === 'number' || typeof rawPercent === 'string' && rawPercent.trim() !== '';
  const percent = hasPercent && Number.isFinite(Number(rawPercent)) && Number(rawPercent) >= 0 && Number(rawPercent) <= 100 ? Math.round(Number(rawPercent)) : null;
  let metric = percent != null ? percent+'%' : label;
  let metric_label = percent != null ? 'completion' : 'current state';
  if (!checks && !pr && jobs.length && percent == null) { metric=String(data.coverage?.active ?? activeJobs.length); metric_label='active jobs'; }
  if (checks) { const done=checks.filter(x=>x.status==='completed').length; metric=checks.length ? done+'/'+checks.length : label; metric_label=checks.length ? 'checks reported' : 'verification'; }
  if (pr?.number) { metric='#'+pr.number; metric_label=pr.merged?'merged pull request':pr.draft?'draft pull request':'pull request'; }
  return { title, feature, primary_staff:primary, team, label, tone, signal, summary, rows, blocker, qa, handoff, next_step:nextStep, metric, metric_label, percent, evidence:Object.fromEntries(Object.entries(evidence).filter(([,v])=>v!=null)), refresh:Boolean(data.project) };
}`;

function cardHtml(modelSource = contextCardModel.toString()) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{color-scheme:light dark;--ink:#292928;--muted:#737371;--surface:#f3f1ed;--raised:#ebe8e2;--row:rgba(20,20,18,.055);--bad:#a3423d;--wait:#91682d;--accent:#b5471f}@media(prefers-color-scheme:dark){:root{--ink:#f2f2ef;--muted:#aaa9a4;--surface:#292826;--raised:#33312e;--row:rgba(255,255,250,.065);--bad:#e9a39c;--wait:#e0bd83}}*{box-sizing:border-box}html,body{background:transparent!important}body{margin:0;padding:0;color:var(--ink);font:13px/1.42 system-ui,sans-serif}.card{--accent:#b5471f;border:0;padding:8px 2px;background:transparent!important;box-shadow:none}.card[data-feature=runner]{--accent:#3bcb8d}.card[data-feature=inspector]{--accent:#18afc0}.card[data-feature=night-shift]{--accent:#ffbf00}.layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,38%);gap:18px;align-items:stretch}.hero{display:grid;grid-template-columns:62px minmax(0,1fr);gap:14px;align-items:start;padding:10px 4px}.feature-mark{position:relative;width:62px;height:62px;display:grid;place-items:center;color:var(--accent);border-radius:20px;background:color-mix(in srgb,var(--accent) 11%,transparent)}.feature-mark svg{width:34px;height:34px;filter:drop-shadow(0 0 8px color-mix(in srgb,var(--accent) 28%,transparent))}.feature-mark::after{content:'';position:absolute;inset:-6px;border-radius:24px;border:2px solid color-mix(in srgb,var(--accent) 30%,transparent);opacity:0;transform:scale(.82)}.card[data-signal=working] .feature-mark::after{animation:pulse 1.55s cubic-bezier(.16,1,.3,1) infinite}.card[data-signal=external] .feature-mark::after{animation:breathe 2.2s ease-in-out infinite}.card[data-signal=danger] .feature-mark::after{animation:pulse 1.25s cubic-bezier(.16,1,.3,1) infinite}.feature-kicker{font-size:12px;font-weight:750;color:var(--accent);text-transform:lowercase}h1{font-size:30px;line-height:.98;letter-spacing:-.7px;margin:2px 0 8px;color:var(--accent);text-transform:lowercase}.headline{font-size:15px;line-height:1.32;font-weight:700;color:var(--ink);margin:0 0 5px;overflow-wrap:anywhere}.summary{font-size:13px;line-height:1.45;margin:0;color:var(--muted)}.staff{display:inline-flex;align-items:center;gap:7px;width:max-content;max-width:100%;margin-top:10px;padding:5px 8px 5px 5px;border-radius:999px;background:var(--row);color:var(--ink);font-size:11px;font-weight:650}.avatar{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 14%,var(--raised));color:var(--accent)}.avatar svg{width:15px;height:15px}.insight{display:flex;flex-direction:column;min-width:0;padding:16px;border-radius:22px;background:var(--surface)}.state{display:inline-flex;align-items:center;gap:7px;width:max-content;max-width:100%;font-size:12px;font-weight:700;color:var(--muted)}.state[data-tone=bad]{color:var(--bad)}.state[data-tone=wait]{color:var(--wait)}.state[data-tone=info],.state[data-tone=good]{color:var(--accent)}.status-light{position:relative;width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 10px color-mix(in srgb,currentColor 28%,transparent)}.metric{font-size:34px;line-height:1;font-weight:760;letter-spacing:-1px;color:var(--ink);margin-top:14px;overflow-wrap:anywhere}.metric-label{margin-top:4px;color:var(--muted);font-size:12px}.meter{height:7px;border-radius:999px;background:var(--raised);overflow:hidden;margin-top:12px}.meter>span{display:block;height:100%;width:0;background:var(--accent);border-radius:inherit;transition:width .25s ease}.rows{display:grid;gap:5px;margin-top:12px}.row{display:flex;justify-content:space-between;gap:10px;padding:6px 8px;background:var(--row);border-radius:9px}.row strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row span{color:var(--muted);text-align:right}.blocker{color:var(--bad)}.micro{margin:8px 0 0;color:var(--muted)}.qa-media{grid-column:1/-1;margin:2px 4px 0;overflow:hidden;border-radius:18px;background:var(--surface)}.qa-media img{display:block;width:100%;max-height:280px;object-fit:cover;background:var(--raised)}.qa-media figcaption{display:flex;justify-content:space-between;gap:10px;padding:8px 11px;color:var(--muted);font-size:11px}.qa-media code{font:10px/1.3 ui-monospace,monospace;color:var(--muted)}details{grid-column:1/-1;margin:0 4px;color:var(--muted)}summary{cursor:pointer}pre{font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:auto;padding-top:12px}button{font:inherit;font-weight:700;min-height:34px;border:0;border-radius:10px;background:var(--raised);color:var(--ink);padding:6px 11px;cursor:pointer}button#open-relay{background:color-mix(in srgb,var(--accent) 14%,var(--raised))}button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}[hidden]{display:none!important}@keyframes pulse{0%{opacity:0;transform:scale(.82)}28%{opacity:.75}100%{opacity:0;transform:scale(1.18)}}@keyframes breathe{0%,100%{opacity:.1;transform:scale(.9)}50%{opacity:.62;transform:scale(1.08)}}@media(max-width:620px){.layout{grid-template-columns:1fr}.hero{grid-template-columns:52px minmax(0,1fr)}.feature-mark{width:52px;height:52px;border-radius:17px}.feature-mark svg{width:28px;height:28px}h1{font-size:26px}.insight{border-radius:20px}.metric{font-size:30px}}@media(prefers-reduced-motion:reduce){.feature-mark::after{animation:none!important;display:none}.meter>span{transition:none}}
</style></head><body><main id="card" class="card" data-feature="relay" data-signal="quiet"><div class="layout"><section class="hero"><div id="feature-mark" class="feature-mark" aria-hidden="true"></div><div><div id="feature-kicker" class="feature-kicker">relay</div><h1 id="feature-title">relay</h1><p id="title" class="headline">Relay update</p><p id="summary" class="summary">Waiting for the Relay result…</p><div id="staff" class="staff"><span class="avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7Z"/></svg></span><span id="team">Relay</span></div></div></section><aside class="insight"><span id="state" class="state"><span class="status-light" aria-hidden="true"></span><span id="state-label">Connecting</span></span><div id="metric" class="metric">—</div><div id="metric-label" class="metric-label">current state</div><div id="meter" class="meter" hidden><span id="meter-fill"></span></div><div id="rows" class="rows"></div><p class="micro blocker" id="blocker" hidden></p><p class="micro" id="handoff" hidden></p><p class="micro" id="qa" hidden></p><p class="micro" id="next" hidden></p><div class="actions"><button id="refresh" hidden>Refresh</button><button id="open-relay">Open Relay</button></div></aside><figure id="qa-media" class="qa-media" hidden><img id="qa-media-image" alt="Inspector QA screenshot"><figcaption><span id="qa-media-caption">Inspector QA screenshot</span><code id="qa-media-id"></code></figcaption></figure><details id="details" hidden><summary>Technical evidence</summary><pre id="evidence"></pre></details></div></main><script>
const DIRECTORY=${JSON.stringify(DIRECTORY)};
const model=${modelSource};
const FEATURES={relay:{label:'relay',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8a8 8 0 0 1 13-2l2 2M19 16a8 8 0 0 1-13 2l-2-2"/><path d="M20 3v5h-5M4 21v-5h5"/></svg>'},runner:{label:'runner',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7"><rect x="3" y="3" width="7" height="7" rx="2.5"/><rect x="14" y="3" width="7" height="7" rx="2.5"/><rect x="3" y="14" width="7" height="7" rx="2.5"/><rect x="14" y="14" width="7" height="7" rx="2.5"/></svg>'},inspector:{label:'inspector',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c4-8 14-8 18 0-4 8-14 8-18 0Z"/><circle cx="12" cy="12" r="3"/></svg>'},'night-shift':{label:'night shift',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/></svg>'},source:{label:'source',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="m8 5-5 7 5 7m8-14 5 7-5 7m-5 2 2-18"/></svg>'},cloud:{label:'cloud',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h12a4 4 0 0 0 .7-7.9A7 7 0 0 0 5.2 8.7 4.5 4.5 0 0 0 6 18Z"/></svg>'},release:{label:'release',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3m-5 5 5-5 5 5M5 14v6h14v-6"/></svg>'},skills:{label:'skills',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.8 4.8L19 10l-5.2 2.2L12 17l-1.8-4.8L5 10l5.2-2.2Z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9Z"/></svg>'}};
const ids=['card','feature-mark','feature-kicker','feature-title','title','state','state-label','team','staff','summary','metric','metric-label','meter','meter-fill','rows','blocker','handoff','qa','next','qa-media','qa-media-image','qa-media-caption','qa-media-id','details','evidence','refresh','open-relay'];
const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
let toolInput={};let lastData=null;let lastMediaId=null;let seq=0;let recoveryStarted=false;const pending=new Map();
function unwrap(result){if(result?.structuredContent)return result.structuredContent;for(const item of result?.content||[]){if(item.type==='text'){try{return JSON.parse(item.text)}catch{}}}return result?.isError?{ok:false,error:result.content?.find(x=>x.type==='text')?.text||'The Relay action failed.'}:result||{}}
function render(result){const data=unwrap(result);lastData=data;const m=model(data,DIRECTORY);const feature=FEATURES[m.feature]||FEATURES.relay;el.card.dataset.feature=m.feature||'relay';el.card.dataset.signal=m.signal||'quiet';el['feature-mark'].innerHTML=feature.icon;el['feature-kicker'].textContent=(m.feature&&m.feature!=='relay'?m.feature+' reporting':'relay');el['feature-title'].textContent=feature.label;el.title.textContent=m.title;el.team.textContent=m.primary_staff||'Relay';el.staff.hidden=!m.primary_staff||m.primary_staff==='Relay';el.staff.title=m.team||m.primary_staff||'';el['state-label'].textContent=m.label;el.state.dataset.tone=m.tone;el.summary.textContent=m.summary;el.metric.textContent=m.metric||m.label;el['metric-label'].textContent=m.metric_label||'current state';el.meter.hidden=m.percent==null;el['meter-fill'].style.width=(m.percent??0)+'%';el.rows.replaceChildren();for(const r of m.rows){const div=document.createElement('div');div.className='row';const strong=document.createElement('strong');strong.textContent=r.label;const span=document.createElement('span');span.textContent=r.text;div.append(strong,span);el.rows.append(div)}for(const key of ['blocker','handoff']){el[key].hidden=!m[key];el[key].textContent=m[key]||''}el.qa.hidden=!m.qa;el.qa.textContent=m.qa?(m.qa.intended_result||m.qa.reason||'QA evidence is available.')+(m.qa.checks?' Check: '+m.qa.checks.join('; '):''):'';el.next.hidden=!m.next_step;el.next.textContent=m.next_step?'Next: '+m.next_step:'';el.details.hidden=!Object.keys(m.evidence).length;el.evidence.textContent=JSON.stringify(m.evidence,null,2);el.refresh.hidden=!m.refresh;void loadQaMedia(data,m)}
function rpc(method,params){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Relay host timed out'))},15000);pending.set(id,{resolve,reject,timer});window.parent.postMessage({jsonrpc:'2.0',id,method,params},'*')})}
function acceptToolInput(value){if(value&&typeof value==='object')toolInput=value.arguments||value}
function acceptToolResult(value){if(value==null)return false;render(value);return true}
function hydrateOpenAiGlobals(globals=window.openai){if(!globals)return false;if(globals.toolInput!=null)acceptToolInput(globals.toolInput);return globals.toolOutput!=null?acceptToolResult(globals.toolOutput):false}
window.addEventListener('message',event=>{if(event.source!==window.parent||event.data?.jsonrpc!=='2.0')return;const msg=event.data;const waiter=pending.get(msg.id);if(waiter){pending.delete(msg.id);clearTimeout(waiter.timer);msg.error?waiter.reject(new Error(msg.error.message)):waiter.resolve(msg.result);return}if(msg.method==='ui/notifications/tool-input')acceptToolInput(msg.params?.arguments||msg.params);if(msg.method==='ui/notifications/tool-result')acceptToolResult(msg.params);if(msg.method==='ui/resource-teardown'&&msg.id)window.parent.postMessage({jsonrpc:'2.0',id:msg.id,result:{}},'*')});
window.addEventListener('openai:set_globals',event=>{hydrateOpenAiGlobals(event.detail?.globals||window.openai)},{passive:true});
async function callTool(name,args){await ready;return rpc('tools/call',{name,arguments:args})}
function hideQaMedia(){el['qa-media'].hidden=true;el['qa-media-image'].removeAttribute('src');el['qa-media-id'].textContent='';lastMediaId=null}
async function loadQaMedia(data,m){let item=null;let id=toolInput?.evidence_id||data?.evidence_id||data?.evidence?.evidence_id||m?.evidence?.evidence_id||null;const project=toolInput?.project||data?.project||null;try{if(!id&&toolInput?.show_qa===true&&typeof project==='string'&&/^[a-z0-9-]{1,80}$/.test(project)){const listing=unwrap(await callTool('relay_ui_request',{path:'/api/visual?project='+project,method:'GET'}));const evidence=listing?.body?.evidence;item=Array.isArray(evidence)?evidence[0]:null;id=item?.evidence_id||null}if(!id||!/^vis_[a-zA-Z0-9-]{8,128}$/.test(id)){hideQaMedia();return}if(lastMediaId===id&&!el['qa-media'].hidden){return}const image=unwrap(await callTool('relay_ui_request',{path:'/api/visual/'+id+'/image',method:'GET'}));if(!image?.base64||!String(image.content_type||'').startsWith('image/')){hideQaMedia();return}el['qa-media-image'].src='data:'+image.content_type+';base64,'+image.base64;el['qa-media-caption'].textContent=item?.step_label||item?.context?.surface||'Inspector QA screenshot';el['qa-media-id'].textContent=id;el['qa-media'].hidden=false;lastMediaId=id}catch{hideQaMedia()}}
el.refresh.addEventListener('click',async()=>{el.refresh.disabled=true;try{const project=toolInput.project||lastData?.project;if(project)render(await callTool('relay_runner_progress',{project,...(toolInput.assignment?{assignment:toolInput.assignment}:{})}))}catch(error){el.blocker.hidden=false;el.blocker.textContent=error.message}finally{el.refresh.disabled=false}});
el['open-relay'].addEventListener('click',async()=>{try{if(window.openai?.requestModal){await window.openai.requestModal({template:${JSON.stringify(CONTROL_URI)}});return}if(window.openai?.callTool){await window.openai.callTool('relay_ui_control_center',{});return}await ready;await rpc('ui/open-link',{url:'https://relay.loew.fi/'})}catch(error){el.blocker.hidden=false;el.blocker.textContent=error.message}});
async function recoverCanonicalState(){if(lastData||recoveryStarted)return;hydrateOpenAiGlobals();if(lastData)return;const project=toolInput?.project;if(typeof project!=='string'||!/^[a-z0-9-]{1,80}$/.test(project))return;recoveryStarted=true;try{const args={project,...(typeof toolInput.assignment==='string'?{assignment:toolInput.assignment}:{})};acceptToolResult(await callTool('relay_runner_progress',args))}catch(error){if(!lastData){el.summary.textContent='Relay is reconnecting to current project state…';el['state-label'].textContent='Reconnecting'}}}
const ready=rpc('ui/initialize',{appInfo:{name:'relay-context-card',version:'1.9.9'},appCapabilities:{},protocolVersion:'2026-01-26'}).then(()=>{window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}},'*');hydrateOpenAiGlobals();setTimeout(()=>{void recoverCanonicalState()},350)});
ready.catch(error=>{hydrateOpenAiGlobals();if(!lastData){el.summary.textContent='Relay is waiting for the chat connection.';el['state-label'].textContent='Connection pending'}});

</script></body></html>`;
}

// Temporary consumer bisect: keep the v8 visual/data model byte-for-byte, but restore
// the known-good v3 ChatGPT host bridge used by the native macOS card seen at 23:42 ET.
// The normal context-card/v8 resource remains the standards-first control.
const LEGACY_CARD_BROWSER_MODEL = "function contextCardModel(data = {}, directory = DIRECTORY) {\n  const states = { active:'Active', working:'Working', queued:'Up next', held:'On hold', completed:'Finished', complete:'Finished', blocked:'Blocked', failed:'Failed', 'waiting-for-human':'Needs your review', 'waiting-on-external-system':'Waiting on system', 'reserved-but-idle':'Reserved', 'possibly-stale':'May be stale' };\n  const checkpoints = data.checkpoints || [];\n  const first = data.claim || (typeof data.assignment === 'object' ? data.assignment : null) || data.claims?.find(x=>x.state!=='completed') || data.claims?.[0] || data.queue?.[0] || data.progress?.[0] || data.latest?.assignment || checkpoints[0]?.assignment || data.coordination?.claims?.find(x=>x.state!=='completed') || {};\n  const checkpoint = data.latest || checkpoints[0] || {};\n  const technicalNote = text => /[a-f0-9]{24,40}|relay_[a-z_]+|version_id|commit_sha|Worker version|PR #\\d+/.test(String(text || ''));\n  const human = data.human || {};\n  const name = id => directory[id] || 'Unassigned staff';\n  const primary = human.responsible_staff?.display_name || (first.primary_staff ? name(first.primary_staff) : data.primary_staff ? name(data.primary_staff) : 'Relay');\n  const supporting = human.supporting_staff?.map(x=>x.display_name) || (first.supporting_staff || data.supporting_staff || []).map(name);\n  const team = (first.primary_team ? first.primary_team+\" \u00b7 \" : \"\") + primary + (supporting.length ? ' with ' + supporting.join(', ') : '');\n  const status = data.ok === false || data.isError ? 'blocked' : first.state || data.state || checkpoint.state || (human.health === 'blocked' ? 'blocked' : 'recorded');\n  const error = typeof data.error === 'string' ? data.error : data.error?.message;\n  const checks = Array.isArray(data.checks?.check_runs) ? data.checks.check_runs : Array.isArray(data.check_runs) ? data.check_runs : null;\n  const pr = data.pull_request || (data.number && data.head ? data : null);\n  let title = human.outcome || first.goal || data.project || data.script || 'Relay update';\n  let summary = human.what_changed || error || first.waiting_reason || data.message || first.next_action || checkpoint.next_action || 'Exact Relay result recorded.';\n  if (technicalNote(summary) && !error && !first.waiting_reason) summary = checkpoint.identities?.merge_commit_sha ? 'The source change is merged. The next verification gate is ready.' : 'Canonical work state is available. Exact source and runtime details are recorded below.';\n  let label = states[status] || status;\n  let tone = ['blocked','failed','officially-stale'].includes(status) ? 'bad' : status.includes('wait') || status === 'held' ? 'wait' : ['active','working'].includes(status) ? 'info' : ['completed','complete'].includes(status) ? 'good' : 'quiet';\n  let rows = (data.progress || data.claims || data.queue || []).slice(0,3).map(x=>({label:x.primary_staff ? name(x.primary_staff) : 'Relay', text:states[x.state] || x.state || 'Recorded'}));\n  if (checks) {\n    const failed = checks.find(x=>x.status==='completed' && !['success','neutral','skipped'].includes(x.conclusion));\n    const running = checks.find(x=>x.status!=='completed');\n    title = 'Verification'; label = failed ? 'Failed' : running ? 'Running' : checks.length ? 'Checks complete' : 'No checks recorded'; tone=failed?'bad':running?'info':checks.length?'good':'quiet';\n    summary = failed ? failed.name+' failed.' : running ? running.name+' is running.' : checks.length ? 'Recorded checks are complete.' : 'Verification is unconfirmed.';\n    rows = checks.slice(0,3).map(x=>({label:x.name,text:x.conclusion||x.status}));\n  }\n  if (pr) { title=pr.title||'Source change'; label=pr.merged?'Merged':pr.draft?'Draft':'In review'; tone=pr.merged?'good':pr.draft?'quiet':'info'; summary=pr.merged?'The source change is merged.':'The source change is awaiting its next gate.'; }\n  const blocker = human.blocker || error || (status==='blocked' ? first.waiting_reason || 'The next gate needs attention.' : null);\n  const qa = human.qa || checkpoint.qa_context || data.qa || null;\n  const handoff = data.action === 'handoff' ? 'Ownership handed to '+(data.claim?.owner || 'the recorded successor')+'.' : data.handoff?.summary || null;\n  const identities = first.identities || checkpoint.identities || data.identities || {};\n  const evidence = { assignment:first.id || first.assignment || (typeof data.assignment==='string'?data.assignment:null), owner:first.owner, branch:first.branch || identities.branch, head_sha:identities.head_sha || identities.pr_head_sha || pr?.head?.sha, pr:pr?.number || identities.pr, merge_commit_sha:pr?.merge_commit_sha || identities.merge_commit_sha, version_id:data.version_id, deployment_id:data.deployment?.id, evidence_id:data.evidence_id || data.evidence?.evidence_id, record_sha:data.record_sha, next_action:first.next_action || checkpoint.next_action || null };\n  const normalize = value => String(value || '').trim().replace(/\\s+/g,' ').toLowerCase();\n  const rawNext = human.next_step || first.next_action || checkpoint.next_action || null;\n  const terminal = ['completed','complete','finished'].includes(String(status).toLowerCase()) || Boolean(pr?.merged);\n  let nextStep = terminal ? null : technicalNote(rawNext) ? 'Verify the refreshed chat connection before continuing.' : rawNext;\n  if (nextStep && (normalize(nextStep) === normalize(summary) || normalize(summary).includes(normalize(nextStep)))) nextStep = null;\n  if (rows.length === 1 && rows[0].label === primary && normalize(rows[0].text) === normalize(label)) rows = [];\n  const primaryTeam = first.primary_team || data.primary_team || (checks ? 'inspector' : pr ? 'source' : 'relay');\n  const feature = ['relay','runner','inspector','night-shift','source','cloud','release','skills'].includes(primaryTeam) ? primaryTeam : 'relay';\n  const signal = tone === 'bad' ? 'danger' : tone === 'wait' ? 'external' : tone === 'info' ? 'working' : tone === 'good' ? 'steady' : 'quiet';\n  const rawPercent = first.progress_percent ?? first.percent ?? first.completion?.percent ?? data.progress_percent ?? null;\n  const percent = Number.isFinite(Number(rawPercent)) && Number(rawPercent) >= 0 && Number(rawPercent) <= 100 ? Math.round(Number(rawPercent)) : null;\n  let metric = percent != null ? percent+'%' : label;\n  let metric_label = percent != null ? 'completion' : 'current state';\n  if (checks) { const done=checks.filter(x=>x.status==='completed').length; metric=checks.length ? done+'/'+checks.length : label; metric_label=checks.length ? 'checks reported' : 'verification'; }\n  if (pr?.number) { metric='#'+pr.number; metric_label=pr.merged?'merged pull request':pr.draft?'draft pull request':'pull request'; }\n  return { title, feature, primary_staff:primary, team, label, tone, signal, summary, rows, blocker, qa, handoff, next_step:nextStep, metric, metric_label, percent, evidence:Object.fromEntries(Object.entries(evidence).filter(([,v])=>v!=null)), refresh:Boolean(data.project) };\n}";
function legacyBridgeCardHtml() {
  let html = cardHtml(LEGACY_CARD_BROWSER_MODEL);
  html = html.replace(
    "let toolInput={};let lastData=null;",
    "let toolInput=window.openai?.toolInput||{};let lastData=null;"
  );
  html = html.replace(
    "async function callTool(name,args){await ready;return rpc('tools/call',{name,arguments:args})}",
    "async function callTool(name,args){if(window.openai?.callTool)return window.openai.callTool(name,args);await ready;return rpc('tools/call',{name,arguments:args})}"
  );
  html = html.replace(
    "const ready=rpc('ui/initialize',{appInfo:{name:'relay-context-card',version:'1.9.9'},appCapabilities:{},protocolVersion:'2026-01-26'}).then(()=>{window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}},'*');hydrateOpenAiGlobals();setTimeout(()=>{void recoverCanonicalState()},350)});\nready.catch(error=>{hydrateOpenAiGlobals();if(!lastData){el.summary.textContent='Relay is waiting for the chat connection.';el['state-label'].textContent='Connection pending'}});",
    "const ready=window.openai?Promise.resolve():rpc('ui/initialize',{appInfo:{name:'relay-legacy-bridge-card',version:'1.9.9-bisect'},appCapabilities:{},protocolVersion:'2026-01-26'}).then(()=>window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}},'*'));\nready.catch(error=>{if(!lastData){el.summary.textContent='Relay is waiting for the chat connection.';el['state-label'].textContent='Connection pending'}});\nif(window.openai?.toolOutput)render(window.openai.toolOutput);"
  );
  return html;
}

// v9: non-blocking host bootstrap + size reporting. Patches the v8 HTML at serve time so the
// legacy bridge bisect card (built from cardHtml()) stays byte-for-byte unchanged.
const BOOTSTRAP_V9 = `const diag={t0:Date.now(),globals:Boolean(window.openai),init:'pending',h:0};function showDiag(){const d=document.getElementById('diag');if(d)d.textContent='host check: globals '+(diag.globals?'yes':'no')+' · handshake '+diag.init+' · height '+diag.h}function reportSize(){try{const height=Math.ceil(document.documentElement.scrollHeight);if(height===diag.h)return;diag.h=height;window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{width:Math.ceil(document.documentElement.scrollWidth),height}},'*');if(window.openai&&typeof window.openai.notifyIntrinsicHeight==='function')window.openai.notifyIntrinsicHeight(height);showDiag()}catch{}}if(typeof ResizeObserver==='function')new ResizeObserver(reportSize).observe(document.body);const ready=rpc('ui/initialize',{appInfo:{name:'relay-context-card',version:'1.9.9'},appCapabilities:{},protocolVersion:'2026-01-26'},4000).then(()=>{diag.init='ok '+(Date.now()-diag.t0)+'ms';window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}},'*');hydrateOpenAiGlobals();diag.h=0;reportSize();setTimeout(()=>{void recoverCanonicalState()},350)});hydrateOpenAiGlobals();showDiag();reportSize();`;
function replaceOnce(html, from, to) {
  if (!html.includes(from)) throw new Error('Relay card v9 patch target missing: ' + from.slice(0, 60));
  return html.replace(from, () => to);
}
function installStatusExplorer(){
 const saved=window.openai?.widgetState?.statusExplorer;
 let view={level:'overview',project:null,assignment:null};
 if(saved&&['overview','project','assignment'].includes(saved.level)&&(!saved.project||/^[a-z0-9-]{1,80}$/.test(saved.project))&&(!saved.assignment||/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(saved.assignment)))view={...view,...saved};
 let registry=null,generation=0,overviewLoading=false,active=Boolean(saved);
 const cache=new Map(),failures=new Map();
 const originalRender=render;
 const nav=document.createElement('nav');nav.className='status-navigation';nav.setAttribute('aria-label','Status navigation');el.card.prepend(nav);nav.hidden=!active;
 const css=document.createElement('style');css.textContent='.status-navigation{display:flex;align-items:center;gap:8px;margin:0 4px 10px;font:inherit}.status-navigation button,.status-drilldown{font:inherit;color:var(--ink);background:var(--row);border:0;border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left}.status-drilldown{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;margin-top:7px}.status-drilldown strong{overflow-wrap:anywhere}.status-drilldown span{color:var(--muted);font-size:12px}.status-navigation button:focus-visible,.status-drilldown:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.status-navigation small{color:var(--muted)}';document.head.append(css);
 const terminal=new Set(['complete','completed','cancelled','superseded','retired']);
 const current=data=>[...(data?.progress||[]),...(data?.queue||[])].filter(x=>!terminal.has(x.state)&&x.retirement==null);
 const label=state=>({'active':'Active','working':'Working','queued':'Queued','held':'On hold','officially-stale':'Needs a fresh update','possibly-stale':'Update may be stale','waiting-for-human':'Needs review','waiting-on-external-system':'Waiting on system','reserved-but-idle':'Reserved','failed':'Failed','blocked':'Blocked','complete':'Completed','completed':'Completed'}[state]||state||'Unknown');
 const persist=()=>{try{window.openai?.setWidgetState({...window.openai.widgetState,statusExplorer:view})}catch{}};
 function button(title,detail,action){const b=document.createElement('button');b.type='button';b.className='status-drilldown';const t=document.createElement('strong'),d=document.createElement('span');t.textContent=title;d.textContent=detail+' ›';b.append(t,d);b.addEventListener('click',action);return b;}
 function navigation(){nav.hidden=!active;nav.replaceChildren();if(view.level!=='overview'){const back=document.createElement('button');back.type='button';back.textContent=view.level==='assignment'?'‹ Project':'‹ Overall';back.addEventListener('click',()=>view.level==='assignment'?openProject(view.project):openOverview());nav.append(back)}const path=document.createElement('small');path.textContent=view.level==='overview'?'Overall status':view.project+(view.level==='assignment'?' / Assignment':' / Project');nav.append(path);}
 function base(data){originalRender(data);navigation();el.refresh.hidden=false;el.staff.hidden=true;el.next.hidden=true;el.handoff.hidden=true;el.qa.hidden=true;el.meter.hidden=true;hideQaMedia();el.rows.replaceChildren();el.blocker.hidden=true;el.card.dataset.feature='relay';el['feature-title'].textContent='relay';el['feature-kicker'].textContent='status';}
 function overview(){if(!registry)return;view={level:'overview',project:null,assignment:null};persist();base({project:'relay'});el.title.textContent='Your projects';const projects=registry.projects||[];let open=0,waiting=0,stale=0;for(const p of projects){const items=current(cache.get(p.id));open+=items.length;waiting+=items.filter(x=>['failed','blocked','waiting-for-human'].includes(x.state)).length;stale+=items.filter(x=>/stale/.test(x.state||'')).length;const detail=failures.has(p.id)?'Status unavailable':!cache.has(p.id)?(p.coordination==='enabled'?'Checking status…':'No coordination data'):items.length?items.length+' open · '+(items.some(x=>/stale/.test(x.state||''))?'update needed':label(items[0].state)):'No open work';el.rows.append(button(p.name||p.id,detail,()=>openProject(p.id)));}
 const checked=projects.filter(p=>cache.has(p.id)||failures.has(p.id)||p.coordination!=='enabled').length;
 el.metric.textContent=String(open);el['metric-label'].textContent='open assignments in checked projects';el['state-label'].textContent=checked<projects.length?'Checking '+checked+'/'+projects.length:waiting?'Needs attention':stale?'Updates needed':'Current snapshot';el.summary.textContent=waiting+' need attention · '+stale+' need a fresh update. Read-only status; an active reservation alone is not proof that code is running.';el.details.hidden=true;}
 function project(data,assignment=null){base(data);const rows=current(data);el.title.textContent=view.project;el.metric.textContent=String(rows.length);el['metric-label'].textContent='open assignments';el.summary.textContent=data.generated_at?'Checked '+new Date(data.generated_at).toLocaleString():'Latest available project evidence';el['state-label'].textContent=rows.length?'Work in progress':'No open work';
 if(assignment){const item=[...(data.progress||[]),...(data.queue||[])].find(x=>(x.assignment||x.id)===assignment);if(!item){el.blocker.hidden=false;el.blocker.textContent='This assignment is no longer in the current response. Return to the project to refresh.';return}el.title.textContent=item.goal||assignment;el.metric.textContent=label(item.state);el['metric-label'].textContent='evidence-derived state';el['state-label'].textContent=label(item.state);el.summary.textContent=item.waiting_reason||item.recovery_action||item.next_action||'No additional execution update was reported.';el.details.hidden=false;el.evidence.textContent=JSON.stringify({assignment,stage:item.stage,last_meaningful_progress_at:item.last_meaningful_progress_at,identities:item.identities,latest_event:item.latest_event},null,2);const event=item.latest_event;if(event){const p=document.createElement('p');p.textContent='Latest evidence: '+event.type+(event.at?' · '+new Date(event.at).toLocaleString():'');el.rows.append(p)}return;}
 for(const item of rows)el.rows.append(button(item.goal||item.assignment||item.id,label(item.state),()=>openAssignment(item.assignment||item.id)));
 if(!rows.length){const p=document.createElement('p');p.textContent='No open assignments in this snapshot.';el.rows.append(p)}el.details.hidden=true;}
 async function fetchProject(id,force=false){if(!force&&cache.has(id))return cache.get(id);const data=unwrap(await callTool('relay_runner_progress',{project:id}));if(data.ok===false||!Array.isArray(data.progress))throw Error(data.error?.message||'Project status is unavailable.');cache.set(id,data);failures.delete(id);return data;}
 function showError(error){el.blocker.hidden=false;el.blocker.textContent=error.message||'Unable to refresh status. The previous view is preserved.';}
 async function openProject(id,force=false){if(!/^[a-z0-9-]{1,80}$/.test(id))return;const token=++generation;view={level:'project',project:id,assignment:null};persist();navigation();el['state-label'].textContent='Loading project…';try{const data=await fetchProject(id,force);if(token!==generation)return;project(data)}catch(error){if(token!==generation)return;failures.set(id,error.message);showError(error)}}
 function openAssignment(id){if(!id)return;generation++;view={...view,level:'assignment',assignment:id};persist();project(cache.get(view.project),id);}
 async function openOverview(force=false){const token=++generation;view={level:'overview',project:null,assignment:null};persist();try{if(!registry||force){const data=unwrap(await callTool('relay_runner_projects',{}));if(!Array.isArray(data.projects))throw Error('Project registry unavailable.');if(token!==generation)return;registry=data;if(force){cache.clear();failures.clear()}}if(token!==generation)return;overview();await loadOverview()}catch(error){showError(error)}}
 async function loadOverview(){if(overviewLoading||!registry)return;overviewLoading=true;const todo=registry.projects.filter(p=>p.coordination==='enabled'&&!cache.has(p.id)&&!failures.has(p.id));async function run(){while(todo.length){const p=todo.shift();try{await fetchProject(p.id)}catch(error){failures.set(p.id,error.message)}if(view.level==='overview')overview();}}try{await Promise.all([run(),run()])}finally{overviewLoading=false}}
 render=function(result){const data=unwrap(result);if(data.schema==='relay-status-explorer/v1')active=true;if(!active){originalRender(result);return}if(Array.isArray(data.projects)){registry=data;lastData=data;const restore={...view};overview();if(restore.project){void openProject(restore.project).then(()=>{if(restore.assignment&&view.project===restore.project&&view.level==='project')openAssignment(restore.assignment)})}void loadOverview();return}if(data.project&&Array.isArray(data.progress)){cache.set(data.project,data);if(view.level==='overview')view={level:toolInput.assignment?'assignment':'project',project:data.project,assignment:toolInput.assignment||null};lastData=data;persist();project(data,view.assignment);return}originalRender(result);navigation();};
 // Navigation/refresh stay inside the mounted iframe; never send a follow-up message.
 el.refresh.addEventListener('click',event=>{if(!active)return;event.preventDefault();event.stopImmediatePropagation();if(view.level==='overview')void openOverview(true);else{const assignment=view.assignment;void openProject(view.project,true).then(()=>{if(assignment&&view.level==='project')openAssignment(assignment)})}},true);
 if(lastData)render(lastData);
}

function resilientCardHtml() {
  let html = cardHtml(CONTEXT_CARD_BROWSER_MODEL);
  html = replaceOnce(html, "function acceptToolInput(value){if(value&&typeof value==='object')toolInput=value.arguments||value}", "function acceptToolInput(value){if(value&&typeof value==='object'){toolInput=value.arguments||value;if(!lastData)queueMicrotask(()=>{void recoverCanonicalState()})}}");
  html = replaceOnce(html, "function acceptToolResult(value){if(value==null)return false;render(value);return true}", "function acceptToolResult(value){if(value==null)return false;const data=unwrap(value);if(!data||typeof data!=='object'||!Object.keys(data).length)return false;render(data);return true}");
  html = replaceOnce(html, "if(lastData||recoveryStarted)return;hydrateOpenAiGlobals();if(lastData)return;", "if(lastData||recoveryStarted)return;if(window.openai?.toolOutput!=null&&acceptToolResult(window.openai.toolOutput))return;");
  html = replaceOnce(html, "function rpc(method,params){", "function rpc(method,params,ms=15000){");
  html = replaceOnce(html, "reject(new Error('Relay host timed out'))},15000);", "reject(new Error('Relay host timed out'))},ms);");
  html = replaceOnce(html, "async function callTool(name,args){await ready;return rpc('tools/call',{name,arguments:args})}", "async function callTool(name,args){if(window.openai?.callTool)return window.openai.callTool(name,args);await ready;return rpc('tools/call',{name,arguments:args})}");
  html = replaceOnce(html, "const ready=rpc('ui/initialize',{appInfo:{name:'relay-context-card',version:'1.9.9'},appCapabilities:{},protocolVersion:'2026-01-26'}).then(()=>{window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}},'*');hydrateOpenAiGlobals();setTimeout(()=>{void recoverCanonicalState()},350)});", BOOTSTRAP_V9);
  html = replaceOnce(html, "ready.catch(error=>{hydrateOpenAiGlobals();if(!lastData){", "ready.catch(error=>{diag.init='timeout';showDiag();hydrateOpenAiGlobals();setTimeout(()=>{void recoverCanonicalState()},350);if(!lastData){");
  html = replaceOnce(html, '<details id="details" hidden>', '<p class="micro" id="diag" style="grid-column:1/-1;margin:0 4px"></p><details id="details" hidden>');
  html = replaceOnce(html, "async function callTool(name,args){if(window.openai?.callTool)return window.openai.callTool(name,args);await ready;return rpc('tools/call',{name,arguments:args})}", `async function callTool(name,args){
 const checked=result=>{const data=unwrap(result);if(result?.isError||data?.ok===false||data?.error){const error=Error(typeof data?.error==='string'?data.error:data?.error?.message||'Relay could not complete this action.');error.providerResult=true;throw error;}return result};
 const timed=promise=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The chat connection did not answer.')),12000)})]).finally(()=>clearTimeout(timer))};
 if(window.openai?.callTool){try{return checked(await timed(window.openai.callTool(name,args)))}catch(error){if(error.providerResult||!['relay_runner_progress','relay_runner_assignments','relay_ui_request'].includes(name))throw error;}}
 await ready;return checked(await rpc('tools/call',{name,arguments:args}));
}`);
  html = replaceOnce(html, "el.refresh.addEventListener('click',async()=>{el.refresh.disabled=true;try{const project=toolInput.project||lastData?.project;if(project)render(await callTool('relay_runner_progress',{project,...(toolInput.assignment?{assignment:toolInput.assignment}:{})}))}catch(error){el.blocker.hidden=false;el.blocker.textContent=error.message}finally{el.refresh.disabled=false}});", `el.refresh.addEventListener('click',async()=>{clearTimeout(el.refresh._resetTimer);el.refresh.disabled=true;el.refresh.textContent='Refreshing…';el.blocker.hidden=true;try{const project=toolInput.project||lastData?.project;if(!project)throw Error('Project identity is unavailable. Request a new card.');const result=await callTool('relay_runner_progress',{project,...(toolInput.assignment?{assignment:toolInput.assignment}:{})});const data=unwrap(result);if(!Array.isArray(data?.progress))throw Error('Relay did not return current progress. The previous view is preserved.');render(result);el.refresh.textContent='Updated';el.refresh._resetTimer=setTimeout(()=>{if(el.refresh.textContent==='Updated')el.refresh.textContent='Refresh'},1600)}catch(error){el.blocker.hidden=false;el.blocker.textContent=error.message;el.refresh.textContent='Try refresh again'}finally{el.refresh.disabled=false}});`);
  html = replaceOnce(html, "el['open-relay'].addEventListener('click',async()=>{try{if(window.openai?.requestModal){await window.openai.requestModal({template:"+JSON.stringify(CONTROL_URI)+"});return}if(window.openai?.callTool){await window.openai.callTool('relay_ui_control_center',{});return}await ready;await rpc('ui/open-link',{url:'https://relay.loew.fi/'})}catch(error){el.blocker.hidden=false;el.blocker.textContent=error.message}});", `el['open-relay'].addEventListener('click',async()=>{try{if(window.openai?.openExternal){const result=await window.openai.openExternal({href:'https://relay.loew.fi/',redirectUrl:false});if(result?.isError||result?.ok===false)throw Error('The chat could not open Relay.');return}await ready;await rpc('ui/open-link',{url:'https://relay.loew.fi/'});}catch(error){el.blocker.hidden=false;el.blocker.replaceChildren(document.createTextNode('Open Relay in your browser: '));const link=document.createElement('a');link.href='https://relay.loew.fi/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='relay.loew.fi';el.blocker.append(link);}});`);
  html = replaceOnce(html, '</script></body>', `const imageButton=el['qa-media-image'];imageButton.tabIndex=0;imageButton.setAttribute('role','button');imageButton.setAttribute('aria-label','enlarge screenshot');
let screenshotDialog=null;function enlargeScreenshot(){if(!imageButton.src||screenshotDialog)return;const dialog=document.createElement('dialog');dialog.className='screenshot-dialog';dialog.setAttribute('aria-label','screenshot preview');const close=document.createElement('button');close.textContent='Close screenshot';close.type='button';const image=document.createElement('img');image.src=imageButton.src;image.alt=imageButton.alt;dialog.append(close,image);document.body.append(dialog);screenshotDialog=dialog;const finish=()=>{dialog.close();dialog.remove();screenshotDialog=null;imageButton.focus();if(window.openai?.requestDisplayMode)void window.openai.requestDisplayMode({mode:'inline'}).catch(()=>{});};close.addEventListener('click',finish);dialog.addEventListener('cancel',event=>{event.preventDefault();finish()});dialog.showModal();if(window.openai?.requestDisplayMode)void window.openai.requestDisplayMode({mode:'fullscreen'}).catch(()=>{});}
imageButton.addEventListener('click',enlargeScreenshot);imageButton.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();enlargeScreenshot()}});
</script></body>`);
  html=replaceOnce(html,'</script></body>', '('+installStatusExplorer.toString()+')();</script></body>');
  return html;
}

export function relayContextCardResource() {
  return { uri:RELAY_CONTEXT_CARD_URI, mimeType:'text/html;profile=mcp-app', text:styleContextCard(resilientCardHtml(), contextCardBrandAssets), _meta:{ui:{prefersBorder:false,csp:{connectDomains:['https://relay.loew.fi'],resourceDomains:['https://relay.loew.fi']}},'openai/widgetDescription':'Compact staff-aware Relay context. Can reuse existing Inspector QA screenshots when requested. Open Relay for the full control center.','openai/widgetCSP':{connect_domains:['https://relay.loew.fi'],resource_domains:['https://relay.loew.fi'],redirect_domains:['https://relay.loew.fi','https://ctrl.loew.fi']},'openai/ui':{availableDisplayModes:['inline','fullscreen']}} };
}

// Fresh cache identities: rotate whenever card HTML, JS, or CSS changes.
export function relayStatusCardDescriptor() {
  return { ...relayContextCardDescriptor(), uri: RELAY_STATUS_CARD_URI, name: 'relay-legacy-bridge-card', title: 'Relay legacy bridge card test', description: 'Temporary consumer bisect using the known-good v3 ChatGPT host bridge with the current Relay card UI.' };
}
export function relayStatusCardTool() {
  const tool = relayContextCardTool();
  return { ...tool, name: RELAY_STATUS_CARD_TOOL, title: 'Show Relay legacy bridge test card', description: 'TEMPORARY RENDER TEST — mount the current Relay status card using the historical v3 ChatGPT compatibility bridge so desktop mount behavior can be compared against context-card/v8. Read-only and safe to retry.', _meta: { ...tool._meta,
    ui: { resourceUri: RELAY_STATUS_CARD_URI, visibility: ['model', 'app'] },
    'openai/outputTemplate': RELAY_STATUS_CARD_URI,
    'openai/toolInvocation/invoking': 'Opening Relay legacy bridge test…',
    'openai/toolInvocation/invoked': 'Relay legacy bridge test ready.'
  } };
}
export function relayStatusCardResource() {
  const resource = relayContextCardResource();
  return { ...resource, uri: RELAY_STATUS_CARD_URI, text: legacyBridgeCardHtml(), _meta: { ...resource._meta, 'openai/ui':{availableDisplayModes:['inline']}, 'openai/widgetDescription':'Temporary Relay consumer bisect: current card UI with the known-good v3 ChatGPT host bridge.' } };
}
