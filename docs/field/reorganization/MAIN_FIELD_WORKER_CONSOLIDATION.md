# field consolidation — direction for the existing main field worker

Status: PARTIALLY EXECUTED; source drafts preserved, required gates remain. Reorganization is NOT complete.

Read the latest [publication handoff](PUBLICATION_HANDOFF_20260930.md) and [execution checkpoint](EXECUTION_CHECKPOINT_20260930.md) first. Inventory figures and original observations below are historical; refresh live state before mutation.
User direction (2026-09-30): review the branches, preserve unfinished work, and culminate in direct instructions for the main field worker to consolidate it. Do not create additional workers. Do not delete branches merely because their code is already on main.

## Objective

Consolidate field's historical development into current architecture without losing useful code, acceptance criteria, unfinished QA, or product intent. The result must be usable current-main implementations and an explicit finish plan for remaining product work, not merely a smaller branch list.

Canonical target: `lrnolivia/field`.
Observed main: `0ea02501704e61d5133477d69fe677ad53295a56`.
132 actual remote branches, 19 open PRs. 70 non-main branches have no unique non-merge patch to recover: 52 heads reachable from main and 18 patch-equivalent. This does NOT mean those 70 workstreams are complete. 61 other non-main branches carry unique non-merge patches, including protected/control/proof work.
373 distinct unique non-merge commits are recorded in the machine ledger. Unique merge resolutions require separate accounting.

## Bootstrap and authority

Read current Runner `contracts/manifest.json`, `LOEW_CHAT_BIBLE.md`, `projects/field.json`, `assignments/field-repo-cleanup-reorg.json`, `docs/FIELD_REPOSITORY_REORGANIZATION.md`, this handoff, and `docs/field/reorganization/2026-09-30-inventory.json`.
Then read field's current `AGENTS.md`, product docs, applicable role contract, current ownership, fresh Git and exact checks. Re-read `reports/field.md` and `reports/field-product-architecture.md` as provenance, not live status.
Preserve Design / Content / Code / Preview, source-first behavior, Figma semantics, and first-divergence parity. Keep current main authoritative where older shell/Inspector work conflicts.
All new operational records go in Runner under `docs/field/`. Product specs remain authoritative in field and get Runner mirrors.
Historical `field/control` assignments contain unfinished scope and acceptance criteria; inspect them as evidence, never restore their old execution law.

## Deferred panel requirements added during execution

User direction on 2026-09-30: add instructions now; defer panel implementation. Read [Deferred connected panel requirements](DEFERRED_CONNECTED_PANEL_REQUIREMENTS_20260930.md) before Mobile/Workspace closeout. Landscape uses the connected desktop-style floating shell, portrait keeps sheets, the Inspector chrome includes its topmost controls, and Insert detail panels share their host's top/bottom/height. The existing Mobile owner retains the lane; this addendum does not launch work or authorize a new worker.

## Protected boundaries

- Mobile #123 / `field/mobile-focus-touch-camera-20260929` remains with its existing owner. Do not rename, close, rewrite, merge, or absorb it.
- Coordinate shared `useCanvasTransform`, Canvas, shell hosts, toolbar, selection and input boundaries with Mobile before integrating overlapping recovery.
- Runner/Inspector infrastructure remains with its existing owner. Request exact Preview/evidence from that lane; do not redesign its scheduler, auth, routes or resources.
- No direct field/main writes, force pushes, history rewrites, assertion weakening or bypassed gates.
- Retain `field/control` and `relay-write-proof` as excluded branches.
- Keep `field/` task prefixes until Runner and field tooling compatibility with domain prefixes is demonstrated. Ownership can be organized by Canvas/Workspace/Controls/Assets/Mobile without pretending prefix migration is already complete.

## Required accounting before cleanup

For every branch and every unique commit, record:
1. intended user behavior and acceptance criteria;
2. what current main actually implements;
3. source and test/QA deltas that remain useful;
4. whether the delta is integrated, superseded, recovered, or deliberately abandoned with a specific reason;
5. the destination PR/task and exact evidence;
6. remaining work and the owner.

