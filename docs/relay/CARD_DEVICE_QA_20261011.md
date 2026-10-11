# Relay card device QA packets

Status: open, `DANGER ZONE — HUMAN QA REQUIRED` for native-client card rendering only. Assignment `relay-mcp-rebuild-continuation-20261003`, prepared 2026-10-11 by `claude-ai-chat-20261007`.

## Exact artifact

- Repository `lrnolivia/relay`, production source `ef320d97cedcba0dd0b332725a5d6bc4295b9b53`, Worker version `02e783bd-a424-4a5e-9754-118088b54a7c`
- Card resource `ui://relay/context-card/v17.html` (SHA-256 `9a830fb3225e4a31ddcd3776210c0d2cef81716907bdd6d4e85dc9957e907599`); tool `relay_render_context_card`
- Diagnostic variants: `relay_test_card_static_standard` (A), `relay_test_card_static_compat` (B), `relay_test_card_lifecycle_standard` (C)

These answers are stale if production moves to a different source or card resource.

## Deterministic evidence (already proven, not homework)

- The exact-source production smoke matched production tools, resources, card and control-center bytes against this source: run [38102702398](https://github.com/lrnolivia/relay/actions/runs/38102702398), Visuals `vis_751345d9-136d-4623-be8f-bdbeed521f7e` (desktop dark) and `vis_ed357e51-7a64-47c8-b7f5-0541fc76b870` (mobile light).
- Main CI production verification and release assurance passed for this source.
- Historical client results remain unresolved and are not inferred: iPhone mounted and hydrated (2026-10-03), ChatGPT web showed a blank frame, and macOS desktop did not mount.

## How to run each packet

In an ordinary ChatGPT chat with the Relay connector enabled, send:

> Use relay to show the relay status card for project relay.

If no card appears or it stays blank, send each of these in turn and note which ones paint:

> Run relay_test_card_static_standard. · Run relay_test_card_static_compat. · Run relay_test_card_lifecycle_standard.

Repeat on each client: ChatGPT web (Chrome or Safari), ChatGPT macOS app, ChatGPT iPhone app, and ChatGPT web on Linux.

## Checklist (per client)

1. `mount` — a card appears inline in the reply (not only text).
2. `hydrate` — it shows real Relay data: project, current assignment and status, not "Connecting" or an empty frame.
3. `refresh` — tapping Refresh updates the card without an error.
4. `open` — Open Relay opens relay.loew.fi.
5. `expand` — tapping a project or assignment row, or the details area, expands it inside the same card.
6. `thumbnail` — if a QA screenshot is shown, tapping it enlarges it.

## Questions (per client)

1. `q-mount` (yes / no / not sure): Did the Relay status card appear and show real Relay data? If not, which of A, B or C painted? Criterion: client mount and hydration.
2. `q-actions` (choice: all worked / some failed / none worked): Did Refresh, Open Relay and expanding a row work? Note which one failed. Criterion: client actions.
3. `q-layout` (yes / no / not sure): Did the card fit the screen and read cleanly, with no clipped text, no sideways scrolling, and readable job titles? Criterion: compact card hierarchy.

Overall verdict per client: `looks_good` / `needs_work` / `not_sure`.

## Recording

Lauren replies with client name, checklist ticks, answers and an optional screenshot. Results are recorded against the exact source above in Relay context and in this document. A human pass covers only the client judgment. It does not override CI, deployment identity or other deterministic gates.
