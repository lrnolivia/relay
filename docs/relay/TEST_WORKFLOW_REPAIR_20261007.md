# Required-suite failure aggregation

Initial repair status below is historical; current CI efficiency continuation is recorded at the end. Existing assignment: `relay-mcp-rebuild-continuation-20261003`; linked audit: `relay-approval-friction-audit-20261006`. Scope is the root package, quality workflow, one orchestrator, its focused contract test and this document.

## Defect and bounded repair

Root `npm test` previously chained inspector, runner, layout, contracts and web commands with `&&`. The first nonzero command prevented later independent required suites from running. Repeated CI then discovered failures one suite at a time.

The new root command runs exactly those five commands sequentially, retaining their arguments and assertions. Sequential execution avoids shared browser/fixture races. A failed suite is recorded and later independent suites still run. The overall gate is green only when all required suites actually pass. No `continue-on-error`, suite filter, assertion deletion, dependency change or installation is introduced.

The orchestrator supports explicitly declared earlier prerequisites for future callers; only dependents of a non-passing prerequisite are blocked. The current five suite commands all retain their shared CI install/build/typecheck prerequisites and have no declared inter-suite dependency. This slice does not invent independence between individual tests inside a suite.

## Changed contract audit

| Contract | Previous | Candidate | Evidence |
| --- | --- | --- | --- |
| Root entrypoint | Five `&&` commands | Fixed manifest of identical five commands | Manifest parity test |
| Inspector/Runner/layout/contracts/web assertions | Existing workspace commands | Unchanged commands and test files | No owned changes inside those suites |
| Shared setup | CI install, Chromium, build, typecheck | Preserved before `npm test` | Workflow diff |
| Failed suite | Prevented later suites | Failed result plus later independent outcomes | Two-failure/one-pass fixture |
| Dependency failure | Implicit shell short-circuit | Explicit `blocked_by` in reusable runner | Prerequisite fixture |
| Process errors | One overall shell status | Per-suite original exit and signal; missing start, timeout and cancellation non-passing | Negative fixtures |
| CI failure summary | First three TAP blocks or final 40 lines | One bounded sanitized diagnostic for each non-passing suite, alongside streamed sanitized job output | Noisy/redaction fixtures |
| Evidence identity | Job log context | Source SHA, Node/platform/architecture, lock and manifest hashes, run ID/attempt | Structured report |
| Evidence retention | Branch-conditioned visual artifacts | Unconditional required-suite accounting artifact keyed by exact source/run/attempt | Workflow wiring test |

## Process and evidence boundaries

- The required CLI does not accept custom commands or filtering. Programmatic callers must provide a nonempty manifest with unique IDs, all `required:true` and prerequisites that refer to earlier entries.
- Each suite has a 15-minute default bound. The quality job budget is 95 minutes to allow all five worst-case suite bounds plus setup and upload margin; this is a ceiling, not a claim about normal runtime. Timeouts and explicit cancellation terminate its process group on POSIX, including inherited subprocess pipes. A hard pipe-settle bound prevents an escaped process group from hanging accounting indefinitely; escaped descendants are explicitly outside process-group cleanup proof. Windows uses direct-child termination and is not claimed as equivalent process-tree proof by this slice.
- Logs are streamed line by line with token/password/header-like values and URL query/fragment data redacted. JSON evidence is written atomically before execution and after each result, has a bounded diagnostic and excludes raw environment variables. Oversized single lines are explicitly omitted instead of retained unboundedly.
- Original numeric process exits are preserved where a process actually started; failed spawn has no process exit. The aggregate uses 1 for any non-passing required suite.
- CI sets `RELAY_SOURCE_SHA` to the exact PR head or push SHA. A local run lacking source/lock identity remains explicitly incomplete; canonical GitHub CI rejects missing exact identity.
- `qa-evidence/test-workflow/result.json` is uploaded with `if: always()` and missing-file failure. If shared install/browser/build/typecheck setup fails, an always-run blocked-accounting path records all required suites blocked with the failed prerequisites and launches none. Checkout or Node setup failure can still prevent any repository script from running; original Actions errors remain authoritative.

