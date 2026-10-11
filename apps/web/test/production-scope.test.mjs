import test from 'node:test';
import assert from 'node:assert/strict';
import {needsProductionVerification as required,manualProductionVerification,verifiedRecoveryDeployment} from '../production-scope.mjs';
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

test('restored deployment requires exact verified source, provider identity, operation and completion evidence',()=>{
 const source='a'.repeat(40),version='11111111-2222-3333-4444-555555555555';
 const deployment={id:'deployment',created_on:'2026-10-11T23:00:01Z',versions:[{version_id:version,percentage:100}],annotations:{'workers/message':'Relay bounded recovery test-op'}};
 const state={scope:'relay',rollback:{state:'verified',operation_id:'test-op',created_at:'2026-10-11T23:00:00Z',completed_at:'2026-10-11T23:00:02Z',version_id:version,target:{worker:'relay',source_sha:source,version_id:version,compatibility_id:'relay-autonomy-v1'},evidence:JSON.stringify({source_sha:source,version_id:version,deployment_id:'deployment',health_url:'https://relay.loew.fi/health'})}};
 assert.equal(verifiedRecoveryDeployment(deployment,state,source),true);
 for(const mutate of [s=>s.rollback.state='pending',s=>s.rollback.target.source_sha='b'.repeat(40),s=>s.rollback.evidence='{}',s=>s.rollback.operation_id='other',s=>s.rollback.completed_at='2026-10-11T22:00:00Z',s=>s.rollback.target.version_id='other']){const s=structuredClone(state);mutate(s);assert.equal(verifiedRecoveryDeployment(deployment,s,source),false);}
 for(const mutate of [d=>d.id='other',d=>d.versions[0].percentage=50,d=>d.versions.push(d.versions[0]),d=>delete d.annotations,d=>d.created_on='invalid']){const d=structuredClone(deployment);mutate(d);assert.equal(verifiedRecoveryDeployment(d,state,source),false);}
});
