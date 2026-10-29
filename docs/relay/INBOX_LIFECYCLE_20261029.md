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

Before enabling new storage writes, deploy and verify an archive-aware compatibility runtime as the healthy rollback baseline. Record its exact source/runtime identity and recovery compatibility. Only then enable `CONTEXT_ROLLOVER_ENABLED` in a separately reviewed source release. `compact` is physical indexing, not semantic message archival. Never use an archive-unaware runtime as automatic rollback after activation: ignoring segmented entries or operation receipts can both hide work and permit operation-ID reuse.

Keep original entries and operation receipts. Segment/object creation must precede the root compare-and-swap, with integrity verification and safe uncertain-write reconciliation; never delete history first. Reads must not trigger migration. A rollout receipt is not authority to semantically archive users' live pending messages.

## Verification requirements

The release gate includes explicit lifecycle/reopen; acknowledged unresolved retention; completed-assignment pending retention; cross-inbox authorization; exact and changed-intent replay across rollover; 200-entry/600-operation capacity recovery; CAS/prewrite/uncertain outcomes; token/view/ownership changes; legacy compatibility and rollback; bounded executor publication and preserved stale snapshots. Events invalidate views for successful lifecycle mutations, not reads or failed RPCs.

Actual test, merge, deployment and rollback identities are recorded by the release coordinator against the final exact artifact; this document alone is not evidence that deployment or live migration occurred.
