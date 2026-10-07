import {normalizeCommunicationResult,formatRelay} from '../../src/human-presentation.js';
// Display-only language; original state and diagnostics remain available in Details.
const statuses = {
  running: 'running', 'waiting-for-human': 'needs review',
  blocked: 'needs help', failed: 'needs a fix', complete: 'completed',
  deployed: 'deployed', verified: 'verified', 'officially-stale': 'update overdue',
  'possibly-stale': 'may need an update', stale: 'last update may be old',
  live: 'up to date', connecting: 'connecting', reconnecting: 'refreshing', offline: 'unavailable',
  enabled: 'enabled', paused: 'paused', idle: 'idle', waiting_credentials: 'needs access', recorded: 'update received', open: 'open', draft: 'draft', merged: 'merged', closed: 'closed'
};
const phases = { checks: 'checking', held: 'on hold', reserved: 'waiting to start', 'liveness-check': 'checking for updates', 'pull-request': 'pull request', reconciliation: 'resolving a mismatch', planning: 'planning', implementation: 'building', coding: 'building', testing: 'checking', verification: 'verifying', review: 'review', delivery: 'delivery', deployment: 'deployment', complete: 'completed' };
const events = { 'claim-created': 'work reserved', 'runner-heartbeat': 'work status refreshed', 'source-commit': 'source change recorded', 'pull-request-opened': 'pull request opened', 'pull-request-updated': 'pull request updated', 'check-started': 'check started', 'check-completed': 'check finished', 'cloud-deployment': 'deployment recorded', 'assignment-claimed': 'work assigned', 'work-started': 'work started', 'commit-created': 'source change recorded', 'pr-opened': 'pull request opened', 'pr-merged': 'changes merged', 'deployment-started': 'deployment started', 'deployment-completed': 'deployment finished', 'verification-passed': 'checks passed', 'verification-failed': 'checks need attention', completed: 'work completed' };
export function statusLabel(value) {
  if(value==='waiting-for-human')return statuses[value];
  const normalized=normalizeCommunicationResult({state:value});
  return normalized.message_id!=='data.unrecognized'?formatRelay(normalized).label.toLowerCase():Object.hasOwn(statuses,value)?statuses[value]:'status not reported';
}
export function phaseLabel(value) { return Object.hasOwn(phases,value)?phases[value]:Object.hasOwn(statuses,value)?statuses[value]:'phase not reported'; }
export function eventLabel(value) { return Object.hasOwn(events,value)?events[value]:'progress update'; }
export function summaryText(value, fallback) {
  if (!value) return fallback;
  // Infrastructure diagnostics belong in optional Details, not the glance summary.
  return /Node\.js|\bpackets?\b|\bENOBUFS\b|\b(?:stack trace|canonical|head_sha|request_id)\b|\bat \S+\([^)]*:\d+/.test(value) ? fallback : value;
}
