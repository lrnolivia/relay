# field — Design Mode Gap Audit: Inspector Provenance / Write Truth

Date: 2026-09-27  
Verified implementation baseline: `ba00546db0d76c5130172cf899eb46ae642f75bc`

## Deployment state

The latest `main` commit is deployed successfully through Cloudflare Workers Builds.

## What already exists

The current Inspector is substantially more capable than the older handoffs implied.

### Read-side behavior already modeled

`src/editor/controls/ControlProvider.tsx` and the unified provider already resolve and merge:

- base authored node styles
- locale overrides
- responsive / replica overrides
- component default-variant values
- component non-default variant overrides
- conditional per-variant styles
- per-variant CMS style overrides
- FIT-text wrapper/inner-node routing
- responsive variable values
- component-instance context
- hidden-on-variant state
- CMS bindings
- variable bindings
- preset/token references
- animation / scroll bindings

This means field already possesses much of the information needed for a source-aware Inspector.

### Write-side behavior already modeled

`updateNodeStyles()` is already a sophisticated routing layer. It handles, among other cases:

- base source writes
- page replica / responsive writes
- component master variant writes
- conditional variant writes
- per-variant visibility
- expanded component-instance redirects
- direct instance overrides
- DOM-only live preview
- viewport-specific live patching
- renderer/bridge synchronization
- source mutation queueing

The provenance project MUST reuse this routing rather than create a second style writer.

### Existing provenance UX

The Inspector already exposes fragments of provenance:

- `hasOverride(property)`
- Reset Override
- variable-bound pills
- preset/token pills
- CMS-bound pills
- locale-bound behavior
- animation/scroll “Used by” rows

These are useful but fragmented across controls.

## Core architectural gap

Read truth and write truth are currently collapsed too early.

The providers compute an effective `styles` map, then most controls receive:

- a string value
- `hasOverride`
- variable/binding fragments
- a generic `updateStyle()`

That answers “what value should I show?” but does not provide a canonical answer to:

1. **Why is this the value being rendered?**
2. **Which authored source concept currently owns it?**
3. **Where will an edit be written?**
4. **What does reset mean for this property in this scope?**
5. **Is this value editable at all?**

The legacy `ValueSource` type is only:

`'inline' | 'prop' | 'token'`

That is much narrower than the real architecture.

## Decision

Build a normalized Inspector property-resolution layer.

The invariant is:

**read truth != write truth**

A control should receive one canonical property-resolution object rather than independently reconstructing provenance from viewport, variant, variable, locale, CMS, and instance state.

## Recommended model

Conceptually:

```ts
interface InspectorPropertyResolution {
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

### Read source kinds

At minimum:

- local
- responsive
- component-variant
- conditional-variant
- instance-override
- variable
- preset
- cms
- locale
- inherited
- computed-only
- animation-bound

Do not claim “shared rule” provenance unless the parser/source layer can identify a deterministic authored rule.

### Write target kinds

At minimum:

- node-base-style
- responsive-band
- component-variant-style
- component-variant-conditional
- component-instance-override
- variable-binding
- preset-binding
- cms-binding
- locale-override
- read-only

The write target describes the existing mutation route. It does not replace it.

## Important constraints

- no arbitrary inline override just because computed CSS exposes a value
- no global token mutation from a normal object-level color edit
- no silent main-component mutation from an instance edit
- inherited/computed values may be readable without being directly editable
- responsive edits must remain scoped to the active band
- variant edits must remain scoped to the active variant
- multi-select must support compatible common targets and mixed values
- unsupported provenance must fail closed / read-only rather than guessing

## Current ownership note

`tracker.md` still marks `native-scale-tool-20260926` active and lists `PropertiesPanel.tsx` as Approved Shared.

Current product direction says Scale is complete. Treat the tracker entry as stale coordination metadata, but avoid unnecessary `PropertiesPanel.tsx` churn until its ownership record is corrected.

## Recommended execution order

1. provenance types + pure resolver
2. write-target resolver
3. classic + unified provider exposure
4. migrate Fill / Stroke / Effects first
5. migrate Typography / Layout / Size
6. multi-select resolution
7. explicit provenance UI polish
8. components / instances / variants follow-on

## Next product lane after provenance

Once property ownership is explicit, proceed to Components / Instances / Variants.

That work should reuse the same provenance/write-target layer so:

- instance edits become explicit overrides
- main-component edits are intentional
- variant-specific values are first-class
- Reset Override has one semantic model
- variables and instance props do not get flattened into literals

