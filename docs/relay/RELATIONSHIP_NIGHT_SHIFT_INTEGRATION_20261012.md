# READY FOR CODEX — 2026-10-20 pause checkpoint

Lauren picked this up in a Claude chat on 2026-10-20 ("you are that claude chat. lets wrap up that mcp rebuild"), then said: "pause and mark this work ready for Codex". Claude stopped right away. This checkpoint is unfinished source, **not a release candidate**: do not merge or deploy it without exact-head CI and review. The only coordination change is the claim handoff described below. No Cloudflare, autonomy, credential or other owner's lane was changed.

## Where it is

- This commit is on the held branch `relay/mcp-rebuild-20261003`, fast-forwarded from `80b887c` with no force push. The branch has not been synced with main since then. Main's history no longer shares an ancestor with this branch, and main has since gained the attribution, AI Cleanup and nudge work, so sync it through the supported route before publication. The touched source files were byte-identical on main `406fcd0` and on `ae24c70` at pickup.
- Live claim `relay-mcp-rebuild-continuation-20261003` stays `held`. At Lauren's direction, its placeholder owner was moved from `claude-open` to `codex-open` through the supported handoff transaction. `codex-open` is a neutral pickup marker for any Codex chat, not a running executor. Codex should refresh live ownership and context, then pick it up through the supported CAS transaction. Lauren does not need to hand Codex anything: this branch, this document and the live claim are the whole handoff.

## What changed since `80b887c`

- `scripts/relay-night-shift.mjs` (hardened, still not installed or scheduled):
  - Cancellation does one bounded status re-read on a failed cancel. If the job is already terminal, it records `already-terminal`. If the revision moved, it retries exactly once against the new revision. Any unconfirmed cancel is recorded as `unknown` with `reconcile_required`. It never loops.
  - `uniqueHosts(plan)` refuses one host id that carries conflicting configurations across jobs. Before, a `Map` silently kept the last one.
  - The CLI treats SIGINT/SIGTERM as a cooperative stop: the same path as the stop file, so it cancels through Relay and persists the receipt. A second signal exits with 130.
- `scripts/relay-night-shift.test.mjs` (new, 14 tests) is imported from `scripts/relay-executor.test.mjs`, so it runs in the `runner` suite. It covers:
  - plan bounds
  - host conflicts
  - a healthy pass with no replay
  - stopping before launch on a hold, missing oversight, outside the window, an operator stop or a control failure
  - non-admitted jobs
  - re-gating right before launch
  - an uncertain dispatch stopping the pass
  - exact-revision cancel with intent persisted first
  - the revision-race retry
  - unconfirmed cancel leading to reconciliation
  - an already-terminal job
  - mid-run control failure
  - persist failure before launch
  - journal mismatch and no resume after a stop

  All of this is fixture evidence only.
- `packages/runner/src/context-service.mjs`: curation now refuses a second curated note while a current one exists for the same proposal. Retract it first. The test was extended to match.

## Verification so far

- `node --test scripts/relay-night-shift.test.mjs`: 14 pass.
- `node --test packages/runner/src/context-service.test.mjs`: 2 pass.
- `npm run test:runner`: 187 pass, 0 fail.
- The first full `npm test` ran without the web build. `inspector`, `layout`, `contracts` and `web` failed with `ERR_MODULE_NOT_FOUND apps/web/generated.js`, so it is not valid evidence either way. The re-run after `npm run build --workspace @relay/web` was stopped by Lauren's pause and did not happen.
- A local untracked `qa-evidence/` directory came from that test run and is not committed.

## Next safe actions for Codex

1. Refresh live coordination and context, and do the supported CAS pickup of the held claim. Settle the branch-prefix question above.
2. Build the web bundle, run all five required suites, and compare against main for any `inspector`/`web` failures.
3. Get a security review of the `src/relay-entry.js` curate ingress, which uses the existing Access verifier. Curation stays fail-closed with no `RELATIONSHIP_CURATOR_BINDING` configured. Do not configure one without Lauren's explicit approval.
4. Night Shift stays non-operational: no plan, scheduler, transport or oversight executor, and no away window has been declared. Do not advertise it.
5. Untouched queued items that could fold in later: `relay-coordination-cleanup-audit-20261003` (Field cleanup exit 2) and `rtxforge-app-evidence-20261003` (docs-only). The others are waiting on Lauren.
6. The Builds token replacement is still Lauren's private step. It is unchanged.

---

# STOP checkpoint — open for Claude pickup

Lauren's latest instruction, relayed by Julian: “have it pause and hand off the rest to Claude”, corrected immediately to “no specific chat just Claude”. Stop feature work and new deployments. Leave the existing assignment held for any Claude chat; `claude-open` is a neutral pickup placeholder, not a running agent. Do not start Claude automatically. The final supported CAS ownership receipt is in Relay context after this checkpoint commit. No named Claude transfer was attempted.

## Current source and healthy release

Assignment `relay-mcp-rebuild-continuation-20261003`, branch `relay/mcp-rebuild-20261003`. Original acceptance IDs0/1/2 and all additions remain authoritative; full scope is NOT complete. Prior local HEAD `ae24c7033d43da061d6e727f2a672dc6515d7a95` incorporates PR225. This checkpoint is unfinished source, not a release candidate. No new PR is opened and it must not be merged/deployed without completing review and verification.