Read unique merge-resolution diffs too: git cherry only compares non-merge patch IDs. A merged/equivalent commit proves code provenance, not product completion. A stale green check does not validate today's implementation.
Branch deletion comes LAST, after code AND unfinished intent/QA are accounted for. Keep the original branch until its replacement and evidence are durable.

## Consolidation sequence

### 1. Establish reliable validation and dependency baseline

Compare #132 and #129. Both contain the same nested `next-intl/node_modules/@swc/helpers@0.5.23` dependency object; the lock difference is formatting. #129 additionally switches Media CI to strict `npm ci`, adds package/lock triggers and cancellation. Preserve that CI intent in a focused follow-up rather than discarding it as a duplicate.
#132 exact head `03205f3ac490c99b109d3ad4eb5202e3f117bf7b` has a successful Workers Build. Earlier Node 22 install/build evidence exists, but test/lint failures remain separately recorded in Runner. Do not treat Cloudflare green as the entire project gate.
Reproduce the minimum needed failures on fresh main and the candidate. Classify dependency drift, product defect, stale assertion and harness failure separately. Identify the current shared-check owner before assuming its repair.
Required commands from registry: `npm ci`, `npm run build:all`, `npm run test:run`, `npm run lint`.
Do not create temporary validation workflows repeatedly or chase green through weakened checks. Persist baseline failures and exact candidate outcomes.

### 2. Recover Canvas correctness

**Frame/Group source:** `stage0/figma-frame-group-parity@a54e1f99782cff76b3ecdc65859de46866c3f827`.
Preserve default 100×100 click-created Frames, Space parenting bypass, Ctrl/Cmd+Alt+G Frame Selection and group/frame regression fixtures.
Outstanding defects from report: drag Frame creation produces no frame/source commit in mixed encapsulation; wrap-in-frame/layout moves a centered absolute SVG. Refresh and trace those first divergences; do not assume a diagnostics-only green workflow is a parity pass.
Gate: deterministic group/frame tests plus real Chromium frame-click, group/frame behavior, encapsulation and wrap geometry; then exact Preview/build and honest parity-doc updates.
Do not carry the temporary diagnostics-only workflow as permanent policy.

**Viewport/header source:** `field/viewport-header-lockstep@8fb0b68345a9ab9448fe1ca65e670871e07755b3`.
Preserve one authoritative camera transaction, rendered-geometry readiness and suppression of stale headers on file switches. Review the saved patches against current renderer and Mobile overlap.
Gate: focused camera/header tests; fresh load, file/page switch, slow/rapid pan, zoom, fit/recenter and pane resize on exact Preview. No orphan header or one-frame header/content divergence.
Both cumulative recoveries applied cleanly to main in this review's temporary checkout. That is merge applicability only: no validation, source publication or PR was performed. Reconstruct from the recorded source SHAs, not the disposable checkout.

**Other Canvas:** recover Scale #9 (SVG stroke/dash visual metrics); audit integrated selection/hierarchy/layers/text-selection/Group lifecycle, locate, camera restore and text-focus branches. Current reports explicitly leave Frame/Group and later snapping/layout/boolean stages unfinished. Keep those in the successor queue.

### 3. Recover Workspace and Dashboard work

**Left-panel #124:** recover shared `field-chrome.css`, Pages/Layers, Insert, Library/Presets, Locale, CMS, Branches, Vibe and panel primitives. Preserve current-main Float/Inspector bounds and shell semantics; do not overwrite them with #124's older fixes. Reconcile protected Mobile host overlap.
Update its stale baseline workflow to compare current main; perform the full left-panel matrix plus Inspector/Float non-regression against exact head.

**Dashboard #5, #8, #10, #11, #13, #14:** meaningful unmerged work exists, including absent delete dialog and test files. Audit and consolidate project menu/delete safeguards, rename focus/selection, new-project focus, sidebar semantics, collection count/card semantics and empty states. Compare current Dashboard before transplanting old components. Keep accessible keyboard and dialog behavior. Use focused PRs with current-main tests, then real-project QA where auth/persistence matters.

