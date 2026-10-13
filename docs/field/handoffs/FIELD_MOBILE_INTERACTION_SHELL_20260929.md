# field mobile interaction shell — post-QA handoff

**Updated:** 2026-09-29  
**Status:** product direction settled; implementation follow-up required  
**Repository:** `lrnolivia/field`  
**Existing Mobile workstream:** `field/mobile-focus-touch-camera-20260929`  
**Observed Mobile head at documentation capture:** `0a4c2cef6ce9a76dcc9011466956266bd00feb73`

## purpose

This handoff records the user's live mobile QA and turns it into an implementation contract.

The current mobile branch is not a failed experiment. A substantial amount already works. The problem is that the current phone shell still behaves too much like desktop field compressed into a touch viewport.

Do **not** respond by creating a separate mobile editor architecture.

Mobile should remain the same field editor underneath:

- same document/source model;
- same Canvas transform and selection state;
- same undo/redo and commands;
- same Design semantics;
- same Preview/runtime truth.

The mobile work is a touch-native interaction and chrome layer over those shared systems.

## existing work to preserve

The active Mobile branch already contains meaningful work and should be continued from current Git reality rather than replayed from scratch.

Recent Mobile commits observed during this documentation pass include:

- `7a601e4a2ae5` — prime mobile keyboard on text double tap;
- `e5d6059ab2b7` — collapse mobile portrait toolbar;
- `b64ec64a806f` — deliberate touch marquee gesture;
- `213646f52739` — object long-press Canvas context menu;
- `700b5741526e` — phone sheets and overlays for Focus panels;
- `14c7a5e45498` — Focus state, keyboard geometry, and touch targets;
- `0a4c2cef6ce9` — exact-PR-head mobile verification support.

These commits are provenance, not proof that the interaction contract below is satisfied.

## user QA — 2026-09-29

### confirmed working

- Text selection works and the typography Inspector appears correctly. An earlier suspicion that this had regressed is **not** a current defect.
- A meaningful portion of Canvas interaction works on mobile.
- Left-toolbar sheets open at the topmost visual layer above the rest of the editor chrome.
- The current Mobile foundation is usable enough that it should be refined, not replaced.

### confirmed problems

1. **Text editing keyboard is unreliable.** Entering text edit does not consistently produce a usable software keyboard/focus session.

2. **Object insertion is deferred/broken.** The user can arm a tool and attempt to add an object, but nothing appears until a later unrelated tap. When the object finally appears it can be extremely long and thin.

3. **Mobile sheets do not share one stacking contract.**
   - Left-toolbar sheets correctly appear above all ordinary UI.
   - Inspector sheets can render underneath the left rail/tool controls and the bottom toolbar.
   - Both sheet types still leave toolbar chrome visible in ways that feel wrong for a phone.

4. **The portrait tool control has the wrong paradigm.** The floating action/tool button stops behaving as a stable floating control and morphs into a dual-layer docked toolbar. The user explicitly rejected this.

5. **Chrome intersects inconsistently.**
   - The left rail falls behind the docked toolbar.
   - The right rail appears in front of it.
   - This exposes separate z-order/geometry systems instead of one mobile chrome contract.

6. **Workspace/layout controls in the pill do not reliably respond to touch.**

7. **The phone workspace exposes the wrong choices.** `full` should not exist on phone. Mobile needs `float` and `focus` only.

8. **Collapse/auto-hide controls are overexposed on phone.** They do not deserve permanent mobile chrome. If retained, they belong in a mobile workspace/view settings surface.

9. **Inspector/sheet contents are too desktop-dense for touch.** Reusing the same underlying property semantics is correct; presenting the full desktop control density literally is not.

## settled mobile interaction model

### 1. the tool button is canonical

On phone, the floating **tool button** is the canonical entry point for tools.

It is not a teaser for a second hidden toolbar. It **is** the mobile toolbar anchor.

Required behavior:

- the tool button stays spatially stable above the bottom safe area;
- tapping it opens a temporary **tool palette** anchored to the button;
- choosing Text, Frame, Shape, Hand, Select, or another tool arms that tool and dismisses the palette;
- the button may reflect the armed/current tool when useful;
- the button remains the stable origin/close affordance while its palette is open;
- portrait mode does not morph the button into a dual-row docked toolbar;
- landscape may give the palette more room, but it remains the same interaction model.

Do not maintain separate "FAB mode" and "mobile toolbar mode" concepts.

### 2. one mobile sheet host

Layers, Insert, Media, Inspector, and other substantial phone surfaces should route through one top-level mobile **sheet** host.

The current distinction where left sheets are truly topmost but Inspector sheets sit under other chrome is a bug in the mobile shell.

Required behavior:

- every major mobile sheet uses the same portal/overlay host and z-order contract;
- a major sheet renders above ordinary rails, tool controls, and Canvas chrome;
- underlying rails/tool button are hidden or made inert behind the sheet/scrim rather than visually cutting through it;
- dismissal behavior is consistent across left-origin and Inspector-origin sheets;
- sheets respect safe areas and software-keyboard geometry;
- no separate left-sheet and Inspector-sheet stacking models.

### 3. phone workspace modes are float and focus

Phone exposes exactly two workspace modes:

#### `float`

Normal mobile editing.

- Canvas is primary.
- The canonical tool button remains available.
- Compact edge affordances/rails may remain where useful.
- Major editor surfaces open temporarily as sheets.

#### `focus`

Canvas-first mobile editing.

