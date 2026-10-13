# field — FIGUI3 Selection Inspector + Selection Colors Handoff

## Objective

Finish the missing FIGUI3 Design-mode behavior where selecting an object exposes its actual visual styling as structured, editable design properties.

The Inspector must behave like a professional design tool while preserving field's source-first architecture.

Core flow:

select object
→ resolve rendered values + source provenance
→ edit Appearance / Typography / Fill / Stroke / Effects
→ Canvas previews immediately
→ deterministic source mutation commits once
→ Preview matches

For multi-selection:

multi-select
→ common/mixed values
→ Selection colors aggregates selected-scope colors
→ bulk edits affect the selected scope only
→ one undo restores the operation

## 1. Non-negotiable architecture rule

Read truth and write truth are different.

- **Read truth:** what Canvas currently renders.
- **Write truth:** the source concept that actually owns the value.

Never treat a computed CSS value as permission to write an arbitrary inline override.

Every resolved Inspector property needs:

- current value
- mixed state
- editability
- provenance/origin
- explicit write target
- read-only reason when no deterministic write target exists

Suggested origins:

- local
- shared rule/style
- variable/token
- inherited
- component
- responsive override
- computed-only

## 2. Inspector order

Keep the right Inspector compact and FIGUI3-like:

1. selection identity / component context
2. position & size
3. layout
4. appearance
5. typography — conditional
6. fill
7. stroke
8. effects
9. Selection colors
10. advanced / Edit in Code when necessary

No nested cards. Use precise rows, section rhythm, thin separators, restrained radius, sparse accent.

## 3. Appearance

Minimum:

- opacity
- blend mode
- visibility where field models it
- overflow/clipping where relevant
- corner radius where the current model owns it

Multi-selection:

- same value → show value
- different values → `—` / Mixed
- editing applies to compatible selected nodes in one transaction

## 4. Fill

Fill is a paint stack, not one color input.

Minimum fill types:

- solid
- linear gradient
- radial gradient
- conic/angular gradient where current CSS representation supports it
- image/background image
- existing multiple background layers

Paint row:

[visibility] [swatch] [type/value] [opacity] [more/remove]

When multiple fills exist:

- preserve order
- reorder
- enable/disable
- remove
- `+` adds a fill

### Solid

Canonical color popover:

- HEX
- alpha
- live Canvas preview
- variable/style binding affordance
- keyboard editing

### Gradient

Expose:

- type
- stops
- stop position
- stop opacity
- angle/direction where applicable
- add/remove stops

Editing one stop must not destroy unrelated background layers.

### Image fill

Expose asset identity plus fit/cover/contain and replacement where the current model supports them.

Do not duplicate Content-mode media management.

## 5. Text

Typography owns:

- font family
- size
- weight
- style
- line height
- letter spacing
- text/paragraph alignment
- wrapping/resizing behavior
- decorations

Visible text color belongs in Fill.

Do not create two unrelated text-color controls.

## 6. Stroke

### CSS boxes

Support:

- border color
- width
- style
- per-side state when sides differ
- opacity when representable

If all sides match, present one unified Stroke.

If sides differ, preserve and expose Top / Right / Bottom / Left through compact disclosure.

### SVG/vector

Support:

- fill
- stroke
- stroke width
- line cap
- line join
- dash pattern
- stroke opacity

Do not expose fake Figma inside/center/outside stroke alignment unless field has a deterministic implementation.

## 7. Effects

Effects is an ordered stack.

Minimum:

- drop shadow / box-shadow
- inner shadow / inset box-shadow
- text shadow
- layer blur / filter blur when safely representable
- backdrop blur where field supports it
- filter drop-shadow when present

Shadow controls:

- X
- Y
- blur
- spread
- color
- alpha
- inset

Multiple effects must preserve order and unrelated effects.

## 8. Selection colors

Add a compact **Selection colors** section.

Aggregate editable color occurrences from the selected scope.

Include at minimum:

- fills
- gradient stops
- text fills
- background colors
- borders/strokes
- SVG fills/strokes
- box-shadow colors
- inner-shadow colors
- text-shadow colors
- filter drop-shadow colors
- outline color when explicit
- text-decoration color when explicit