**Motion/glyph/loading/settings:** audit #73 projection/coalescing and motion-observatory primitives against integrated field.MOTION; review reduced motion, direct manipulation and entrance/exit behavior. Compare old explicit/semantic glyph branches to merged completion sweep before claiming every requested state is finished.
Review #38's native MeshGradient loader and logo against current loader lifecycle and current product direction; missing files are not proof that intent was abandoned. Preserve readiness and project isolation. Keep integrated settings/page-inspector/case/panel-width work in a closeout sweep instead of reimplementing it.
Avoid restoring old casing behavior from #74: main currently uses one preference and preserves authored labels when it is off. Salvage durable product-language intent, not a competing formatter.

### 4. Converge Controls

Compare #83 and its foundation/stroke/effects branches to today's effects grammar, current Inspector provenance/write targets and canonical PaintPicker. Preserve unique behavior and genuinely missing coverage; do not regress Fill into old options navigation.
#126 is likely superseded by merged #128, but verify the three differing paths and launch contracts before retirement.
Integrated PaintPicker/Fill/gradient/pattern/shader/page-color/library/OKLCH work needs exact-main closeout, not blanket completion.
Sweep Fill, Stroke, Text Color/gradient, Shadow, Text Shadow, SVG/vector/component colors, CMS, Selection Colors, preset editing, Pattern, Image, Video and Shader. Explicitly test nested picker launchers.
Preserve current one-picker and anchored-popover decisions. Queue Libraries semantics, normalized PaintLayer/multi-fill, Shader lifecycle and pattern/source reconciliation as separate architecture work after Stage 0. Do not silently expand this consolidation into those features.

### 5. Close out Assets and protected Mobile integration

Media architecture and Gallery continuation code are largely on main; their reports still require current deterministic checks and exact-head toolbar/Insert/contextual placement QA. Verify project ownership across async upload, replacement versus insert, structural-container placement, Gallery wizard continuation, queue retry/cancel and dedup.
Preserve toolbar-only Media, shared catalog/ingest and Gallery as composition intent. Defer providers/persistence/provenance expansion as already decided.
Mobile continues with its owner. The reported native camera assertion and physical iOS selection/drag/pinch/rotation/keyboard/Done/save/reopen gates must be resolved there; old smoke evidence does not prove final phone behavior.

### 6. Only then finish repository cleanup and record completion

Close or delete only after the accounting above proves where code, intent and remaining QA live. A branch with integrated code may be retired AFTER its remaining work is transferred into a canonical current task; until then retain it.
Normalize ownership and branch policy only after workflow compatibility verification.
Persist final branch/PR ledger, commit disposition, exact merged evidence, remaining tasks, owner and ordered Stage 0 queue in Runner.
Mark `field-repo-cleanup-reorg-20260929` complete only when its actual acceptance criteria are met. Do not mark it done because the inventory or this handoff is done.

## Open PR direction