## Validation and remaining gates

The focused command is `node --test test/test-workflow-contract.test.mjs` (`npm run test:workflow`). Initial execution caught and corrected two real harness issues: an ENOENT spawn code being mistaken for a process exit, and command arguments bypassing diagnostic redaction.

The reviewed candidate passed 20 offline contract tests on official Node 22.23.3. Independent review then found and fixed detached-process teardown, escaped-pipe settlement, complete sensitive-field redaction, oversized-line suffix leakage, CI budget and incomplete-accounting gaps. Regression fixtures exercise actual child processes without browser, server, network or dependency installation. They cover independent failures, preserved commands/exits, prerequisite blocking, all-pass behavior, missing executable, timeout, process-tree cleanup, cancellation, signal exit, output bounds/redaction and workflow wiring.

Full repository tests, hosted CI and actual release validation remain required and are not claimed by these focused results. Root/worker metadata updates, local edits and this document do not imply a merge, deployment or runtime acceptance. No Relay connector deployment is authorized during GW's active release.

## Rollback and continuation

Baseline branch: `relay/mcp-rebuild-20261003` at `c95cfd6911201348aff6bd188b473d6adde33ec6`; both pre-existing edited files matched the currently inspected main bytes. Preserve the baseline before publication. Revert only this five-file commit if needed; do not roll back shared coordination state or unrelated source.

Before publication, save the exact candidate bytes and source manifest to the already-authorized private durable destination, read them back and restore independently. Then refresh canonical admission/head, publish only these five paths and open a draft PR. Automatic source protection, full source-to-test contract discovery, exact toolchain enforcement, actual target-runtime gates and complete stage taxonomy remain unfinished crosswalk items. New product feature work is not part of this repair.


## CI efficiency continuation — 2026-10-07

The verifier repair in PR183 is released at `b9b9d0fdd486a04b31daecad01bd2b0ecb59dfb2`. PR quality run `37703221396` passed all five required suites, actual workerd and ten card captures. Its retained sample preview passed four captures with hash-checked readback. Main run `37704488635` passed quality and authenticated production verification: discoverable read-only source manifest, all 895 entries over two pages, Files lifecycle, four live captures and four retained sample captures. Manifest metadata is not source-byte restoration. Worker version `d0014953-1be3-4597-a5b5-69cb90bc28cf`, deployment `24249609-1be8-44f6-9733-8e9bb375f62a` serves 100%; prior version `58c17f00-6332-4bd0-99d2-1e984d204f19` remains the unexercised rollback candidate.

### Measured waste and candidate

The prior workflow prepared separate runners for quality, draft preview and production. For PR183 the quality runner took 571 seconds, including 475 seconds installing system/browser dependencies; the preview runner took another 212 seconds. The five suites themselves took approximately 35 seconds. Its main quality and production runners took 83 and 103 seconds. These are observed job durations, not billing receipts or a promised savings percentage.

The next candidate runs one checkout, exact Node/npm setup, dependency install and immutable build. A digest-pinned official `mcr.microsoft.com/playwright:v1.60.0-noble` environment already supplies the matching browsers and system dependencies. `actions/setup-node` still installs Node22.23.3 from `.node-version`; the container's default Node is not trusted. Browser readiness verifies the installed package pin and launches Chromium. Inspector, Runner, layout, contracts, web, typecheck, actual local workerd, card visuals and their evidence remain required as applicable. Browser tests run against the same preinstalled headless runtime they previously downloaded.

