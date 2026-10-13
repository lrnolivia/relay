# FigUI3 and Open Field Work — Continuation

## Latest Primary Field Work — explicit workspace modes and Inspector sizing

The user's latest direction supersedes the older notes below that described automatic one-pane floating and a compact float shell. **Docked, collapsed, and floating are explicit modes.** Closing the opposite pane never changes the surviving pane's mode. Collapse retains a full-height compact rail on each edge; left has the title bar plus icon rail, right has Design/Prototype/zoom and selected-scope color swatches. Float retains the complete panel, is resizable, and snaps home when dragged toward its edge. Docked widths, compact rail widths, and floating panel dimensions can all be adjusted. The Inspector now defaults to a 328px width with 16px content inset and 40px section title rows. Shared numeric and select controls use the reference input fill/radius/inset; on touch devices, sliding from the **right half** of a numeric input or dropdown adjusts its value, while a tap keeps the normal edit/menu action. The full Inspector's Selection colors section defaults to a one-row swatch summary, matching Lauren's screenshot. The Vibe rail entry now shows a provider-neutral AI motion glyph; its underlying chat transport and model picker remain unchanged.

The hosted thumbnail failure was reproduced: Chromium times out while rasterizing a Preview iframe positioned at `left: -10000px`; the same payload succeeds when its 0.001-opacity, non-interactive iframe sits at `left: 0`. `ProjectThumbnailCaptureHost.tsx` now uses that in-viewport position. This should repair *future editor captures* when deployed; existing hosted projects without saved thumbnails still need a backfill or a project-open recapture. Do not claim the hosted Dashboard is fully repaired yet.

Focused mode/Inspector/touch tests and `npm run build` passed. A local `/builder/noauth` visual check confirmed the collapsed full-height bars, 328px Inspector, 16px section inset, explicit float/dock transitions, and no page errors during those mode transitions. A later local check was blocked by the project's recovery overlay; exact hosted state after deployment still needs verification. The full `tsc --noEmit` baseline has unrelated Gallery/canvas/design-system errors; changed-file diagnostics were empty. Liquid Glass remains parked and dirty, deliberately outside this delivery.

**Next Primary Field Work:** restore Media Library click-to-insert at visible canvas center, with drag remaining intact; refine Image/Video upload popouts without changing the praised Gallery popout; speed and smooth text/double-click camera focus; then confirm hosted thumbnail regeneration. The broad canvas interaction parity program (move, resize, padding, text editing) is still open. This note's older work-order/PR snapshot is historical evidence, not the current task order.

## Current checkpoint — dashboard motion and canvas eyedropper

The latest finished batch makes Dashboard leave through its slide-away motion for non-thumbnail navigation, keeps the selected project card pulsing while it opens, and lets New Project proceed into the editor even when its starter snapshot save fails. A thumbnail opening uses its dedicated blur handoff. Dashboard-to-editor navigation skips the direct-load canvas blur/pop, so those transitions do not play on top of each other. The chrome entrance and Dashboard slabs get directional blur during motion. The color picker now has a cross-browser, per-pixel canvas eyedropper with a loupe; the canvas iframe supplies a raster for sampling. Focused entrance/motion tests and `build:all` passed locally. Real hosted project thumbnails and Dashboard opening still require hosted browser validation.

Liquid Glass is **parked at Lauren's request** while broader motion and control-surface work continues. Its uncommitted files add an Effects → Add menu item in the Inspector and a package-backed component with material controls. A local canvas check mounted the surface and exposed controls, but full editor/Preview behavior and publishing are not complete. Do not describe that work as shipped; inspect the current dirty files before resuming. Lauren wants all implemented canvas controls exposed in the Inspector and FigUI3/Figma-consistent placement. Before a major Media Library, Insert, or new-window redesign, present a concrete change list for her decision. Small function/form fixes may continue.

The first motion-surface pass makes the centered modal backdrop's blur animate with its dim layer, aligns its panel entrance/exit timing, and gives floating toolbar panels a 220ms entrance with a reduced-motion escape. Local `/builder/noauth` verified that Library → Components opens a panel with the expected entrance animation and settles at full opacity. `npm run build` passed. Broader surface decisions remain open: whether Media Gallery should click-to-insert like Insert, how detached left panels should retain content during collapse, and whether rich Inspector popups need an anchored exit animation rather than immediate unmount.

