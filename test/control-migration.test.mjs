import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(fs.readFileSync('contracts/control-state-import.json'));
const json = p => JSON.parse(fs.readFileSync(p));
const sourceJson = p => JSON.parse(execFileSync('git', ['show', manifest.source_sha + ':' + p], {encoding:'utf8'}));
test('all original control snapshots and ownership survive migration', () => {
 for (const row of manifest.files.filter(r => r.path.startsWith('coordination/'))) {
  const expected = sourceJson(row.path); delete expected.migration_frozen;
  const current = json(row.path); delete current.alias_of; delete current.migration_status;
  for (const name of ['claims','queue']) {
   for (const original of expected[name]) {
    const migrated = current[name].find(item=>item.id===original.id);
    assert.ok(migrated, row.path + ':' + original.id);
    if (original.branch) assert.equal(migrated.branch,original.branch);
    if (original.base_sha) assert.equal(migrated.base_sha,original.base_sha);
   }
   assert.equal(new Set(current[name].map(item=>item.id)).size,current[name].length);
  }
 }
 const canonical = json('coordination/relay.json');
 const old = sourceJson('coordination/loew-inspector.json');
 for (const name of ['claims','queue']) {
  for (const original of old[name]) assert.ok(canonical[name].some(item=>item.id===original.id));
 }
 assert.deepEqual(canonical.legacy_branches, old.legacy_branches);
});
test('snapshot hashes and counts match preserved source objects', () => {
 for (const row of manifest.files) {
  assert.equal(execFileSync('git', ['rev-parse', manifest.source_sha + ':' + row.path], {encoding:'utf8'}).trim(), row.blob, row.path);
 }
 for (const [directory,count] of Object.entries(manifest.counts)) assert.equal(manifest.files.filter(r=>r.path.startsWith(directory+'/')).length,count);
});
test('the live canonical records are writable only in Relay', () => {
 for (const row of manifest.files.filter(r=>r.path.startsWith('coordination/'))) {
  assert.equal(sourceJson(row.path).migration_frozen.canonical_repository,'lrnolivia/relay');
  assert.equal(json(row.path).migration_frozen,undefined);
 }
 assert.equal(json('projects/relay.json').repository,'lrnolivia/relay');
 assert.equal(json('contracts/manifest.json').authority,'lrnolivia/relay@main');
});
