# field runner report

## 2026-09-26 — pilot initialized

- target: `lrnolivia/field`
- mode: read-only
- schedule: hourly when enabled
- model: `gpt-6-sol`, medium reasoning
- live web search: enabled
- current state: disabled
- first gate: dependency doctor

## 2026-09-28 — interrupted editor batch recovered and shipped

- source truth: `lrnolivia/field@main`
- current field main after recovery: `0cca7b65cbcc9a1e5ce7d5805ec96860aa5522b1`
- PR #43 → `d9c580f33d8d81be0aca15c2ba7135996e8b3982`: fresh HTML-shell cache behavior; selection-color locate preserves workspace mode; floating/Compact Docked title-pill and document-identity transition.
- PR #44 → `f7754f22d918af3106c433a242f92ae0c7381f97`: Selection colors locate temporarily fits affected nodes and restores the pre-focus camera after the locate pulse; repeated locates preserve the original camera.
- PR #45 → `0cca7b65cbcc9a1e5ce7d5805ec96860aa5522b1`: Inspector auto-hide persists across workspace modes and now has Default/Floating/Compact/Compact Docked behavior; empty-canvas arrows map ↑ Floating, ↓ Default, ← auto-hide, → Compact Docked while selected-object arrow nudge remains intact.
- validation: Cloudflare `Workers Builds: field` succeeded on exact PR heads for #43, #44, and #45 before merge.
- visual QA: pending Lauren's browser pass for motion, temporary camera focus/restore, auto-hide timing, and arrow feel.
- scope note: PR #44 implements the concrete Selection-colors locate path. No separate Effects-row locate UI was invented because no corresponding effect-locate interaction exists in current source.
- record note: `state/field.json` still describes the legacy enabled API-backed Runner worker's blocked 429 state. It is not current Night Shift progress and was intentionally not rewritten as healthy.

## 2026-09-29 — field left-panel Inspector parity

- chat identity: `field left-panel Inspector parity` (derived from the primary product goal; no explicit chat title was available).
- target: `lrnolivia/field`
- primary goal: bring every left-panel content/menu surface up to the Inspector design language while keeping the left icon rail / toolbar shell visually unchanged; centralize the chrome in shared field CSS so the editor can be tuned coherently.
- implementation branch: `field/left-panel-inspector-parity-20260929`
- PR: #124 — `feat: unify left-panel chrome with Inspector`
- durable branch head: `3dd8ca23d54aa9a10c5ea4ee458cd59ad90ee860`
- field `main` observed while writing this report: `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`. Lauren explicitly said another `main` is still coming, so this SHA is a snapshot only. Refresh `main` before any reconciliation or merge.
- branch implementation already committed: shared `src/styles/field-chrome.css`; Interface contrast preference/runtime mixes; shared left-panel primitives; visible redesigns for Pages/Layers, Insert, Library/Presets, Media, Locale, CMS, Branches, Vibe/detached Vibe; left-origin floating/toolbar content adapters; final visual matrix coverage. Toolbar/rail shell styling was intentionally left alone.
- recent implementation commits: `73f051d` Pages/Layers + Insert; `66ebe37` Library + Presets; `bc6ea0a` Media + Locale; `64d782e` CMS + Branches; `233c308` Vibe + auxiliary surfaces; `adc2cc5` final parity matrix; `3dd8ca2` detached-Vibe QA isolation.
- exact-head verification already obtained on `3dd8ca2` before the moving-main conflict: candidate build passed; Inspector visual QA passed; candidate lint matched the then-current main baseline with no branch-specific lint delta. The left-panel visual matrix had not been confirmed complete before main drift interrupted promotion.
- Float/Inspector ownership changed after this branch was built. This branch contains an earlier Float expansion repair (`a2cbc7d`), but another worker has since fixed Float as part of the incoming `main`. New `main` is authoritative for Float/Inspector behavior. Do not blindly carry the branch's older workspace/Float implementation over it; retain only left-panel work and any still-useful non-conflicting regression coverage.
- continuation integrity: all product and QA code from this chat is committed on the implementation branch. Verified branch artifacts include `src/styles/field-chrome.css` blob `abd46a5a...`, `src/editor/e2e/left-panel-visual-qa.spec.ts` blob `42bab651...`, and `.github/workflows/left-panel-parity-verify.yml` blob `1c93cd3a...`. There is no local-only or uncommitted reconciliation code to recover; the interrupted merge-prep step never wrote to Git.
- resume from live Git truth: wait for the incoming `main`, refresh PR #124/head/base/merge-base, recompute changed-file overlap, and use current `main` as semantic truth for every overlap (especially Float/Inspector). Reapply only the left-panel parity deltas. The overlap set had already grown as `main` moved, so do not trust the old four-file conflict list.
- before final QA, update the parity workflow's stale historical baseline reference so candidate test/lint comparison is against the new `main`, not `f94bd17`.
- final gate: exact reconciled head must pass build, left-panel visual matrix, Inspector/Float non-regression guard, and candidate-vs-current-main test/lint comparison. Then squash-merge PR #124 only after the branch is fresh and those gates are satisfied.

