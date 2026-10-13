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

// A deliberate recovery creates a new deployment of an already-built version.
// Accept it only with the exact durable verified rollback and provider receipt.
export function verifiedRecoveryDeployment(deployment, state, source) {
  const rollback=state?.rollback, versions=deployment?.versions;
  if(state?.scope!=='relay'||rollback?.state!=='verified'||rollback.target?.source_sha!==source||rollback.target?.worker!=='relay'||rollback.target?.compatibility_id!=='relay-autonomy-v1')return false;
  if(!Array.isArray(versions)||versions.length!==1||versions[0].percentage!==100||versions[0].version_id!==rollback.version_id||rollback.target.version_id!==rollback.version_id)return false;
  if(deployment.annotations?.['workers/message']!=='Relay bounded recovery '+rollback.operation_id)return false;
  const created=Date.parse(deployment.created_on),start=Date.parse(rollback.created_at),finish=Date.parse(rollback.completed_at);
  if(!(created>=start&&created<=finish))return false;
  try{const evidence=JSON.parse(rollback.evidence);return evidence.source_sha===source&&evidence.version_id===rollback.version_id&&evidence.deployment_id===deployment.id&&evidence.health_url==='https://relay.loew.fi/health';}catch{return false;}
}
