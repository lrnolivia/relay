import test from 'node:test';
import assert from 'node:assert/strict';
import { statusLabel, phaseLabel, eventLabel, summaryText } from '../../../packages/shared-ui/presentation-copy.js';
test('display copy preserves meaningful work distinctions and unknown states',()=>{
 assert.notEqual(statusLabel('queued'),statusLabel('running'));
 assert.notEqual(statusLabel('deployed'),statusLabel('verified'));
 assert.equal(statusLabel('unknown-new-state'),'status not reported');
 assert.equal(phaseLabel(undefined),'phase not reported');
 assert.equal(eventLabel('pr-opened'),'pull request opened');
 assert.equal(summaryText('Node.js ENOBUFS packet error','A check needs help.'),'A check needs help.');
 assert.equal(summaryText('Review the new header','Next step unknown'),'Review the new header');
});
test('website labels distinguish observed facts from readiness, scheduling and progress',()=>{
 assert.equal(statusLabel('reserved-but-idle'),'waiting to start');
 assert.equal(statusLabel('active'),'assigned');
 assert.equal(statusLabel('enabled'),'enabled');
 assert.equal(statusLabel('idle'),'idle');
 assert.equal(statusLabel('waiting-for-human'),'needs review');
 assert.equal(eventLabel('source-commit'),'source change recorded');
 assert.equal(eventLabel('cloud-deployment'),'deployment recorded');
 assert.equal(phaseLabel('review'),'review');
 for(const value of ['constructor','__proto__','toString']){
  assert.equal(statusLabel(value),'status not reported');
  assert.equal(phaseLabel(value),'phase not reported');
  assert.equal(eventLabel(value),'progress update');
 }
});
