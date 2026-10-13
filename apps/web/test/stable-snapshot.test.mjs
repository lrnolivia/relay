import test from 'node:test';
import assert from 'node:assert/strict';
import {settledSnapshot} from '../public/stable-snapshot.js';
test('first load remains unavailable until all project requests settle',()=>{
 assert.equal(settledSnapshot(null,{loadingProgress:['field']}),null);
 const complete={loadingProgress:[],progress:{field:{progress:[]}}};
 assert.equal(settledSnapshot(null,complete),complete);
});
test('refresh keeps the exact last rendered snapshot through partial arrivals',()=>{
 const previous={loadingProgress:[],progress:{field:{progress:[{assignment:'one'}]}}};
 assert.equal(settledSnapshot(previous,{loadingProgress:['relay'],progress:{}}),previous);
 const next={loadingProgress:[],progress:{field:{progress:[{assignment:'two'}]}}};
 assert.equal(settledSnapshot(previous,next),next);
});
test('settled failure metadata remains visible rather than pretending success',()=>{
 const partial={loadingProgress:[],failedProgress:['field']};
 assert.equal(settledSnapshot(null,partial),partial);
});
