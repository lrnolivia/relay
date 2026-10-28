# Intent-aware test maintenance

This is the one canonical test-maintenance workflow for Claude and Codex. Product repositories keep their runnable tests, fixtures and test configuration; they do not keep copies of this workflow. `AGENTS.md` and `CLAUDE.md` only point here.

Source: `src/test-maintenance.js` (workflow text, Test Agents adapter, report evaluator). Assignment `relay-intent-aware-test-maintenance-20261023`.

## How agents receive it

Nobody copies these instructions between chats. Relay delivers the same `test_maintenance` object on the normal work path:

| Path | Who | Field |
|---|---|---|
| `relay_runner_preflight` (start of work, after claim/rescope) | any host | `test_maintenance` |
| `relay_runner_resume` (every resume checkpoint) | any host, incl. native Codex and Claude Code sessions | `latest.test_maintenance` |
| `relay-executor` prompt | `claude-cli`, `codex-cli` | `context.test_maintenance`, with only that host's Test Agents loop |
| native continuity execute packet | existing native Codex task | `data.context.test_maintenance`; no second model process |

Design, research and coordination assignments, and retired assignments, receive `null`. The guidance sits outside the resume checkpoint hash, so it never changes a checkpoint identity. It adds no approval gate: authorized changes go ahead, and only unresolved requirements go back to the coordinator.

## Workflow

1. **Intent first.** Before editing any test, compare the approved goal, acceptance, acceptance additions and amendments with the source diff. Mark each affected behavior `unchanged`, `changed`, `removed` or `unresolved`. Existing tests are evidence, not authority over approved requirements.
2. **Classify each failing or affected test.**
   - `regression`: behavior that should be unchanged broke. Fix the code and keep the test.
   - `obsolete-expectation`: the test asserts a behavior the approved change removed or changed. Update or delete it, and add an absence or replacement assertion where meaningful.
   - `fixture-drift`: a selector, fixture or data shape moved but the behavior is unchanged. Repair the locator or fixture and keep every behavior assertion.
   - `unresolved`: there is no approved basis. Leave it failing and report it.
3. **Same change.** Update tests, fixtures, snapshots and test plans in the same change as the behavior. Keep coverage of unchanged behavior.
4. **Never** restore an intentionally removed feature to satisfy an obsolete test. Never blanket-update snapshots, weaken assertions, add `skip`/`only`/quarantine or loosen timeouts to get CI green.
5. **Rationale.** Every deleted or replaced assertion, changed snapshot, skipped or quarantined test and coverage reduction needs a one-line reason tied to the approved change.
6. **Report** what actually ran (see below).

## Choosing the tooling

| Suite | Tooling |
|---|---|
| Browser UI / E2E | Playwright Test, plus the official Playwright Test Agents when the project is set up for them |
| Unit / integration | The project's existing runner (`node:test`, vitest, jest, pytest, `cargo test`, `go test`, ...). Don't port these to Playwright. |
| Native GTK / Windows / macOS UI | Native tooling (AT-SPI/dogtail, UI Automation/WinAppDriver, XCUITest, ...). Playwright does not drive native UI. |

All of it runs in the agent's project environment. Relay's server runs no browsers or test agents. It supplies approved intent and receives the results.

## Playwright Test Agents (Claude and Codex adapters)

Reference: <https://playwright.dev/docs/test-agents>. The planner explores the app and writes a Markdown plan in `specs/`. The generator turns plans into Playwright tests. The healer replays failing tests and patches them.

1. **Check what's already there.** Look for `@playwright/test` or `playwright` in `package.json`/lockfile and its version, `playwright.config.*`, existing planner/generator/healer definitions for your host, `specs/` and `tests/seed.spec.*`. Run the installed CLI's `npx --no-install playwright init-agents --help` and inspect its `--loop` choices before recommending a command. Current website documentation is not proof that the installed version supports every host.
2. **Initialize only when needed and supported**, from the project root on the assignment branch:
   - Claude Code: `npx playwright init-agents --loop=claude`
   - Codex: `npx playwright init-agents --loop=codex`

   Run it only when the installed CLI lists your host and its definitions are missing, or Playwright changed version since they were generated. Otherwise reuse them. Don't reinstall or regenerate on every assignment. `playwrightAgentSetup()` accepts the observed `supportedLoops`; missing facts produce `loop-unverified`, and an absent host produces `loop-unsupported`. Existing current definitions remain reusable without initialization.

   Relay's pinned Playwright **1.60.0 supports Claude but rejects `--loop=codex`**. The current website advertises Codex support, but that does not establish support in this installed package. Report this version boundary; do not silently upgrade dependencies, install another package, or substitute a host to obtain a green setup result.
3. **Keep existing configuration.** Review the generated diff, keep existing `playwright.config`, seed test, specs and customized agent files, and commit the definitions with the project.
4. **Permissions.** Respect the host's permission prompts. Don't install browsers, global packages or MCP servers on Lauren's machines unless that's already authorized. If setup is missing and not authorized, report `playwright_agents: "missing"` with the specific blocker.
5. **MCP isn't the same thing.** Adding the Playwright MCP server (<https://github.com/microsoft/playwright-mcp>) only gives browser tools. It doesn't configure the planner, generator and healer.
6. **Healer skips.** The healer can mark a test skipped when it believes the functionality is broken. That's a regression report, not a fix. Keep the skip visible with its reason (classified `regression`) or restore the behavior.

