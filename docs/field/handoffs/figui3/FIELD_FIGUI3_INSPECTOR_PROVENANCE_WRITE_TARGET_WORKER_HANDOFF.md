# field — FIGUI3 Inspector Provenance + Write Target Worker Handoff

## Status

Worker-ready implementation contract.

Baseline: `ba00546db0d76c5130172cf899eb46ae642f75bc`

Read first:

- `FIELD_PRODUCT_ARCHITECTURE.md`
- `docs/handoffs/figui3/FIELD_DESIGN_MODE_GAP_AUDIT_20260927.md`
- current `tracker.md`

## Goal

Create the first-class provenance/write-target layer that lets field answer, for every Inspector property:

**What value is rendered? Why? And exactly where will an edit go?**

Do not redesign the Inspector UI wholesale.

Do not create a new mutation engine.

This worker normalizes information the current architecture already knows and exposes it to existing Inspector controls.

---

# 1. Architecture invariant

**Read truth != write truth.**

Rendered/computed value answers what the user sees.

Write target answers which source/design concept owns the edit.

Never infer permission to write from computed CSS alone.

---

# 2. New subsystem

Preferred location:

`src/editor/inspector/provenance/`

Suggested files:

- `types.ts`
- `resolve-property.ts`
- `resolve-read-source.ts`
- `resolve-write-target.ts`
- `resolve-multi-selection.ts`
- tests beside the pure modules

Avoid a monolithic resolver.

## Core type

Implement an equivalent of:

```ts
export interface InspectorPropertyResolution {
  property: string;

  read: {
    value: string;
    source: InspectorReadSource;
    inherited: boolean;
    mixed: boolean;
  };

  write: {
    target: InspectorWriteTarget;
    editable: boolean;
    reason?: string;
  };

  reset: InspectorResetAction | null;
  binding: InspectorBinding | null;
}
```

Exact names may change if existing naming conventions suggest something cleaner.

---

# 3. Read source taxonomy

Support at least:

- `local`
- `responsive`
- `component-variant`
- `conditional-variant`
- `component-instance`
- `variable`
- `preset`
- `cms`
- `locale`
- `inherited`
- `computed-only`
- `animation-bound`

Each source must carry enough detail for diagnostics and future UI.

Examples:

- responsive → active width/band
- component-variant → variant name
- conditional variant → variant name + conditional property channel
- instance → instance ID / expanded node relation
- variable → variable/prop name
- preset → preset/token name
- CMS → field/binding identity when available
- locale → locale identity
- computed-only → why no authored owner was resolved

Do not introduce “shared CSS rule” as a confident source kind unless current source parsing can deterministically identify that rule.

---

# 4. Write target taxonomy

Support at least:

- `node-base-style`
- `responsive-band`
- `component-variant-style`
- `component-variant-conditional`
- `component-instance-override`
- `variable-binding`
- `preset-binding`
- `cms-binding`
- `locale-override`
- `read-only`

The target should identify the destination but should NOT itself mutate source.

The existing mutation paths remain canonical.

---

# 5. Resolution precedence

Use the same effective-value precedence already implemented by ControlProvider.

Do not create a second cascade.

Resolution should mirror current behavior for:

1. base authored value
2. locale override where active
3. responsive / replica value where active
4. component default-variant value
5. active component variant value
6. conditional variant value
7. per-variant CMS literal/binding
8. variable / prop resolution
9. preset/token identity
10. computed fallback only when authored resolution is absent

Where exact precedence differs for a property family, reuse existing provider/helper semantics.

---

# 6. Existing systems to reuse

Must reuse / wrap rather than duplicate:

- `ControlProvider`
- unified `ControlProvider`
- `updateNodeStyles`
- mutation queue
- `hasOverride`
- container-query helpers
- viewport/variant atoms
- locale stores
- CMS binding helpers
- parser fields:
  - `styleVariables`
  - `responsiveStyleVariables`
  - `responsiveStyleValues`
  - `responsiveStyleBands`
  - `conditionalStyles`
  - `motionVariants`
  - `variantBindings`
  - `componentFile`
- variable/preset helpers

Do not fork those rules.

---

# 7. Provider integration

Extend the classic and unified provider contexts with one canonical accessor, conceptually:

```ts
resolveProperty(property: string): InspectorPropertyResolution
```

or:

```ts
getPropertyResolution(property: string): InspectorPropertyResolution
```

Choose one naming pattern and use it consistently.

Legacy helpers may remain during migration:

- `getValueSource`
- `hasOverride`
- existing variable helpers

Do not remove them until every consumer is migrated.

The resolver must be memoizable and should not create unstable objects that reintroduce Inspector render loops.

---

# 8. Write execution

Do NOT build `inspector-mutation.ts` as a second generic writer unless there is a concrete gap.

Preferred approach:

- resolution determines target
- existing control action calls the current mutation route
- add small target-aware adapters only where current API cannot express intent

Examples:

