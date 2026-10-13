---
name: relay-performance-visual-performance
description: Profile and optimize animated effects, media and live visualizations with compositor, rendering and memory evidence.
---

# Visual performance

Keep rich visual behavior GPU-friendly and bounded.

Prefer transform/opacity animation. Be cautious with large animated blur, backdrop-filter, box-shadow, masks, filters, and continuously repainted regions. Limit simultaneous ambient animations and pause nonessential motion when the surface is hidden or reduced motion is requested.

Charts/data visualization should render only the resolution the user can perceive. Avoid redrawing unchanged data.

Images should use appropriate dimensions/formats and avoid shipping oversized assets merely to downscale them in CSS.

If an effect is expensive, first seek a cheaper implementation that preserves the same visual idea. Remove or simplify the effect only when measurement shows the experience still fails its budget.

## Workflow and verification

Read the approved effect, target device, realistic data/media size and update cadence. Capture a baseline trace while exercising scrolling/input and the effect together. Inspect layout/paint/compositing, dropped frames, layer count/texture memory, offscreen work and retained listeners/timers. For canvas/WebGL measure resolution, redraw rate and resource cleanup; for charts compare the visible detail to the actual drawing cost.

Deliver the effect's budget, trace and a targeted optimization: batch updates, reuse unchanged geometry/data, bound resolution, defer offscreen work or reduce repaint area. Check hidden-tab/closed-view cleanup and repeated mount/unmount, not just first render. Validate the same visual meaning with reduced motion and fallback rendering.

If measurement cannot run on the target, retain the effect and flag the device proof. If cost remains unacceptable after a concrete optimization, offer a cheaper version preserving the visual thesis and state the tradeoff. Do not claim GPU acceleration from CSS property choice alone.
