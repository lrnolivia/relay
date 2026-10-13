---
name: relay-platforms-web
description: Implement and verify responsive browser journeys with semantic controls, progressive enhancement, resilient state and bounded rendering.
---

# Web platform craft

Build for the browser as a responsive, accessible, progressively enhanced environment.

Use semantic HTML, resilient layout primitives, keyboard/focus behavior, reduced-motion support, and responsive recomposition. Prefer CSS layout and native browser capability over script-heavy geometry.

Treat hover as an enhancement, not a requirement. Touch targets and focus states must remain usable on mobile/tablet.

Use platform-aware loading states and avoid layout shift. Data-rich views should preserve reading position when new state arrives.

For Relay web surfaces, share state semantics and visual tokens with ChatGPT-native surfaces without forcing identical composition.

## Workflow inputs and actions

Inspect framework/runtime versions, routes, data ownership, SSR/hydration strategy, target browsers and approved design. Map the journey across narrow/wide, keyboard/touch and loading/empty/error/stale states. Use existing tokens and semantic controls before introducing custom geometry or event machinery.

Implement resilient layout with intrinsic sizing and intentional breakpoints. Preserve focus, selection and reading position across data refresh; cancel or reject stale requests. Verify server/client state agreement where hydration applies. Add performance guidance for live data, large lists, media or rich effects.

Deliver changed components and state behavior with exact browser/viewport evidence. Exercise the primary action and resulting data, back navigation, refresh and failure recovery. Check overflow at the narrowest supported size and enlarged text. If a browser harness cannot authenticate or represent the branch, state that limit and use an isolated exact-artifact preview; do not claim production proves the branch. Fix the first state/layout divergence before cosmetic screenshot symptoms.
