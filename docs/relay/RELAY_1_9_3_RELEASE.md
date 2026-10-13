# Relay 1.9.3

Relay 1.9.3 is the passive resume/checkpoint release.

## Goal

A Codex, Claude, or ChatGPT worker should be able to disappear mid-task without forcing the next worker to reconstruct the project from chat history or requiring the active worker to spend context writing frequent handoffs.

## What ships

- `relay_runner_resume` returns compact deterministic checkpoints derived from canonical Runner, GitHub and configured Cloud evidence.
- Checkpoints include assignment identity, task class/ledger refs, branch/base/head/PR/deploy identities, changed paths, recent commits, current stage/state, worker and external-system activity, latest meaningful/successful action, blocker/wait recovery, next action and QA context.
- Same evidence produces the same `checkpoint_id`, even when read later. No duplicate snapshot is created merely because the clock advanced.
- Source/PR/check/deployment changes produce a new checkpoint identity.
- Active consumer refresh target is 5 minutes; external waits use 10 minutes; human waits use 30 minutes.
- External-system activity remains separate from worker heartbeat so long CI/install steps do not look like a frozen worker.
- Completed work has no periodic refresh target.
- Resume instructions come from canonical Runner state rather than recreated chat prose.
- No second state store is introduced. Durability comes from the underlying Runner/GitHub/Cloud evidence, and checkpoints are materialized on read.

## Why this stays lightweight

Workers do not author recurring status documents. Relay derives the checkpoint itself. A watching UI/agent may refresh at the bounded cadence, while an interrupted session can simply call `relay_runner_resume` when it returns.

## Contract

The durable human-readable contract is `contracts/resume/checkpoint-v1.md`.

## Tests

Tests cover deterministic dedupe, changed source identity, external waits, human QA context, successful-event selection, completed work cadence and exact resume identities.

## Refresh boundary

After merge and exact-source deployment, verify runtime 1.9.3, refresh Relay tools, reopen/refresh ChatGPT if needed, and prove `relay_runner_resume` from a fresh consumer before completing the assignment and beginning 1.9.4.
