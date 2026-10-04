import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createExecutionInbox } from './relay-executor-inbox.mjs';

test('in-run inbox exposes exact full text and backlog without acknowledgment, and retains data on a failed refresh', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-'));
  let failing = false, content = 'First decision';
  const calls = [], fullText = 'Original feedback '.repeat(100);
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (failing) throw Error('provider secret should not appear');
    if (name === 'relay_context') return { ok: true, revision: 1, entries: [{ content }], next_cursor: 20 };
    if (name === 'relay_runner_feedback_peek') return { ok: true, feedback: { available: true, events: [{ report_id: 'one', original_text: fullText.slice(0, 1000), text_truncated: true }], conflicts: [{ report_id: 'old', reason: 'stale head' }], truncated: true, next_cursor: 'next' } };
    if (name === 'relay_runner_feedback_status') return { ok: true, feedback: { report_id: 'one', original_text: fullText, status: { applicability: { conflicts: [] } } } };
    throw Error('Unexpected mutation');
  };
  try {
    const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
    const first = await inbox.refresh();
    assert.equal(first.available, true); assert.equal(first.backlog, true);
    let snapshot = JSON.parse(await fs.readFile(inbox.filename));
    assert.equal(snapshot.feedback.events[0].original_text, fullText);
    assert.equal(snapshot.feedback.conflicts[0].report_id, 'old');
    assert.equal(snapshot.acknowledged, false); assert.equal(snapshot.consumption_verified, false);
    assert.equal((await fs.stat(inbox.filename)).mode & 0o777, 0o600);
    content = 'New decision while process runs';
    const second = await inbox.refresh(); assert.notEqual(second.digest, first.digest);
    assert.equal(calls.filter(x=>x.name==='relay_context')[1].args.cursor,20);
    assert.equal(calls.filter(x=>x.name==='relay_runner_feedback_peek')[1].args.cursor,'next');
    failing = true; assert.equal((await inbox.refresh()).available, false);
    const text = await fs.readFile(inbox.filename, 'utf8'); snapshot = JSON.parse(text);
    assert.equal(snapshot.context.entries[0].content, content);
    assert.doesNotMatch(text, /provider secret/);
    failing = false; assert.equal((await inbox.refresh()).available, true);
    assert.equal(calls.filter(x=>x.name==='relay_context').at(-1).args.cursor,undefined);
    assert.ok(calls.every(x => ['relay_context', 'relay_runner_feedback_peek', 'relay_runner_feedback_status'].includes(x.name)));
    assert.ok(calls.filter(x => x.name === 'relay_context').every(x => x.args.action === 'read'));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('report applicability race is retained as a conflict and oversized refresh cannot replace a usable snapshot', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-inbox-'));
  let oversized = false;
  const rpc = async name => name === 'relay_context' ? { ok: true, revision: 1, entries: [{ content: oversized ? 'X'.repeat(100000) : 'safe' }] }
    : name === 'relay_runner_feedback_peek' ? { ok: true, feedback: { available: true, events: [{ report_id: 'race', text_truncated: true }], conflicts: [] } }
      : { ok: true, feedback: { report_id: 'race', original_text: 'exact report', status: { applicability: { conflicts: ['head-changed'] } } } };
  try {
    const inbox = createExecutionInbox({ directory, rpc, project: 'fixture', assignment: 'one' });
    await inbox.refresh();
    let snapshot = JSON.parse(await fs.readFile(inbox.filename));
    assert.equal(snapshot.feedback.events.length, 0); assert.equal(snapshot.feedback.conflicts[0].report_id, 'race');
    oversized = true; assert.equal((await inbox.refresh()).available, false);
    snapshot = JSON.parse(await fs.readFile(inbox.filename)); assert.equal(snapshot.context.entries[0].content, 'safe');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
