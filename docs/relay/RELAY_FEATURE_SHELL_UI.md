# Relay feature shell + accent assets

Task class: **design**

This release updates Relay's feature identity and app shell without changing Runner, Source, Cloud, Verify, or observed-progress semantics.

## Final feature icons

The website now uses the five final 1024×1024 PNG assets uploaded by the user to the admitted design branch:

- relay — apps/web/public/brand/relay.png
- today — apps/web/public/brand/today.png
- runner — apps/web/public/brand/runner.png
- inspector — apps/web/public/brand/inspector.png
- night shift — apps/web/public/brand/night-shift.png

Repository SHA-256 values at release time:

- relay: 3a1effe91b1670275d4b908f29a1a3c68729df4aa9f0da2d695401869ed8b676
- today: 38bbdd2c1cee243b3092fd5ad354ffe86e58d4b39077d15fc3694656007299e2
- runner: 5544aed7af6c9a0b30c45c38c837182b5e4072b7cbf9a4c6e3e6dab0f067a3b4
- inspector: 2290ab259cb775d32973b4f871717e636426fbd7e0d22096aacf0bde571d134a
- night shift: 2710f5331f172a0f35639e8cea06c35bd0ae28d365f50d331e4e998209da51a7

The app favicon/Relay shell also uses the final relay.png asset.

## Canonical Figma accents

Feature accent mapping comes from the Terra Prime icon study:

- relay — sienna #b5471f
- inspector — teal #1c8c93
- runner — green #3bcb8d
- today — coral #ff6f78
- night shift — amber #ffbf00

Feature color is used for identity, not live state.

## Feature headers

Each page has one clear identity block:

- today — focus
- runner — coordinate
- inspector — review
- night shift — monitor

The final packaged icon sits beside the large lowercase feature name. The old redundant page-statusline/subsystem naming is removed.

## Status and cards

Feature accent color and live-state color remain separate systems.

Status-bearing cards inherit the exact semantic tone already produced by observed progress and runtime state. Cards use:

- one crisp semantic left edge;
- one low-opacity solid semantic surface tint;
- one semantic status light.

The old shared pseudo-dot is suppressed whenever a modern status-badge is present, so badges never render duplicate status indicators.

No gradients are used.

## Desktop shell

At desktop widths above 900px:

- sidebar defaults to an 88px icon rail;
- hovering the rail or moving keyboard focus inside expands it to the existing 340px sidebar presentation;
- feature labels and ChatGPT settings copy reveal only while expanded;
- content shifts from the 88px offset to the 340px offset;
- the inner app canvas stays centered at a maximum width of 1120px instead of stretching across the available monitor.

Tablet/mobile retain the static horizontal navigation pattern and do not depend on hover.

The collapsed rail remains keyboard accessible through focus-within expansion.

## Verification

The browser contract covers:

- final PNG feature marks rendered as bundled data URLs;
- 1024×1024 natural feature-icon dimensions;
- canonical feature accent values;
- human-task page subtitles;
- exactly one status-light element and hidden legacy pseudo-dot;
- semantic 4px card accent edge;
- 88px collapsed and approximately 340px expanded sidebar geometry;
- content margin shift and centered max-width canvas;
- mobile static-navigation fallback;
- reduced-motion behavior;
- web and MCP-hosted interfaces;
- responsive overflow safety.

Full repository tests, the web/MCP build, no-gradient scan, and feature-shell invariants pass before merge.
