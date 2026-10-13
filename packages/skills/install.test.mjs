import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { installSkills } from './install.mjs';
import { SKILL_BUNDLES } from '../../src/skills-bundles.js';
test('portable installs are admitted, pinned, read back and never overwrite a tampered bundle',async()=>{
  const directory=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'relay-skills-fixture-')));
  try {
    const input={bundles:SKILL_BUNDLES,selection:[{id:'relay.supporting.engineering'}],directory,admit:async request=>{assert.ok(request.files.includes('skills.lock.json'));}};
    const first=await installSkills(input);assert.equal(first.installed,true);
    assert.equal((await installSkills(input)).replayed,true);
    const entry=path.join(first.directory,'relay.supporting.engineering/SKILL.md');
    assert.match(await fs.readFile(entry,'utf8'),/^---/);
    await fs.writeFile(entry,'unexpected local edit');
    await assert.rejects(installSkills(input),/differs/);
    assert.equal(await fs.readFile(entry,'utf8'),'unexpected local edit');
    await assert.rejects(installSkills({...input,admit:undefined}),/admission/);
  } finally {await fs.rm(directory,{recursive:true,force:true});}
});