Exclude irrelevant browser-default/system colors.

### Scope

Single object:
- selected object
- its design-owned subtree when the selection semantically owns it, e.g. frame/group/component

Multiple selection:
- all selected objects and applicable selected subtrees

Never touch unselected matching objects.

### Row

Example:

■ #FF5A36   6
■ #111111   3
■ Brand / Accent   4

Number = occurrence count.

Variable-bound occurrences show token identity instead of pretending each is an unrelated HEX value.

### Bulk edit

Changing one Selection-color row:

- previews all selected occurrences live
- commits once
- creates one undo step
- does not affect matching colors outside the selected scope

### Tokens

If occurrences share a variable/token, ordinary raw-value editing must not silently mutate the global variable.

Safe default:

- create local overrides for selected occurrences

Global token editing must be an explicit "Edit variable" action.

## 9. Provenance / write-target behavior

### Local declaration
Edit the same source declaration.

### Responsive override
Edit the active responsive scope; preserve base values.

### Inherited value
Show rendered value. Editing creates a local override.

### Shared CSS/style rule
Do not silently mutate every consumer. Default object edit creates a local override unless the user explicitly edits the shared style.

### Variable/token
Preserve binding while untouched. Do not detach merely because a picker opened.

### Component instance
Use instance override semantics. Never silently mutate the main component. "Edit main component" is explicit.

### Computed-only / unsupported
Show rendered value read-only, explain provenance, and offer Edit in Code where appropriate.

Do not manufacture inline CSS just so every row looks editable.

## 10. Responsive context

The Inspector should understand the active Canvas viewport.

At minimum:

- indicate breakpoint-origin values
- write into the intended responsive scope
- preserve base values
- do not silently edit every breakpoint

Keep this indicator compact.

## 11. Multi-selection

Show common properties, not one Inspector per object.

- common same value → value
- common different values → Mixed
- incompatible control → hide/disable appropriately
- one edit batches all compatible selected nodes
- one undo transaction

Selection colors is the primary multi-object paint-editing surface.

## 12. Live preview + commit

Reuse the existing Canvas bridge preview path.

Desired gesture:

pointer/picker change
→ preview patch Canvas
→ continue live preview
→ commit gesture
→ one source mutation
→ authoritative render
→ Preview remains aligned

One gesture = one undo step.

Do not create source/undo entries for every color-picker mousemove.

## 13. Canonical color popover

Use the current FIGUI3 popup system rather than inventing another surface.

Compact desktop anatomy:

- spectrum
- hue
- alpha
- HEX field
- variable/style binding control
- optional alternate format selector
- eyedropper only if reliable in the supported browser path

Requirements:

- stays in viewport
- Escape closes
- focus returns to swatch
- opening/closing alone does not detach tokens or commit changes

## 14. Visual specification

Keep current compact Inspector density:

- ~260px right pane
- ~28px control rows
- precise alignment
- 1px separators
- small labels
- sparse accent
- no cards
- no giant pills
- restrained radii
- canonical field inputs/popovers
- stack drag handles only when order actually matters

Do not drift toward generic settings UI.

## 15. Accessibility

Required:

- accessible labels for swatches and paint/effect controls
- Mixed announced semantically
- visible focus
- keyboard-editable color values
- Escape/focus restoration for popovers
- keyboard alternative for stack reordering
- read-only/provenance conveyed with more than color alone
- Selection-color occurrence counts announced meaningfully

## 16. Recommended subsystem split

Do not keep growing one giant PropertiesPanel.

Conceptual separation:

editor/inspector/
- selection-style-resolver
- style-provenance
- style-write-target
- selection-colors
- inspector-mutation
- InspectorSection
- PaintStackSection
- StrokeSection
- EffectStackSection
- SelectionColorsSection
- ColorPopover
- GradientEditor

Adapt names to the current repo.

Important separation:

resolution != UI != mutation

## 17. Mutation contract

UI components must not hand-build arbitrary CSS strings.