| PR | Disposition | Required next action |
|---|---|---|
| [#132](https://github.com/lrnolivia/field/pull/132) | VERIFY / LAND FIRST | One-file lock repair; exact-head Cloudflare passed. Install/build historical evidence exists; full required test/lint gates are not cleared. |
| [#129](https://github.com/lrnolivia/field/pull/129) | COMPARE / SALVAGE CI INTENT | Same nested helper entry as #132 apart from formatting; adds strict npm ci, dependency path triggers, and cancellation. Do not discard the CI improvements as duplicate lock work. |
| [#126](https://github.com/lrnolivia/field/pull/126) | LIKELY SUPERSEDED — VERIFY FIRST | Later merged #128 has compact picker plus nested launcher fix. Ten changed-path blobs match current main; three differ. Verify remaining contracts before closure. |
| [#124](https://github.com/lrnolivia/field/pull/124) | RECOVER LEFT-PANEL WORK | Preserve new shared CSS and panel work; reconcile against current main Float/Inspector and protected Mobile overlap. Current-main shell behavior wins. |
| [#123](https://github.com/lrnolivia/field/pull/123) | KEEP ACTIVE — PROTECTED | Existing Mobile owner; no rename, closure, branch rewrite or takeover. Camera test and physical-phone gates remain with that owner. |
| [#92](https://github.com/lrnolivia/field/pull/92) | LIKELY SUPERSEDED QA MARKER | Diff is a temporary QA doc and source-touch comment. Current main uses shared Preview URL helper. Verify immutable host behavior with infrastructure owner, not a routing rewrite. |
| [#83](https://github.com/lrnolivia/field/pull/83) | AUDIT CONTROLS COVERAGE | Current main has newer effects grammar and canonical PaintPicker. Compare remaining semantics and tests; preserve any real gap before closure. |
| [#74](https://github.com/lrnolivia/field/pull/74) | AUDIT PRODUCT-LANGUAGE INTENT | Old Brand casing reconstructs sentence case; main's newer single boolean preserves authored text when off. Preserve durable docs, not the older competing formatter. |
| [#73](https://github.com/lrnolivia/field/pull/73) | RECOVER USEFUL MOTION PRIMITIVES | field.MOTION is partly integrated; quality branch has unique projection/coalescing/motion observatory changes. Review shared shell overlap and reduced-motion behavior. |
| [#38](https://github.com/lrnolivia/field/pull/38) | REVIEW LOADER DECISION / COVERAGE | Native-mesh loader and asset are absent on current main; do not assume old desired visuals are obsolete. Compare newer loading lifecycle and product decisions before salvage or retirement. |
| [#28](https://github.com/lrnolivia/field/pull/28) | PRESERVE CONTROL HISTORY / RECONCILE | Historical repair ledger and control metadata; compare Runner canonical records, preserve history, do not merge field/control into main. |
| [#27](https://github.com/lrnolivia/field/pull/27) | REVIEW AS SUPERSEDED EXECUTION LAW | Old main-canonical handoff kit conflicts with Runner-first authority. Preserve only useful tooling coverage; never resurrect its local authority. |
| [#14](https://github.com/lrnolivia/field/pull/14) | RECOVER DASHBOARD EMPTY STATES | Unique source/test delta absent from main; review meaningful collection-empty versus no-project messaging and coverage. |
| [#13](https://github.com/lrnolivia/field/pull/13) | RECOVER DASHBOARD COLLECTION SEMANTICS | Unique count labels, grid/card semantics and coverage; tests absent on main. |
| [#11](https://github.com/lrnolivia/field/pull/11) | RECOVER DASHBOARD NAVIGATION | Unique sidebar semantics/coverage absent from main; preserve keyboard/current-state behavior. |
| [#10](https://github.com/lrnolivia/field/pull/10) | RECOVER NEW-PROJECT FOCUS | Unique wizard focus implementation/test coverage; reconcile current wizard. |
| [#9](https://github.com/lrnolivia/field/pull/9) | RECOVER / VERIFY SCALE CORRECTNESS | Unique SVG stroke/dash visual-metric persistence and tests; previous runtime-closeout record is not current pass. |
| [#8](https://github.com/lrnolivia/field/pull/8) | RECOVER RENAME HARDENING | Unique rename focus/selection and tests; reconcile current dialogs rather than copying outdated UI. |
| [#5](https://github.com/lrnolivia/field/pull/5) | RECOVER PROJECT ACTIONS | Delete dialog and interaction tests absent from main; compare current delete/menu flow and preserve accessibility and destructive-action safeguards. |

## Complete branch index

A/B = commits ahead of / behind observed main. Unique = git-cherry non-equivalent non-merge commits, NOT a count of unfinished product features. Exact unique SHAs and patch-equivalent SHAs are in the linked JSON ledger.

| Branch | Work area | A/B | Unique | Review state |
|---|---|---:|---:|---|
| `codex/field-chrome-batch-1` | workspace | 2/228 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `codex/field-chrome-batch-2` | workspace | 6/228 | 5 | QUARANTINE — SEMANTIC REVIEW |
| `codex/field-chrome-batch-3` | workspace | 8/228 | 6 | QUARANTINE — SEMANTIC REVIEW |
| `codex/field-chrome-batch-4` | workspace | 13/226 | 9 | QUARANTINE — SEMANTIC REVIEW |
| `codex/final-toolbar-media-consolidation-20260929` | workspace | 0/11 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/functional-effect-previews-20260929` | workspace | 0/86 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/general-settings-depth-20260929` | workspace | 0/190 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/general-settings-tabs-20260929` | workspace | 0/122 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/lowercase-headings-toggle-20260929` | workspace | 0/200 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/media-visual-polish-20260929` | assets | 0/117 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/panel-width-presets-lock-20260929` | workspace | 0/112 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/popup-tabs-media-polish-20260929` | workspace | 0/104 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/settings-architecture-20260928` | workspace | 0/218 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/settings-preview-visual-refresh-20260929` | workspace | 0/129 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/settings-surface-split-20260929` | workspace | 0/197 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/settings-visual-polish-20260929` | workspace | 0/213 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/sleep-batch-toolbar-media-effects-20260929` | controls | 0/15 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/toolbar-media-card-style-20260929` | workspace | 0/4 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/toolbar-media-final-pass-20260929` | workspace | 3/50 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `codex/ui-heading-case-20260929` | workspace | 0/204 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `codex/universal-tabs-media-padding-rotate-fix-20260929` | workspace | 0/97 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `docs/product-language` | workspace | 1/211 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `feat/fill-page-colors-batch-8` | controls | 0/125 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `feat/fill-picker-shell-batch-1` | controls | 0/184 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `feat/fill-shell-hardening-batch-5` | controls | 0/151 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `feat/gradient-libraries-batch-6` | controls | 0/133 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `feat/native-pattern-fill-batch-2` | controls | 0/173 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `feat/oklch-color-mode-batch-9` | controls | 1/121 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `feat/pattern-media-source-batch-7` | controls | 0/131 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `feat/pattern-monster-library-batch-3` | controls | 0/169 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `feat/shader-fill-batch-4` | controls | 0/164 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `feat/universal-paint-picker-20260929` | controls | 14/70 | 14 | QUARANTINE — SEMANTIC REVIEW |
| `field/about-build-info` | workspace | 3/224 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `field/brand-casing-final` | workspace | 4/192 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `field/browser-preview-qa-canonical` | coordination / infrastructure | 0/365 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/canonical-collapse-state` | workspace | 1/234 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/canonical-docked-wrappers` | workspace | 1/232 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/chrome-global-utilities` | workspace | 2/225 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/ci-lockfile-repair` | maintenance | 1/1 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `field/control` | coordination / infrastructure | 124/385 | 122 | KEEP EXCLUDED |
| `field/dashboard-collection-semantics` | workspace | 4/358 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/dashboard-editor-left-rail-handoff` | coordination / infrastructure | 0/301 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/dashboard-empty-state-semantics` | workspace | 3/358 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `field/dashboard-interaction-polish` | workspace | 3/358 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `field/dashboard-manual-refresh` | workspace | 2/227 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/dashboard-new-project-focus-flow` | workspace | 4/358 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/dashboard-open-thumbnails` | workspace | 1/229 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/dashboard-rename-dialog-hardening` | workspace | 5/358 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `field/dashboard-sidebar-navigation-semantics` | workspace | 3/358 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `field/editor-chrome-media-effects-continuation-20260929` | controls | 0/1 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/field-branch-preview-live-qa` | coordination / infrastructure | 0/368 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/field-glyph-completion-sweep` | workspace | 0/266 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/field-glyph-explicit-coverage` | workspace | 2/265 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/field-glyph-semantic-states` | workspace | 3/272 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `field/field-glyph-system` | workspace | 0/280 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/field-glyph-test-path` | workspace | 0/264 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/field-motion-quality` | workspace | 9/192 | 7 | QUARANTINE — SEMANTIC REVIEW |
| `field/field-motion-semantic-controls` | coordination / infrastructure | 0/340 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/field-preview-canvas-host-routing` | coordination / infrastructure | 4/359 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `field/field-root-instruction-cleanup` | coordination / infrastructure | 0/376 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/field-worker-coordination-v2` | coordination / infrastructure | 8/384 | 7 | QUARANTINE — SEMANTIC REVIEW |
| `field/figui3-canvas-inspector-recovery-20260927` | workspace | 0/367 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/fix-left-rail-floating` | workspace | 4/196 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `field/fix-lockfile-swc-helper` | maintenance | 4/0 | 4 | QUARANTINE — SEMANTIC REVIEW |
| `field/focus-camera-hardening` | canvas | 0/207 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/focus-camera-text-session` | canvas | 7/220 | 4 | QUARANTINE — SEMANTIC REVIEW |
| `field/frame-hug-autolayout-padding` | canvas | 1/230 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/handoff-kit-canonical-source` | coordination / infrastructure | 1/339 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `field/inspector-autohide-arrow-layout` | workspace | 2/241 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/inspector-controls-zoom` | coordination / infrastructure | 1/235 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/inspector-pane-motion` | workspace | 1/221 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/inspector-provenance-write-targets` | controls | 10/358 | 10 | QUARANTINE — SEMANTIC REVIEW |
| `field/inspector-system-visual-qa` | workspace | 0/1 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/interrupted-ready-batch` | workspace | 1/243 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/layout-pill-identity` | workspace | 1/235 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/left-panel-inspector-parity-20260929` | workspace | 18/38 | 17 | QUARANTINE — SEMANTIC REVIEW |
| `field/main-menu-natural-height` | workspace | 1/222 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/media-system-architecture` | assets | 0/1 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/media-system-foundation` | assets | 29/221 | 29 | QUARANTINE — SEMANTIC REVIEW |
| `field/mobile-docs-qa-20260929` | mobile | 1/1 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `field/mobile-focus-touch-camera-20260929` | mobile | 13/1 | 10 | KEEP ACTIVE |
| `field/native-gallery-qol-creation-flow` | assets | 0/306 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/native-group-lifecycle-integrity` | canvas | 6/339 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `field/native-scale-visual-metrics-repair` | canvas | 4/358 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/night-shift-blocker-repair-policy` | coordination / infrastructure | 0/381 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/options-panel-effects` | controls | 6/192 | 5 | QUARANTINE — SEMANTIC REVIEW |
| `field/options-panel-effects-v2` | controls | 2/186 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `field/options-panel-effects-v3` | controls | 3/174 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/options-panel-finish` | controls | 1/172 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/options-panel-foundation` | controls | 5/187 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `field/options-panel-stroke` | controls | 3/192 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `field/options-panel-stroke-v2` | controls | 1/186 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/pane-control-polish` | coordination / infrastructure | 1/223 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/product-language-rebase` | workspace | 0/177 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/product-language-sweep` | workspace | 13/203 | 12 | QUARANTINE — SEMANTIC REVIEW |
| `field/project-loading-veil` | workspace | 0/298 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/project-loading-veil-dark-mark` | workspace | 0/292 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/project-loading-veil-figma-match` | workspace | 0/293 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/project-loading-veil-native-mesh` | workspace | 22/263 | 21 | QUARANTINE — SEMANTIC REVIEW |
| `field/project-switch-isolation` | workspace | 3/228 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/selection-color-camera-restore` | canvas | 1/242 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/shared-repair-ledger` | coordination / infrastructure | 82/385 | 81 | QUARANTINE — SEMANTIC REVIEW |
| `field/text-hover-glyph-shine` | canvas | 1/232 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/toolbar-glyph-stage-fix` | workspace | 1/273 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `field/universal-paint-picker-continuation-20260929` | controls | 0/1 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/universal-runner-authority` | coordination / infrastructure | 2/337 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `field/viewport-header-lockstep` | canvas | 4/68 | 4 | QUARANTINE — SEMANTIC REVIEW |
| `field/visual-hierarchy-pass` | workspace | 1/215 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `field/workspace-layout-names` | workspace | 2/220 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `figui3-locate-padding-inspector-pass` | workspace | 0/292 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `figui3-selection-inspector-canvas-readiness` | canvas | 10/367 | 10 | QUARANTINE — SEMANTIC REVIEW |
| `figui3-toolbar-locate-pass` | workspace | 3/296 | 3 | QUARANTINE — SEMANTIC REVIEW |
| `fix/compact-paint-picker-20260929` | controls | 1/6 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `fix/compact-paint-picker-v2-20260929` | controls | 1/6 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `fix/compact-paint-picker-v3-20260929` | controls | 8/6 | 8 | QUARANTINE — SEMANTIC REVIEW |
| `fix/real-project-qa-access` | coordination / infrastructure | 1/168 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `fix/selection-color-locate-keyline` | canvas | 4/300 | 4 | QUARANTINE — SEMANTIC REVIEW |
| `fix/selection-color-painted-geometry` | controls | 4/339 | 4 | QUARANTINE — SEMANTIC REVIEW |
| `fix/selection-color-three-layer-glow` | canvas | 1/297 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `main` | integration | 0/0 | 0 | KEEP MAIN |
| `qa/frame-group-baseline` | canvas | 1/50 | 1 | QUARANTINE — SEMANTIC REVIEW |
| `qa/preview-host-fix` | coordination / infrastructure | 2/165 | 2 | QUARANTINE — SEMANTIC REVIEW |
| `relay-write-proof` | coordination / infrastructure | 1/393 | 1 | KEEP EXCLUDED |
| `stage0/canvas-preview-parity-closeout` | canvas | 0/135 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `stage0/figma-frame-group-parity` | canvas | 4/50 | 4 | QUARANTINE — SEMANTIC REVIEW |
| `stage0/figma-hierarchy-parity` | canvas | 0/52 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `stage0/figma-selection-parity` | canvas | 0/75 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `stage0/geometry-inspector-consolidation` | controls | 0/193 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `stage0/layers-lock-selection-closeout` | canvas | 0/188 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `stage0/preview-runtime-url-single-source` | workspace | 0/96 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `stage0/text-edit-inspector-selection` | canvas | 0/154 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |
| `worker/figui3-selection-locate-skeleton` | canvas | 1/362 | 0 | INTEGRATED / PATCH-EQUIVALENT — COMPLETION REVIEW REQUIRED |

## Evidence and limits of this review

- Full remote clone and API pagination covered all 132 actual heads; 19 open PRs and 96 closed PRs were read (86 merged).
- Every branch has ahead/behind and non-merge patch accounting. Unique source branches additionally received cumulative path/blob comparison.
- Current Runner authority, assignment, registry, reports and historical control assignment metadata were read.
- Both Canvas recovery patches applied without conflicts against observed main in isolated temporary worktrees; they were not tested or published.
- #132's final-head Cloudflare build is verified successful.
- No field source changes, PR closures, merges, remote branch deletions or worker creations were performed.
- Historical runtime claims are retained as provenance. This review did not run fresh full test/lint/runtime QA or resolve every semantic delta; those are the worker's execution work.
- User explicitly requires preservation and review before cleanup.

## Startup prompt for the existing main worker

Continue the field consolidation assignment from live Runner and Git state. Read this document and the complete inventory JSON, then refresh main, all PRs and protected ownership. Review every branch's intended work and unfinished QA, including branches whose code is already integrated. Preserve Mobile and Runner/Inspector ownership. Consolidate useful stranded changes into focused current-main task PRs, beginning with the dependency/validation baseline and Canvas correctness; recover Dashboard and left-panel work next. Do not delete any original branch or close a PR until code, product intent and remaining QA are accounted for with a durable destination. Keep exact-SHA validation and Preview gates, avoid temporary harness loops, and persist a final ledger plus unfinished Stage 0 queue in Runner. Use the existing worker; do not create new workers.
