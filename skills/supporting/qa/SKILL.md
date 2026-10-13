---
name: relay-qa
description: Verify exact-artifact behavior and regression boundaries, classifying product, harness and environment failures with bounded recovery.
---

# Testing and QA

Use for test planning, regression verification or acceptance evidence. Visual assertions also need visual QA; platform-specific interactions need the matching platform pack.

## Inputs and test unit

Identify exact artifact/commit, acceptance criterion, expected behavior, relevant fixtures/state, harness capabilities and environment. Read required repository commands and the canonical QA policy. Select a harness that can actually exercise the criterion: HTTP for protocol facts, deterministic browser recipes for repeatable web interactions, native/authenticated harnesses for platform or saved-state behavior.

## Supported actions

Test the observable outcome using realistic populated data. Choose boundaries from the changed behavior: empty/error/stale states, concurrent updates, cancellation, restart/persistence, capability denial or keyboard operation as relevant. Use isolated fixtures for writes. Production evidence cannot prove an unmerged branch.

Run required install/test/build checks and record exit status. For browser work inspect actual interactions and resulting state; a screenshot alone does not prove an action succeeded. For visual comparison record viewport, appearance, device settings and exact source/deployment identity. Keep failure evidence even after a fix.

## Output and verification

Report artifact + criterion + harness + evidence + classification: PASS, FAIL—PRODUCT, BLOCKED/UNVERIFIED—HARNESS, BLOCKED—ENVIRONMENT or NOT RUN. State what was exercised and what remains unknown. Re-test the same acceptance against the new exact artifact after a correction; earlier evidence becomes stale when affected source changes.

## Recovery

After two identical failures without new evidence, stop equivalent retries. Isolate harness defects from product failures; use one evidenced bounded harness repair or an independent harness that tests the same criterion. Never weaken assertions or move baselines to manufacture green. If judgment or unavailable capability remains, prepare the policy-required exact-artifact review packet; an unverified criterion stays open.
