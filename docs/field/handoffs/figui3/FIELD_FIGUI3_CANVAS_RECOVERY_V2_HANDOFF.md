# field — FIGUI3 Canvas Recovery / Readiness V2 Handoff

## Purpose

Repair the Canvas-open path so field never exposes a blank or partially initialized editor as though the project is ready.

This handoff supersedes the earlier broad Canvas-visibility diagnosis for implementation priority. The first implementation target is now the **ProjectLoader → Canvas → FieldShell readiness contract**, with local sandbox availability checked before changing Dashboard motion.

Product: `field`  
UI baseline: **FIGUI3**  
Repository: `lrnolivia/field`  
Known-good visual baseline: `cba42ea5c2a762dec7882da763d4842354f76140`

---

# 1. Proven source baseline

The following critical files are byte-identical between the authenticated human-QA commit `cba42ea5` and current remote `main`:

| Path | Blob SHA |
| --- | --- |
| `src/FieldShell.tsx` | `545330093d9b30e84bb7b2739f1c61615e10e5f8` |
| `src/editor/EditorEntranceCoordinator.tsx` | `2e74c6a8afc4daacf8d546782da00de48cf8f4c4` |
| `src/field-shell-motion.ts` | `296d538191ca6b7f5793aafc74fe5614d05d3b08` |
| `src/styles/field-shell.css` | `0c899b2cd6d151ecf72319ca0162edaf2318d124` |
| `src/ProjectLoader.tsx` | `f91349755cda713acae5445b75ac6191495c4091` |
| `src/App.tsx` | `5ff9a1dddc16e6e00e1f4fb09c5b139cb09bc6a1` |

`41189092172516e09540749de26b75b3497691eb` (FIGUI3 closeout) is two commits ahead of `cba42ea5`; the compare contains only `tracker.md`.

Therefore:

- remote Dashboard/editor handoff source is the same source that passed visual QA
- current FIGUI3 closeout did not alter these handoff files
- if the user's local `figui3` worktree differs, inspect that divergence first
- do not broadly retune Dashboard/editor motion without local/runtime evidence

---

# 2. Immediate local environment check

field is a three-surface application in development:

- editor: `3333`
- Canvas runtime: `5174`
- Preview runtime: `5175`

Local Canvas is hard-targeted at port `5174`.

Run:

```bash
cd /Users/lrnolivia/Repos/field

git status
git branch --show-current
git rev-parse HEAD

lsof -nP -iTCP:3333 -sTCP:LISTEN
lsof -nP -iTCP:5174 -sTCP:LISTEN
lsof -nP -iTCP:5175 -sTCP:LISTEN

curl -fsS -I http://localhost:5174/
```

Canonical full environment:

```bash
npm run dev
```

`npm run dev:standalone` starts only the editor and is not sufficient for a functional Canvas.

If `5174` is absent, restore the full dev stack before evaluating any UI repair.

---

# 3. Verified contract defect: false Canvas-ready timeout

Current `ProjectLoader` renders:

```tsx
<App />
<CanvasReadyShellOverlay onReady={onCanvasReady} />
```

`CanvasReadyShellOverlay` listens for:

```text
revyme:render-complete
```

but also installs a 4000 ms failsafe.

Both the real render-complete and the timeout call the same `finish()` path.

After the fade, both unconditionally call:

```ts
onReady?.();
```

This means the timeout can falsely report "Canvas painted" when:

- the 5174 sandbox is missing
- the iframe failed
- `sandboxReady` never arrived
- no render was shipped
- the sandbox errored before render-complete

FieldShell then receives:

```text
field-shell:canvas-ready
```

and may hide Dashboard.

The resulting visible state is:

```text
healthy FIGUI3 chrome
+
blank/non-rendered Canvas
```

That is a **P0 implementation-integrity defect**.

---

# 4. Verified contract defect: initialization errors are converted to success

`ProjectLoader` currently does this on initialization failure:

```ts
init().catch(err => {
  trace.error('project-loader:init-error', err);
  // Show app anyway so user isn't stuck on blank screen
  if (!cancelled) setReady(true);
});
```

This mounts `<App />` after an incomplete/failed project initialization.

