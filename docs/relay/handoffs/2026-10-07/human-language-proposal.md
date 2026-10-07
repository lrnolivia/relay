# Relay human-language contract

Implementation-ready catalog and audience-separation proposal · 7 October 2026

## Decision

Give Relay one deterministic presentation layer: a typed result or event goes in; a short, kind, accurate explanation comes out. Use that layer for the website, cards, notifications and human-readable MCP text. Keep exact states, error classes, identities, evidence and recovery requirements in the machine contract.

This is a source-grounded specification, not a shipped change. The work was read-only: no product source was changed, no repository scripts were run, and no release or deployment was performed.

“Kind” means clear, useful and respectful. It does not mean hiding a failure, calling uncertainty success, or asking a person to fix something Relay can handle. A good explanation answers: what happened, what it means for this task, and what happens next. Routine successes usually need only the first part.

## 1. Evidence and limits

Three evidence sets were inspected. They must not be conflated:

- **P170:** exact GitHub file reads at `74f373ea67709f35fb485ee51d17800aad111c94`, the supplied PR170 head. These establish those file contents at that commit, not the current main branch or live deployment.
- **UI839:** a local, manifest-backed UI snapshot at `839a8d49236d25e15ba662913b1259dd4267729a`. UI findings below are historical source findings requiring comparison with the active owner's branch.
- **CP:** a local source-checkpoint repair candidate whose manifest records base `53de286d49c274fc02ef408361e43b00d95142f7` and a 7 October 2026 candidate checkpoint. This is a mixed candidate snapshot, not a verified repository-wide commit. CP findings identify contracts to recheck, not current production behavior.

New Files backend work is ongoing outside these inspected versions. P170's file backend has upload/status/download/expiry and same-account transfer operations; it does not implement rename, user deletion or undo. Those are proposed integration contracts in §8, not claims about available features.

### Source index

Identifiers in brackets throughout the catalog refer to this index. Links point to exact commits where that provenance is established.

