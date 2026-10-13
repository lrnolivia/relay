import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { buildSkills } from '../scripts/build-skills.mjs';

const digest = text => 'sha256:' + createHash('sha256').update(text).digest('hex');
test('generated packs reproduce canonical bytes, provenance and bounded load cost', async () => {
  const first = await buildSkills({ write: false });
  const second = await buildSkills({ write: false });
  assert.equal(first.output, second.output);
  assert.equal(first.output, await fs.readFile(new URL('../src/skills-bundles.js', import.meta.url), 'utf8'));
  for (const { manifest, text } of first.bundles) {
    const source = manifest.provenance.source.replace('https://github.com/lrnolivia/relay/', '');
    assert.equal(text, await fs.readFile(new URL('../' + source, import.meta.url), 'utf8'));
    assert.equal(manifest.integrity, digest(text));
    assert.equal(manifest.provenance.revision, digest(text));
    assert.ok(Buffer.byteLength(text) <= manifest.context_budget * 4);
    assert.equal(manifest.license, 'LicenseRef-Relay-Private');
    assert.equal(manifest.update_policy, 'pinned');
    assert.equal(manifest.executable, false);
    assert.deepEqual(manifest.dependencies, manifest.id === 'relay.supporting.regression-protection' ? ['relay.supporting.qa', 'relay.supporting.release'] : []);
  }
});
test('unsupported resource layouts and symlinks cannot silently become installable packs', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-skill-build-'));
  const root = pathToFileURL(directory + path.sep);
  try {
    await fs.mkdir(path.join(directory, 'skills/supporting/example/references'), { recursive: true });
    await fs.writeFile(path.join(directory, 'skills/supporting/example/references/DETAIL.md'), '# reference');
    await assert.rejects(buildSkills({ root, write: false }), /Unsupported skill resource layout/);
    await fs.rm(path.join(directory, 'skills/supporting/example/references'), { recursive: true });
    await fs.symlink(path.join(directory, 'skills/supporting/example'), path.join(directory, 'skills/link'));
    await assert.rejects(buildSkills({ root, write: false }), /symlinks/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
