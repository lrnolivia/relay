# field repository cleanup + reorganization

Status: READY FOR EXECUTION  
Control authority: `lrnolivia/loew-runner@main`  
Target repository: `lrnolivia/field`

## Purpose

field grew through many parallel chats and temporary implementation tracks. That produced useful product progress, but repository topology now mirrors historical chat activity instead of durable architecture: many overlapping branches, sequential batch/final/fix branches, stale draft PRs, superseded implementations, and ownership that crosses the same primitives.

This migration converts field to a cleaner operating model:

- `main` is integration truth
- durable first-class workers own architectural domains
- task branches are short-lived and deleted after promotion
- loew-runner owns coordination/state/resource policy
- loew-inspector owns deterministic visual/runtime evidence
- the field Master reconciles unavoidable cross-domain overlap
- historical branches/PRs are evidence, not permanent organizational units

This document is the human-readable plan. The executable assignment is `assignments/field-repo-cleanup-reorg.json`.

## Non-negotiable safety rule

Do not delete, close, rewrite, or discard a branch/PR until every commit unique to it is accounted for as one of:

1. already represented on current `main`
2. intentionally superseded by a newer implementation
3. transplanted/reimplemented on a fresh domain branch
4. deliberately abandoned with a recorded reason

Refresh live Git/Runner state before every destructive action. Historical report SHAs and classifications are starting evidence only.

## Protected active work

Two lanes remain actively owned elsewhere and are not reassigned by this cleanup:

### Mobile Focus

The existing Mobile worker keeps its mission and current active PR/branch. Do not rename, transplant, close, or rewrite its active work merely to fit the new naming model. Future Mobile branches may use the new `mobile/` domain once the current PR finishes.

### Runner + Inspector infrastructure

The existing Runner/Inspector agent owns capacity/resource scheduling, failure classification, retry/defer policy, evidence deduplication, Browser Run/GitHub Chromium routing, and Inspector evidence execution.

The field cleanup worker consumes that infrastructure. It does not duplicate or absorb it.

## Target durable ownership

### Canvas & Interaction

Owns:
- desktop canvas engine
- selection and hierarchy interaction
- frame/group behavior
- drag/resize
- snapping/guides
- camera/transform
- viewport geometry and render synchronization
- first-divergence Canvas correctness

Does not own:
- mobile gesture policy
- editor chrome
- Inspector property UI

Target task prefix: `canvas/`

### Workspace Shell

Owns:
- rails
- docked/floating pane shells
- toolbar hosts
- panel shells
- menu surfaces
- shared chrome primitives
- pane collapse/reopen
- workspace motion/density

Does not own:
- Media behavior
- paint semantics
- canvas interaction logic

Target task prefix: `workspace/`

### Inspector & Design Controls

Owns:
- Inspector property categories
- Fill/Stroke
- PaintPicker
- Effects
- typography controls
- advanced/options surfaces
- component property controls

Does not own:
- outer workspace shell geometry
- Media ingest/lifecycle
- canvas camera

Target task prefix: `controls/`

### Assets & Media

Owns:
- Media state/catalog
- ingest/upload
- contextual replacement/placement
- Gallery behavior
- asset identity/provenance roadmap

Does not own:
- generic toolbar chrome
- generic tabs/cards
- Inspector shell

Target task prefix: `assets/`

### Mobile Focus

Existing worker remains owner.

Owns:
- touch interaction
- phone presentation
- mobile sheets/overlays
- safe-area/browser-chrome behavior
- mobile keyboard/session behavior

Target future prefix: `mobile/`

## Branch model

Workers are durable. Branches are not.

End-state rule:

```text
main
├─ canvas/<bounded-task>
├─ workspace/<bounded-task>
├─ controls/<bounded-task>
├─ assets/<bounded-task>
└─ mobile/<bounded-task>
```

Future roadmap domains may add `figma/` and `model/` when those tranches begin.

During cleanup, the existing `field/` prefix remains valid for legacy/transition work until the cleanup worker proves Runner/GitHub workflows accept the new domain prefixes. Do not flip enforcement before that verification.

No new branch should exist solely to preserve a chat or “continuation.” Git history, Runner reports, and explicit assignments preserve continuity.

## Execution tranches

### Tranche 0 — live inventory and truth recovery

Before mutating field:

- refresh `field/main`
- paginate all remote branches
- enumerate all open PRs
- compare every nontrivial branch to current `main`
- read current Runner field reports
- record active checks/QA only as exact-SHA evidence
- classify red CI by failure class; provider quota/harness failures are not product failures
- create a cleanup ledger with one row per PR and branch

Required classifications:

- KEEP ACTIVE
- MERGE AFTER GATE
- TRANSPLANT
- SUPERSEDED
- CLOSE AFTER VERIFICATION
- DELETE AFTER VERIFICATION
- QUARANTINE / NEEDS DECISION

No destructive cleanup in Tranche 0.

### Tranche 1 — salvage and transplant