## 2026-09-29 — field universal PaintPicker

- chat identity: `field universal PaintPicker` (derived from the primary product goal; no explicit chat title was available).
- target: `lrnolivia/field`
- primary goal: replace divergent color/fill editors with one canonical Figma-class PaintPicker everywhere. `ColorInput` remains the compact inline launcher; the floating picker owns `Custom / Libraries`, a fixed `Solid → Gradient → Pattern → Image → Video → Shader` rail, and capability-driven disabled states rather than alternate picker designs or hidden icons.
- shipped PR #108 → merge commit `64888da072282562aefe7e1d2d8e38e77eb42861`: corrected Fill back to an anchored floating popover instead of Inspector navigation; introduced the shared PaintPicker shell; routed color/gradient/text/CMS/selection/preset entry points through the common architecture; kept existing Pattern, Media, Gradient, and Shader infrastructure instead of duplicating renderers; explicit capability sets include full Fill = all six, Text Color = Solid + Gradient, color-only = Solid, gradient-only = Gradient.
- shipped PR #128 → merge commit `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`: compacted the picker from 480px to 360px, tightened header/rail/padding/controls, capped large paint previews around 300px, and fixed nested color launchers. The nested regression came from a stale `!popupCtx` render gate: Shadow/Text Shadow/Effects color inputs inside another ToolPopup could set open state without rendering a picker. Nested ColorInput now opens the same canonical anchored picker above its parent popup.
- current field `main` at handoff: `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`.
- continuation branch: `field/universal-paint-picker-continuation-20260929` at the same SHA. There is no unmerged or local-only PaintPicker code to recover; the continuation branch is intentionally clean and already contains every shipped change needed to resume from this exact state.
- validation state: PR #128 was green for its required Media tests + editor build before merge; changed TS/TSX sources and focused picker contracts were syntax/contract checked during implementation. GitHub's combined commit-status endpoint currently reports no status contexts for the merged `64fa810a` main commit, so do not claim a separate post-merge runtime/deploy verification from this report.
- human visual evidence: Lauren confirmed the first universal picker was visually strong but much too large. The 360px density correction was shipped afterward; that compact result still needs a fresh live browser pass across all launch sites.
- remaining product/architecture work:
  1. run a live launcher sweep on the exact current build: Fill, Stroke/border, Text Color, text gradient, Shadow, Text Shadow, SVG/vector colors, component color props, CMS colors, Selection Colors, preset create/edit, Pattern, Image, Video, and Shader. The nested Effects bug proved source-level shared-component coverage is not sufficient by itself.
  2. resolve `Libraries` semantics. Top-level Libraries should ultimately mean design-system/project/team bindings. Built-in Pattern Monster and built-in Shader catalogs should not silently redefine that concept; likely move built-in catalogs/presets under Custom/source selection and reserve Libraries for actual saved/library paints.
  3. define a normalized source-first `PaintLayer` model before expanding true multiple fills. Existing CSS background layers naturally cover Solid/Gradient/Image; Video and Shader are semantic child fills and must not be faked into CSS backgrounds. Pattern can compile to CSS/SVG but still needs semantic identity.
  4. harden Shader lifecycle/parity: restore only host styles field actually changed, verify multi-selection, and test transitions among Shader/Video/Pattern/ordinary backgrounds without stale managed children or host layout mutations.
  5. define Pattern source reconciliation when `data-field-pattern` metadata and manually edited CSS diverge; hidden metadata must not silently override source truth.
  6. after live visual QA, tune shared picker density once more only if needed; do not fork per-property picker sizing.