## Immediate Media and text camera delivery — 2026-09-28

Lauren reprioritized Media insertion and text edit focus for immediate shipment. The first follow-up was published to `main` as `bdbe8ab` (full SHA via Git). The Media toolbar opens the existing ImageSearchModal and VideoSearchModal before inserting a chosen source at the visible center. A new TextFocusCamera animates toward text when editing starts, applies a brief motion blur, and returns to the saved camera on edit end unless the user clicked or panned after focus. Selection keyboard navigation now uses Enter for one child, Shift+Enter for parent, and Escape for deselect; Shift-click removal waits for mouseup so Shift-drag keeps the moved group intact. Focused tests: 103 passed, 1 existing todo; Vite build passed. Local `/builder/noauth` confirmed Image and Video picker modals. Changed-file TypeScript has only pre-existing GalleryTool diagnostics (unresolved carousel symbols and `nodes` references); no new changed-file diagnostics observed.

The second Media follow-up opens a Gallery creation modal directly from the toolbar even when the Inspector is collapsed. It applies the existing source plan, including Gallery view, source ratios, strip hover, and carousel controls. Audio now opens a source URL/upload modal instead of inserting an empty audio element. Local `/builder/noauth` verified Image, Video, Gallery, and Audio modals (each one visible after its toolbar choice). Lauren also asked that double-clicking a canvas item or Layers row jump to it: Layers double-click now selects and pans to that item; generic canvas double-click pans to the selected item, including a child selected by hierarchy drill-in. Text and shape specialized double-click paths retain their edit behavior. Focused tests: 44 passed, 1 existing todo; build passed. Full text-focus, Gallery finish, and layer jump gestures still need browser verification. Record the follow-up SHA after push.

The next follow-up makes bottom-toolbar Media pickers compact and attached to the Media button, with a visible pointer and an Expand action for the original full modal. Image, Video, Gallery, and Audio were checked in local `/builder/noauth`. Movable Insert/Library/Gallery panels now scroll, dim and blur the canvas, and dismiss after successful item insertion. The floating Insert panel's hover slideout follows its panel bounds and scrolls within them; selecting a category closes the slideout and opens its full modal. Direct-load header chrome, including the logo and the collapsed Inspector control, now waits until the late entrance beat. The initial opacity transition is suppressed so no header fragment appears during preparation. The Inspector collapse/expand control lives on its chrome, with a compact restore bar when collapsed. Left Detach opens the full floating panel; Collapse reduces the workspace to its compact restore bar. Focused entrance/mouse tests and Vite build pass. Local `/builder/noauth` verified early-frame header opacity at zero, late arrival, right collapse/expand, full floating detach, and zero-opacity collapsed entry. Confirm Gallery finish and item/layer double-click gestures in a later behavior QA pass. Record the follow-up SHA after push.

## Primary Field Work ownership and continuity

Lauren calls the work assigned in this chat **Primary Field Work**. It is the governing product brief for the editor experience and should take priority when integrating adjacent Field changes. Codex and Claude may each carry long stretches of this work; Night Shift workers can continue in smaller batches when primary capacity is exhausted. This is a continuity note, not a claim that another worker's work is already integrated. Every successor should inspect current Git, this handoff, the live editor, and any concurrent work before editing, then record exact implementation and validation evidence. Keep the user-requested five-batch order and behavioral parity directive below intact unless Lauren changes them.

## Product brief correction — behavioral parity is the priority

Lauren corrected the editor brief after the inventory below: **the goal is behavioral and interaction parity with current Figma.** The editor is already roughly 90% there visually. Do not interpret “working behavior” as a reason to preserve the existing interaction model. If selecting, moving, text entry, resizing, padding, or insertion differs from what a Figma user expects, change that behavior, even when the current implementation technically works. Keep the established visual direction while doing so, but spend the next substantial effort on interaction parity rather than another appearance pass.

