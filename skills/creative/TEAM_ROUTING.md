---
name: relay-creative-team-routing
description: Compose only the creative, platform and performance guidance needed for a task using real assignment and capability context.
---

# Creative skill routing

Relay resolves creative expertise through the canonical organization layer:

assignment -> primary/supporting team -> role -> named staff -> skill pack.

Teams are routing and presentation context, never authorization. Runner ownership, declared paths/resources, source policy, and capability gates remain authoritative.

## Default posture

- `inspector` owns art direction, product/interaction design, motion, visual-reference analysis, and visual QA.
- `runner` owns implementation/system execution. It consumes platform and performance guidance by default and pulls creative guidance when a design requirement exists.
- `night-shift` owns planning, continuity, recovery, and sequencing. It may use flow/IA and performance-risk guidance without silently taking visual ownership from Inspector.
- `source`, `cloud`, `release`, and `skills` keep their specialist responsibilities and join as supporting teams when the assignment needs them.

## Inspector staff affinities

Within Inspector, preserve sticky staff identity and role affinity:
- Valentina: art direction, aesthetic coherence, anti-slop judgment.
- Vivienne: product flow, information architecture, interaction structure.
- Margot: design editing, hierarchy, visual-system coherence.
- Sabine: motion, microinteraction, temporal hierarchy.
- Roman: visual QA, verification, evidence discipline.

Named staff refine which creative files are loaded; they do not change authorization.

## Composition

For a substantial UI/design assignment:
1. load art direction first;
2. add flow/IA when the experience has multiple states or navigation;
3. add motion when state change, liveness, focus, or feedback needs temporal behavior;
4. add the matching platform pack;
5. add performance guidance when the visual direction is ambitious, animated, media-heavy, or data-rich;
6. finish with visual QA.

Do not load every pack by default. Prefer the smallest combination that can make a high-quality decision.

## Capability-aware dependencies

Figma guidance is loaded only when the real Figma capability is available or the task explicitly needs a Figma handoff. When unavailable, preserve the design intent in implementation-neutral structure rather than pretending Figma work occurred.

## Resolution workflow

Start with task intent tags, platform, available capabilities and a context ceiling. Use relay_skills resolve, inspect selected/rejected reasons, then read only the selected IDs with the same capability/context limits. Exact tag matching is intentional: include the task's relevant domains rather than expecting natural-language inference. Read/audit verifies pinned bytes; neither operation claims source ownership.

Return the selected expertise and the decision each pack supports. Verify the combination covers the actual acceptance without loading unrelated domains. If a needed pack is rejected for capability or budget, preserve the rejection, narrow optional guidance or use a supported neutral handoff. Do not add an unavailable capability to the request just to force selection, and do not treat staff routing as authorization to spawn or message another worker.