Latest healthy production is PR225, merge `8b6e124c4d9d8dd96256c9fd1fe88d02e1e6c14c`, Worker `ce26ee42-73ae-4a4c-9508-02aa0931d8c4`. Main38189813525, exact-source smoke38189824612 and assurance38189984959 all succeeded. Autonomy revision60 unheld; retained artifact11720836735, archive SHA256 `830e05c40cd6070090eb04ba7a97006272edcd6c3d791a88fd979fff370dab21`, restore SHA256 `9462e3d82e40006f9f3b71aa94ff48a09f07e634d27bad022bb50e5add57e7a1`. User-approved PR186 is unchanged. Assignment hold is separate from project-wide autonomy; this stop does not authorize changing other owners' controls.

## Unfinished changes preserved here

- `packages/runner/src/context-service.mjs`: adds attributed relationship proposals, separate curated notes, per-staff readback and source-retraction applicability. Curation fails closed unless a verified Access principal and server-configured exact project/assignment/owner/branch binding match. No live binding configured, and staff names alone cannot authorize curation.
- `src/relay-entry.js`: for curation only, passes claims from the existing cryptographic Access verifier; never trusts a caller-supplied principal. This ingress change still needs integration/security review and exact-head CI.
- `scripts/relay-executor-inbox.mjs`: carries staff relationship context into refreshed executor inbox snapshots.
- `packages/runner/src/context-service.test.mjs`: provisional/curated separation, principal mismatch, missing binding, spoofed staff label, wrong staff read, replay, retraction and handoff tests. The focused command covering this file, executor-inbox and relationship-context passed16 tests BEFORE the coordinator file was written. This is fixture verification, not a live curation proof.
- `scripts/relay-night-shift.mjs`: initial UNTESTED bounded coordinator. Takes up to8 exact existing jobs within a declared window of at most24h; checks global/project safety and oversight binding; requires protected-source capability; persists launch/cancel intent; does not automatically retry uncertain launches. No test file yet, no live plan, no installation, no scheduler and no execution. Review especially control-read failures during an active dispatch, cancellation revision races, persistence failures, local/remote child-stop behavior, signal handling and restart semantics before use. Do not advertise unattended Night Shift as operational.

No product edits were made after the stop instruction; only this checkpoint and supported ownership transactions followed. No executor/router/coordinator/Codex coding child or CI-watch process matched the process check at stop. The main chat's checkpoint operations are not an autonomous worker. No new deployment is in flight.

## Remaining original scope and boundaries

Use `RELAY_2_0_SCOPE_AUDIT_20261012.md` for the complete seven-stage matrix plus CI, wording, Files and recovery additions. Relationship integration above remains unfinished and disabled for curation until an explicitly approved verified-principal binding is configured. Do not infer lead authority from `primary_staff`. Unattended Night Shift needs tested coordinator integration, an already authorized durable transport, actual oversight executor, and a real declared away window. Live ledger revision0 is empty with no oversight binding; do not fabricate activity. Full remote parity and native-client actions remain unverified; device evidence does not block independent work. Lauren says both machines are rarely on together: do not expand routing or present automatic host choice as a major win. The recorded remote192.168.0.115:22 was freshly unreachable before stop.

CTRL live owner is `01a11484-9715-7f73-b432-c38e46a889b4`, assignment `ctrl-review-first-telemetry-20261003`, active. Its latest recorded Files work is completed; coordinate any new frontend dependency through supported ownership/context, do not overwrite its lane. PC CI publisher/reservation/dispatch remains with its existing owner; exact current owner was NOT resolved before stop. The Bazzite bootstrap owner `normal-chat-project-registry-20260930` is not evidence of PC CI ownership. Do not take over the PC, GW or their checkouts. No dependency message or new owner assignment was sent in this interrupted batch.

## Security wait — already approved, not completed

Lauren answered “Not yet” to the secure replacement handoff. Old Cloudflare Builds token `relay-recovery-builds-20261011` was exposed during earlier setup. Same Builds Configuration Read scope, one-year expiry and same IP setting replacement is explicitly approved; no new approval needed. Browser-control policy requires human completion of credential changes. Private helper `/Users/lrnolivia/Codex/2026-10-11/task/replace-builds-token.command` accepts hidden input and updates only the Builds field in the0600 secrets file. Do not print, copy into chat, commit or inspect secret values. File metadata at stop remains2026-10-11T18:55:04-0400. No revocation, replacement or new secret installation is claimed. Once Lauren completes the private handoff, use the existing approved installation path and verify metadata/read readiness without revealing values.

## Preserved local work

Workspace `/Users/lrnolivia/Codex/2026-10-11/task/relay`; untracked `qa-evidence/` retained outside this commit. Existing `executor-checkout/` and `routing-executor-checkout/` retain earlier worker-authored uncommitted test lines; do not reset them. Protected source archives, independent restored source, private routing/executor receipts, and existing Git bundles remain in the parent task directory. Private receipts may contain lease material: never print or commit them. A complete Git bundle of this stop checkpoint is retained there as `relay-claude-stop-checkpoint.bundle`. Refresh live ownership/context before Claude pickup; no elapsed-time takeover or automatic restart.