Audit each canvas flow against current Figma behavior and the live `/builder/noauth` editor: entry into the tool, cursor/hover feedback, click and drag gesture, modifier keys, selection state, Inspector state, resulting node geometry/content, undo/redo, and exit/cancel behavior. Fix the underlying interaction path, then verify the complete gesture in the browser. Prioritize select/move, text entry, resize, and padding before optional visual refinement. A generic “no regressions” check does not establish parity.

Current Figma behavior references, verified 2026-09-27: [selection and nesting](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects), [text creation and editing](https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design), [position and resizing](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions), and [auto-layout padding](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout). Baseline gestures to compare: click selects a parent, double-click or Enter drills into a child, Command-click deep-selects, Shift-click toggles a selection, empty-canvas drag creates a marquee, Escape clears selection; text-tool click creates auto-width text, drag creates fixed-width text, and double-click or Enter edits selected text; edge/corner handles resize and arrow keys nudge by 1 or Shift+arrow by 10; selected auto-layout frames expose clickable/draggable padding handles and paired Inspector padding fields. Treat these as concrete acceptance behavior, while checking details of interactions in the live product before implementing edge cases.

Lauren requested five delivery batches in this exact order: **1. toolbar/Insert + collapsed-entry fix; 5. detachable panels and remaining modal behavior; 2. selection/movement; 4. resize/padding; 3. text creation/editing.** These numbers refer to the initially proposed batch names; execute in this order. She explicitly trusts direct execution and commits to `main`; do not pause for a review gate. Use focused checks now and broader end-to-end testing later. The order does not downgrade behavioral parity as the objective.

## Current continuation — 2026-09-27 23:57 UTC (supersedes the older work order below)

The user now wants the editor interaction model overhauled to feel predictable like current Figma: selecting/moving, entering text, resizing, padding, and insert behavior. Keep the existing Pages/Layers and Inspector visual language and density. The bottom toolbar's tool switching is the immediate defect: icons, checks, arrows, and click effects were misleading. The user distinguishes **active canvas tool** from **open menu**. Small focused popups from the bottom toolbar or Inspector should visibly belong to the source icon; large category browsers should be movable, focus-grabbing panels. Most left-rail destinations can detach without a source anchor. All left-rail panels should be able to detach, with a compact state and a control to expand to the full useful panel. The full Insert panel should appear when the left Insert button is chosen; toolbar categories should expose focused choices. Each Insert category needs a full panel; clicking an item should insert at the visible canvas center with a restrained item pop animation, while dragging remains available. Frame's menu needs the row/column/grid/layout shortcuts; Shape/Elements needs the Elements catalogue; Resources needs its own menu/catalogue. Do not conflate these distinct scopes.

The user explicitly rejected the loading veil and onboarding popup. The incoming canvas alone should fade/zoom from blurred 0 opacity, sharpen after roughly 50% opacity, hold around 85%, pop just beyond full size, and settle. The Effects plus should not tilt crookedly; a complete turn into close is acceptable. Left chrome should morph when collapsed/restored. Padding should follow Figma auto-layout controls: one side drag by default, Option opposite, Option+Shift all; click for numeric entry; paired horizontal/vertical Inspector values with independent sides available. Official Figma references were checked: `https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout` and `https://help.figma.com/hc/en-us/articles/360040451373-Explore-auto-layout-properties`.

Current implementation checkout is `/Users/lrnolivia/Repos/field-figui3-main` on `codex/figui3-main`. `/Users/lrnolivia/Repos/field` is a separate dirty source snapshot and remains untouched. The old work-order section below is historical; #38's loading veil is superseded by the user's later explicit rejection and should be closed once the replacement lands. `origin/main` was verified at `165a965` before this batch. The current branch was clean at that SHA before this batch.

The first animation/onboarding/padding/toolbar-reliability batch was committed and pushed to `main` as `5b3b73f9722afd179acfdf48c09c060e2bc61614`. It removed the routine loading veil and onboarding mount/menu/command entry; added canvas-only reveal; softened plus hover; added four-side padding handles and Inspector access for plain frames; animated left chrome collapse/restore; corrected bottom-toolbar active state, eliminated blanket checkmarks, stabilized the tool-family icon, and made dropdowns mutually exclusive. Focused checks: 39/39 tests passed; changed-file TypeScript diagnostics were empty (full project still has unrelated diagnostics); `npm run build` passed; live Playwright `/builder/noauth` verified no onboarding, correct Frame→Shape active-state transfer, Ellipse icon change, no menu checks, and intermediate left-island geometry during collapse (308×900 → ~271×176 at 90ms → 264×44 at 270ms). The local dev server starts on 3333/5174/5175 after a fresh `npm ci` in this checkout. Do not assume the remote Preview has this code until independently checked.

