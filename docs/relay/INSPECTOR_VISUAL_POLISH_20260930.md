# Inspector visual polish — September 30, 2026

Assignment: `relay-inspector-visual-polish-20260930`  
Branch: `relay/inspector-visual-polish-20260930`  
Source baseline: `f183508d4f03d39d9a08021e0a4772058cb991cf`

## Accepted scope

The user asked for a less brown, less chunky floating Inspector; stronger product identity; responsive resizing; restrained main-interface polish; and a corrected ChatGPT settings link. The user subsequently said “just design it,” choosing direct website implementation over Superdesign/Figma mockups. No new Figma file or generated Superdesign draft was created. Superdesign's generation refused because credits were exhausted; its temporary analysis artifacts are not shipped.

## Visual changes

- Neutral charcoal review canvas and floating panel, with a matching neutral light theme.
- Inspector is the primary tool identity, with its approved icon and visible name at every panel size. The current project is a separate secondary icon/name badge. Project names throughout the interface are paired with their icons in contained badges.
- A quieter header with comfortable 21px question type, 14px supporting copy, 20px content inset and 40–44px controls; existing approved Inspector glyph remains. The user rejected both excessive compression and an oversized alternative; the final pass uses a deliberate midpoint.
- Desktop floating panel resizes from the corner facing the canvas. Narrow panels stack answers; wider panels place notes alongside the question. Header and save footer stay visible while content scrolls.
- Mobile keeps an overflow-safe bottom sheet and appropriate touch targets.
- Main-interface layout, status rhythm and semantic colors remain intact. The connection dot aligns in the text row; checking uses a subtle pulse, disabled for reduced motion.
- Content-shaped loading skeletons hold space for project tabs, Today sections, project detail, review captures, night shift, Inspector questions and captured images. They announce loading without exposing decorative shapes, stop on completion/error, and disable motion under reduced-motion settings.
- ChatGPT settings points at the exact user-supplied URL: https://chatgpt.com/settings/plugins-settings/plugin_asdk_app_6abdbca7c98c819187cc153d781b0faf

## Deferred behavior — explicit next-session backlog

1. Captured-image zoom and pan: fit/reset, cursor-centered zoom, pointer/trackpad navigation and clear distinction from a live iframe. Preserve exact evidence identity.
2. Figma-style anchored comments: click to place a pin, write a comment, save image-relative coordinates independent of zoom/pan, support threads/resolution, and expose comments to agents through Relay's canonical evidence/QA contracts. Never fork the review store.
3. Human-oriented reports: explain what happened, whether the user must act, and one useful next action. Provide a Copy prompt control with current project/assignment/branch/PR/SHA, failure evidence, ownership and safe recovery instructions. Distinguish agent work, external waits, stale records and human decisions. Do not instruct a user to repair already merged or superseded work from a screenshot.
4. Relationship simplification: group connected failures/assignments/operations by canonical evidence and relationship context. Show one cause and its affected work without hiding distinct failures or inventing relationships. Reuse 1.9.x backend context instead of UI inference from prose.
5. Blank ChatGPT embedded Relay card: the user observed an empty “Opening relay” surface while project state reads succeeded. `src/relay-chat-ui.js` decorates Runner project/preflight calls with `ui://relay/context-card/v1.html`. This is a renderer/host issue to diagnose against the actual ChatGPT app session; a passing simulated MCP-host browser test does not prove that client works. No cause or fix is claimed here.

## Copy/paste prompt for the behavioral session

Continue Relay's Inspector and operator usability work from docs/relay/INSPECTOR_VISUAL_POLISH_20260930.md. Read current Relay authority, coordination and source/runtime state first. Acquire a non-overlapping claim. Implement captured-image zoom/pan and image-relative comment pins that agents can read through the canonical QA/evidence contracts. Make failure reports explain the user's next action and provide a complete Copy prompt bound to current project, assignment, owner, branch, PR, exact artifact SHA and real failure evidence. Group connected work using the existing canonical relationship context. Diagnose the blank contextual card in the actual ChatGPT host rather than treating a simulated MCP test as client proof. Preserve the newly polished Inspector, approved icons, exact evidence identity, existing state ownership and bounded QA rules. Ship coherent batches without introducing a parallel store or inferring status from stale screenshots.

## Validation

The MCP HTML builder uses literal callback replacements so minified JavaScript containing dollar-sign replacement patterns cannot corrupt the embedded app. This fixes an evidenced build failure, separate from the deferred contextual ChatGPT card.

Full repository tests passed. Browser checks cover web and MCP-host transport, native resize, narrow/wide composition, mobile overflow, fixed save footer and durable exact-capture review saves. Final publication identities are recorded below when available.

Impeccable's detector found three pre-existing sidebar width/padding/margin animation warnings in operator-1.8.css. This pass did not alter those animations; no new findings were reported for the Inspector or settings changes.

## Greige and visual-card follow-up

User correction: neutral greige surfaces replace both the brown status-card washes and the blue-grey Inspector panel. Project badges have raised greige fills and a subtle inset edge. Inspector heading uses the shared bright cyan #18afc0; the approved bitmap icon is preserved pending the user's replacement. Review uses visual cards in three desktop columns, two medium columns and one mobile column. Skeletons follow these same card dimensions and responsive grid, and section-specific work/attention/automation/Inspector placeholders replace the generic rows.

## Sidebar theme and spacing follow-up

Review cards and their skeletons use 28px desktop gutters and 24px mobile gutters. Relay's sidebar title is near-white in dark mode and sienna in light mode. A sidebar sun/moon toggle follows the system until a choice is saved, persists the user's light/dark choice, and initializes before paint. All existing light styles, including Inspector, follow that theme. A smaller refresh glyph replaces the gear and opens the user's exact Relay plugin settings link. Its tooltip directs the user to select Refresh there; no undocumented automatic refresh endpoint is invoked. OpenAI's documented flow: https://developers.openai.com/plugins/deploy/connect-chatgpt#refresh-metadata
