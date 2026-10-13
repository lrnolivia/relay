import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROJECT_AUTHOR} from '../src/commit-attribution.js';
import {configure, commitStaged, checkCommit, verifyAccount} from './project-attribution.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const tool = join(root, 'scripts/project-attribution.mjs');
const request = path => path === 'user' ? {login: 'lrnolivia', id: 311277794} : {
  sha: PROJECT_AUTHOR.witness_sha, author: {login: 'lrnolivia', id: 311277794}, committer: {login: 'lrnolivia', id: 311277794},
  commit: {author: {name: 'Lauren Olivia', email: 'lrnoliv@gmail.com'}, committer: {name: 'Lauren Olivia', email: 'lrnoliv@gmail.com'}}
};
const git = (repo, args, extraEnv = {}) => execFileSync('git', ['-C', repo, ...args], {encoding: 'utf8', env: {...process.env, ...extraEnv}, stdio: ['pipe', 'pipe', 'pipe']}).trim();
function fixture(t) {
  const repo = mkdtempSync(join(tmpdir(), 'relay-attribution-'));
  t.after(() => rmSync(repo, {recursive: true, force: true}));
  git(repo, ['init', '-b', 'main']);
  git(repo, ['remote', 'add', 'origin', 'https://github.com/lrnolivia/fixture.git']);
  git(repo, ['config', '--local', 'commit.gpgsign', 'false']);
  return repo;
}
const stage = (repo, value) => { writeFileSync(join(repo, 'work.txt'), value); git(repo, ['add', 'work.txt']); };

test('repository setup is local and idempotent, and regular Git commits omit tool trailers', t => {
  const repo = fixture(t);
  const globalBefore = (() => { try { return git(repo, ['config', '--global', '--list']); } catch { return ''; } })();
  configure(repo, request);
  configure(repo, request);
  assert.equal(git(repo, ['config', '--local', 'user.name']), 'Lauren Olivia');
  assert.equal(git(repo, ['config', '--local', 'user.email']), 'lrnoliv@gmail.com');
  stage(repo, 'source');
  git(repo, ['commit', '-m', 'Change\n\nCo-authored-by: Codex <codex@openai.com>\nCo-authored-by: Claude Bennett <claude.bennett@example.test>']);
  const raw = git(repo, ['cat-file', 'commit', 'HEAD']);
  assert.match(raw, /^author Lauren Olivia <lrnoliv@gmail.com> /m);
  assert.match(raw, /^committer Lauren Olivia <lrnoliv@gmail.com> /m);
  assert.doesNotMatch(raw, /codex@openai.com/);
  assert.match(raw, /Co-authored-by: Claude Bennett <claude.bennett@example.test>/);
  assert.equal(checkCommit(repo).author.email, 'lrnoliv@gmail.com');
  assert.equal((() => { try { return git(repo, ['config', '--global', '--list']); } catch { return ''; } })(), globalBefore);
});

test('real local squash result uses Lauren metadata and preserves a human coauthor', t => {
  const repo = fixture(t);
  configure(repo, request);
  stage(repo, 'baseline'); git(repo, ['commit', '-m', 'Baseline']);
  const baseline = git(repo, ['rev-parse', 'HEAD']);
  git(repo, ['switch', '-c', 'feature']);
  stage(repo, 'feature');
  const message = join(repo, 'message.txt');
  writeFileSync(message, 'Feature\n\nCo-authored-by: Claude Opus 5.5 <noreply@anthropic.com>\nCo-authored-by: Riley <riley@example.test>');
  const source = commitStaged(repo, message, request);
  git(repo, ['switch', 'main']);
  git(repo, ['merge', '--squash', 'feature']);
  writeFileSync(message, 'Reviewed feature\n\nCo-authored-by: relay-by-loew-fi[bot] <335984207+relay-by-loew-fi[bot]@users.noreply.github.com>\nCo-authored-by: Riley <riley@example.test>');
  const final = commitStaged(repo, message, request);
  assert.notEqual(final.sha, source.sha);
  assert.deepEqual(final.author, {name: 'Lauren Olivia', email: 'lrnoliv@gmail.com'});
  assert.deepEqual(final.committer, final.author);
  assert.match(final.message, /Co-authored-by: Riley <riley@example.test>/);
  assert.doesNotMatch(final.message, /relay-by-loew-fi|noreply@anthropic/);
  assert.equal(git(repo, ['rev-list', '--parents', '-n', '1', final.sha]), `${final.sha} ${baseline}`);
  assert.equal(git(repo, ['rev-parse', `${final.sha}^{tree}`]), git(repo, ['rev-parse', `${source.sha}^{tree}`]));
  // These fixtures never call GitHub's merge API or publish a ref.
});

