export function progressReceipt({ project, assignment, stage, state, last_meaningful_progress_at, identities, latest_event }) {
  return {
    contract_version: "1.7.5",
    project,
    assignment,
    stage,
    state,
    last_meaningful_progress_at: last_meaningful_progress_at || null,
    identities: identities || {},
    latest_event: latest_event || null
  };
}
