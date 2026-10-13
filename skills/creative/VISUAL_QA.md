---
name: relay-creative-visual-qa
description: Compare a rendered artifact with approved visual intent across hierarchy, states, responsive behavior and interaction evidence.
---

# Visual QA and design editing

Verification compares the rendered result to the design intent, not merely to "no crash."

## Review order

1. hierarchy: can the user tell what matters first?
2. composition: are scale, alignment, density, and grouping intentional?
3. identity: does the surface belong to the product and feature?
4. semantics: do color, icon, motion, and status agree with real state?
5. interaction: are actions discoverable, bounded, and context-preserving?
6. responsive behavior: does the design recompose rather than just shrink?
7. accessibility: contrast, focus, keyboard, reduced motion, readable type;
8. technical polish: clipping, overflow, stale copy, duplicated state, broken geometry.

## Evidence discipline

Use screenshots/rendered snapshots for visual claims and bind evidence to the exact source/deployment identity. A rendering proof is not design acceptance.

When the user gives qualitative feedback such as "too SaaS," "too busy," or "this isn't the right UI," translate it into concrete composition/system changes and re-check the result.

## Editing posture

Do not protect earlier design work from critique. Preserve intentional identity, but remove elements that do not earn their space, emphasis, or interaction cost.

## Workflow inputs and output

Gather approved reference/thesis, exact source/deployment, target viewport/device/appearance and real task content. Capture comparable rendered states with the same meaningful data, then review in the order above. Identify specific component/layout divergences; distinguish deliberate adaptation from accidental mismatch.

Deliver annotated findings with artifact, state, evidence, expected behavior and concrete correction. Re-check the changed state and relevant responsive/interaction boundary after a fix. If no render is available, report source observations separately and keep visual claims unverified. If a reference is ambiguous, preserve the approved system and frame the precise design decision; do not invent pixel fidelity or rewrite runtime truth to make a screenshot look better.