Production and preview retain their prior applicability conditions. An exact-source/run/attempt plan records mandatory gates before execution. Hosted summarization rejects an absent, stale, changed or inconsistent plan; applicable card, immutable-build reuse, production, retained and preview stages cannot pass when skipped or missing. Before downstream reuse, the existing `verify-build` command checks source, lock, toolchain, configuration and generated byte hashes. No second build or checkout can substitute for the tested build. The job ceiling is 125 minutes so the unchanged five independent 15-minute suite limits plus applicable bounded downstream gates can finish and retain failure evidence; ordinary execution is expected to be much shorter and must be measured.

Preview artifacts now include only retained/current-fixes/notification preview output rather than reuploading all quality evidence. The one shared stage summary and all required-suite, source-map, runtime, toolchain, production and capture receipts remain preserved with missing-file errors. No platform, subscription, credentials, assertion, required suite or browser coverage is removed.

### Active branch retention repair

After PR183 merged, repository `delete_branch_on_merge:true` removed the still-active assignment branch. Preflight correctly blocked on `missing_branch`, but the conversational error omitted its findings and described a stale item. The exact previously published `87a0d47df49d27a84f107088db2af840dd8cbf76` branch was restored through Relay SOURCE and verified. GitHub unconditional deletion is now disabled; the existing Runner cleanup remains responsible for completed, accounted, exact-identity managed branches and preserves active/held reservations. Preflight passed after restoration. Re-enabling unconditional deletion would recreate this failure for a multi-batch assignment.

### Verification and boundaries

The initial efficiency candidate's focused local checks passed 98 tests with two Linux-only controls skipped on macOS. The canonical hosted run must validate the actual Linux container, all five suites, required preview and main production paths. No efficiency savings, hosted success or publication is claimed by this candidate note. Source changes require the normal fresh admission, exact-head publication and remotely verified incremental restoration.

The saved CI direction `ctx_a8c84d43b9e4e7ae2c75617be4dd1eb623a40399139c42a13733ffe6afb9e616` remains: keep GitHub tests and Cloudflare deployment, build/shared tests once for GW then test that immutable build in Chromium and WebKit. GW's held release remains a separate ownership and frozen-candidate boundary. Its current failures and cancelled full runs need root fixes; duplicate build removal alone does not explain most of its browser cost. No GW source or workflow is changed here.

The original Relay acceptance remains open: real executor/routing/skills and in-run acknowledgement, large/native recovery, Night Shift/oversight/Shift, actual client actions/parity, the owner's feedback-to-verified-live cycle, remaining producer language and quota/review proof. Files UI refinement stays last. The unrevealed admission findings remain an observed diagnostics defect for a subsequent bounded repair; fixing branch retention did not fix that message.


First hosted container run `37705516806` at `8f33eb398a3dde46f338430228e0ce982383dae1` stopped before toolchain/build/suites: Actions checkout reported the exact head, but the subsequent Git probe returned no head. The source gate stayed nonpassing, all five suites were recorded blocked, and the summary retained the missing-plan gap. The follow-up adds original bounded/redacted Git probe diagnostics and preserves a blocked plan with its cause. A container checkout check permits only the known workspace registration when Git specifically reports dubious ownership; it still requires that workspace root and exact head, rejects every other Git failure and never trusts a wildcard directory. This addresses the observed container integration path without weakening provenance. The next hosted run must establish its actual cause and validate the correction.


Hosted run `37706066577` at `c8567fa81efab2e31434b8e473e26ee2cd2d7fdb` confirmed Git's actual `detected dubious ownership` diagnostic and passed the scoped workspace registration, all five suites, workerd and ten contextual captures. Downstream reuse then rejected untracked app-local retirement screenshots. The follow-up moves those generated captures into root `qa-evidence/retirement/`, preserving the same rendering assertions and uploads. Source cleanliness and output-byte verification remain strict; a regression proves root evidence permits unchanged build reuse while misplaced app captures still fail. Provenance errors now retain bounded dirty-path names rather than hiding the cause behind `checkout_dirty`.
