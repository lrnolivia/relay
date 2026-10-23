import test from 'node:test';
import assert from 'node:assert/strict';
import { WORK_CARD_TOOLS, enrichWorkCard, isWorkCardTool, withWorkCardTemplate, workCardMilestone } from './work-card-delivery.js';

const claim = { id: 'relay-task', owner: 'claude-code-session_x', state: 'active', goal: 'Ship cards', primary_staff: 'rafael', supporting_staff: ['roman'], primary_team: 'source', updated_at: '2026-10-23T05:16:52.405Z' };

test('only ordinary milestone commands carry the card template; queries stay data-first', () => {
  for (const name of Object.keys(WORK_CARD_TOOLS)) {
    const tool = withWorkCardTemplate({ name, _meta: { securitySchemes: [] } }, 'ui://relay/context-card/test.html');
    assert.equal(tool._meta.ui.resourceUri, 'ui://relay/context-card/test.html');
    assert.equal(tool._meta['openai/outputTemplate'], 'ui://relay/context-card/test.html');
    assert.deepEqual(tool._meta.securitySchemes, []);
  }
  for (const name of ['relay_runner_progress', 'relay_runner_assignments', 'relay_runner_resume', 'relay_render_context_card']) {
    assert.equal(isWorkCardTool(name), false);
    const tool = { name };
    assert.equal(withWorkCardTemplate(tool, 'ui://x'), tool);
  }
});

test('milestones come from the actual result, and a refused call is never shown as progress', () => {
  const expected = { claim: 'started', heartbeat: 'step', hold: 'blocked', handoff: 'handoff', complete: 'completed', retire: 'ended', queue: 'queued' };
  for (const [action, kind] of Object.entries(expected)) assert.equal(workCardMilestone('relay_runner_coordinate', { ok: true, action, claim }).kind, kind, action);
  assert.equal(workCardMilestone('relay_execution', { ok: true, action: 'checkpoint', job: {} }).kind, 'step');
  assert.equal(workCardMilestone('relay_execution', { ok: true, action: 'finish', job: {} }).kind, 'completed');
  assert.equal(workCardMilestone('relay_source_open_pull_request', { ok: true, number: 4 }).kind, 'pull-request');
  assert.equal(workCardMilestone('relay_runner_coordinate', { ok: false, action: 'claim', error: { message: 'conflict' } }).kind, 'failed');
  assert.equal(workCardMilestone('relay_runner_coordinate', { ok: true, action: 'unknown' }), null);
  assert.equal(workCardMilestone('relay_runner_progress', { ok: true }), null);
});

test('enrichment attaches staff attribution, liveness and CI summary without dropping data', () => {
  const started = enrichWorkCard('relay_runner_coordinate', { ok: true, project: 'relay', action: 'claim', claim, record_sha: 'x' });
  assert.equal(started.record_sha, 'x');
  assert.equal(started.staff_attribution.primary.display_name, 'Rafael');
  assert.equal(started.staff_attribution.executor_owner, 'claude-code-session_x');
  assert.deepEqual({ live: started.work_card.live, assignment: started.work_card.assignment, project: started.work_card.project }, { live: true, assignment: 'relay-task', project: 'relay' });
  const finished = enrichWorkCard('relay_runner_coordinate', { ok: true, project: 'relay', action: 'complete', claim: { ...claim, state: 'completed' } });
  assert.equal(finished.work_card.live, false);
  const unassigned = enrichWorkCard('relay_runner_coordinate', { ok: true, action: 'claim', claim: { ...claim, primary_staff: null, primary_role: 'brand-launch', primary_team: 'runner' } });
  assert.equal(unassigned.staff_attribution.status, 'unresolved');
  const ci = enrichWorkCard('relay_source_checks', { ok: true, checks: { check_runs: [{ name: 'quality', status: 'in_progress' }] } });
  assert.equal(ci.ci.schema, 'relay-ci-card/v1');
  assert.equal(ci.work_card.live, true);
  const query = { ok: true, progress: [] };
  assert.equal(enrichWorkCard('relay_runner_progress', query), query);
});
