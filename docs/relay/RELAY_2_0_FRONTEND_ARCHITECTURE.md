# Relay 2.0 frontend architecture

Status: accepted architecture slice for `relay-2.0-live-react-dashboard-20261001`

## 1. Product boundary

Relay 2.0 replaces the current generated/static operator dashboard with a modern Vite + React application while preserving Relay's existing authority model.

The four first-class dashboard features remain:

- **today** — cross-project attention, current work, and automatic checks
- **runner** — project-scoped coordination and observed execution progress
- **inspector** — visual evidence, QA/review, and preview surfaces
- **night shift** — monitoring and continuity

The standalone `relay.loew.fi` dashboard is the primary full workspace. The opened ChatGPT Relay app may reuse the same view-models, tokens, and React components when the host permits it. Inline ChatGPT response cards remain a separate compact composition and are not owned by this migration.

This architecture does **not** change canonical Runner/Source/Cloud/Verify authority, invent a second client-side truth store, or make UI state authoritative.

## 2. Why the current frontend must be replaced

Today the web workspace is authored as static HTML/CSS/JavaScript under `apps/web/public/`.

`apps/web/build.mjs` bundles the operator and MCP bridge with esbuild, inlines styles/assets, and writes a large committed `apps/web/generated.js`. The Worker entrypoint then imports `webAssets` from that generated source file and serves it directly.

That creates several costs:

1. a generated bundle becomes part of source-control review;
2. every UI edit can produce a giant unrelated diff;
3. release correctness is coupled to a "regenerate and commit" ritual;
4. the Worker runtime is coupled to a JavaScript source representation of frontend assets;
5. the current page scripts fetch snapshots and repaint sections rather than owning a durable live state model;
6. web and MCP app reuse happens by bundling the same imperative script rather than sharing a deliberate component/view-model boundary.

Relay 2.0 removes that coupling.

## 3. Chosen stack

### Frontend

- Vite
- React
- TypeScript at the new frontend boundary
- React Router for application routes and persistent navigation state
- authored CSS/tokens from the existing Relay/Terra Prime system
- no gradient dependency or default framework visual language

Backend/runtime modules remain JavaScript unless a separate assignment changes them. TypeScript is introduced for frontend contracts and components only; it is not a pretext for a repository-wide rewrite.

### State model

The React tree must consume **canonical snapshots + observed event deltas**. Components do not fetch Relay internals directly and do not infer execution state from claim prose.

A small frontend data layer owns:

- normalized project identity
- current project context
- observed progress snapshots
- workers/automation state
- visual evidence + QA state
- connection state
- event cursor/revision
- optimistic mutation state only for a mutation currently in flight

No client state may become a parallel source of truth.

## 4. Target source layout

The exact filenames may move during implementation, but the boundary should look like this:

```
apps/web/
  index.html
  vite.config.ts
  package.json
  src/
    main.tsx
    app/
      RelayApp.tsx
      routes.tsx
      providers.tsx
    routes/
      Today.tsx
      Runner.tsx
      Inspector.tsx
      NightShift.tsx
    components/
      shell/
      status/
      projects/
      evidence/
      feedback/
    data/
      contracts.ts
      client.ts
      transport.ts
      web-sse-transport.ts
      mcp-tool-transport.ts
      store.ts
      selectors.ts
    styles/
      app.css
  public/
    brand/
  dist/                 # build output; ignored, never committed

packages/shared-ui/
  tokens.css
  components.css
  glyphs.js
  react/                 # reusable React primitives added incrementally
```

Existing view-model helpers in `src/relay-operation-ui.js`, `src/relay-project-ui.js`, card models, and QA contracts should be reused or adapted instead of reimplemented in JSX.

## 5. Routing and persistent context

The primary routes are:

- `/today`
- `/runner`
- `/runner/:project`
- `/inspector`
- `/night-shift`

Project context is URL-addressable. When a user picks a project, the selection survives route changes and reloads. The shell may encode global context as a search parameter when a route is not intrinsically project-scoped, for example `/today?project=field`.

Browser back/forward must work. Route state must not be hidden exclusively in component memory.

The current labels remain lowercase in product UI.

## 6. Live-state transport

### 6.1 Web transport

The standalone web dashboard should use a bounded authenticated server-push channel, with SSE as the preferred implementation.

Proposed route:

`GET /api/events?project=<optional>&cursor=<optional>`

