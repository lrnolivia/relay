import { createHash } from 'node:crypto';

// The first source-checkpoint slice is intentionally small. Never truncate a
// capture to fit: a partial manifest cannot stand in for the selected scope.
export const SOURCE_BUNDLE_LIMITS = Object.freeze({ serialized_bytes: 192 * 1024, decoded_bytes: 128 * 1024, entries: 64 });
const fail = message => { throw Error('Source checkpoint: ' + message); };
const sha256 = value => createHash('sha256').update(value).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys, name) => {
  if (!plain(value) || Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) fail(name + ' has unsupported or missing fields');
};
const stable = value => Array.isArray(value) ? value.map(stable) : plain(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const serializeSourceBundle = bundle => JSON.stringify(stable(bundle));
export const sourceBundleDigest = bundle => sha256(serializeSourceBundle(bundle));

// Block executable control/configuration stores and recognisable secret files.
// These checks complement the executor's no-symlink traversal and ignored-file
// checks; neither a filename filter nor a content scan proves arbitrary data is
// secret-free. A blocked selected file fails the entire capture.
export function validateSourcePath(value, { prefix = false } = {}) {
  if (typeof value !== 'string' || !value || value.length > 500 || value !== value.normalize('NFC') || /[\x00-\x1f\x7f\\:*?"<>|]/.test(value)) fail('path is not a canonical relative path');
  const path = prefix && value.endsWith('/') ? value.slice(0, -1) : value;
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /^\s|[.\s]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) fail('path is not a canonical relative path');
  if (parts.some(part => /^(?:\.git|\.hg|\.svn|\.ssh|\.aws|\.gnupg|\.codex|\.agents|\.relay|\.relay-executor)$/i.test(part) || /^\.env(?:\.|$)/i.test(part) || /^(?:credentials|secrets)(?:\.|$)/i.test(part) || /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\.|$)/i.test(part) || /^(?:\.npmrc|\.pypirc|\.netrc|AGENTS\.md)$/i.test(part) || /\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(part))) fail('control or secret path is excluded');
  return value;
}
function canonicalScope(scope, sorted) {
  if (!Array.isArray(scope) || !scope.length || scope.length > SOURCE_BUNDLE_LIMITS.entries) fail('scope must be a bounded explicit path list');
  scope.forEach(path => validateSourcePath(path, { prefix: true }));
  const canonical = [...scope].sort();
  if (new Set(canonical.map(path => path.toLowerCase())).size !== canonical.length) fail('scope contains duplicate or case-colliding paths');
  if (sorted && JSON.stringify(scope) !== JSON.stringify(canonical)) fail('scope must be sorted');
  return canonical;
}
const inside = (file, scope) => scope.some(path => file === path || (path.endsWith('/') && file.startsWith(path)));
function checkSecrets(bytes) {
  const text = bytes.toString('utf8');
  if (/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bxox[baprs]-[A-Za-z0-9-]{20,}\b|\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}\b/.test(text)) fail('recognisable credential content is excluded');
}
export function validateSourceBundle(bundle, identity = {}) {
  exact(bundle, ['schema', 'repository', 'branch', 'head_sha', 'scope', 'files'], 'bundle');
  if (bundle.schema !== 1) fail('unsupported bundle schema');
  if (typeof bundle.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(bundle.repository) || bundle.repository.length > 200) fail('repository identity is invalid');
  if (typeof bundle.branch !== 'string' || !bundle.branch || bundle.branch.length > 240 || /[\x00-\x20\x7f]/.test(bundle.branch)) fail('branch identity is invalid');
  if (typeof bundle.head_sha !== 'string' || !/^[a-f0-9]{40}$/.test(bundle.head_sha)) fail('head identity is invalid');
  for (const name of ['repository', 'branch', 'head_sha']) if (bundle[name] !== identity[name]) fail(name + ' does not match the admitted source identity');
  const scope = canonicalScope(bundle.scope, true);
  if (JSON.stringify(scope) !== JSON.stringify(canonicalScope(identity.scope, false))) fail('scope does not match the admitted objective');
  if (!Array.isArray(bundle.files) || bundle.files.length > SOURCE_BUNDLE_LIMITS.entries) fail('entry limit exceeded');
  const serialized_bytes = Buffer.byteLength(serializeSourceBundle(bundle));
  if (serialized_bytes > SOURCE_BUNDLE_LIMITS.serialized_bytes) fail('serialized byte limit exceeded');
  let total_bytes = 0, file_count = 0, deleted_count = 0, previous = null;
  const casePaths = new Set(), paths = new Set();
  for (const file of bundle.files) {
    if (!plain(file)) fail('entry must be an object');
    exact(file, file.kind === 'deleted' ? ['path', 'kind'] : ['path', 'kind', 'mode', 'size', 'sha256', 'data'], 'entry');
    validateSourcePath(file.path);
    if (previous !== null && file.path <= previous) fail('entries must have sorted unique paths');
    previous = file.path;
    if (casePaths.has(file.path.toLowerCase())) fail('entries contain case-colliding paths');
    casePaths.add(file.path.toLowerCase()); paths.add(file.path);
    if (!inside(file.path, scope)) fail('entry is outside the admitted scope');
    if (file.kind === 'deleted') { deleted_count++; continue; }
    if (file.kind !== 'file' || ![420, 493].includes(file.mode)) fail('only regular non-special files and deletions are supported');
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > SOURCE_BUNDLE_LIMITS.decoded_bytes || typeof file.sha256 !== 'string' || !hashPattern.test(file.sha256) || typeof file.data !== 'string') fail('file metadata is invalid');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) fail('file data is not canonical base64');
    const bytes = Buffer.from(file.data, 'base64');
    if (bytes.toString('base64') !== file.data || bytes.length !== file.size || sha256(bytes) !== file.sha256) fail('file size or digest does not match its bytes');
    total_bytes += bytes.length; file_count++;
    if (total_bytes > SOURCE_BUNDLE_LIMITS.decoded_bytes) fail('decoded byte limit exceeded');
    checkSecrets(bytes);
  }
  // An exact-file scope always has a file or an explicit deletion. Prefix scope
  // completeness is an authenticated executor capture claim, not host inspection.
  if (scope.some(path => !path.endsWith('/') && !paths.has(path))) fail('exact selected path is missing from the complete manifest');
  for (const path of paths) {
    const segments = path.split('/');
    for (let count = 1; count < segments.length; count++) if (paths.has(segments.slice(0, count).join('/'))) fail('file entries have conflicting parent paths');
  }
  return { schema: 1, digest: sourceBundleDigest(bundle), repository: bundle.repository, branch: bundle.branch, head_sha: bundle.head_sha, scope, file_count, deleted_count, entry_count: bundle.files.length, total_bytes, serialized_bytes };
}
