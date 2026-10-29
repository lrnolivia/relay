# Assignment inbox lifecycle

## Ownership and intent

This work continues the preserved `relay/context-archive-20261029` draft (PR 261), after Lauren's October 29 authorization to combine archive capacity recovery and inbox lifecycle completion. Original history remains available; no existing production messages are deleted or automatically cleaned up by the release.

Storage placement is not message resolution. Acknowledgement means only the recipient explicitly reported seeing a message. Delivery, reading, assignment completion and elapsed time do not resolve blockers or decisions.

## Message handling

- **new**: received, not explicitly acknowledged or resolved.
- **acknowledged**: seen, still pending.
- **resolved**: recipient explicitly records a reason and exact source artifact.
- **archived**: explicitly resolved message removed from the pending view, with original text, attribution, evidence and lifecycle history retained.
- **reopen**: explicitly returns work to pending; prior resolution/archive evidence remains audit history.

Lifecycle writes require the current admitted assignment owner/branch, an operation ID and expected revision. Recipient ownership changes require reconciliation, not silent reassignment. Old-binding pending messages remain visible with `reconciliation_required: true`; their presence does not authorize the successor to mutate them. An unrelated assignment cannot resolve or archive another recipient's message. Physical storage rollover must preserve pending work even when its assignment is completed or held.

`relay_context read` advertises `inbox_lifecycle: true` when supported. `view: inbox` selects recipient pending messages; `view: history` exposes recipient message history; `view: audit` with `entry_id` pages retained lifecycle receipts. Message entries expose `inbox_state`. Default context remains available for project context and legacy consumers. Read pages are bounded. Opaque `page_token` binds the revision, assignment/owner/branch and view; a changed binding requires restarting the scan. Empty scanned pages may still have `next_page_token` and are not proof of an empty inbox.

## Executor consumption

`scripts/relay-executor-inbox.mjs` maintains separate context, pending inbox and feedback sections in its private atomic snapshot. It discovers support through a normal legacy-compatible context read before requesting `view: inbox`. An older runtime returns `inbox_supported: false` and `inbox: null`, never a fabricated empty pending inbox.

Context and pending scans have independent opaque tokens. Legacy numeric cursors remain confined to legacy context responses. On stale tokens or failed reads, the executor retains the entire last successful snapshot, marks it stale, resets scan tokens and retries from the beginning on the next refresh. It does not silently downgrade a failed modern inbox to empty success. Original feedback text is preserved; an oversized combined snapshot cannot replace a usable previous page. The actual serialized snapshot, including stale-state metadata, is limited to 96 KiB.

Publishing/reading the snapshot is not delivery, consumption, acknowledgement or resolution. Existing explicit feedback `seen` receipts remain separate from message lifecycle and never claim a fix.

## Safe release and rollback

Before enabling new storage writes, deploy and verify an archive-aware compatibility runtime as the healthy rollback baseline. Record its exact source/runtime identity and recovery compatibility. Before activation, also enforce a minimum supported context schema across rollback, direct deployment and build admission, including the independently deployed recovery controller. Preserve historical approved targets unchanged, but reject incompatible restoration. Only after both the compatible healthy baseline and that deployed guard are verified may a separately reviewed release enable `CONTEXT_ROLLOVER_ENABLED`. `compact` is physical indexing, not semantic message archival. Never use an archive-unaware runtime as automatic rollback after activation: ignoring segmented entries or operation receipts can both hide work and permit operation-ID reuse.

Keep original entries and operation receipts. Segment/object creation must precede the root compare-and-swap, with integrity verification and safe uncertain-write reconciliation; never delete history first. Reads must not trigger migration. A rollout receipt is not authority to semantically archive users' live pending messages.

## Verification requirements

The release gate includes explicit lifecycle/reopen; acknowledged unresolved retention; completed-assignment pending retention; cross-inbox authorization; exact and changed-intent replay across rollover; 200-entry/600-operation capacity recovery; CAS/prewrite/uncertain outcomes; token/view/ownership changes; legacy compatibility and rollback; bounded executor publication and preserved stale snapshots. Events invalidate views for successful lifecycle mutations, not reads or failed RPCs.

Actual test, merge, deployment and rollback identities are recorded by the release coordinator against the final exact artifact; this document alone is not evidence that deployment or live migration occurred.

## Current activation boundary

The original compatibility baseline left `CONTEXT_ROLLOVER_ENABLED = false`. This separately reviewed activation enables rollover after the guarded retained healthy baseline, independent controller and enforced schema floor were verified. Reads remain non-mutating. A later authorized write at either the 200-entry or 600-operation threshold automatically indexes retained history and accepts new records; `compact` explicitly requests the same physical migration. No semantic resolution or archival is inferred, and no production cleanup or migration was performed to test the release.

