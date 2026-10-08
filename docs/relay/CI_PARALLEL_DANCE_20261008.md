# Relay CI: build once, verify in isolated parallel groups

## Admitted scope and ownership

This is the CI-only hotfix `relay-ci-parallelism-20261008`, branch `relay/ci-parallelism-20261008`, owned by internal task `root.hotfix_relay_ci_parallelism`. Its base is `994a4e59d20c475897592efb766ae71aa5e50792`.

The broader `relay-mcp-rebuild-continuation-20261003` remains held. Its draft PR204 at `a50ac24d014c92fd13f2c9c11806dab3d21eb338` contains separate macOS source-checkpoint work and is untouched. Parent CAS rescope at `994a4e59d20c475897592efb766ae71aa5e50792` removed only CI reservations for this hotfix; the new claim was independently admitted. The held assignment's next action and context message `ctx_cf628b27e2b3d51d45526b6c617e9397e6b2e3ad4562d0e3009e059686a851ec` require incorporating this hotfix before later CI edits. Never replace these files with older copies from the held branch. No unrelated runtime publication or broad resume is part of this change.

## The new dance for Relay-managed projects

1. Check exact source identity and the pinned toolchain, run cheap shared contracts, install locked dependencies and build once.
2. Seal the build using exact source/tree, lock, configuration and generated-byte hashes. Verify the same receipt in every consumer before and after its tests. Do not rebuild independently in each group.
3. Use a few measured, balanced groups. Keep ordered or state-sharing suites together; parallelize only independent groups with private checkouts, copied dependency bytes, private temporary/cache/evidence directories and dynamically allocated ports. Do not use shared writable fixtures or production data.
4. Collect all independent failures in one run. A failed group does not cancel siblings. Keep original process exits, timeout/cancellation accounting, required coverage and critical authentication, permissions, data-integrity and recovery tests.
5. Close one exact-head aggregate only when every required suite and artifact check passed. Missing, duplicate, cancelled, stale or changed evidence fails closed. Keep all required release, runtime, preview and safety gates.
6. Measure preparation, execution and total time. Compare end-to-end latency and runner minutes, not merely apparent concurrency. Rebalance from evidence rather than increasing fan-out indefinitely.
7. Use standard GitHub-hosted runners; this pattern does not authorize paid larger runners, new services, credentials or access.

This is the default design pattern, not a claim that every managed project's workflow has already been changed. Long-running projects may benefit from separate jobs consuming the same immutable artifact. Small suites should avoid paying repeated runner/container/startup/install costs when isolated groups on one standard runner are faster. Apply changes to other repositories only under their own admitted work.

## Relay implementation and timing basis

Last healthy canonical run [37758371704](https://github.com/lrnolivia/relay/actions/runs/37758371704), source `681f99d014e3c776266fe7b7e7cc5493f3f9ee31`, measured approximately:

- inspector: 22.34 seconds
- runner: 1.95 seconds
- layout: 0.23 seconds
- contracts: 6.73 seconds
- web: 19.24 seconds
- overall serial suite step: 51.8 seconds
- initial runner/container/checkout/Node setup: about 33 seconds

The fixed groups are `control` (inspector, runner, layout, approximately 24.5 seconds before parallel contention) and `interface` (contracts, web, approximately 26 seconds). A single ordinary `ubuntu-latest` runner keeps the existing pinned Playwright container, single install/build/browser setup and existing `quality` check. `scripts/ci-parallel-suites.mjs` makes detached exact-head snapshots outside the canonical checkout, independently copies installed dependencies and the three generated outputs, and verifies the unchanged build receipt. It invokes the existing bounded suite runner with the original commands. Root `npm test` remains the serial full-suite fallback.

Preparation overhead and CPU contention can reduce or erase the theoretical 25-second saving. The gate records measured `prepare_ms`, `parallel_and_evidence_ms` and `total_ms`; validate improvement using actual final-head hosted runs. This document makes no unmeasured speedup claim.

## Evidence and safeguards

- Canonical five-suite order and accounting remain in `qa-evidence/test-workflow/result.json` for the existing stage finalizer.
- Per-group reports and independently retained captures are uploaded with the required-suite artifact. Historical screenshot paths are populated only after preserving group evidence; differing files cannot silently overwrite one another.
- Tests prove actual concurrent execution, separate fixture/temp files and live dynamically allocated ports, independent sibling completion, timeout/cancellation failure, source/build invalidation, immutable dependency copies, complete coverage and rejected evidence collisions.
- Existing process-group termination is reused. A child that deliberately escapes its process group has the same explicit limitation as before; bounded pipe settlement is not a security sandbox.
- The orchestrator does not add job-wide `NODE_OPTIONS`. Any future import guard must be scoped to application test steps after checkout, never checkout/setup/upload actions.
- Rollback is a normal revert of this isolated hotfix. The serial orchestrator is preserved and no test is removed or made optional.

## Deferred reliability requirement

Keep stale blockers timestamped with evidence, owner, affected target and next step. Before carrying one forward, perform a safe, bounded, same-context read recheck when allowed and escalate only the still-current blocker. Preserve permission denials; do not switch identities or expand access. This requirement is retained in the held rebuild backlog. No broader blocker subsystem is implemented by this hotfix.
