# Assignment card family — approved V5

## One truthful surface, three forms

- **Assignment:** project/assignment identity, shared canonical priorities, and bounded recorded staff updates. Two update surfaces plus a continuation on desktop; one plus a continuation on narrow clients. Accessible surfaced arrows and keyboard scrolling; no pretend chat transcript.
- **Single update:** one actual owner-attributed report inside its assignment, without redundant carousel chrome.
- **Product/status:** Relay, Runner, Inspector or Night Shift retains its real product mark and accent. With no recorded contributions, an assignment may identify its **Assignment lead**, never claim that person performed a step. Empty plans, empty update panels and zero-job heroes are omitted.

The existing polling controller remains authoritative: exact target fencing, single-flight reads, hidden pause/resume, backoff, terminal handling and independent source/fetch freshness. A recent check is not new work. An unchanged update history preserves its DOM, focus and carousel position. The product pulse is one 680 ms arrival indication on actual changed history; reduced-motion disables it. It never indicates online presence.

## Publication, not fabricated conversation

`relay_runner_coordinate(action="amend")` accepts the existing `request.card_steps` contract. Each receipt can optionally include:

```json
{"update":{"text":"Explicitly authored public summary.","artifacts":[{"evidence_id":"vis_existing-evidence-id","source_sha":"EXACT_40_CHARACTER_SOURCE_SHA","caption":"Recorded design preview","kind":"design"}]}}
```

This object is optional, bounded to 800 characters and three visual references. Do not copy private prompts, transcripts, raw agent result text or logs into it. If omitted, the UI uses a plainly labeled **Step observation** such as “Work started.” It does not fabricate first-person statements.

The hosted `relay_runner_delegate` **started/result** schema exposes the same optional `update` object. It is included in the immutable intent/evidence digest and replay comparison. It does not bypass the actual host invocation contract or turn successful execution into a verifier pass. The connected native tool catalog still must expose the hosted tool; this UI release does not itself complete that separate activation follow-up.

The canonical transition derives `card_updates` atomically after validating owner, active lease, objective, plan identity and receipt. Clients cannot amend history directly. Both ordinary amendment and native lifecycle use this path; native replay never appends. History retains at most 24 entries and 64 KiB, clearly reporting truncation. A separate canonical index retains up to 256 receipt identity digests per objective, including evicted entries; it is never sent to the card. Exhaustion refuses new events rather than forgetting identity. Finish/account for that objective and use an explicitly authorized continuation instead of resetting the index. Unchanged already-admitted full-plan receipts remain valid after a legitimate routing handoff; changed proofs still require current staffing. It snapshots publication-time owner/team so legitimate later staffing changes do not rewrite past contributions. Changing the objective invalidates the old projection.

A receipt ID cannot be reused with different state, proof, owner, public text or artifacts. Re-observing identical proof retains its first history timestamp. Ordinary continuity receipt IDs now bind the complete immutable proof/state/owner, rather than only input digest; unchanged legacy IDs and timestamps are preserved and pending writes reconcile before any new publication. This prevents running/result or re-verification collisions without replaying actual work.

## Visual evidence

Capture the real existing feature/design with Inspector and supply context containing the exact `project`, `assignment` and `commit_sha`. `storeEvidence` preserves this context. Publish only the resulting existing evidence ID with matching source. The card reads that item's metadata, verifies all three bindings, then loads only PNG/JPEG/WebP through the existing authenticated `relay_ui_request` image route. Arbitrary URLs and project-latest image fallback are not used for staff updates. Retargeted/obsolete responses cannot mount. A Design update without attached evidence explicitly says so; no screenshot is invented.

## Staff organization and assets

The approved v6 directory has 21 fictional AI staff, four management roles and six display teams. `staff-display.js` is a versioned display overlay: historical runtime home-team IDs and old receipt attribution are not migrated. Four new identities have explicit role mappings and no worker bindings/permissions. Routing is not proof of contribution.

`assets/staff/card-assets.js` contains the production framed JPEG128 derivatives, generated directly from the already-framed approved v6 avatar512 sources (no second crop). `display-manifest.json` and the v6 manifest bind each embedded output and original Library source hash. The source Library bundle is `libfile_6ac84b246c548191b081dcf77217ea21`, SHA256 `0fff6e65f2a7b56b8ede19a58e06b251754f0a8ff35fcc8986822338c5aeceda`. Legacy binaries and v4 manifest remain for provenance. Lauren Olivia's personal photo is not distributed in Relay.

## Verification and limits

Resource v26 retains v25 and older aliases. The required CI gate renders actual generated resource DOM with canonical publication fixtures, light/dark and desktop/mobile views, source-bound real fixture captures, all staff avatar sheets and existing polling regressions. Captures are labeled fixtures, not live native-host proof. Tests cover malicious/mismatched metadata, target changes, focus/selection, immutable replay, old coordinator recovery, absent plans and product-only messages. Independent source and pixel review precede release. No merge/host acceptance follows merely from a successful unit test.
