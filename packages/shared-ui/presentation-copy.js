// Display-only language; original state and diagnostics remain available in Details.
const statuses = {
  'reserved-but-idle': 'ready to start', queued: 'waiting to start', working: 'in progress', running: 'running',
  'waiting-for-human': 'needs your decision', 'waiting-on-external-system': 'waiting for a response',
  blocked: 'needs help', failed: 'needs a fix', complete: 'completed',
  deployed: 'deployed', verified: 'verified', 'officially-stale': 'update overdue',
  'possibly-stale': 'may need an update', stale: 'last update may be old',
  live: 'up to date', connecting: 'connecting', reconnecting: 'refreshing', offline: 'unavailable',
  enabled: 'scheduled', paused: 'paused', idle: 'ready', waiting_credentials: 'needs access', recorded: 'update received'
};
const phases = { checks: 'checking', held: 'on hold', reserved: 'ready to start', 'liveness-check': 'checking for updates', 'pull-request': 'review', reconciliation: 'resolving a mismatch', planning: 'planning', implementation: 'building', coding: 'building', testing: 'checking', verification: 'verifying', review: 'ready for review', delivery: 'delivery', deployment: 'deployment', complete: 'completed' };
const events = { 'claim-created': 'work reserved', 'runner-heartbeat': 'work status refreshed', 'source-commit': 'changes saved', 'pull-request-opened': 'ready for review', 'pull-request-updated': 'review updated', 'check-started': 'check started', 'check-completed': 'check finished', 'cloud-deployment': 'deployed', 'assignment-claimed': 'work picked up', 'work-started': 'work started', 'commit-created': 'changes saved', 'pr-opened': 'ready for review', 'pr-merged': 'changes merged', 'deployment-started': 'deployment started', 'deployment-completed': 'deployment finished', 'verification-passed': 'checks passed', 'verification-failed': 'checks need attention', completed: 'work completed' };
export function statusLabel(value) { return statuses[value] || 'status not reported'; }
export function phaseLabel(value) { return phases[value] || statuses[value] || 'phase not reported'; }
export function eventLabel(value) { return events[value] || 'progress update'; }
export function summaryText(value, fallback) {
  if (!value) return fallback;
  // Infrastructure diagnostics belong in optional Details, not the glance summary.
  return /Node\.js|\bpackets?\b|\bENOBUFS\b|\b(?:stack trace|canonical|head_sha|request_id)\b|\bat \S+\([^)]*:\d+/.test(value) ? fallback : value;
}
