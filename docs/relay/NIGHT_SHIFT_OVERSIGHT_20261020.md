# Night Shift oversight readiness — 2026-10-20

Readiness checkpoint only. Running oversight, actual away-time execution and completion are unverified.

## Identity and authority

- Oversight chat/owner: `01a15a6d-51de-70b1-b1d7-43d543433f59` (“Night Shift oversight”), confirmed through the host chat inventory.
- Assignment: `relay-night-shift-oversight-20261020`.
- Branch: `relay/night-shift-oversight-20261020`.
- Sole source path: `docs/relay/NIGHT_SHIFT_OVERSIGHT_20261020.md`.
- Sole resource: `relay-night-shift-oversight-window-20261020`.
- Staff lead: Roman (`roman`), canonical registry role `verifier`, member of Night Shift, with no prior Relay assignment bindings in the live directory read. Staff identity grants no additional authority.
- Parent assignment `relay-mcp-rebuild-continuation-20261003`, owner `01a1576d-4e3d-78f2-bdde-a1658b3598d0`, branch `relay/mcp-rebuild-20261003`, all reserved paths/resources and original acceptance remain with the parent.
- Authority is the parent's user-visible creation prompt, grounded in Lauren's “you decide” reply to the actual away-window/separate-chat question. The parent chooses and declares 30 minutes after verifying the release. No window or human absence is inferred here.
- Read current Bible version `2026-10-14.1` blob `1ff66c023fb15f10548b528845125cc6e0ef8c2b`, manifest `2026-09-30.2`, project registration, root AGENTS, work coordination, Night Shift contract and blocker/promotion policies. Historical loew-runner naming is subordinate to current canonical Relay authority.

## Admission and binding

Supported CAS claim at 2026-10-20T17:50:02.744Z used record `b6bf477b9be0f413d72ca70c024cf665c1544184`. Resulting record `cd6ddfbca536528a973910b5819f2292c2e45250`, control commit `57592d230078239d060936a07148034b3d3a055d`, exact owner/scope read back. Assignment lease expires 2026-10-21T05:50:02.744Z; this is an assignment freshness lease, not execution evidence.

Supported SOURCE created the claimed remote branch at `7735864a4ec1f201d66c4beb9026bf35546af566` and read the ref back. Preflight at 2026-10-20T17:50:33.392Z admitted the sole receipt path. It reported six unrelated existing unregistered branches; no repair or cleanup was attempted.

Supported Night Shift operation `oversight-bind-20261020-01a15a6d` advanced ledger revision 0→1 at 2026-10-20T17:50:59.411Z and bound this exact assignment/owner/branch. Response: `available:true`, `worker_online_verified:false`, “Canonical assignment bound; worker activity remains unverified.” No ledger work item was created.

## Fresh observations

- Authenticated execution status for this assignment returned `job:null`, revision 0. No oversight execution was submitted, leased or started by this chat.
- Global safety revision 0 and Relay revision 66 were unheld during readiness.
- Relay health returned HTTP 200 with `ok:true`. This health response alone does not identify deployed source.
- The safety service independently exposes last-healthy source `7735864a4ec1f201d66c4beb9026bf35546af566`, Worker version `dd09991d-23f0-44b7-8bd7-ca2d27f461c7`, recorded at 2026-10-20T17:50:30.752Z. Its receipt names main CI `39469091955`, retained artifact `12286158902`, archive digest `65a31967571895d2869f0fc35e1b87d85dd39c5cae82183fe57298cf2a6e4e1a` and isolated restore digest `cec5d763a68546d2717a69ca389f386d6a8b1ddba9a648fd21e62ded6a9ca086`. These are attributed service receipts, not independent acceptance of every rebuilt feature.
- User-approved rollback remains PR186/source `be41bdcc7cf78c3858177ffdd904364d45ff787e`, version `d511a5d1-88c9-4b17-9179-40bd15a998cb`.
- Night Shift initially returned no work items, `away_verified:false`, `process_verified:false`. No positive verification is claimed.

## Exact process-bridge gap

At source `7735864a4ec1f201d66c4beb9026bf35546af566`:

1. `scripts/relay-night-shift.mjs:42-53` requires both the canonical oversight binding and the plan's exact distinct `job_id`. That job must match project/assignment/owner/branch, have `state` and `observed_state` both `running`, a concrete executor ID, positive PID, host/version, valid past start time, and a live broker lease.
2. `packages/runner/src/job-control.mjs:22` admits only `process.adapter = codex-cli`.
3. `scripts/relay-executor.mjs:160-166` supplies that receipt by spawning an actual new `codex` coding process and reporting its PID. This task expressly prohibits additional model children and coding dispatch.
4. Native chat presence, the assignment heartbeat, a shell heartbeat, a test fixture, or an unrelated PID cannot truthfully be reported as that coding adapter. No supported attachment from this native chat to a concrete broker process was established by bounded inspection.

Required bridge contract: an admitted, explicitly supported non-model oversight adapter (or verified supported native-chat attachment) must own one exact oversight broker job under this assignment, report its actual process identity/adapter/version and start, maintain the broker's five-minute lease with CAS checkpoints, observe exact plan jobs plus safety and window bounds, and durably account for cancellation/exit and uncertain writes. It must not silently claim independent host proof; broker receipts remain attributed, and `process_verified` stays false unless separately evidenced. The current public adapter schema requires an owner-reviewed change before an honest non-coding supervisor can use it.

This oversight assignment does not own those implementation paths. No schema change, process launch, secret access/change, curation binding change, model child, coding dispatch, merge, deployment, spending or other owner's mutation was performed. The shared root checkout and recovery files are untouched.

## Next safe action

Parent retrieves this readiness checkpoint and own Relay context through read-only tools; no cross-chat message is sent. Parent resolves the bridge under its existing implementation authority and exact-source verification, then declares the 30-minute window and supplies its exact plan/job identities in durable state. Revalidate claim/binding, bridge source, live exact broker job/process/lease and safety before declaring running readiness or starting the window. Resume actual oversight only on those supported facts, preserving all original acceptance and keeping `away_verified/process_verified/objective_completed` separate.
