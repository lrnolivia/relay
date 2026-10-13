# field — FIGUI3 Canvas Visibility Regression Addendum

## New verified findings

### 1. The remote motion/reveal postimage is known-good and unchanged

The authenticated human-QA commit is:

`cba42ea5c2a762dec7882da763d4842354f76140`

The following files are byte-identical between that commit and current remote `main`:

| Path | Blob SHA |
| --- | --- |
| `src/FieldShell.tsx` | `545330093d9b30e84bb7b2739f1c61615e10e5f8` |
| `src/editor/EditorEntranceCoordinator.tsx` | `2e74c6a8afc4daacf8d546782da00de48cf8f4c4` |
| `src/field-shell-motion.ts` | `296d538191ca6b7f5793aafc74fe5614d05d3b08` |
| `src/styles/field-shell.css` | `0c899b2cd6d151ecf72319ca0162edaf2318d124` |
| `src/ProjectLoader.tsx` | `f91349755cda713acae5445b75ac6191495c4091` |
| `src/App.tsx` | `5ff9a1dddc16e6e00e1f4fb09c5b139cb09bc6a1` |

`41189092172516e09540749de26b75b3497691eb` (FIGUI3 closeout) is two commits ahead of `cba42ea5`; the GitHub compare contains only `tracker.md`.

Therefore the FIGUI3 closeout includes the human-QA Dashboard/Canvas motion postimage.

If the local `figui3` worktree currently shows the broken Canvas, first diff the local versions of these files against the blob postimage above.

---

## 2. Corrected CSS hypothesis

`src/styles/dashboard.css` gives `.field-dashboard-page` an opaque background, but current `src/styles/field-shell.css` already overrides it with the more specific:

```css
.field-dashboard-layer .field-dashboard-page {
  background: transparent;
}
```

Do not modify that again. The persistent Dashboard root is already transparent.

---

## 3. Verified readiness-contract defect

`ProjectLoader` claims to keep its shell over `<App />` until Canvas has actually painted.

However, `CanvasReadyShellOverlay` treats these as equivalent:

1. real `revyme:render-complete`
2. a 4000 ms timeout

Both call the same `finish()` path. After a 280 ms fade, both unconditionally call:

```ts
onReady?.();
```

That means `FieldShell` can receive `onCanvasReady` even when Canvas never rendered.

Failure cases include:

- sandbox server on 5174 not running
- iframe load failure
- no `sandboxReady` message
- no render shipped
- sandbox error before render-complete

Once the false ready is emitted, Dashboard may hide and reveal healthy FIGUI3 chrome surrounding an empty Canvas.

This violates the existing semantic contract.

---

## 4. Why missing port 5174 exactly produces this symptom

field local development is a three-surface app:

- editor: 3333
- Canvas runtime: 5174
- Preview runtime: 5175

`SANDBOX_ORIGIN` resolves local Canvas to port 5174.

`CanvasRenderer.render()` explicitly refuses to forward when:

```ts
!this.sandboxReady || !this.bridge
```

`forceRender()` also returns false for the same condition.

Therefore, if the sandbox is missing:

```text
iframe never becomes ready
→ renderer ships nothing
→ no renderComplete
→ ProjectLoader waits 4 seconds
→ timeout follows fake completion path
→ onCanvasReady fires
→ Dashboard may hide
→ blank Canvas is exposed
```

Immediate local checks:

```bash
lsof -nP -iTCP:3333 -sTCP:LISTEN
lsof -nP -iTCP:5174 -sTCP:LISTEN
lsof -nP -iTCP:5175 -sTCP:LISTEN
curl -fsS -I http://localhost:5174/
```

Canonical dev command:

```bash
npm run dev
```

The editor-only command:

```bash
npm run dev:standalone
```

does not start the Canvas runtime.

---

# Implementation direction

## A. Separate shell timeout from painted readiness

The timeout must never satisfy `FieldShell`'s painted-Canvas gate.

Track completion source:

- `render-complete`
- `timeout`

Only `render-complete` may call the semantic `onCanvasReady`.

## B. Prefer direct first-paint signaling

Keep the legacy `revyme:render-complete` window event for existing consumers, but ProjectLoader readiness should ideally use a direct one-shot callback:

```text
sandbox renderComplete
→ Canvas onFirstCanvasPaint
→ App
→ ProjectLoader
→ one painted frame / shell fade
→ onCanvasReady
→ FieldShell reveal
```

This removes the event-listener race from the readiness contract.

## C. Surface sandbox failure

`PostMessageBridge` currently handles sandbox `{ type: 'error' }` by tracing:

`postmessage-bridge:sandbox-error`

It does not forward an error callback through:

- `SandboxBridgeManager`
- `useSandboxBridge`
- `Canvas`
- `ProjectLoader`

Add a bounded lifecycle/error signal so the loading layer can distinguish:

- loading
- sandbox ready
- rendered
- unavailable/error

Do not put this in document state or mutation state.

---

# E2E coverage

Playwright already boots:

- editor on 4333
- Canvas sandbox on 5174

Add two tests.

## Normal path

Assert:

1. sandbox reaches ready
2. render is shipped
3. renderComplete arrives
4. `field-shell:canvas-ready` occurs
5. Dashboard becomes hidden
6. `editorEntranceState` settles
7. rendered page pixels/viewport are present

## Failure path

Block or disable the Canvas document request.

After >4 seconds assert:

- no false `field-shell:canvas-ready`
- Dashboard-first navigation does not hide Dashboard as though Canvas rendered
- timeout is represented as unavailable/error, not painted
- FIGUI3 remains stable

---

# Updated debug priority

1. Check local 5174.
2. Diff local `figui3` critical files against the known-good blob postimage.
3. Repair the false-ready contract.
4. Add E2E coverage.
5. Only reopen Dashboard/editor motion if local source or runtime traces prove it diverged first.