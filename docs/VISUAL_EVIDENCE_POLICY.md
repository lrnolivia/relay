# Runner Visual Evidence Policy

Runner **Visuals** is the durable evidence index for visual QA produced anywhere in the loew.fi system. This policy applies to screenshots, still images, screen recordings, and other review media produced by Relay, Inspector, Runner, GitHub Chromium, Browser Run, project-native harnesses, or a human-QA handoff.

## Required registration

When QA produces a screenshot or video that is evidence for a task, run, acceptance criterion, failure, comparison, or human-QA packet, it must be registered in Runner Visuals. A project-local file, browser-run artifact, temporary URL, chat attachment, or Inspector-only object is not the durable record by itself.

Each registration must preserve enough metadata to reconstruct the evidence unit:

- stable Visuals evidence ID
- media kind and MIME type
- exact project and artifact/SHA or other immutable revision identity
- PR/run/step/criterion when known
- harness/engine
- capture time
- classification or purpose
- content hash when bytes are available
- upload state
- storage key or durable source locator when stored
- size/duration when known
- retention/pin state

The metadata receipt is durable even if the binary object is later expired by retention policy.


## Human QA helper population

When visual evidence is intended for human review, agents must follow the canonical [Human QA Helper contract](../contracts/human-qa-helper.json) and [population guide](HUMAN_QA_HELPER.md).

Before asking the user to review, the agent must populate a helper packet tied to the exact artifact and Visuals evidence identity. The packet should contain targeted questions and, when useful, a short observable checklist derived from the assignment acceptance criteria, current QA overlay, known uncertainty, and exact preview/evidence state.

Agents own deterministic verification. Do not turn tests, source/deployment identity, logs, required checks, HTTP assertions, or other machine-verifiable facts into user checklist work.

Questions should ask for specific human judgment such as hierarchy, spacing, wording, interaction feel, visual comparison, or product direction. Avoid generic prompts such as "does this look good?" when a criterion-specific question can be asked. Checklists are for things the user can quickly observe or try while the preview is visible.

A human-QA request should not be manufactured when deterministic evidence already resolves the criterion. If the exact head, deployment, evidence set, route, or acceptance criterion changes materially, preserve the old review as history but treat it as stale for the new artifact.

## Non-blocking upload lifecycle

Visual evidence transfer is asynchronous. The producer does **not** wait for the media bytes to finish uploading.

The lifecycle is:

`registered -> queued -> uploading -> stored`

with terminal/recovery states such as `failed`, `expired`, or `purged`.

A producer may continue normal work once Runner has durably returned the Visuals evidence ID and persisted state `queued` or `uploading`. Starting a local/background transfer without a durable Runner receipt does not satisfy this rule.

Upload completion, retry, reconciliation, and storage cleanup belong to Runner/Visuals. Transient upload failures use bounded retry/backoff. After the retry budget is exhausted, the record remains durable as `failed` with an actionable reason; evidence must never disappear silently.

Assignment completion does not need to wait for `stored` when a durable `queued` or `uploading` receipt exists. However, if the visual binary itself is required to prove an acceptance criterion, that criterion may not be classified as visually proven until the stored media is readable. Transfer accounting and QA truth are separate.

## Supported media

Visuals must support both still and motion evidence.

Preferred still formats:

- `image/png` for lossless screenshots and pixel-diff sources
- `image/webp` for compact review copies/thumbnails
- `image/jpeg` where lossless fidelity is not required

Preferred video formats:

- `video/webm`
- `video/mp4`

Video is evidence, not a replacement for exact-SHA metadata, assertions, logs, or deterministic checks. Record the exact artifact and relevant interaction/run context alongside it.

Default per-object safety limits are **15 MiB for still images** and **100 MiB / 120 seconds for video**. A project may request a larger bounded allowance when the acceptance criterion genuinely requires it; do not silently bypass the limit.

## Storage management

Visuals storage is bounded. Runner must maintain a configured storage budget rather than assuming the backing object store is unlimited.

### Post-merge archive and purge

Runner Visuals is working evidence storage, not permanent high-resolution media storage.

Once Runner verifies that the exact evidenced branch/PR head has been integrated into the project's default branch, the corresponding full-resolution visual blobs become eligible for archival and purge. Merge verification must use the recorded exact head and merged/default-branch identity; merely opening or approving a PR is not enough.

