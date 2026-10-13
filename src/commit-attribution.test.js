import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECT_AUTHOR, stripToolCoauthors, assertNoToolCoauthors, attributedCommitBody, assertExistingGitHubIdentity, assertGitHubCommit} from './commit-attribution.js';
// Keep the real-Git regressions in the existing required Inspector suite, which
// discovers src/*.test.js (without changing the held CI/package configuration).
import '../scripts/project-attribution.test.mjs';

const human = 'Co-authored-by: Claude Bennett <claude.bennett@example.test>';
const tools = ['Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>',
  'Co-authored-by: Codex <codex@openai.com>',
  'Co-authored-by: relay-by-loew-fi[bot] <335984207+relay-by-loew-fi[bot]@users.noreply.github.com>'];

test('removes only known AI/tool coauthors while preserving human trailers and quoted examples', () => {
  const input = 'Implement the change\r\n\r\n> ' + tools[0] + '\r\n\r\n' + tools.join('\r\n') + '\r\n' + human + '\r\nSigned-off-by: Human <human@example.test>\r\n';
  assert.equal(stripToolCoauthors(input), 'Implement the change\n\n> ' + tools[0] + '\n\n' + human + '\nSigned-off-by: Human <human@example.test>\n');
  assert.equal(stripToolCoauthors(stripToolCoauthors(input)), stripToolCoauthors(input));
  for (const tool of tools) assert.throws(() => assertNoToolCoauthors('Change\n\n' + tool), /unwanted AI\/tool/);
  assert.doesNotThrow(() => assertNoToolCoauthors('Change\n\n' + human));
  assert.equal(stripToolCoauthors('Change\n\nCo-authored-by: Codex <human@example.test>'), 'Change\n\nCo-authored-by: Codex <human@example.test>\n');
});

test('explicit API metadata replaces unwanted author and committer without changing tree or parents', () => {
  const body = attributedCommitBody({message: 'Change\n\n' + tools[1] + '\n' + human, tree: 'a'.repeat(40), parents: ['b'.repeat(40)], author: {name: 'Codex', email: 'codex@openai.com'}, committer: {name: 'relay', email: 'actions@users.noreply.github.com'}});
  assert.deepEqual(body.author, {name: 'Lauren Olivia', email: 'lrnoliv@gmail.com'});
  assert.deepEqual(body.committer, body.author);
  assert.equal(body.tree, 'a'.repeat(40));
  assert.deepEqual(body.parents, ['b'.repeat(40)]);
  assert.equal(body.message, 'Change\n\n' + human + '\n');
});

const profile = {login: 'lrnolivia', id: 311277794};
const witness = {sha: PROJECT_AUTHOR.witness_sha, author: profile, committer: profile, commit: {author: {name: 'Lauren Olivia', email: 'lrnoliv@gmail.com'}, committer: {name: 'Lauren Olivia', email: 'lrnoliv@gmail.com'}}};
test('requires the existing account and exact GitHub-linked identity witness', () => {
  assert.doesNotThrow(() => assertExistingGitHubIdentity(profile, witness));
  assert.throws(() => assertExistingGitHubIdentity({login: 'relay-by-loew-fi[bot]', id: 1}, witness), /account is not Lauren/);
  assert.throws(() => assertExistingGitHubIdentity(profile, {...witness, author: {login: 'lrnolivia', id: 1}}), /witness/);
  assert.throws(() => assertExistingGitHubIdentity(profile, {...witness, commit: {...witness.commit, author: {name: 'Lauren Olivia', email: 'invented@example.test'}}}), /Unexpected author/);
});

test('checks exact final provider metadata and distinguishes GitHub committer from bot author', () => {
  const sha = 'd'.repeat(40);
  const commit = {sha, author: profile, committer: {login: 'web-flow'}, commit: {author: {...witness.commit.author}, committer: {name: 'GitHub', email: 'noreply@github.com'}, message: 'Reviewed change\n\n' + human}};
  assert.doesNotThrow(() => assertGitHubCommit(commit, sha));
  assert.throws(() => assertGitHubCommit(commit, 'e'.repeat(40)), /SHA differs/);
  assert.throws(() => assertGitHubCommit({...commit, author: {login: 'relay-by-loew-fi[bot]'}}, sha), /not linked to Lauren/);
  assert.throws(() => assertGitHubCommit({...commit, commit: {...commit.commit, author: {name: 'relay-by-loew-fi[bot]', email: '335984207+relay-by-loew-fi[bot]@users.noreply.github.com'}}}, sha), /Unexpected author/);
  assert.throws(() => assertGitHubCommit({...commit, commit: {...commit.commit, message: 'Change\n\n' + tools[0]}}, sha), /unwanted AI\/tool/);
  assert.throws(() => assertGitHubCommit({...commit, committer: {login: 'relay-by-loew-fi[bot]'}}, sha), /Unexpected committer/);
});
