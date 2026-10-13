# Relay fast shell motion + borderless card material

Task class: **design**

This successor refines the current Relay feature shell without changing control-plane or observed-progress semantics.

## Material rule

Relay may use purposeful color in cards when that color communicates feature or live state.

What is not allowed:
- gradients;
- decorative card outlines;
- semantic left-edge stripes;
- fake depth via thick borders;
- redundant stroke-based status decoration.

State-bearing cards now use borderless solid material:
- quiet states remain neutral Terra Prime surfaces;
- high-salience states may use a restrained solid semantic tint;
- warning/wait and success/info use lighter tints;
- semantic status remains primarily in the compact label/light.

Status badges no longer use a decorative outline. The old pulse ring is now a soft aura rather than a stroked circle.

Project-tab, action-button, and active-nav styling in this layer is fill/material-driven rather than outline-driven.

## Motion rule

Desktop sidebar/content movement remains 88px to 340px, but timing is intentionally fast.

- expansion: 220ms
- collapse: 200ms
- one small overshoot
- quick settle
- brief blur during the middle of movement
- no opacity fade or long delay

Pointer enter/leave and keyboard focus set a direction-aware shell-motion state. The layout shift still comes from the real sidebar width/margin change; a short transform/filter keyframe adds the sense of inertia.

The content canvas remains centered and max-width constrained.

## Reduced motion

Under prefers-reduced-motion:
- sidebar/layout transitions become instant;
- inertia keyframes are disabled;
- blur and overshoot are removed;
- semantic status color and static indicators remain.

## Verification

Browser tests assert:
- zero border width on state cards;
- different live states may still have distinct surface colors;
- sidebar transition durations stay <=260ms;
- expand/collapse direction state is set;
- correct inertia keyframe is active for each direction;
- reduced motion disables shell transition and page animation;
- existing desktop/MCP/mobile geometry remains stable.

Full repository tests, web build, no-gradient scan, no semantic card-border scan, and compiled inertia-keyframe checks pass before merge.