The second toolbar/Insert batch now includes Frame layouts, Shape/other Elements, Media, Library section menus, list/icon menu views, movable category/Library modals, centered click insertion, item pop, Localization in Settings, Inspector tab-row spacing, new Text default copy selected for immediate typing, and a collapsed-state entrance that targets only visible chrome. Focused entrance/toolbar tests: 15/15; changed-file TypeScript diagnostics: none; Vite build: passed. Live `/builder/noauth` checked collapsed left/right state: hidden rail/panel opacity stayed zero, compact restore bar and right toggle were the entrance targets. Dynamic CMS collection click still uses drag for binding, with an explicit toast; drag remains usable. The full canvas behavior audit remains open.

This second batch was committed and pushed to `main` as `7cafbb5328090b8ad0c3cbb7ae9545cb86fc604f`. A subsequent detachable-panel batch is in progress locally: shared header detach control, compact floating shell, expand/collapse, drag, dock, restore-bar redock, and click-to-open titled Insert category modals (including dynamic CMS category data). Focused Playwright `/builder/noauth` checks: Layers detached compact, expanded with the real Pages/Layers content, and docked; clicking Insert → Elements opened a titled modal. Changed-file TypeScript diagnostics: none; Vite build: passed. Publish this batch separately; do not describe it as already on `main` until pushed.

**Next coherent delivery:** Implement detachable left panels through one shared shell, preserving a compact state and an expand control; finish category/Library modal routing without opening the left sidebar from toolbar controls. Then follow Lauren's ordered behavior passes: select/move, resize/padding, text. Use the current Figma references above as the baseline and verify complete gestures in the live browser when broader testing resumes. Update this note with exact commit SHAs and remaining risks at each delivery.

Do not call this overhaul finished after the current batch. Do not reinstate the loading veil, crooked plus hover, welcome popup, or checkmarks in every toolbar menu. Keep the bottom toolbar's actual selected tool as the sole active pill; opening a menu is only an expanded control state.

**Updated:** 2026-09-27 16:42 UTC  
**Repository:** `lrnolivia/field`  
**Working branch:** `codex/figui3-main`  
**Starting base:** `9dd35b37034b2f4c2c76192cb1565f4e0b8cba8e` (`origin/main`)

## User direction and authority

The user explicitly directed: adopt the uncommitted FigUI3 changes in the local field checkout, finish them, and commit them to `main`; then pick up unfinished work regardless of prior owner. The user said there is nothing in this repository the current agent cannot touch. Do not stop at a read-only audit or wait for the original worker.

The separate user checkout `/Users/lrnolivia/Repos/field` must be preserved as the source snapshot. It was on local `main` at `7c9f450ad1ad8ef480ac135d9d1c3d36165c7121`, **2 commits ahead and 96 behind** the then-current remote main, with four modified tracked files and one untracked file. Do not rebase, reset, clean, stash, or write there. The five file contents were inspected read-only. Work from this clean up-to-date worktree and transplant changes deliberately.

The original local-only commits are `c973c79` and `7c9f450`. They are unique by Git patch identity relative to `origin/main`. Inspect their semantic overlap with the already merged Inspector provenance PR before deciding whether to preserve, port, or close out their work. Do not blindly cherry-pick either onto a stale base.

## Canonical operating instructions already read

- `AGENTS.md` in the current remote-main tree points to `lrnolivia/loew-runner@main/LOEW_CHAT_BIBLE.md` and `contracts/manifest.json`; both were read at version `2026-09-27.1`.
- `.field/handoff-kit/CONTRACT.md` and `manifest.json` were read from current main.
- The current work is in the Codex lane; the Contract Worker Composio-only and no-main-push rule does not govern this Codex work. Direct main publication is explicitly user-authorized for the transplanted dirty changes.
- Refresh `main`, `field/control`, tracker/assignments, PR head SHAs, and preview state before each major implementation or publication step.
- Browser Preview QA must correspond to the exact current implementation SHA; a build is not runtime QA.

