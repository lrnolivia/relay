import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {contextFixture} from './project-context-fixture.mjs';
import {normalizePresentation,countVisual} from '../../../packages/shared-ui/presentation.js';
import {groupedProjects,projectInGroup} from '../../../packages/shared-ui/project-groups.js';

test('retired settings migrate without losing supported choices; fractions require real denominators',()=>{
 const migrated=normalizePresentation({desktop:'header',overview:'roomy',nav:'bottom',brand:'roomy',richness:'rich',motion:'calm'});
 assert.equal(migrated.desktop,'rail');assert.equal(migrated.overview,'compact');assert.equal(migrated.nav,'bottom');assert.equal(migrated.richness,'rich');assert.equal(migrated.motion,'calm');
 assert.match(countVisual('2',5,'current items'),/2 of 5 current items/);assert.doesNotMatch(countVisual('2+',5),/signal-ratio/);assert.doesNotMatch(countVisual('5',2),/signal-ratio/);
 const groups=groupedProjects([{id:'bazzite-custom'},{id:'loew-shell'},{id:'field'},{id:'rtxforge'},{id:'rtxforge-mfg'}]);
 assert.equal(groups.length,3);assert.equal(groups[0].children[0].id,'loew-shell');assert.equal(projectInGroup('loew-shell','bazzite-custom'),true);assert.equal(projectInGroup('rtxforge','bazzite-custom'),false);
});

test('shared viewer keeps selection and source identity through views, reversible bulk changes, reload, and scoped filters',async()=>{
 const fixture=await contextFixture(),browser=await chromium.launch({headless:true});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:'dark'});
   await page.goto(fixture.origin+'/#/runner');await page.locator('.work-viewer[data-summary-state=ready]').waitFor();
   const viewer=page.locator('.work-viewer');await viewer.locator('[data-filter=all]').click();
   const checkbox=viewer.locator('[data-select]').first(),key=await checkbox.getAttribute('data-select');await checkbox.check();
   await viewer.locator('[data-view=visual]').click();assert.equal(await viewer.locator('[data-select]').first().isChecked(),true);assert.equal(await viewer.getAttribute('data-view'),'visual');
   await viewer.locator('[data-bulk=completed]').click();assert.match(await viewer.locator('.work-confirm').innerText(),/1 item/);await viewer.locator('[data-confirm]').click();await viewer.locator('.work-message').filter({hasText:'1 review updated.'}).waitFor();
   const row=viewer.locator('[data-work-key]').filter({has:page.locator('[data-select="'+key+'"]')});assert.match(await row.innerText(),/Review: Completed/);
   assert.equal(fixture.progress.relay[0].state,'working');
   await viewer.locator('[data-bulk=clear-complete]').click();await viewer.locator('[data-confirm]').click();await viewer.locator('.work-message').filter({hasText:'1 review updated.'}).waitFor();assert.match(await row.innerText(),/Archived/);
   await viewer.locator('[data-undo]').click();await viewer.locator('.work-message').filter({hasText:'1 review updated.'}).waitFor();assert.match(await row.innerText(),/Review: Completed/,JSON.stringify([...fixture.reviews.values]));
   await page.reload();await page.locator('.work-viewer[data-summary-state=ready]').waitFor();assert.equal(await viewer.getAttribute('data-view'),'visual');assert.equal(await viewer.locator('[data-select]:checked').count(),0);
   // Dashboard progress is delivered incrementally; an earlier ready state may\n   // precede another exact-key review read. Await the persisted outcome itself.\n   await page.locator('[data-progress-notice]').waitFor({state:'detached'});\n   const restored=viewer.locator('[data-work-key]').filter({has:page.locator('[data-select="'+key+'"]')});\n   await restored.filter({hasText:'Review: Completed'}).waitFor();\n   assert.match(await restored.innerText(),/Review: Completed/,JSON.stringify([...fixture.reviews.values]));
   await viewer.locator('[data-filter=all]').click();await viewer.locator('input[type=search]').fill('saved project');assert.equal(await viewer.locator('.work-item').count(),1);
   await viewer.locator('[data-view=list]').click();assert.equal(await viewer.locator('input[type=search]').inputValue(),'saved project');assert.equal(await viewer.locator('.work-item').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.close();
  }
 }finally{await browser.close();await fixture.close();}
});
