# Consumer verification, 2026-10-28

Assignment `relay-consumer-verification-20261028` continues the requested Claude, official Playwright Test Agent and native card verification after PRs 254–256. The original goal and acceptance remain authoritative. The available consumer paths below are verified with explicit transport, host and version limits. Publication evidence is recorded separately against the final merged source; this document alone does not establish deployment.

Final tested implementation: `a219383b6566636c197c21edb3b519f413b43986` (initial startup/loop fixes at `8b8ca26d15c0286e28d621d70417bb0503774104`). Environment: macOS arm64, Node 22.23.3, npm 10.9.9, Playwright 1.60.0, Claude Code 2.1.251. Temporary transcripts, fixture, screenshots, RPC exchanges and private receipts are outside source under the current task's `consumer-verification` artifact directory. Private lease credentials are not publication artifacts.

## Authenticated provider

Lauren signed in on this Mac. A real authenticated probe succeeded after an observed account-limit reset; no alternate account, overage or credential change was used by the coordinator.

The first broker execution, `job_7deee44e17966dae34cecfa2bf793370e324b852843fbd0d8ab2076997549fad`, exited twice without a session or stdout. Direct probes reproduced the cause: the CLI abandons completely empty stdin after three seconds, while the executor withheld input until the remote broker acknowledged its process. An 18-second delayed-input probe failed; an otherwise equivalent probe that sent a newline immediately and withheld the work prompt and EOF for 18 seconds succeeded (session `86117c7f-d68e-4ee5-9607-498e2a7118ff`).

The executor now supplies only whitespace before acknowledgement. Its delayed-start regression test failed before the fix and passes after it, checking that no task text or EOF reaches the child before acknowledgement. Manual permissions and session/lease gates are unchanged.

Two actual runs on the repaired candidate established process transport but did not establish the full maintenance-report acceptance:

| Job | Actual session | Result and limit |
| --- | --- | --- |
| `job_3073275eab890de83f2124d707a78badae47f89e29ab7af7d169b326cd219b47` | `a3ad4f4d-d51a-422b-bbd8-c48b31dbe12e` | Started with PID 95444 and exited 0. The model declined to summarize coordinator-provided test evidence and emitted no protocol report. The transcript confirms the task was supplied as a user message; no additional prompt-transport defect was established. |
| `job_a72b19bfb08954d25200ce84070cca777dd82fb141c4b0fdb11dfb2968519edf` | `e5fec8d4-e78a-4824-b032-e09661564396` | Read the actual maintenance document and source identity, then the host denied the exact Node contract-test command. No independent tests ran. The model reported unknown counts in prose/fenced JSON, which is not the exact report protocol and was not recorded as a passing maintenance report. |

A successful broker process remains distinct from a passing consumer result. Lauren subsequently approved the exact pinned-Node command with a session-only allowance. Actual tests passed, but subsequent broker reports included trailing prose or runner-specific schema aliases; those were rejected. Another run declined the cached runtime path. These receipts remain preserved and do not become passes retrospectively.

The delivered guidance now includes the exact `report_template`, allowed values and an explicit raw-JSON formatting instruction. A regression test verifies that a populated template round-trips through the unchanged strict parser and evaluator, and that trailing prose is still rejected. This addresses the missing schema context; it does not guarantee model compliance.

An independent direct CLI consumer received the exact exported guidance and approved command. Session `e89d2dcd-b95f-4d44-ac76-a9f7f963850b`, PID 87558, independently ran the contract suite at `a219383`: **7 passed, 0 failed, 0 skipped**. Its report object was correct, but leading prose still prevented raw-prefix ingestion. The same authenticated session then returned that existing report through the CLI's [structured-output mode](https://code.claude.com/docs/en/headless#structured-output), PID 87748, exit 0. No new test run or counts were invented. The returned object exactly matches the actual TAP evidence and passes Relay's evaluator.

The native coordinator forwards that exact structured object through the existing `test_maintenance_report` reply field. This is verified structured-output-to-native transport, not a claim that the default standalone broker automatically captures structured output or that every free-text response follows the prefix protocol. Startup transport, independent execution, structured report validity and native ingestion have separate retained evidence. No parser/evaluator rule or permission setting was relaxed.

## Official Playwright Test Agents

The installed CLI's `init-agents --help` lists `claude`, `copilot`, `opencode`, `vscode` and `vscode-legacy`. An actual `--loop=codex` invocation rejects the argument. The current [official documentation](https://playwright.dev/docs/test-agents) advertises Codex, but that does not establish support in the pinned package. No dependency was upgraded or substituted.

The setup helper and delivered guidance now require observed installed-loop support before recommending initialization. Unknown facts return `loop-unverified`; unsupported hosts return `loop-unsupported`. Current complete definitions remain reusable. Missing or stale definitions are initialized only for a supported host. The helper recognizes the installed `playwright` package as well as `@playwright/test`.

An isolated localhost fixture reused the existing dependency and browser installation. Its server binds only `127.0.0.1:43187`. The installed official `init-agents --loop=claude` generated the planner, generator and healer definitions plus local MCP configuration. The existing seed/configuration were preserved; the real seed test passed.

