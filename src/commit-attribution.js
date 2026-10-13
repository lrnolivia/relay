// Identity observed through Lauren's existing authenticated GitHub connection.
// No guessed noreply address, new credential, or caller-supplied author identity.
export const PROJECT_AUTHOR = Object.freeze({
  name: 'Lauren Olivia', email: 'lrnoliv@gmail.com', login: 'lrnolivia', id: 311277794,
  witness_repo: 'lrnolivia/gwfamily', witness_sha: '368f109a63505b9bea976f42217522899fa5d39f'
});

const AI_EMAILS = new Set([
  'noreply@anthropic.com', 'codex@openai.com',
  '335984207+relay-by-loew-fi[bot]@users.noreply.github.com'
]);

function messageText(message) {
  if (typeof message !== 'string' || !message.trim() || message.includes('\0')) throw Error('A nonempty commit message is required');
  return message;
}

// Match exact tool email identities, never all bots/domains or a human's name.
// Quoted examples and other trailers (including human coauthors) are preserved.
export function stripToolCoauthors(message) {
  return messageText(message).split(/\r?\n/).filter(line => {
    const trailer = line.match(/^Co-authored-by\s*:\s*[^<>\r\n]+<([^<>\s]+)>\s*$/i);
    return !trailer || !AI_EMAILS.has(trailer[1].toLowerCase());
  }).join('\n').replace(/\n+$/, '') + '\n';
}

export function assertNoToolCoauthors(message) {
  const original = messageText(message).replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n';
  if (stripToolCoauthors(message) !== original) throw Error('Commit contains an unwanted AI/tool coauthor');
}

export function assertAuthor(identity, label = 'author') {
  if (identity?.name !== PROJECT_AUTHOR.name || identity?.email !== PROJECT_AUTHOR.email) {
    throw Error(`Unexpected ${label}; expected ${PROJECT_AUTHOR.name} <${PROJECT_AUTHOR.email}>`);
  }
}

// For future integration into admitted Git Database/Contents API writers.
// GitHub App audit/PR actor remains the authenticated App even with this payload.
export function attributedCommitBody(body) {
  return {...body, message: stripToolCoauthors(body?.message),
    author: {name: PROJECT_AUTHOR.name, email: PROJECT_AUTHOR.email},
    committer: {name: PROJECT_AUTHOR.name, email: PROJECT_AUTHOR.email}};
}

export function assertExistingGitHubIdentity(profile, witness) {
  if (profile?.login !== PROJECT_AUTHOR.login || Number(profile?.id) !== PROJECT_AUTHOR.id) throw Error('Existing GitHub account is not Lauren; no identity switch is allowed');
  if (witness?.sha !== PROJECT_AUTHOR.witness_sha || witness?.author?.login !== PROJECT_AUTHOR.login || Number(witness?.author?.id) !== PROJECT_AUTHOR.id || witness?.committer?.login !== PROJECT_AUTHOR.login || Number(witness?.committer?.id) !== PROJECT_AUTHOR.id) throw Error('GitHub author identity witness does not match Lauren');
  assertAuthor(witness?.commit?.author);
  assertAuthor(witness?.commit?.committer, 'committer');
}

export function parseGitCommit(raw) {
  const boundary = raw.indexOf('\n\n');
  if (boundary < 0) throw Error('Invalid raw Git commit');
  const header = raw.slice(0, boundary);
  const identity = kind => {
    const match = header.match(new RegExp(`^${kind} (.+) <([^<>]+)> [0-9]+ [+-][0-9]{4}$`, 'm'));
    if (!match) throw Error(`Invalid Git ${kind}`);
    return {name: match[1], email: match[2]};
  };
  return {author: identity('author'), committer: identity('committer'), message: raw.slice(boundary + 2)};
}

export function assertGitCommit(raw) {
  const result = parseGitCommit(raw);
  assertAuthor(result.author);
  assertAuthor(result.committer, 'committer');
  assertNoToolCoauthors(result.message);
  return result;
}

