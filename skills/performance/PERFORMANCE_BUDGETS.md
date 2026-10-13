---
name: relay-performance-performance-budgets
description: Set and measure asset, font, runtime, hydration, network and platform performance budgets while preserving the approved visual direction.
---

# Performance budgets

Ambitious visual design is allowed. Performance is a design constraint, not a reason to make everything plain.

Before implementation, identify the expensive parts: large media, animation, blur/filter, shadow, canvas/WebGL, charts, long lists, live updates, network fan-out, or large client bundles.

## Budget posture

Define measurable expectations appropriate to the surface:
- initial useful content should appear quickly;
- interactions should respond without perceptible lag;
- scrolling and common motion should remain smooth;
- background/live update work should be bounded;
- hidden/offscreen UI should not keep doing expensive work;
- payloads and retained history should remain bounded.

Prefer lazy/deferred loading for secondary history/evidence. Virtualize genuinely large lists. Batch live updates and preserve reading position.

Measure before flattening the design. Optimize the expensive implementation while preserving the approved visual thesis whenever practical.

## Measurement workflow

Inputs are the target device/network, representative journey/data scale, exact artifact, current baseline and approved design. Pick a budget for each evidenced cost: payload/decoded media, font loading, script/style work, initial useful content, interaction latency, retained memory and update frequency. Record numeric thresholds with their rationale before claiming a pass; no universal device score substitutes for the task.

For web use a cold and warm load, network/CPU traces and field Core Web Vitals when available; distinguish field measurements from lab proxies. Inspect LCP element discovery, CLS from media/fonts/loading states, and INP/event/render work. Check hydration duration/mismatches, unused initial JS/CSS, route splitting and long tasks. Measure font subsets/weights/fallback metrics and image dimensions/formats against actual display sizes.

Inspect request fan-out, caching headers/key correctness, compression, CDN/origin behavior and repeated downloads. Never cache personalized responses across users for speed. For native targets use platform profiling of launch, main-thread work, frame pacing, allocations and retained state on the deployment target.

Deliver baseline, budgets, trace/commands, the expensive path and before/after measurements on the same fixture. Optimize that path and re-check visual/interaction acceptance. If profiling is unavailable, document a measurement plan and remaining unknowns; do not claim smoothness from compilation. If a budget still fails, revise implementation or seek an explicit product tradeoff instead of silently flattening the design.
