# Bounded private source checkpoints

Status: new candidate on the existing draft PR 165, not merged, deployed or enabled in the live Relay connector. Existing assignment is relay-mcp-rebuild-continuation-20261003. The previously reviewed commit 53de286d49c274fc02ef408361e43b00d95142f7 and successful workflow run 37559814874 are retained as immutable prior-candidate evidence. The internal freeze was explicitly lifted for this continuing reliability repair; all required hosted gates must rerun on the new head. The cumulative admitted PR scope is the original five test-workflow files plus this twelve-file checkpoint slice.

## Contract

The existing executor/job lifecycle gains an explicitly enabled `source-byte-checkpoints-v1` capability. Configure `source_checkpoints: true` for this bounded executor mode and include that capability in jobs that require protection. Legacy jobs retain metadata-only behavior, clearly labeled `local_only`. This avoids silently disabling broad existing workloads with a new 128 KiB / 64-entry limit. It is not yet universal automatic source protection.

A complete admitted-scope snapshot includes tracked and untracked regular files, binary and zero-byte content, executable modes, explicit deletions, repository, branch, initial head, scope, size and SHA256. The helper accounts for the HEAD tree, index, working tree and exact selected absent paths. Selected ignored/control/secret paths, known credential patterns, symbolic links, hardlinks, case collisions, path traversal, unsupported special files and oversize captures fail the complete capture. No partial archive is promoted.

Filename/content filters are defensive exclusions; they cannot establish that arbitrary source contains no sensitive material. Only the already-authorized private EVIDENCE store is used, with no new grant or public source upload. This first format permits 192 KiB serialized / 128 KiB decoded / 64 entries. Snapshot baseline and capture remain tied to the job's unchanged initial head. Larger scopes, native/root work outside the executor, and commit-changing captures remain explicit unfinished cases.

Storage keys are immutable content identities. The server independently reads the object and validates every digest before deriving `remote_verified`. A client then independently reads the exact snapshot, restores into a fresh private directory, compares complete bytes/modes/deletions and sends an exact restoration receipt. `restore_verified` is explicitly attributed to the authenticated executor; it does not claim independently observed host execution. A write acknowledgement alone is never promoted. An uncertain write retains the operation ID for reconciliation rather than duplicate mutation.

Required jobs cannot start before restoration proof. Success also requires a post-start restoration receipt and a result head matching the saved snapshot. An identical snapshot remains valid for a fresh read/restore cycle. Metadata-only updates invalidate current source-proof labeling while retaining the prior verified snapshot.

## Recovery and failure behavior

Source reads require exact job/revision, original executor identity/token, current active assignment owner/branch and unchanged admitted scope. Read-only recovery works after a job completes, its executor lease expires, the remote source advances, or a newer job begins. It does not renew/recover execution or modify a completed job.

The `restore` CLI takes config, the retained private executor receipt and a fresh output directory; the original checkout is unnecessary. It restores the scoped snapshot only, not a full repository, dependencies, Git database or credentials. It never overlays a working tree. The original private receipt and existing connection are still needed. Recovery after assignment retirement, scope/owner changes or branch deletion is not established by this slice and remains blocked rather than relaxing ownership.

Linux descriptor identity validation is required in this version. Capture validates the opened descriptor before reading, so a parent-directory swap cannot redirect outside source bytes. Restore walks anchored directory descriptors, rejects symlinks and checks the opened file before writing. Unsupported platforms fail before creating the destination. This is not a claim of containment against a privileged or same-identity hostile process manipulating open inodes; execute within the existing isolated task boundaries.

Checkpoint failures preserve the working copy, original manifest, previous verified snapshot and local receipt. The executor records `checkpoint_blocked` and stops dependent work. A failed capture before launch creates no child process. Cancellation does not start new preservation work after an explicit stop. Resume output exposes safe recovery identities and proof summaries, never source bytes or executor tokens. Proof changes invalidate the deterministic resume checkpoint identity.

## Validation

Focused Node 22.23.3 checks cover the broker, source format, executor and resume contract. Tests exercise real synthetic Git repositories and child processes without a browser, server, external network, installed third-party dependencies or live storage writes. Cases include destroying the producing checkout, tracked/untracked/binary/deleted/mode recovery, repeated unchanged snapshots, malformed/partial/wrong identities, corrupt or missing readback, old/terminal/expired jobs, wrong owner/token/revision, metadata-only history, proof-gated start/finish, duplicate-operation reconciliation, secret paths, hardlinks, forced parent swaps and legacy executor compatibility.

All 75 focused test executions passed on official Node 22.23.3, then passed again after an independent private durable download and isolated restoration with all twelve source hashes verified. The exact test receipt and source hashes travel with the private recovery archive. Fixture success is not live EVIDENCE ACL, Cloudflare runtime, native Mac/Windows recovery or full canonical repository CI proof. These remain separate release gates. PR 165's complete five-suite hosted result is evidence for PR 165 only, not this changed candidate.

## Rollback and remaining work

