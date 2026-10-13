# field — FIGUI3 Selection Colors Locate + Loading Skeleton Polish Worker Handoff

## Status

Worker-ready implementation handoff.

Implementation baseline: `0c71cab5cdab71e651e08e9c35a3a79202eeac35`  
Branch from current `main`.

This is a compact FIGUI3 polish assignment. Do not expand it into a general Inspector or Canvas rewrite.

---

## Goal

Finish two adjacent UX polish areas:

1. Make **Selection colors** behave more like Figma:
   - stable row order
   - no visible occurrence-count numbers
   - a target/crosshair action that locates the objects using that color without replacing selection

2. Make the **ProjectLoader skeletons** feel substantially more premium:
   - strong glossy/specular movement
   - visible but tasteful grain layer
   - still compact, professional, and reduced-motion safe

This work must not disturb Scale, Preview, Canvas mutation architecture, or the design graph.

---

# 1. Selection colors — stable order

Current behavior sorts Selection-color groups by occurrence count and then value.

That causes rows to jump after edits.

Change aggregation so group order is the **first occurrence in selected-scope/document traversal order**.

Requirements:

- do not sort by occurrence count
- do not sort alphabetically
- preserve first-seen order from the selected design subtree
- changing a color should not arbitrarily reorder unrelated rows
- if two groups genuinely merge because they now represent the same color, normal structural collapse is allowed
- add a regression test proving stable first-occurrence order

---

# 2. Remove visible counts

The current right-side numeric count next to each Selection color should disappear.

Requirements:

- no visible `1`, `2`, `6`, etc. beside color rows
- occurrence count may remain internal for traces / diagnostics
- accessible text may retain occurrence metadata if useful, but there must be no visible count UI
- simplify the row grid accordingly
- clean up stale `occurrenceLabel`/layout code if it becomes unnecessary

---

# 3. Target icon becomes Locate

Replace the current target action semantics:

Current:
`Select objects using this color`

New:
`Locate objects using this color`

Use a compact crosshair/target icon.

Important:

**Locate must NOT replace the user's current selection.**

This is transient reveal/highlight state, not selection state.

Recommended implementation seam:

- add a tiny dedicated locate-state module, e.g. `src/code/stores/selection-color-locate-store.ts`
- do not add this to `selectedIdsAtom`
- do not repurpose hover state
- do not use `layerDropTargetAtom`
- request should include at least:
  - matching node IDs
  - resolved tint color if available
  - mode: `hover` or `click`
  - monotonically increasing revision so repeated requests replay animation

---

# 4. Hover behavior

Hovering the target icon should NOT immediately do anything dramatic.

After approximately **1.5 seconds** of continuous hover:

- the target icon begins a soft pulse
- matching Canvas objects begin a soft pulse
- Layers panel does **nothing**
- do not expand Layers
- do not scroll Layers
- do not flash layer rows
- do not change selection

Leaving the target:

- immediately cancel the delayed hover if it has not fired
- stop the hover pulse if active
- Canvas highlight fades away gently

Use fake timers in a focused test if practical.

Hover is intentionally less intense than click.

---

# 5. Click behavior

Clicking the target should perform the full locate action immediately.

## Layers

- make the canonical Layers panel active
- open the left pane if currently collapsed
- expand the parent path necessary to expose every matching object in the current viewport
- flash every matching layer row with `var(--accent)`
- scroll the first matching row into a useful centered/near-centered view
- do not modify actual selection

The layer flash should be transient and soft, roughly ~1 second.

Repeated clicks must replay the flash even when the same color is located repeatedly.

## Canvas

Click also triggers the stronger one-shot Canvas locate glow described below.

---

# 6. Canvas locate glow

Create a new independent Canvas overlay sibling.

Recommended new file:

`src/canvas/selection/SelectionColorLocateHighlight.tsx`

Mount it from `Canvas.tsx` inside the existing `CanvasOverlay`, adjacent to the existing selection/drop overlays.

Do NOT modify `SelectionOverlay.tsx`.

Use rotation-aware geometry where possible:

