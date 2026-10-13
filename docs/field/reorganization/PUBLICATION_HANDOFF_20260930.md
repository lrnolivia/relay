## Verified promotion — 2026-09-30 10:14 UTC

PR #135 merged as `854038a3e84f41cd590a4ad18b24fcd4127e2fba` after Registry and exact-head deployed Preview QA passed. Production `/api/build` reports this merge and deployment `2ae1aa2f-dbc1-4aed-b883-0951c9da32af`. [Current receipt](CANVAS_PROMOTION_RECEIPT_20260930.md) supersedes older pending/Preview-blocked statements below. Relay Worker fetch 1053 is a transport-path limitation; direct HTTP and GitHub Chromium passed on exact Preview deployment `6255045b…`. No DNS, domain, Access or product routing change was needed. Preserve original branches, Mobile and deferred-panel scope. Next: complete Canvas claim/shared-file return, then serially admit preserved Dashboard work against fresh main.

# Consolidation publication handoff — 2026-09-30

## Live continuation update — 2026-09-30 09:44 UTC

This section supersedes the older head/validation statements below while preserving them as historical publication context.

- Field PR #135 remains a draft on `field/consolidation-canvas-20260930`; current head is `57f4765b591286c6c456439ba217d8de282c38c9`, base remains `760774a6bd628827f93190fb0abaf7a6e26acbea`, and GitHub reports it mergeable/clean.
- Diagnostic head `eff4047b82a8185ba67530fd25f2572da36e1096` added logging only to expose the Registry baseline delta. Registry run `36694828578`, job `109820178700`, completed with 57 branch failures versus 61 exact-main failures. **Branch-only failures: none.** The four baseline-only failures are:
  - `src/canvas/gallery/crop-math.test.ts` — actual cover overflow calculation.
  - `src/canvas/transform/CameraAnimator.test.ts` — OS reduced-motion preference detection.
  - `src/canvas/transform/CameraAnimator.test.ts` — reduced-motion focus snaps to the exact target.
  - `src/editor/workspace-layout.test.ts` — viewport padding remains a hard drag margin instead of an edge-dock trigger.
- Because #135 introduces no branch-only failures and improves four exact-main failures, head `57f4765b591286c6c456439ba217d8de282c38c9` changes the Registry comparator to reject **branch regressions** while allowing baseline-only improvements. It does not weaken product assertions or excuse new failures.
- On current head, Runner admission, Media/editor verification and Cloudflare Workers build are green. Registry rerun `36697728462`, job `109829617442`, is the current decision gate and was still in progress when this handoff was written.
- Exact loew Preview custom hosts remain a separate infrastructure blocker: Relay captured the exact Preview failure as `vis_ec1567cf-2eab-4779-997c-ee641fb2ef9d` (Cloudflare 1053/Page not found), while the same saved Group QA project rendered through production control evidence `vis_5f651b2a-7b7a-4016-8f35-c89d4a83bbb0`; the exact `workers.dev` deployment also rendered read-only Group QA. Do not classify the custom-host failure as a Field product regression without contrary evidence.
- Next action: let the current Registry rerun resolve. If green, keep #135 as the source candidate and proceed to exact-head deployed Preview QA once the Preview host path is usable. Do not repair the four baseline-only failures as #135 regressions, and do not merge until the required Registry gate plus exact-head Preview QA are both clear.


Latest user direction: “push and merge what's safe and make sure the next chats know what is coming.” This authorizes publication of preserved drafts and safe coordination records. It does not resume the deferred connected-panel implementation. Consolidation remains unfinished; no original branch was deleted or original PR retired.

## Published source and merge boundary

