import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePresentation,countVisual} from '../../../packages/shared-ui/presentation.js';
import {groupedProjects,projectInGroup} from '../../../packages/shared-ui/project-groups.js';

test('retired settings migrate without losing supported choices; fractions require real denominators',()=>{
 const migrated=normalizePresentation({desktop:'header',overview:'roomy',nav:'bottom',brand:'roomy',richness:'rich',motion:'calm'});
 assert.equal(migrated.desktop,'rail');assert.equal(migrated.overview,'compact');assert.equal(migrated.nav,'bottom');assert.equal(migrated.richness,'rich');assert.equal(migrated.motion,'calm');
 assert.match(countVisual('2',5,'current items'),/2 of 5 current items/);assert.doesNotMatch(countVisual('2+',5),/signal-ratio/);assert.doesNotMatch(countVisual('5',2),/signal-ratio/);
 const groups=groupedProjects([{id:'bazzite-custom'},{id:'loew-shell'},{id:'field'},{id:'rtxforge'},{id:'rtxforge-mfg'}]);
 assert.equal(groups.length,3);assert.equal(groups[0].children[0].id,'loew-shell');assert.equal(projectInGroup('loew-shell','bazzite-custom'),true);assert.equal(projectInGroup('rtxforge','bazzite-custom'),false);
});