- base local style → existing `updateNodeStyles`
- responsive → existing replica/container-query route
- variant → existing variant routing
- instance → existing instance redirect/override route
- variable/preset → existing binding operations
- CMS → existing bind/unbind operations
- locale → existing locale path

If a resolver returns `read-only`, the control must not silently fall through to `updateNodeStyles`.

---

# 9. Reset semantics

Every editable override source should expose the correct reset action.

Examples:

- responsive → remove active-band override
- component variant → remove active variant override / inherit default
- instance → remove instance override / inherit component
- locale → remove locale override / inherit source
- variable → explicit detach or edit variable; normal value edit must not mutate variable globally
- preset → explicit detach/local override vs Edit preset
- CMS → unbind or reset variant binding
- computed-only → no reset

Do not collapse all reset behavior to “write empty string.”

---

# 10. Variables / presets

Important distinction:

A rendered value may be a resolved literal while provenance is still variable/preset-bound.

Preserve binding identity.

Normal object-level edit:

- MUST NOT mutate a global preset/token automatically
- MUST NOT mutate component variable defaults globally

Safe default:

- create/localize the appropriate override or detach only through an explicit action

Existing variable/preset pills remain authoritative UI for now.

---

# 11. Component instances

Expanded instance IDs already route through `updateNodeStyles`.

The resolver must surface this explicitly as instance provenance/write targeting.

Requirements:

- editing a page instance creates/updates an instance override
- never silently edits the main component
- reset removes the instance override and re-inherits the component value
- expanded child identity must map back to the correct instance/source target
- root and nested instance cases need tests

Do not expand component architecture in this worker.

---

# 12. Inherited / computed-only

This is the most important fail-closed rule.

When field can render a value but cannot deterministically identify its authored owner:

- read value may be displayed
- mark source `computed-only` or `inherited`
- mark write target read-only unless a deliberate local-override action exists
- expose a diagnostic reason
- future UI may offer “Create local override” / “Edit in Code”

Do not automatically write an inline style merely because the browser computed a value.

---

# 13. Multi-select

Implement pure resolution for multi-selection after single-property resolution is stable.

For each property:

- identical value + compatible write targets → editable common value
- different values + compatible targets → mixed editable state
- incompatible target classes → mixed/read-only or split behavior; do not guess
- one computed-only member can make the group unsafe for a bulk write
- batch commit should remain one undo transaction

No new Selection colors behavior in this worker.

---

# 14. First migrated controls

After provider plumbing is stable, migrate only a narrow visual-property slice first:

1. Fill
2. Border / Stroke
3. Shadow / Effects

These are the best proof because they already exercise:

- variables
- presets
- overrides
- responsive values
- variant values
- multi-property writes

Do not migrate the entire Inspector before proving the model.

Typography / Layout / Size are a second pass.

---

# 15. UI for this worker

Keep UI changes minimal.

Allowed:

- diagnostic data attributes for tests
- existing label/pill/reset behaviors wired from canonical resolution
- optional small provenance tooltip if already supported by the current menu system

Do NOT add a giant “Source” section or decorative provenance badges everywhere.

The architectural data model comes first.

---

# 16. Tests

Pure resolver tests must cover at least:

1. local authored style
2. variable-bound resolved literal
3. preset/token reference
4. active responsive override
5. responsive inherited base
6. component default variant
7. component non-default variant
8. conditional variant property
9. component instance override
10. locale override
11. CMS binding / per-variant CMS override
12. inherited value
13. computed-only fallback
14. animation-bound read-only route
15. reset target for each override family
16. incompatible multi-select targets
17. mixed compatible multi-select
18. expanded instance child mapping
19. resolver does not mutate
20. resolution object stability/memoization where provider integration depends on identity

Integration tests:

- existing Fill/Border/Shadow behavior remains green
- Reset Override still updates Canvas
- variable/preset pills still render
- responsive and variant edits still route to their current source channels
- no new Inspector rerender loop

---

# 17. Protected / out of scope

Do not touch unless absolutely required and explicitly documented:

- Scale system
- `SelectionOverlay.tsx`
- Selection colors locate
- Cloudflare / Preview infrastructure
- Dashboard
- Figma import
- component creation/variant authoring UI
- design graph schema migration
- package lock / dependency upgrades

Avoid large edits to `PropertiesPanel.tsx`.

Current stale tracker metadata still lists Scale as active there.

---

# 18. Follow-on contract

After this worker closes successfully, the next Design-mode lane is:

**Components / Instances / Variants semantic hardening**

That follow-on should consume `InspectorPropertyResolution` rather than inventing component-specific provenance rules.

Goals for the follow-on:

- explicit main-component vs instance editing context
- deterministic instance override surface
- variant property ownership
- Reset Override semantics unified with Inspector provenance
- variables/instance props preserved instead of flattened
- component inheritance visible and explainable

Do not begin that work inside this worker.

---

# Closeout

Report:

- final type taxonomy
- exact precedence rules
- exact files changed
- which existing routing helpers were reused
- any cases forced to read-only
- Fill/Border/Shadow migration status
- all tests/build results
- any architecture drift
- any stale tracker/docs that need cleanup

