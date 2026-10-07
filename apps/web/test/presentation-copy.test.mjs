import test from 'node:test';
import assert from 'node:assert/strict';
import { statusLabel, phaseLabel, eventLabel, summaryText } from '../../../packages/shared-ui/presentation-copy.js';
test('display copy preserves meaningful work distinctions and unknown states',()=>{
 assert.notEqual(statusLabel('queued'),statusLabel('running'));
 assert.notEqual(statusLabel('deployed'),statusLabel('verified'));
 assert.equal(statusLabel('unknown-new-state'),'status not reported');
 assert.equal(phaseLabel(undefined),'phase not reported');
 assert.equal(eventLabel('pr-opened'),'ready for review');
 assert.equal(summaryText('Node.js ENOBUFS packet error','A check needs help.'),'A check needs help.');
 assert.equal(summaryText('Review the new header','Next step unknown'),'Review the new header');
});
