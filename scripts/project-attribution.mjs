import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync, lstatSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROJECT_AUTHOR, stripToolCoauthors, assertAuthor, assertExistingGitHubIdentity, assertGitCommit, assertGitHubCommit} from '../src/commit-attribution.js';

const scriptPath = fileURLToPath(import.meta.url);
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const run = (program, args, cwd, env = process.env, input) => execFileSync(program, args, {cwd, env, input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']});
const git = (repo, args, env, input) => run('git', ['-C', repo, ...args], repo, env, input);
const ghRead = (path, repo) => JSON.parse(run('gh', ['api', path], repo));

export function verifyAccount(repo, request = path => ghRead(path, repo)) {
  assertExistingGitHubIdentity(request('user'), request(`repos/${PROJECT_AUTHOR.witness_repo}/commits/${PROJECT_AUTHOR.witness_sha}`));
}

function ownedCheckout(repo) {
  const root = realpathSync(git(repo, ['rev-parse', '--show-toplevel']).trim());
  const common = realpathSync(resolve(repo, git(repo, ['rev-parse', '--git-common-dir']).trim()));
  if (common !== resolve(root, '.git')) throw Error('Linked worktrees/shared Git directories require their owner to configure attribution; no shared configuration was changed');
  const remote = git(root, ['remote', 'get-url', 'origin']).trim();
  if (!/^(?:https:\/\/github\.com\/|git@github\.com:)lrnolivia\/[^/\s]+?(?:\.git)?$/.test(remote)) throw Error('Attribution setup is restricted to Lauren-owned GitHub project checkouts');
  return {root, common};
}

export function configure(repo, request) {
  const {root, common} = ownedCheckout(repo);
  let hooksPath = '';
  try { hooksPath = git(root, ['config', '--get', 'core.hooksPath']).trim(); } catch (e) { if (e.status !== 1) throw e; }
  if (hooksPath) throw Error('Existing core.hooksPath must be integrated by its owner; no hook/config was replaced');
  const hooksDirectory = resolve(common, 'hooks');
  if (existsSync(hooksDirectory) && realpathSync(hooksDirectory) !== hooksDirectory) throw Error('A linked hooks directory requires its owner; no hook/config was changed');
  const hook = resolve(hooksDirectory, 'commit-msg');
  try { if (lstatSync(hook).isSymbolicLink()) throw Error('A linked commit-msg hook requires its owner; no hook/config was changed'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const contents = '#!/bin/sh\n# Relay prospective project attribution guard\nexec ' + shellQuote(process.execPath) + ' ' + shellQuote(scriptPath) + ' hook "$1" --repo ' + shellQuote(root) + '\n';
  if (existsSync(hook) && readFileSync(hook, 'utf8') !== contents) throw Error('Existing commit-msg hook must be integrated by its owner; no hook/config was replaced');
  verifyAccount(root, request);
  git(root, ['config', '--local', 'user.name', PROJECT_AUTHOR.name]);
  git(root, ['config', '--local', 'user.email', PROJECT_AUTHOR.email]);
  git(root, ['config', '--local', 'user.useConfigOnly', 'true']);
  mkdirSync(dirname(hook), {recursive: true});
  writeFileSync(hook, contents, {mode: 0o755});
  return {repository: root, author: PROJECT_AUTHOR.name, email: PROJECT_AUTHOR.email, hook, scope: 'local-clone-only'};
}

function gitIdentity(repo, kind) {
  const raw = git(repo, ['var', `GIT_${kind}_IDENT`]).trim();
  const match = raw.match(/^(.+) <([^<>]+)> [0-9]+ [+-][0-9]{4}$/);
  if (!match) throw Error(`Invalid Git ${kind} identity`);
  return {name: match[1], email: match[2]};
}

export function guardMessage(repo, path) {
  assertAuthor(gitIdentity(repo, 'AUTHOR'));
  assertAuthor(gitIdentity(repo, 'COMMITTER'), 'committer');
  const message = readFileSync(path, 'utf8');
  writeFileSync(path, stripToolCoauthors(message));
}

export function checkCommit(repo, revision = 'HEAD') {
  const sha = git(repo, ['rev-parse', '--verify', `${revision}^{commit}`]).trim();
  const metadata = assertGitCommit(git(repo, ['cat-file', 'commit', sha]));
  return {sha, ...metadata};
}

// Creates only a new local commit from the caller's staged index. No amend,
// rebase, push, merge API, credential changes or signing/hook bypass flags.
export function commitStaged(repo, messagePath, request) {
  ownedCheckout(repo);
  verifyAccount(repo, request);
  const message = stripToolCoauthors(readFileSync(messagePath, 'utf8'));
  const env = {...process.env, GIT_AUTHOR_NAME: PROJECT_AUTHOR.name, GIT_AUTHOR_EMAIL: PROJECT_AUTHOR.email,
    GIT_COMMITTER_NAME: PROJECT_AUTHOR.name, GIT_COMMITTER_EMAIL: PROJECT_AUTHOR.email};
  git(repo, ['commit', '--file=-'], env, message);
  return checkCommit(repo);
}

export function main(args) {
  const repoAt = args.indexOf('--repo');
  if (repoAt >= 0 && (!args[repoAt + 1] || args[repoAt + 1].startsWith('--'))) throw Error('--repo requires a checkout path');
  const repo = repoAt < 0 ? process.cwd() : resolve(args[repoAt + 1]);
  if (repoAt >= 0) args = [...args.slice(0, repoAt), ...args.slice(repoAt + 2)];
  const [action, value, sha] = args;
  if (action === 'configure' && args.length === 1) return configure(repo);
  if (action === 'hook' && args.length === 2) return guardMessage(repo, value);
  if (action === 'commit' && args.length === 2) return commitStaged(repo, value);
  if (action === 'check' && args.length <= 2) return checkCommit(repo, value);
  if (action === 'check-github' && args.length === 3 && /^lrnolivia\/[A-Za-z0-9_.-]+$/.test(value)) {
    return assertGitHubCommit(ghRead(`repos/${value}/commits/${sha}`, repo), sha);
  }
  throw Error('Usage: project-attribution.mjs configure | commit MESSAGE_FILE | check [REVISION] | check-github OWNER/REPO SHA [--repo PATH]');
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try { const result = main(process.argv.slice(2)); if (result) console.log(JSON.stringify(result, null, 2)); }
  catch (error) { console.error(error.stderr?.toString().trim() || error.message); process.exitCode = 1; }
}
