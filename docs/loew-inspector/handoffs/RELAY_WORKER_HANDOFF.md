# relay worker handoff

Updated: 2026-09-30
Recipient: existing first-class Relay worker
Status: prepared implementation handoff; roadmap below is planned, not shipped.
User direction: combine the Relay roadmap, MCP app UI, conflict resolution, design screenshots and approvals; execute in batches. Batch 1 must make functionality reliable and systematically build the missing small tools. Work smarter through shared templates and deterministic models.

## Objective and boundaries

Make relay the dependable ChatGPT front door for loew.fi project work: resolve context, coordinate ownership, execute authorized actions, verify exact artifacts, present decisions, and preserve durable outcomes.

relay owns conversation-facing tools and MCP app interaction. runner owns project registration, assignments, ownership, queues, policy, review/approval records and execution state. inspector owns runtime verification and evidence. GitHub remains source/PR/check truth; Cloudflare remains deployment truth. Reuse these backends; no second coordination engine, approval store or Preview engine.

This handoff authorizes preparation for the existing Relay worker; it does not create a worker, spawn internal agents, or prove implementation occurred. This documentation task does not execute the roadmap. The worker must refresh ownership and acquire scoped claims before implementation. Respect current first-class worker contracts; no hidden agents or unsolicited hierarchy changes.

Non-product documentation belongs in Runner. Currently Relay implementation is in lrnolivia/loew-inspector; resolve live project registration before work. Do not create a new repo or move code solely because the product is called relay.

## Mandatory startup context

Read Runner main:
- contracts/manifest.json and LOEW_CHAT_BIBLE.md
- docs/WORK_COORDINATION.md
- projects/loew-inspector.json and coordination/loew-inspector.json
- docs/loew-inspector/STATE.md and docs/ACCESS_CONTROL.md
- relevant Runner 3.0 architecture/assignment when touching its records or UI

Then read target AGENTS.md, src/index.js, src/source.js, src/cloud.js, src/relay-ui.js, src/skills.js and related tests selectively. Inventory exact callable tools and deployed code before implementing. For field integration, read current field product architecture, naming and QA overlays; preserve Design, Content, Code and Preview, source identity, design graph semantics, and Preview as runtime truth.

## Verified starting point

- Canonical MCP ingress: https://relay.loew.fi/mcp; Relay v1.1.0.
- Worker name: loew-inspector. Stable Cloudflare ID: 734382bfc38a43cfb8cf9115116ed688.
- SOURCE GitHub App auth is configured/read-write. App ID 5133504.
- CLOUD primary token works; Builds uses dedicated CLOUDFLARE_BUILDS_API_TOKEN.
- Inspector PR #30 merged at 53c0bf0556d881969c2701be28de4021f9fcbde9; PR #31 merged at 5648b9147c63f68d34517c31d903a0f8464c5670. Tests/admission passed.
- Version 34: 7c35957d-2611-4cf6-a849-1fef7752eceb; deployment 22fcad2c-f36b-4411-b7d7-96098ba5dae7 at 100%, 2026-09-30T10:20:35.420697Z.
- All nine bindings retained, including five secret bindings. Three domains retained: relay.loew.fi, relay-inspector.loew.fi, inspector.loew.fi.
- Live SOURCE repository reads, CLOUD Worker summary, Builds (ok:true/builds:[]) and direct protected Runner read (HTTP 200 JSON) passed.
- Current cloud write allowlist is [loew-inspector]. Broad credential authority does not broaden tool authority.
- Credential/rename claims completed; durable closeout merged in Runner PR #35.
- A control-center tool and UI source exist. Their existence does not prove the proposed full review workflow is implemented.
- Native coordination, conflict review, scoped approvals and full publication orchestration below are proposed capabilities, not verified shipped features.

Refresh this snapshot before implementation; avoid repeating completed credential setup.

## Execution method: templates and coherent batches

