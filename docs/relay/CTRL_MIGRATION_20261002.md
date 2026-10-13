# ctrl extraction and live updates

## Approved product boundary

Lauren's October 2 direction supersedes the historical one-product branding rule for the website: **ctrl** is her control center/manager; **relay** remains the connective execution engine and MCP/plugin. ctrl retains the exact current website design and functional improvements, changing only name/logo plus the specifically requested Relay utility surface. This is not permission for a new dashboard aesthetic or a second work-state database.

- Dedicated intended repository: lrnolivia/ctrl; intended origin: ctrl.loew.fi. Creation/configuration not yet verified.
- ctrl accent: existing coral #FF6F78, explicitly accepted 06:51 UTC. Relay retains sienna.
- Rename Today to **now**, preserving its icon, role and dashboard layout. Keep compatibility aliases for old Today links and stored preferences.
- Main work destinations remain now, runner, inspector, night shift.
- Relay is a visibly separated elevated icon+name control in the same navigation language. Latest 06:53–06:55 refinement supersedes treating it as an ordinary full-page destination. Cohesive sidebar and floating bottom-pill variants on desktop/mobile; no oversized dock or inconsistent typography.
- Activation opens a visually attached floating panel on desktop or purpose-built sheet on mobile. Morph from/to the trigger with shared Field motion, shadow, dimmed/blurred background, focus trapping/restoration, Escape/outside/Back dismissal and interruption support. Reduced motion preserves state and focus without spatial travel. Keep all destinations reachable and comfortable in narrow layouts.
- A compact Relay-branded MCP telemetry card **replaces** the old Live badge; do not add a duplicate. Show only truthful connection health, version and successful contact timing. Ambient animation is requested; no directive to make it calmer. Connected/reconnecting/offline semantics and reduced-motion/hidden-tab behavior remain explicit.
- Relay utility content should show meaningful engine activity/handoffs/problems and secondary capabilities/version/diagnostics, without duplicating Runner's assignment-management screen.
- Create a new ctrl icon in the existing Terra Icon Figma family, matching its materials/geometry/art direction. Existing file must be located and inspected; do not guess or replace unrelated icon work.

## Release order and fallback

1. Finish the admitted combined website polish, work viewer, canonical Field motion and shared UI build skill in Relay PR118. Fix exact-head tests, inspect captured evidence, ship and verify at the existing Relay origin first.
2. Complete retained isolated interactive review builds with pending-approval retention and approval+30-day policy. Preserve exact assets and synthetic data, not merely a mutable URL pointer.
3. Extract the finished website into ctrl, add true event-driven delivery and the approved identity/utility changes, configure its own deployment/origin, and verify before announcing cutover. Keep the verified Relay site alive as fallback until ctrl passes.
4. Preserve the complete Field preview and remaining MCP client-parity commitments. MCP transport/client proof remains its own gate; a new web brand cannot fix host mounting by itself. Do not let extraction silently drop previous work.

The user targets waking around 11:00 a.m. Eastern (15:00 UTC); that is an evidence/checkpoint target, not permission to skip tests. Place labeled before/intermediate/after desktop and mobile screenshots in Inspector so the process is visible.

## Architecture decision

Separate repositories do not determine communication latency. Current source polls the dashboard every60seconds and assignment details every8seconds; it is not true push.

Keep Relay authoritative for registration, assignments, teams, commands, revisions, review records and execution events. ctrl owns presentation, presentation preferences, frontend assets and a thin same-origin API/event adapter. Version the contract so each can deploy independently. Do not give browser JavaScript service credentials or unrestricted backend access.

Preferred Cloudflare topology: ctrl Worker -> narrowly scoped Relay service binding/entrypoint, using verified user identity and explicit endpoint allowlists. This avoids browser cross-origin token handling. Validate the existing Access/OAuth audiences and domain policy before enabling the new origin. Any new security-sensitive persistent access requires its actual setup approval; no broad authority bypass, guessed credentials or public-data exposure.

## Live update contract

Relay publishes a durable event after a canonical mutation is committed. Use a monotonic event sequence, stable event identity, schema version, project/assignment identity and source revision. Broadcast via an authenticated SSE stream; commands remain guarded HTTP operations with mutation IDs and revision preconditions. A durable event hub may be needed for cross-instance broadcasting and replay; verify available deployment capabilities before choosing storage.

- Send compact change notifications; fetch authoritative details through the same protected API.
- Preserve a reconnect cursor and replay missed events. If retention no longer covers the cursor, send an explicit resync instruction and rebuild from an authoritative snapshot.
- Deduplicate by event ID/revision. Do not replay old toast notifications on initial load, refresh, reconnect or another route.
- Validate origin/authentication; reconnect/expired-auth handling must be truthful. No unauthenticated stream or CORS wildcard with credentials.
- Prove ordered publication, disconnect/reconnect, missed-event recovery, duplicate delivery, multiple tabs, revision races, source failure and fallback polling.
- Updates are instant **after Relay observes/publishes them**. External GitHub/worker state needs an upstream event path too; do not claim instant external completion when that source is still polled. A timer that polls faster is not an event-driven migration.

## Migration/rollback checks

Extract only source and dependencies needed by the website; preserve attribution and exact provenance. Keep Relay's MCP tool/resource identities, OAuth path, engine state and approved card art. Avoid cross-repository runtime asset dependencies; use versioned shared-package or verified source-sync contracts for Field glyphs/motion.

Verify old and new routes, authentication, all five controls across sidebar/docks, saved preferences, source/review writes, notifications, live stream, retained previews and narrow-screen overlays. Confirm actual new origin and exact deployed SHA. Retain the previous Relay deployment and a reversible routing plan; do not delete the working origin or old code before proven acceptance.

## Primary technical references

- Cloudflare service bindings: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- Independent Worker deployment and HTTP forwarding: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/
- EventSource: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- Credentialed CORS restrictions: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors/CORSNotSupportingCredentials

These support the architecture choice, not a claim that ctrl or streaming has been provisioned.
