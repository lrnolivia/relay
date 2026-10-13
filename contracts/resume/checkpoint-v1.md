# Relay resume checkpoint contract v1

A checkpoint is a compact durable snapshot derived from canonical Relay evidence, not a model-authored handoff.

Status: ACTIVE_CONTRACT

Required identity:
- project
- assignment
- branch
- base SHA
- current head SHA

The canonical checkpoint model will be appended below.

## Canonical checkpoint fields

- exact assignment identity and task class/role metadata
- branch, base SHA, head SHA, PR/check/deployment identities
- current stage and latest concrete successful event
- worker activity separate from external-system activity
- blocker or wait state with recovery action
- next action, QA/review context and ledger references
- created_at, freshness and superseded/deduped state

Resume consumers should prefer the latest valid checkpoint over reconstructing intent from chat history.

## Passive snapshot policy

- active work target: refresh from canonical evidence every 5 minutes when a consumer is watching;
- external-system wait target: 10 minutes, while external activity remains visible separately from worker activity;
- waiting-for-human target: 30 minutes;
- unchanged canonical evidence reuses the same deterministic `checkpoint_id` rather than creating noisy duplicate snapshots;
- checkpoints are derived on read from durable Runner/GitHub/Cloud evidence, so workers do not spend model context authoring repetitive handoffs;
- `relay_runner_resume` is the canonical resume/read contract for a fresh chat or worker.
