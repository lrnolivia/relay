---
name: relay-planning-caught-up-recovery
description: Reconcile new amendments and stalled work against a valid checkpoint without restarting paused, cancelled or externally blocked tasks.
---

# Live amendment sync and caught-up recovery

Workers keep a monotonic amendment cursor. They check only at bounded synchronization points: start/resume, before major source/commit/PR/deploy transitions, after external waits, and normal heartbeat cadence.

If nothing changed, inject nothing. Never replay the full amendment history.

New changes are classified:
- informational;
- plan-adjusting;
- scope-changing;
- blocking.

Scope-changing/blocking updates require canonical reconciliation before conflicting work continues. A cursor older than retained amendment history also forces reconciliation instead of guessed replay.

Caught-up recovery may resume from the latest valid checkpoint when Relay has evidence of a stale/frozen worker or sustained no-progress. It must not fire through real external waits, human review, authorization/tool-schema/client blockers, destructive ambiguity, or scope conflicts. Recovery attempts are bounded to prevent loops.

A successful recovery may emit a capability/tool lesson for future planning. It never emits staff productivity rankings.

## Inputs, outcome and recovery

Read the canonical assignment, owner, amendment cursor, checkpoint artifact, process/job evidence and external wait state. Consume only retained changes newer than the cursor; classify their effect before continuing. Produce a reconciled next action and updated cursor/checkpoint through the supported transaction, preserving original acceptance.

Verify that the task is eligible to resume, ownership still matches and no prior process continues to write. A missing branch or expired lease alone does not authorize takeover. If history was truncated or job/write outcome is uncertain, read canonical receipts and reconcile explicitly. Keep real wait/cancel/pause state intact; return an unavailable recovery capability as a blocker rather than inventing a resumed worker.
