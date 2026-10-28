# Consumer verification, 2026-10-28

Assignment `relay-consumer-verification-20261028` continues the requested Claude, official Playwright Test Agent and native card verification after PRs 254–256. The original goal and acceptance remain authoritative. This record is partial acceptance evidence, not an assertion that all consumers passed or that this candidate is deployed.

Candidate implementation: `8b8ca26d15c0286e28d621d70417bb0503774104`. Environment: macOS arm64, Node 22.23.3, npm 10.9.9, Playwright 1.60.0, Claude Code 2.1.251. Temporary transcripts, fixture, screenshots, RPC exchanges and private receipts are outside source under the current task's `consumer-verification` artifact directory. Private lease credentials are not publication artifacts.

## Authenticated provider

Lauren signed in on this Mac. A real authenticated probe succeeded after an observed account-limit reset; no alternate account, overage or credential change was used by the coordinator.

The first broker execution, `job_7deee44e17966dae34cecfa2bf793370e324b852843fbd0d8ab2076997549fad`, exited twice without a session or stdout. Direct probes reproduced the cause: the CLI abandons completely empty stdin after three seconds, while the executor withheld input until the remote broker acknowledged its process. An 18-second delayed-input probe failed; an otherwise equivalent probe that sent a newline immediately and withheld the work prompt and EOF for 18 seconds succeeded (session `86117c7f-d68e-4ee5-9607-498e2a7118ff`).

The executor now supplies only whitespace before acknowledgement. Its delayed-start regression test failed before the fix and passes after it, checking that no task text or EOF reaches the child before acknowledgement. Manual permissions and session/lease gates are unchanged.

Two actual runs on the repaired candidate established process transport but did not establish the full maintenance-report acceptance:

| Job | Actual session | Result and limit |
| --- | --- | --- |
| `job_3073275eab890de83f2124d707a78badae47f89e29ab7af7d169b326cd219b47` | `a3ad4f4d-d51a-422b-bbd8-c48b31dbe12e` | Started with PID 95444 and exited 0. The model declined to summarize coordinator-provided test evidence and emitted no protocol report. The transcript confirms the task was supplied as a user message; no additional prompt-transport defect was established. |
| `job_a72b19bfb08954d25200ce84070cca777dd82fb141c4b0fdb11dfb2968519edf` | `e5fec8d4-e78a-4824-b032-e09661564396` | Read the actual maintenance document and source identity, then the host denied the exact Node contract-test command. No independent tests ran. The model reported unknown counts in prose/fenced JSON, which is not the exact report protocol and was not recorded as a passing maintenance report. |

A successful broker process remains distinct from a passing consumer result. The pending next step is a session-only allowance for the exact pinned-Node contract-test invocation, followed by an actual run and parser/evaluator verification. Existing failed and incomplete receipts remain preserved.

## Official Playwright Test Agents

The installed CLI's `init-agents --help` lists `claude`, `copilot`, `opencode`, `vscode` and `vscode-legacy`. An actual `--loop=codex` invocation rejects the argument. The current [official documentation](https://playwright.dev/docs/test-agents) advertises Codex, but that does not establish support in the pinned package. No dependency was upgraded or substituted.

The setup helper and delivered guidance now require observed installed-loop support before recommending initialization. Unknown facts return `loop-unverified`; unsupported hosts return `loop-unsupported`. Current complete definitions remain reusable. Missing or stale definitions are initialized only for a supported host. The helper recognizes the installed `playwright` package as well as `@playwright/test`.

An isolated localhost fixture reused the existing dependency and browser installation. Its server binds only `127.0.0.1:43187`. The installed official `init-agents --loop=claude` generated the planner, generator and healer definitions plus local MCP configuration. The existing seed/configuration were preserved; the real seed test passed.

The actual planner session `e81cb43a-3a22-447a-986f-92a7052f3994` reached `mcp__playwright-test__planner_setup_page`, which manual permissions denied. It stopped without exploring the app or saving a plan. Generator and healer have not run. A fixture-only, session-only tool allowance is pending; there is no global MCP registration, browser install or persistent permission change. The remaining scenario is to generate absence/Save/Share assertions, introduce only a selector-label drift, observe the actual failure, and have the official healer repair the locator while preserving all behavior assertions.

## Native mounted cards

Direct computer-use observations verified the actual **Codex MCP Apps host inside the ChatGPT desktop application**. Both a completed work card and the current assignment context card mounted and hydrated. The current card supported project/assignment navigation, Refresh, and expanded technical evidence. Its diagnostic showed host globals present, a completed handshake and a height report.

Refresh briefly showed the project loading view, then restored the selected assignment. The provisional reset suspicion was corrected after observing settled state; no card source change was made. `Open Relay` was clicked, but no destination appeared in the available in-app-browser tabs, so the external handoff is unverified.

Actual evidence is retained as `native-card.png`, `native-card-dom.txt` and `native-card-proof.json` in the task artifacts. Full application access was explicitly denied by the computer-use tool. Full-window theme/contrast, separate ChatGPT Work/web clients and physical devices therefore remain unverified; an iframe screenshot does not establish those outcomes. The denial was not bypassed.

## Source validation and pending acceptance

At the implementation candidate, the pinned build, typechecks and all five required suites passed: **1,074 passed, 0 failed, 2 existing platform-dependent skips, 1,076 total**. The focused guidance/contracts/executor run passed **115 tests, 0 failed, 0 skipped**. The coordinator's separate contract suite passed **7 tests**; those counts are not attributed to a model-run test.

The two existing contract skips concern uncooperative POSIX descendants and real PID termination observation. This change added no skips, blanket snapshots, assertion weakening or restored removed behavior. Setup-test expectations changed only because observed installed-loop support is now required; the delayed-input test strengthens the existing broker lifecycle coverage.

The complete native continuity plan retains separate Claude, Playwright, native-card, guidance and publication criteria. Claude's passing report and the official planner/generator/healer run remain pending host permission. The whole assignment and publication acceptance are not complete. Preserve the original plan, native start receipt, earlier broker jobs and exact candidate evidence while obtaining those bounded permissions; do not replay uncertain work or promote a process exit into acceptance.