Use typed mutation helpers that preserve unrelated values.

Examples:

- editing one box-shadow cannot drop other shadows
- editing one gradient stop cannot drop other backgrounds
- editing one border side cannot collapse intentionally different sides
- editing a token-bound property cannot silently erase the binding

## 18. Design-system integration

Build token/style provenance now.

The Selection Inspector is the everyday entry point into field's future design-system layer, so the property model must support:

- variables
- semantic tokens
- shared styles
- theme/mode bindings
- local overrides

Do not ship a raw-value-only Inspector and plan to bolt variables on later.

## 19. Figma-import behavior

Imported semantic concepts must remain recognizable:

- fills → fills
- strokes → strokes
- effects → effects
- variable/style references → bindings
- component instances → instance-aware overrides

Do not flatten them into anonymous CSS for Inspector convenience.

## 20. Special selection states

Nothing selected:
- page/document appearance only

Page/root:
- relevant page appearance/layout

Text:
- Typography + Fill + Effects + layout

Image:
- Fill/image + Stroke + Effects

Vector:
- Fill + Stroke + Effects + vector properties

Component instance:
- instance identity/properties/overrides first

Multi-select:
- common/mixed controls + Selection colors

## 21. Required tests

Resolution:
- local fill
- inherited color
- token color
- shared-rule color
- responsive override
- component instance
- gradient stops
- multiple backgrounds
- multiple shadows
- SVG fill/stroke
- mixed selection

Mutation:
- one fill edit preserves other fills
- one gradient stop preserves other layers
- border color does not destroy per-side widths
- one shadow edit preserves others
- inherited edit creates local override
- shared rule edit does not alter unrelated siblings
- raw edit does not silently mutate global token
- instance edit does not mutate main component
- responsive edit touches intended breakpoint only
- one gesture = one undo

Selection colors:
- aggregate all supported occurrences
- dedupe identical literals
- group common token bindings
- include gradients/shadows/SVG
- correct occurrence counts
- bulk edit selected scope only
- one undo
- matching unselected colors unchanged

E2E:
- text Fill
- frame gradient + border + shadow
- mixed multi-select
- Selection-color live replacement
- undo
- reload persistence
- Canvas ↔ Preview parity
- token binding preserved
- instance override remains instance-only
- populated Inspector dark + light

## 22. Acceptance criteria

Complete only when:

1. selecting an object immediately populates structured design properties
2. Fill works as a stack
3. Stroke preserves CSS/SVG semantics
4. multiple Effects are editable
5. text exposes Typography + Fill
6. Selection colors lists all supported selected-scope color occurrences
7. Selection-color bulk replacement works
8. multi-select mixed values work
9. tokens/variables preserve provenance
10. inherited/shared/component values do not mutate the wrong owner
11. unsupported computed properties are truthful/read-only
12. responsive scope is preserved
13. Canvas preview is immediate
14. source commits once per gesture
15. undo/redo is coherent
16. edits survive reload
17. Preview matches Canvas
18. dark/light Inspector states are polished
19. keyboard/focus behavior works
20. no second style truth is introduced

## 23. Scope guardrails

Do not use this assignment to:

- rewrite the whole field design graph
- replace Canvas rendering
- redesign Dashboard
- alter Cloudflare routing
- broadly rewrite Preview
- add AI style inference
- flatten all CSS into inline styles
- silently mutate shared tokens
- rewrite components/variants wholesale

The style-resolution seam should be future-compatible with the field design graph.

## 24. Implementation sequence

Pass 1 — style resolution + provenance  
Pass 2 — Fill / Stroke / Effects + deterministic mutation  
Pass 3 — Selection colors + bulk edits  
Pass 4 — multi-select / tokens / instances / responsive behavior  
Pass 5 — FIGUI3 polish + dark/light + Canvas/Preview QA

Do not close after Pass 2.

## 25. Worker closeout

Report:

- exact files changed
- style-resolution contract
- supported Inspector properties
- Selection colors behavior
- token/inheritance/component/shared-style safety
- tests
- Canvas/source/Preview parity verification
- explicit unsupported CSS cases