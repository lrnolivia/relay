# field Media system — implementation plan

Status: core implementation is integrated on `main`; post-polish hardening is active.

## Implementation status — 2026-09-29

Shipped on `main`:

- one canonical project Media model across toolbar, floating, sidebar, contextual, Content, and canvas ingest surfaces
- project-scoped Media session/catalog/upload state; project switching cannot leak session Media between projects
- toolbar Media → anchored launcher → same-shell typed browser → expandable free-standing Media
- Media is a first-class bottom-toolbar surface and is not modeled in the Insert category data at all; this prevents stale/programmatic Insert state from recreating the duplicate nested Media panel
- canonical All / Images / Video / Audio inventory with SVG/vector coverage, shared search, selection, source/sort controls, and durable/session inventory merging
- shared ingest lifecycle with exact-content session deduplication, upload queue, cancellation, safe retry, duplicate handling, Finder/Desktop drop ingest, and persistent upload tray
- contextual placement: matching selected image/video/audio = replace source; selected structural container = place inside; otherwise insert
- async toolbar uploads capture their placement target before upload so later selection changes cannot redirect the result
- Gallery remains a composition intent, not a Media kind; the wizard supports multi-image selection, dedupe, reorder/remove, layout/behavior steps, transactional rollback, and now preserves the container target captured when the Gallery flow begins
- contextual Image, Video, Audio, Fill, CMS/content, Gallery, and reusable image-value pickers share the same Media catalog/ingest semantics
- external/search-picked media become shared session Media references rather than isolated picker-only values
- Create remains truthfully unavailable where no generation provider exists
- Preview remains free of field Media editing/upload chrome

Visual polish already merged:

- PR #101 — Media library/viewer polish
- PR #103 — Media creation, tabs, toolbar popups, upload surfaces, and Gallery wizard polish

Recent hardening commits:

- `79e9b2c` — project-scope Media session/catalog/upload state
- `986c2dd` — contextual toolbar Media replacement
- `2ad35b1` — selected-container Media placement through the canonical insertion engine
- `148b2b9` — preserve Gallery container placement across the multi-step/async creation flow

Upload behavior audit:

- the canonical browser is batch-capable and the global upload tray owns active progress, cancel, retry, dismissal, and completed-collapse behavior
- toolbar/canvas/browser uploads retain safe retry continuations where the operation can be replayed deterministically
- contextual Image/Video picker uploads intentionally do not globally replay picker callbacks after those picker contexts close; cancellation remains non-error and successful retry is therefore not allowed to mutate a stale contextual UI
- one failed browser upload does not halt the remaining batch; duplicate handling remains item/session aware

Architecture guardrails:

- Media is toolbar-owned. Do not reintroduce `Insert → Media`; the duplicate sidebar route created an oversized nested panel and visually broke the left-side shell.
- The earlier `Insert → Media` guardrail is superseded by the current product decision: Media belongs in the main toolbar only.
- the generic `media-gallery` toolbar compatibility panel was proven caller-free across the toolbar store/host, bottom toolbar, left rail/panel, and canonical Media controller, then removed from the panel union and host.

Validation status:

- focused regression contracts cover sidebar independence, canonical browser routing, upload lifecycle/cancel/retry, project isolation, contextual placement, Gallery transaction rollback, and the preserved Gallery container target
- this Composio session has not executed the repository build or Vitest suite; do not treat committed tests as executed validation evidence


## Product rule

Media is one project-level system expressed through several deliberate surfaces. The same media objects, upload state, provenance, deduplication, selection semantics, and usage references must be reused everywhere. Surfaces may change density and controls, but must not become independent media silos.

The interaction principle is:

> drop it → see it → use it → keep moving

Preview remains runtime truth and does not gain field editing/upload chrome.

## Batch 1 — foundation + shared interaction model

Build the canonical Media types/state before replacing visible upload surfaces.

- shared Media kinds: All, Images, Video, Audio, Embeds, Vectors where applicable
- Gallery is a composition/intent, not a media kind
- shared session state: surface, route, intent, search, selection, scroll, target/source context
- shared upload queue states
- deterministic MIME/type mapping and compatible-file filters
- shared primitives for tiles, grids, drop targets, progress, empty/error states
- exact-content deduplication; filename equality alone is not duplication
- new mixed-media glyph distinct from the Image landscape glyph
- keyboard/focus contracts shared across shells

Acceptance:
- later surfaces can consume one Media model without inventing their own routing/state
- Gallery routes through Images in multi-select intent
- upload/generation can resolve into the same library identity