- prefer existing `getScreenCornersById(nodeId, vpId)`
- support multiple matching node IDs
- retain last good geometry briefly on transient cache misses if needed

## Visual recipe

The glow must be **very soft and gradual**.

No harsh shadow.  
No neon ring.  
No sharp bloom.  
No hard selection outline.

Use two soft layers:

### Outer contrast layer

Purpose: make the object readable against its backdrop.

- choose black or white based on the nearest meaningful rendered background
- use `mix-blend-mode: overlay`
- click strength: about **35% peak opacity**
- hover strength: lower, approximately **20–22% peak**
- broad blur / feather, roughly in the 20–30px-class range depending on geometry
- slow ease in and out

For tone selection:

- inspect the selected object's rendered background first
- if transparent, walk parent backgrounds until a meaningful color is found
- computed browser RGB/RGBA is sufficient
- fallback to current editor/theme tone only when no meaningful backdrop can be resolved

### Inner color layer

Purpose: softly connect the locate treatment to the Selection color.

- only use a tint when a real/resolved color is available
- use a restrained `screen` blend
- click peak: about **28–32% opacity**
- hover peak: about **14–18% opacity**
- tighter than the outer halo
- still blurred and soft; no crisp perimeter

The user explicitly prefers the outer black/white overlay to do more work than the color layer.

## Timing

Keep it gentle:

- hover pulse: gradual continuous breathing while hover remains active
- click: one gradual pulse / swell and fade
- approximately 2s-class visual cycle is appropriate
- icon pulse should feel synchronized with Canvas hover pulse

Under `prefers-reduced-motion: reduce`:

- no pulsing animation
- show a short-lived static soft locate treatment on click
- hover may show a quiet static highlight after the delay

---

# 7. Layers flash

Use the existing Layers tree and row structure.

Do not fake selection.

Requirements:

- accent-tinted row flash only after click
- all matching visible rows flash
- parent path is expanded first
- flash may be implemented through React state/props or a dedicated transient locate request
- no permanent row state
- preserve current selection highlighting exactly
- use a soft accent wash + subtle inset accent edge, not a harsh rectangle

Keep CSS local to the Pages/Layers panel CSS.

Do not touch global theme CSS.

---

# 8. SelectionTool cleanup quick wins

While in the same file, do these low-risk cleanups:

- rename callback semantics from `onSelectMatching` to `onLocateMatching`
- update tooltip/accessibility copy to “Locate objects using this color”
- remove stale comments saying Selection colors only handles multi-select if they still exist
- remove unused `scopeSize` plumbing if it is no longer needed
- keep variable/style actions intact
- keep color editing behavior intact
- keep bulk mutation path through existing source-aware helpers
- do not change Fill / Stroke / Effects controls

---

# 9. Premium loading skeleton polish

The current ProjectLoader skeletons are too matte.

Make them **impressively shiny**, but still professional and soft.

Keep this work local to `ProjectLoader.tsx`. Do not add global `src/styles/**` changes.

## Skeleton surface recipe

Each skeleton placeholder should have:

1. a richer neutral base surface
2. a broad soft moving specular sweep
3. a narrower brighter secondary sheen inside that sweep
4. a subtle grain/noise layer
5. preserved dimensionality in dark and light themes

The shimmer should feel like polished translucent material, not a generic SaaS gray loading bar.

### Grain

Add a real visible-but-subtle grain layer.

Recommended:

- local pseudo-element
- SVG `feTurbulence` data texture or similarly deterministic noise
- low opacity
- blend gently (soft-light/overlay as appropriate)
- no giant repeating pattern
- grain remains static while specular light moves

### Motion

Replace the current whole-placeholder opacity pulse with specular movement.

Suggested timing:

- ~2.4–3.2s sweep
- soft cubic/ease-in-out
- stagger remains okay, but keep motion cohesive rather than every placeholder looking random

Under reduced motion:

- no moving sweep
- retain a static polished highlight and grain
- do not remove all visual hierarchy

The result should be noticeably more premium at first glance.

---

# 10. Optional adjacent quick wins

These are approved only if they stay genuinely small:

