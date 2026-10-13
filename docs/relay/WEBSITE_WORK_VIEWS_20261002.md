# Combined website catch-up — 2026-10-02

## Scope and authority

Lauren requested completion of the unfinished Relay work, explicitly ordering earlier Mac polish plus the modular work viewer first, retained interactive previews second, and MCP cards last (05:35:44 UTC, Sentinel_023b7a5341e88191b2e80a5dfcf2aad5). Complete Field preview is between retained previews and MCP cards. Later instructions authorize product decisions, recoverable blocker repairs and completion/release within existing safety/access boundaries (05:46–05:48). Uncertain changes retain rollback paths.

Bulk semantics were explicitly accepted: Clear is reversible archive, Complete handles a review item without closing any task or PR. No production records are bulk-changed by this implementation or tests.

The former post-release polish branch delivered PR117 mobile repairs only; that merged branch is retired as superseded. Its remaining criteria are carried into this existing work-viewer assignment. Earlier unpublished Mac files remain on the offline Mac. This batch reconstructs missing requirements against current source, not a claim of byte-for-byte Mac recovery. Stopped workers were not restarted.

## Implementation checklist

- Shared query/filter/sort/selection/action model with optional List/Visual presentations, stable canonical item identities, source state and next action, real Inspector captures and semantic visuals elsewhere.
- Explicit selected/current-filter/all-project loaded-result scopes, review preview before applying, per-item CAS, reversible archive, restore, reopen, undo and honest partial-failure reporting. Review bookkeeping is separate from source execution and QA answers. New meaningful source revisions reopen review. Unknown priority is unranked; source activity drives time, not polls.
- Existing R2 binding stores bounded review metadata; existing authenticated operator gateway and stricter human-write guard remain in place. No credentials, access grants, billing or protection changes.
- Slimmer aligned mobile/desktop floating navigation, original sidebar unchanged, safe-area clearance and usable hit targets. Gear settings; obsolete header/roomy-overview values migrate while supported preferences survive.
- Whole notification badge is red; reduced motion and Calm retained. New-work notifications use first-success baselines and durable session identities, with exact item routes.
- Project bar alphabetic with recent meaningful unseen changes in a raised promoted row. Acknowledged revisions return to alphabetical ordering. Navigation groups subordinate platform utility work under loewOS and the unmanaged RTX dependency fork under rtxForge, without repository or coordination identity changes.
- Rich summary ratios only when both numerator and relevant denominator are known, with explicit count labels. No manufactured completion/trend.
- Inspector chat-card studio collapsed initially, preview counter removed, original art preserved.
- Available cross-origin live previews no longer silently switch to captures because DOM access is restricted. Readiness requires exact source/origin/nonce; otherwise the frame is explicitly unconfirmed with an allowed direct-preview link. Framing/auth policy stays intact.

## Verification and remaining work

Local pure model/CAS tests pass; JS parsing checked. Full exact-head build, typecheck, API/browser tests and screenshot review are still pending at this checkpoint. Not deployed or complete. Additional browser fixtures cover reversible bulk review, source-state preservation, selection/view/sort/search/reload, supported settings migration and project grouping.

Retained isolated interactive builds remain the second batch; this batch does not pretend a metadata pointer preserves deployments. MCP host parity stays last. Native iPhone / Linux-app host acceptance remains distinct from Chromium fixtures.

## Rollback

Review metadata is additive under work-review/v1 in the existing evidence bucket. This batch never modifies source task/PR status or replaces existing QA answers. Revert this PR's product commit to restore the prior UI/runtime; leave additive review metadata intact for recovery. Unsupported presentation choices migrate to approved defaults, and reset is available. Do not delete old local Mac files or snapshots.

## Motion amendment (06:22–06:24 UTC)

Lauren requested an animation research pass before motion changes in the current Relay and Field runs, then explicitly selected **Field's existing animated glyphs as the cross-product golden standard**. Preserve their forms and nearly finished animation, port them to Relay, and improve surrounding interface morphing, momentum and transition continuity. This applies to future work; add a Relay-build skill teaching the canonical reuse and verification workflow. Do not treat Relay's current bespoke glyph family as the new standard. Exact Field source inspection and cross-repository package/provenance plan are pending while the shared GitHub App quota resets.

Research basis: Apple's spring API preserves velocity under interruption (https://developer.apple.com/documentation/swiftui/animation/spring); HIG Motion requires purposeful brief, cancellable feedback (https://developer.apple.com/design/human-interface-guidelines/motion?changes=l_9_3); Apple Reduce Motion criteria explicitly call out animated blur/depth effects (https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria); web.dev recommends measuring paint/composite cost and notes blur is expensive (https://web.dev/articles/animations-guide). Follow Field's real source and runtime before choosing tokens or introducing a library.

### First CI checkpoint

PR118 head50bf5323e7e0fbee1bb1e19489a7efbeb1529380 built and typechecked successfully, with admission success. Full web suite:31/37 passed,6 failed; no release. Reproduced causes being fixed: duplicate sibling React keys left obsolete summary values in DOM (three tests); old Inspector flex selector overrode new grid; a Rich-view test still expected replaced count dots; review metadata was briefly labeled ready during reload before its read completed. Pure state/CAS tests passed. Screenshot artifact11213265466 in run36974182587 preserves this intermediate state. New motion and skill source remains subject to a fresh final-head gate.

### ctrl follow-on

See CTRL_MIGRATION_20261002.md. Finish and verify this Relay fallback release before the requested ctrl identity/repository/origin cutover. All current work carries forward; ctrl preserves design. Its new Relay utility panel/card, now label, canonical coral and event-driven updates are explicit later migration criteria.


### Backend recovery and preserved successor

PR118's final62-file source checkpoint0b843e3289f2db3946d56706e968fab099d747d1 passed full quality/admission, including dock centerline/height assertions. Actual Inspector readback exposed a production1000-object enumeration limit, unrelated to screenshot generation. The branch was explicitly superseded and retained, with all62localfiles verified against exact Git blob hashes; no requirements or changes were discarded.

Narrow backend PR119 merged as310fe7d0a20fc92eee1a8a42e0d707b0bda82792. Production run36980397830 verified the exact deployed source/build, recovered the exact previously404capture vis_fb3a86b0-7c1e-4026-a75e-36983623d3c8 with matching SHA256, and saved/read back eight new production captures. This new main-based branch transplants PR118, preserves PR119's stronger production evidence checks, applies attached-state studio waits, and propagates explicit backend partial coverage. It must pass its own final-head gates before the first full website release.

Canonical Field shapes/profiles are now pinned to9ce5bb839050ef94e434e13079cab319a3e64711. Exact motion capture found and fixed legacy CSS/blur stacking; the visual gate rejects either duplicate effect. No Field glyph redesign was introduced.
