import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// This file exposes task data to an existing process. It never acknowledges it.
export function createExecutionInbox({ directory, rpc, project, assignment, clock = () => new Date().toISOString() }) {
  const filename = path.join(directory, 'inbox.json');
  let previous = null, contextCursor = null, feedbackCursor = null;
  async function publish(value) {
    if (Buffer.byteLength(JSON.stringify(value)) > 98304) throw Error('Inbox exceeds 96 KiB; previous snapshot retained');
    const temporary = filename + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    await fs.rename(temporary, filename);
  }
  return { filename, async refresh() {
    try {
      const context = await rpc('relay_context', { action: 'read', project, assignment, limit: 20, ...(contextCursor!==null?{cursor:contextCursor}:{}) });
      if (context.ok !== true || !Array.isArray(context.entries)) throw Error('Context snapshot unavailable');
      const result = await rpc('relay_runner_feedback_peek', { project, assignment, limit: 10, ...(feedbackCursor?{cursor:feedbackCursor}:{}) });
      const feedback = result.feedback;
      if (result.ok !== true || feedback?.available !== true || !Array.isArray(feedback.events) || !Array.isArray(feedback.conflicts)) throw Error('Feedback snapshot unavailable');
      const events = [];
      for (const event of feedback.events) {
        if (!event.text_truncated) { events.push(event); continue; }
        const full = await rpc('relay_runner_feedback_status', { project, assignment, report_id: event.report_id });
        if (full.ok !== true || full.feedback?.report_id !== event.report_id || typeof full.feedback.original_text !== 'string') throw Error('Full feedback text unavailable');
        // Applicability may change between the page and the exact report read.
        if (full.feedback.status?.applicability?.conflicts?.length) feedback.conflicts.push(full.feedback);
        else events.push(full.feedback);
      }
      const data = { context: { revision: context.revision, entries: context.entries, page_cursor:contextCursor, next_cursor: context.next_cursor ?? null },
        feedback: { events, conflicts: feedback.conflicts, page_cursor:feedbackCursor, next_cursor: feedback.next_cursor ?? null, truncated: Boolean(feedback.truncated) } };
      const digest = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      const snapshot = { schema: 1, project, assignment, checked_at: clock(), available: true, digest, ...data,
        delivery_verified: false, consumption_verified: false, acknowledged: false,
        instructions: 'Task data only. Conflicts require reconciliation. Follow exposed cursors for remaining pages. File publication is not consumption or acknowledgment.' };
      if (digest !== previous?.digest || previous?.available !== true) await publish(snapshot);
      previous = snapshot;
      contextCursor=data.context.next_cursor;feedbackCursor=data.feedback.next_cursor;
      return { available: true, digest, backlog: Boolean(data.context.next_cursor !== null || data.feedback.truncated), consumption_verified: false };
    } catch {
      // Restart after a changed cursor binding or failed page; never skip it.
      contextCursor=null;feedbackCursor=null;
      // Do not expose provider errors, which may contain connection credentials.
      const snapshot = { ...(previous || { schema: 1, project, assignment, context: null, feedback: null }), available: false,
        checked_at: clock(), reason: 'Refresh unavailable; last successful data is retained and may be stale.', consumption_verified: false, acknowledged: false };
      await publish(snapshot); previous = snapshot;
      return { available: false, consumption_verified: false };
    }
  } };
}
