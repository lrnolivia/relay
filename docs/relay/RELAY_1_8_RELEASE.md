# Relay 1.8 — contextual UI

Relay 1.8 turns the 1.7.5 observed-progress backend into the shared human interface for ChatGPT cards and the Relay dashboard.

## Release identity

- product: Relay
- release: 1.8.0
- architecture prerequisite: Relay 1.7.5 observed-progress contract
- presentation surfaces: contextual MCP cards + shared web/MCP control center

## Truth contract

The UI consumes `relay_runner_progress` / `/api/progress/:project`.

It does **not** infer execution from claim state, leases, reservation presence, or `next_action` prose.

The presentation uses the 1.7.5 state vocabulary and keeps worker liveness separate from external-system activity. Exact branch, head, PR, merge, Worker version, deployment, and evidence identities remain visible when available.

## Contextual cards

Relay tools for Runner, Source, Cloud, and Inspector advertise `ui://relay/context-card/v1.html` as an additive MCP Apps output template. Headless result schemas are unchanged.

Cards:
- summarize the exact tool result instead of inventing a parallel state model;
- render observed progress, checks, PR state, Cloud deployment identity, and Inspector evidence;
- preserve exact technical identities in compact chips;
- refresh Runner progress through `relay_runner_progress` when project input is available;
- open the shared Relay control center for deeper work.

## Shared dashboard

The web and MCP-hosted dashboard use the same sources and project context.

- **Today**: evidence-derived current work and attention states; completed/held historical declarations are not treated as live progress.
- **Runner**: Now / Up next / Finished are derived from observed progress and ordered by latest concrete activity.
- **Inspector**: review/evidence/QA scopes to the selected project.
- **night shift**: unattended activity scopes to the selected project and remains human-facing lowercase.
- one shared project context selector drives Today, Runner, Inspector, and night shift;
- Runner also has compact project search and uses available viewport height;
- the detached Orient → Act → Resolve strip is replaced by a compact page overview;
- ChatGPT app settings are available directly from the Relay sidebar.

## Motion and controls

1.8 adds restrained ambient motion, elastic product-mark motion, hover/press depth, state-change transitions, and reduced-motion fallbacks.

Buttons retain visible control affordance with a distinct pressed state; selected navigation remains legible rather than reading as a flat card.

## Compatibility

- existing headless tools continue returning their existing data;
- `relay_ui_request` only gains the read-only observed-progress route;
- project/source/Cloud mutation authority is unchanged;
- `apps/mcp/index.js` remains owned by the separate held MCP icon assignment / PR #47 and is intentionally untouched by 1.8.

## Publishing notes

Wrinkles discovered during this build should be appended to `docs/relay/findings/suggestions.md`. In particular, the >16 KB Runner API source required one bounded write through the connected GitHub integration because Relay's MCP file writer cannot transport that full file; Runner coordination, ownership, preflight, PR, merge, deployment and completion remain Relay-authoritative.

## Post-release icon hotfix

See `docs/relay/RELAY_1_8_ICON_HOTFIX_HANDOFF.md`. Icon/illustration work is intentionally not a 1.8 release blocker.
