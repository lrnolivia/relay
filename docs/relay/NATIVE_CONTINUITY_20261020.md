# Native task continuity and activation

Canonical authority remains [the Bible](../../LOEW_CHAT_BIBLE.md), especially sections6.1–6.3. This is the operational adapter guide for the existing interactive Codex task. No standalone token, Codex CLI, new credential or native Claude integration is required or inferred. A coordinator may invoke an explicitly authorized bounded specialist through its existing native subagent tool; the adapter itself cannot launch one.

## Supported current workflow

The current native coordinator records its complete authorized acceptance plan and real task-specific verifiers in a private config outside source. Use the same `continuity` contract described in [execution continuity](EXECUTION_CONTINUITY_20261020.md) and [goal-preserving expansion](GOAL_PRESERVING_EXPANSION_20261020.md). Bind the exact project, assignment, owner and branch. Set `provider: "codex"`. Keep the original goal and full acceptance digest; do not replace them with an easier task. A verifier is an actual inspection command for that acceptance, never a generic `true` command. Native expansion uses named trusted verifier profiles, but its semantic review comes from this current coordinator rather than a separately configured reviewer process.

Start the local adapter in the admitted checkout:

```sh
node scripts/relay-native-continuity.mjs run /absolute/config.json /absolute/checkout /absolute/private-receipts
```

The existing native task services requests under `private-receipts/native-channel` while the process waits. This adapter is not an unattended agent or daemon: the current task owns tool calls, semantic decisions, implementation, verification and progress. It never launches another model itself. The native coordinator services specialist execution packets with its existing authorized subagent capability; missing capability is a blocker, not a named-persona substitute. Native host interruption retains the original request and stage journal for reconciliation. Ordinary single-job execution remains a process receipt; loading this guide does not silently convert every unrelated or held assignment into active work.

Inspect the next packet with:

```sh
node scripts/relay-native-continuity.mjs pending /absolute/private-receipts/native-channel
```

Service only the exact bound request through existing native tools:

| Packet | Current native task action |
|---|---|
| `snapshot` | In parallel call `relay_autonomy(status, global)`, `relay_autonomy(status, project)` and `relay_runner_assignments(project, assignment)`. Reply with their actual structured results as `{global, project, assignments}`. Every control gate gets a new snapshot. |
| `rpc` | Call the named existing native Relay tool with the exact arguments. The adapter only permits bound assignment/status reads and additive acceptance/scope amendments. It cannot request a hold/resume, source mutation, publication, credential change or arbitrary tool. For an amendment, persist `begin CHANNEL ID` before the tool call. An already-started mutation with no reply must be read back/reconciled, never called again automatically. Reply with the actual structured result, including any rejection; never substitute success. |
| `review` | The current coordinator checks the proposal against the original goal, criteria, authority, paths and trusted profile. Return the structured goal-preservation verdict described by the expansion contract. A worker proposal cannot carry its own review, command, permission grant or successful verification. An unavailable or inconclusive review remains open. |
| `execute` | Refresh actual global/project controls and canonical assignment immediately before work. Match the packet's owner, branch, control revisions and canonical record revision, and verify the lease. Stop on any mismatch. Persist `begin CHANNEL ID` once **before** starting work. When `data.specialist` is present, launch one actual bounded subagent with the supplied role, stage prompt, admitted paths and worker restrictions; attach the returned identity using `delegate` below. Wait for that exact agent result, then reply with `{state, summary, head_sha, agent_id}` and optional bounded `continuity_additions`. For a team-only non-specialist packet, perform the authorized stage with native tools and omit `agent_id`. Do not invent a PID, broker process, chat delivery or whole-objective completion. |

Write each response to a private local JSON file, then publish it with:

```sh
node scripts/relay-native-continuity.mjs reply /absolute/channel REQUEST_ID /absolute/private-response.json
```

Work starts use `node scripts/relay-native-continuity.mjs begin /absolute/channel REQUEST_ID`. Work and mutation requests already marked `started` must be reconciled against actual work/canonical readback and receipts; never execute it again merely because its reply is missing. Replies are immutable, bound to the exact request digest and published atomically. A source report must match actual checkout HEAD; source changes outside admitted scope preserve the original pending intent for reconciliation. An active unreconciled broker job blocks native stage execution. Canonical ownership comes from `relay_runner_assignments`; the resume presentation projection does not contain authoritative branch/state/lease fields.

The channel is private, outside source, size-bounded to1MiB per packet and512 cumulative requests, with a bounded host wait. No bearer token or credential is placed in packets. Remove no lock automatically after a crash; establish that the old process stopped and reconcile its original intent. A later user/security/global stop always wins.

## Actual non-production acceptance proof