Then the 4-second Canvas failsafe can certify that partial state as ready.

This is the second false-success path and must be repaired together with the Canvas timeout.

A failed project load is not a usable project.

---

# 5. Current good architecture to preserve

Do not remove these concepts:

- persistent Dashboard + Builder layers
- Dashboard remains above Builder until actual reveal
- ProjectLoader mounts App before visual reveal to allow Canvas startup
- cross-origin Canvas sandbox
- real `renderComplete` emitted by the sandbox bridge
- FIGUI3 editor entrance choreography
- Canvas excluded from editor-chrome entrance animation
- reduced-motion path in editor entrance
- ProjectLoader shell can fade over an already-painted Canvas

The fix is to make readiness truthful, not to discard the architecture.

---

# 6. Required state model

Replace the current boolean/failsafe semantics with explicit states.

Recommended model:

```ts
type ProjectLoadState =
  | { phase: 'project-loading' }
  | { phase: 'project-error'; error: Error }
  | { phase: 'canvas-starting' }
  | { phase: 'canvas-delayed' }
  | { phase: 'canvas-error'; error?: Error }
  | { phase: 'canvas-painted' }
  | { phase: 'revealed' };
```

The exact type naming may differ, but the semantic distinctions are mandatory.

## Allowed transitions

```text
project-loading
  → project-error
  → canvas-starting

canvas-starting
  → canvas-delayed
  → canvas-error
  → canvas-painted

canvas-delayed
  → canvas-error
  → canvas-painted

canvas-error
  → retry → canvas-starting
  → canvas-painted if the runtime self-recovers

canvas-painted
  → fade shell
  → revealed
```

## Forbidden transitions

```text
project-error → revealed
timeout → canvas-painted
timeout → onCanvasReady
sandbox-error → onCanvasReady
```

---

# 7. Signal path: make first Canvas paint deterministic

The current readiness listener is a lossy global window event.

Keep `revyme:render-complete` for existing consumers, but do not use it as the primary ProjectLoader readiness contract.

Preferred direct signal:

```text
sandbox RenderComplete
  ↓
Canvas onFirstCanvasPaint()
  ↓
App onCanvasFirstPaint()
  ↓
ProjectLoader
  ↓
one painted frame
  ↓
loading shell fades
  ↓
onCanvasReady()
  ↓
FieldShell may hide Dashboard
```

## Suggested API shape

### `Canvas.tsx`

Add narrow callbacks:

```ts
type CanvasProps = {
  onFirstCanvasPaint?: () => void;
  onCanvasRuntimeError?: (error: Error) => void;
};
```

Use a ref so `onFirstCanvasPaint` fires once per mounted Canvas:

```ts
const didReportFirstPaintRef = useRef(false);
```

Inside the existing sandbox `onRenderComplete` callback:

```ts
if (!didReportFirstPaintRef.current) {
  didReportFirstPaintRef.current = true;
  onFirstCanvasPaint?.();
}
```

Do not remove the existing `window.dispatchEvent(new Event('revyme:render-complete'))` because other systems consume it.

### `App.tsx`

Accept narrow pass-through props and forward them to `<Canvas />`.

Do not move Canvas lifecycle state into general document atoms.

### `ProjectLoader.tsx`

Own the loading/recovery state.

A timeout may change:

```text
canvas-starting → canvas-delayed
```

but may not call `onCanvasReady`.

Only a real first Canvas paint may enter `canvas-painted`.

---

# 8. Sandbox error propagation

Current sandbox errors are only traced:

```text
postmessage-bridge:sandbox-error
```

They do not reach ProjectLoader.

Add a bounded error callback through the existing bridge chain:

```text
PostMessageBridge
→ SandboxBridgeManager
→ useSandboxBridge
→ Canvas
→ App
→ ProjectLoader
```

Do not put this into mutation/document state.

The purpose is only lifecycle/error reporting.

Connection failure before the iframe can emit an error still needs the delayed timeout state.

---

# 9. UI/UX behavior

field is an **Operate** surface: clarity, state truth, scanability, and continuity matter more than decorative loading animation.

## A. Project hydration

