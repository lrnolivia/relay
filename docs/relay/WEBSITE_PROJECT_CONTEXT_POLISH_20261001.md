# Current website fixes — Julian-PM implementation

Assignment: `relay-website-project-context-polish-20261001`.
Branch: `relay/website-project-context-polish-20261001`.
This is a draft review batch; merge and production deployment require further authorization.

The approved desktop/tablet visual language remains the baseline. Today, Runner,
Night Shift and Inspector now place the project context between the page heading
and telemetry. No project query means All Projects; an explicit hash query scopes
content and survives existing document navigation, reload and history. No new
project-selection persistence policy was introduced.

Telemetry is a shared, ordered responsive mosaic. Every summary remains present,
with semantic SVGs from the existing rounded family, neutral surfaces in the five
approved roles, and no colored card-edge strips. The global multicolor strip and
canonical page/header brand images remain. Inspector work-item screenshot cards
and conversational MCP cards were not rebuilt.

The collapsed sidebar keeps a small stacked Relay icon/name tile, with a lighter
neutral surface only on that tile. Other navigation remains icon-only. Expansion
overlays a stable content rail, fixing missed clicks caused by focus-driven page
movement. The rail fills the viewport on short and long pages. Mobile shows all
four destinations together and a compact two-column overview. Theme and Refresh
Tools share one compact accessible utility menu.

Lauren's subsequent review additions are part of this same canonical acceptance.
The paintbrush provides complete presentation presets, grouped Customize options,
Custom state and reset. Preferences are local to this browser. Approved/Simple is
the default; alternative presets test bottom mobile navigation, a roomier overview
and richer count visuals. Rich shows discrete markers from actual available counts
(up to twelve), not invented timelines or progress. A finite spring entrance uses
brief movement-bound blur and settles to sharp readings. Calm and system reduced
motion disable motion throughout the website, including controls and Inspector. The preset registry can accept future complete
presentation themes without shipping unfinished theme choices or workflow flags.

## Verification and evidence

Use Node 22, `npm ci`, `npm run build`,
`npm run typecheck:2.0 --workspace @relay/web`, and `npm test`.
`project-context.test.mjs` verifies the built website at 320,390,900,1024 and1440px:
project scoping, document round trips, reload/history, simultaneous metrics,
semantic glyphs, exact neutral tokens, header identity, mobile targets, full-height
rail, local presets/reset, honest pending/error states and reduced/finite motion.
Existing API, workspace, contract, React, Inspector and navigation checks remain.
PR106's bounded assignment reads, progressive startup and minute polling remain.

The exact-head draft CI runs the same aggregate checks, then builds with the PR
head as source identity. `visual-review.mjs` captures settled fixture success and
clearly labelled partial/error states at desktop/tablet/mobile widths, selected
project context and Rich/bottom variants. Every capture records head/build,
viewport, route, state, actual summary text/geometry and hash. The existing protected
CI ingest registers those bytes in Runner Visuals, checks stored-image readability,
and prepares artifact-specific questions as pending QA notes without a human
verdict. Receipts and screenshots are retained in the CI artifact.

Local fixture screenshots prove this source/layout; they are not production
acceptance. Final PR description and exact-head CI receipt identify the tested
commit, evidence IDs, test results and any remaining evidence/QA limitations.
Lauren's Library images and representative carousel frames were materialized
locally with supported helpers and inspected before implementation.

Deferred work-item view architecture, notification replacement and Nico's MCP
inline-card work remain outside this batch. No production deployment is created
for testing.

## Follow-up motion and mobile review

Lauren positively reviewed bottom navigation, then requested a shorter mobile
hero and natural paintbrush placement. The inherited 112px header minimum is
removed; the brand/tools row is 60px with bottom navigation. Workspace/connection
and title spacing are compact without moving or dropping their information.
Bottom navigation and Simple/default remain available with existing local choices.

`motion.css` and `bindMotion` apply one spring curve to moving controls, glyphs,
sidebar reveals, presentation menus, small status rings and Inspector review
layers. Brief blur follows transform/size transitions and finite moving effects;
large rails/panels filter only a small identity/header layer. Mobile allows at
most two simultaneous scripted blur layers, capped at 240ms and 0.6px; desktop
allows four at 400ms and 1px. Effects release their filters at rest and cancel
on Calm, reduced motion or backgrounding. Tiny existing semantic status rings
have subpixel movement blur; opacity/color-only loading, caution and edge-glow
pulses share the curve without smearing static text. Pointer-driven Inspector
camera/docking layout remains direct and functional. Conversational card content
and resources are unchanged. Motion tests and exact-head preview records cover
these boundaries; earlier PR107 captures remain the before-review evidence.

The latest copy refinement uses shared display mappings for status, phase and progress updates. Queued work is “waiting to start”; deployed and verified remain separate. Unknown states stay unreported. Infrastructure diagnostics stay available in Details, while preview review notes contain readable questions instead of a JSON packet. These are display changes and do not change execution or held MCP resources.

Lauren’s final refinement makes the selected bottom-navigation layout an opaque floating capsule with a soft drop shadow. The four destinations stay together, inset from the side and bottom safe areas. Scroll content includes matching bottom clearance. The approved palette, top-navigation option, mobile hero and presentation behavior remain intact.

Additional requested presentation trials use the same paintbrush registry: desktop compact header and desktop branded floating bottom pill. Both reuse the existing logo/name, four destinations and utilities, with compact hero spacing. Sidebar remains the default, with a 4px wider collapsed rail and more padding/gap in its compact brand tile. No glass treatment or navigation system is introduced.

Floating bars measure their own rendered height and bottom safe-area offset through the existing presentation binding. Resize observation updates scroll clearance after text enlargement, wrapping, viewport changes and layout selection. Focused browser checks verify the final page block and last control can scroll fully above the dock; viewport resizing and enlarged text exercise zoom/reflow behavior. The current Inspector review-overlay source and Lauren’s reference were inspected only; those repairs are reserved for the separate notification/review next phase.
