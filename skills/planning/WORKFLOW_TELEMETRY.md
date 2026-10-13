---
name: relay-planning-workflow-telemetry
description: Explain workflow timing and bottlenecks from attributed events/checkpoints with explicit gaps and no productivity rankings.
---

# Workflow-time telemetry

Relay derives workflow timing from canonical events/checkpoints rather than worker-authored timesheets.

Classify time into active execution, external wait, recoverable stall/retry, blocked authority/client/scope wait, human intervention, and verification/deploy. Aggregate by task class, capability/skill, tool family, failure/recovery reason and workflow phase.

Staff identity may be used as a filter when debugging one workflow, but Relay never emits staff productivity scores or rankings.

Recurring bottlenecks become planning finding candidates only after evidence repeats. External wait findings should target caching/concurrency/provider behavior; recoverable stalls should feed validated recovery lessons; blocked time should surface explicit authority/client/scope repair.

## Analysis workflow

Inputs are canonical event/receipt IDs, timestamps, phase transitions and the question being answered. Build intervals from actual start/end evidence, mark missing endpoints and separate overlaps from sequential work. Use recorded external-wait and blocker reasons; do not infer active coding from a connected transport or a quiet chat.

Deliver a phase/timing view with source range, aggregation method, uncertainty and repeated bottleneck evidence. Verify sampled intervals against raw events and avoid double counting concurrent activity. If evidence is partial, show unknown intervals and limit the conclusion. A recurring issue may become a planning finding with provenance; telemetry alone does not assign blame, create staffing authority or prove hours worked.