First build a capability matrix: operation, current tool/backend, read/write scope, schema, permission, exact-state precondition, result receipt, error class, test fixture, status (existing/repair/missing/deferred). Every small tool must have an explicit backend and acceptance criterion.

Use one operation definition/template to drive tool registration, schema validation, permission annotations, adapter invocation, normalized output, audit receipt, fixture tests and UI action descriptors where feasible. Shared helpers own identity resolution, policy evaluation, compare-and-swap, idempotency and error classification. Keep provider-specific semantics in adapters.

Use templates for:
- bounded assignment and worker handoff
- operation receipt and recovery instruction
- ownership/semantic conflict
- exact-artifact review with evidence
- scoped approval and revision request
- publication plan, verification and rollback
- QA classification and danger-zone packet

Templates are data contracts backed by deterministic validation, not repeated prose or independent per-tool implementations. Choose the smallest shared abstraction that removes actual duplication. Do not generate a framework before proving representative read, write and evidence operations.

Maintain one batch ledger in this handoff or existing canonical state: admitted scope, head/PR, completed capabilities, checks/evidence, blockers and next action. Finish/merge/close one coherent assignment before the next. Avoid per-chat branches and permanent domain branches.

## Batch 1 — reliable tools and shared foundations (first priority)

Goal: all required small operations have dependable contracts, backend enforcement, recovery and meaningful verification before UI polish.

### 1A. Inventory and standardize existing tools

Audit existing CONTROL, SOURCE, CLOUD, RUNNER, VERIFY and app-resource tools. Exercise representative authorized reads/writes/evidence, then repair evidenced gaps. Standardize:
- validated schemas and bounded arguments
- stable project/assignment/owner/repo/ref identities
- typed success/error results, timestamps and exact artifact references
- safe read-only/destructive/idempotency metadata
- permissions and server-side authorization
- timeouts, retry-after, bounded retries and truthful unsupported states
- post-write readback and idempotency keys for retryable mutations
- uncertain writes reconciled by lookup before retry
- no secrets in results, logs, screenshots or UI

Reuse existing working SOURCE/CLOUD tools rather than rebuilding them. Classify auth, permission, policy, capacity, conflict, provider, product and harness failures separately.

### 1B. Native Runner coordination tools

Expose the existing shared Runner rule engine through bounded tools for:
- project resolve/list/status
- assignment read/list and queue
- claim, preflight, heartbeat, hold, handoff and complete
- ownership/conflict inspection
- audit and policy-eligible branch cleanup

Do not add blind release, takeover on lease expiry, destructive generic cleanup or another ownership registry. Completion must verify merged identity and work accounting. Claims cover exact paths plus semantic resources. Same assignment/branch continues across handoffs. Required checks remain enforced.

### 1C. Source and cloud publication primitives

Fill missing operations systematically:
- PR/check/branch/head inspection
- exact-head PR metadata update, ready-for-review and policy-compliant merge
- deployment/version inspection, bounded deploy and rollback
- post-deployment health/identity verification
- operation receipt/status lookup for interrupted actions

Expose only approved scopes; preserve existing allowlists and protections. A check result belongs to its head SHA. Merge rejects head changes. Deployment binds exact source/version; rollback records last-known-good state. Do not add unrestricted shell, arbitrary API or account-wide write tools to avoid a missing bounded operation.

### 1D. Review, evidence, conflict and approval primitives

Provide deterministic create/read/update/resolve operations for:
- review packet and linked evidence
- before/after capture requests through Inspector's existing engines
- ownership/path/semantic conflict record and resolution proposal
- approval request, approve/reject, revision request and stale/revoked status
- activity/operation history and handoff generation

These should store records in Runner's existing ownership/state architecture or a scoped extension agreed with its owner. UI and chat must use the same operations. Approval never itself overrides mandatory checks.

### Composio dependency exit criterion

