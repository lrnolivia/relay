import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {loewInterfaceSkillCatalogEntry,loewInterfaceSkillResource,loewInterfaceSkillResourceDescriptor} from './loew-interface-skill.js';
test('loew interface skill pins Field provenance and motion verification without replacing product identity',()=>{
 const entry=loewInterfaceSkillCatalogEntry(),resource=loewInterfaceSkillResource();assert.equal(entry.uri,resource.uri);assert.equal(loewInterfaceSkillResourceDescriptor().mimeType,'text/markdown');
 assert.equal(entry.resources[0].digest,'sha256:'+createHash('sha256').update(resource.text).digest('hex'));
 for(const requirement of ['field-glyph.tsx','position AND velocity','prefers-reduced-motion','rollback','ctrl','Relay','Inspector'])assert.ok(resource.text.includes(requirement));
});