The initial page load uses the existing bounded REST reads for a complete snapshot. After the snapshot commits, the client opens the event stream and applies deltas by canonical identity.

Event envelope:

```json
{
  "contract_version": "2.0",
  "cursor": 1842,
  "event_id": "evt_...",
  "type": "progress.updated",
  "project": "relay",
  "assignment": "relay-...",
  "observed_at": "2026-10-01T00:00:00Z",
  "revision": "opaque-canonical-revision",
  "payload": {}
}
```

The stream is **notification + bounded delta**, not a second database. Any gap, unknown event, revision mismatch, or cursor expiration forces a canonical snapshot refresh.

### 6.2 Reconnect and stale semantics

Connection state is explicit UI state:

- `connecting`
- `live`
- `reconnecting`
- `stale`
- `offline`

Rules:

1. initial snapshot success + stream open => `live`
2. dropped stream => `reconnecting`; preserve visible data but mark it as potentially aging
3. reconnect with valid cursor => resume deltas
4. cursor gap / server reset => refetch canonical snapshot before returning to `live`
5. bounded reconnect failure => `stale`; the UI must say the last observed time
6. never silently display old state as live

Backoff is bounded and jittered. Browser visibility can reduce reconnect pressure, but foregrounding must reconcile immediately.

### 6.3 ChatGPT MCP app transport

The opened ChatGPT app reuses the same React view-model/component layer where practical but not necessarily the same network primitive.

Define a transport interface with at least:

- `read(path)`
- `mutate(path, body)`
- `subscribe(scope, cursor, onEvent)`
- `reconcile(scope)`

For `relay.loew.fi`, `subscribe` maps to SSE.

For the ChatGPT app, `mcp-tool-transport` maps bounded reads/writes to `relay_ui_request`. If the host cannot sustain authenticated server push, `subscribe` may degrade to host-triggered refresh or bounded cursor refresh without changing components or inventing a second state model.

Inline cards are outside this transport migration.

## 7. API/runtime boundary

The existing `/api/*` routes remain the canonical UI-facing read/write seam initially.

2.0 adds only the minimum live endpoints/contracts necessary for event delivery. New frontend components must not call private GitHub/Cloudflare/Runner internals directly.

The current MCP app allowlist in `apps/web/api.js` remains a separate security boundary. Streaming support must not widen the app's arbitrary network authority.

## 8. Build and deployment contract

### 8.1 generated.js is removed from the runtime contract

Relay 2.0 must not commit a giant frontend bundle as JavaScript source.

The new contract is:

1. clean checkout at exact source SHA
2. `npm ci`
3. `vite build` for `@relay/web`
4. tests + frontend checks
5. produce `apps/web/dist/`
6. deployment consumes **that exact build artifact**
7. deployment receipt records source SHA plus build/manifest identity

`apps/web/dist/` is ignored by Git.

The old `git diff --exit-code -- apps/web/generated.js` class of gate is removed once no runtime import depends on committed `generated.js`.

### 8.2 Worker asset serving