- resume sequence: re-read current Runner manifest/Bible and `field/AGENTS.md`; refresh `main` and the continuation branch; if `main` has advanced, use new `main` as semantic truth and reconcile only this workstream's remaining deltas. Start with live launcher QA, then fix any universal-launch routing regressions, then Libraries semantics, then the PaintLayer/multi-fill architecture. Do not reopen the already-settled anchored-popover or one-picker-everywhere decisions without a concrete regression.

## 2026-09-29 — field Stage 0 Figma behavioral parity

- chat identity: `field Stage 0 Figma behavioral parity` (derived from the primary goal; no explicit chat title was available).
- target: `lrnolivia/field`
- primary goal: close Stage 0 against official Figma Learn/Help Center interaction semantics, not by copying Figma's visual styling. The durable contract is `docs/FIGMA_BEHAVIOR_PARITY.md`: Figma documented behavior → current field behavior → parity status → discrepancy/fix → regression coverage.
- reference scope supplied by Lauren: selection/canvas interaction; hierarchy/reparenting; frames/groups; move/resize/snapping/guides/duplication; Auto Layout/constraints; booleans/masks. Preserve behavior that already passes, fix the first deterministic divergence, and add real-Chromium coverage where reliable.

### merged from this workstream

- PR #106 → merge `264dd67a8f339f026c28bfeb047e0c60ec4f4e31`: **Figma selection behavioral parity — Batch 1**.
  - fixed real marquee start after the transparent canvas input surface had become the actual pointer surface.
  - fixed Cmd/Ctrl-marquee so nested layers can be selected without also selecting the containing parent.
  - real Chromium locked parent-first click, Ctrl deep-click, double-click drill-in, Enter/Shift+Enter, Tab/Shift+Tab, Shift toggle, empty-canvas deselect, normal marquee, and Ctrl-marquee.
  - successful parity run: `36554371773`.
- PR #109 → merge `c2fa2f90e7cae1b90f929167ebf94477df7c6452`: **Figma hierarchy behavioral parity — Space overrides**.
  - creator tools contextually own held Space as Figma's parenting bypass instead of pan.
  - Hand/pan highlight stays off while Space is serving the creator-parenting override.
  - ordinary absolute children can be dragged outside their frame while held Space keeps the current parent; releasing Space restores normal live exit/reparent behavior.
  - flow/grid children were intentionally deferred to Batch 4 because their correct Figma analogue is **Ignore auto layout**, not a fake snap-back or silent absolute conversion.
  - successful Node 22 + real-Chromium run: `36559986981`.

### current resumable work

- working branch: `stage0/figma-frame-group-parity`
- durable branch head: `a54e1f99782cff76b3ecdc65859de46866c3f827`
- merge base for this branch: `c2fa2f90e7cae1b90f929167ebf94477df7c6452`
- field `main` observed at this checkpoint: `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`.
- branch divergence at checkpoint: 4 commits ahead / 49 commits behind `main`.
- overlap check: the 49 newer `main` commits do **not** touch any of the branch's nine product/test/doc paths. Reconcile/update the branch before promotion, but do not assume old exact-SHA runtime evidence survives that update.

Current branch commits after the merge base:

- `d162786101e2cbcd8178d010e78bddd62ac53f5c` — Frame-tool click/no-drag creates Figma-style default Frame behavior.
- `89e0d31c362a7b7c4142afeb28950584fdecfe92` — temporary frame/group verification workflow.
- `c245499b304d770feedc16038cae7a15273d6229` — broader Group-vs-Frame Chromium audit, standard Frame-selection shortcut, and fixture coverage.
- `a54e1f99782cff76b3ecdc65859de46866c3f827` — first-divergence diagnostics for failing frame encapsulation / wrap behavior.

The branch contains all code/tests/docs needed to continue; there is no chat-only or local-only implementation state to recover. Important committed branch artifacts include:

