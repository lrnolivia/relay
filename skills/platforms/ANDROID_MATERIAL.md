---
name: relay-platforms-android-material
description: Design and verify native Android/Compose or TV flows with back, focus, lifecycle, insets and text-scaling behavior.
---

# Android / Material craft

Use Material/Android behavior as a native interaction foundation, not as a requirement to look generic.

Respect system back behavior, predictive back where available, touch ergonomics, dynamic layouts, accessibility, dark theme, text scaling, insets, and lifecycle/state restoration.

Compose brand identity through typography, shape, color, iconography, motion, and content hierarchy while keeping controls understandable to Android users.

For TV/remote surfaces, use focus-first navigation and visibly persistent focus states rather than touch assumptions.

## Workflow inputs and actions

Read minimum/target SDK, Compose/View architecture, navigation/state owners, approved design and target phone/tablet/TV devices. Map the journey's entry, system back, cancel and return behavior before styling. Use installed platform components and version-compatible APIs; verify predictive-back support rather than assuming it.

Exercise rotation/window resizing, recreation and restored selection/form state. Distinguish durable saved state from transient UI state. Check system bars/IME insets, edge-to-edge layout, larger text, TalkBack semantics and dark theme. For TV validate D-pad traversal, persistent focus, back and remote activation without touch.

Deliver a screen/state implementation or handoff with native component choices and device/API evidence. Verify the primary journey on an emulator/device representing the target. If unavailable, mark lifecycle/back/AT checks unverified and provide exact steps. If a convention conflicts with the brand, preserve the interaction contract and adapt styling; never replace system back with a decorative control that loses navigation state.