The current native task ran assignment `relay-native-continuity-20261020` on branch `relay/native-continuity-20261020`. `scripts/relay-native-proof.mjs config ASSIGNMENT_JSON` prepared an explicitly authorized **subobjective** with concrete verifier profiles and no reviewer subprocess. This is a bounded fixture, not a fabricated production feature or unattended run.

Actual native Relay tool calls supplied controls, canonical assignments and the additive amendment. The current native task performed the three real work stages:

1. A created `a.json` with integer seed7; its configured verifier inspected the file.
2. A reported a supporting validation proposal. The native coordinator reviewed its direct relationship to the goal. Relay atomically admitted the supporting acceptance and read it back before execution. The added stage read A, validated the seed and wrote the doubled value14; its verifier rejects malformed seeds or inconsistent output.
3. B depended on both A and the added stage, read their actual outputs and wrote sum21; its verifier checked that relationship.

The first live run exposed partial JSON visibility during response publication. Atomic publication fixed it; journal recovery retained the real A result and canonical admission without rerunning either. All three stages then passed. A second run retained exactly three cumulative work-start receipts: **zero additional work executions**. The persisted result was `acceptance_completed:true`, `subobjective_completed:true`, **`objective_completed:false`**. The full implementation/release assignment remained open until its own required checks and publication were accounted for. Raw private channel packets and fixture outputs stay in the allocated task artifacts, not source. The fixture generator/verifiers and regression tests remain source.

## Feature readiness and limits

| Remediation | Operational readiness and proof |
|---|---|
| Original coordinator-owned continuation and repair | Previously only optional CLI/library support, with an actual resume-projection mismatch; it was not activated in the inspected native path. The corrected canonical query and native adapter now demonstrate real A→supporting work→B, recovery and checkpoint reuse through existing connected tools. Full objectives still require their complete real acceptance plan. |
| Retryable operation waits and candidate quarantine | Implemented in the deployed server control/publication paths, with revision/stop and late-candidate regressions. Existing healthy production and unrelated work remain separate from a failed candidate. Native activation adds no automatic resume authority. |
| Local Night Shift block isolation | The bounded pass implementation is released and regression-tested for independent work, global stops and uncertain launches. This is not evidence that an unattended away-time pass is running. A real authorized away window, existing hosts and live oversight are still required; this fixture starts none. |
| Promotion blockers versus repair | Current Bible, blocker/promotion/authoring guidance and worker packs preserve authorized repair while reproducible failures block promotion. No new authority, unsafe action or product decision is inferred. |
| Goal-preserving expansion | Configured and exercised in the native fixture: trusted profile, real semantic coordinator review, canonical acceptance, added dependency stage, verification, deduplication and truthful completion. There is no missing bearer/reviewer-process setup in this demonstrated native path. |
| Codex and Claude | Native Codex tool path demonstrated. Separate Claude CLI adapter has synthetic subprocess/protocol coverage; real authenticated Claude execution and native Claude control remain unverified. No Claude agent was launched or contacted. |

These distinctions replace the earlier implication that releasing the coordinator library alone established activation. They do not restart unrelated work, install an always-on service or claim that every host/private config has been configured.

## Specialist launch receipts

Every stage with named canonical staffing resolves a relevant role (`specialist_role` may narrow the stage default). Missing staffing stops before execution: the coordinator uses the existing supported amendment with fresh owner/CAS checks, preserves the assignment, and reads back the supporting role/staff admission. No automatic roster rotation or membership-based contribution is permitted.

After `begin`, invoke the real host subagent once. Save the actual returned agent ID in a private JSON receipt with these exact keys:

```json
{"schema":1,"adapter":"codex-native-subagent","agent_id":"ACTUAL_HOST_RETURNED_ID","request_digest":"EXACT_PACKET_ID","operation_id":"EXACT_PENDING_OPERATION","source_sha":"EXACT_CONTEXT_SOURCE","record_sha":"EXACT_CONTEXT_CANONICAL_REVISION","owner":{"staff":"EXACT_REQUESTED_STAFF","team":"EXACT_HOME_TEAM"},"launched_at":"ACTUAL_LAUNCH_TIME"}
```

Publish the receipt with `node scripts/relay-native-continuity.mjs delegate CHANNEL REQUEST_ID PRIVATE_RECEIPT_FILE`. This immediately enables the running observation through the existing canonical publisher. The terminal reply must name the same `agent_id`; successful execution remains blocked awaiting the configured acceptance verifier. Staff names describe fictional roles for actual model workers, never real employees or authorized Git identities.

If invocation times out, preserve the started intent and reconcile through the actual host receipt. Never launch again because a delegation file is missing. A stored delegation is immutable; a late terminal reply recovers the same identity without duplicate work. Raw prompts, agent receipts and process journals remain private; only bounded step evidence crosses into cards.

See [specialist delivery](SPECIALIST_DELIVERY_20261031.md) for ordinary coordinator activation, automatic CLI review, and private-plan recovery boundaries.