## Batch 2 — canonical browser + sidebar Media

Build the full browser first, then the docked sidebar form.

- full free-standing Media workspace: search, type views, upload, filters/sort, selection, metadata, source/provenance, usage references
- promote Media out of Elements into a first-class row under Insert
- `Insert → Media` opens the docked sidebar Media browser
- sidebar is dense: browse/search/filter/upload/drag-to-canvas; full metadata stays in expanded Media
- toolbar actions never hijack the left sidebar
- remove the old static Media subsection from Elements once replacement coverage exists

Acceptance:
- one project library is visible in both full and sidebar shells
- navigating Media in the left sidebar does not change toolbar panel state
- Design media can be dragged/inserted from the sidebar through the existing toolbar-drag pipeline

## Batch 3 — toolbar launcher + anchored dynamic Media

Replace the current Media dropdown/pickers with one toolbar-connected dynamic panel.

Home state is a compact ~224 px vertical launcher:

- Upload
- Browse media
- Image
- Gallery
- Video
- Audio
- Embed
- Paste from clipboard

Rules:

- main Media glyph opens the launcher directly
- no modal X; dismiss via Media button, click outside, or Escape
- top-right control is expand glyph only, no “Expand” label
- panel remains physically anchored to the Media toolbar control
- actions deep-link into the same anchored Media component rather than spawning unrelated dialogs
- back returns to launcher
- Image/Video/Audio open their scoped browser view
- Gallery opens Images in multi-select/gallery intent
- Embed opens embed-provider creation state
- Upload opens the native picker immediately
- Paste ingests immediately
- Create/generation lives inside Media and generated results automatically enter Media
- expand morphs anchored Media into full free-standing Media while preserving route, search, selection, scroll, creation state, and intent

Acceptance:
- old toolbar dropdown is no longer the product model
- no toolbar action sends the user to sidebar Media
- expand is state-preserving rather than a close/reopen reset

## Batch 4 — contextual integrations

Replace remaining bespoke media inputs with shared Media intents.

Design:
- canvas drop targets wake only valid destinations
- empty canvas = place; media node = replace; container = place inside
- inspector media row opens compatible contextual picker
- direct drop onto inspector preview replaces
- actions: Replace, Reveal in Media, Download original, Remove

Gallery:
- select multiple Images in Media, then create Gallery
- resulting Gallery is a design composition; source assets remain Media assets

Content:
- compact empty/populated media field states
- choose existing, upload, replace, alt/caption/focal-point support
- ingestion is not blocked by missing alt text; content completeness is separate

Code:
- same ingest engine, but path-aware
- collisions offer Replace existing / Keep both / Rename
- do not silently mutate source paths

Preview:
- no field Media editing UI
- real runtime file inputs continue to behave as the website does

Acceptance:
- bespoke uploaders/pickers are replaced by shared Media routing and primitives
- intent is inferred from invocation context but can be changed where appropriate

## Batch 5 — delight, migration, hardening + parity

Finish the system as a professional field feature.

Feedback:
- tiny local upload receipt for quick toolbar uploads
- persistent upload tray for batches/long-running work
- item-level retry/cancel/error; one failure never blocks the queue
- completed queue collapses quietly

Progressive disclosure:
- no mandatory rename/metadata/folder/optimization ceremony before ingestion
- controls remain available after ingestion

Motion:
- launcher ~140–180 ms
- anchored → full ~180–240 ms
- subtle tile resolve and canvas replacement crossfade
- reduced-motion becomes immediate state changes
- no confetti/bounce/decorative motion

Visual:
- compact Inter
- 24 px-ish controls
- thin 14–16 px glyphs
- restrained 4–6 px floating radii
- rectilinear docked panes
- minimal elevation
- sparse accent
- media itself supplies most color
- no generic SaaS uploader cards, giant pills, decorative glass, or giant dashed upload zones

Migration:
- remove old toolbar Images/Video/Audio/Gallery picker implementations only after replacement coverage exists
- remove Media subsection from Elements
- preserve paths/references
- keep Image landscape glyph; use the new mixed-media glyph for Media
- remove dead Media CSS/components only when proven unused

Validation:
- dark/light
- keyboard/focus/Escape/click-outside
- drag/drop + clipboard
- upload batches/failure/retry
- duplicate handling
- Gallery multi-select
- generation
- toolbar expand state preservation
- sidebar independence
- contextual inspector + Content
- source-path collisions
- reduced motion
- narrow editor widths
- no toolbar → sidebar navigation leakage
- no Preview editor leakage