Create fresh domain branches from current `main` only for valuable unmerged work.

Priority known sources:

1. Stage 0 Frame/Group behavioral parity → Canvas & Interaction
2. viewport/header lockstep WIP → Canvas & Interaction
3. left-panel parity PR #124 → Workspace Shell, keeping current main authoritative for Float/Inspector overlap
4. still-useful motion/chrome primitives → Workspace Shell
5. unique old Effects/controls coverage → Inspector & Design Controls only if not already represented on current main
6. Media changes only if deterministic validation finds a real regression; current Media architecture is already largely on main

Prefer transplant/reimplementation over heroic rebasing when an old branch is deeply behind main and contains superseded overlapping architecture.

Each transplant gets a focused short-lived branch and a focused PR.

### Tranche 2 — repository cleanup

After unique work is accounted for:

- close superseded PRs with concise reason
- close replaced PRs with a link/reference to the surviving branch/PR when applicable
- delete obsolete remote branches
- remove old continuation/batch/final-pass branches whose unique commits are accounted for
- retain tags/merge history/reports as historical evidence
- do not rewrite published history merely to make it pretty

Goal: active branch count reflects active work, not project history.

### Tranche 3 — canonicalize ownership and branch policy

After the repo is safe:

- update `projects/field.json` branch-prefix enforcement from transitional `field/` to the verified domain prefixes
- preserve required legacy exclusions only while they remain real
- record ownership boundaries in Runner
- update field bootstrap/docs only where needed to point to Runner as current authority
- archive/deprecate stale Revyme-era operational guidance
- do not erase legitimate Revyme technical provenance/compatibility identifiers

### Tranche 4 — prepare successor ownership

Do not silently create new first-class workers.

Prepare first-class launch packages for any durable ownership lane that needs a new visible worker:

- Canvas & Interaction
- Workspace Shell
- Inspector & Design Controls
- Assets & Media

Mobile Focus already exists and continues.

Each prepared package must contain role, authority, boundaries, current branch/PR state, canonical context, do-not-break rules, acceptance criteria, and immediate first assignment.

## Stage 0 convergence after cleanup

The cleanup task does not absorb all Stage 0 implementation. It leaves a clear ordered queue:

1. Canvas & Interaction
   - finish Frame/Group parity
   - finish viewport/header lockstep
   - continue move/resize/snapping/guides/duplication
   - then Auto Layout/constraints
   - then boolean/mask semantics
2. Workspace Shell
   - left-surface convergence
   - Float/rail/pane integration QA
   - generic toolbar/popout/chrome convergence
3. Inspector & Design Controls
   - exact-main launcher/advanced-surface QA
   - targeted Stage 0 fixes only
   - defer full PaintLayer architecture
4. Assets & Media
   - deterministic closeout validation
   - targeted regressions only
   - defer provider/persistence/provenance expansion
5. Mobile Focus
   - continue current active PR
   - reconcile shared Canvas/Shell changes at integration boundaries

When those converge, tag a Stage 0 baseline rather than creating another permanent release branch.

## Longer product tranches

After Stage 0 baseline:

### Tranche 2 — Figma translation
- importer audit
- Figma source graph
- identity/provenance
- Auto Layout mapping
- components/instances/variants
- variables/styles
- typography/layout fidelity
- import review

### Tranche 3 — native field design model
- field design graph
- native layout semantics
- PaintLayer
- asset identity/provenance
- component semantics
- variables
- typography
- constraints/responsive model

### Tranche 4 — field-native design tooling
- advanced snapping/guides
- deeper canvas tooling
- components/variants
- design-system tooling
- prototyping
- performance

### Tranche 5 — synchronization
- Figma upstream identity
- change detection/reconciliation
- selective sync
- design/source parity tooling

## QA / failure interpretation

A red GitHub run is not a single failure class.

Before using CI history to block, retry, discard, or promote work, distinguish at minimum:

- product failure
- QA assertion failure
- dependency drift
- auth
- provider quota/capacity
- rate limit
- transport
- provider outage
- stale/superseded run

Provider quota/capacity means deferred/blocked harness capacity, not product failure.

Runner/Inspector infrastructure owns execution scheduling and resource awareness. Field workers provide acceptance criteria and consume evidence.

## Completion criteria for this reorganization

The cleanup/reorganization assignment is complete only when:

- every open field PR is classified against fresh Git truth
- all remote field branches have been paginated and classified, not merely the first page
- every unique unmerged commit is accounted for
- Mobile active work is preserved
- Runner/Inspector active infrastructure ownership is preserved
- valuable stranded work is transplanted to fresh bounded domain branches
- superseded PRs are closed only after verification
- obsolete branches are deleted only after verification
- the target ownership map is recorded in Runner
- branch-prefix enforcement is changed only after workflow compatibility is proven
- launch packages are prepared for new durable workers, not silently instantiated
- a concise final ledger and successor queue are persisted in Runner
- `field/main` remains the integration truth and no force-push/history rewrite was used
