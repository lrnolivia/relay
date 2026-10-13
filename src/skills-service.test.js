import test from 'node:test';
import assert from 'node:assert/strict';
import { callSkills, skillsTool } from './skills-service.js';
import { SKILL_BUNDLES } from './skills-bundles.js';
import { createSkillsRuntime } from './skills-runtime.js';
import { createSkillRegistry } from './skills-registry.js';
import { augmentToolList } from './relay-entry.js';
const one = () => structuredClone(SKILL_BUNDLES.find(x => x.manifest.id === 'relay.supporting.release'));
test('real authored packs are exposed through one registered tool and byte-verified at read/vendor time', async () => {
 assert.ok(augmentToolList([]).some(x=>x.name===skillsTool.name));
 const catalog = await callSkills({action:'catalog'});assert.equal(catalog.manifests.length,31);
 for(const word of ['engineering','research','documentation','release','qa','accessibility','security','github','cloudflare']) assert.ok(catalog.manifests.some(x=>x.id==='relay.supporting.'+word));
 for(const bundle of SKILL_BUNDLES) {
  const result = await callSkills({action:'audit',id:bundle.manifest.id,capabilities:['figma'],max_context:32768});assert.ok(result.audit.every(x=>x.integrity_verified));assert.ok(result.audit.some(x=>x.id===bundle.manifest.id));
 }
 const exported=await callSkills({action:'vendor',id:one().manifest.id});assert.equal(exported.installed,false);assert.equal(exported.bundles[0].files[0].text,one().text);
 const corrupt=one();corrupt.text=corrupt.text.replace('# Release engineering','# Releasf engineering');await assert.rejects(callSkills({action:'read',id:corrupt.manifest.id},[corrupt]),/integrity/);
 await assert.rejects(callSkills({action:'read',id:'relay.platforms.figma'}),/capability/);
});
test('dependency closure is atomic under budget, capabilities, cycles and direct load', async()=>{
 const base=one(),dep=one();dep.manifest.id='relay.dependency';dep.manifest.tags=[];
 base.manifest.dependencies=[dep.manifest.id];
 const rt=createSkillsRuntime({manifests:[base.manifest,dep.manifest],loader:async m=>m.id===base.manifest.id?base:dep});
 const resolved=rt.resolve({intent_tags:['release'],max_context:32768});assert.deepEqual(resolved.selected.map(x=>x.id),['relay.dependency',base.manifest.id]);
 await assert.rejects(rt.load([{id:base.manifest.id}]),/dependency/);
 assert.equal(rt.resolve({intent_tags:['release'],max_context:base.manifest.context_budget}).selected.length,0);
 const gated=structuredClone(dep);gated.manifest.required_capabilities=['missing'];
 const blocked=createSkillsRuntime({manifests:[base.manifest,gated.manifest],loader:async()=>base});assert.equal(blocked.resolve({intent_tags:['release']}).selected.length,0);
 assert.throws(()=>createSkillRegistry([base.manifest]),/missing skill dependency/);
 dep.manifest.dependencies=[base.manifest.id];assert.throws(()=>createSkillRegistry([base.manifest,dep.manifest]),/cyclic/);
});
test('private packs cannot escape project scope and input paths/actions fail closed',async()=>{
 const privateBundle=one();Object.assign(privateBundle.manifest,{origin:'project-private',project:'field'});
 assert.equal((await callSkills({action:'catalog'},[privateBundle])).manifests.length,0);
 await assert.rejects(callSkills({action:'read',id:privateBundle.manifest.id},[privateBundle]),/scope/);
 await assert.rejects(callSkills({action:'exec',id:'../../secrets'}));
 const runtime=createSkillsRuntime({manifests:[privateBundle.manifest],loader:async()=>privateBundle});await assert.rejects(runtime.load([{id:privateBundle.manifest.id}]),/project gate/);
});