While project data itself is loading:

- use the editor scaffold
- label the state semantically as "Opening project"
- do not expose interactive editor controls
- no fake Canvas-ready path

## B. Canvas starting

After project data is loaded and App mounts:

- keep the FIGUI3 scaffold stable
- center status in the Canvas region, not in the entire viewport
- the status can be visually minimal
- allow the actual Canvas to paint behind the shell
- when real paint arrives, fade shell over the already-drawn page

## C. Delayed startup

After the current ~4 s threshold:

Do **not** reveal blank Canvas.

Change the center status to something like:

```text
Canvas is taking longer to start
[Retry]  [Back to projects]
```

Keep listening for the real Canvas paint so the state can self-recover.

No alarmist red screen.

## D. Canvas runtime error

Direct builder load:

```text
Canvas couldn't start

The project loaded, but the visual canvas did not.

[Retry]
[Back to projects]
```

Technical details may live behind a disclosure/debug affordance, not as primary copy.

Dashboard → project:

- Dashboard stays visible
- do not perform the Dashboard → editor reveal
- show a compact field-style notification / status
- offer Retry
- do not replace the Dashboard with a modal

The mental model is:

> the project did not open yet

not:

> the editor opened broken

---

# 10. FIGUI3 loading-shell parity

The current `BuilderLoadingShell` visually drifts from current FIGUI3.

Current shell still uses:

- old cut-corner slab classes
- fixed 308px left shell
- fixed 260px right shell
- both sides always docked
- old Revyme-era loading silhouette

Current FIGUI3 workspace instead uses:

- rectilinear docked panes
- restrained rounded floating pane when only one side is visible
- persisted left/right pane visibility
- `deriveWorkspaceLayout(...)`
- `ChromeIslands` as current structural truth

## Repair

Do not maintain a second hand-built editor geometry.

Either:

1. derive loading-shell geometry from the same workspace layout primitive, or
2. extract/reuse a lightweight shared structural shell.

At minimum use:

```ts
deriveWorkspaceLayout(leftOpen, rightOpen)
```

with the same pane widths/insets/radii.

The loading shell must not teach the user a different editor layout for 300–4000 ms and then snap into FIGUI3.

---

# 11. Accessibility findings

Focused audit: ProjectLoader / Canvas reveal subsystem.

## P1 — covered editor remains keyboard reachable

`CanvasReadyShellOverlay` blocks pointer input with a full-screen layer but does not make the mounted App inert on direct builder load.

Result:

- keyboard focus can move into controls hidden beneath the loading shell
- screen-reader users may encounter the loaded editor while sighted users still see loading

Fix:

- keep the App subtree inert until actual Canvas paint
- expose `aria-busy="true"` on the relevant workspace host
- remove inert only when the real Canvas is ready

Do not use `aria-hidden` alone on focusable content.

## P2 — loading has no semantic status

The skeleton has no meaningful `role="status"` / accessible loading label.

Fix:

```text
role="status"
aria-live="polite"
```

with concise text such as:

```text
Opening project
Starting canvas
```

The decorative skeleton itself should remain hidden from assistive technology.

## P2 — loading pulse ignores reduced motion

`rvy-shell-pulse` always runs.

Fix:

- disable the pulse under `prefers-reduced-motion: reduce`
- preserve the loading hierarchy without animation
- Canvas/editor handoff may settle immediately in reduced-motion mode

## P2 — loading shell visual structure does not match persisted pane state

This creates unnecessary visual movement and cognitive discontinuity.

Fix with shared workspace-layout primitives.

---

# 12. Focused UIAudit score

This score applies only to the ProjectLoader / Canvas-reveal subsystem, not all of field.

| Dimension | Score | Key finding |
| --- | ---: | --- |
| Accessibility | 2/4 | covered editor can remain keyboard reachable; no semantic loading state |
| Performance | 3/4 | opacity/transform choices are efficient; no major runtime-heavy loading effect |
| Responsive / workspace adaptation | 2/4 | loading shell hard-codes both docked panes instead of current workspace state |
| Theming | 3/4 | shell mostly uses tokens; some legacy fallback/old-builder styling remains |
| Implementation integrity | 1/4 | timeout + init failure can both masquerade as successful Canvas readiness |
| **Total** | **11/20** | **Acceptable, but readiness integrity is blocking** |