Preferred implementation: Cloudflare Worker Static Assets (or the equivalent supported asset binding in Relay's current deployment toolchain) serves the Vite output, while the Worker continues to run first for `/api/*`, `/mcp`, evidence, and other dynamic routes.

Conceptually:

- dynamic/control routes -> Relay Worker
- application/navigation routes -> Vite `dist` assets with SPA fallback
- cache immutable hashed assets aggressively
- serve the HTML shell with revalidation appropriate to releases

If the current Relay upload path cannot attach a static asset directory directly, the implementation may package the Vite artifact into the deploy transaction, but it must remain an ephemeral build artifact and must never return to a committed giant source bundle.

The exact-source upload/deploy receipt must bind Worker code and web assets to the same commit/build identity.

## 9. Shared component and token boundary

2.0 preserves the current visual language and improves implementation quality instead of doing an unsolicited redesign.

Shared primitives should cover:

- app shell + navigation
- project context rail
- status light/badge
- progress/assignment row
- attention card
- automation row
- evidence thumbnail/card
- QA state/actions
- staff/team identity
- empty/loading/error/stale states
- motion primitives with reduced-motion fallback

The existing `packages/shared-ui/tokens.css`, component CSS, glyphs, brand marks, feature accents, and Terra Prime decisions are migration inputs.

No gradients are introduced by the architecture.

## 10. Inspector and feedback ownership

Inspector becomes a real React feature, but two boundaries stay explicit:

1. **ChatGPT inline-card host mounting remains owned by the dedicated card/host integration work.** 2.0 may consume shared card view-models/tokens but does not take over that bug.
2. The queued `relay-2.0-inspector-feedback-loop-20261001` owns the canonical feedback event/inbox contract between Inspector notes and active/resuming workers. The 2.0 shell must leave a clean component/data seam for that inbox rather than inventing a local notes store.

## 11. Migration sequence

### Phase A — architecture and build seam

- land this architecture
- add Vite/React/TypeScript frontend workspace configuration
- add ignored `dist/`
- establish Worker asset-serving strategy
- add CI proof for a clean Vite build
- keep legacy UI serving until the new shell is runnable

### Phase B — shell + route parity

- React shell, feature navigation, theme, project context
- route persistence and responsive behavior
- shared connection/stale UI
- no functional Inspector/night-shift migration yet

### Phase C — Today + Runner live prototype

This is the first proof slice.

- canonical initial snapshots
- live progress/worker event stream
- Today attention/current-work/automation surfaces
- Runner project detail
- visible reconnect/stale semantics
- mutation readback after Runner actions

Acceptance for this phase requires a user to see a Runner/progress change appear without manually reloading the page.

### Phase D — Inspector

- evidence queue
- filters/dispositions
- QA open/review flow
- existing screenshot/evidence identities
- card-preview studio as a React component consuming shared model data
- feedback inbox integration when its contract lands

### Phase E — night shift

- migrate current monitoring view
- consume the same live event layer
- preserve low-attention presentation

### Phase F — ChatGPT app reuse

- embed/reuse shared React components/view-models where the MCP host permits
- use the MCP transport adapter
- do not couple success of the standalone dashboard to host-specific inline-card rendering

### Phase G — cutover and legacy deletion

Only after production verification:

- stop importing `apps/web/generated.js`
- delete legacy static operator scripts that have migrated
- delete old build generator
- remove generated-bundle diff checks
- deploy exact Vite artifact + Worker
- verify web, MCP, API, Inspector evidence, responsive behavior, accessibility, and reduced motion
- keep rollback to the final 1.9.9 build available until 2.0 verification closes

## 12. Performance and accessibility release gates

### Performance

- route-level code splitting for Inspector/heavier QA surfaces
- lazy-load screenshot media
- avoid full-project fan-out when a scoped endpoint can satisfy the screen
- coalesce bursty event updates before React render
- do not rerender the entire workspace for one assignment heartbeat
- hashed immutable static assets
- measure production bundle size and interaction timing in CI/QA; regressions require explicit justification

### Accessibility

- complete keyboard navigation
- visible focus states
- semantic landmarks/headings
- live regions only for information that truly needs announcement
- no status communicated by color alone
- reduced-motion support for all ambient/status motion
- usable touch targets and responsive layout
- preserve usable state during reconnect/offline conditions

## 13. Testing and verification

2.0 adds frontend tests at three levels:

1. **unit/component** — selectors, event reconciliation, components, route state
2. **contract** — snapshot/event envelope, cursor gap handling, transport adapters
3. **browser** — Today, Runner, Inspector, night shift, reconnect/stale, responsive, reduced-motion, keyboard

Relay's existing exact-head Runner admission and production verification remain mandatory.

A release is not "live" because React renders. It is live only when Inspector/Runner evidence proves a canonical state change reaches the rendered dashboard without manual refresh and stale/reconnect behavior is visible and truthful.

## 14. First implementation assignment after this document

Create a dedicated implementation claim that does **not** overlap the ChatGPT card host lane.

Initial implementation paths should be limited to the Vite shell/build/live-contract slice, approximately:

- `apps/web/package.json`
- `apps/web/vite.config.ts`
- `apps/web/index.html`
- `apps/web/src/**`
- `apps/mcp/index.js` only for asset-serving integration
- `packages/runner/src/cloudflare-worker.mjs` only for the bounded live-event endpoint
- `packages/shared-ui/**` only for shared React primitives/tokens
- relevant tests/workflows
- `wrangler.jsonc` if the asset binding requires it

The first implementation PR should stop after **Today + Runner live updates work end-to-end**. Inspector/night shift migrate in follow-up slices so 2.0 does not become one unreviewable frontend megabranch.