| ID | Inspected source / functions | Coverage |
|---|---|---|
| S1 | [P170 `src/relay-entry.js`](https://github.com/lrnolivia/relay/blob/74f373ea67709f35fb485ee51d17800aad111c94/src/relay-entry.js#L221-L298): `toolResult`, `classifyExtensionError`, `toolError`; extension dispatch and legacy rewriting | MCP success/error serialization, extension classifiers, recovery prose |
| S2 | [P170 `src/index.js`](https://github.com/lrnolivia/relay/blob/74f373ea67709f35fb485ee51d17800aad111c94/src/index.js#L960-L1508): tool dispatch, `rpc`, `rpcError`, outer error handling, auth and HTTP routes | Legacy MCP output families; transport/auth errors; tool names, not every imported implementation |
| S3 | [P170 `src/relay-chat-ui.js`](https://github.com/lrnolivia/relay/blob/74f373ea67709f35fb485ee51d17800aad111c94/src/relay-chat-ui.js#L69-L161): `contextCardModel`, `compactContextCardResult`, `contextualPresentation`; card HTML/refresh handling | Human object, labels, summary/next-step heuristics, details, generated browser model |
| S4 | [P170 `src/runner-control.js`](https://github.com/lrnolivia/relay/blob/74f373ea67709f35fb485ee51d17800aad111c94/src/runner-control.js#L243-L295): `runnerControlError`, `safeGithubFailure`, tool definitions | Runner error envelope, allowlisted provider diagnostics, command semantics |
| S5 | [P170 `src/progress-observation.js`](https://github.com/lrnolivia/relay/blob/74f373ea67709f35fb485ee51d17800aad111c94/src/progress-observation.js#L11-L85): `deriveObservedProgress` | State precedence, event kinds, freshness, source/deployment identity matching |
| S6 | [P170 `src/controller.js`](https://github.com/lrnolivia/relay/blob/74f373ea67709f35fb485ee51d17800aad111c94/src/controller.js): `planEvidenceRequest`, `normalizeBrowserCapacityError` | Evidence planning and deferred browser-capacity result |
| S7 | [P170 `src/file-transfer.js`](https://github.com/lrnolivia/relay/blob/74f373ea67709f35fb485ee51d17800aad111c94/src/file-transfer.js): `transferWrite`, `transferRead`, `readBrowserFiles`, `browserFileResponse`, expiry functions | Full inspected transfer/browser-file backend; no rename/delete/undo route |
| S8 | [P170 `src/mcp-request-body.js`](https://github.com/lrnolivia/relay/blob/74f373ea67709f35fb485ee51d17800aad111c94/src/mcp-request-body.js): `McpBodyError`, `mcpBodyErrorResponse`, `readMcpBody` | Request rejection before tool execution; 8 MiB envelope limit |
| S9 | [P170 `apps/mcp/index.js`](https://github.com/lrnolivia/relay/blob/74f373ea67709f35fb485ee51d17800aad111c94/apps/mcp/index.js), `packages/inspector/index.js` | MCP/web routing, web API authentication, invalidations, wrapper boundaries |
| U1 | [UI839 `packages/shared-ui/presentation-copy.js`](https://github.com/lrnolivia/relay/blob/839a8d49236d25e15ba662913b1259dd4267729a/packages/shared-ui/presentation-copy.js) | Existing `humanState`, `humanText`, `evidenceLabel` display-only map |
| U2 | UI839 `packages/shared-ui/work-view-model.js`, `work-viewer.js`, `work-activity.js`, `presentation.js` | Work grouping, detail drawer, review controls, raw fields |
| U3 | UI839 `packages/shared-ui/notifications.js`; `apps/web/src/live.tsx`, `components/LiveTelemetry.tsx`, `pages/TodayPage.tsx` | Notices, partial updates, telemetry, attention summaries |
| U4 | [UI839 `packages/shared-ui/file-manager.js`](https://github.com/lrnolivia/relay/blob/839a8d49236d25e15ba662913b1259dd4267729a/packages/shared-ui/file-manager.js) | Browser file copy, upload progress, error messages |
| U5 | UI839 `apps/web/src/components/ExecutionPanel.tsx`, `pages/NightShiftPage.tsx`, `RunnerPage.tsx`, `RelayPage.tsx`, `RunnerWorkPage.tsx`; `apps/web/src/api.ts`, `apps/web/api.js`, `public/loading.js`, `public/progress-ui.js` | Execution/oversight controls, UI API errors, loading and progress surfaces |
| C1 | CP `src/operations.js`, `progress-api.js`, `progress-reconciliation.js`, `operation-events.js`, `operation-receipts.js` | Freshness policy, queued progress, observation coverage, event/receipt contract |
| C2 | CP `src/resume-checkpoints.js`, `recovery-signals.js`, `amendment-sync.js` | Resume, cadence, source recovery hints, update gaps, recovery signals |
| C3 | CP `packages/runner/src/jobs.mjs`, `job-control.mjs`, `night-shift.mjs` | Queued vs running vs executor-reported results, source protection, oversight handoff |
| C4 | CP `src/source.js`, `cloud.js`, `coordination-engine.js`, `feedback-control.js` | Source/cloud provider failures, ownership/branch guards, completion/retirement, feedback receipt semantics |

### Confirmed design problems to fix

1. There is already a human layer, but it is incomplete. S3 adds `human`; U1 maps display strings. S1/S2 still emit raw exception text or JSON, and several UI views bypass U1.
2. S3:74,95–96,118–120 detects “technical” words with a regex. A next step mentioning a commit or tool can become “Verify the refreshed chat connection before continuing,” regardless of the real task. This can actively misdirect a person. Replace the inference, not merely its wording.
3. S3:119 treats a merged pull request as terminal and suppresses its next step. Deployment or live verification can still be outstanding.
4. S3:155 compacts an error to its message, discarding class and timing information the human formatter needs. Preserve typed facts before compacting for display.
5. S5 has separate worker freshness and meaningful-progress freshness. A heartbeat is deliberately excluded from progress. Preserve that distinction on every surface.
6. Some UI839 copy promises saved requests, retained chunks or sign-in recovery without evidence. These require state guards, not friendlier synonyms (§8, §10).
7. The extension classifier uses message/tool-name regexes; Runner and browser-capacity responses have different shapes. Introduce stable code and operation metadata at their sources, then normalize once. Do not turn a presentation project into an unreviewed behavior change.

## 2. Language rules

### Default voice

- Say the concrete thing: “GitHub is limiting requests,” “The upload is incomplete,” “The change is merged.”
- Prefer one short sentence plus a useful next step. Add context only when it changes a decision.
- Refer to the project, file or check by its safe display name. Keep IDs and exact hashes in details.
- Use “Relay” for product actions, “the worker reported” for attributed receipts, and “you” only when a real user action is required.
- Be candid about uncertainty: “Relay couldn't confirm whether the change was saved.”
- Keep cancellation, failure, expiry, rejection and supersession distinct. A cancelled check did not fail a product test; a skipped check did not pass it.
- A button names what it does: “Check status,” “View check results,” “Sign in,” “Rename,” “Restore file.” “Retry” is allowed only when repeating that operation is safe and supported.
- Do not say “All set,” “Everything is safe,” “No data was lost,” “This will only take a moment,” or “We'll retry soon” without evidence for that exact claim.
- Do not expose “CAS,” “canonical,” “lease,” “provider,” “reconcile,” “readback,” “admission,” or raw namespace names in default copy. Details may use them precisely.
- Do not replace all “blocked” states with “Needs you.” Many blocks are machine-owned.
- Do not label known technical work trivial or blame the user: avoid “Oops,” “just,” “simply,” “you forgot,” or “invalid user input.”

### Small glossary

| Internal concept | Human label in context |
|---|---|
| canonical record | saved task record / current task details |
| reconcile / read back | check what was saved / check the latest state |
| claim / admission | assignment / permission to start this work |
| lease expired | worker's assignment needs checking |
| provider / upstream | named service, such as GitHub or Cloudflare |
| source pushed | changes saved to GitHub |
| checks / QA | checks / review, naming what was actually checked |
| artifact identity | version checked |
| capability / binding | connection or feature, naming the missing one |
| complete / finished | the exact stage or task completed, never a universal promise |

These are contextual translations, not global string replacements. For example, “lease expired” cannot prove the process stopped, and “source pushed” cannot prove the site changed.

## 3. Proposed contract and formatter

All dotted `message_id` values in this document are **proposed catalog IDs**. Existing states, event names, error classes and source strings are shown separately in the catalog. No proposed field is represented as already implemented.

### Canonical input

Introduce a versioned normalized event/result, produced from existing typed fields:

```ts
type PresentationInputV1 = {
  version: 1;
  message_id: MessageId;
  params: ParamsFor<MessageId>; // discriminated union, not an arbitrary object
  operation: { kind: 'query' | 'command' | 'discovery' | 'recipe'; name: string };
  outcome: 'observed' | 'accepted' | 'succeeded' | 'failed' | 'deferred' | 'unknown';
  mutation: 'not_attempted' | 'confirmed_applied' | 'confirmed_not_applied' | 'unknown' | 'not_applicable';
  next_action: {
    code: ActionCode; actor: 'relay' | 'user' | 'external' | 'none';
    availability: 'available' | 'scheduled' | 'unavailable';
    target?: SafeTarget; requires_confirmation?: boolean;
  } | null;
  evidence: {
    observed_at: string | null; source: EvidenceSource;
    exact_identity?: ArtifactIdentity; coverage: 'complete' | 'partial' | 'unknown';
  };
  retry: { policy: 'none' | 'read_first' | 'bounded_read' | 'after_provider_window';
    not_before: string | null; scheduled_at: string | null };
  technical: RedactedTechnicalDetails;
};
```

`formatRelay(input, { audience, surface, locale, timeZone, now })` is pure and deterministic. Proposed audiences: `human`, `agent`, `diagnostic`. Proposed surfaces: `inline`, `toast`, `notification`, `card`, `detail`, `mcp_text`. The formatter does no fetching, tool calls, retrying or runtime LLM rewriting. Time is supplied explicitly. Locale cannot change an outcome or permission.

### Human output

```ts
type HumanPresentationV1 = {
  version: 1; message_id: MessageId; locale: string;
  label: string; title?: string; summary: string;
  consequence?: string; next_step?: string;
  severity: 'neutral' | 'info' | 'success' | 'warning' | 'error';
  action?: { id: ActionCode; label: string; target: SafeTarget };
  timestamp?: { observed_at: string; label: string };
  details: { label: 'Technical details'; items: SafeDetail[] };
};
```

The English literal in this illustrative type becomes a localized catalog value. Avoid displaying the same sentence in summary, blocker and next step. A toast may use only title/summary; it must link to durable detail for consequences that do not fit. Long names may wrap or be shortened visually, with the full accessible value available. Never truncate a condition, negation, deadline or destructive-action consequence.

### Routing and precedence

1. Validate the normalized event and allowed parameter types. Missing required evidence selects a weaker message, never a stronger guess.
2. Explicit `ok:false`, failure, uncertainty or stale observation takes precedence over a success-colored card. Keep the last confirmed milestone visible separately.
3. Route by typed code and operation kind. Avoid regex classification except a bounded, exact legacy-string adapter with tests and an expiry plan.
4. Preserve unknown raw enums/codes in redacted technical details; do not print an unknown enum as a human label.
5. Render buttons only for capabilities the caller actually has and actions that remain authorized. Formatting cannot expand access or bypass approval.
6. Say “Relay will…” only if the next action is actually scheduled or accepted by a responsible executor. Otherwise say what is needed, or offer an available action.
7. Use `scheduled_at` for a promised next check. A refresh cadence or quota reset is not a scheduled retry.
8. Keep progress as independent dimensions: assignment/execution, source, checks, review, merge, deployment, live verification, freshness. Do not collapse them into one linear “done” flag or derive an invented percent from their order.

## 4. Audience separation and compatibility

| Audience/surface | What it receives |
|---|---|
| Website, card, notification, toast, inline error | Catalog-rendered human fields; explicit Technical details expansion |
| MCP explanatory `content` text for clients supporting the new contract | A complete short explanation. No raw JSON dump as the default human text |
| Agent orchestration | Existing structured payload plus additive versioned presentation metadata; exact enums, IDs, retry rules and evidence preserved |
| Diagnostic view/log | Allowlisted machine facts and redacted original error; no secrets or unrestricted provider bodies |
| MCP protocol/authentication | Existing JSON-RPC codes, HTTP status, `WWW-Authenticate`, OAuth error codes and envelope behavior unchanged |

MCP `content` is not necessarily “only for humans.” Existing consumers can parse JSON from it: S3:177 explicitly falls back to doing so. Therefore do not silently replace every JSON text block with prose in the first release. Add `human_v1` alongside the existing payload, update first-party consumers to prefer `structuredContent`, and introduce a negotiated/versioned text-presentation mode. Preserve legacy text serialization until tests and consumer migration justify changing it. Do not invent an MCP capability and assume hosts support it; use a Relay-owned supported contract/version or a separate adapter.

Keep existing `human` compatible during migration; do not trust arbitrary incoming `human` fields as authoritative. Build `human_v1` only from validated evidence. Human prose must never be parsed to authorize writes, decide retries or derive status.

Technical details should show useful exact facts: error code/class, service, operation, observation time, request/reference ID when available, affected version, head/revision, check names/results, retry deadline from the service, coverage and evidence source. A concise “Copy details” action copies the same redacted view. It does not reveal credentials, raw request bodies or hidden storage paths.

## 5. Work and release-state catalog

Templates below are default English. `{…}` parameters are validated, escaped display values. An optional next step is emitted only when supported and accurately assigned.

| Proposed ID | Existing evidence / condition | Human label and summary | Guard / next step |
|---|---|---|---|
| `work.queued` | `state:queued`; C1 `queuedProgress`, S3 map | **Queued.** “This task is waiting to start.” | Do not say the process is running or promise queue order/start time. |
| `work.assigned` | Active claim without executor-start evidence; S4/C3 | **Assigned.** “{staff} is assigned to this task.” | Assignment is not proof of a running process. |
| `work.working` | S5 `working` with meaningful evidence | **In progress.** “Work is in progress on {task}.” | Surface the last confirmed event; if only an active claim exists, use `work.assigned`. |
| `work.reserved` | S5 `reserved-but-idle` | **Waiting to start.** “The task is assigned, but Relay hasn't seen a source change yet.” | Does not imply no local work exists. |
| `work.held` | Claim `held`; S5 | **On hold.** “This task is on hold. {safe_reason}” | Reason/actor must be typed; keyword “await” alone cannot establish a user decision. |
| `work.wait_external` | `waiting-on-external-system`; running check in S5 | **Waiting for {service}.** “{check} is still {queued_or_running}.” | Keep queued and running check status distinct. |
| `work.wait_user` | `waiting-for-human` plus confirmed user-review requirement | **Ready for your review.** “{item} is ready for you to review.” | Include an exact preview and bounded decision. If evidence is absent, say “A review is needed. The preview isn't available yet.” |
| `work.blocked` | `blocked`; reason classified | **Can't continue yet.** “{specific_blocker}” | Explain affected step and actor. No blanket request to reconnect. |
| `work.reconcile` | S5 stage `reconciliation`, C1 disposition `reconciliation-required` | **Checking task details.** “The task record and the source activity don't match.” | “The latest details need to be checked before changes continue.” Use present-progress label only if check actually underway; otherwise “Task details need checking.” |
| `work.check_failed` | S5 `failed` at `checks`, actual failed conclusion | **A check failed.** “{check} found a problem.” | Link results. Do not call product broken unless the check proves a product failure. |
| `work.completed` | Verified canonical completion, S4 coordinate contract/C4 | **Task complete.** “The task is recorded as complete.” | Completion's source/merge evidence does not prove deployment/live QA. Show any remaining release dimensions. |
| `work.cancelled` | Recorded assignment disposition `cancelled` | **Cancelled.** “This task was cancelled.” | No implied source deletion or stopped executor without separate evidence. |
| `work.superseded` | Recorded disposition `superseded` | **Replaced by another task.** “This work now continues in {successor}.” | Link verified successor; no completion claim. |
| `work.handoff` | Confirmed handoff receipt, S3/S4 | **Assignment transferred.** “{staff} is now responsible for this task.” | Does not prove delivery to, wake-up of, or acceptance by a native worker. |
| `release.source_saved` | Remote branch/head readback proves the intended change, `source-commit` event S5 | **Changes saved to GitHub.** “The latest changes are on {branch}.” | A local commit, unchanged baseline or metadata checkpoint is insufficient. Deployment remains separate. |
| `release.draft_open` | PR exists with `draft:true`, S1/S2/S3 | **Draft ready.** “A draft pull request is ready to review.” | Do not say checks passed. |
| `release.in_review` | Open non-draft PR | **In review.** “The pull request is open for review.” | Does not prove a reviewer has started. |
| `release.review_requested` | Actual review-request receipt, future adapter | **Review requested.** “A review was requested from {reviewer}.” | Do not derive from `draft:false`; no promise of response. |
| `release.checks_running` | At least one non-completed check | **Checks in progress.** “{completed} of {total} reported checks have finished.” | Denominator is observed checks, not an invented complete required suite. |
| `release.checks_passed` | All required checks positively verified for exact head | **Required checks passed.** “The required checks passed for this version.” | Requires required-set coverage. S5 treating skipped/neutral as non-failure is not enough. |
| `release.observed_checks_complete` | Observed checks complete, required set unknown | **Reported checks finished.** “The recorded checks have finished.” | Show success/skipped/neutral/cancelled separately; no global pass. |
| `release.check_skipped` | Check conclusion `skipped` | **Check skipped.** “{check} did not run.” | Never “passed.” |
| `release.check_neutral` | Check conclusion `neutral` | **Check finished.** “{check} finished without a pass or fail result.” | Preserve neutral code in details. |
| `release.check_cancelled` | Check conclusion `cancelled` | **Check cancelled.** “{check} was cancelled before it finished.” | Never product failure or successful test. |
| `release.checks_unverified` | Empty/unavailable checks | **Checks unconfirmed.** “Relay hasn't confirmed the checks for this version.” | Distinguish “none recorded” from query failure when available. |
| `release.merged` | Actual merged flag/timestamp and merge identity, S5:26–29 | **Merged.** “The changes are merged into {base_branch}.” | A provisional `merge_commit_sha` is insufficient. Preserve pending deployment/live checks. |
| `release.deploy_requested` | Provider accepted request, readback missing | **Deployment requested.** “The deployment request was accepted.” | Do not call the version live. |
| `release.deployed` | Exact version linked to confirmed deployment | **Deployed.** “This version has been deployed to {environment}.” | Environment must be verified. Historical deployment is not proof of current traffic. |
| `release.live_verified` | Proposed exact-version live verification contract | **Live checks passed.** “{scope} passed on the live version at {time}.” | Require observed serving identity + criteria + environment + evidence. Screenshot existence alone is insufficient. |
| `release.live_unverified` | Deployment known, runtime QA absent/blocked | **Live checks still needed.** “The deployment is recorded. Live verification is still unconfirmed.” | Do not erase the deployment milestone or imply failed product QA. |

`tested`, `source_pushed`, `deployed` and `live_verified` are release concepts requested for consistent display; they are not all standalone enums in the inspected `deriveObservedProgress` function. Their adapters need explicit evidence conditions. If an older API lacks the evidence, use the unconfirmed template.

### Existing event names

S5 emits `claim-created`, `assignment-retired`, `runner-heartbeat`, `source-commit`, `pull-request-opened`, `pull-request-updated`, `check-started`, `check-completed`, `cloud-deployment`. Map these to “Task assigned,” “Task cancelled/replaced,” “Worker checked in,” “Commit recorded,” “Pull request opened/updated,” “Check started/finished,” and “Deployment recorded,” respectively. Upgrade “Commit recorded” to “Changes saved to GitHub” only when it proves the intended new work, not merely an existing baseline commit. Expand `check-completed` by its actual conclusion. Event time is the event's time, not the latest API fetch time. A heartbeat is not a milestone toast.

## 6. Freshness, partial information and recovery

| Proposed ID | Existing trigger | Default explanation |
|---|---|---|
| `data.loading` | Initial fetch pending | “Loading the latest updates…” |
| `connection.connected` | Working UI connection only | “Connected.” This does not establish data freshness, completeness or project health. |
| `connection.unavailable` | Failed UI connection | “Can't refresh right now.” Keep last-known data visibly dated. |
| `data.refreshing` | A new fetch is in progress with prior data | “Checking for updates…” Keep prior data visible with its timestamp. |
| `data.updated` | All required sources for this view successfully refreshed | “Updated {time}.” Avoid global “up to date” after a partial callback. |
| `data.partial` | One or more required sources failed / bounded listing incomplete | “Some updates couldn't be loaded. The information shown may be incomplete.” Name affected area when known. |
| `data.showing_previous` | Last successful result retained after refresh failure | “Showing the last update from {time}. Relay couldn't refresh it.” If no timestamp, “Showing previously loaded information.” |
| `data.unknown` | No trustworthy observation | “The current status isn't available yet.” Do not say idle, empty or healthy. |
| `progress.delayed` | C1 freshness `delayed` | “The worker's latest check-in is delayed.” This is about check-in only. |
| `progress.possibly_stale` | S5 `possibly-stale` | “Relay hasn't seen a recent progress update.” Show last meaningful-progress time. |
| `progress.stale` | S5 `officially-stale` | “The progress information is out of date.” Follow with actual recovery action if available. |
| `progress.worker_stale` | Worker freshness stale independently of source progress | “The worker hasn't checked in recently.” Do not assert it crashed or stopped. |
| `recovery.available` | C2 `should_recover:true`, status currently “caught up here” | “This task may need recovery.” Eligibility is not completed recovery. |
| `recovery.limit` | C2 `recovery-loop-limit` | “The automatic recovery limit was reached.” “The task needs a different recovery step.” Only say “Relay is checking…” when it is. |
| `updates.none` | Same checkpoint/cursor, no material changes | No notification. Detail may say “No new updates.” |
| `updates.changed` | C2 amendments | “The task details were updated.” Use safe changed-field labels and actual scope. |
| `updates.history_gap` | `gap:true`, `reconcile_required:true` | “Some task updates are missing from this view. Relay needs to reload the task details before continuing.” |
| `updates.scope_changed` | Scope-changing/blocking amendment | “The task's scope has changed. The current assignment needs checking before work continues.” |

The inspected C1 policy uses 5-minute heartbeat target, 10-minute possibly-stale and 20-minute officially-stale thresholds. These are internal classification inputs, not completion estimates, retry guarantees or universal frontend refresh intervals. Read current policy in implementation rather than duplicating constants in copy.

Errors swallowed to empty lists in older observation code are a source-contract limitation. A formatter cannot tell “no checks exist” from “the checks request failed” if both are `[]`. Add coverage/source-status facts at the read boundary; until then display unconfirmed, not “No checks” or “Everything is clear.”

## 7. Error and blocker catalog

### Shared classes

| Proposed ID | Existing code/condition | Human explanation | Action rule |
|---|---|---|---|
| `error.validation` | `validation`; S1/S4 | “Relay couldn't use this request because {safe_field_reason}.” | Correct the request; no identical retry. Agent-generated schema errors belong to Relay to fix. |
| `error.auth` | `auth`, HTTP 401, `invalid_token`; S1/S2/S4 | “Relay couldn't verify this connection.” | “Sign in to {service} to continue” only when sign-in is the supported next step. Missing server configuration goes to maintainer, not user reconnect. |
| `error.connection_missing` | Missing configured source/cloud binding, C4 | “Relay's {service} connection isn't set up for this action.” | Technical binding names in details; no request to paste a token. |
| `error.permission` | `permission`, confirmed 403 denial | “This connection doesn't have permission to {action}.” | Respect denial. Explain correct owner/permission action if known; no alternate identity suggestion. |
| `error.not_found` | `not_found`, lookup 404 | “Relay couldn't find {item} with this connection.” | Check item/identifier. Never infer deletion or expose existence to unauthorized users. |
| `error.conflict` | `conflict`, revision/head changed | “{item} changed before this request finished.” | “Check the latest version before trying again.” Only say “Nothing changed” with prewrite evidence. |
| `error.capacity` | `capacity`, transient capacity limit | “{service} can't handle this request right now.” | Retry only under the service policy; no guessed timer. |
| `error.rate_limit` | `rate_limit`, quota metadata, S1/S4 | “GitHub is limiting requests on this connection. This step is paused.” | Do not loop, refresh tools to reset quota, or conflate with authentication. |
| `error.rate_limit_timed` | Valid provider `retry_at`/reset/not-before evidence | Above, plus “GitHub says requests can resume after {time}.” | This is eligibility, not a scheduled retry. Preserve timezone and observation time. |
| `error.rate_limit_unknown` | No valid reset evidence | Above, plus “GitHub hasn't provided a retry time.” | Never manufacture one. A “Check status” control must respect the same window. |
| `error.timeout_read` | Read-only `timeout` | “{service} didn't respond in time, so Relay couldn't check {item}.” | A bounded safe read can be retried. |
| `error.uncertain_write` | `uncertain_write`, mutation timeout or unverified readback | “Relay couldn't confirm whether {change} was saved.” | “Check its status before trying again.” No blind duplicate operation. |
| `error.provider_read` | `provider`, read-only failure | “Relay couldn't load {item} from {service}.” | Keep prior data and mark freshness; safe next step depends on health. |
| `error.provider_write` | `provider`, command may have started | “Relay couldn't confirm the result of this change.” | Same check-first behavior as uncertain write unless outcome is proven. |
| `error.request_too_large` | S8 HTTP 413 before dispatch | “This request is too large for Relay. Send a smaller batch.” | Here “No source changes were attempted” is evidence-backed. Display actual 8 MiB limit in details. |
| `error.request_unreadable` | S8 invalid UTF-8/body rejection before dispatch | “Relay couldn't read this request. It needs valid UTF-8 JSON.” | Developer-facing detail; no source write attempted is supported here. |
| `error.unsupported` | Unknown tool/method/route | “This version of Relay doesn't support that action.” | Refresh supported actions/version. Preserve JSON-RPC `-32601`/`-32602` and HTTP status. |
| `error.unknown_read` | Unrecognized query error | “Relay couldn't load the latest information. You can check again.” | Only expose check-again action if a read is safe and no quota/security guard prevents it. |
| `error.unknown_write` | Unrecognized command outcome | “Relay couldn't confirm the result. Check the latest status before trying again.” | Durable reference ID/details; do not claim failure-before-write. |

An unknown result with no known operation kind uses `error.unknown_write`'s conservative wording. Unknown successful-looking responses use “Relay returned an update, but its status isn't recognized yet,” with safe details and no success badge. Do not infer success solely from HTTP 200: S6 capacity results can be `ok:false` without `isError:true`.

### Specific operational blockers

| Proposed ID | Source condition | Human explanation |
|---|---|---|
| `guard.owner_conflict` | C4 another owner / overlap | “Another worker is responsible for this work. Relay needs to coordinate with that assignment before making changes.” |
| `guard.capacity` | C4 active branch budget | “The current work limit has been reached. Existing work needs to finish or be reviewed before another task starts.” |
| `guard.head_changed` | C4 expected branch/head mismatch | “The source version changed. Check the latest changes before saving.” |
| `guard.default_branch` | Direct default-branch write rejected | “Relay can't save this change directly to {branch}. It needs the project's review workflow.” |
| `guard.scope_changed` | C3/C4 admitted path or objective mismatch | “The allowed scope for this task changed. The assignment needs checking before work continues.” |
| `guard.completion_missing` | Completion lacks verified merged PR/evidence | “Relay can't mark this task complete yet. The required completion evidence is missing.” |
| `guard.identity_changed_after_write` | C4 `identity_changed_after_write`, retained receipt | “The change was recorded, but the assignment changed before Relay could confirm the final state.” Check status. |
| `guard.identity_recheck_unavailable` | C4 `identity_recheck_unavailable` | “The change was recorded, but Relay couldn't finish checking its task details.” No replay. |
| `verify.browser_capacity` | S6 `status:deferred`, `reason:browser_capacity` | “The browser service is busy, so this check hasn't run yet.” |
| `verify.alternative_available` | S6 fallback advertised and revalidated for requested capability | “Another supported way to run this check is available.” | 
| `verify.harness_blocked` | Check could not exercise criterion | “This check couldn't run, so the result is still unknown.” |
| `verify.environment_blocked` | Required environment unavailable | “The environment needed for this check isn't available.” |
| `verify.product_failed` | Exact-identity evidence proves criterion failure | “{criterion} failed on the version checked.” Link evidence. |
| `verify.not_run` | Explicit no attempt | “This check hasn't run yet.” |

Do not display S6's `fallback_available:true` as a promise that the alternative already ran, is authorized, or meets an interactive request. The normalizer advertises a generic alternative; the evidence planner and current task requirements must confirm suitability. A screenshot or recorded browser action is evidence captured, not automatically a passed test.

## 8. File and transfer catalog

### Existing inspected behavior

P170 distinguishes two transports: temporary MCP transfers (up to 32 MiB, default expiry 24 hours, selectable 1–72 hours) and browser file uploads (up to 512 MiB, fixed 72-hour expiry in this source). UI copy must use returned `max_bytes` and actual `expires_at` rather than one hardcoded rule for both. Files belong to the same authenticated account; sender/recipient labels are routing labels, not cross-account sharing permissions. Transfer IDs are not public download links. [S7]

| Proposed ID | Existing fact / error | Human copy and guard |
|---|---|---|
| `file.empty` | Successful complete file listing has zero results | “No files here yet.” Do not show after a failed/incomplete fetch. |
| `file.preparing` | Local checksum preparation underway | “Preparing {filename}…” |
| `file.uploading` | Manifest exists, state `uploading` | “Uploading {filename}…” Use bytes/chunks actually confirmed; local preparation is not uploaded progress. |
| `file.upload_paused` | Upload stopped with confirmed retained manifest/chunks | “The upload stopped before it finished. You can resume the saved parts until {expiry}.” Only if identity, retained state and expiry are verified. |
| `file.upload_unknown` | Request failed with no saved-state evidence | “The upload didn't finish. Check its status before starting again.” No promise that parts were retained. |
| `file.verifying` | Complete request verifying bytes/hash | “Checking the uploaded file…” Never “uploaded successfully” yet. |
| `file.ready` | Complete-file checksum verified, ready marker | “{filename} is ready.” Optional “Available until {expiry}.” Not a permanent backup claim. |
| `file.resumed` | `resumed:true` and saved upload state | “Resuming {filename} from its saved upload.” |
| `file.download_started` | Browser request initiated | “Download started.” Do not say saved to the user's device. |
| `file.received` | Same-account receipt after client whole-file verification | “The receiving worker confirmed {filename}.” Preserve that this is an authenticated receipt, not independent observation of use. |
| `file.expired` | Explicit `Transfer expired` or known deadline elapsed | “This temporary file has expired. Upload it again if you still need it.” Don't promise recovery or claim every byte already physically deleted. |
| `file.unavailable` | Combined `File not found or expired` | “This file isn't available with this connection. It may have expired.” Do not force a definitive expiry diagnosis. |
| `file.not_ready` | `File/Transfer is not ready` | “This file is still incomplete. Finish the upload before downloading it.” |
| `file.checksum_failed` | `Chunk checksum mismatch` / `Whole-file checksum mismatch` | “Relay couldn't verify that the uploaded file matches the original.” Keep incomplete; only retry parts through supported verified recovery. |
| `file.part_missing` | Missing chunk / stored size mismatch | “Part of the uploaded file is missing or incomplete.” “The upload needs to be checked before the file can be used.” |
| `file.size_invalid` | Zero/oversized file | “Choose a file between 1 byte and {max_size}.” `max_size` from correct transport. |
| `file.name_invalid` | Invalid filename/path separator/control character | “Use a file name without slashes or control characters.” Length limit shown inline when exceeded. |
| `file.request_conflict` | Request ID reused for different file / immutable object mismatch | “This upload request already belongs to a different file.” Preserve original; no silent replacement. |
| `file.storage_unavailable` | Missing temporary/file storage | “Relay's file storage isn't available right now.” No sign-in diagnosis or retention promise. |
| `file.response_unreadable` | UI JSON parse failure | “Relay couldn't read the file service's response.” Sign-in copy requires actual authentication evidence. |
| `file.request_rejected` | Same-origin/explicit-request guard | “Relay couldn't accept this file request from this page.” Direct to supported file page; do not tell users to disable browser protections. |
| `file.reference_copied` | Successful clipboard write of transfer reference | “File reference copied.” Not “Download link copied.” Clipboard failure: “The file reference couldn't be copied.” |
| `file.expiry_notice` | Verified `expires_at` | “Available until {localized_date_time}.” Preserve exact absolute time in details. |

U4's generic parse-error sign-in message and blanket “Uploaded chunks are kept until expiry” should be replaced by the guarded alternatives above. Frontend persistence in local storage is not proof that remote file bytes exist.

### Proposed rename/delete/undo integration

These are **new contract requirements for the active Files owner to adopt or reconcile**, not endpoints present in the inspected backend. Labels below must reflect the actual chosen semantics.

| Proposed ID | Required server fact | Copy |
|---|---|---|
| `file.rename_pending` | Rename accepted but not read back | “Renaming {old_name}…” |
| `file.renamed` | Exact file ID/revision read back with new display name | “Renamed to {new_name}.” |
| `file.rename_conflict` | Revision changed or operation conflict | “This file changed before the rename finished. Check its current name.” |
| `file.rename_unknown` | Response/readback missing | “Relay couldn't confirm the new name. Check the file before renaming it again.” |
| `file.delete_confirm_recoverable` | Server advertises soft-delete plus real restore window | “Delete {filename}? You can restore it until {deadline}.” Prefer “Move to Trash” only if there is an actual Trash feature. |
| `file.delete_confirm_permanent` | Permanent-delete capability, action-time approval required | “Permanently delete {filename}? Relay won't be able to restore this file.” Only after retention semantics verified. |
| `file.deleted_recoverable` | Soft-delete readback with restore capability | “{filename} was deleted.” Button “Undo” or “Restore file” while valid. |
| `file.deleted_permanent` | Confirmed irreversible deletion | “{filename} was permanently deleted.” No Undo. |
| `file.delete_unknown` | Unknown operation outcome | “Relay couldn't confirm whether the file was deleted. Check its status before trying again.” |
| `file.restored` | Restore readback succeeded | “{filename} was restored.” |
| `file.restore_expired` | Explicit deadline expiry | “The restore window has ended. Relay can't restore this file.” This is about Relay's recovery, not all copies everywhere. |
| `file.restore_conflict` | Name/revision collision | “Relay couldn't restore this file because {safe_specific_reason}.” Offer available non-destructive choice. |
| `file.restore_unknown` | Restore receipt uncertain | “Relay couldn't confirm whether the file was restored. Check its status before trying again.” |

Proposed mutation receipts need stable file identity, operation ID, expected/current revision, mutation outcome, observed display name, deletion mode, restore capability, restore deadline and verified readback. Sensitive restore tokens must not appear in human prose or copyable diagnostics. Absence of an Undo button is not evidence that deletion is permanent. Do not ship “Undo” as a cosmetic toast action without actual backend restoration. Pending optimistic UI must roll back from authoritative state on rejection; unknown outcomes stay visibly unconfirmed instead of pretending the inverse operation succeeded.

## 9. Execution, checkpoints and Night Shift

These templates preserve the unusually important attribution boundaries in C3.

| Proposed ID | Existing state/fact | Copy |
|---|---|---|
| `execution.queued` | Job `queued` | “The execution request is queued.” No running-process claim. |
| `execution.leased` | `leased` | “A worker has reserved this request.” No start claim. |
| `execution.running_reported` | `running`, authenticated start receipt | “The worker reported that execution started.” Exact process identity in details. |
| `execution.checkpoint` | Checkpoint receipt | “A progress checkpoint was recorded.” Distinguish metadata from saved source below. |
| `execution.succeeded_reported` | `succeeded`, valid exit receipt | “The worker reported a successful run.” Follow with objective/release status separately. `objective_completed:false` remains meaningful. |
| `execution.failed_reported` | `failed` exit receipt | “The worker reported that the run failed.” Include safe failure summary. |
| `execution.cancel_requested` | `cancel_requested` | “A stop was requested. The worker hasn't confirmed it has stopped yet.” |
| `execution.cancelled_reported` | Final cancelled exit receipt | “The worker confirmed that the run stopped.” Do not infer uncommitted work was saved. |
| `execution.recovery_required` | Lease expiry yields `observed_state:recovery_required` | “This execution needs recovery before it can continue.” Old process must be confirmed stopped before recovery. |
| `checkpoint.local_only` | Source proof `local_only` | “Relay hasn't verified a remote copy of the latest source files.” No data-loss claim. |
| `checkpoint.remote_verified` | Private object bytes read back and validated | “The selected source files were saved and checked in Relay storage.” Bounded scope, not all local work. |
| `checkpoint.restore_verified` | Authenticated restoration receipt plus digest match | “The worker reported restoring the saved source files, and the recorded checksums match.” `host_execution_verified:false` stays in details. |
| `checkpoint.previous_available` | Current metadata-only checkpoint + `last_verified_source` | “An earlier verified source copy is available. The latest changes aren't confirmed in that copy.” |
| `nightshift.oversight_bound` | `available:true`, `worker_online_verified:false` | “Oversight is assigned.” Do not say the worker is online. |
| `nightshift.shift_requested` | Shift receipt with `executor_started:false`, `recipient_acknowledged:false` | “The follow-up execution request was saved.” No delivery/started claim. |
| `nightshift.outcome_unknown` | Prepared operation / uncertain shift outcome | “Relay couldn't confirm the follow-up request's final state.” Inspect exact operation before resubmitting. |
| `feedback.saved` | Durable exact-artifact feedback receipt | “Your feedback was saved for this task.” No “The worker has read it” or “I've sent it” unless there is real delivery evidence. |
| `feedback.identity_unverified` | Feedback saved with unverified source/runtime binding | “Your feedback was saved, but Relay hasn't confirmed which running version it refers to.” |

### Review and feedback delivery

UI839 `apps/web/public/qa-delivery.js:5–13` already distinguishes delivery stages. Preserve them; improve the labels without merging their meanings. UI839 `qa.js` has save failures and feedback-routing failures that need separate presentation events.

| Proposed ID | Required fact | Copy |
|---|---|---|
| `review.save_unconfirmed` | Save receipt missing | “Relay couldn't confirm that your review was saved.” Add “Your responses are still here” only when the local form/recovery state actually retains them. |
| `review.saved_route_unconfirmed` | Notes saved; feedback routing unconfirmed | “Your notes were saved. Relay couldn't confirm that the feedback was queued for this task.” |
| `feedback.queued` | Feedback queue receipt | “Your feedback is queued for the worker.” Does not mean seen. |
| `feedback.seen` | Worker acknowledgment | “The worker has seen your feedback.” Does not mean incorporated. |
| `feedback.incorporated` | Explicit incorporation receipt | “The worker reported incorporating your feedback.” |
| `feedback.fix_reported` | Fix reported without independent verification | “The worker reported a fix. It still needs to be checked.” |
| `feedback.fix_verified` | Exact-version evidence verifies the reported fix | “The fix was verified on {version_label}.” Name the criterion when useful. |
| `review.marked_complete` | Review metadata update confirmed | “Review marked complete.” Does not finish the task. |
| `review.marked_stale` | Review marked stale | “Review marked out of date.” Does not prove the current product failed. |
| `review.archived` | Review archive confirmed | “Review archived.” For bulk actions, show exact scope and confirmed count. |
| `review.partial_update` | Per-item applied/rejected results | “{saved_count} reviews were updated. {not_updated_count} were not updated.” Use “unconfirmed” instead of “not updated” when the outcome is unknown. |

Review commands should read “Mark review complete,” “Mark out of date,” “Reopen review,” “Archive completed reviews,” “Archive out-of-date reviews” and “Restore to review list.” Existing “Clear complete” / “Clear stale” actions archive items in U2; do not relabel them as clearing the underlying state. Preserve scope, loaded-item limits, confirmation and any real undo behavior.

## 10. Surface integration plan

1. **Normalize at producer boundaries.** S1/S2/S4/S6/S7/S8 feed one presentation adapter. Add typed error codes where currently only throw strings exist. Operation kind comes from tool registration plus action/method, not a regex on the tool name: `relay_execution`, `relay_night_shift` and `relay_ui_request` can mix reads and writes.
2. **Current context card.** Replace S3's technical-word heuristics, raw error fallback and broad success/terminal inference. Preserve class, time, operation and coverage through `compactContextCardResult`. Keep a valid next step after merge. Share the same catalog/model with bundled browser code; test actual generated resources, not only the server function.
3. **Shared web presentation.** Replace U1's keyword rewriting with typed formatting. Migrate U2/U3/U5 consumers, including drawer detail/next/source, Today attention rows, telemetry attention and automatic-check notifications. Raw task goals, names or user-authored feedback are content, not message templates: display them safely and separately rather than pretending a finite catalog can rewrite arbitrary prose.
4. **Execution UI.** U5 `ExecutionPanel.tsx:30` appends a saved-request exact-retry promise to every error. Gate that text on an actually persisted request intent and operation identity. A failed load or pre-submit failure must not receive it. Respect unknown-write readback before reusing a request.
5. **Review controls.** U2 `work-viewer.js` “Mark complete” changes review metadata, not the task lifecycle. Rename it to “Mark review complete,” with “Review marked complete” on a confirmed receipt. Task completion has its own evidence gate.
6. **Files.** Use §8 for pre-manifest, partial upload, remote verification, expiry and clipboard states. Reconcile new mutation contracts with the active Files implementation rather than editing its backend in parallel.
7. **Notifications.** Announce material changes once per subject + event identity + outcome. Do not notify every heartbeat/refresh. Queue and progress notices should be quiet; a failed user action must remain visible until resolved/dismissed. Do not overwrite a specific error with a generic healthy signal from another subsystem.
8. **Transport/auth.** Keep OAuth and JSON-RPC bodies/headers machine-correct. Map authentication errors only in supported human adapters. Unauthenticated error messages must not leak private names, ownership or item existence.

Additional UI839 corrections to include in the surface migration:

- `App.tsx:71` prints the raw connection enum; use connection-specific labels. “Schedule enabled” describes a setting, not a promise that work ran or will run successfully.
- `TodayPage.tsx:32,65` groups blocked/failed/stale as “needs you,” while telemetry uses a narrower human-wait predicate. Separate “Needs attention” from “Needs your input.” With bounded data, say “No requests for your input in the loaded activity,” not “You're clear.”
- `notifications.js:54,60` calls all resolved notifications “Recovered.” Use “Resolved” for a problem, “Updated” for information, or the actual outcome. Keep “No notifications in this tab yet” bounded to that tab.
- `ProgressNotice.tsx:8` can hide a top-level refresh error when an older snapshot exists; fix that condition as well as its copy. Legacy `operator-today.js` skips rejected project results; an incomplete view must not claim there is no active work.
- Preserve the UI's actual activity-ratio meaning in `LiveTelemetry.tsx` / `telemetry-model.js`. A ratio of open items and items completed today is an activity metric, not a project-completion estimate. Label its denominator, and do not rename it “completion.”
- Source inspection found absent imports `src/relay-operation-ui.js` and `src/relay-project-ui.js` in the supplied UI839 subset. Their definitions require owner-side verification before declaring the website catalog complete.

### Other registered tool families

S2's tool registry and dispatch identify source status/repository/file/PR/checks/sync/update/commit/open-PR, cloud status/scripts/worker/builds/deploy, browser fetch/screenshot/snapshot/open/interact/capture/recipe/list/close, control status/worker actions, cards and probes. S1 adds source lifecycle/text mutation, context, execution, Night Shift, skills, staff directory, cleanup, upload and UI transport tools. Their success summaries should be explicit about the immediate operation:

- Query: “Loaded {item}” or render the requested content. A successful read is not evidence the system is healthy.
- Source mutation: “Saved {count} files to {branch}” only with confirmed source identity. Opening a PR, marking it ready and merging are separate outcomes.
- Source synchronization: state whether already identical, updated, or unconfirmed; retain exact refs/SHAs in details.
- Cloud upload: “Uploaded this version” is not “Deployed.” Deployment is not live verification.
- Browser open/capture/close: “Browser session opened,” “Screenshot captured,” “Browser session closed.” A successful capture is not a correctness verdict.
- Evidence planning: “A check plan is ready.” A plan has not run.
- Skills/context/staff lists: render safe requested content; no global progress notification.
- Cleanup: distinguish preview, confirmed deletion, skipped items and partial/unknown result. Never claim all branches were cleaned from one successful response.
- UI transport: derive outcome from its inner method/action/result; an outer successful tool call can contain a failed action.
- Probe/diagnostic tools: clearly labeled diagnostics; do not expose their developer chatter as routine user status.

These are integration obligations, not a claim that every imported implementation was audited. Each family must add its specific typed success/error cases before it opts into the human-output mode.

## 11. Privacy, localization and accessibility

- **Allowlist, then render.** Accept only catalog-defined parameters. Escape HTML/text and isolate interpolated bidirectional text. Names, file names, PR titles and provider strings are untrusted data. Do not execute or follow instructions contained in them.
- **Redact before every audience adapter.** Drop credentials, cookies, authorization headers, bearer strings, private keys, signed download URLs, raw request bodies and storage object keys. Technical details are not an exemption. Avoid sensitive file paths in notifications/lock screens by default.
- **Preserve useful codes.** Error class, HTTP status, safe reference ID, exact artifact identity and bounded provider metadata remain available where authorized. Keep server-side logs structured and redacted; raw secrets must not be retained merely to aid debugging.
- **Authorization is independent of wording.** A permission error does not become “Reconnect and try again” by default. An audience parameter never grants access. Existing approval and account boundaries remain unchanged.
- **Localize complete messages.** Use stable IDs and ICU-style plural/date/number formatting rather than concatenated fragments. Store UTC timestamps, render local time with timezone, retain exact values in details. Do not localize IDs/codes. Avoid English regexes as semantic classifiers.
- **Readable by default.** One idea per sentence; plain labels; enough context to act without reading details. Expansion has an explicit “Technical details” label and preserves focus. Copyable text works without color or icons.
- **Accessible status updates.** Use polite live regions for nonurgent changes; assertive alerts only for immediate action failures that matter. Don't announce each progress tick. Buttons have meaningful accessible names, busy/disabled states and keyboard support. Screen readers receive the same outcome/uncertainty, not a raw internal code. Respect reduced motion.
- **No information loss by truncation.** Clamp decorative titles if necessary. Never clamp the only explanation of an unknown write, permanent deletion, restore expiry, authentication action or safety boundary.

## 12. Tests and rollout gates

### Required tests

1. **Catalog completeness:** every registered event/error/action code maps to a message or an explicit internal-only exemption. Parameter schemas are checked. Missing translation falls back to a safe default locale; missing semantic case falls back to unknown, never raw JSON or success.
2. **Source-to-adapter coverage:** fixtures for all S1 classes, S4 upstream metadata, S6 deferred browser capacity, S7 file errors/states, S8 prewrite rejections, S5 state/event variants and every opted-in tool family. Inventory dynamic errors and throw sites separately from literal display strings.
3. **Semantic invariants:** queued ≠ running; heartbeat ≠ progress; process success ≠ objective complete; remote checkpoint ≠ all source saved; restore receipt ≠ independently verified execution; PR open ≠ merged; tests ≠ deployment; deployment ≠ live verification; review complete ≠ task complete; receipt saved ≠ worker received/read it.
4. **Error precedence:** `ok:false` inside HTTP 200, simultaneous failed checks and stale data, partial source refresh with a healthy connection, merged PR with remaining release checks, unknown enum, malformed `human` object.
5. **Quota timing:** valid/missing/invalid/stale reset values, timezone changes, provider-not-before vs scheduled retry, quota error with request not attempted, mutation outcome unknown. No immediate retry button during a known quota block.
6. **Mutation safety:** prewrite rejection vs applied vs unknown; retries cannot duplicate side effects; operation ID reused with different intent; revision races; interruption after write and before readback. Human copy never invents “nothing changed.”
7. **Files:** failure before manifest creation, retained chunks, identity mismatch, 32 MiB vs 512 MiB transport limits, empty file, Unicode names, checksum failure, expiry mid-upload/download, parse error without auth evidence, clipboard failure. Add rename/delete/restore race and deadline tests when those contracts exist.
8. **Compatibility:** legacy MCP text remains parseable where required; `structuredContent`, `isError`, HTTP status, JSON-RPC codes and auth headers remain unchanged; legacy clients survive additive fields. Versioned human mode tested separately.
9. **Presentation parity:** same input across server/card/browser/web yields equivalent outcome, next action and severity. Test shipped bundled HTML resource and both maintained legacy/current card paths. Avoid hand-copied formatter logic.
10. **Privacy and hostile inputs:** tokens, cookies, signed URLs, HTML/script, bidi control characters, prompt-injection text and oversized provider errors do not leak or execute in any default/detail/copy/log path.
11. **Accessibility/localization:** keyboard/focus, live-region deduplication, long translated strings, plurals, zero/one/many, RTL, absolute dates and tiny screens. Preserve important qualifiers in toast/detail transitions.
12. **Freshness:** a successful partial callback does not label the whole view current; stale read does not erase the last verified milestone; incomplete pagination cannot produce an authoritative empty state.

### Rollout

1. Rebase this surface inventory against the active owner's exact commit, especially Files and current shared UI. Record which differences are resolved before implementation.
2. Add the catalog/normalizer and additive `human_v1` behind a presentation flag; preserve existing structured contracts and control behavior.
3. Run shadow formatting against recorded fixtures and current responses without extra provider requests. Log only unknown code + safe shape/version, not raw payloads.
4. Enable the first-party website/card/error surfaces, then opted-in MCP explanatory text. Maintain a clear legacy-mode fallback.
5. Verify exact-build UI behavior and machine-consumer compatibility. Only then expand coverage to remaining tool families.
6. Roll back by switching presentation mode to the prior renderer. No state/data migration should be needed; catalog versions remain traceable. Never roll back permission or mutation guards with copy.

### Definition of done

- The active release's human-facing surfaces use typed catalog messages and safe content slots.
- No default human surface shows raw exceptions, JSON envelopes, storage keys or unexplained internal states.
- Every outcome retains its exact machine semantics, evidence identity, uncertainty and safe next action.
- All changed surfaces and registered codes have manifest coverage and tests; known exclusions are explicit.
- File recovery/destruction wording matches implemented backend semantics.
- The release is verified on its exact deployed version before it is described as live.

### Honest completeness promise

A finite catalog can cover the known output classes and predictable workflows very well. It cannot prewrite every future provider error, new feature or user-authored message. The durable promise is a closed, tested catalog for known cases, a conservative useful fallback for unknown cases, and enforcement that every new human-facing output declares its message contract before release.

## Owner handoff: bounded implementation sequence

Continue in the existing Relay implementation stream. This specification does not create a second backend owner or authorize parallel edits to the active Files work.

1. **Start with the presentation boundary.** Compare S1–S9 with the owner's exact head. Add the typed input/output contract and a shared formatter with fixtures for quota, unknown write, partial refresh, merge-with-pending-verification and file upload failure before a manifest exists. Deliver an additive `human_v1`; leave existing machine payloads and control behavior intact.
2. **Remove the most misleading defaults first.** Replace the context card's technical-word/chat-connection substitution, raw error output, merged-is-terminal rule, and loss of error class during compaction. Migrate the existing website presentation helper and obvious bypasses. Verify the actual generated card resources match server behavior.
3. **Integrate Files when its contract is settled.** Map actual rename/delete/restore operation receipts to §8. If deletion or undo is not implemented, leave those controls and messages unavailable. Do not infer retention semantics from UI intentions.
4. **Complete the surface manifest and compatibility pass.** Cover notifications, accessible labels, empty states, execution and review outcomes. Register remaining imported tool families or keep explicit migration exclusions. Test legacy JSON text consumers before changing MCP `content` serialization.
5. **Release behind the presentation flag.** Verify the exact build across the website, card and an opted-in MCP consumer. Check at least one real failure and one uncertain/partial case, not only a happy-path screenshot. Roll back the renderer if necessary without touching task/file data.

The first reviewable slice should include the normalizer/catalog, the card and common-error adapters, semantic fixtures and a clear legacy compatibility test. The complete change is ready only when the definition-of-done conditions above are met. No new provider calls are needed just to translate an already available result.

## Appendix: proposed coverage manifest

Add a repository-owned manifest such as `contracts/human-output-surfaces.json` during implementation. This is a proposed file, not an existing one. One entry per producer/consumer includes: source path and symbol, audience, surface, registered event/error families, formatter adapter, catalog version, test fixture IDs, current owner, exact reviewed commit, status (`covered`, `internal-only`, `migration-pending`), and reason for any exemption.

Initial coverage boundaries for this report:

| Area | Inspection status | Implementation requirement |
|---|---|---|
| Current pinned MCP result/error/auth wrappers | Inspected P170 | Normalize every exit path; preserve protocol |
| Current pinned context card models and refresh/error paths | Inspected P170 | Remove semantic regex replacements; preserve details/freshness |
| Current pinned progress state derivation | Inspected P170 | Keep stage/evidence distinctions |
| Current pinned file transport/backend | Inspected P170 | Map current errors; reconcile active new features |
| Current pinned browser-capacity and request-body errors | Inspected P170 | Typed deferred/prewrite messages |
| Web/shared UI | Inspected older UI839 | Diff against active head before claiming current coverage |
| Execution/checkpoint/coordination/recovery/feedback | Inspected CP candidate | Recheck exact active source and preserve attribution |
| Every imported browser/provider/skills/context/cleanup implementation | Registered output boundaries identified; internals not exhaustively inspected | Add per-family adapters/fixtures before opting in |
| Current production build and current main after P170 | Not inspected | Exact-version deployment verification required |
| Rename/delete/undo backend under active development | Not present in inspected P170 backend | Proposed contracts only; integrate with its owner |

No repository-wide or “all future output” completeness claim should be made from this audit. The manifest and CI enforcement turn this bounded starting catalog into a maintainable product rule.
