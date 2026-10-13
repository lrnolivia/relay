# Relay findings / suggestions

This is a running, low-pressure ledger of wrinkles found while publishing, coordinating, deploying, and operating Relay.

Future builds may pick up any item that still makes sense. Entries are **not automatically commitments** and should not reopen completed releases unless a new assignment explicitly owns the work.

## Suggested task classes

New Relay assignments should declare one primary class:

- **design** — visual language, UI composition, interaction design, motion, copy, information presentation.
- **architecture** — control-plane contracts, state models, authorization, APIs, persistence, orchestration, cross-system reconciliation.
- **maintenance** — cleanup, lifecycle repair, docs, stale-state removal, compatibility fixes, test/tooling polish, release hygiene.

Prefer separate assignments when work crosses classes. A design task should not quietly redesign backend state; an architecture task should not opportunistically redo visuals; maintenance should not absorb product features. Cross-class work should require an explicit rescope or a linked successor assignment.

## Running findings

### RFS-001 — completed claims leave queue residue
**Status:** open  
**Class:** maintenance  
**Observed:** Relay 1.7 and 1.7.5 claims correctly became `completed` and `reserved:false`, but their historical queue entries still report `state: claimed`.  
**Impact:** old work can still look open to callers that inspect queue records naively.  
**Suggestion:** completion should archive/close the associated queue item, or the read contract should expose a canonical archived state and exclude it from live-work views.

### RFS-002 — held or superseded work can consume branch budget indefinitely
**Status:** open  
**Class:** architecture  
**Observed:** held/superseded reservations continued counting toward the 4-branch budget and blocked a legitimate 1.7.5 claim.  
**Impact:** Relay can appear backed up even when little real execution is happening.  
**Suggestion:** distinguish active execution capacity from historical/held ownership. Consider explicit `superseded` / `archived` lifecycle states and a bounded policy for when held work stops consuming execution capacity.

### RFS-003 — umbrella assignments do not automatically reconcile after child batches finish
**Status:** open  
**Class:** architecture  
**Observed:** the Relay consolidation umbrella remained active after all six consolidation batches shipped.  
**Impact:** stale parent reservations consume capacity and make project state misleading.  
**Suggestion:** parent completion should be derivable from child receipts, or Runner should surface a reconcile action when every owned child is completed.

### RFS-004 — absorbed queue items remain visible as future work
**Status:** open  
**Class:** maintenance  
**Observed:** assignments absorbed into a successor can remain queued even when their scope is already owned by that successor.  
**Impact:** duplicate-looking work inflates backlog and can be accidentally claimed later.  
**Suggestion:** add an explicit `absorbed` / `superseded_by` transition and remove those items from claimable/live queue views.

### RFS-005 — assignment declarations are not execution progress
**Status:** backend addressed in 1.7.5; UI pending in 1.8  
**Class:** architecture  
**Observed:** `active`, lease state, and `next_action` prose were being rendered as if they represented real work.  
**Impact:** dashboard status could look precise while being stale or wrong.  
**Suggestion:** keep `relay_runner_progress` as canonical observed state and have 1.8 bind directly to its events, stage, freshness, identities, blockers, and external-system state. Never infer execution from prose alone.

### RFS-006 — external work must suppress false “worker frozen” conclusions
**Status:** partially addressed in 1.7.5  
**Class:** architecture  
**Observed:** CI can spend meaningful time in GitHub-hosted steps such as deterministic Chromium installation while the worker itself is waiting.  
**Impact:** liveness UI can report a dead/frozen worker while an external dependency is actively progressing.  
**Suggestion:** preserve separate worker and external-system liveness. Future progress adapters may optionally ingest job-step detail, not only check-level state.

### RFS-007 — server-derived `base_sha` needs explicit contract text
**Status:** addressed in 1.7.5  
**Class:** maintenance  
**Observed:** the claim engine requires `base_sha`, while MCP intentionally does not accept caller-supplied `base_sha`. This was easy to misread as a wrapper bug.  
**Impact:** workers can attempt unsafe or unsupported baseline inputs.  
**Suggestion:** keep the current architecture: Relay resolves live default-branch SHA server-side. Tool errors/help should continue saying callers must omit `base_sha`.

