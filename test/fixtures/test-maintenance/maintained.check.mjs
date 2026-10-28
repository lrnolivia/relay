// The suite after intent-aware maintenance for the approved change.
import test from 'node:test';
import assert from 'node:assert/strict';
const app = await import(process.env.FIXTURE_APP);
const button = (html, selector) => html.match(new RegExp(`<button ${selector}>([^<]*)</button>`))?.[1];

// fixture-drift: only the hook moved; both behavior assertions are kept.
test('save button saves', () => {
  assert.equal(button(app.render(), 'data-testid="save-button"'), 'Save');
  assert.equal(app.actions.save(), 'saved');
});
// unchanged behavior: untouched.
test('share button shares', () => {
  assert.equal(button(app.render(), 'data-test="share"'), 'Share');
  assert.equal(app.actions.share(), 'shared');
});
// obsolete-expectation replaced by an absence assertion for the removed feature.
test('csv export is removed', () => {
  assert.equal(button(app.render(), 'data-test="export-csv"'), undefined);
  assert.equal(app.actions.exportCsv, undefined);
});
test('print preview', { skip: 'Print moved to the native dialog; covered by the native UI suite' }, () => {});