The archive retains exact baseline bytes for all previously existing edited files from PR 165 head plus canonical dependency files and provenance. Revert only this source-checkpoint slice if necessary, preserving the earlier five-file test repair. Do not overwrite shared coordination. No merge/deployment is authorized by this candidate transition.

Remaining broader reliability scope includes universal capture policy/large-source transport, external/root-work adoption, exact toolchain enforcement, source-to-focused-test discovery, complete failure-stage taxonomy, immutable release-candidate records, actual Worker startup gates and approval-evidence continuity. No claim that this checkpoint slice closes the full nine-item repair plan.

## October 7 continuation: executor transport receipts

PR 166 merged the toolchain, exact bundled Worker startup, source/test mapping and CI stage accounting at `e8076bb7fbcb6d979ffee065b19fdecc5aa5a3c2`. The original rebuild assignment remains active and unfinished. GitHub deleted the merged branch; the same admitted branch was restored from that merged source under refreshed ownership, without a new continuation assignment. Cloudflare's existing main build/deploy pipeline succeeded; hosted main run `37574494996` passed quality and authenticated production verification. The separate visual preview was skipped. A Relay fetch probe returned 522 while an unauthenticated public probe returned the expected Access 401; neither probe established authenticated runtime acceptance. The hosted production check supplies that separate evidence.

The next bounded repair touches the executor client, its existing tests and this note. The client previously reduced HTTP failure to a status string and lost structured tool/provider classes. It now retains stage, tool, locally generated request ID, HTTP response observation, safe numeric retry-window evidence and a bounded class. Local serialization failure is distinguished from an attempted request; attempted mutations retain `side_effects: unknown` even after an error response. Timeout and cancellation describe observations only, with unknown actor and cause. Raw messages, prompts, credentials, response headers and provider payloads are excluded from the failure receipt. JSON-RPC version and response ID must match; malformed, oversized (over 1 MiB), unconfirmed or mismatched responses cannot establish success.

`createMcpClient` issues one request and adds no retry, identity fallback or credential changes. `runExecution` retains its exact pending operation and records the last observed transport failure in its private 0600 journal. A failed lease cannot spawn the coding process. The existing explicit receipt recovery/idempotent reconciliation mechanism is preserved; it is not a new permission grant or proof that the upstream provider received or executed a request. This client still requires a confirmed structured JSON response; streaming response support is not added by this slice.

macOS focused verification runs the supported executor paths and synthetic failure controls. The unfiltered imported test chain still exposes the same seven Linux-descriptor-only failures on Mac; those are not suppressed or claimed as passes. The full Linux pipeline must verify the complete chain on the exact new candidate, including both legacy and protected subprocess lifecycle cases. All five suites remain required. No live coding executor or intentionally denied provider request is launched as a test.

A real Node fetch control uses an isolated loopback fixture and deliberately stalls its response body. The bounded client deadline produces a timeout receipt after headers, with unknown upstream effects; the test sends only a synthetic credential and performs no Relay/provider operation. The normal deadline remains 30 seconds and cannot be extended by the client configuration. This establishes Node HTTP behavior separately from synthetic fetch error fixtures.

Publication was initially parked when Relay GitHub App reads returned `rate_limit`/403 with remaining zero at `2026-10-07T05:11:40Z`. The project/ownership read reported reset `2026-10-07T05:56:14Z`; branch inventory separately reported `2026-10-07T05:22:24Z`. The user then explicitly directed use of existing local Git/`gh` and the GitHub connector, followed by a Relay update, and asked that this become the Codex-on-machine workflow. Fresh local canonical reads confirmed the same active owner; the current engine/policy admitted the expanded scope and verified its CAS update/readback. The limited connection is not retried before its window, and no authentication/permission denial, new credential, protection bypass or account-wide quota evasion is involved.

The combined candidate adds Bible section 4.1, the corresponding WORK_COORDINATION guidance and Runner rate-limit recovery wording. These make independent authorized machine transports explicit while preserving canonical ownership, admission, CAS, uncertain-write reconciliation and normal required checks. Publish the exact new source through local Git, verify its remote bytes/restoration, open a draft PR through the GitHub connector and run one full Linux pipeline. Record the resulting head/checks in the same Relay control record through the supported local adapter. PR 166's completed main production evidence does not validate this later candidate.

Rollback this transport slice to `e8076bb7fbcb6d979ffee065b19fdecc5aa5a3c2`. Large/native source checkpoint transport, approval-evidence continuity, immutable release freezes and remaining original rebuild acceptance stay open. The user's push/merge/continue instruction authorized PR 166 integration and continued source repair; this next candidate has separate exact-source evidence and review state.

## October 7 reliability batch: platform admission

The candidate-only labels above are historical. The checkpoint and transport
foundations are in the current verified release `db6e0e2f1c54b0e6f21ed91ed8005dc3198cc9ea`;
its main workflow `37590411802` passed quality and authenticated production.
This does not establish universal/native source protection or real executor use.

