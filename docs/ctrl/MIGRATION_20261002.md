# ctrl migration

Status: repository registered; implementation and protected cutover pending.

## Product boundary

ctrl is Lauren's control center and web manager. Relay remains the MCP/plugin and connective engine. ctrl has its own private repository, lrnolivia/ctrl, and intended ctrl.loew.fi origin. A repository split does not require delayed communication: the UI consumes an authenticated event transport plus canonical snapshots from Relay.

Preserve the finished Relay website design. Rename Today to now with old route compatibility, use coral #FF6F78, and add a matched ctrl mark. Relay becomes a visually attached raised utility immediately after now with consistent icon/name treatment in the desktop sidebar and mobile bottom pill. Desktop opens an anchored floating panel; portrait opens a purpose-built sheet. Shared spring motion, dim/blur, focus return, Escape/Back, interruption and reduced-motion support are required. A small truthful Relay telemetry card replaces the Live badge. Retain Field's existing glyphs as the animation reference.

## Release prerequisites

The verified Relay fallback is production source 6930685bd862a9d4c6db3ccfae50936c259a64e8, Workers version 19de294a-f049-40f8-92db-cef2df715754, web build d88b3d998c2caaea27d4471b24887a80b58b1d90c3c3c9002d7ce87050343e41. Run 37006777413 passed actual production and retained-preview checks. Do not remove this fallback during migration.

The existing Cloudflare Access app covers relay.loew.fi only. ctrl is not currently protected by that app. Do not expose a new unprotected control plane or silently broaden Access/security configuration. New protected domain/build integration requires the applicable explicit security confirmation. Project cloud.write remains false until the approved integration is verified. No credential or API token is copied into this repository.

Implement narrow same-origin browser API/event forwarding with existing verified user authorization and Relay as canonical data owner. Preserve origin/CSRF checks; do not spoof an allowed Origin to bypass them. Require event IDs/cursors, deduplication, reconnect/resync and truthful connection state. Polling alone is not instant communication. New state or credential sharing must not be hidden in the migration.

The Terra Icon Figma target is not resolved yet; a new mark must match that existing family before being called final. Physical iPhone and native ChatGPT desktop card acceptance remain separate from Chromium fixtures.

## Repository policy

Product source and product truth live in ctrl. Operational plans, QA receipts, handoffs and release evidence live here under docs/ctrl. Initial implementation should include the normal Runner admission workflow and a thin AGENTS bootstrap. Preserve exact source attribution and licenses when extracting shared frontend modules.