- Nonessential rails and workspace chrome are removed.
- The tool button remains the essential creation/editing entry point.
- Temporary sheets may still be opened when explicitly requested.

`full` is a desktop/large-screen workspace concept and is not shown on phone.

### 4. collapse and auto-hide move out of permanent mobile chrome

`collapse`, `expand`, and `auto-hide` can remain legitimate desktop/large-screen workspace concepts.

On phone:

- do not dedicate persistent chrome to them;
- keep them out of the main layout pill;
- if the behavior remains useful, expose it through `settings` or a mobile workspace/view settings surface;
- prefer the simple `float` / `focus` choice in the primary chrome.

### 5. rails and the tool button share one geometry contract

The current left-behind/right-in-front intersection with the docked toolbar must disappear.

Required behavior:

- both rails obey the same z-layer;
- rails never pass through or under/over the tool button exclusion zone inconsistently;
- portrait rails terminate or inset above the bottom safe-area/tool-button footprint;
- opening a major sheet removes/inerts ordinary rails under the sheet;
- `focus` hides nonessential rails entirely.

Do not patch the left and right edges independently with unrelated z-index values.

### 6. touch insertion is a deterministic gesture state machine

The deferred object creation observed in QA is a product defect, not acceptable touch latency.

Mobile insertion should follow the shared field insertion model with touch-specific pointer semantics:

`idle → tool armed → pointer down on Canvas → create/live-size → pointer up → commit`

Required behavior:

- choosing a creation tool commits the armed-tool state before the next Canvas gesture;
- a simple tap creates the object immediately at a sensible default size;
- a deliberate drag creates and sizes the object live;
- an unrelated later tap must never complete a previously pending creation;
- finger jitter cannot create pathological near-zero-width/height objects;
- apply sensible minimum/default geometry for tap-created primitives;
- after commit, preserve the same tool-exit/selection semantics used by field's shared desktop/Figma-parity model rather than inventing a separate mobile rule.

### 7. text editing must own the native keyboard session

Mobile text editing should enter `close read` through a direct trusted touch gesture and establish editable focus reliably.

Required behavior:

- double-tap or an explicit Edit action enters text editing;
- editable focus is established directly from the touch gesture before asynchronous camera/animation work can steal it;
- the native software keyboard appears reliably;
- keyboard appearance must not destroy or unpredictably rescale the saved Canvas camera;
- use keyboard/visual-viewport geometry to keep the active text and essential controls visible;
- provide a clear touch action to finish editing;
- repeated enter/edit/finish cycles must remain stable.

Camera choreography is subordinate to obtaining and retaining a real editable keyboard session.

### 8. touch presentation of Inspector controls

Mobile uses the same design properties as desktop, but not necessarily the same literal control presentation.

Required direction:

- common properties are exposed first;
- advanced properties use progressive disclosure;
- controls must be comfortably tappable and cannot depend on hover;
- numeric scrub/edit affordances must have explicit touch-safe hit regions;
- tiny desktop icon grids should become touch-appropriate rows, segmented controls, steppers, sliders, swatches, or drill-in groups where appropriate;
- keep semantic parity with desktop rather than hiding capabilities permanently.

This is a presentation adaptation, not a second Inspector data model.

### 9. layout pill behavior on touch

The mobile layout/workspace control must respond reliably to tap.

On phone it contains only:

- `float`
- `focus`

It must not expose `full`, `collapse`, or `auto-hide` as peer primary choices.

## acceptance criteria for the next mobile pass

The Mobile workstream should not call this shell complete until all of the following are true on an exact branch Preview:

1. Selecting text still surfaces the typography Inspector.
2. Entering text edit repeatedly produces a usable software keyboard and actual text edits.
3. A tap with an armed creation tool creates an object immediately with sane geometry.
4. A drag with an armed creation tool visibly sizes the object and commits on release.
5. No unrelated second tap is required to finish insertion.
6. The tool button remains a stable floating anchor and never morphs into the rejected dual-layer docked toolbar.
7. Tool palette selection works by touch.
8. The mobile workspace control responds to touch and exposes only `float` and `focus`.
9. Left-origin and Inspector-origin sheets use the same top-level stacking behavior.
10. Ordinary rails/tool chrome do not visually intersect or sit above an open major sheet.
11. Left and right rails no longer disagree about whether they sit in front of or behind bottom controls.
12. Sheet and Inspector controls are usable without hover and without desktop-density micro-targets.
13. Portrait safe-area handling remains correct with and without the software keyboard.
14. Desktop/large-screen `full`, pane, and Inspector behavior does not regress.

## QA requirements

Follow current Runner QA law.

For this work specifically:

- bind evidence to the exact branch/PR head SHA;
- use the exact branch Preview;
- use deterministic Inspector/GitHub Chromium recipes for repeatable visual/runtime criteria when possible;
- use Browser Run only for exploratory/session behavior that deterministic recipes cannot prove;
- use `/qa/work/<projectId>` when saved-project truth is required;
- `/builder/noauth` is smoke-only and cannot prove project persistence;
- user/device testing remains valuable for keyboard feel, sheet ergonomics, and touch interaction, but record it against the exact Preview/SHA when possible.

The user's 2026-09-29 QA is product-direction evidence. It should not be rewritten as an automated PASS/FAIL result.

## implementation boundary

This handoff defines product behavior and acceptance criteria.

It does **not** authorize a parallel mobile architecture, a second Canvas transform, a second document model, or desktop regressions hidden behind mobile-only CSS.

Fix the first point of divergence in shared state/gesture/sheet infrastructure where practical, then adapt the phone presentation deliberately.