The initial planner session `e81cb43a-3a22-447a-986f-92a7052f3994` stopped when manual permissions denied `planner_setup_page`. Lauren then explicitly approved fixture-only tools and test edits for this verification session. No global MCP registration, browser install or persistent permission change was made.

All three official roles subsequently completed with actual MCP tool traces, exit 0 and no permission denials:

| Role | Session | Observed result |
| --- | --- | --- |
| Planner | `aea66ac2-5d39-4a7a-b6d7-591204c5c198` | Explored the actual page and saved the CSV-absence, exact Save status and exact Share status scenarios. |
| Generator | `0d122fa5-b952-4dea-ac59-9ac79fbd3230` | Executed the scenarios with browser tools and wrote three tests; independent baseline run passed all four tests including the seed. |
| Healer | `954cb3f9-8f59-4ef4-87c8-54a6a5540a56` | Diagnosed the approved fixture-label change from Save draft to Save document, repaired exactly two locator literals and one comment, then passed all four tests. |

The coordinator's independent runner observed **2 failed / 2 passed** after the label change and **4 passed / 0 failed / 0 skipped** after healing. The before/after source comparison preserves every executable statement after normalizing only the two approved label replacements; all **23 assertions** remain (11 CSV, 6 Save, 5 Share, 1 seed). No timeout, assertion, status value, test title or skip was changed. This verifies the installed Claude Test Agents on the isolated scenario, not Codex-loop support or every product's E2E suite.

## Native mounted cards

Direct computer-use observations verified the actual **Codex MCP Apps host inside the ChatGPT desktop application**. Both a completed work card and the current assignment context card mounted and hydrated. The current card supported project/assignment navigation, Refresh, and expanded technical evidence. Its diagnostic showed host globals present, a completed handshake and a height report.

Refresh briefly showed the project loading view, then restored the selected assignment. This initially established interaction and selection preservation only. A later check after a real Runner hold exposed stale content: the old mounted card retained its initial source and next action, while a fresh server read and a newly rendered card showed the current PR and hold. `Open Relay` was clicked, but no destination appeared in the available in-app-browser tabs, so the external handoff is unverified.

The stale-refresh behavior was reproduced in an isolated browser harness: a widget-state event carrying unchanged initial `toolOutput` overwrote a successful fresh read. The new regression failed against the previous source, then passed after unchanged global output was deduplicated. Changed host output still hydrates. Existing navigation, error, image, bridge and model coverage remains intact; no assertion was removed. The context-card resource advances to v19, retaining v18 as a compatibility alias so cached clients can still request it. Actual native freshness after this repair must be recorded separately against the deployed version; the harness alone does not establish native acceptance.

Actual evidence is retained as `native-card.png`, `native-card-dom.txt` and `native-card-proof.json` in the task artifacts. Full application access was explicitly denied by the computer-use tool. Full-window theme/contrast, separate ChatGPT Work/web clients and physical devices therefore remain unverified; an iframe screenshot does not establish those outcomes. The denial was not bypassed.

Lauren additionally reported that Momo appeared in Claude but not ChatGPT. In the available desktop card, the Momo CSS declaration was present but no font face was loaded. The card now tries normal CSS loading first, then loads the same bundled licensed bytes through the standard `FontFace` buffer API if needed. A separate CSS family alias prevents an errored CSS face from shadowing the loaded buffer face. There is no new font download or CSP change. The browser regression verifies normal loading, restricted CSS font URLs, matching glyph metrics, and no font network request. Actual native font loading must still be checked on the deployed resource; the reported Claude rendering was user evidence, not a new observation by this task.

## Source validation and pending acceptance

At the final implementation candidate, the pinned build, typechecks and all five required suites passed locally: **1,075 passed, 0 failed, 2 existing platform-dependent skips, 1,077 total**. The focused guidance/contracts/executor run passed **116 tests, 0 failed, 0 skipped**. Exact-source PR CI [40634443400](https://github.com/lrnolivia/relay/actions/runs/40634443400) passed **1,076 tests, 0 failed, 1 platform-dependent skip**. Earlier implementation evidence (1,074 local passes and 115 focused passes) remains retained. The coordinator's separate seven-test contract run is distinct from the independently observed Claude run.

The two existing contract skips concern uncooperative POSIX descendants and real PID termination observation. This change added no skips, blanket snapshots, assertion weakening or restored removed behavior. Setup-test expectations changed only because observed installed-loop support is now required; the delayed-input test strengthens the existing broker lifecycle coverage.

The complete native continuity plan retains separate Claude, Playwright, native-card, guidance and publication criteria. The consumer criteria now have actual evidence; the exact structured report is reconciled against the original native start receipt without replaying its work. Final completion additionally requires the merged-source checks, normal Workers Build, production readback and recovery receipt. Unsupported Codex initialization, unavailable full-native/client/device access and unreliable free-text report formatting remain explicit limits, not passing claims.