Projects without browser UI keep their own tooling, and `playwrightAgentSetup` returns `not-applicable`. A project that lacks Playwright gets `playwright-missing`, which means: report the gap and install nothing.

## Report

Emit one agent message that starts with the line `RELAY_TEST_MAINTENANCE`, followed by exactly one raw JSON object. Do not include Markdown fences, leading commentary or trailing prose; put explanations in the report's rationale fields. Delivered guidance includes `report_template` and `report_values`, so the host does not need to infer field names from its runner's output. Replace every placeholder/example outcome with actual observations. The fenced example below documents the shape; the emitted message itself must not contain fences:

```json
{
  "schema": 1,
  "tested_commit": "<40-hex sha the tests actually ran on>",
  "run": {"id": "<CI run id or local run label>", "url": null},
  "counts": {"passed": 3, "failed": 0, "skipped": 1, "total": 4},
  "playwright_agents": "present | initialized | missing | not-applicable",
  "behaviors": [{"id": "csv-export", "status": "removed", "source": "acceptance 2"}],
  "tests": [
    {"id": "csv export is removed", "outcome": "passed", "behavior": "csv-export",
     "classification": "obsolete-expectation", "asserts": "absence",
     "rationale": "CSV export removed by approved acceptance", "assertions": {"before": 2, "after": 2}},
    {"id": "print preview", "outcome": "skipped", "rationale": "Covered by the native UI suite"}
  ]
}
```

- `outcome` is `passed | failed | skipped | updated | deleted`. `snapshot` can be `updated` (needs a rationale) or `blanket` (always a violation). `quarantined: true` counts as a skip.
- Counts are what the runner printed. Use `null` for anything unknown and never estimate. `total` is tests, not jobs.
- `evaluateTestMaintenance` returns `pass`, `fail` (any violation, reported runner failure, regression or unresolved item), `incomplete` (missing run identity, affected-test evidence or counts; missing or stale tested commit) or `invalid`. A failed count cannot be hidden by omitting the failing test from the affected-test list. Counts stay unknown when absent.
- Every updated/deleted assertion needs a rationale and a behavior binding. Deleting a test for approved unchanged behavior is rejected even with a rationale; duplicate behavior IDs are ambiguous and rejected. The evaluator checks an attributed report for consistency; it does not independently prove execution or validate the worker's interpretation of approved requirements.
- For `claude-cli`/`codex-cli` jobs the executor captures the report and appends `testMaintenanceSummary` (verdict, counts, commit, run, skips with reasons, coverage reductions, violation codes) to the job result summary, which existing cards already show. CI test counts stay with the existing CI telemetry check run. Native sessions may include the same bounded object as `test_maintenance_report` in their execute reply; the adapter evaluates it against the reply's head, carries its summary and retains it through reconciliation. A successful process/native return remains distinct from a passing maintenance report and whole-objective acceptance.

## Verification

Native card interaction and live data freshness are separate assertions. The consumer follow-up reproduced unchanged initial tool output overwriting a successful refresh during widget-state hydration. Its regression preserves navigation and proves genuinely changed host output still renders; existing card assertions remain intact. Native acceptance additionally requires a real post-deployment state change and observed refresh.

`test/test-maintenance-contract.test.mjs` runs a real fixture suite (`test/fixtures/test-maintenance/`) with `node --test` and evaluates reports built from the runner's actual TAP output:

- The obsolete suite fails against the approved change, and leaving it unclassified is never a pass.
- Intentional removal: the obsolete presence test becomes an absence assertion and passes (3 passed, 1 skipped with reason). The same suite fails on a build that resurrects the feature.
- Restoring the removed feature to satisfy the old test is reported as `removed-behavior-restored`.
- An unintended regression (Share broken) still fails. Relabelling it obsolete is rejected, and a healer-style skip stays a visible regression and coverage reduction.
- The selector rename is repaired with both behavior assertions kept. Dropping one is rejected as `assertions-weakened`.
- Skips without reasons, blanket snapshot updates and unknown counts are surfaced and never filled in.

`scripts/relay-executor.test.mjs` runs both the `claude` and `codex` executor adapters as subprocesses. Each one gets only its own `init-agents --loop` command, and its report reaches the stored job result summary. Resume and preflight tests assert the delivered guidance.

`scripts/relay-native-continuity.test.mjs` verifies the native Codex packet and report/recovery path, including a successful native return whose maintenance report fails. Five regression tests failed against the original WIP and pass after the verdict corrections: runner failures, stale/incomplete evidence, unexplained replacements, unchanged-test deletion and ambiguous intent bindings. Existing removal/regression/fixture/skip demonstrations remain intact.

The [2026-10-28 consumer verification](CONSUMER_VERIFICATION_20261028.md) records authenticated Claude execution (7 actual contract tests passed), same-session structured-output report evaluation/native handoff, the official planner/generator/healer workflow (4 browser tests passed after two observed fixture-drift failures, all 23 assertions preserved), and actual mounted MCP Apps card interactions. Initial host denials were resolved by explicit session-only user approval. Free-text reports with prose or wrong schema remain rejected; the default standalone broker is not claimed to capture the separate structured-output transport automatically. Isolated browser verification is not every product's E2E acceptance. Installed Playwright 1.60.0 does not support the Codex loop, and full native-window access was unavailable.
