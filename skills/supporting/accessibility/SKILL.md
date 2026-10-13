---
name: relay-accessibility
description: Audit and improve keyboard, assistive-technology, contrast, reflow and motion behavior in an actual rendered interface.
---

# Accessibility workflow

Use when implementing interactive UI or auditing accessibility. Compose with the platform pack; use QA for exact-artifact evidence. Prioritize the changed user journeys rather than treating an automated score as full coverage.

## Inputs

Gather rendered artifact, primary tasks, target platform, component/state inventory, supported input methods, typography/appearance settings and existing accessibility requirements. Include loading, error, stale, empty and overlay states relevant to the task.

## Supported actions

Inspect semantic controls, accessible names, labels, relationships and reading order. Traverse the journey by keyboard: entry, navigation, activation, dialog focus containment, dismissal and focus return. Check disabled/unavailable actions and error association. For async results announce meaningful state changes without speaking every poll.

Measure text and essential control contrast on the actual composited surface, including translucent effects and appearance variants. Test zoom/text scaling and narrow reflow without clipped content or inaccessible actions. Inspect touch targets, visible focus and non-color state cues. Enable reduced motion and verify the same meaning and completion feedback survive; honor reduced transparency when the platform supports it.

## Output and verification

Return affected journey/component, reproduction, expected accessibility behavior, observed issue, severity/impact and correction or next check. Verify names/roles/state with the platform accessibility tree and exercise the real keyboard flow. Use assistive technology when required for speech/navigation claims; label unavailable AT testing explicitly. Automated checks and visual appearance do not establish full accessibility.

## Recovery

If a checker disagrees with actual semantics, inspect the rendered accessibility tree and element state before changing code. When a native or AT harness is unavailable, complete supported checks and record the remaining device test. Preserve product intent while replacing inaccessible interactions with platform-appropriate controls; do not hide content to silence a scanner.
