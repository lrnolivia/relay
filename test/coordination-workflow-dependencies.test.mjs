import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('coordination entrypoints install integrity-locked dependencies before the unchanged trusted engine',async()=>{
 const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8')),dep=lock.packages['node_modules/@noble/hashes'];
 assert.match(dep.version,/^\d+\.\d+\.\d+$/);assert.match(dep.resolved,/^https:\/\/registry.npmjs.org\/@noble\/hashes\/-\/hashes-/);assert.match(dep.integrity,/^sha512-[A-Za-z0-9+/]+=*$/);
 const workflow=await readFile(new URL('../.github/workflows/runner-coordination.yml',import.meta.url),'utf8');
 assert.match(workflow,/repository: lrnolivia\/relay\n\s+ref: main\n\s+persist-credentials: false/);
 for(const block of workflow.split(/(?=^  (?:admission|hygiene):)/m).slice(1)){assert.ok(block.indexOf('run: npm ci --ignore-scripts')>block.indexOf('uses: actions/setup-node'));assert.ok(block.indexOf('run: npm ci --ignore-scripts')<block.indexOf('node "$engine"')||block.indexOf('run: npm ci --ignore-scripts')<block.indexOf('run: node scripts/coordinate.mjs'));assert.doesNotMatch(block,/continue-on-error|npm install|--force/);}
 const dispatched=await readFile(new URL('../.github/workflows/coordination.yml',import.meta.url),'utf8');assert.ok(dispatched.indexOf('run: npm ci --ignore-scripts')<dispatched.indexOf('name: Coordinate without model inference'));assert.match(dispatched,/node scripts\/coordinate.mjs "\$COORD_ACTION" "\$COORD_PROJECT"/);assert.doesNotMatch(dispatched,/continue-on-error|npm install|--force/);
});
