import test from 'node:test';
import assert from 'node:assert/strict';
import { callSkills } from './skills-service.js';
import { SKILL_BUNDLES } from './skills-bundles.js';

const cleanupId = 'relay.supporting.development-cleanup';

test('development cleanup is discoverable by storage intent across host platforms', async () => {
  for (const query of ['cleanup', 'storage', 'artifact', 'retention']) {
    const result = await callSkills({ action: 'search', query });
    assert.ok(result.manifests.some(manifest => manifest.id === cleanupId));
  }
  for (const platform of ['windows', 'macos', 'gnome']) {
    const result = await callSkills({ action: 'resolve', intent_tags: ['cleanup'], platform, max_skills: 1 });
    assert.deepEqual(result.selected.map(skill => skill.id), [cleanupId]);
  }
});

test('routine engineering and release selections load cleanup as an integrity-checked dependency', async () => {
  for (const [id, intent] of [['relay.supporting.engineering', 'implementation'], ['relay.supporting.release', 'deployment']]) {
    const resolved = await callSkills({ action: 'resolve', intent_tags: [intent], max_skills: 2 });
    assert.deepEqual(resolved.selected.map(skill => skill.id), [cleanupId, id]);
    const read = await callSkills({ action: 'read', id });
    assert.deepEqual(read.bundles.map(bundle => bundle.manifest.id), [cleanupId, id]);
    assert.ok(read.bundles.every(bundle => bundle.manifest.executable === false));
    const limited = await callSkills({ action: 'resolve', intent_tags: [intent], max_skills: 1 });
    assert.ok(!limited.selected.some(skill => skill.id === id));
    assert.ok(limited.rejected.some(skill => skill.id === id && skill.reason === 'context-budget'));
  }
});

test('tampered cleanup guidance cannot load through an otherwise valid engineering pack', async () => {
  const bundles = SKILL_BUNDLES.map(bundle => bundle.manifest.id === cleanupId ? { ...bundle, text: bundle.text.replace('purpose', 'folder') } : bundle);
  await assert.rejects(callSkills({ action: 'read', id: 'relay.supporting.engineering' }, bundles), /integrity mismatch/);
});
