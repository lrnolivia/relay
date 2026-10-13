import test from 'node:test';
import assert from 'node:assert/strict';
import {splitReviewNotes,joinReviewNotes} from '../public/qa-notes.js';

const marker='Agent-prepared review packet (pending human judgment):';
const packet=marker+'\n'+JSON.stringify({title:'Old guidance',questions:[{prompt:'Check "quoted" text and braces } safely.'}]});
test('Legacy guidance preserves original packet and every human note character',()=>{
  const notes='  Keep my indentation.\n<script>not executable</script>\n';
  const combined=joinReviewNotes(packet,notes), parts=splitReviewNotes(combined);
  assert.equal(parts.prefix,packet);assert.equal(parts.notes,notes);assert.equal(joinReviewNotes(parts.prefix,parts.notes),combined);
  for(const text of ['{"questions":[]}',marker+'\nnot JSON',marker+'\n{"title":"mine"}']) assert.equal(splitReviewNotes(text).notes,text);
});