[Field draft #135](https://github.com/lrnolivia/field/pull/135), branch `field/consolidation-canvas-20260930`, exact head `77e81482897d6530989882c6df18669d5e4cfde4`, current-main base `760774a6bd628827f93190fb0abaf7a6e26acbea`. Contains 108 changed files: recovered Frame click defaults/Space behavior/Frame Selection shortcut, native Group drag refitting, browser regression coverage, and shared test/lint repairs. Group children now avoid automatic percent pins while Frame auto-pinning and authored pins remain preserved. The earlier reported ~78.95px untouched-child failure was superseded by first-divergence investigation: the Group wrapper did not refit around the moved child. The sibling remained stationary; do not repeat the old interpretation as current evidence.

Exact-head local results: all three production builds pass using installed baseline dependencies; ten desktop Chromium tests pass (35.7s); full suite has 35 failing files/57 failing tests, 948 passing files/13,143 passing tests, no unhandled errors; lint has five errors/3,008 warnings. These mouse/keyboard tests do not prove touch or physical iOS behavior. Clean install fails because the nested next-intl SWC helper lock entry is missing. Exact-head deployed Preview QA has not passed. [Machine evidence and all 57 failure names](PUBLICATION_EVIDENCE_20260930.json) record the remaining work, plus hashes of local logs under `/tmp/field-consolidation-20260930`.

[Field draft #133](https://github.com/lrnolivia/field/pull/133), head `cc38e107fedd1b33088bf64dd6534f6d3d97965f`, preserves the missing lock entry and strict Media CI recovery. Its clean install, production builds, exact-head Media CI and Workers build passed, but its historical full suite/lint remain red. #135 was rebased onto current main, so it does **not** contain #133's lock/workflow changes. Reconcile the prerequisite explicitly before promotion.

On #135, exact-head Runner admission and Media CI passed (runs `36676290128` / `36676290043`); Workers build `cfba7cd3-f214-48dc-a225-2a701f8e8532` passed. This confirms publication checks, not full validation or deployed interaction QA.

Neither source PR is merge-ready. Registry-required `npm ci`, `build:all`, `test:run`, `lint`, and applicable exact-head Preview QA must all clear. Runner admission is an additional ownership check, not a replacement. Do not mark drafts ready, enable automatic merge, weaken assertions, or treat every remaining failure as stale/Mobile-owned.

## Ownership and serial next actions

Runner claim `field-consolidation-canvas-20260930`, owner `01a0f0ae-4e8c-7e62-ae7a-3b02faa398f5`, covers the published batch. Publication preflight passed with no findings. It will be held at this publication checkpoint. Before edits, refresh live Runner authority, field/main, claim state and exact PR heads. Another owner must use the atomic handoff/admission protocol; notice delivery alone does not transfer ownership. One active branch per owner, four active-task budget; do not create competing continuation branches.

1. Coordinate serial ownership of `package-lock.json`, `src/canvas/mouse/CanvasMouseController.ts`, and `src/canvas/transform/CameraCommands.ts` with existing Mobile. [Reserved validation patch](recovery/reserved-shared-validation-NOT-APPLIED.patch) is a concrete, **unapplied** proposal: remove one unused import, change four unmodified lets to const, and recover the nested SWC entry. Review against live heads. It is not permission to edit reserved files and does not include #133's CI workflow changes.
2. Classify and repair the 57 remaining failures, preserving current product behavior and meaningful acceptance criteria. Harness/contract failures and actual behavior failures require separate evidence. Run proportionate focused checks, then final required gates once the candidate is coherent.
3. Obtain exact-head deployed Preview QA through the existing Runner/Inspector lane, following `docs/field/qa/BROWSER_PREVIEW_QA_PROTOCOL.md`: `/qa/work` with a saved real project and read-only inspection. `/builder/noauth` is smoke only; local fixture passes are not deployment proof.
4. Merge source only when all gates clear. Then serially admit Workspace/Dashboard, followed by the original ordered left-panel, Controls and Assets closeout. Retain originals until useful code, unfinished intent, acceptance and unique merge resolutions have durable destinations.

## Dashboard work preserved without publishing an unadmitted branch

[Dashboard recovery patch](recovery/dashboard-unpublished-20260930.patch) contains the complete tracked delta and all five untracked test files from `/private/tmp/field-consolidation-dashboard-20260930`, branch `field/consolidation-workspace-20260930`, base `cc38e107fedd1b33088bf64dd6534f6d3d97965f`. The source worktree remains unchanged. Patch hashes are in the machine evidence. Reconcile against current main before application; do not apply blindly.

Recovered deletion confirmation/menu dismissal, rename handling, collection/navigation accessibility and empty-state coverage from #5/#8/#10/#11/#13/#14. Current main's immediate create/refresh/thumbnail behavior is preserved. Wizard focus code remains dormant and must not be called shipped UX. Historical focused validation: 36 tests pass across nine files; the broader sweep retains the placeholder-structure assertion failure. Authenticated persistence and exact Preview QA remain pending. This lane has no active admission and no source PR; admit it serially after the current lane or transfer ownership through Runner.

## Protected Mobile and deferred panel requirements

Existing Mobile PR #123 and claim `field-mobile-focus` remain protected. The Mobile worktree `/private/tmp/field-consolidation-mobile-20260930` is clean at `0a4c2cef6ce9a76dcc9011466956266bd00feb73`; experimental panel edits were withdrawn. Historical native camera expectation +30 versus observed -83.12 remains unresolved; actual touch/device QA is needed. Do not describe desktop Chromium passes as Mobile acceptance.

[Deferred connected-panel requirements](DEFERRED_CONNECTED_PANEL_REQUIREMENTS_20260930.md) remain instructions only. Mobile landscape must use the desktop-style floating panels connected to the chrome as one coherent geometry; portrait keeps slide-in cards. Inspector chrome must include its topmost controls, and Insert detail panels must share their host's top/bottom/height through touch resizing and rotation. Likely causes are documented there; no panel repair was committed, pushed or deployed by this consolidation.

## Successor notices

Send this merged packet and #135/#133 to the existing “Branch · Field Status Update”, “Branch · Mobile / Focus Editing”, and “Review recent project changes” chats. These are intake notices for the next authorized run, not new implementation requests, new workers, or ownership transfers. Mobile receives the explicit reserved-file/deferred-panel boundary. Field receives the ordered validation → Preview → merge → Dashboard → remaining ledger closeout sequence. The coordination reviewer receives the claim/branch/gate boundary.
