# Relay 1.9.6

Relay 1.9.6 is the planning and coordination intelligence release.

## What ships

- canonical assignment taxonomy persisted through queue, claim and amend: category, bounded labels/tags, one primary role and optional supporting roles;
- taxonomy projected into resume checkpoints and routing/skill context without changing Runner authorization;
- staff-aware worker communication with stable Relay staff names while exact machine assignment/branch/PR/evidence identity remains underneath;
- organization-first executive status narration with technical internals hidden by default;
- a first-class executive communication MCP skill plus a two-layer human/technical result contract, presentation helper and eval fixtures;
- monotonic live-amendment cursor through `relay_runner_updates`, including no-change suppression, retained-history gap detection and scope/blocking reconciliation;
- bounded caught-up recovery from the latest canonical checkpoint, with explicit exclusions for genuine external waits, human review, authorization/client/schema failures, destructive ambiguity and scope conflicts;
- recovery learning that emits capability/tool lessons, never staff productivity scores;
- workflow-time telemetry derived from canonical events with active execution, external wait, recoverable stall, blocked, human intervention and verification/deploy phases;
- telemetry aggregation by task class, capability/skill, tool family, reason and workflow phase; staff identity may filter a workflow but never becomes a productivity ranking;
- Julian-managed relationship-context primitives based only on explicit feedback or repeated collaboration evidence, with no hidden affinity score, sensitive-trait inference, canned jokes or autonomous relationship engine;
- planning guidance that consults checkpoint + new amendments + findings before routing work.

## Authority

Staff names, roles, taxonomy and relationship context are routing/presentation metadata. They never grant authority. Runner owner ids, admitted paths/resources, leases, exact-head policy and canonical transactions remain authoritative.

## Validation

Tests cover taxonomy validation and persistence, resume projection, role-driven skill context, staff-aware message reconciliation, duplicate suppression, executive narration, amendment cursors and history gaps, caught-up recovery limits/blockers, workflow timing/bottleneck aggregation, relationship-context curation controls, and Runner tool schema exposure.

## Client boundary

1.9.6 adds `relay_runner_updates` and new Runner assignment metadata fields, so after exact-source deployment ChatGPT must refresh the Relay app tools before consumer-side verification.