Current source still advertised `source-byte-checkpoints-v1` when enabled on
macOS, even though capture and restoration require Linux descriptor identity
checks. A clean synthetic Git checkout reproduced an attempted lease before
the unsupported configuration was rejected. The bounded repair checks the
actual host platform and descriptor availability before advertising protection
or requesting a new lease. Unsupported protected execution stops without
reading the coding CLI version, starting a process or creating an uncertain
lease write. Existing uncertain operations are still reconciled first; this
repair does not discard receipts or change recovery/idempotency rules.

Two negative fixtures exercise macOS and Windows platform admission through
the existing executor dependency injection. They prove no lease/start or CLI
version lookup, no pending-operation receipt and released local lock. They do
not establish native Windows process behavior. The actual Mac legacy process
fixture remains required locally; the complete Linux pipeline retains its
protected capture/readback/restoration/process lifecycle assertions unchanged.
Linux descriptor protection is not replaced by a weaker Mac capture path.

The source-to-test audit includes the executor callers, its imported inbox and
checkpoint fixtures, broker jobs and generated build consumers. Imported
Linux-only tests are an environment constraint on a Mac, not obsolete product
expectations. Local checks name the supported cases explicitly; the canonical
Linux run must execute the complete required suites. No assertion is removed,
baseline blessed or broader gate skipped. Exact toolchain, source/test mapping,
suite aggregation and stage accounting already exist; this batch extends them
with a meaningful admission regression rather than another testing system.

Focused verification on Node 22.23.3/npm 10.9.9 passed all 13 selected executor
and actual Mac legacy lifecycle tests, plus all 15 source/test mapping tests.
The two unsupported-platform fixtures first failed on the unmodified executor
with `Unexpected mutation: lease`, then passed after the admission repair.
The complete Linux protected lifecycle and required suites remain hosted gates.

This slice requires exact source publication/restoration and hosted gates
before acceptance. Its rollback is a reviewed revert to the verified `db6e0e2`
source; preserve existing source checkpoint objects and Files metadata/tombstone
readers. Lauren's inbox amendment makes Relay Files interface work the final
batch; the next workflow batch is the human-language foundation unless a current
quota failure actively blocks work. Original execution/recovery and client
acceptance remain open.


## Exact-commit metadata manifest, separate from source-byte checkpoints

This subsequent bounded source-recovery slice adds the explicit `relay_source_tree` query. It accepts the existing configured owner/repository identity, an exact lowercase 40-character commit SHA, and bounded cursor/limit arguments. It resolves the commit to an immutable root tree through the existing authenticated repository transport; anonymous fallback is forbidden for this operation. It does not add credentials, grants, repository authorization, source writes or file-content disclosure.

Each returned entry has exactly `path`, `mode`, `type` and `sha`. Regular files, executable files, directories, symlinks and submodules remain distinguishable; nothing follows symlinks or submodules. Provider URLs, arbitrary extra fields and file contents are not returned. Callers must treat paths as data and enforce their own safe destination rules before any separate restoration.

GitHub's recursive tree API has no page parameter and can return a truncated tree. Relay paginates the normalized immutable response itself: default 200, maximum 500 entries, and at most 128 KiB of entry data per page. The response read is bounded to 4 MiB and 20,000 entries; exceeding a local bound fails explicitly rather than claiming a complete result. Provider truncation is returned as `truncated: true`, `manifest_complete: false`, with an incomplete reason. No automatic unbounded tree walker is introduced.

Cursors are request data, not authorization. They bind the existing repository, exact commit, root tree, normalized manifest digest and offset; malformed, cross-repository, cross-commit or mismatched snapshots fail. They cannot select a different authenticated repository or endpoint. `manifest_complete` describes the provider enumeration, not whether the caller has consumed all pages. To establish a complete collected manifest, start without a cursor, follow every cursor through null, check consecutive offsets, entry count and digest, and require `manifest_complete: true` throughout. The digest is SHA-256 of compact UTF-8 JSON for the sorted entries in their returned path/mode/type/sha key order. A path/object-ID manifest never proves source bytes were downloaded or restored.

Validation covers identity, ordering, stable pages and digests, byte/count limits, unknown arguments, malformed/cross-snapshot cursors, truncated/empty responses, duplicate/unsafe provider paths, modes, unavailable authentication and preserved provider denials. The new tool is explicitly classified as a query. Generated card parity remains mandatory. The query registry is not part of the generated browser program, whose regenerated bytes are unchanged, so existing v17/current and v5/legacy cache identities remain intact. There is no needless resource-version churn. The neutral catalog copy and earlier obsolete-panel retirement remain unchanged.

The ordinary post-merge production gate discovers and invokes this exact tool through authenticated MCP against the public Relay repository at the exact deployed commit, consumes all pages and verifies count/digest. It records only proof identities/counts in public CI. It never reads a private project's manifest for public logs or artifacts. Actual availability in a user's connected client is a separate activation check; no implementation/deployment receipt alone claims that client's tool list refreshed.

Official protocol reference: https://docs.github.com/en/rest/git/trees#get-a-tree . This capability complements the bounded private executor checkpoint format above; it does not replace its byte-integrity, ownership, secret exclusion or restore-proof requirements.