## Current checkpoint — 2026-09-27 evening

The work order and PR snapshot below are historical. The user has since authorized this chat to adopt and publish all unfinished Field editor work directly to main, including dashboard and motion work. Current implementation checkout is `/Users/lrnolivia/Repos/field-figui3-main`; preserve the dirty original `/Users/lrnolivia/Repos/field` checkout. Start with fresh Git status and remote HEAD.

This delivery implements late editor chrome entrance, real docked/collapsed/detached inspector states, distinct left float/collapse controls, repaired bottom-toolbar menus and Basic/Media/Layout taxonomy, compact media pickers and resizable floating dialogs with top-edge peek, smooth D3 camera focus for text and double-click, direct New Project creation, and a thumbnail-to-canvas opening overlay. Thumbnail capture has a longer raster/watchdog budget and retries when freshness probing fails. The exact production thumbnail issue still needs a hosted browser check with real projects; the local dashboard has no hosted project data. The opening overlay is likewise build verified, but the hosted project transition is not yet visually verified.

Verification for this batch: `npm run build` passed; five focused Vitest files passed (49 tests, one todo); `git diff --check` passed. Full `tsc --noEmit` still reports unrelated gallery/canvas/design-system errors on the current base, so it is not a clean gate. Next: verify real dashboard thumbnails/opening motion in hosted Preview, add directional motion blur to chrome/dashboard transitions, and finish editor behavioral parity. Publish a fresh commit SHA here after push.

## Initial state and changes to adopt

Original local checkout snapshot: `/Users/lrnolivia/Repos/field`, branch `main`, HEAD `7c9f450ad1ad8ef480ac135d9d1c3d36165c7121`.

Uncommitted paths:

- `src/editor/BottomToolbar.tsx`
- `src/editor/controls/ControlProvider.tsx`
- `src/editor/controls/unified/ControlProvider.tsx`
- `src/shared/loew-figma-icons.tsx`
- `src/editor/controls/responsive-style-values.ts` (untracked)

The intended behavior is to share responsive inline-`__mq` value resolution between both Inspector control-provider systems, apply literal CSS responsive overrides after those values, mark the active responsive branch, and finish the Resources toolbar icon/menu/order change. Latest main already parses `responsiveStyleValues`/`responsiveStyleBands`; classic and unified providers currently resolve these differently. Verify the range boundaries and precedence before preserving the implementation. Add focused tests for breakpoint floors, max-width choice, no-match behavior, merge precedence, and provider integration. Also verify toolbar order against the established FigUI3 order `Select/Hand · Frame · Shape · Sketch · Text · Resources · Layout` and accessible split-button names.

## Work order — highest effort first, with small wins bundled

