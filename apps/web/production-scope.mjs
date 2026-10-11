// Mirrors the canonical Workers Builds exclusions. Non-deploying metadata
// commits must never manufacture a new expected runtime source identity.
export function needsProductionVerification(paths) {
  if (!Array.isArray(paths) || paths.some(path => typeof path !== 'string')) throw Error('Expected changed repository paths');
  return paths.some(path => !/^(?:coordination|assignments|docs|\.github)\//.test(path) && !/^[^/]+\.md$/.test(path));
}

// Only the production branch is deployed by the canonical provider trigger.
export function manualProductionVerification(event, ref) {
  if (event !== 'workflow_dispatch') return false;
  if (typeof ref !== 'string' || !ref.startsWith('refs/')) throw Error('Missing exact workflow ref');
  return ref === 'refs/heads/main';
}
