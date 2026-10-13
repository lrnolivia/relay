export function releaseIdentityRows(value = {}) {
  const ids = value.identities || value.receipt?.identities || {};
  const rows = [
    ["branch", ids.branch],
    ["base", ids.base_sha],
    ["head", ids.head_sha || ids.pr_head_sha],
    ["pr", ids.pr ? "#" + ids.pr : null],
    ["merge", ids.merge_commit_sha],
    ["worker", ids.cloud_worker],
    ["version", ids.cloud_version_id || value.version_id],
    ["deployment", ids.cloud_deployment_id || value.deployment?.id]
  ];
  return rows.filter(([, item]) => item !== null && item !== undefined && item !== "");
}
