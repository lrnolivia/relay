# Relay screenshot evidence plan

Review draft for Lauren and the Relay engineering team

Prepared 7 October 2026 UTC. Source snapshot checked through 04:56:28 UTC. Planning only. No implementation, screenshot upload, ownership claim, repository change, or deployment is authorized by this document.

## 1 Recommended outcome

Make every screenshot capture made through a supported, Relay-connected agent integration produce a durable capture event. Extend the existing Runner Visuals evidence system in Relay, store eligible image bytes once, and make Inspector the place to browse and review them by project, feature, and run. Relay links, Inspector views, task details, and agent receipts must all refer to the same event and artifact identities.

This includes intermediate screenshots: exploration, reproduction, before and after changes, failed attempts, interaction checkpoints, and final review. A screenshot does not have to be selected as final QA evidence to belong in the record. Repeated captures of identical pixels remain separate events even when their bytes share one stored object.

The guarantee must be precise: every capture observed by an enabled, authorized adapter is accounted for as stored, pending, withheld, unavailable, or lost. Connecting an MCP server alone does not make unrelated screenshot tools interceptable. Unsupported provider captures must be visible as coverage limitations rather than silently counted as uploaded. A screenshot receipt establishes capture and storage, not that the product works or a test passed.

Recommended first release:

- One event and artifact contract used by Relay's existing browser capture paths, a supported local capture wrapper, and a CI adapter.
- A durable asynchronous upload outbox with idempotent finalization and honest run coverage.
- Project → feature → run browsing, chronological contact sheets, a full-size viewer, and an Unassigned area.
- Private-by-default evidence with explicit capture scope, redaction, retention, and access controls.
- Compatibility with existing evidence IDs and Inspector URLs, preserving canonical shared UI and assets.

The approval sought is agreement on this design and the rollout gates. Implementation must be commissioned separately after refreshing current source, Runner policy, and live ownership.

## 2 What is verified and what remains proposed

### Verified source and coordination snapshot

The read-only Relay source inventory returned `lrnolivia/relay` main at `9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e` on 7 October 2026 at approximately 04:46 UTC. The inventory was not truncated. It listed draft PR 166, “fix: validate Relay source contracts and bundled Worker startup,” with head `c6acbcea29c6bcfd9d84c4c22d7fb73f2e7b9193`, still open. The main SHA is a source snapshot, not proof of the deployed runtime.

The canonical Runner project list at 04:46:27.937 UTC identified `relay` as `lrnolivia/relay` and `ctrl` as `lrnolivia/ctrl`, both managed projects with coordination enabled. Inspector is a Relay capability. The pinned MCP entrypoint already redirects the `/inspector` website route to CTRL, while Relay handles its backend/API paths. Preserve this existing host/backend boundary; do not move repositories or create a second evidence backend in CTRL. [MCP entrypoint](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/apps/mcp/index.js)

The connected MCP contract exposes `relay_verify_browser_screenshot`, `relay_verify_browser_snapshot`, and `relay_verify_browser_capture`. Their descriptions say they persist PNG screenshot evidence; the latter binds an existing Browser Run session and its interaction trace. The exposed screenshot context already includes project/project ID, assignment, owner, branch, commit SHA, deployment ID, environment, route kind, surface, and PR number. Those tool descriptions establish available interfaces, not complete implementation behavior or successful runtime execution.

A canonical project-detail read initially hit a GitHub App rate limit. After its reset, the bounded read at 04:56:26.022 UTC succeeded: coordination record blob `f2c8eeecf41ac5862e1e1d988e5616c88a5b7cb7`, policy blob `f100beb1c8455f59da2b4a152878ddab2ceccdee`. It showed active claims for production-smoke synchronization and `relay-mcp-rebuild-continuation-20261003`. The latter includes CI, executor/checkpoint, toolchain, source-test contract, and web build paths. Its broader queued scope also names core Relay packages. This is overlap to reconcile before implementation, not available ownership. No identity was switched to bypass the limit. Historical local files were used only for path discovery.

### Existing architecture to extend

The current [Visual Evidence Policy](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/docs/VISUAL_EVIDENCE_POLICY.md) already designates Runner Visuals as the durable index for QA media produced across Relay, Inspector, Runner, browser engines, and project harnesses. It requires stable IDs and context, asynchronous durable upload receipts, content-addressed deduplication, bounded storage, protected active evidence, and retention/archive receipts. Those are existing policy requirements; this review did not establish that every path fully implements them. Lauren's request broadens collection to every eligible observed capture, including intermediate captures that are never selected as QA evidence.

Verified implementation seams at the pinned commit:

