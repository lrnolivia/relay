import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeOrder,moveCard,MOSAIC_KEYS} from '../public/mosaic-order.js';
test('saved layouts reject unknown/duplicate cards and restore missing cards',()=>{
 assert.deepEqual(normalizeOrder(['motion','bogus','motion']),['motion','progress','needs','activity']);
 assert.deepEqual(normalizeOrder(null),MOSAIC_KEYS);
});
test('pointer and keyboard moves preserve every card exactly once',()=>{
 const original=[...MOSAIC_KEYS];const moved=moveCard(original,'activity','progress');
 assert.deepEqual(moved,['activity','progress','needs','motion']);assert.deepEqual(original,MOSAIC_KEYS);
 assert.deepEqual(moveCard(moved,'activity','motion'),['progress','needs','motion','activity']);
 assert.deepEqual(moveCard(original,'unknown','needs'),original);
});