### RFS-008 — generic SOURCE and privileged Runner writes need clearer authority messaging
**Status:** addressed in 1.7.5; keep watching  
**Class:** architecture  
**Observed:** `relay.SOURCE` correctly rejects direct default-branch writes, while Runner legitimately updates `coordination/*.json` through a CAS transaction.  
**Impact:** the difference can be mistaken for a GitHub App permission failure.  
**Suggestion:** continue documenting that SOURCE is branch/PR source authority and Runner is bounded control-plane state authority.

### RFS-009 — exact-source deployment can regress live configuration if repo config is stale
**Status:** open  
**Class:** architecture  
**Observed:** the live Worker allowlist had been expanded to five scripts, but `wrangler.jsonc` still contained only `relay`. An exact-source upload could have reverted the live fix.  
**Impact:** shipping correct code can silently restore stale configuration.  
**Suggestion:** add a pre-upload configuration drift check comparing source config with live non-secret bindings/vars, requiring an explicit reconcile decision before exact-source deployment.

### RFS-010 — Cloud authorization should come from project identity plus a fail-closed runtime rail
**Status:** addressed in 1.7.5  
**Class:** architecture  
**Observed:** Cloud writes were originally controlled by a mystery comma-separated Worker allowlist.  
**Impact:** project ownership and deploy authority were hard to discover.  
**Suggestion:** keep project registration as canonical project→Worker intent while retaining the runtime Worker allowlist as a second safety layer. Avoid wildcard Cloud authority.

### RFS-011 — source-tool auth descriptions can drift from actual auth
**Status:** addressed in 1.7.5; keep watching  
**Class:** maintenance  
**Observed:** MCP descriptions still said some writes required `RELAY_GITHUB_TOKEN` even when Relay was successfully using GitHub App installation auth.  
**Impact:** workers can diagnose a nonexistent credential problem or reach for the wrong connector.  
**Suggestion:** generate tool help from the same auth capability model reported by `relay_control_status`.

### RFS-012 — connector authority can differ even inside the same GitHub repository
**Status:** open  
**Class:** maintenance  
**Observed:** Relay's GitHub App could write its admitted branch, while a separate connected GitHub writer returned `403 Resource not accessible by integration` for the same repo.  
**Impact:** fallback tooling can look interchangeable when it is not.  
**Suggestion:** make authority/provenance visible in tool errors and prefer the project’s canonical source authority before connector fallback.

### RFS-013 — large full-file source writes hit MCP payload ceilings
**Status:** open  
**Class:** maintenance  
**Observed:** legitimate updates to a large core file exceeded the Relay MCP request-size ceiling, even though smaller source writes worked.  
**Impact:** workers may be forced to restructure otherwise-simple edits or seek noncanonical writers.  
**Suggestion:** expose a bounded patch/edit primitive, document payload limits, or support chunk-safe server-side patches with exact-SHA/CAS guarantees.

### RFS-014 — product-source SHA and coordination-main SHA are distinct identities
**Status:** open  
**Class:** architecture  
**Observed:** after exact product source is deployed, Runner completion receipts write `coordination/relay.json` to `main`, advancing main beyond the deployed product SHA.  
**Impact:** “production equals main” becomes ambiguous even though deployment is correct.  
**Suggestion:** report `deployed_product_sha` and `control_record_sha` separately everywhere, and never call a coordination-only main advance a product drift.

### RFS-015 — verification can produce contradictory transport/render evidence
**Status:** open  
**Class:** maintenance  
**Observed:** Relay 1.7 root verification recorded HTTP 522 while the browser snapshot still rendered a substantial Relay DOM and accessibility tree.  
**Impact:** a single “pass/fail” verification label can hide a meaningful split between transport status and rendered evidence.  
**Suggestion:** preserve transport, DOM, screenshot, accessibility, and application-health observations as separate evidence dimensions.

### RFS-016 — publishing should end with an explicit lifecycle closure audit
**Status:** open  
**Class:** maintenance  
**Observed:** completed release work has repeatedly been left looking open because completion and queue/history presentation are separate.  
**Impact:** branch budgets, dashboards, and humans all inherit stale-looking work.  
**Suggestion:** make the release checklist end with: claim completed, `reserved:false`, PR merged/closed, deployment identity recorded when applicable, queue/history reconciled, successor state checked, and branch cleanup eligibility surfaced.

