# field product architecture — status report

**Chat identity:** field product architecture  
**Status date:** 2026-09-29  
**Primary project:** `lrnolivia/field`

No explicit user-visible chat title is available in the current execution context, so this report uses **field product architecture**: the primary role of this chat, rather than the name of the latest small repair.

## Primary role

This chat is the loew.fi **field companion** for product planning, architecture, research, naming, decision-making, documentation, implementation review, and execution handoff.

Its primary job is to keep field coherent as it evolves into a Figma-class visual web design environment where **the design is the real website**.

The continuing product responsibilities are:

- preserve the Design / Content / Code / Preview model
- keep source first-class and Preview as runtime truth
- reduce divergence among design graph, canvas, generated source, Preview, and production
- prefer explicit deterministic document/canvas architecture over AI guesses
- preserve semantic Figma concepts such as frames, Auto Layout, components, instances, variants, variables, typography, assets, prototype relationships, and source identity
- maintain compact professional Figma UI3-class interaction and chrome quality
- review implementation work for architecture drift, parity regressions, and product coherence
- turn product decisions into bounded acceptance criteria and implementation handoffs without confusing intent with verified implementation state

## Current bounded implementation work

A viewport-header/canvas synchronization repair was started in `lrnolivia/field`.

Working branch:

`field/viewport-header-lockstep`

Current saved branch head:

`8fb0b68345a9ab9448fe1ca65e670871e07755b3`

Current `field/main` at status refresh:

`64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`

Current relation to main:

- 4 commits ahead
- 67 commits behind
- merge base: `8e863660d290418c62de67f567296cea3456ae2e`
- no PR opened
- not shipped
- deterministic validation and runtime QA have not been run on the saved WIP head

## Saved branch work

The branch now contains **all code that had been prepared before the user stopped the implementation**, so a future run can resume from repository state instead of reconstructing uncommitted sandbox edits.

### Existing commits

`0bee1d438102ccbc1ef5ae225ea266165370a221` — `test: cover viewport header lockstep`

- adds `src/canvas-sandbox/bridge-sandbox-camera.test.ts`
- records the intended invariant that the sandbox must not add an unnecessary second camera RAF after the parent camera transaction

`90ea5f6f5c7658d654b432d787c5e9a83691104c` — `test: cover viewport header lockstep`

- adds `src/canvas/ViewportHeaderManager.test.ts`
- records intended rendered-geometry/readiness behavior
- records that header chrome and sandbox camera movement should use one camera transaction rather than independent visual clocks

`11d5eda2b0c22f43f45ea3ad05b6e01114473822` — `fix: keep viewport header on sandbox camera transaction`

- modifies `src/canvas/hooks/useCanvasTransform.ts`
- removes the visible viewport-header overlay from the independent TransformManager element flush
- forwards one authoritative camera sample to the sandbox and then applies that same transaction to the parent viewport-header overlay
- targets the observed symptom where the viewport visually slides behind its own header during pan/zoom

### WIP checkpoint added before this report

`8fb0b68345a9ab9448fe1ca65e670871e07755b3` — `wip: checkpoint viewport header readiness repair`

This commit preserves the three source edits that had been prepared but were not yet committed when the assignment was stopped:

- `src/canvas/ViewportHeaderManager.ts`
  - removes config-only viewport-header fallback while rendered iframe geometry is absent
  - intended to prevent an orphan `Desktop 1440` header from appearing before the actual viewport on fresh load/file switch

- `src/canvas/hooks/useRendererSync.ts`
  - gates viewport-header creation on actual sandbox/render-complete readiness
  - requires a new render tick after an active-file switch before header chrome is recreated
  - intended to prevent stale or early header flashes

- `src/canvas-sandbox/bridge-sandbox.ts`
  - removes the sandbox-side second RAF from raw camera transport
  - applies the already-parent-RAF-batched camera sample directly in the sandbox
  - intended to eliminate the guaranteed one-frame visual lead of parent chrome over iframe content

The checkpoint from `11d5eda` to `8fb0b68` changes only those three intended source paths.

## Important implementation state

This WIP was preserved **exactly so it can be resumed**, not because it is merge-ready.

Main advanced substantially while the work was paused. The branch is currently 67 commits behind `main`, so the saved code must be reconciled against current repository truth before further implementation or promotion.

Do **not** blindly treat the old diagnosis or WIP code as current architecture truth after rebasing. Re-read the current canvas/camera/render lifecycle first and preserve the invariant only where the present implementation still supports the same root cause.

## Next safe action

1. Refresh the branch against current `field/main` without discarding the four saved WIP commits.
2. Re-read the current versions of:
   - `src/canvas/ViewportHeaderManager.ts`
   - `src/canvas/hooks/useCanvasTransform.ts`
   - `src/canvas/hooks/useRendererSync.ts`
   - `src/canvas-sandbox/bridge-sandbox.ts`
3. Reconcile the saved implementation with the 67 intervening main commits.
4. Re-test the root invariant: viewport header and rendered viewport must consume one authoritative camera state and one rendered-readiness lifecycle.
5. Run focused regression tests, TypeScript validation, and full build.
6. Open a draft PR only after the reconciled branch is coherent.
7. Perform exact-head branch Preview QA for:
   - fresh load
   - file/page switch
   - slow pan
   - rapid pan
   - zoom
   - fit/recenter
   - left/right pane changes that alter camera/available canvas space
8. Merge only after deterministic checks and runtime QA prove the behavior.

## Current classification

**IN PROGRESS — FULL WIP CHECKPOINT SAVED — STALE AGAINST MAIN**

The working branch now contains the implementation and regression code required to resume exactly where this chat stopped. Nothing in this report should be read as a claim that the repair is validated, merged, deployed, or shipped.