- `wrangler.jsonc` binds `EVIDENCE` to the existing `loew-inspector-evidence` R2 bucket and defines Browser Run and `RELAY_EVENTS` bindings. Reuse the existing storage identity and auth boundary rather than provision a parallel store. [Runtime configuration](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/wrangler.jsonc)
- `apps/mcp/index.js` sends authenticated operator API requests to Runner and publishes evidence invalidations after successful `/evidence/ingest` and `/evidence/run` requests. These are existing integration points to inspect and extend, not proof of their downstream contracts. The Inspector package re-exports `src/relay-entry.js`. [Entrypoint](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/apps/mcp/index.js), [Inspector package](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/packages/inspector/index.js)
- The Inspector review client queries `/api/visual` by project with pagination, requests per-evidence QA records, and consumes the shared work viewer/view model. Its `evidenceKey` groups by project/target, step/surface, viewport, and commit/PR/run, then drops later records with the same key from the rendered list. That presentation dedup can hide distinct captures. The new chronological view must key on canonical event identity and only collapse repeated captures into explicitly expandable groups. [Review client](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/apps/web/public/operator-review.js#L154-L199)

### Boundaries of this review

The source verification addendum records five successful pinned source-file reads and the current coordination read. The downstream ingestion/storage implementation, CTRL's current source, archive configuration, actual deployment, and every provider adapter remain unverified Gate 0 prerequisites. No screenshot capture, uploader, migration, security test, or UI flow was executed as part of planning. All new field names, API names, storage layout, budgets, targets, and behavior below are proposals unless explicitly marked as existing.

Existing source landmarks to inspect before implementation include the Inspector package, MCP entrypoint, browser/evidence code, evidence workflows, project registration, and canonical shared UI. Confirm actual imports and ownership at the admitted commit rather than treating these landmarks as a prescribed file patch list.

## 3 Product contract and support boundary

### What counts as a capture

A capture event means a screenshot-producing operation was invoked and the adapter observed its outcome. It has its own event ID even if another event has identical pixels. Capture purpose is descriptive: `exploration`, `reproduction`, `before`, `after`, `checkpoint`, `review`, or `other`. Purpose never affects whether an otherwise eligible screenshot is collected. Unknown purpose is acceptable and labeled.

Record attempted captures separately from successful image production. A browser crash before an image exists is a capture attempt with no image, not a missing stored screenshot. A produced screenshot whose bytes cannot be retrieved is an observed capture with unavailable bytes. A provider that exposes neither capture hooks nor receipts is an unobservable source; do not invent individual events or an expected count for it.

Reading or displaying an existing screenshot does not create a new capture. Crops, annotations burned into an image, or redactions create derived artifact versions linked to their parent. A new screenshot of the same screen is a new capture event. A video is not implicitly expanded into frame captures in this release.

### Capture adapters and explicit intake

Use adapters at the point where the screenshot tool already returns bytes or a stable file handle. The adapter journals the event and queues upload without making the model copy image data or repeatedly call tools. Preserve the original screenshot tool's return shape and local artifact.

Provide an explicit MCP intake for agents or plugins that can supply screenshot bytes but cannot install a capture hook. This is a fallback and interoperability path. Instructions saying “remember to upload” are useful onboarding but cannot establish automatic coverage. A filesystem watcher alone is insufficient: it misses overwritten files, mistakes downloads for captures, and can sweep unrelated private screens.

| Capture environment | Proposed integration | Coverage claim allowed | Important boundary |
| --- | --- | --- | --- |
| Relay Browser Run screenshot and session capture | Hook the existing persistence boundary and normalize its receipt | All captures through instrumented Relay entrypoints | Preserve allowed target validation and existing session behavior |
| Relay deterministic browser CI | Screenshot wrapper plus job manifest and final outbox flush | Instrumented screenshot calls and declared expected checkpoints | A job killed before capture/flush can leave explicit gaps |
| Agent-owned local Playwright or browser harness | SDK/wrapper around actual screenshot calls | Calls routed through the installed wrapper | Direct calls that bypass it remain outside coverage |
| Local desktop or computer-use tools | Provider-supported post-capture adapter, where hooks and bytes exist | Only the exact provider/version proven by a conformance test | MCP connection alone cannot intercept OS/provider captures |
| Hosted agent browser or provider tools | Supported artifact callback/export, otherwise explicit intake | Observed callbacks or submitted captures | Opaque attachments, hidden bytes, or expired handles are unavailable |
| Other connected plugins | Versioned capability handshake and explicit intake | The plugin's declared and tested integration | Plugin installation does not imply screenshot access |
| Manual import of selected older screenshots | Explicit import with supplied source metadata | Imported records only | Preserve unknown origin and time; never label automatic |
| Uninstrumented tools | No automatic claim | `unsupported` or `unobservable` | No ambient screen scraping or hidden file collection |

At run start negotiate a capability record: adapter/version, capture source, observation mode, bytes access, supported MIME types, durable outbox support, final manifest support, privacy policy version, and scope. Advertise `full`, `partial`, `explicit_only`, or `unsupported` per source. “Full” is relative to an enumerated, tested source boundary, never all possible tools on a computer.

## 4 One canonical evidence architecture

### Event flow

1. Resolve authenticated account and authorized capture scope. Bind the registered project and, when known, the current assignment and capture run. Do not create a Runner claim just to collect screenshots.
2. Before the instrumented screenshot call, reserve a local event ID and append an attempt to a durable journal. After bytes return, append the observed outcome and sanitized metadata. The wrapper must expose a journal failure without pretending the event was queued.
3. Apply local privacy checks and approved redaction. Queue only eligible bytes. Keep a sanitized metadata-only event when capture is withheld or bytes are unavailable.
4. An uploader process, job finalizer, or server-side adapter requests an intake receipt, transfers bytes through the admitted transport, and finalizes the event.
5. The server verifies bytes and authority, atomically publishes the event-to-artifact association, and indexes it. Inspector receives the same canonical event ID and an authenticated image route.
6. A terminal run manifest reconciles expected checkpoints and observed capture sequences with server receipts. A run may be finished while evidence is still pending; those statuses remain separate.

There is one logical canonical artifact system: Runner Visuals and its existing Relay evidence storage. Temporary upload staging, encrypted local outboxes, thumbnails, caches, and policy-governed compact archives are lifecycle-managed buffers/derivatives or storage tiers, not independent Relay and Inspector archives. Start by extending the existing index and ingest implementation. Add a durable, transaction-capable metadata/index primitive only if current implementation review demonstrates that existing mechanisms cannot provide uniqueness, pagination, and publication guarantees. That choice is a Gate 0 architecture decision, not an instruction to create a replacement service.

### Separate entities

- **Capture run:** A stable capture-session identity under one project and producer. It can reference an existing Runner or CI run but must not overwrite that system's run meaning. Record parent run and attempt for retries or resumed execution.
- **Capture event:** Immutable capture facts and original classification, including a missing/withheld outcome. Every observed capture gets one.
- **Artifact:** Immutable stored bytes, server-computed digest, verified dimensions and media type, retention class, and security scope.
- **Artifact variant:** Thumbnail, safe re-encoding, redacted version, crop, or comparison derivative with parent artifact and transform version.
- **Classification revision:** Audited changes to project/feature/task attribution without rewriting original provenance.
- **Review record:** Human or agent annotations, review state, and feedback links bound to exact event and artifact version.
- **Coverage manifest:** Adapter scope, sequence reconciliation, expected checkpoints, pending/lost counts, and whether observation itself was complete.

Keep large bytes out of ordinary MCP text results and Runner coordination records. Return IDs and compact receipts; retrieve images through authorized artifact routes. Keep raw full-resolution screenshots out of Git history, preserving the existing policy's explicitly configured compact-archive exception. Avoid GitHub API calls per capture. Resolve approved context once, cache it for the run with a bounded policy lifetime, and revalidate at authorization boundaries.

## 5 Identity and metadata contract

### Required capture facts

Require schema version, client event ID, producer instance ID, capture run ID, capture attempt/outcome, source adapter/version, source sequence, client observed time with clock quality, server received time, privacy decision, and the authorization scope established by the server. For bytes, require submitted checksum, declared size and MIME type; server verification is authoritative.

The authenticated principal, tenant, and permission scope come from the session or server-issued intake capability. Client-supplied owner names and project IDs are assertions to validate, not authorization. Bound strings, collections, URL lengths, and nesting; reject unknown required schema versions. Preserve the current policy's 15 MiB still-image limit. A 40-million-decoded-pixel ceiling is a proposed additional safety bound, subject to decoder benchmarking; it is not permission to raise current limits.

### Context fields and validation

| Context | Proposed fields | Validation and honest fallback |
| --- | --- | --- |
| Project and feature | `project_id`, stable `feature_id`, display-label snapshot | Resolve project registry; feature belongs to project; no fuzzy name assignment |
| Work | `task_id`, `assignment_id`, `assignment_revision`, claimed owner reference | Validate relationship and capture-time binding; missing task/assignment is explicitly unknown |
| Execution | `capture_run_id`, `external_run_id`, `run_attempt`, `parent_run_id`, build/deployment IDs | Distinguish local, CI, preview, and deployed identities; preserve source of each |
| Source | Repository, branch snapshot, commit SHA, dirty state and digest, submodule identity when relevant | Validate syntax; confirm via available source/runtime evidence; client assertion remains labeled |
| Capture | Purpose, ordinal, source sequence, time, route/surface, checkpoint key, comparison group | Sequence is producer-local; sanitize URL and labels; unknown capture time remains unknown |
| Rendering | Viewport CSS width/height, device scale factor, pixel dimensions, full-page/clip, scroll, browser/version, OS/device | Server derives pixel dimensions; do not infer a real phone from a mobile viewport |
| Environment | Local/preview/QA/production/unknown, base origin, fixture identity, locale, theme, reduced motion | Strip secrets, query strings, fragments and private data by default |
| Provenance | Producer type, adapter/version, tool operation ID, original handle kind, provenance strength | Distinguish server-attested, adapter-reported, imported, and unknown |

Use a canonical feature registry with stable IDs and rename aliases, not free-text folder names as identity. A feature is a product capability, not a worker role. One run has a primary feature when known; individual captures can carry validated secondary feature tags without duplicating events. Cross-feature views aggregate references. Feature merges/renames preserve IDs or alias history.

For a dirty working tree, store a versioned SHA-256 digest of a deterministic manifest of project-relative paths, file modes, and content digests within the declared build/capture source scope. Include untracked build inputs when permitted; record exclusions, missing files, digest algorithm, and computation time. Do not upload diffs or absolute local paths. A clean commit alone is not proof of the rendered build, and a dirty digest is not reproducibility unless all relevant inputs were included. Avoid hashing secrets merely to enrich provenance; excluded sensitive inputs make the source state explicitly partial.

### Unassigned and conflicting context

Known project but missing feature goes into that project's Unassigned feature area. Missing or ambiguous project goes into a private owner-only Unassigned inbox. Identity or authorization conflicts never become ordinary project-visible records. Rejected project attribution may retain a sanitized event receipt; image bytes remain local until a safe destination is established.

Reclassification uses a revision check, records actor/reason/time/old/new values, and preserves original capture facts. Moving evidence to another project's audience is a sharing decision and requires authorization for that destination. Batch reclassification must preview counts and affected access. Automated suggestions may propose a feature based on a validated task mapping but cannot silently relabel ambiguous historical evidence.

## 6 Proposed API and agent contract

These names are design proposals, not claims that the connected MCP already implements them. Keep current screenshot tools and the existing `/evidence/ingest`, `/evidence/run`, and `/api/visual` integration points working. Their adapters must converge on Runner Visuals. Prefer shared typed schemas and the smallest versioned facade: these logical operations can be actions of one intake/status tool where appropriate rather than seven mandatory new MCP tools. Gate 0 must map each logical operation to existing capabilities before adding anything.

| Proposed operation | Purpose | Key contract |
| --- | --- | --- |
| `relay_evidence_capabilities` | Read supported adapters, transports, limits and policy revision | Read-only; explicit unsupported values |
| `relay_evidence_begin` | Register a capture event and obtain an upload or reuse receipt | Stable idempotency key; validated metadata and authority |
| `relay_evidence_finalize` | Verify uploaded bytes and publish event association | Repeat-safe; no success before checksum and decode checks |
| `relay_evidence_status` | Reconcile a bounded set of event IDs or upload sessions | Read-only, batchable, recommended next check time |
| `relay_evidence_run_manifest` | Save final or incremental capture accounting | Monotonic revision and immutable manifest identity |
| `relay_evidence_list` and `relay_evidence_get` | Read indexed events and their authorized variants | Cursor pagination; no public bucket URLs |
| `relay_evidence_reclassify` | Apply an authorized classification correction | Expected revision, audit reason, destination access check |

Use a narrow, short-lived upload capability bound to event, principal, expected maximum bytes, and destination. It is not a reusable project credential. In MCP-only environments, negotiate a bounded chunk transport if supported; do not place large base64 images in model context. No arbitrary remote URL fetch is needed in the initial intake. A provider handle is acceptable only through a supported, authenticated resolver with explicit host/redirect/size rules.

### Illustrative capture request

The following is a proposed example, not an actual receipt. IDs and metadata are illustrative; the commit value names the verified source snapshot, not a captured build.

```json
{
  "schema": "relay.capture.v1",
  "idempotency_key": "producer_7:run_42:capture_0007",
  "client_event_id": "capture_0007",
  "producer": {
    "instance_id": "producer_7",
    "adapter": "local-browser-wrapper",
    "adapter_version": "1.0.0",
    "observation_mode": "hook"
  },
  "context": {
    "project_id": "relay",
    "feature_id": "inspector-evidence",
    "task_id": null,
    "assignment_id": null,
    "capture_run_id": "run_42",
    "external_run_id": null,
    "run_attempt": 1,
    "repository": "lrnolivia/relay",
    "commit_sha": "9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e",
    "dirty": {"state": "unknown", "digest": null},
    "build_id": null,
    "environment": "local"
  },
  "capture": {
    "purpose": "checkpoint",
    "sequence": 7,
    "captured_at": "2026-10-07T05:10:00Z",
    "clock_quality": "client_reported",
    "outcome": "image_produced",
    "checkpoint_key": "evidence-list-empty",
    "surface": "inspector",
    "viewport": {"width": 1440, "height": 900, "device_scale_factor": 1},
    "full_page": false,
    "browser": {"name": "chromium", "version": "adapter-reported"}
  },
  "privacy": {
    "policy_revision": "capture-policy-1",
    "decision": "allowed",
    "scope_id": "approved-project-preview",
    "redaction": "none_required"
  },
  "content": {
    "mime_type": "image/png",
    "byte_length": 428032,
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

### Receipt and error semantics

```json
{
  "schema": "relay.evidence.receipt.v1",
  "event_id": "ev_7",
  "upload_id": "up_7",
  "storage_state": "awaiting_bytes",
  "classification_state": "assigned",
  "provenance_state": "adapter_reported",
  "review_state": "unreviewed",
  "dedup_state": "not_determined",
  "revision": 1,
  "retry_after_ms": null,
  "next_action": "upload_then_finalize"
}
```

Finalization returns `stored` only after verified byte persistence and a committed event association. A derivative may remain `processing`; the original receipt remains usable. Repeated begin/finalize calls with identical intent return the same event and artifact IDs. The same key with different immutable metadata or bytes returns a conflict and never overwrites.

```json
{
  "ok": false,
  "event_id": "ev_7",
  "error": {
    "code": "CHECKSUM_MISMATCH",
    "retryable": false,
    "retry_after_ms": null,
    "next_action": "reconcile_local_bytes",
    "safe_message": "Uploaded bytes do not match this capture receipt."
  },
  "storage_state": "rejected",
  "published_bytes": false
}
```

Define machine-readable errors for invalid schema/context, forbidden scope, required privacy review, unavailable bytes, expired upload, checksum mismatch, decode failure, size/pixel limit, idempotency conflict, revision conflict, quota exceeded, rate limit, temporary storage failure, and unsupported capability. Only transient errors retry automatically. A 401/403 requires the normal authorized sign-in/permission path; never switch identities or widen access. Messages and logs must exclude image data, sensitive URLs, tokens, and private text extracted from screenshots.

Metadata-only events use `content: null` and a bounded outcome/reason code. Do not require invented checksums for unavailable or withheld images. Transport HTTP status, when applicable, should agree with the structured code: 409 for immutable-intent or revision conflict, 413 for size limits, 422 for invalid content/context, 429 for rate limits, and 503 for temporary service failure. An expired upload capability can be renewed for the same immutable event after authorization revalidation; it does not create another capture.

Enforce unique `(security_scope, producer_instance_id, client_event_id)` and immutable idempotency intent with transaction-level constraints. Retain a minimal idempotency tombstone at least as long as accepted replay/outbox windows, including after content expiry. Bind upload sessions to one immutable event; finalization cannot change project, checksum, or audience. Unknown optional extension fields may be ignored under an explicit forward-compatibility rule; unknown security-relevant fields or required versions must fail closed.

## 7 Reliability and truthful coverage

### Independent state dimensions

Avoid one overloaded green/red status. Track capture outcome, storage lifecycle, classification, privacy, provenance, review, and freshness separately. Distinguish local `journaled`/`local_queued` from the existing remote `registered`/`queued`/`uploading`/`stored` lifecycle. Proposed substates include `verifying`, `retry_wait`, `blocked`, `rejected`, and `lost`; preserve current `failed`, `expired`, `purged`, and `archived` meanings. Privacy can be `allowed`, `redacted`, `withheld`, or `review_required`. Review can be `unreviewed`, `needs_changes`, `accepted`, or `dismissed`; “accepted” is a reviewer judgment with scope, not an automatic test pass.

Run coverage reports observable source scope and counts for attempted, image-produced, stored, pending, withheld, unavailable, and lost. Reconcile sequence gaps against the adapter's durable manifest; do not simply compare a UI list count with a declared total. If the producer crashes before a final manifest, mark coverage incomplete/unknown even if all received events are stored. A metadata-only event is accounted for but is not image evidence.

Example user-facing summary: “37 captures observed: 33 stored, 2 uploading, 1 withheld for privacy, 1 unavailable from the provider. This run also used one uninstrumented capture source.” Never shorten that to “all screenshots uploaded.” A zero-capture run needs a declared capture scope and a final manifest before “no captures” is distinguishable from missing instrumentation.

### Outbox and retries

Write immutable event IDs and safe metadata before returning upload success. The adapter returns the original screenshot result promptly and an honest `local_queued` status after local journaling. Only a durable Runner Visuals registration can return the remote `queued` receipt. Network upload is asynchronous; failures should not break ordinary browsing or editing. Preserve the existing policy: local spooling alone does not satisfy the durable handoff or `work_accounted` completion requirement. An offline worker can continue independent work, but must retain an unresolved registration gap until reconciliation. A remote queued receipt permits producer completion, while any criterion needing pixels remains unproven until readable storage is verified.

Use atomic local writes, bounded disk use, encryption available through the supported environment, and OS-appropriate restrictive permissions. Reserve disk before accepting large captures. Start with a proposed 1 GiB per-producer outbox and 72-hour eligible-byte retention. At 80% warn once; at the limit record `outbox_full` and an explicit evidence gap. Never silently evict unsent captures. If retaining sensitive bytes cannot be made safe, withhold or avoid retention and report the limit.

Retry via deterministic uploader scheduling with jittered backoff, for example 1 s, 5 s, 30 s, 2 min, then at most every 15 min until policy expiry, honoring server Retry-After. This is application work, not repeated model turns. Batch metadata reconciliation, resume interrupted transfers when supported, and wake on connectivity or process restart. Use completion events where supported; do not burn tokens polling one screenshot at a time.

A network timeout after finalization is an uncertain outcome: query status using the same event/key, then retry that same operation only if reconciliation requires it. Crash after object write but before index commit leaves an orphan staging object for bounded garbage collection; it must not become invisible permanent storage. Crash after commit but before reply must resolve to the original committed receipt. Run termination waits a short bounded flush period, writes a final pending manifest, and preserves the outbox for recovery when possible.

### Content integrity and deduplication

Server-side finalization independently streams the checksum, enforces actual size, checks media signatures, and fully decodes the image within CPU/memory/pixel limits. Reject corrupt or mismatched files. Do not trust extension, client dimensions, multipart ETag, or a client checksum alone. Exclude SVG, HTML, and animated formats from the initial screenshot intake. Strip unsafe ancillary metadata in display derivatives while recording the transform; do not silently change the identity of submitted original bytes.

Deduplicate immutable blobs within an authorized isolation domain. Never provide a cross-tenant “hash already exists” oracle. Suggested initial scope is account plus project security boundary, with narrower handling for private quarantined captures. Two captures with identical bytes create two events referencing one artifact. Reclassification and retention operate on event references; a shared blob is deleted only when no permitted retained reference remains. Redacted variants have their own digests and do not masquerade as originals.

## 8 Inspector browsing and review

### Navigation and viewing

Add a Screenshots or Evidence view within the existing Inspector information architecture. The primary path is project → feature → run, with an All features view, Unassigned area, and direct run/event links. Preserve existing project identity, icons, typography, controls, viewer, accessibility patterns, and responsive behavior. Reuse canonical shared components rather than copying a new visual system into Relay or CTRL.

The run list shows source/build identity, capture time range, producer, purpose mix, image count, upload coverage, privacy gaps, and freshness. The contact sheet uses generated thumbnails and stable chronological ordering; repeated images can collapse visually into an expandable group while retaining every event. Default sort is capture sequence within a producer, with capture/received time and clock uncertainty visible for cross-producer ordering. Do not fabricate a total order from unsynchronized clocks.

Filter by project, feature, run, task/assignment, branch/commit/build, capture purpose, time, browser/device/viewport, environment, producer, review state, freshness, and evidence availability. Use cursor pagination and virtualized grids. Persist selection, filters, scroll position, and the last good preview during refresh. Provide explicit empty, pending, unsupported, access-denied, offline, deleted, and partially indexed states.

The viewer supports keyboard previous/next, zoom, fit-to-window, original pixel dimensions, safe download if permitted, metadata, chronology, and links back to the exact work item. Show a conspicuous stale or unknown-build badge beside the image. Mobile offers the same provenance and review actions without a dense desktop sidebar. Use text labels and accessible focus order; status must not depend on color alone.

### Before and after comparison

Match candidates using stable checkpoint/surface key, project and feature, viewport/scale, browser/device, theme/locale/fixture, and related run/build identities. Explicitly chosen pairs take priority. Do not infer “before” from the oldest image in a folder or “after” from the newest upload.

Offer side-by-side and overlay with synchronized zoom. Show incompatible dimensions or fixture differences before comparison. Pixel differences can help locate changes but are not correctness assertions. A comparison records both exact event IDs, chosen variants, reviewer, and matching rationale. New builds do not silently replace a previously reviewed pair.

### Annotations and feedback

Store annotations separately from immutable pixels, using normalized image coordinates plus original dimensions. Bind each comment and review decision to event, artifact/variant, and tested source/build context. A new crop or redaction does not automatically inherit annotations if coordinates/content changed.

Keep screenshot review separate from deterministic check results. Feedback creation, delivery to an assignment, recipient acknowledgement, fix, and verification are separate states. Routing feedback to another worker must follow existing authorized coordination paths and verified current ownership; a saved comment is not proof that a worker saw it. Preserve edit history and resolve/reopen audit entries. Never auto-approve a screenshot merely because upload and decoding succeeded.

Freshness is contextual: compare the tested build/source/dirty digest to the selected target. Use `matches_target`, `different_target`, `unknown`, or `superseded`, with reasons. Age alone is not proof of staleness; production deployment and branch head are different targets. Invalidate affected assertions after source changes without deleting useful historical screenshots.

## 9 Privacy security retention and cost

### Permission boundary

“Any screenshots” means screenshots within authorized work and supported capture sources. It does not authorize blanket desktop monitoring, unrelated personal screens, credential capture, or wider sharing with every collaborator on a project. Before enabling an adapter, declare the project, application/window/origin scope, permitted audience, retention policy, and redaction behavior. A connected agent identity is not itself capture or sharing permission.

Sensitive authentication, payment, medical, personal messaging, or unrelated account screens must be excluded or require the appropriate specific authorization. Never automatically upload passwords, tokens, recovery codes, or other highly sensitive data. Prefer preventing capture on known sensitive surfaces or locally redacting approved regions before upload. Do not assume an automated detector can reliably find every secret; combine explicit scope, tool-level exclusion, user pause controls, and conservative withholding when uncertain. Metadata and filenames need the same care as image pixels.

Provide a visible collection indicator and per-run/project pause. A privacy pause stops byte upload and suppresses unsafe capture metadata; use only a coarse gap reason if safe. Do not treat policy withholding as uploader failure and retry it later automatically. Server-side scanning is defense in depth, not permission to transmit sensitive originals first. Redaction is irreversible in the default displayed/uploaded variant; retaining an unredacted original requires distinct authorization and access.

Strip unnecessary embedded image metadata locally before transmission and identify that submitted variant explicitly. Use safe raster decoding/re-encoding for display, escaped annotation text, restrictive content types, and no execution of instructions found in screenshots or captions. Protect browser writes with the existing origin/session and CSRF model; short-lived upload capabilities must not appear in page analytics, history, or error reports. Limit capture intake and thumbnail jobs per principal so one agent cannot exhaust storage or compute for other work.

### Access and deletion

Default to existing account-private evidence. Project sharing is opt-in through an approved audience. Check authorization on list, metadata, image, thumbnail, search, comparison, annotation, and export routes. Signed download links, if used, expire quickly and are never treated as permanent evidence IDs. Prevent leakage through shared caches, referers, analytics, logs, or cross-project previews. Every derivative inherits at least the original's restrictions.

Preserve current policy defaults: ordinary unmerged/unarchived PASS images for 30 days; changed/failing/danger-zone/human-QA media for 90 days; current baselines and explicit pins until superseded/unpinned; metadata for at least 180 days after blob expiry or purge. The existing 14-day ordinary PASS-video rule remains unchanged by this still-image feature. New intermediate captures with no verdict need an explicit retention class: propose 30 days by default, escalating to protected/90-day retention when linked to unresolved failures or review. Never invent a PASS verdict to select a cheaper retention class.

Preserve the existing merge/archive gate: verify the exact evidenced head was integrated, create and verify a compact archive in the explicitly configured archive destination, then make eligible bulky working blobs purgeable. If the archive fails, do not purge. Do not choose or create an archive repository implicitly. Preserve active uploads, comparison baselines, pins, unresolved failure packets, and active human-QA references. Apply the current 80% cleanup and 90% hard-watermark policy to server storage. Newly proposed transport retention is at most 24 hours for staging and 72 hours for eligible local outbox bytes. Enabling or changing deletion behavior requires approval under the relevant policy.

Pinning must be visible, quota-accounted, and auditable. Expiring bytes leaves a truthful metadata tombstone; it never leaves a broken image presented as available. A compact archived derivative is labeled as such and cannot be mistaken for the original lossless screenshot.

A deletion operation revokes access immediately, deletes thumbnails/comparison caches/redaction variants where no retained references remain, and tracks physical deletion completion and backup lag. Respect shared-blob references without leaking other owners' existence. Define the restoration window before launch; permanent deletion requires the relevant confirmation policy. Test deletion, revocation, and expiry end to end.

### Capacity planning

Estimate storage from measured capture rates before buying capacity. For an illustrative steady-state workload, let C be observed captures/day, S average original bytes, U unique-byte fraction after deduplication, T total thumbnail/derivative bytes per unique artifact, R retained days, and M event metadata bytes. Approximate stored bytes as `C × U × (S + T) × R + C × M × total_metadata_lifetime_days`, then add archive, replication/backup, and local/staging budgets separately. Calculate each retention class separately; metadata lifetime includes at least 180 days after content expiry under current policy.

Example assumptions only: 2,000 captures/day, 0.8 MiB originals, 75% unique bytes, 0.12 MiB derivatives, and 30-day retention imply about 40.4 GiB of image storage before archive/backup overhead. Metadata at 4 KiB/event and a 210-day total lifetime adds about 1.60 GiB. These are sizing examples, not observed usage or a provider quote.

Monthly cost is storage GB-month charges plus write/read/list operations, transformation/compute, metadata database, and any transfer charges. Quote actual current rates only at procurement. Instrument bytes, dedup ratio, derivative amplification, upload failures, and retention by project. Quotas and warnings must stop runaway costs without silent sampling or deletion of unsent screenshots. Model-driven classification or vision analysis is optional later work, never part of every capture's default hot path.

## 10 Migration compatibility and live worker safety

Build an additive versioned system. Preserve existing evidence IDs, source references, Inspector links, and current screenshot tool arguments/return fields. Add optional fields and a normalized receipt, or version a conflicting response explicitly. Keep old clients functional while advertising their coverage as legacy/partial. Do not silently claim old tools have automatic upload hooks.

Migration should inventory existing artifacts and metadata, then create a reversible index projection with legacy aliases. Where the historical system stored one artifact without distinct capture events, create one `legacy_import` event only for each known original record. Never manufacture the number of past capture events from duplicate bytes, folder names, modification time, or screenshots in a report. Preserve original IDs, recorded timestamps and their meaning, source URLs, and unknown fields. Imported time must not replace capture time.

Dry-run the migration to count matched, ambiguous, missing-blob, and unassigned records. Validate checksums on bytes actually read, but do not claim server verification of unread legacy objects. Reconcile counts and sample link resolution before switching read paths. Keep old reads available until the new projection is independently checked. Migration rollback disables the new index view; it does not erase history or require deleting canonical objects.

This feature must not interfere with PR 166, independent Codex workers, or other live assignments. Before any implementation, refresh Runner project policy, current claims, source head, and open PRs; map intended paths and contracts against ownership. Use existing claims or obtain an admitted scope through normal coordination. Do not seize, rename, restart, amend, or complete another worker's assignment. The file map in this plan grants no ownership.

Existing in-flight runs retain their negotiated policy and schema. Activate new adapters on newly started runs or explicit safe reattachment. Keep context immutable across uncertain reconnects until reconciled. A new collection policy must not begin uploading an old outbox captured under a narrower policy. Test backward reads after rollback before launch; a compatible reader must survive new event states.

Provide independent kill switches for automatic capture intake, each adapter, byte upload, derivative processing, and the new Inspector view. A privacy emergency stops transfer immediately. A UI rollback should preserve collection if safe. A collection rollback should preserve existing evidence and normal screenshot tools. Rollback never turns `pending` or `unknown` into `stored`.

## 11 Delivery stages and approval gates

### Gate 0 Confirm the design and current boundaries

Approve the product contract and recommended defaults. Refresh canonical source and coordination; inspect current persistence, authentication, API limits, evidence IDs, shared UI ownership, and deployment route. Confirm supported providers with actual hook/export documentation and a minimal conformance fixture. Review overlap with PR 166 and newer work. Produce a scoped implementation packet, data-flow diagram, schema compatibility checklist, and rollback plan. No code or deployment starts before this approval.

### Stage 1 Canonical intake and contract tests

Implement event/artifact separation, authority validation, idempotency, safe finalization, indexed reads, and legacy aliases in an isolated non-production environment. Add deterministic fixtures and failure injection. Gate: no cross-project disclosure, no false stored receipts, duplicate events preserved, old API fixtures unchanged, and measured size/decode limits safe under concurrency.

### Stage 2 One server adapter and one local adapter

Normalize existing Relay browser capture persistence first. Add a narrowly scoped local wrapper with a durable outbox and terminal manifest, then the deterministic CI adapter. Gate: every observed fixture capture accounted for across crashes/offline/retries, no changed screenshot return behavior, no per-capture GitHub calls, and no model polling loop. List unsupported providers honestly. Do not advertise universal automatic coverage yet.

### Stage 3 Inspector organization and review

Ship project/feature/run navigation, contact sheets, filtering, Unassigned correction, provenance/coverage states, and basic annotations using canonical UI. Add comparison and advanced review routing after identity is stable. Gate: usability tasks succeed, old deep links resolve, access boundaries hold for every derivative, mobile/keyboard flows work, and refresh preserves the user's place.

### Stage 4 Private opt in pilot and migration

Enable one approved project and selected new runs. Use real volume to tune retention, limits, and backoff. Run reversible legacy indexing. Gate: complete manifests reconcile, no privacy leakage in adversarial fixtures, bounded resource costs, visible unsupported gaps, a tested rollback, and no regression in unrelated workers. Pilot duration is evidence-driven; a proposed minimum is several representative runs including one offline/restart case, not simply elapsed days.

### Stage 5 Broader adapter coverage

Expand only per provider/version conformance and explicit capture scope. Add supported plugins and desktop sources individually. Gate each adapter with the same contract and privacy tests. A capability registry and user-visible coverage matrix remain part of the product. Enabling one adapter is not authorization to add new persistent credentials or broaden account permissions.

Functional responsibility is proposed by boundary: evidence backend, capture integrations, Inspector UI, and security/verification. Assign people and paths only after live coordination inspection. No staffing, sequence duration, or concurrent worker count is committed here.

## 12 Acceptance and failure injection

Every acceptance test must state input fixture, injected failure, expected persisted state, observable UI/API result, and recovery result. Use fake clocks, stable image fixtures, fake storage/network adapters, and deterministic fault points. Do not validate resilience by randomly failing live production uploads.

| Test | Deterministic injection or setup | Required result |
| --- | --- | --- |
| Intermediate collection | Produce five captures around one final QA capture | Six events appear in sequence, independent of review selection |
| Identical pixels | Capture the same PNG twice with distinct event IDs | Two events, one eligible blob, both capture times retained |
| Idempotent replay | Replay begin, upload, finalize and reply loss | One event and association; same canonical receipt returned |
| Conflicting replay | Same idempotency key, changed checksum or immutable metadata | Conflict, no overwrite, no second published event |
| Crash points | Crash before journal, after capture, after queue, object write, commit, and reply | Gap or pending state is truthful; recovery does not duplicate or lose committed evidence |
| Offline and restart | Deny network, capture, restart uploader, restore network | Durable events upload once; final coverage reconciles |
| Capacity and expiry | Fill outbox/quota and advance fake time | Explicit blocked/expired states and warning; no silent eviction |
| Corrupt upload | Truncate/chunk reorder/checksum mismatch/invalid PNG | No stored receipt; safe error; temporary data cleaned |
| Decode abuse | Oversized dimensions, compression bomb, polyglot, MIME mismatch | Bounded rejection without worker exhaustion or active content |
| Authority | Spoof owner/project, expired capability, cross-tenant ID/hash | No disclosure or publication; no existence oracle |
| Metadata privacy | Token URL, secret filename, private route/title | Sanitized or withheld without leaking values into logs/errors |
| Untrusted display content | Script-like annotations, hostile metadata, prompt-like image text | Escaped/inert display; no script execution or instruction-following side effects |
| Sensitive pixels | Known excluded screen and local redaction fixture | Raw pixels never transmitted; safe event records correct privacy outcome |
| Unassigned correction | Unknown feature, ambiguous project, concurrent revisions | Private quarantine; correct audited reclassification; stale write rejected |
| Unsupported source | Opaque provider capture and absent hook | Partial/unsupported coverage; no invented uploaded count |
| Run completeness | Missing terminal manifest, sequence gap, zero captures | Incomplete/unknown when appropriate; no false full coverage |
| Stale evidence | New commit/build/dirty digest after reviewed capture | Old evidence retained and marked different/unknown for the selected target |
| Before and after | Same checkpoint with mismatched viewport or fixture | Warning; no automatic false pair or correctness verdict |
| Legacy compatibility | Old IDs/links/clients plus mixed v1/new records | Read compatibility and honest legacy provenance |
| Deletion and access | Revoke audience, expire image, delete shared reference | All variants/caches respect access; remaining permitted references survive |
| UI continuity | Refresh, load more, switch projects, back/forward, interrupted fetch | Stable selection, no cross-project flash, accessible error recovery |
| Kill switch | Disable adapter/upload/UI independently mid-run | Normal screenshot operation remains usable; pending data remains truthful |

Proposed performance and usability targets, to validate rather than present as current guarantees:

- Capture hook adds p95 under 50 ms for metadata journaling on the reference local environment, excluding existing image capture and asynchronous hashing/upload. Large image handling must be profiled separately.
- At 10,000 events in a project, first 60 metadata records load in p95 under 500 ms server time; contact sheet is usable within 2 s on a documented reference network/device. No originals load until needed.
- For a 2 MiB eligible capture on the reference healthy network, canonical receipt is available within 10 s at p95, including finalization; thumbnail ready within 30 s at p95.
- Fault tests account for 100% of observed instrumented captures. Unknown external sources are excluded from that denominator and explicitly reported.
- In a small usability session, at least four of five representative reviewers can find a named feature's latest run and its relevant before/after pair within 30 seconds without assistance.
- Keyboard and screen-reader users can navigate the grid, inspect provenance, annotate, and recover from errors; touch layouts work at a proposed 360 CSS-pixel minimum width without hiding required evidence status.

Measure p50/p95/p99 latency, failure rates by code and adapter, pending outbox age, unfinalized runs, dedup and storage amplification, privacy withholding, unauthorized access attempts, and index lag. Avoid storing screenshot contents or sensitive labels in metrics. Alert on sustained loss/backlog or privacy violations; routine successful captures should not create chat notifications.

## 13 Small decisions to settle

These are the remaining product decisions most likely to change implementation. Recommended defaults keep the first release bounded.

1. **Initial automatic scope:** Start with Relay-owned browser tools, deterministic CI, and one proven local wrapper. Other providers show explicit coverage limitations until tested. This avoids promising interception that the host does not expose.
2. **Feature identity:** Use stable project-scoped feature IDs with an Unassigned fallback, inheriting validated task mappings. Do not require a new taxonomy decision at every capture.
3. **Privacy and audience:** Start private to the authenticated owner and approved project capture scope. Enable project-wide sharing only after its audience is reviewed. Never collect unrestricted personal screens by default.
4. **Retention and cost:** Keep current Visuals retention, pin, and archive rules. Decide only the new unreviewed-intermediate class, proposed at 30 days, and the 72-hour local outbox; validate budget using measured volume.
5. **Enforcement:** Default to visible incomplete evidence without blocking ordinary agent work. Block only an explicitly required release/QA evidence gate; upload success never grants test success.
6. **Legacy migration:** Index known historical records without reconstructing imaginary capture history. Keep ambiguous records Unassigned and reversible.

Approving these defaults should produce a focused implementation brief. It should not auto-start coding workers, migrations, screenshot uploads, coordination changes, or production rollout.

## 14 Source verification addendum

Initial canonical source: [Relay commit 9ff2db2](https://github.com/lrnolivia/relay/commit/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e). Current open-work reference at that snapshot: [Relay PR 166](https://github.com/lrnolivia/relay/pull/166), head `c6acbcea29c6bcfd9d84c4c22d7fb73f2e7b9193`. The PR URL is mutable; its observed head above pins this review's claim.

Successful pinned reads at 04:56 UTC:

| Source at commit 9ff2db2 | Verified blob SHA | What it establishes |
| --- | --- | --- |
| [Visual Evidence Policy](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/docs/VISUAL_EVIDENCE_POLICY.md) | `79d13e13f8e4d86c62704a8f7ffcb4603af23b87` | Canonical Visuals requirements, lifecycle, limits, dedup, retention and archive policy |
| [MCP entrypoint](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/apps/mcp/index.js) | `0d6692058039c73218667d544750859514a40340` | CTRL route redirect, authenticated operator dispatch, evidence invalidations |
| [Inspector package entrypoint](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/packages/inspector/index.js) | `6c483e38fdb0a9729194c9b29034e983670eba96` | Re-export to existing Relay gateway |
| [Runtime configuration](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/wrangler.jsonc) | `b6d355ad65bfa8a7ba497b2bee845eac0e3ed53f` | Existing evidence bucket and runtime bindings |
| [Inspector review client](https://github.com/lrnolivia/relay/blob/9ff2db2eaf6dbacb6fc4dbadfa24064165a65f3e/apps/web/public/operator-review.js) | `713aa21b3141a1d9088fd01110af1c16f5dd88a1` | Project-filtered evidence reads, shared viewer use, presentation dedup behavior |

Coordination was independently read at 04:56:26.022 UTC, with the exact record/policy blob identities in section 2. No claim was acquired or changed. This source snapshot does not establish the current CTRL commit, deployed Relay/CTRL version, configured archive destination, actual data volume, downstream ingest implementation, or any host/provider's capture interception support. Verify those during Gate 0. Source changes after this cutoff require reconciliation before implementation. A source reference establishes the cited code or contract only, not deployment, performance, security-test success, or permission to take over another worker's scope.

## 15 Official planning assignment brief

Lauren subsequently asked to add this work to an official assignment. This brief is ready for queued registration by the coordinating parent; it is not evidence that registration has happened. Keep it an architecture/planning assignment, with no implementation claim, branch, worker launch, migration, screenshot upload, or deployment.

**Suggested assignment ID:** `relay-screenshot-evidence-plan-20261007`

**Title:** Plan automatic screenshot evidence

**Goal:** Extend canonical Runner Visuals so every eligible screenshot observed through supported Relay-connected capture adapters is durably accounted for and reviewable in Inspector by project, feature, and run, preserving capture-event identity independently from byte deduplication.

**Scope:** Reconcile this design with current ingest/index/auth and CTRL-hosted Inspector contracts; specify capture adapters, context/identity, privacy, delivery/recovery, organization/review, migration, observability, cost, acceptance tests, and staged rollout. Preserve existing Visuals policy and shared UI/assets. Include the bounded refresh/rate-limit diagnostic below. Produce a reviewable implementation brief and proposed future path/resource ownership without claiming those paths now.

**Acceptance:**

1. One canonical Runner Visuals index/artifact system is named, with no duplicate Relay/Inspector upload path.
2. Every intermediate observed capture has an event identity; identical bytes deduplicate without losing events; unsupported providers and missing bytes remain explicit.
3. Proposed schemas, state/error contracts, feature/run organization, before/after identity, privacy/access/retention, outbox/finalization, and legacy compatibility are concrete and testable.
4. The existing review client's composite-key dedup risk is addressed without redesigning canonical UI or assuming the Relay copy is the deployed CTRL implementation.
5. Live ownership, PR 166 and other concurrent work are reconciled before any future implementation admission; no running worker is disrupted.
6. Deterministic failure-injection, security, usability, performance, rollout and rollback gates are specified; unverified claims stay unverified.
7. The refresh/rate-limit diagnostic identifies the responsible layer, actual current configuration and semantics, evidence, and recommendation, or names the exact remaining verification gap. It does not change any limit.
8. Final architecture review and explicit implementation authorization are required before coding or rollout.

**Coordination context:** The planning read at 04:56:26 UTC used record `f2c8eeecf41ac5862e1e1d988e5616c88a5b7cb7`. A newer parent read at 04:58:11 UTC reports record `d8b35e36c46697e66a5d15b008d21363800e2616`, active repair branch `relay/mcp-rebuild-20261003`, and no dedicated nonterminal screenshots assignment. Use the latest server revision for registration, not the earlier value or a copied value after another write. Existing policy remains the source of admission rules; this proposal does not amend it.

### Bounded refresh and rate limit diagnostic

The observed failure in this planning session was a Relay-wrapped GitHub upstream response: HTTP 403, `class: rate_limit`, `rate_limit_remaining: 0`, `rate_limit_reset: 1791348961` (04:56:01 UTC). The read recovered after that reset. This establishes an upstream exhaustion/reset event; it does not establish that Relay hardcoded the window, that a UI refresh timer caused it, or that the limit is configurable by Lauren. The full window duration and request allowance were not established by this response.

Review three layers separately: Inspector/CTRL refresh and subscriptions, Relay server caching/coalescing/retry behavior, and GitHub/provider quota/reset rules. Locate the current source/configuration for each, record commit and deployed version, identify fixed constants versus settings/provider headers, and explain the purpose of the current window. Trace which actions consume calls, whether duplicate consumers amplify requests, and whether retry/caching respects reset times. Use existing logs, bounded read-only diagnostics, and controlled non-production fixtures; do not load-test the live provider.

Deliver the current value and units for each actual timer/quota, who controls it, scope (user/app/repository/server), behavior at exhaustion, whether refresh preserves the last good view, and an evidence-backed recommendation. Prefer reducing redundant reads and respecting provider reset information over proposing a shorter window blindly. No replacement interval was requested. No rate-limit, refresh, authentication, or production change is authorized by this diagnostic.
