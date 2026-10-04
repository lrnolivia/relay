/** Cleanup completion and coordination health are separate facts.
 * Admission/audit gates remain strict; failed cleanup operations still throw.
 */
export function coordinationOutcome(action, report) {
  if (!['audit', 'cleanup'].includes(action)) throw new Error('Unsupported report action');
  if (!Array.isArray(report.findings)) throw new Error('Coordination findings are required');
  const attention = report.findings.length > 0;
  return {
    report: {...report, coordination_status: attention ? 'needs_reconciliation' : 'clear',
      ...(action === 'cleanup' ? {cleanup_status:'completed', note: attention
        ? 'Cleanup finished safely. Coordination findings remain open; this is not admission or task-completion approval.'
        : 'Cleanup finished with no coordination findings.'} : {})},
    exitCode: action === 'audit' && attention ? 2 : 0,
  };
}