Composio is a temporary fallback/bootstrap and recovery transport, not a required normal-operation dependency in the intended Relay workflow. Working credentials alone do not supply missing MCP tools. Recent fallback use covered coordination record transactions, PR ready/merge, and Cloudflare Worker rename/source upload.

Batch 1 must map every routine fallback to a bounded native Relay operation backed by the same deterministic engine. Prove a complete normal project workflow with Composio disabled: resolve → claim/preflight → source change/PR → checks/review → authorized exact-head merge → deployment → runtime evidence → completion. Do not copy Composio's unrestricted execution surface. Worker identity/admin migration can remain a documented exceptional recovery capability rather than expanding routine writes.

Keep Composio available as optional out-of-band recovery while migration is verified, but do not make the user install/connect it for ordinary Relay work. A host connector permission prompt is separate from backend tool coverage and cannot be promised away. Report precisely which operations still depend on external fallback.

### Batch 1 acceptance

Capability matrix accounts for every operation above; deferred provider/platform constraints have explicit reasons. Tools enforce identical policy from chat and UI. Meaningful tests cover overlapping claims, CAS conflict, expired-owner reservation, changed-head rejection, denied scope, duplicate submission, timeout after successful write, stale evidence/approval, absent evidence, provider outage and retry exhaustion. Mutation receipts are durable and re-readable after chat/widget restart. Representative end-to-end authorized workflows pass on exact artifacts. Existing SOURCE/CLOUD/Builds and protected Runner reads remain healthy. No new repetitive user prompts for already-authorized routine work.

Native API/control primitives and templates may land in coherent sub-batches; full UI is not a Batch 1 prerequisite. Do not claim all tools implemented because they have schemas.

## Batch 2 — Access cleanup and operational hardening

After Batch 1, refresh live apps, references, clients and traffic. The previously pending direct authenticated Runner read passed, but retire compatibility only with current dependency evidence.

Follow docs/ACCESS_CONTROL.md: retire unused legacy auth applications/policies/tokens and aliases one step at a time; preserve active relay-github-bridge automation trust. Disable workers.dev and preview URLs with source/live configuration aligned. Check the renamed workers.dev hostname explicitly; do not assume the old hostname-specific Access app migrated.

Acceptance: canonical OAuth/client flow and GitHub automation bridge both work after each removal; protected/public routes retain intended boundaries; zero-reference checks precede token/policy deletion; exact rollback and updated docs exist. No credential rotation or replacement merely for cleanup.

## Batch 3 — review-centered MCP app UI

Build on Batch 1 operations. The embedded ChatGPT app is the visible control center; chat handles conversation and the app makes work inspectable/actionable.

Views:
- Projects: current assignment, owner, branch, deployment, next action.
- Work: active, held, blocked and queued work with true ownership.
- Review (primary workspace): change, screenshots, conflicts, evidence, revisions and scoped approval together.
- Activity: durable actions, actors, results and recovery.

Use compact neutral chrome, precise rows/spacing, restrained radii/shadows, sparse accents, aligned inspectors, keyboard access, readable loading/error/empty states and responsive layouts. Avoid decorative generic SaaS surfaces. Project-aware chat commands open the matching app context; UI must not fabricate execution or wake arbitrary chats.

Acceptance: test in the real MCP host, including tool/resource discovery, authenticated invocation, actual screenshot delivery, accessible controls, refreshed/stale state and restart recovery. Discover current host capabilities before promising embedded Preview, notifications or persistence. Provide a truthful supported fallback if iframe/host policy blocks interactive Preview.

## Batch 4 — complete review, conflicts and approvals

### Conflict resolution

Show affected assignments, owners, exact files/design objects, semantic resources, competing changes and why they conflict. Support queueing, narrowed non-overlapping scope and explicit ownership handoff. AI may propose a merge/resolution, but cannot silently adjudicate semantic/product intent.

