# Live work cards, CI test telemetry and staff attribution

Assignment `relay-live-work-cards-staff-ci-20261023`, branch `relay/live-work-cards-20261023`. Executor: Claude Code cloud session `session_01WLGYFCDkG53syBZwbf19nX` (claude-code-remote, anthropic_cloud). That executor has no native desktop or ChatGPT control. Baseline: deployed `446ed6a1ac732b5e016b2c6fd2528e36fba7affc`. No source under `src/`, `packages/` or `contracts/` changed between it and the claim base `a375ebb1`.

## What was wrong

- Only `relay_render_context_card` carried MCP Apps UI metadata. Ordinary work (claim, heartbeat, hold, handoff, complete, PR, checks, deploy) returned data only, so no host had anything to mount unless someone asked for a card.
- CI results showed check names only. There were no test counts, totals, elapsed time or live state.
- Staff routing took the first registry match. Every implementation task went to Nico, an explicit role with no in-team holder returned `null`, and the supporting "verification" role went to Luca, whose role is release-captain, ahead of Roman, the verifier.
- The status explorer hid `#staff` on every route, and assignment detail never restored it.
- The card model's current-item choice excluded only `completed`, so cancelled or superseded claims could become the headline.

## Delivery contract

`src/work-card-delivery.js` lists the milestone commands. They carry `_meta.ui.resourceUri` and `openai/outputTemplate` for the current card (`ui://relay/context-card/v18.html`):

| tool | milestones |
|---|---|
| `relay_runner_coordinate` | queue → Queued, claim → Work started, heartbeat/amend/rescope/reconcile → Step recorded, hold → Blocked, handoff → Handed off, complete → Completed, retire → Ended |
| `relay_execution` | submit, lease/start, checkpoint/recover, finish, cancel, status |
| `relay_source_open_pull_request`, `relay_source_pull_request_action` | PR opened / updated |
| `relay_source_checks` | live CI card |
| `relay_cloud_deploy_project_version` | deployment recorded |

Queries (`relay_runner_progress`, `_assignments`, `_resume`, `_updates`) stay data-first. That keeps the decoupled guidance in `CHATGPT_CARD_HOST_MOUNT_FOLLOWUP.md` for reads, and the descriptor stays native in `tools/list` (no wrapper injection).

The milestone is read from the command's own result. A refused call shows "Did not complete" and is never shown as progress. `contextualPresentation` adds `work_card`, `staff_attribution` and, for checks, `ci`.

To avoid a stack of cards in the chat, a mounted work card refreshes itself in place. It re-reads `relay_runner_progress` for its assignment every 30 s, or the same `relay_source_checks` ref every 15 s for CI. It refreshes only while visible and while the work is live, and stops at a terminal state or after 90 polls. After a failed read it says "Live updates paused" with the last update time and retries at most three times. A late mount-time recovery answer no longer replaces the tool result that arrived first.

## CI test telemetry

- `scripts/ci-test-telemetry-reporter.mjs` is a node:test reporter. The orchestrator (`telemetryEnv`) adds it through `NODE_OPTIONS` beside an explicit TAP stdout reporter, so suite logs stay byte-compatible. It writes one NDJSON file per required suite.
- Runners nested inside a test inherit `NODE_TEST_CONTEXT` and stay silent. Suites never receive the telemetry directory, and re-deriving the env replaces reporter flags instead of stacking them.
- `scripts/ci-parallel-suites.mjs` keeps the publisher in the parent process. It reads the files every 10 s and on every suite report, and publishes `relay-tests / <job>` check runs (`checks: write`; the token is removed from suite env).
- Suite status always comes from the required-suite accounting. Telemetry adds counts and marks a started suite as running.
- The observer check run always concludes `neutral`, and its title states the real outcome. The `quality` job remains the merge gate, so the observer can never block or pass a merge.
- A rerun supersedes an unfinished observer from a lost attempt. An `always()` step (`--finalize`) completes an observer left `in_progress`.
- `src/ci-test-telemetry.js` summarizes one commit's check runs for the card:
  - Job counts and test counts are separate.
  - Only the newest attempt per workflow run is used, and a suite reported twice in one attempt counts once. Distinct shards add up.
  - The total stays `null` (shown as "unknown until all finish") until every suite has a final runner summary.
  - Telemetry older than 2 minutes on a running job is flagged `stale`.
  - A run with no observer reports `telemetry: not-reported` and shows job counts only.
  - Failed tests (≤10, with suite, name and message) and failed jobs with annotations give failure drill-down.

