# Relay 1.8.1 design repair

This assignment began as the post-1.8 icon hotfix and was canonically amended into a design repair after user review of the shipped 1.8 interface.

## Why this exists

The 1.8 architecture was correct, but the first visual pass introduced obvious UI regressions:

- nested project navigation consumed a second sidebar and did not provide consistent context across views;
- clickable surfaces used heavy bottom edges that read like broken underlines;
- the ChatGPT settings control looked like a primary CTA bolted onto the sidebar;
- Today attention cards split actions into detached right-side endcaps;
- the page overview/dashboard slab added visual weight without adding useful information;
- gradients remained in the dashboard and QA preview treatments.

## Design direction

Task class: **design**.

The repair follows a targeted-evolution approach: preserve Relay's current information architecture, observed-progress contracts, control-plane behavior, and approved product marks while simplifying the presentation.

Design audit inputs:
- user-provided 1.8 production screenshots;
- Relay's installed Impeccable UI-audit skill;
- browser rendering and responsive contract tests.

Superdesign CLI was invoked against the exact repair branch, but its shell session was not authenticated and its login flow could not complete non-interactively, so no Superdesign canvas output is claimed as part of this release.

## What changed

### One project context rail

A single horizontally scrollable project-tab rail now sits below the workspace context and applies to Today, Runner, Inspector, and night shift.

The old nested Runner project sidebar/search rail is removed. Runner uses the full content width below the shared project tabs. The all-projects tab keeps aggregate Today/Inspector/night-shift views available.

### Flat status hierarchy

The large page-overview slab is removed. Each view gets a compact status line with the subsystem/context label and a short current-state summary.

Runner metrics are plain inline facts rather than a row of dashboard tiles.

### Controls

Clickable surfaces no longer use fake 3px bottom-border depth. Controls use shape, spacing, restrained tonal fills, clear hover/focus states, a subtle scale/translate press response, and reduced-motion fallbacks.

No gradients are used anywhere in the shipped Relay UI sources.

### ChatGPT settings

The sidebar utility is now a quiet ChatGPT settings action. It is visually subordinate to primary navigation, transparent at rest, and only gains a restrained raised surface on hover.

### Attention/action cards

Today attention cards now keep status and action controls inside the same card composition. There is no separate colored endcap or annex. Desktop uses an integrated two-column layout; narrower widths stack the same content inside one card.

## Compatibility

This repair does not alter Relay 1.7.5 observed-progress semantics, Runner / Source / Cloud / Verify contracts, 1.9.x skills/architecture, or MCP identity metadata owned by PR #47.

The historical assignment id remains relay-1.8.1-icon-hotfix-20260930, but its canonical amendment record documents the expanded UI-repair scope.

## Verification

Required release checks include:
- full repository tests with full Git history;
- web/MCP Chromium browser contract;
- mobile and desktop overflow checks;
- project-tab selected-state/deep-link checks;
- no legacy page-overview slab;
- no bottom-border underline treatment on key click surfaces;
- ChatGPT settings transparent at rest;
- attention action button bounding box contained by its card;
- no gradient declarations in shipped UI sources;
- exact-head Runner admission before merge.
