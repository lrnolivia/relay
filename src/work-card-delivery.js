import { assignmentStaffAttribution } from './staff-registry.js';
import { summarizeCiChecks } from './ci-test-telemetry.js';

// Ordinary workflow commands that mount the Relay card themselves, so a normal assignment
// shows its start, steps, blockers and completion without anyone asking for a card. Queries
// (progress, assignments, resume) stay data-first, and the card refreshes itself in place.
export const WORK_CARD_TOOLS = Object.freeze({
  relay_runner_delegate: ['Recording the specialist handoff…', 'Specialist handoff recorded.'],
  relay_runner_coordinate: ['Updating Relay work…', 'Relay work updated.'],
  relay_execution: ['Updating the coding job…', 'Coding job updated.'],
  relay_source_open_pull_request: ['Opening the pull request…', 'Pull request opened.'],
  relay_source_checks: ['Reading CI…', 'CI status ready.'],
  relay_source_pull_request_action: ['Updating the pull request…', 'Pull request updated.'],
  relay_cloud_deploy_project_version: ['Deploying…', 'Deployment recorded.']
});
export function isWorkCardTool(name) { return Object.hasOwn(WORK_CARD_TOOLS, name); }

export function withWorkCardTemplate(tool, uri) {
  if (!tool || !isWorkCardTool(tool.name)) return tool;
  const meta = tool._meta || {};
  const [invoking, invoked] = WORK_CARD_TOOLS[tool.name];
  return { ...tool, _meta: { ...meta,
    ui: { ...(meta.ui || {}), resourceUri: uri, visibility: meta.ui?.visibility || ['model', 'app'] },
    'openai/outputTemplate': uri, 'openai/widgetAccessible': true,
    'openai/toolInvocation/invoking': meta['openai/toolInvocation/invoking'] || invoking,
    'openai/toolInvocation/invoked': meta['openai/toolInvocation/invoked'] || invoked
  } };
}

const COORDINATION = { queue: 'queued', claim: 'started', heartbeat: 'step', amend: 'step', rescope: 'step', reconcile: 'step', hold: 'blocked', handoff: 'handoff', complete: 'completed', retire: 'ended' };
const EXECUTION = { submit: 'queued', lease: 'started', start: 'started', checkpoint: 'step', recover: 'step', finish: 'completed', cancel: 'ended', status: 'status' };
const LABELS = { queued: 'Queued', started: 'Work started', step: 'Step recorded', blocked: 'Blocked', handoff: 'Handed off', completed: 'Completed', ended: 'Ended', status: 'Current status', 'pull-request': 'Pull request opened', 'pull-request-update': 'Pull request updated', ci: 'CI', deploy: 'Deployment recorded', failed: 'Did not complete' };
const TERMINAL = new Set(['completed', 'complete', 'cancelled', 'superseded', 'retired', 'succeeded', 'failed']);

// The milestone is read from the tool's own successful result; a refused call is reported as
// such and never as progress.
export function workCardMilestone(name, data = {}) {
  if (!isWorkCardTool(name) || !data || typeof data !== 'object') return null;
  if (data.ok === false || data.isError || data.error) return { kind: 'failed', label: LABELS.failed };
  let kind = null;
  if (name === 'relay_runner_delegate') kind = data.action==='started'?'started':data.action==='result'?'step':'status';
  if (name === 'relay_runner_coordinate') kind = COORDINATION[data.action] || null;
  else if (name === 'relay_execution') kind = EXECUTION[data.action] || (data.job ? 'status' : null);
  else if (name === 'relay_source_open_pull_request') kind = 'pull-request';
  else if (name === 'relay_source_pull_request_action') kind = 'pull-request-update';
  else if (name === 'relay_source_checks') kind = 'ci';
  else if (name === 'relay_cloud_deploy_project_version') kind = 'deploy';
  if (!kind) return null;
  const record = data.claim || data.assignment || data.job || {};
  const at = record.updated_at || data.checked_at || null;
  return { kind, label: LABELS[kind], ...(typeof at === 'string' ? { at } : {}) };
}

export function enrichWorkCard(name, data) {
  if (!isWorkCardTool(name) || !data || typeof data !== 'object' || Array.isArray(data)) return data;
  const out = { ...data };
  const milestone = workCardMilestone(name, data);
  const record = data.claim && typeof data.claim === 'object' ? data.claim : data.assignment && typeof data.assignment === 'object' ? data.assignment : null;
  if (record) out.staff_attribution = assignmentStaffAttribution(record);
  if (name === 'relay_source_checks' && data.checks && typeof data.checks === 'object') out.ci = summarizeCiChecks(data.checks);
  const live = name === 'relay_source_checks' ? Boolean(out.ci?.live) : Boolean(record && !TERMINAL.has(String(record.state || '').toLowerCase()) && milestone?.kind !== 'failed');
  out.card_mode = data.card_mode==='current'?'current':'snapshot';
  out.work_card = { schema: 'relay-work-card/v1', tool: name, milestone, live,
    ...(record?.id ? { assignment: String(record.id).slice(0, 100) } : {}),
    ...(typeof data.project === 'string' ? { project: data.project.slice(0, 80) } : {}) };
  return out;
}
