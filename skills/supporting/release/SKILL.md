---
name: relay-release
description: Prepare and verify authorized Git-native publication with exact-head gates, deployment readback and a concrete rollback record.
---

# Release engineering

Use when preparing, publishing or verifying a release. GitHub covers source/PR operations; Cloudflare covers provider diagnostics. An instruction to prepare a release does not itself authorize merge or production promotion.

## Inputs and readiness

Read project registration, live owner/scope, current branch/head, acceptance, required checks and promotion policy. Gather the current production source/build/version/traffic identity as the rollback baseline. Identify persistence or contract compatibility risks and the exact runtime behavior affected by the change.

## Supported actions

Prepare a release packet with exact candidate artifact, passed/failed/unavailable checks, remaining host/device proof and rollback route. Publish only through the registered Git-native path with the required exact-head gate and current authorization. Recheck the head and ownership immediately before mutation; changed source invalidates affected evidence. Do not use a manual upload to bypass policy.

After merge, read the actual merge identity. Track provider build, deployed version and traffic separately, then exercise the changed behavior at the published artifact. Preserve compatible historical records and receipts so rollback does not erase forward-recovery evidence. A release note or queued build is not runtime delivery.

## Output and verification

Report candidate/head, PR/merge, source/build/version/deployment identities, targeted runtime evidence, rollback baseline and unresolved criteria. State implementation, publication, host installation and runtime verification separately. Confirm any rollback target is real and allowed by the current project route; do not claim rollback was exercised when only planned.

## Recovery

If a write outcome is uncertain, read back exact intent before retrying. If a build/runtime check fails, separate provider/harness failure from product failure and preserve logs. Use the policy's bounded correction or approved rollback; do not stack speculative deployments. Missing authorization, incompatible state or unavailable required checks blocks promotion while independent preparation can continue.