## Implementation integrity verdict

**FAIL until false-success paths are removed.**

The code currently claims a stronger state ("Canvas ready") than the runtime has proven.

---

# 13. Existing positives to preserve

- real sandbox `renderComplete` signal already exists
- CanvasRenderer correctly refuses to render before sandbox readiness
- FieldShell already gates Dashboard hide on `onCanvasReady`
- editor entrance has a reduced-motion path
- Canvas itself is not included in editor-chrome entrance targets
- loading fade uses compositor-friendly opacity
- Dashboard/Builder persistence avoids full page reloads

The architecture is close. The readiness semantics are the broken layer.

---

# 14. E2E requirements

Playwright already provides the correct real runtime shape:

- editor on `4333`
- Canvas sandbox on `5174`

Add runtime tests, not source-string tests.

## Test A — direct builder happy path

Assert:

1. project initializes
2. iframe loads
3. sandbox ready
4. render is shipped
5. real renderComplete occurs
6. loading shell fades
7. App becomes interactive
8. Canvas is nonzero and visibly rendered
9. `onCanvasReady` occurs only after renderComplete

## Test B — Dashboard → project happy path

Assert:

1. Dashboard visible
2. project requested
3. Builder mounts behind Dashboard
4. real Canvas paint occurs
5. Dashboard begins hiding only after paint
6. FIGUI3 entrance settles
7. website pixels are visible

## Test C — sandbox unavailable

Block the Canvas document request or run without 5174.

Wait beyond the delayed threshold.

Assert:

- no `field-shell:canvas-ready`
- no Dashboard hide on Dashboard-first open
- no blank editor reveal
- state becomes delayed/unavailable
- Retry action exists

## Test D — project initialization failure

Force `backend.loadProject()` or equivalent initialization to reject.

Assert:

- App is not treated as usable
- Canvas-ready cannot occur
- direct load shows project recovery UI
- Dashboard-first open stays on Dashboard and reports failure

## Test E — keyboard/inert

During Canvas startup:

- tabbing must not enter covered editor controls

After real paint/reveal:

- editor becomes keyboard interactive

## Test F — reduced motion

With reduced motion enabled:

- no pulsing skeleton animation
- no unnecessary reveal spring
- readiness semantics remain identical

---

# 15. Acceptance criteria

The repair is complete only when:

1. a timeout can never call semantic Canvas-ready
2. project initialization failure can never call semantic Canvas-ready
3. Dashboard does not leave until a real Canvas paint
4. direct builder load does not expose a blank editor on sandbox failure
5. Canvas errors have an explicit recovery state
6. loading shell matches current FIGUI3 workspace geometry
7. covered App is inert to keyboard/pointer interaction
8. loading/error states have semantic screen-reader output
9. reduced motion is honored
10. real Canvas paint still fades smoothly into the live editor
11. existing Dashboard ghost-frame fix remains intact
12. existing no-bare-Canvas handoff remains intact
13. source-string unit tests are supplemented with real E2E coverage
14. `npm run test:run` passes
15. TypeScript passes
16. `npm run build:all` passes
17. live visual QA passes direct-load and Dashboard-open paths

---

# 16. Scope guardrails

Do not initially modify:

- Canvas mutation system
- selection/drag/resize architecture
- generated source
- Preview runtime
- Camera model
- FIGUI3 Inspector
- BottomToolbar behavior
- Dashboard motion curves
- Cloudflare production routing

Only expand scope when runtime evidence proves one of those layers diverges before the readiness boundary.

---

# 17. Worker report format

## Root cause

State the first proven divergence.

## Local environment

Report editor/Canvas/Preview ports and branch/HEAD.

## Changes

Exact files and contract changes.

## UI changes

Loading, delayed, error, retry, accessibility.

## Validation

Unit tests, E2E, TypeScript, build, live visual QA.

## Regression protection

Confirm Dashboard ghost-frame and bare-Canvas fixes remain intact.

## Remaining risk

Only concrete unresolved risks.