## Staff attribution

- `normalizeAssignmentStaff` now ranks candidates: an exact role scores above an affinity, home team above a cross-team member.
- A category-only task prefers role holders inside its team, then the team's home staff. An explicit role with no in-team holder falls back to the best cross-team match instead of `null`. Registry order breaks exact ties only, so routing is deterministic and never rotates.
- Examples: implementation/runner → Nico, implementation/source → Rafael, implementation in cloud → Gabriel, maintenance → Adrian, verification support → Roman.
- `assignmentStaffAttribution` returns the name, role title, team and supporting staff, plus the executor owner as a separate machine identity. `participation: "routing"` records that a staff name is routing, not evidence of who performed the work.
- An unresolved binding names its reason: `not-recorded`, `no-match` or `unknown-staff`.
- Cards show "Rafael · The Integrator", or "Unassigned staff" with the reason as the tooltip. The explorer restores staff on assignment detail and lists staff on project rows.

## Verification

Local, Node 22.23.3, at the exact candidate head:
- Focused suites: card, entry, host probe, staff, team, telemetry, delivery, workflow and CI contracts.
- Real-browser tests mount the actual v18 resource through the standard MCP Apps bridge. A normal claim result renders staff and role, then refreshes in place to held and complete, with no further polls after completion. A CI result renders 312 passed · 1 failed · 4 skipped with the total unknown, then refreshes to "Failed 340/345" with a run link, and polling stops.
- A real `node --test` run through the reporter matches node's own summary (4 passed, 1 failed, 1 skipped, 1 todo), and a nested runner adds nothing.

Local browser tests used the container's Chromium 1194 through a scratch `PLAYWRIGHT_BROWSERS_PATH`, because pinned Playwright 1.60 expects build 1223. CI uses its pinned container.

### Host surfaces — status

| surface | status |
|---|---|
| Claude desktop app, Code tab (cloud session) | **Verified** on production `25ab337` / Workers version `d57a5198`, 2026-10-23 05:47–05:49Z, from Lauren's screen recording (feedback `fbr_3d7bf2e8…`). Throwaway assignment `card-smoke-2026-10-23-iz1a`: queue, claim, heartbeat, hold and retire each auto-mounted a card showing Rafael · The Integrator, without a render request. `relay_source_checks` mounted the CI card (1053/1054 passed, 3 of 3 jobs, 5 of 5 suites, run #39907207348, 3m 54s, Open CI run). Queries and refused calls showed no card. |
| ChatGPT web, ChatGPT desktop | **Unverified.** Run the same smoke procedure there. |
| Real CI telemetry | **Verified.** PR #253 run 39906910195 published `relay-tests / quality` (neutral) with 1053 passed and 1 skipped across the five suites, matching each suite's own TAP summary. |

The smoke run found two defects, both fixed in the follow-up:
- After the retire, every earlier card refreshed to "Cancelled" and lost its own step. A card now keeps the step it was mounted for ("This step: Work started") beside the live state.
- The CI card listed a "Failed test" while counts said 0 failed. It came from a nested runner in `test/source-test-contracts.test.mjs`: a fixture that deliberately fails, whose test clears `NODE_TEST_CONTEXT`. Telemetry events now carry their runner's pid, and the fold keeps only the suite's own top-level runner.

Known, not in this assignment's paths: the generic `human_v1` check summary can read "Check finished" because it counts the neutral observer. The CI card's own state ("Passed") comes from the jobs.

Static and sample test cards (`relay_test_card_*`) are not evidence for this assignment. Production deployment and readback follow the normal authorized release gates and are recorded here when they happen.
