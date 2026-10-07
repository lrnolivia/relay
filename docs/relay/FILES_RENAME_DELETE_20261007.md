# Files rename, soft delete and restore

Lauren explicitly authorized CTRL's backend request: “no you can do what ctrl asks its okay” and “i gave it that instruction lol”. This is an additive slice of `relay-mcp-rebuild-continuation-20261003`, owner `01a11484-a484-7191-baa7-5e64f424f68b`. Same-owner CAS scope/readback and admission passed at2026-10-07T07:22:18.143Z, record `2119ceb90ad23c1967a3b15387a0baacf8fc3d19`, policy `f100beb1c8455f59da2b4a152878ddab2ceccdee`, engine `591d0155555a74db4769fda289e5212b07609e65`. CTRL owns its frontend draft PR30; Relay changes only its backend and verification. Original full rebuild acceptance remains active.

## Contract

- Authenticated `GET /api/files` retains its existing inventory/pagination fields and adds `capabilities:{rename:true,delete:true,restore:true}` and `file_policy:{rename:'ready_only',deletion:'soft',restore_until:'original_expiry'}`. CTRL gates each control on the deployed capability.
- `PATCH /api/files/:id` accepts only `{filename}` in bounded4096-byte JSON. Names retain the existing1–180 JavaScript character limit and prohibition on controls, DEL, path separators and `.`/`..`. Completed files only; an incomplete upload returns409 `file_incomplete` to preserve its resume identity. Success returns `{ok:true,file}`.
- `DELETE /api/files/:id` returns `{ok:true,id,deleted_at,recoverable_until,delete_mode:'soft'}`. Times are epoch milliseconds. Repeated deletion preserves the first deletion time; restoration is available only until the original expiry.
- `POST /api/files/:id/restore` returns `{ok:true,file}` and is idempotent when active. Deleted entries disappear from the HTTP/MCP inventory. New status/download/chunk/upload/complete requests return410 `file_deleted` until restore. Other accounts see the same generic missing response as before; expired files cannot be restored.

The actual approved Origin, explicit `X-Relay-File-Request:1`, signed Access authentication and issuer/subject storage namespace remain required. No checksum, chunk, immutable upload manifest, creation time or expiry changes. An existing begin retry compares the original manifest filename, then reports the current display name. This avoids breaking the upload's stable request identity after a ready-file rename.

## Storage and concurrency

A small `metadata.json` overlay in the existing private file prefix stores display name and deletion time. It shares the original object's expiry metadata and existing scheduled cleanup; deletion never physically removes chunks early or extends retention. R2 ETag conditional writes serialize changes to that overlay. A conflict re-reads and reconciles the current state up to three attempts, then returns409 `file_conflict`. A racing rename cannot overwrite a tombstone; a delete preserves a concurrently committed name for later restore. No new dependency, binding, credential or coordination system is introduced.

Deletion hides new requests. A download already streaming, or an upload/verification already in flight, may finish; deletion does not revoke bytes already delivered or cancel a running request. A late physical chunk/ready marker cannot clear the overlay. Restoring an incomplete file resumes the same chunk inventory and request identity.

## Verification and release gates

Node22.23.3/npm10.9.9, Wrangler4.148.0/workerd1.20261006.1 and the existing lockfile (`302f01f74eef065ae1bea00a1fe6d0922b8cc60fe181e36ecd1c1e7ae24aa034`) remain pinned. Focused checks cover signed real-gateway authentication, cross-account mutations, CSRF/JSON/name bounds, immutable download checksums/expiry, incomplete recovery, all deleted read/write routes, idempotency, cleanup and forced CAS races/conflict exhaustion. A local workerd test uses actual R2 conditional storage with a clearly synthetic principal; it does not stand in for signed authentication or production.

The existing protected production verifier additionally creates one uniquely identified45-byte synthetic file after exact source/build identity is observed. It proves incomplete rename rejection, upload/verification, ready rename, denied Origin/header mutations, soft deletion/hiding, repeated deletion, restore, original expiry and identical downloaded checksum; unauthenticated mutations must be denied by the gateway or recognized Access login boundary. Its own fixture is soft-deleted on exit and expires through normal cleanup. No user file is mutated. Writes are single attempts; failures and cleanup results are retained in `qa-evidence/production/files.json`. Hosted exact-candidate quality/admission, production identity and this lifecycle receipt must pass before the backend is called deployed and CTRL is told to enable its controls.

## Baseline, rollback and durable source

Base is PR172 merge `155585a98e21a20a00d6400be30797791099350d`. Main run `37586166559` passed quality and authenticated desktop/mobile production verification with stored-image read-back. Worker build `4c5d7b4b-6f5e-48cc-9eb6-56edb03bfc9e` succeeded; deployment `39aaa2c2-1984-4639-9f92-0cc631d7abb5`, version `0d958a39-2943-4a4d-8e19-e1eb2803f966`, served100% traffic from07:15:27UTC. Exact web build is `f1f353e16f2638c33b1ce0365a9ca5385be4781faf062239e8ed4c8df05c2702`.

Before any overlays exist, the previous verified Worker is a conventional rollback. **After rename/delete use, do not roll back to an older reader that ignores metadata:** it would show original names and unhide deleted files. A safe repair preserves overlay reads and tombstones while disabling/reverting mutation controls and advertised capabilities through the normal protected source/release workflow, or fixes the affected write path forward. Keep all private objects and expiry unchanged. Even the production test creates an overlay, so review this compatibility boundary before restoring an older version.

Supporting logs are under untracked `qa-evidence/local-github-workflow/`; source publication, independent incremental restore/hash verification and retained hosted receipts provide the durable checkpoint. A local test or draft PR is not deployment. Record the exact final source, hosted gates and Worker version in the same assignment before integration; send CTRL those receipts without changing its checkout or completing the full Relay mission.
