# Relay rebuild operating contract

The canonical assignment is `relay-mcp-rebuild-continuation-20261003`. Current ownership and scope must be read from Relay before writes. This document explains the implemented interfaces; it is not an assignment or proof of deployment.

## Execution and Shift

`relay_execution` accepts `submit`, `status`, `cancel`, `lease`, `start`, `checkpoint`, `finish`, and `recover`. Every mutation carries a unique operation ID, exact assignment owner/branch, and (after submission) the current job revision. Submission and leasing verify the source head. R2 conditional writes prevent concurrent admission. One unfinished job occupies an assignment. An expired lease is `recovery_required`, never an invitation to reclaim it automatically.

Shift uses the same API through `/api/execution/request`, with exact retry intent persisted in the browser session before sending. `/api/execution/jobs?project=relay` returns at most 20 assignment rows per page, including recorded historical jobs. The browser can request or cancel; it cannot report a process start, checkpoint, or result. A queued job is not running. Process receipts are attributed executor reports; a successful process does not complete the assignment.

A real local or remote macOS/Linux host runs the same Codex CLI adapter. The job's required capabilities must be a subset of the adapter's actual platform capabilities. The adapter uses a separate clean task checkout, a preserved Codex session for explicit recovery, a process lock, private receipt/transcript files, and the existing CLI sandbox. Interrupted POSIX processes receive TERM and then a bounded group KILL. Receipt storage must be outside the checkout. No arbitrary existing Codex chat is controlled or awakened.

With an **existing authorized Relay connection** supplied by the operator, the complete invocation is:

```sh
node scripts/relay-executor.mjs run /absolute/executor-config.json /absolute/task-checkout /absolute/receipt-directory
```

Configuration (use exact current records; these values are placeholders):

```json
{
  "project": "registered-project",
  "assignment": "existing-assignment-id",
  "owner": "current-owner-id",
  "branch": "current-admitted-branch",
  "executor_id": "configured-host-name",
  "skill_tags": ["engineering"],
  "resume": false
}
```

The process requires `RELAY_MCP_TOKEN` from that existing connection and an already configured `codex` executable/account. It creates neither credentials nor spending authorization. It removes the Relay token from the coding subprocess environment. The continuation environment has neither a `codex` executable on PATH nor a standalone Relay token. Synthetic subprocess tests establish adapter mechanics, not a real coding run or online executor availability. Windows process-tree recovery is not a verified target.

Recovery is explicit: inspect the prior PID/process group, source changes, broker state and journal; confirm the old process stopped; preserve the receipt directory; use `resume: true`. Do not delete a lock merely because time elapsed. Uncertain RPC writes are replayed with their original operation ID and exact intent before new writes.

No oversight staff member is hired or assigned by this code. A staff name in a design or handoff is not staffing authority.

## Skills and project context

`relay_skills` exposes catalog, search, resolve, read, audit, vendor and update planning. Current canonical Markdown generates 31 pinned portable bundles; the earlier 28-bundle archive is stale. The source license is explicitly private. Upstream vendoring requires an exact GitHub commit, independently supplied SHA-256, allowlisted identified license and matching preserved license bytes. Unsupported supporting-file dependencies are rejected rather than silently dropped. Installing is an admitted, immutable, content-addressed filesystem operation; updates create a new pack set and preserve rollback. The executor resolves and verifies packs just in time and installs them into its private receipt directory before use.

The executor refreshes a private `inbox.json` during its run. The prompt directs the existing process to re-read it before meaningful source steps and finalization. A bounded page retains original feedback text, applicability conflicts, context revision and remaining-page cursors. Failed refreshes retain the last good data with an unavailable/stale label. Only read operations are performed; publication is not consumption, acknowledgment, native delivery, or a new turn. Synthetic subprocess evidence demonstrates re-reading changed data; a real configured executor remains a separate gate.

`relay_night_shift` and authenticated `/api/night-shift/items` and `/api/night-shift/request` expose an explicit away-work ledger. Classification requires an existing terminal execution with concrete process, start, exit, source and evidence receipts inside a declared completed away window. GitHub source existence is independently checked; being away and process correctness remain unverified. An oversight binding names an existing admitted assignment and becomes unavailable after a handoff or expiry. No staff member is hired or started by this binding. Shift preserves the item's original source attribution and recipient acceptance in one queued execution. A prepared ledger operation survives uncertain cross-store writes and replays the same broker operation, preserving the job receipt without creating duplicates. Queued, started, recipient acknowledgment and objective completion remain separate.

`relay_context` stores bounded, artifact-bound decisions, lessons and assignment messages with CAS, immutable operation intent, attribution and retraction history. Reading never acknowledges a message. Acknowledgement requires the exact current recipient identity. Source existence does not establish that a lesson's conclusion is correct. There is no automatic native-chat notification, fabricated relationship curation or implied preference approval.

## Reviews and ctrl integration

Browser schema-2 feedback uses authenticated `/api/feedback/submit` and `/api/feedback/status`. Preserve the exact operation ID across uncertain outcomes. Capture identity must name project, assignment, owner, branch and tested commit. Historical review mode verifies the original merged PR/head/merge and never reopens completed work. Saved notes, queued delivery, explicit agent acknowledgement, fixed, and independently verified remain separate facts.

The Relay backend and browser adapter are implemented here. The separate `lrnolivia/ctrl` frontend must consume the same schema-2 binding/transport to prove a ctrl preview → submit → agent acknowledgement cycle. ctrl PR 7 is merged at `c04e402c6982d02b865310b4963f330a69788e66`; that merge does not prove this new feedback integration. Its frontend and recovery files remain outside this assignment. Project/work/review links route to `https://ctrl.loew.fi`, retaining project, assignment and evidence parameters. Public historical Relay workspace routes redirect there. The MCP bridge opens these links through its host.

## Dashboard and refresh

The user supplied the four-card telemetry reference on 2026-10-03 and clarified warm brown greige ctrl colors and ctrl workspace destinations. The Relay page uses completion counts from coordination, moving/waiting observations, explicit input requests, and deduplicated source/check/deployment events in real half-hour bins. It does not invent percentages, time worked, executor availability or simulated chart movement. Partial/stale snapshots remain labelled. Rings, meters and counts animate changes; reduced motion is honored. The existing authenticated WebSocket invalidation channel prompts canonical re-reads with cursor replay/reconnect. Its badge says Live only when the channel and a fresh complete snapshot are present; polling is labelled Auto refresh. Fallback refresh is every minute. The MCP resource retains host-mediated polling where a same-origin socket is unavailable.

Check connection performs an authenticated initialize/ping/tool-list sequence and reports elapsed time. Refresh tools reports the server schema digest separately from client installation. The current stateless MCP advertises no `tools.listChanged` capability, and this website has no authenticated host-refresh API. Its supported fallback is the existing plugin settings URL. Opening that URL is not a client refresh receipt. The existing plugin identity is preserved.

## Rollback and proof boundaries

Prior released lifecycle slice: PR 139, merge `256cf79d446e4e6f84cde3f54a0e576aa11b4eb9`, Cloudflare version `db7a8c5a-fee2-48c5-aee0-d182dfb97236`, engine `0dfefbbd022d6efd058db696bd00bdb4785a6235`. New execution/context/index keys are additive and historical source objects are preserved. Rolling back code must preserve these records for forward recovery.

Exact-head CI, source publication, installed host schema, website runtime, ordinary-chat mount/actions and physical-client verification are separate gates. Neither a fixture nor a server receipt establishes all-client delivery. See the acceptance ledger for outstanding proof.
