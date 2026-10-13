# Assignment-bound text feedback

This batch lets an authenticated Relay caller save verbatim observations against an explicit assignment and tested artifact, retrieve pending reports without side effects, and record an explicit acknowledgement. It does not wake a worker, push into a native Codex task, or establish that a fix was made.

## Admission and preserved work

Assignment `relay-mcp-feedback-routing-20261001`, owner `01a0f914-aad0-71e4-8f0c-20c1bf0a2016`, branch `relay/mcp-feedback-routing-20261001`. Parent approved the design and serial transition after Julian released `relay-qa-feedback` from the website reservation. Queue commit `f93aeae`; retirement commit `29410ee5d8b17d1d0916618b65c6687ddb3ca444`; claim commit `81f5ccf`. Retirement is supersession, not a completed card proof. Record readback `b3525795f4213c49a8db7d2421bc5f0f5bcad7ce` confirmed the active successor and preserved retirement receipt.

The original 16-file scope was extended through CAS rescope commit `5bef015bc52a9a83dcc718c435de078dda06a127`, record `7b26f1a61b1c9511a42803e9ccef813c5d37290b`, solely for `src/relay-host-action-probe.test.js`: its exact count of 55 tools correctly rejected the four approved additions. The assertion now requires 59 and explicitly names the four tools; all prior resource/action assertions remain. Seventeen-path preflight passed. No website or shared UI files changed.

Full MCP rebuild and ordinary-chat parity remain required, including all 51 original model tools, existing app bridge and approved conversational art. Original and comparison diagnostic resources are unchanged.

Actual client evidence remains separate from this backend batch:

- Original connection diagnostic build `20261001.1`: Lauren's new ChatGPT Mac desktop Work screenshot shows shell, script, connection, data, full reachable card/button and `Read-only check worked`. Initial sample `3a9228ca-2b1d-4ffc-8de8-05a351b34db3` at `2026-10-01T23:20:12.057Z`; action sample `83db62cb-ab79-4bf0-96fd-e85f906d8e3e` at `23:21:37.734Z`; 734 by 457 size sent. This is a direct conversation attachment; no independently materialized file/hash is claimed here. Host app version is unknown.
- Earlier Work timeout remains historical evidence. Lauren explicitly reports that ordinary chat still does not work. Work success does not establish ordinary-chat support.
- iOS original action remains unverified; Safari and ordinary Mac same-build delivery remain unresolved. The newer PR112 action comparison has no recorded actual-client result. Do not ask Lauren to repeat the Work connection test.
- PR110/112, original five Library screenshot identities and earlier observations remain in their existing proof records. Local browser tests do not replace real client evidence.

## Tools and delivery contract

`relay_runner_feedback_submit` is an idempotent COMMAND requiring project, assignment, expected owner/branch, operation ID, original text and artifact repository/SHA. Declare optional `artifact.kind` as `source` for source observations or `runtime` for observations of a tested running artifact; omission remains unverified. Optional PR, deployment ID, native runtime SHA256 and related report ID remain explicit assertions. The repository, assignment, current owner/branch/head come from canonical Runner/GitHub reads. A different tested head is preserved as historical feedback, with an applicability conflict; no current pass is inferred.

`relay_runner_feedback_peek` and `relay_runner_feedback_status` are QUERY operations. Peek returns bounded pages with `next_cursor` and `truncated`. Status reads an exact report. Neither writes a receipt. `relay_runner_feedback_ack` is an idempotent COMMAND requiring exact report/revision, expected owner/branch/head and operation ID. It records a caller-reported `seen` receipt, not native delivery, incorporation or verification. Terminal or unknown assignment states reject writes.

Authentication is the existing MCP ingress. Caller-supplied identity cannot override canonical routing. If a verified Access subject is available, its SHA256 identifies the authenticated actor; otherwise the receipt says unattributed authenticated caller. Shared authentication does not independently prove a Codex thread identity. Represented assignment owner and authenticated actor are separate fields. No new credential, grant or OAuth scope.

Saved means a report was durably written. Queued means it is pending for a matching assignment, not that an executor started. Delivered remains null without a supported transport receipt. Seen is an explicit authenticated caller assertion, with `native_delivery_verified: false`. Incorporated, fixed and verified remain null in this iteration; their later writes require separately scoped disposition/evidence work. Unspecified artifact kind prevents `safe_to_apply`. Runtime feedback requires at least one independently matched deployment ID or runtime SHA256, and every supplied runtime field must be matched; omitted values and caller-only values cannot establish tested runtime identity. This resolver currently has no native runtime evidence, so runtime feedback remains unverified. Explicit source feedback can match the canonical source SHA without requiring deployment identity. Acknowledgement alone is not permission to apply a change.