- `src/canvas/creators/FrameCreator.ts`
  - click/no-drag Frame creation now produces a fixed `100×100` Frame.
  - click inside an eligible frame nests the new Frame there.
  - held Space still bypasses automatic parenting.
  - click-created Frames intentionally skip drag-over sibling encapsulation.
- `src/canvas/shortcuts.ts`
  - canonical Figma-style Frame Selection chord is primary+Alt+G (Ctrl/Cmd+Alt+G).
  - historical Shift+Alt+A remains as a hidden compatibility alias.
  - Group / Ungroup remain primary+G / primary+Shift+G.
- `src/canvas/drag/e2e/fixtures/seeds.ts`
  - includes `GROUP_FRAME_SEMANTICS` fixture for native Group vs fixed Frame comparison.
- `src/canvas/drag/e2e/figma-frame-parity.spec.ts`
  - covers nested 100×100 click-created Frame and Space bypass.
- `src/canvas/drag/e2e/figma-group-frame-parity.spec.ts`
  - covers Group-first selection / double-click drill-in, Group child motion + bounds refit, fixed Frame dimensions under child motion, Group/Ungroup world-geometry preservation, and primary+Alt+G Frame Selection geometry.
- `src/canvas/drag/e2e/figma-frame-diagnostics.spec.ts`
  - current first-divergence probe for the unresolved frame failures.
- `.github/workflows/stage0-figma-frame-parity-one-shot.yml`
  - currently intentionally narrowed to the diagnostics spec. Do not interpret its green status as full Frame/Group parity.

### verified on the current branch

- deterministic Frame/Group suites: `130/130` tests green in run `36561552322`:
  - `src/canvas/commands.test.ts`
  - `src/code/groups/group-semantics.test.ts`
  - `src/code/groups/group-refit.test.ts`
  - `src/editor/native-group-inspector-contract.test.ts`
- click-frame Chromium behavior is green:
  - Frame-tool click inside a Frame creates a nested fixed 100×100 Frame.
  - Space + Frame-tool click bypasses that parent.
- latest diagnostic run `36562205110` is green because both diagnostics executed successfully; it is evidence, **not** a parity pass.

### unresolved first divergences

1. **drag-created Frame encapsulation is failing in real Chromium**.
   - full verifier run `36561552322` shows the auto-text + px-box encapsulation path leaves both `cap` and `box` under `hero`.
   - diagnostic run `36562205110` is stronger: after the draw gesture, `capParent = hero`, `boxParent = hero`, `added = []`, and source code is unchanged. The failure therefore occurs before/at Frame creation/commit, not in a later child-reparent rendering step.
   - the canvas-root encapsulation variant was flaky in the full verifier (failed once with null parent, passed retry). Treat it as unstable evidence until the first divergence above is fixed and rerun deterministically.

2. **Frame/Layout-from-selection moves a centered absolute SVG instead of preserving world geometry**.
   - full verifier run `36561552322` shows both Create Layout and Create Frame failing the <3px preservation contract; observed X deltas ranged from ~46px to ~103px.
   - diagnostic run `36562205110` proves the mutation does commit: `star` becomes a child of a new Frame and stays there, but its screen position shifts immediately and remains shifted.
   - source after Frame wrap shows the wrapper using percentage/translate centering while the child is rewritten to `left: 0px; top: 0px`; this is the current first-divergence area to inspect in wrap-in-frame coordinate normalization, not a screenshot/timing issue.

### exact continuation order

1. refresh current `main`, branch head, open PRs, and overlap before mutation.
2. keep `stage0/figma-frame-group-parity@a54e1f9` as the durable checkpoint. Update/reconcile it onto current `main` only after rechecking overlap; exact-SHA browser evidence must then be rerun.
3. fix **drag-created Frame encapsulation first**, tracing why the real drag creates no Frame/source mutation in `ENCAPSULATE_MIXED`. Do not weaken `frame-encapsulation.spec.ts`.
4. fix **wrap-in-frame / wrap-in-layout world-coordinate preservation** for centered/translated absolute children at the source-mutation coordinate conversion. Do not compensate cosmetically in Canvas.
5. restore the temporary verifier from diagnostics-only to the complete frame/group gate and run:
   - deterministic Frame/Group contracts;
   - `figma-frame-parity.spec.ts`;
   - `figma-group-frame-parity.spec.ts`;
   - `frame-encapsulation.spec.ts`;
   - `wrap-in-parent.spec.ts`.