test('real task vocabulary resolves useful minimal cross-pack compositions and installs exact bytes', async () => {
 const { installSkills } = await import('../packages/skills/install.mjs');
 const fs = await import('node:fs/promises');
 const os = await import('node:os');
 const path = await import('node:path');
 const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'relay-skill-composition-')));
 const scenarios = [
  { tags:['engineering','build','testing'], ids:['relay.supporting.engineering','relay.supporting.qa'] },
  { tags:['design-system','tokens','responsive','keyboard','accessibility'], platform:'web', ids:['relay.creative.design-systems','relay.supporting.accessibility','relay.platforms.web'] },
  { tags:['profiling','fonts','network'], ids:['relay.performance.performance-budgets'] },
  { tags:['pull-request','checks','release','rollback'], ids:['relay.supporting.github','relay.supporting.release'] },
  { tags:['workers','r2','deployment'], ids:['relay.supporting.cloudflare','relay.supporting.release'] },
  { tags:['reference','screenshot'], ids:['relay.creative.visual-reference'] },
  { tags:['regression-protection'], ids:['relay.supporting.qa','relay.supporting.release','relay.supporting.regression-protection'] }
 ];
 try {
  for (const scenario of scenarios) {
   const context = { intent_tags:scenario.tags, ...(scenario.platform ? {platform:scenario.platform}:{}), max_skills:scenario.ids.length, max_context:8192 };
   const resolved = await callSkills({ action:'resolve', ...context });
   assert.deepEqual(resolved.selected.map(x=>x.id).sort(),scenario.ids.toSorted());
   assert.ok(resolved.selected.every(x=>x.reasons.length>0));
   const exportsById=new Map();
   for (const id of scenario.ids) {
    const result=await callSkills({action:'vendor',id,max_context:8192});
    assert.equal(result.installed,false);
    for(const bundle of result.bundles) exportsById.set(bundle.manifest.id,{manifest:bundle.manifest,text:bundle.files[0].text});
   }
   const exported=[...exportsById.values()];
   let admissions=0;
   const input={bundles:exported,selection:resolved.selected,context,directory,admit:async request=>{admissions++;assert.ok(request.files.includes('skills.lock.json'));}};
   const installed=await installSkills(input);
   assert.equal(installed.installed,true);assert.equal(admissions,1);
   for(const bundle of exported) {
    assert.equal(await fs.readFile(path.join(installed.directory,bundle.manifest.id,'SKILL.md'),'utf8'),bundle.text);
    assert.equal((await callSkills({action:'read',id:bundle.manifest.id})).bundles.find(x=>x.manifest.id===bundle.manifest.id).text,bundle.text);
   }
   assert.equal((await installSkills(input)).replayed,true);
  }
  for(const query of ['testing','handoff','tokens','fonts','workers','pull-request']) {
   assert.ok((await callSkills({action:'search',query})).manifests.length>0,query);
  }
  const gated=await callSkills({action:'resolve',intent_tags:['figma'],max_skills:1});
  assert.equal(gated.selected.length,0);
  assert.ok(gated.rejected.some(x=>x.id==='relay.platforms.figma'&&x.reason==='missing-capability'));
  const neutral=await callSkills({action:'resolve',intent_tags:['design-system','reference'],max_skills:2});
  assert.deepEqual(neutral.selected.map(x=>x.id).sort(),['relay.creative.design-systems','relay.creative.visual-reference']);
  const tight=await callSkills({action:'resolve',intent_tags:['engineering','testing'],max_context:256});
  assert.equal(tight.selected.length,0);
  assert.ok(tight.rejected.some(x=>x.reason==='context-budget'));
 } finally {await fs.rm(directory,{recursive:true,force:true});}
});

test('regression protection loads QA and release atomically and fails closed when its baseline guidance is incomplete', async () => {
 const id='relay.supporting.regression-protection';
 const read=await callSkills({action:'read',id});
 assert.deepEqual(read.bundles.map(x=>x.manifest.id),['relay.supporting.qa','relay.supporting.release',id]);
 const required=read.bundles.reduce((sum,x)=>sum+x.manifest.context_budget,0);
 const short=await callSkills({action:'resolve',intent_tags:['regression-protection'],max_context:required-1,max_skills:3});
 assert.equal(short.selected.length,0);
 assert.ok(short.rejected.some(x=>x.id===id&&x.reason==='context-budget'));
 const runtime=createSkillsRuntime({manifests:SKILL_BUNDLES.map(x=>x.manifest),loader:async m=>SKILL_BUNDLES.find(x=>x.manifest.id===m.id)});
 await assert.rejects(runtime.load([{id}]),/dependency/);
 const corrupt=structuredClone(SKILL_BUNDLES);
 const qa=corrupt.find(x=>x.manifest.id==='relay.supporting.qa');
 qa.text=qa.text.replace('# Testing and QA','# Testinf and QA');
 await assert.rejects(callSkills({action:'read',id},corrupt),/integrity/);
});
