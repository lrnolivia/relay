// The suite as it stood before the approved change.
import test from 'node:test';
import assert from 'node:assert/strict';
const app = await import(process.env.FIXTURE_APP);
const button = (html, selector) => html.match(new RegExp(`<button ${selector}>([^<]*)</button>`))?.[1];

test('save button saves', () => {
  assert.equal(button(app.render(), 'data-test="save"'), 'Save');
  assert.equal(app.actions.save(), 'saved');
});
test('share button shares', () => {
  assert.equal(button(app.render(), 'data-test="share"'), 'Share');
  assert.equal(app.actions.share(), 'shared');
});
test('csv export downloads', () => {
  assert.equal(button(app.render(), 'data-test="export-csv"'), 'Export CSV');
  assert.equal(app.actions.exportCsv(), 'a,b\n1,2');
});
