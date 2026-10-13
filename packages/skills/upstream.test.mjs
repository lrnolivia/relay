import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { vendorUpstream } from './upstream.mjs';
import { callSkills } from '../../src/skills-service.js';
const sha=text=>'sha256:'+createHash('sha256').update(text).digest('hex');
test('pinned upstream vendoring preserves license, verifies source bytes and refuses incomplete packs',async()=>{
 const text='---\nname: fixture\ndescription: A synthetic portable pack.\n---\n\nRead the task before changing it.\n',license='MIT License\nCopyright synthetic fixture';
 const args={id:'upstream.fixture',repository:'example/fixture',revision:'a'.repeat(40),path:'skills/fixture/SKILL.md',license:'MIT',integrity:sha(text)};
 const api=async path=>path.includes('/license?')?{encoding:'base64',content:Buffer.from(license).toString('base64'),license:{spdx_id:'MIT'}}:{type:'file',encoding:'base64',content:Buffer.from(text).toString('base64')};
 const bundle=await vendorUpstream(args,api);assert.equal(bundle.text,text);assert.equal(bundle.license_text,license);assert.equal(bundle.manifest.license_integrity,sha(license));
 const exported=await callSkills({action:'vendor',upstream:args},undefined,{},api);assert.equal(exported.pinned,true);assert.equal(exported.bundles[0].files[1].text,license);
 await assert.rejects(vendorUpstream({...args,revision:'main'},api),/immutable/);
 await assert.rejects(vendorUpstream({...args,integrity:sha('changed')},api),/integrity/);
 await assert.rejects(vendorUpstream({...args,license:'Apache-2.0'},api),/license differs/);
 const incomplete=text+'\nRead [details](references/details.md)';
 await assert.rejects(vendorUpstream({...args,integrity:sha(incomplete)},async path=>path.includes('/license?')?api(path):{encoding:'base64',content:Buffer.from(incomplete).toString('base64')}),/supporting-file/);
});