6. only after those are green, update `docs/FIGMA_BEHAVIOR_PARITY.md` rows from gap/pending to verified, remove the temporary workflow/diagnostic-only surface, build the exact code-only head, and open/merge the focused Batch 2 Frame/Group PR.
7. after Batch 2 closes, continue Stage 0 with Batch 3 move/resize/snapping/guides/duplication, then Batch 4 Auto Layout/constraints (including flow/grid Space behavior via Ignore auto layout), then Batch 5 boolean/mask geometry semantics.

### completion boundary

Stage 0 is explicitly **not complete**. Do not declare it complete from Inspector polish, Layers contracts, Preview parity, or these Batch 1/2 merges alone. The official-Figma behavioral matrix remains the gate: foundational rows must be audited, true gaps fixed at first divergence, and the agreed core flows covered in real Chromium.


## 2026-09-29 — field Media system architecture & hardening

- chat/workstream: `field Media system architecture & hardening` (no explicit chat title was available, so this name reflects the primary goal rather than incidental fixes)
- canonical repository: `lrnolivia/field`
- current field main at closeout: `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`
- continuation branch: `field/media-system-architecture`
- continuation branch head: `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`
- branch status: exact match with current `main` at closeout; safe resume point containing all code needed to continue this workstream

### shipped Media architecture

- `79e9b2c`: project-scoped Media session/catalog/upload state; async uploads retain original project ownership
- `986c2dd`: contextual toolbar Media replacement for a single compatible image/video/audio selection
- `2ad35b1`: place new toolbar Media inside a selected structural container via the canonical insertion engine; async placement intent is captured before upload completion
- `148b2b9`: preserve selected container placement through the multi-step/async Gallery wizard
- `d9e94ea`: remove the rendered `Insert → Media` route and make Media toolbar-owned
- `61e56dc`: restore a distinct mixed-media/library glyph so Media does not read as Image
- PR #107 merged as `d7db56b`: toolbar/popout/Media visual polish reconciled with canonical Media behavior
- `297face`: remove Media from the Insert data model itself; no `MEDIA_ITEMS`, `media-library`, or top-level Media Insert category remains
- `f55e2a2`: remove the proven-dead legacy `media-gallery` toolbar compatibility route from the panel union/host
- Media architecture handoff was refreshed during the workstream to reflect project isolation, contextual placement, toolbar-only entry, Gallery behavior, and removed legacy paths

### settled current behavior

- Media is a first-class bottom-toolbar system, not an Insert category
- canonical entry flow: bottom-toolbar Media → anchored Media shell → typed browser → expanded workspace when needed
- matching selected media node → replace source
- selected structural container → place inside
- otherwise → insert normally
- Gallery remains composition intent over images, not a Media type
- one shared catalog/ingest/queue/dedup model remains underneath toolbar, contextual, Content, Fill/CMS, Gallery, and browser surfaces
- `/qa/work/<projectId>` remains read-only real-project truth; creator controls such as Media and Insert are intentionally gated there
- `/builder/noauth` remains smoke-only and is used only for editable creator-surface smoke evidence

### Runner / Inspector QA evidence

- added deterministic Inspector recipe `field.media-toolbar` in loew-inspector commit `29dab1c`: first paint → Media open → Media close → Insert open
- added editable smoke evidence lane + screenshot artifact upload in loew-inspector commit `187d888` without weakening real `/qa/work`
- corrected evidence route classification to canonical `builder-smoke` in loew-inspector commit `6b03039`
- successful evidence run: `run_c39f49e9-f5bf-435b-a478-021b27bd4481`
- request: `field-media-toolbar-smoke-r2-20260929`
- tested field commit recorded by the run: `64888da072282562aefe7e1d2d8e38e77eb42861`
- all four deterministic steps passed: canvas first paint, toolbar Media open, toolbar Media close, Insert open
- screenshot artifact: GitHub Actions artifact `11064772560` from loew-inspector run `36636977872`
- evidence confirms toolbar Media opens/closes and Insert no longer exposes Media; this was smoke UI evidence, not real-project persistence evidence
- later field main advanced to `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`, so the interaction evidence is useful historical proof but is stale for exact-head claims under Runner QA law