Before deleting a merged evidence blob, Runner must create and verify a compact archive bundle in the configured visual archive repository. The archive is intended for provenance and later inspection, not lossless replay of every captured byte.

A default archive bundle contains:

- the durable evidence/run metadata and exact artifact/merge identities
- a compact manifest with hashes, original MIME types, sizes, capture times, project/PR/run/step context, and original Visuals evidence IDs
- compressed review stills or thumbnails for image evidence
- for video, a poster frame plus a small set of representative keyframes/contact sheet; include a compact video transcode only when the evidence is marked failure/changed/human-QA or explicitly pinned for motion review
- pointers to associated logs/assertions/Runner records when available

Archive bundles must remain deliberately small. Prefer WebP/AVIF/JPEG review derivatives and compressed JSON/text. Do not commit raw full-resolution screenshots or ordinary full-length source videos to Git merely to preserve them.

After the archive commit is durably recorded and its manifest/hash read back successfully, Runner may delete the bulky working blob and mark the Visuals receipt `archived` with the archive repository/path/commit. The evidence metadata remains queryable from Runner.

If archive creation fails, purge must not proceed. Archive retry is background work owned by Runner; the original producer does not wait for it.

The designated archive repository must be explicitly configured. Until it exists, eligible merged evidence may expire from normal retention only according to the configured storage budget; Runner must not invent or silently choose an archive repository.

Storage management follows these rules:

1. **Content-addressed deduplication.** Hash stored bytes and reuse an existing object when identical media is registered again. Multiple evidence records may point to one blob.
2. **Separate metadata from blobs.** Evidence metadata remains after an ordinary blob expires so Runner can still reconstruct what was captured, when, why, and whether it was successfully stored.
3. **Soft and hard watermarks.** Begin cleanup at **80%** of Runner's configured Visuals storage budget. Treat **90%** as the hard watermark that triggers immediate eligible cleanup before accepting additional non-critical media.
4. **Prefer cheap retention.** Keep thumbnails/review derivatives smaller than source media. Do not keep duplicate transcodes without a review or compatibility reason.
5. **Never evict active evidence.** Do not purge an in-progress upload, current comparison baseline, explicit pin, unresolved failure/danger-zone packet, or media referenced by an active human-QA request.
6. **Merged-and-archived evidence goes first.** Prefer purging full-resolution blobs whose exact evidenced work is merged to the default branch and whose compact archive bundle is verified. After that, purge expired unpinned PASS video, then expired unpinned PASS stills, then superseded baselines. Failure/changed/human-QA evidence receives the longer retention window.
7. **Pins are explicit.** A pin prevents automatic blob eviction but does not exempt the record from storage accounting. Long-lived pins should be reviewed when the budget is under pressure.
8. **Cleanup is observable.** Purging a blob updates its Visuals record to `expired` or `purged`; it does not delete the evidence receipt.

Default retention windows:

- merged + successfully archived ordinary PASS media: purge full-resolution working blob as soon as practical after archive verification
- ordinary unmerged/unarchived PASS screenshot/image: **30 days**
- ordinary unmerged/unarchived PASS video: **14 days**
- changed/failing/danger-zone/human-QA media: **90 days**
- current baseline or explicit pin: retain until superseded/unpinned, subject to emergency storage review
- metadata receipt: retain at least **180 days after blob expiry/purge**

These are Runner defaults, not provider quotas. The configured byte budget must stay below the actual account/storage limit with enough operational headroom for in-progress transfers.

## Completion and work accounting

If an assignment produced visual evidence, the durable completion/disposition record used for `work_accounted: true` must reference the relevant Runner Visuals evidence ID(s) or run ID.

A Visuals receipt in `queued` or `uploading` state is sufficient to show that the media handoff is in progress; the worker/chat may finish its own turn or assignment without polling for byte completion.

A missing registration is not excused by the media still existing in another system. The transfer may be asynchronous; the durable handoff may not be skipped.

## Implementation ownership

The Visuals service is responsible for ingestion state, background transfer/retry, content hashing, deduplication, storage accounting, retention, purge receipts, and presentation of image/video evidence. Producers should submit/register evidence and continue rather than implement their own storage lifecycle.