### RFS-017 — separate design, architecture, and maintenance ownership
**Status:** proposed  
**Class:** architecture  
**Observed:** broad assignments can mix visual design, backend architecture, and cleanup, increasing path/resource overlap and making parallel work step on toes.  
**Impact:** unrelated workers block each other or accidentally absorb work outside their intent.  
**Suggestion:** add a primary task-class field or equivalent canonical metadata: `design`, `architecture`, or `maintenance`. Use class-aware ownership/resources and show class on dashboard cards. Cross-class changes should require explicit rescope or a linked assignment rather than silently expanding scope.


### RFS-018 — queued assignments cannot be amended canonically
**Status:** adopted by Relay 1.9 `relay-1.9-skills-runtime-creative-20260930`  
**Class:** architecture  
**Observed:** while updating the queued Relay 1.9 assignment, `queue` correctly rejected the duplicate id and `rescope` correctly rejected `acceptance` because it only operates on claimed work. There is no canonical transaction for changing queued intent without deleting/recreating it or bypassing Runner.  
**Impact:** requirements discovered after queueing cannot be incorporated safely; agents are tempted to create addendum assignments, leave important context only in chat, or hand-edit coordination state.  
**Suggestion:** add a first-class `amend` transaction for queued and claimed assignments. Preserve stable id/ownership, use expected-record CAS + readback, keep immutable branch/base identity after claim, conflict-check path/resource expansion, and retain an auditable amendment history including who/when/what/why. Support goal, acceptance, next action, paths/resources and future task-class / ledger linkage fields.

### RFS-019 — the findings ledger should route work, not merely collect it
**Status:** adopted by Relay 1.9 `relay-1.9-skills-runtime-creative-20260930`  
**Class:** architecture  
**Observed:** findings can be recorded correctly yet still require a human or agent to notice that an existing planned release is the natural owner.  
**Impact:** useful discoveries can sit inert, get duplicated into new assignments, or be rediscovered later even when an existing assignment could absorb them cleanly.  
**Suggestion:** make ledger review part of Relay's planning/coordination skill. For relevant open findings, classify `adopt`, `defer`, `reject`, or `supersede`; route adopted findings into the best existing assignment through canonical `amend` when safe, otherwise deliberately create/link a successor. Update the RFS entry with assignment linkage/status. The ledger is a planning input, not an automatic backlog.


### RFS-020 — active work needs low-overhead durable resume checkpoints
**Status:** adopted by Relay 1.9 `relay-1.9-skills-runtime-creative-20260930`  
**Class:** architecture  
**Observed:** long-running Codex/Claude/ChatGPT workers can exhaust usage, disconnect, or lose chat continuity after making substantial progress. Existing heartbeats and source state prove pieces of activity but do not always provide one compact, recent handoff that another worker/chat can immediately resume from.  
**Impact:** recovery depends too much on reconstructing intent from chat history, branch diffs, PR state, screenshots, or stale `next_action` prose; manual status-writing also slows the worker doing the actual work.  
**Suggestion:** add a Relay-managed checkpoint/resume subsystem. Generate compact durable checkpoints passively from canonical evidence already available to Relay: assignment identity, branch/base/head, changed paths, recent commits, PR/check/deployment state, current stage, last successful action, blocker/wait state, next action, open QA/review context, relevant ledger links, and exact evidence/preview identities. Trigger checkpoints on meaningful state transitions and at a bounded active-work cadence, dedupe unchanged state, and avoid requiring the model to author long handoffs. Expose the latest valid checkpoint through a simple resume/read contract and contextual UI. Planning/coordination skills should use checkpoints first when resuming interrupted work.

## How to use this file

When a new build starts or an existing assignment materially evolves:

1. scan open/proposed entries relevant to its scope;
2. classify relevant findings as adopt, defer, reject, or supersede;
3. when an adopted finding belongs in an existing assignment, use the canonical assignment-amendment flow rather than creating an addendum or hand-editing coordination state;
4. otherwise create/link a deliberately classified successor only when the work truly needs independent ownership;
5. reference the RFS id in the owning assignment/release handoff and update the ledger with that linkage/status;
6. when work lands, update the entry status;
7. append newly discovered publishing/coordination wrinkles rather than burying them in chat history.