- add trace events for locate-hover start/cancel and locate-click
- add a compact `data-*` hook for Selection-color locate tests
- keep target button keyboard-triggerable
- keyboard activation should perform click locate, not hover locate
- Escape should not be needed because locate is transient rather than a persistent mode
- ensure target-icon animation does not change row layout
- ensure locating a color with many matches does not force actual multi-selection

Do not expand beyond these.

---

# 11. Expected files

Primary owned surface:

- `src/editor/selection-colors.ts`
- `src/editor/tools/SelectionTool.tsx`
- `src/code/stores/selection-color-locate-store.ts` — new
- `src/canvas/selection/SelectionColorLocateHighlight.tsx` — new
- `src/canvas/Canvas.tsx` — mount only
- `src/editor/LayersPanel.tsx`
- `src/editor/LayersPanel/rows.tsx` if needed
- `src/editor/left-toolbar/panels/pages-layers.css`
- `src/ProjectLoader.tsx`

Tests may include:

- `src/editor/selection-colors.test.ts`
- `src/editor/figui3-inspector-header-selection.test.ts`
- new focused locate-state / locate-highlight tests
- new ProjectLoader skeleton source/behavior contract if useful

---

# 12. Do not touch

Do NOT modify:

- `src/canvas/selection/SelectionOverlay.tsx`
- `src/canvas/selection/ScaleHandles.tsx`
- `src/canvas/scale/**`
- `src/canvas/resize/**`
- `src/canvas/drag/**`
- `src/code/stores/tool-store.ts`
- Preview sandbox/runtime
- Cloudflare routing
- Dashboard
- design graph architecture
- code generation/parsing
- component/variant architecture
- package.json
- package-lock.json
- global `src/styles/**`

Scale is considered complete by current product direction. Do not reopen it.

---

# 13. Tests / validation

Minimum focused validation:

1. Selection-color group order follows first document/subtree occurrence
2. editing a color does not count-sort/alphabetize unrelated rows
3. no visible occurrence-count element remains
4. hover under threshold causes no locate request
5. hover after ~1.5s creates Canvas-only locate state
6. mouseleave cancels hover locate
7. click creates full locate request
8. click does not mutate selectedIds
9. Layers expand matching parent paths on click
10. matching Layers rows receive transient accent flash
11. Canvas overlay supports multiple node IDs
12. overlay chooses black/white outer tone deterministically from rendered backdrop
13. hover glow is weaker than click glow
14. literal/resolved color may drive inner screen tint
15. reduced motion removes pulse/sweep animation
16. skeleton keeps grain + static sheen under reduced motion
17. existing Selection color editing still works
18. existing FIGUI3 Inspector contracts remain green

Then run the repository-standard TypeScript/build checks in the repo's supported Node environment.

Do not edit the lockfile to make validation convenient.

---

# 14. Visual QA

Worker must explicitly verify:

## Selection colors

- select a frame with several different child colors
- row order stays stable after changing one color
- no visible count numbers
- hover target >1.5s:
  - target icon breathes
  - Canvas matching objects softly glow
  - Layers do not move
- leave hover:
  - glow fades away
- click target:
  - left Layers panel opens if necessary
  - matching paths expand
  - matching rows flash accent
  - first match scrolls into view
  - Canvas gets stronger layered glow
  - actual selection remains unchanged

## Glow appearance

- very soft, gradual
- outer contrast layer stronger than tint
- black/white outer overlay around 35% click peak
- color tint noticeably softer around 28–32% click peak
- hover substantially gentler
- no harsh shadow/ring

## Skeletons

- clearly shinier than current main
- obvious specular sweep
- visible fine grain on close inspection
- not generic gray shimmer
- not neon/glassy marketing chrome
- reduced-motion state still looks intentionally polished

---

# 15. Closeout

Report:

- exact files changed
- final locate-state architecture
- how backdrop contrast is chosen
- final hover/click opacity and timing values
- how Layers expansion/flash works without changing selection
- stable-order strategy
- skeleton sheen/grain implementation
- focused tests and results
- TypeScript/build result
- visual QA notes
- any unsupported edge case

If any part requires touching protected systems above, stop that subpart and report it instead of broadening scope.
