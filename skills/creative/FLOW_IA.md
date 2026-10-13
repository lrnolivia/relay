---
name: relay-creative-flow-ia
description: Map user decisions, information hierarchy and state-preserving navigation for a multi-state product journey.
---

# Flow and information architecture

Design around the user's next decision, not the data model.

## Sequence

For each surface, define:
1. what the user needs to know on arrival;
2. the primary action or decision;
3. supporting context needed before that action;
4. what becomes available only after intent is clear;
5. the return path and preserved context.

Use progressive disclosure to keep technical evidence, history, and secondary controls available without competing with the human-facing task.

## State inventory

Before implementation, cover meaningful states: loading, empty, active, waiting, blocked, failed, stale, reconnecting, ready for review, delivered/completed, and permission/capability unavailable when relevant.

Do not design only the happy path.

## Navigation

Keep identity stable across overview -> detail -> deeper product transitions. Preserve project/work/selection context and a clear way back. A richer destination should reveal more, not reset the user's mental model.

## Content hierarchy

Lead with plain language: what is happening, why it matters, and what happens next. Subordinate hashes, branch names, transport details, raw logs, and machine IDs unless they explain a blocker or support a concrete review decision.

## Density

Prefer useful information at a glance over decorative whitespace. On narrow layouts, stack rather than hide or require horizontal scrolling unless the interaction itself is inherently horizontal.

## Workflow inputs and output

Gather the user's goal, entry points, current routes, real data/state owners and acceptance. Trace one representative journey through decision, action, result and return. Identify what must remain selected or saved across each transition. Produce a route/state map with the primary decision, supporting information, action availability and error/back behavior at each step.

Verify using realistic tasks and content, including interrupted work and an unavailable action. Check that narrow layouts retain the same decisions and context. If navigation resets selection or an action appears before prerequisites are clear, correct the state ownership/disclosure order before polishing components. Label unsupported persistence or destination behavior as an implementation gap; do not fabricate a working route.