1. **Responsive Inspector value parity (current delivery).** Port and finish the five adopted paths on latest main. Bundle the split-button accessibility labels and correct Resources icon/order where consistent with the current toolbar contract. Add focused regression tests. Run focused tests, TypeScript, and `npm run build:all`; inspect exact diff. Commit and push this delivery to `main` as explicitly directed. Record the exact SHA here.
2. **FIGUI3 paint stacks (largest remaining product architecture gap).** Registered control assignment `figui3-paint-stacks` is still `standing-continuation`/unactivated. Its acceptance is in `.field/assignments/assignment-figui3-paint-stacks.md`, mailbox, and QA file on `origin/field/control`. Fill and supported Stroke must expose ordered semantic paints with source/reparse/Preview parity, persistent visibility, reorder, opacity, and token identity; do not fake state. First trace the exact current source-to-render flattening point, then implement one end-to-end Fill slice and only carry Stroke where the model can represent it honestly. Bundle focused existing paint/background regressions and easy semantic fixes. Do not claim the full assignment from a partial Fill-only result.
3. **Native Scale visual metrics repair (#9).** Branch `field/native-scale-visual-metrics-repair`; reproduced 2× Scale defect is described in the PR. Run focused tests/build against a current base, resolve source changes, and use a branch Preview plus the exact authored SVG acceptance packet before marking complete.
4. **Dashboard project interactions (#5).** Branch `field/dashboard-interaction-polish`; project menu dismissal/focus and delete confirmation. This is the broadest remaining Dashboard UI interaction pass. Verify latest source/tests and perform focused browser QA; bundle remaining easy Dashboard semantics from #8/#10/#11/#13/#14 after checking whether they already landed.
5. **Control-plane dependency chain (#28 → #27).** #28 targets `field/control` and must stay there; #27 targets `main` and depends on #28. Finish validation/lineage before merging in dependency order. Never retarget #28 to main.
6. **Remaining Dashboard semantic PRs (#8/#10/#11/#13/#14).** Refresh each branch against main, rerun tests and strict TS together where safe, check exact changed paths, then record ready status. Avoid duplicating changes already present on main.
7. **Loading veil (#38).** Current PR head `bbee73a02f4032934190ab2e0d5aad53530cdd64`; focused tests 6/6, `npm run build:all`, Cloudflare build, and branch-preview startup frame were checked. The exact uploaded 48px logo plus soft circular white pulse are present. PR remains draft; no merge was performed. Revalidate its current checks before closeout.

This is ordered by expected implementation/QA intensity. Reorder only when fresh evidence shows a path already complete or blocked; record the reason.

## PR and branch snapshot at 2026-09-27 16:42 UTC

Open PRs observed:

- #38 loading veil, `field/project-loading-veil-native-mesh` (current preview/build passed; draft)
- #28 shared repair ledger, `field/shared-repair-ledger` → `field/control` (open; merge state unstable)
- #27 canonical handoff kit, `field/handoff-kit-canonical-source` → `main` (open; depends on #28)
- #14 empty-state semantics, `field/dashboard-empty-state-semantics` (draft)
- #13 collection semantics, `field/dashboard-collection-semantics` (draft)
- #11 sidebar navigation semantics, `field/dashboard-sidebar-navigation-semantics` (draft)
- #10 New Project focus flow, `field/dashboard-new-project-focus-flow` (draft)
- #9 native Scale visual metrics repair, `field/native-scale-visual-metrics-repair` (draft)
- #8 rename-dialog hardening, `field/dashboard-rename-dialog-hardening` (draft)
- #5 Dashboard interaction polish, `field/dashboard-interaction-polish` (draft)

Previously identified FigUI3 implementation PRs #17, #21, #26, and #36 are merged. Do not replay those changes. The wider Inspector and paint-stack handoffs are not complete merely because those PRs landed.

## Current exact next actions

1. Re-read this note and fresh `git status`, `git log`, `origin/main`, and `/Users/lrnolivia/Repos/field` status before resuming.
2. In `/Users/lrnolivia/Repos/field-figui3-main` on `codex/figui3-main`, implement item 1 only; keep the original checkout untouched.
3. First add focused tests for `responsiveStyleValuesAtWidth` and the provider merge/precedence contract, then run them before broader validation.
4. After the first delivery is published, update this file with commit SHA, validation, and the next active item before starting item 2.

## Recovery rules for another chat

- Do not assume this chat's prose or old PR bodies are current truth; refresh GitHub and worktree state first.
- The clean working checkout is `/Users/lrnolivia/Repos/field-figui3-main`. The old user checkout is deliberately preserved at `/Users/lrnolivia/Repos/field`.
- Do not copy the old checkout wholesale. Port only the listed paths and any minimal tests after comparing to current main.
- Never discard the two original local commits or dirty worktree snapshot; preserve their evidence until the intended code is integrated and verified.
- Do not edit Cloudflare/deployment, package manifests, or environment files for UI work unless a verified blocker requires it.
- Each delivery should include a small adjacent improvement (focused regression test, accessibility label, or stale assertion) without widening its primary behavior.
- Update this note at every completed delivery and leave one concrete next action.

## Progress log

- 2026-09-27 16:42 UTC — User authorized adoption of all five dirty FigUI3 paths and direct main commit. Fresh remote main is `9dd35b3`. Created clean worktree `/Users/lrnolivia/Repos/field-figui3-main` on `codex/figui3-main`. No adopted source edits have been made yet. Original checkout remains untouched.