// Use exact provider readback after a future authorized GitHub merge. A clean
// source commit or a successful merge response cannot establish final metadata.
export function assertGitHubCommit(commit, expectedSha) {
  if (!/^[a-f0-9]{40}$/i.test(expectedSha) || commit?.sha !== expectedSha) throw Error('Final GitHub commit SHA differs from the expected artifact');
  assertAuthor(commit?.commit?.author);
  if (commit?.author?.login !== PROJECT_AUTHOR.login || Number(commit?.author?.id) !== PROJECT_AUTHOR.id) throw Error('Final GitHub author is not linked to Lauren');
  if (commit?.committer?.login === 'web-flow' && commit?.commit?.committer?.name === 'GitHub' && commit?.commit?.committer?.email === 'noreply@github.com') {
    // GitHub's server committer is distinct from commit author and merge actor.
  } else {
    assertAuthor(commit?.commit?.committer, 'committer');
    if (commit?.committer?.login !== PROJECT_AUTHOR.login || Number(commit?.committer?.id) !== PROJECT_AUTHOR.id) throw Error('Unexpected GitHub committer account');
  }
  assertNoToolCoauthors(commit?.commit?.message);
  return {sha: expectedSha, author: commit.commit.author, committer: commit.commit.committer};
}

// Inspect the exact created object before Git Database writers advance a ref.
// Contents writes are atomic; never report their success without this readback.
export function assertProjectRepository(base) {
  if (!/^\/repos\/lrnolivia\/[A-Za-z0-9_.-]+$/.test(base)) throw Error('Attribution is authorized only for Lauren project repositories');
}

export async function verifyAttributedCommit(api, base, sha, expected = {}) {
  assertProjectRepository(base);
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw Error('Exact created commit SHA unavailable; reconcile before retrying');
  const commit = await api(`${base}/commits/${sha}`, {requireAuthenticated: true});
  const proof = assertGitHubCommit(commit, sha);
  const normalized = value => messageText(value).replace(/\r\n/g, '\n').replace(/\n+$/, '');
  if (expected.message !== undefined && normalized(commit.commit.message) !== normalized(expected.message)) throw Error('Created commit message differs from the requested artifact');
  if (expected.tree !== undefined && commit.commit.tree?.sha !== expected.tree) throw Error('Created commit tree differs from the requested artifact');
  if (expected.parents !== undefined && JSON.stringify(commit.parents?.map(p => p.sha)) !== JSON.stringify(expected.parents)) throw Error('Created commit parents differ from the requested artifact');
  return proof;
}

// A lost Contents response is reconciled by the exact before/after blobs and
// parent, not by assuming the latest branch commit belongs to this operation.
export async function reconcileAttributedContentsCommit(api, base, path, expected, afterBlob) {
  assertProjectRepository(base);
  const candidates = await api(`${base}/commits?sha=${encodeURIComponent(expected.branch)}&path=${encodeURIComponent(path)}&per_page=10`, {requireAuthenticated: true});
  if (!Array.isArray(candidates) || candidates.length > 10) throw Error('Incomplete commit reconciliation inventory');
  for (const candidate of candidates) {
    if (!/^[a-f0-9]{40}$/.test(candidate?.sha || '')) throw Error('Invalid reconciliation commit identity');
    const object = await api(`${base}/commits/${candidate.sha}`, {requireAuthenticated: true});
    if (object?.parents?.length !== 1) continue;
    const file = ref => api(`${base}/contents/${path}?ref=${ref}`, {requireAuthenticated: true});
    const before = await file(object.parents[0].sha), after = await file(candidate.sha);
    if (before?.sha !== expected.sha || after?.sha !== afterBlob) continue;
    return verifyAttributedCommit(api, base, candidate.sha, expected);
  }
  throw Error('Exact created commit metadata unavailable; reconcile before retrying');
}
