import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import worker from '../../apps/mcp/index.js';
import * as nightShift from '../../features/night-shift/index.js';
const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('import-manifest.json', import.meta.url)));
test('Runner imported blobs match exact source provenance', () => {
 for (const file of manifest.files) {
  assert.equal(execFileSync('git', ['rev-parse', 'fdefc6c724f94cbf9605cfa72665208380a7ee2b:' + file.target], {encoding:'utf8'}).trim(), file.blob, file.target);
 }
});
test('canonical control authority is Relay', () => {
 const registration = JSON.parse(fs.readFileSync(new URL('projects/relay.json', root)));
 assert.equal(registration.id, 'relay');
 assert.equal(registration.coordination.record, 'coordination/relay.json');
});
test('existing MCP implementation and scheduler are shared', () => {
 assert.equal(typeof worker.fetch, 'function');
 assert.equal(typeof nightShift.runWorker, 'function');
});