Resolve against a recorded base and both heads; re-check ownership and head identities before applying. Record user decision, applied result and fresh evidence. New conflicting changes invalidate the decision. Offer accept one proposal, combine through a reviewed resolution, request revision or defer. Never lose unique work or release another owner's reservation.

### Design screenshots and Preview

Use Inspector to produce real before/after captures from the baseline and exact proposed build, matched viewport, route, project/fixture and relevant state. Support side-by-side, overlay/diff and full-size inspection with evidence IDs, timestamps, source/deployment identities and concise change rationale. Pixel differences aid review; they do not prove semantic correctness.

Include interactive exact-build Preview when supported. Mark stale, failed, missing or incomparable captures clearly. Use protected evidence delivery consistent with existing R2/auth contracts; no permanent public screenshot bypass. field reviews use real read-only project truth via /qa/work/<projectId> when applicable; /builder/noauth is smoke-only.

### Approvals and revisions

Each request names the concrete action, project, scope, expected head/artifact, baseline, target environment, policy version, required checks, evidence and unresolved issues. Distinguish approval to implement, merge and deploy. Record actor/verdict/time and consume grants only within their scope.

Routine work covered by existing authority proceeds automatically. Prompt only for an actual unresolved decision or configured boundary. Product approvals and unavoidable connector/platform permissions are distinct; do not promise the UI can suppress host permission dialogs.

Bind design verdicts to the reviewed version. Changed heads, material policy changes or changed evidence invalidate affected approval. Server revalidates immediately before action. “Change this” creates a structured revision request on that version; updated work gets fresh evidence. Explain staleness and request renewed judgment only when necessary.

History shows who approved which artifact, what ran/shipped, result and rollback availability. Explicit human review is never an invented automated pass; danger-zone verdicts cannot override failing required checks or security gates.

Acceptance: ownership, semantic conflict, before/after review, approval, revision, invalidation and recovery flows work end to end. Double clicks and replay cannot double merge/deploy. Unauthorized widget calls are rejected server-side.

## Batch 5 — project-aware workflows and publication

“Resume field” resolves current registration, assignment, owner, branch/PR, latest evidence, blockers and one next action. Reuse the assignment across chats; show queue/conflict if unavailable. Missing context is explicit; historical names do not choose the target.

Implement reusable workflows: resume project, review PR, verify Preview, prepare handoff and publish approved work. Publication is a persisted state machine: preflight → checks/evidence → scoped decision if needed → exact-head merge → exact-version deploy → runtime verification → completion/receipt. A failed step preserves progress and recovery; do not rerun successful writes blindly or mark blocked work complete.

Acceptance: happy path plus interruption/head drift/provider failure/stale approval scenarios pass; exact tested/merged/deployed identities remain linked; status view shows evidence-backed running/blocked/review-ready/finished states. Core coordination and UI work without paid model inference.

## Batch 6 — field integration and expansion

field is the first full product integration: select a real design object, request a change, review its exact Preview and evidence, then publish under policy. Preserve graph/source identity and semantic concepts; deterministic modeling remains native field responsibility. Relay coordinates execution/review, not field's document model.

Acquire a separate field-owner handoff/admitted scope before touching field. Extend proven adapters/templates to other loew.fi products only after this integration works.

Acceptance: selected object and proposed change remain traceable through Design, source, Preview and publication; no duplicate runtime; no routine maintenance parity regression. Afterward prioritize reliability, latency, clear failures and recovery over expanding surface area indefinitely.

## Required worker reporting

For each batch report: what changed, what was proposed, exact tested heads/PRs/deployments, acceptance evidence, unverified limits, drift check, claim disposition and next batch. Keep operational docs in Runner. Mirror actual source-authoritative product specs only through the established rule.

First worker action: refresh live registration/code/coordination, produce the Batch 1 capability matrix and templates, then admit one small coherent foundation slice. Do not begin with UI polish or simultaneous implementation across all batches.