### intentionally deferred / remaining

- immediate next task: run the required deterministic validation against the continuation branch/current head: `npm ci`, `npm run build:all`, `npm run test:run`, and `npm run lint`
- after deterministic validation, rerun the Media smoke recipe against the exact continuation-branch artifact/head if web-visible Media files changed since the prior evidence run
- visual judgment only after that: inspect the compact Media launcher for remaining density/translucency/heaviness; do not redesign architecture unless a real behavioral issue appears
- longer-term non-blocking Media architecture remains intentionally deferred: deterministic Code-mode binary ingest, persistent cross-session/public-source asset identity/materialization, real generated-Media provider, and the usage/provenance relationship graph
- do not reopen Preview/TLS work from this workstream

### resume contract

1. bootstrap from current Runner authority and fresh Git truth
2. checkout/target `field/media-system-architecture`
3. confirm its head against `main`; at this closeout both are `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`
4. run the full required validation suite before more Media implementation
5. if validation passes, perform exact-head Runner QA for the toolbar-owned Media flow only as needed
6. treat future Media provider/persistence/provenance work as separate follow-up tranches rather than silently broadening this closeout


## 2026-09-29 — field mobile Focus editor

- workstream: `field mobile Focus editor`; sole implementation worker, no delegated agents
- PR: https://github.com/lrnolivia/field/pull/123 (draft)
- branch: `field/mobile-focus-touch-camera-20260929`
- exact head: `0a4c2cef6ce9a76dcc9011466956266bd00feb73`; base main `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`
- implementation completion commit: `14c7a5e45498598bf234ddba15527833c537cbac`
- immutable smoke editor: https://4e5857c1.field-preview.loew.fi/builder/noauth
- matching Canvas: https://4e5857c1.canvas-preview.loew.fi/
- deployment: `4e5857c1-7ecc-4e78-96d2-77274283a51c`

### implemented

Shared editor models support one-finger selection/object drag/empty pan, second-finger cancellation and two-finger camera pan/pinch, deliberate long-hold marquee/context menu, portrait compact toolbar/sheets, landscape overlays, larger coarse-pointer transform targets, keyboard-aware geometry and text Done action. Mobile Focus is an ephemeral override; saved desktop workspace preference survives rotation and returning to desktop. Existing source, undo, selection, commands and text editor remain canonical.

### evidence and remaining gates

- Exact-head mobile CI https://github.com/lrnolivia/field/actions/runs/36648927955: npm ci, 27 focused tests, all three builds PASS. Rotation/desktop preference Chromium test PASS. Native camera test FAIL: expected +30px Y, observed -83.12px. Initial camera settling is a possible harness cause, not established; do not weaken assertion or claim gesture runtime verified.
- Exact Preview preflight https://github.com/lrnolivia/loew-inspector/actions/runs/36649066030 PASS: browser reaches /work/noauth and Canvas first paint succeeds against matching immutable origin; build endpoint reports exact head. HTTP smoke probe 404 and aborted asset requests are recorded in evidence, not concealed.
- Existing Media CI and Workers build/deployment PASS. Local npm 10.9.8 installation PASS after adding only a missing optional peer lock entry.
- Full tests/lint remain non-green; baseline lint has same 113 errors, and the text-focus-camera test failure also reproduces on untouched prior head. User confirms another worker owns shared checks; leave that repair scope to them.
- User is taking physical-phone validation. Required manual coverage: selection/drag/second-finger arbitration, pan/pinch, resize/rotate, long-hold gestures, panel mutual dismissal, portrait/landscape rotation, iOS software keyboard/Done/visibility, undo/save/reopen/source/Preview alignment.
- Keep PR draft until relevant runtime gates pass; do not mark all mobile validation complete. No deployment/routing/Access architecture changes were made.

### resume

Refresh main/branch/ownership first. Resume from the committed head above. Read updated PR for complete implementation scope. Investigate the failing native camera assertion before adding more product UI; separately record physical iOS results supplied by user. Preserve the exact-SHA/immutable-Preview evidence requirement and keep unrelated shared-check repair with its current owner.