**Historical restriction, superseded by the authorized route and receipts below:** On October 29, the canonical `relay-recovery` project lookup returned no registered project and the Relay cloud write allowlist did not include the independent recovery controller. No supported controller update route was established. Do not bypass that restriction, widen access, relabel an old recovery target or activate migration merely because a healthy baseline was recorded. At that point, the remaining work was to establish the authorized controller publication route, ship the reviewed minimum-schema guard, verify the retained compatible healthy runtime, then activate rollover. Existing records remain untouched.

## Authorized schema-floor rollout

Lauren subsequently approved a code-only update of the existing `relay-recovery` worker. The existing authorized Cloudflare connection can inspect that exact worker in the canonical account; this is not permission to widen Relay's allowlist, alter routes/bindings/secrets, or replace identities. Its version-upload route supports strict inheritance. Inheritance is from the latest uploaded version, which must first match the deployed configuration; verify the uploaded generation and inherited configuration before deploying its exact UUID. Keep the old controller version available only while the schema floor is absent.

The guarded release introduces optional `cloud.rollback.minimum_context_schema: 2`. Absence preserves legacy behavior; malformed/unsupported values fail closed. Under the floor, a release must prove both the schema2 reader/writer capability and the publication-floor guard capability at its exact canonical source commit. A reader-only baseline is insufficient: rolling back to it would reopen unguarded deployment paths. Raw/project deployment and recovery derive source/version identity from retained durable receipts, not a caller-supplied SHA. Recovery checks the source before restoration upload and again before deployment. Candidate build admission checks source capability server-side so older build clients cannot bypass the floor. Historical approved targets remain recorded but incompatible restoration is refused.

Required order: review and test the guards; publish a migration-disabled guarded baseline; deploy the independently versioned controller with unchanged configuration; verify its public `recovery_build` identity and code/configuration readback; verify the guarded baseline's retained healthy runtime; activate the registry floor; verify supported old-target rejection; then separately enable rollover and its activation-specific tests. No floor or migration activation is implied by this document. After the floor is active, never restore the old guardless controller or reader-only product baseline.

## Guarded baseline and controller receipt (October 29)

Guard PR262 merged as `2ecac060d00ff8bd3dd24dc022ee631c27fb1232` through Lauren's linked GitHub identity. Main CI40944701646 passed 1,114 tests, with zero failures and one existing skip. Autonomy revision95 records the exact guarded, migration-disabled healthy runtime `50d5fca3-a855-4182-a892-da45371ef36e`. Retained recovery artifact12928911502 has archive SHA256 `631dd527261eb435d771055df3d42474c1c4174dc749ee2f7af8f81e0e14d744`, manifest `d10e6798f292c6b3db05e5489677d3582a8e7e3e13c5775f69f89b0aa83e2387`, and isolated restore digest `c9e4f4660ce1d5b2af5267a86e3b97f34870f36dcf3c6d5f5b4fda044f4c5dcf`.

The separately deployed controller is version `f7df2139-d8be-46f8-9364-775f994fbbc9`, deployment `5c2d4d2c-b4ac-47e6-bacb-bee502cb90aa`, public build `20261029.context-floor-v1`. Its single downloaded module matches SHA256 `87950dd174b978202ae90c5ad11c0c3cfb3e0aaa6095d9d23feeac931192e79e`; all 12 build source inputs and recovery configuration match the merged source. Version upload used strict inheritance after latest/deployed parity; all nine bindings, runtime settings, routes and permissions were preserved. Only release annotations changed. No secrets were read or replaced.

This registry change activates only `minimum_context_schema: 2`; migration remains disabled. Pre-floor Workers Builds were terminal before publication. Recheck current compatible retained version and controller before separately enabling migration. A preexisting expired-version archive upload limitation remains: the script-version API accepts latest binding inheritance, not an exact old version UUID. Actual archived reupload is not proven by synthetic transport tests. Normal retained-version rollback is verified; if the compatible retained target disappears and only archive fallback remains, stop activation until the supported restore route is repaired. Historical approved targets remain unchanged and may no longer be compatible.

## Rollover activation prerequisites verified

Floor-only PR263 merged as `06bc45ed38ea3986f1afd05401510cf59f134218` through Lauren's linked GitHub identity. The canonical registration reads back minimum context schema2, and the live public safety endpoint requires exact candidate identity. Existing build clients reject a missing identity; exact-source incompatibility is covered by reviewed guard tests without initiating a production rollback. The controller remains the verified guarded version, and the compatible healthy version remains available from the provider. Activation changes the storage gate only; authorization, CAS publication, immutable history, exact operation replay and unresolved-message visibility are unchanged. Clients can verify `rollover_enabled: true` with an ordinary read after deployment; that read does not migrate storage.