## Storage, concurrency and resume

Reuses `env.EVIDENCE` and `feedback/qa/<project>/reports/<assignment>/` alongside the existing visual journal. Text reports use schema 2 and `fbr_` identities, never fabricated visual IDs. Original text is retained byte-for-byte. Corrections create linked reports rather than replacing text.

Report ID is a SHA256 of project, assignment and operation ID. A canonical intent digest detects conflicting reuse. R2 conditional create with `If-None-Match: *` prevents duplicate concurrent writes; acknowledgements compare the object's ETag and append within the same object. Acknowledgement history is bounded to 32 receipts and never truncated silently. Lost write replies trigger an exact-key readback; unresolved outcomes remain uncertain. No shared monotonic allocator or cross-object transaction is claimed for schema 2.

Canonical identity reads and R2 writes are not atomic together. After a write, identity is rechecked. A changed/unavailable identity produces `ok: false`, an MCP error result, `reconcile_required`, and the retained report so the caller can inspect it. Ownership handoff and artifact changes never silently retarget old reports. Reconciliation is explicit future work.

Cursor scope includes assignment/routing identity, excludes unrelated coordination record revisions, and phases through text then legacy events. Honor continuation even for empty or short pages; restart after a completed scan to catch insertions before an earlier cursor. It is not a permanent chronological high-water mark. Reads never consume reports.

`relay_runner_updates` now returns `feedback_acknowledged: []`, independent feedback pagination, availability and scan-completion fields. Unavailable or incomplete scans cannot masquerade as an empty inbox. `relay_runner_resume` includes pending feedback only with an explicit assignment, and that material feedback affects checkpoint identity. Unscoped resume requests explicit assignment selection rather than choosing a recipient from latest activity.

Legacy events remain readable as reconciliation conflicts when provenance is incomplete. Existing legacy ack objects remain respected; they are not relabelled as proven human/worker reading. The old visual writer and explicit legacy consumer remain for compatibility, but the production updates query no longer calls that consumer.

## Validation and remaining limits

Offline red baseline reproduced concurrent legacy overwrite, missing report 101, dropped routing context, stale-artifact applicability and automatic consumption. The legacy write race itself is not claimed fixed by this text path.

Tests cover text preservation, runtime argument rejection (including inherited property names), concurrent duplicate/distinct submissions, conflicting operation reuse, lost responses, competing ETag acknowledgements, short-page pagination beyond 100 reports, legacy pagination, owner/head changes, terminal states, unavailable storage/provider, unauthenticated zero-write rejection, read-only updates/resume and truthful native-delivery status. The full authenticated entrypoint tests useful text, structured data and retained-write error receipts. Original capability/resource assertions remain intact.

Initial local verification: all 358 repository tests passed (262 Inspector/source, 56 Runner, 3 layout, 17 contracts, 20 web); `npm run build` passed. Independent review then reproduced an applicability defect: omitting both runtime fields yielded `safe_to_apply: true`. The fix introduces explicit source/runtime classification and keeps unspecified reports unverified. Regression coverage includes omitted metadata, each field supplied only by caller or only by target, mismatches, verified matching identities and acknowledgement preserving unknown applicability. Logs and isolated fixture outputs are retained in the task's `research/feedback-*` artifacts. No assertions were weakened to make the legacy defects pass; the old visual writer's known issues remain recorded explicitly.

Review-fix validation: all 361 repository tests passed (263 Inspector/source, 58 Runner, 3 layout, 17 contracts, 20 web), build and web typecheck passed. The schema classification remains additive: reports without it remain readable and retain their original text/receipts, with applicability explicitly unverified.

Local workerd R2 proof successfully exercised concurrent conditional create and conditional acknowledgement against the actual local R2 implementation: one report, one retained receipt, revision 2. Installed workerd supports compatibility through `2026-09-10`; the isolated fixture uses that date. Production remains `2026-09-29` unchanged. This proof establishes local conditional-write behavior, not a production or native-host result. Wrangler dry-run packaging and execution of its bundle separately verify discovery of 59 tools, feedback validation dispatch and unchanged diagnostic resource envelopes. No upload occurred.

Pending release gates: exact final-head CI/admission, independent review and Julian's serialized release clearance with website PR111. Draft PR only at this checkpoint. No actual user feedback report, live acknowledgement, native task wake or production feedback fixture has been sent.

Explicit follow-ups: the visual-review save and journal append are still separate writes and need a jointly scoped idempotency/transaction repair with their HTTP/app callers; full disposition writes for incorporated/fixed/verified; supported native pickup/delivery evidence using an actual report; all remaining ordinary-chat/browser/iPhone proof and the broader MCP rebuild. Do not turn passing infrastructure or a stored queue item into a completion claim.