test('guard blocks AI author overrides before a new commit is created', t => {
  const repo = fixture(t); configure(repo, request); stage(repo, 'source');
  const env = {GIT_AUTHOR_NAME: 'Codex', GIT_AUTHOR_EMAIL: 'codex@openai.com'};
  assert.throws(() => git(repo, ['commit', '-m', 'Change'], env), /Command failed/);
  assert.throws(() => git(repo, ['rev-parse', '--verify', 'HEAD']));
});

test('guard blocks AI committer overrides even with Lauren as author', t => {
  const repo = fixture(t); configure(repo, request); stage(repo, 'source');
  assert.throws(() => git(repo, ['commit', '-m', 'Change'], {GIT_COMMITTER_NAME: 'relay', GIT_COMMITTER_EMAIL: 'actions@users.noreply.github.com'}), /Command failed/);
  assert.throws(() => git(repo, ['rev-parse', '--verify', 'HEAD']));
});

test('existing hooks and configured hook directories are preserved', t => {
  const repo = fixture(t);
  mkdirSync(join(repo, '.git/hooks'), {recursive: true});
  const hook = join(repo, '.git/hooks/commit-msg');
  writeFileSync(hook, '#!/bin/sh\nexit 0\n');
  const before = readFileSync(join(repo, '.git/config'), 'utf8');
  assert.throws(() => configure(repo, request), /Existing commit-msg hook/);
  assert.equal(readFileSync(hook, 'utf8'), '#!/bin/sh\nexit 0\n');
  assert.equal(readFileSync(join(repo, '.git/config'), 'utf8'), before);
  rmSync(hook);
  git(repo, ['config', '--local', 'core.hooksPath', 'custom-hooks']);
  assert.throws(() => configure(repo, request), /Existing core.hooksPath/);
});

test('wrong accounts fail before local config mutation; shared worktrees fail closed', t => {
  const repo = fixture(t);
  const before = readFileSync(join(repo, '.git/config'), 'utf8');
  assert.throws(() => configure(repo, () => ({login: 'other', id: 1})), /account is not Lauren/);
  assert.equal(readFileSync(join(repo, '.git/config'), 'utf8'), before);
  configure(repo, request); stage(repo, 'baseline'); git(repo, ['commit', '-m', 'Baseline']);
  const worktree = join(repo, 'linked'); git(repo, ['worktree', 'add', '-b', 'linked', worktree]);
  assert.throws(() => configure(worktree, request), /Linked worktrees/);
  git(repo, ['remote', 'set-url', 'origin', 'https://github.com/other/fixture.git']);
  assert.throws(() => configure(repo, request), /Lauren-owned/);
});

test('linked hook files and directories cannot redirect local setup outside the clone', t => {
  const repo = fixture(t);
  const target = join(repo, 'other-hook'); writeFileSync(target, 'preserve me');
  const hook = join(repo, '.git/hooks/commit-msg'); symlinkSync(target, hook);
  assert.throws(() => configure(repo, request), /linked commit-msg hook/);
  assert.equal(readFileSync(target, 'utf8'), 'preserve me');
  rmSync(hook); rmSync(join(repo, '.git/hooks'), {recursive: true});
  const outside = join(repo, 'other-hooks'); mkdirSync(outside); symlinkSync(outside, join(repo, '.git/hooks'));
  assert.throws(() => configure(repo, request), /linked hooks directory/);
});

test('read-only check rejects already-created AI commit metadata and CLI invalid usage', t => {
  const repo = fixture(t); stage(repo, 'source');
  git(repo, ['commit', '-m', 'Change'], {GIT_AUTHOR_NAME: 'Codex', GIT_AUTHOR_EMAIL: 'codex@openai.com', GIT_COMMITTER_NAME: 'Codex', GIT_COMMITTER_EMAIL: 'codex@openai.com'});
  assert.throws(() => checkCommit(repo), /Unexpected author/);
  assert.throws(() => execFileSync(process.execPath, [tool, 'check', '--repo', repo], {stdio: 'pipe'}));
  assert.throws(() => execFileSync(process.execPath, [tool, 'merge', '--repo', repo], {stdio: 'pipe'}));
});

test('identity verification uses only existing read-only user and commit routes', () => {
  const calls = [];
  verifyAccount(root, path => { calls.push(path); return request(path); });
  assert.deepEqual(calls, ['user', 'repos/lrnolivia/gwfamily/commits/368f109a63505b9bea976f42217522899fa5d39f']);
});

test('checked-in Claude config disables credits and session links without other workflow changes', () => {
  assert.deepEqual(JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8')), {
    attribution: {commit: '', pr: '', sessionUrl: false}, includeCoAuthoredBy: false,
  });
});
