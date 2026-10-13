---
name: relay-engineering
description: Implement or debug scoped source changes using existing architecture, exact artifacts, and meaningful build and behavior checks.
---

# Engineering implementation

Use for feature implementation, build failures, frontend correctness or bounded refactoring. For source publication add GitHub; for test strategy add QA. A design request also needs the appropriate creative/platform pack.

## Establish inputs

Read the task's acceptance, current owner/path scope, repository registration, exact branch/head, package scripts, entrypoints and relevant callers/tests. Inspect the dirty diff before writing; preserve unrelated user changes. Identify persisted formats, public contracts and installed dependency versions that constrain the patch.

## Execute

Trace a failing request or state transition from input through storage/network to the observable result. Record expected and observed behavior before deciding where to patch. Extend the existing architecture and make one coherent reversible change. When asynchronous work is involved, account for cancellation, stale responses, duplicate requests and persisted state after restart. Keep secrets and ownership checks at their existing boundaries.

Use repository scripts and its lockfile for installation/build/type checks. Add a dependency only when the task requires a capability the existing stack cannot reasonably provide, and obtain any required scope approval. Add a behavioral regression check when a real defect or boundary warrants it; do not write assertions that merely mirror the implementation.

## Deliver and verify

Return changed paths, the resulting behavior, exact source identity, relevant command results and remaining runtime uncertainty. Exercise the acceptance with realistic populated inputs and the affected error/recovery path. A successful build proves compilation, not the user's runtime outcome.

## Recovery

Classify failure as source defect, dependency/toolchain mismatch, environment failure or stale evidence. Compare installed versions and fresh source before retrying. Preserve logs and the dirty diff; never reset another checkout to make a test pass. Two identical failures without new evidence require a changed hypothesis or a precise blocker. Keep unrelated passing work usable while the blocked criterion is parked.
