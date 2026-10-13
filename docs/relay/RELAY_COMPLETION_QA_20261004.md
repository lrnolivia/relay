# Relay PR146 corrective batch — 2026-10-04

Canonical assignment: `relay-mcp-rebuild-continuation-20261003`. Owner: `01a10455-8722-75d4-a6f7-c509688200df`. Continue the original branch and acceptance; this batch does not close the full rebuild.

## Exact inherited failure

Head `8c42b089e96b491e09ff290744e435283dfa2f6f`, quality run `37164624390`, job `111324911317`: `apps/web/test/relay-home.test.mjs:22` timed out waiting for the review job's goal. The attention card displayed its reason but omitted its job title. Both subsequent artifact uploads failed because their directories had not been produced. Admission passed; that head was not deployed. Older cleanup-only green runs do not satisfy this gate.

## Corrections and behavior proof

- Attention cards show the actual job title and its separate request/reason. Focus stays below the workspace heading, the edit glyph is at the right, and ring captions are outside centered values. Existing top-right connection controls use icon refresh and honest connect-your-AI guidance.
- Pinned MIT dnd-kit core6.3.1, sortable10.0.0 and utilities3.2.2 replace instantaneous pointer reorders with transform-based sortable cards. Mouse/touch long press, explicit Done, persisted order, keyboard handles/step controls, cancellation, reduced motion, and interactive-child exclusion retain their meanings. Tests exercise actual pointer motion and ordering, not only button callbacks. Chromium frame intervals are lab evidence; physical-device smoothness is unverified.
- Context-card refresh checks transport errors, structured provider errors and actual progress payloads before saying Updated. It preserves the prior view on error or malformed response and does not replay provider failures through another host. Prior success timers cannot overwrite a new failure label. Native-compatible and standard MCP host fixtures independently exercise refresh, error/malformed preservation, navigation and thumbnail enlargement/close/focus restoration. They prove the protocol implementation, not actual installed ChatGPT native actions or recipient delivery.
- Desktop copy has more room while phone cards retain compact summaries. Technical evidence is initially collapsed. The legacy bridge HTML generation and original probe resources remain unchanged.
- Runner heartbeat and reservation events remain factual liveness events but cannot become `latest_event` or `last_meaningful_progress_at`. Fresh heartbeat plus stale source stays stale; heartbeat-only reservations have no meaningful-progress receipt.
- Browser `/api/feedback/binding` agrees with ctrl PR12's exact-head contract: authenticated GET with project, assignment and head_sha; available args carry canonical owner/branch and exact source artifact. Invalid/changed artifacts fail closed. Submit/save, queued delivery, intended-recipient acknowledgement and independent verification remain distinct.

## Local checks

Isolated checkout; no native input or shared browser tabs. `npm ci`, `npm run build`, web typecheck, `git diff --check` and the complete workspace `npm test` pass: **512 tests, zero failed/skipped**. The original failing dashboard criterion and added transport/drag regressions pass. Screenshot captures and frame intervals are retained in the task workspace; publication records bind later captures to the committed candidate SHA. No skill Markdown or generated skill bundles were edited.

Local visual-script escalation was rejected because it can optionally upload Inspector screenshots. Inspection confirms neither Access client credential is configured locally; the upload path is conditional on both credentials. Local-only captures require no external disclosure. Canonical GitHub QA uses the existing authenticated Relay evidence route described in release/visual evidence policy. Failed or unavailable uploads are never counted as verification.

## Release baseline and remaining gates

Observed rollback target: Relay Worker version `6f120ea3-d51a-4f0d-9d57-76acd3c49e77`, deployment `d3cb5cbd-76d5-4326-90b4-c2ef6fdce852`, 100% traffic (2026-10-03T22:41:08Z). Confirm its source and allowed rollback route before any traffic change; listing a version is not rollback execution. Normal publication remains reviewed GitHub merge → Workers Builds → exact live source/web-build readback.

Original acceptance remains open for actual installed host schema and physical-client actions, real broker-backed coding execution and local/remote parity, full in-run feedback/context consumption, and an actual ctrl preview → save → intended-recipient acknowledgement cycle. Current execution status reports `job:null`; standalone Codex is absent on PATH and no standalone Relay token is configured. Do not extract credentials, create another worker or synthesize process receipts. The next safe proof step is operator-provided existing authorized executor configuration, followed by an admitted isolated broker job and exact process/checkpoint/exit receipts; host/device proof uses the separately owned authorized audit lane.

The live self-origin fetch gateway returned522; this is unavailable evidence, not proof that every client or the Worker is down. Use independent canonical GitHub authenticated browser verification for the actual deployed website. This report records preparation and local behavior, not a merged/deployed receipt; final source, quality/build/deployment and live verification identities must be read back before publication is declared complete.
