import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {executionPrompt} from '../scripts/relay-executor.mjs';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
test('one current Bible and manifest define the verified operational repository and product-doc exceptions',()=>{
 const manifest=JSON.parse(read('contracts/manifest.json')),bible=read('LOEW_CHAT_BIBLE.md');
 assert.equal(manifest.authority,'lrnolivia/relay@main');assert.equal(manifest.contract,'LOEW_CHAT_BIBLE.md');assert.equal(manifest.single_bible,true);assert.equal(manifest.version,'2026-10-20.3');assert.ok(bible.includes('Version: `'+manifest.version+'`'));assert.equal(manifest.documentation_ownership.operational_repository,'lrnolivia/relay');assert.equal(manifest.documentation_ownership.non_product_docs_path,'docs/<project-id>/');
 for(const text of ['6.1.1 Goal-preserving expansion','directly related improvements','paid service','Codex and Claude','build-required runbooks','user-facing release notes/changelogs'])assert.ok(bible.includes(text),text);
 assert.match(read('LOEW_CHAT_BIBLE_CURRENT.md'),/RETIRED|retired/);assert.match(read('CLAUDE.md'),/AGENTS\.md/);assert.match(read('AGENTS.md'),/docs\/<project-id>\//);
});
test('executor context routes Field maintenance into Relay while preserving actual product docs',()=>{
 const prompt=executionPrompt({project:'field',repository:'lrnolivia/field',assignment:'fixture',objective:{}},{},[]),data=JSON.parse(prompt.split('\n\n')[1]);
 assert.equal(data.context.documentation_routing.operational_repository,'lrnolivia/relay');assert.equal(data.context.documentation_routing.operational_directory,'docs/field/');assert.equal(data.context.documentation_routing.product_repository,'lrnolivia/field');assert.ok(data.context.documentation_routing.preserve.includes('architecture'));assert.match(prompt,/outside the source checkout/);assert.match(prompt,/Do not implement proposed expansion before admission/);
});
test('historical operational records preserve original prose and referenced old paths resolve to archives',()=>{
 const moves={'docs/STATE.md':'docs/relay/archive/pre-consolidation-state.md','docs/RUNNER_IMPORT_PROVENANCE.md':'docs/relay/archive/runner-import-provenance.md','docs/CONTROL_STATE_MIGRATION.md':'docs/relay/archive/control-state-migration.md','docs/CONSOLIDATION_PROGRAM.md':'docs/relay/archive/consolidation-program.md'};
 const textWithoutLinkTargets=s=>s.replace(/(\]\()([^\s)]+)(\))/g,'$1TARGET$3');
 for(const [old,destination] of Object.entries(moves)){
  const pointer=read(old),archive=read(destination),original=execFileSync('git',['show','6138926ddfcd63e696b0ff20c12bcd51a6f61de1:'+old],{cwd:new URL('.',root),encoding:'utf8'});
  assert.ok(pointer.split('\n').length<=3);const target=/\]\(([^)]+)\)/.exec(pointer)[1];assert.equal(path.posix.normalize(path.posix.join(path.posix.dirname(old),target)),destination);
  assert.match(archive,/Archived operational record/);assert.equal(textWithoutLinkTargets(archive.slice(archive.indexOf('\n\n')+2)),textWithoutLinkTargets(original));
 }
 for(const keep of ['README.md','docs/ARCHITECTURE.md','docs/ACCESS_CONTROL.md','docs/MONOREPO_LAYOUT.md','docs/HUMAN_QA_HELPER.md'])assert.ok(read(keep).length>100,keep);
});
test('active assignment and provider guidance reference canonical additive authority instead of prohibiting related growth',()=>{
 const authoring=read('night-shift/ASSIGNMENT_AUTHORING.md');assert.doesNotMatch(authoring,/Do not silently grow an assignment/);assert.match(authoring,/strengthening improvements/);
 for(const file of ['skills/planning/PLANNING_ROUTING.md','skills/planning/CAUGHT_UP_RECOVERY.md','skills/coordination/WORKER_COMMUNICATION.md','skills/supporting/engineering/SKILL.md','skills/supporting/documentation/SKILL.md','skills/supporting/regression-protection/SKILL.md']){const s=read(file);assert.match(s,/LOEW_CHAT_BIBLE\.md/);assert.match(s,/Codex and Claude/);assert.match(s,/goal|original/);assert.match(s,/docs\/<project-id>\//);}
 assert.match(read('docs/relay/DOCUMENTATION_ROUTING_20261020.md'),/read-only/);assert.match(read('docs/relay/EXECUTION_CONTINUITY_20261020.md'),/native Claude desktop/);
});

test('native bootstrap selects the real connected-tool adapter and preserves truthful fixture readiness',()=>{const doc=read('docs/relay/NATIVE_CONTINUITY_20261020.md');assert.match(read('AGENTS.md'),/native continuity adapter/);assert.match(doc,/relay_runner_assignments/);assert.match(doc,/subobjective_completed/);assert.match(doc,/No standalone token/);assert.match(doc,/not an unattended/);});
