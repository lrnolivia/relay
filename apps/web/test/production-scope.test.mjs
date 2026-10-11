import test from 'node:test';
import assert from 'node:assert/strict';
import {needsProductionVerification as required,manualProductionVerification} from '../production-scope.mjs';
test('production source, assets and configuration always require exact deployment verification',()=>{
 for(const path of ['src/relay-chat-ui.js','apps/web/readback.mjs','packages/runner/src/cloudflare-worker.mjs','icons/relay-icon.png','projects/ctrl.json','package-lock.json','wrangler.jsonc'])assert.equal(required([path]),true,path);
});
test('metadata-only revisions match Workers Builds exclusions and do not pretend to deploy',()=>{
 assert.equal(required(['.github/workflows/ci.yml','docs/relay/QA.md','coordination/relay.json','assignments/example.json','README.md']),false);
 assert.equal(required([]),false);
 assert.equal(required(['.github/workflows/ci.yml','apps/web/production-scope.mjs']),true);
});
test('invalid scope input fails closed',()=>{assert.throws(()=>required(null));assert.throws(()=>required([{}]));});

test('manual branch CI never expects an unmerged candidate in production; main retains live verification',()=>{
 assert.equal(manualProductionVerification('workflow_dispatch','refs/heads/main'),true);
 for(const ref of ['refs/heads/relay/mcp-rebuild-20261003','refs/tags/release','refs/heads/main-copy'])assert.equal(manualProductionVerification('workflow_dispatch',ref),false);
 assert.equal(manualProductionVerification('pull_request','refs/pull/215/merge'),false);
 assert.throws(()=>manualProductionVerification('workflow_dispatch',undefined));
});
