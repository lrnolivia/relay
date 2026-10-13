# Field coordination cleanup audit — 2026-10-03

## Evidence

Field run37157288826 (22:06 UTC) failed job111303189909, Runner managed branch hygiene, on Field sourcef581e4f3e750afd2a959032e4e1815b554b23e4b. Workers Builds for that same source succeeded. This is not a failed application deployment.

The workflow `.github/workflows/runner-coordination.yml` runs admission on pull requests; the separate housekeeping job runs on schedule `38,8 * * * *` and manual audit/cleanup. Scheduled executions may be delayed by GitHub. The job checks out Relay main and invokes its canonical `scripts/coordinate.mjs cleanup field`. It uploads the JSON receipt even on failure and appends it to the job summary. It does not build Field.

Receipt artifact11286427867, SHA2569e6dacdac5dd99f680bf42929d64a8c9f6273f27d81f23e78281047e8485901f, reports two expired reservations, one missing merged branch, and scope drift in old mobile PR123. No branches were deleted. The Field visual assignment is held with further audit acceptance preserved; the legacy mobile assignment retains historical code and QA provenance. Neither should be silently marked completed solely to silence alerts.

## Root cause

The shared CLI assigns exit2 to both audit and cleanup whenever *any* coordination finding exists. Cleanup can therefore safely finish with nothing eligible to delete but still produce a repeated failed-run email for retained/expired records unrelated to an operational cleanup error. The receipt also lacks a distinct cleanup-completion status versus coordination-health status.

## Proposed bounded correction

Keep audit and PR/preflight gates strict. For cleanup, report `cleanup_status: completed` separately from `coordination_status: needs_reconciliation` and retain every finding. Operational errors still throw and fail the process. Do not alter authorization, ownership, merge evidence, branch protection, post-merge-commit protection, or the deletion rules. A successful housekeeping process must explicitly say it is not task-completion or admission approval.

Actual CLI fixture tests cover an expired held claim with a missing branch: cleanup performs no mutations, preserves findings, reports completed housekeeping; audit remains exit2 and preflight remains blocked. An inventory-provider failure still fails cleanup. Pure tests preserve scope-drift and post-merge-commit findings without mutation. Existing deletion safeguards remain untouched.

## Remaining work

- Review and publish the bounded reporting correction separately from the approved visual candidate.
- Reconcile original Field assignments with their legitimate owners and actual delivered scope. Preserve the outstanding Figma audit and old mobile evidence; do not rewrite owner identity or waive missing verification.
- Inspect the remaining workflow consumers and prove scheduled/manual reporting after publication. A local fixture is not proof of a live scheduled cleanup result.
- Add further race/deletion regression coverage before claiming the whole process audit complete. No new credentials or permission changes are included.
