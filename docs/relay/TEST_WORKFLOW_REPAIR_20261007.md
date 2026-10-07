# Required-suite failure aggregation

Status: implementation candidate, not merged or deployed. Existing assignment: `relay-mcp-rebuild-continuation-20261003`; linked audit: `relay-approval-friction-audit-20261006`. Scope is the root package, quality workflow, one orchestrator, its focused contract test and this document.

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
