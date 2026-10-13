---
name: relay-creative-design-systems
description: Design or extend reusable tokens, components and states from an existing product system with accessible, platform-aware verification.
---

# Design systems, tokens and components

Use when a UI needs reusable foundations, component variants or cross-screen coherence. Inspect the existing system before creating a replacement. Add art direction for a new visual thesis and the target platform pack for native behavior.

## Inputs

Gather approved identity, token/style source, existing components/callers, platform targets, real content, interaction/state inventory and acceptance. Identify which definitions are authoritative and which are generated or mirrored. Preserve established public component contracts unless the assignment explicitly changes them.

## Supported actions

Map primitive values to semantic roles: text/surface/action/status, typography, spacing, shape, elevation and motion. Prefer named roles over screen-specific magic values. Define appearance and accessibility variants using the actual composited surfaces; document exceptions with a concrete purpose.

For each changed component specify anatomy, content constraints, states, variants, input/focus behavior and responsive/adaptive rules. Include loading, empty, error, disabled and selected states only where meaningful. Keep tokens shared where semantics agree and platform composition native where interaction differs. Reuse components before duplicating them; test consumers before changing a shared default.

## Output and verification

Deliver a token/component change or implementation-ready specification with canonical definitions, variants, state examples and migration impact. Exercise representative consumers with short/long content, keyboard/touch, narrow/wide layout, appearance and reduced motion. Check accessible naming/contrast/focus and performance for expensive effects. A component gallery proves only its fixtures; verify at least one actual journey using the changed component.

## Recovery

If a new token breaks consumers, identify the semantic mismatch and narrow the override instead of scattering compensating values. If the source system or reference is ambiguous, preserve current contracts and isolate the precise decision. If rendering is unavailable, label visual/native checks open and provide exact reproduction; do not claim the specification is implemented.
