import {appendFileSync} from 'node:fs';
import {relative} from 'node:path';
import {redact} from './ci-test-orchestrator.mjs';

// node:test reporter for live CI cards. The orchestrator points RELAY_TEST_TELEMETRY_FILE at one
// NDJSON file per required suite. Runners nested inside a test inherit NODE_TEST_CONTEXT and stay
// silent; one whose test clears it is filtered out by pid when the suite is folded.
export default async function* telemetry(source) {
  const file = process.env.RELAY_TEST_TELEMETRY_FILE;
  const active = Boolean(file) && !process.env.NODE_TEST_CONTEXT;
  // Every event carries this runner's pid: a nested runner whose test clears NODE_TEST_CONTEXT can
  // still append here, and the fold keeps only the first (top-level) runner's events.
  const write = event => { if (active) try { appendFileSync(file, JSON.stringify({...event, pid: process.pid}) + '\n'); } catch {} };
  const path = value => typeof value === 'string' ? relative(process.cwd(), value.replace(/^file:\/\//, '')).slice(0, 300) : null;
  write({type: 'start', at: Date.now()});
  for await (const event of source) {
    const data = event.data || {};
    if ((event.type === 'test:pass' || event.type === 'test:fail') && data.details?.type !== 'suite') {
      const error = data.details?.error;
      const outcome = data.todo ? 'todo' : data.skip ? 'skipped' : event.type === 'test:pass' ? 'passed' : error?.failureType === 'cancelledByParent' ? 'cancelled' : 'failed';
      write({type: 'test', outcome, name: String(data.name ?? '').slice(0, 200), file: path(data.file), line: Number.isSafeInteger(data.line) ? data.line : null, nesting: data.nesting ?? 0,
        ...(outcome === 'failed' ? {message: redact(String(error?.cause?.message ?? error?.message ?? '')).slice(0, 500)} : {})});
    } else if (event.type === 'test:summary') {
      write(data.file ? {type: 'file', file: path(data.file)} : {type: 'summary', counts: data.counts, success: data.success});
    }
  }
  write({type: 'end', at: Date.now()});
}
