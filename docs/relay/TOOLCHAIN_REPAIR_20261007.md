# Reproducible Relay toolchain and web-payload identity

## Scope

This bounded reliability slice pins the already-tested official Node 22.23.3 and npm 10.9.9 combination. It preserves the existing five required suites and all three canonical CI jobs. It does not change the Relay or CTRL UI, credentials, bindings, security settings, or deployment authority.

The root package records exact `engines` and `packageManager` versions and `.node-version` selects the same Node patch. The lockfile changes only root engine metadata; all dependency resolutions and integrity values remain unchanged.

## Enforced behavior

- Canonical workspace CI uses the exact Node file and checks active Node/npm, root manifest/lock consistency and actual clean Git head before install/browser setup. The workspace must be the actual Git top-level, and every declared build input must be tracked at HEAD.
- Dependency-cache identity includes the Node pin, package manifest and lockfile. Cached package downloads are not build or test proof.
- Cheap named toolchain contract tests run before dependency/browser setup. A failure remains nonpassing and all required suites receive blocked prerequisite accounting.
- The root build runs before Chromium installation, checks the toolchain, builds existing web payloads and runs existing syntax checks. It records and immediately verifies actual nonempty generated payload paths, byte counts and SHA-256 hashes.
- Build evidence binds the exact source head and Git tree, platform/architecture, Node/npm, complete lock bytes, package manifest, Node pin, Wrangler configuration, web builder and provenance implementation. Explicit PR head identity wins over GitHub's synthetic merge SHA; conflicting explicit identities fail.
- Missing paths, zero bytes, stale generated source identity, changed artifact bytes, changed toolchain, changed lock/config or a dirty source tree fail closed with a classified setup/artifact receipt.
- The workflow retains toolchain/build and required-suite evidence even on failure. It does not use continue-on-error to manufacture a green gate.

The command expects `RELAY_SOURCE_SHA` or `WORKERS_CI_COMMIT_SHA` for an explicit exact source, falling back to `GITHUB_SHA` in hosted workflows. It verifies that value against the actual Git checkout. For local builds, commit/preserve the intended candidate and set the exact head identity; uncommitted implementation work is deliberately not labelled commit-proven.

## Verification

Named offline checks: `node --test --test-concurrency=1 test/release-toolchain-contract.test.mjs test/test-workflow-contract.test.mjs` under Node 22.23.3 / npm 10.9.9. Initial toolchain plus existing workflow checks passed 41 tests. Adding actual Git-head/dirty-source validation brought coverage to 42. One parallel local run exposed the pre-existing 200 ms child-startup fixture deadline under load; serial execution of the identical assertions passed all 42, with no assertion or timeout weakened. Preserve both receipts. After review fixes and real-Git regressions, the final named run passed all 47 tests. Full canonical hosted suites remain required before publication is considered verified.

## Explicit limits and remaining work

This records the generated web/MCP payload files, not the final Wrangler-emitted Worker bundle. Actual workerd/Cloudflare module startup, HTTP health, authenticated behavior, deployment acceptance and the deployed version remain separate proof. Wrangler's existing npx deployment resolution is not newly pinned here. Complete source-to-test mapping, all-stage error classification, large/native source checkpoints, durable release freezes and permission-evidence handoff enforcement remain unfinished.

The source head and lock tie committed inputs to the build; these receipts do not attest arbitrary ignored files or adversarial concurrent filesystem mutation. No native Mac or Windows execution proof is inferred from Linux fixture tests. This slice does not weaken required confirmations or reinterpret a tool/host cancellation label as verified user cancellation.

## Rollback and release boundary

The previous deployed source is 839a8d49236d25e15ba662913b1259dd4267729a. The exact prior bytes of edited paths are retained with the scoped source archive. Publish only a draft PR with complete checks. No merge or deploy is authorized by this slice's implementation request.

Independent review found and corrected a provenance defect: an ignored snapshot beneath an unrelated parent repository could borrow that parent HEAD. Actual-Git regression tests now require the real repository root and tracked build inputs. The review also moved all three canonical builds before Chromium setup.

The existing web builder now consumes the same explicit RELAY_SOURCE_SHA accepted by preflight; WORKERS_CI_COMMIT_SHA remains first, and conflicting explicit values fail before building. This is source-attribution alignment only, with no UI behavior changes.

Remote restoration exposed an inherited test observation race after SIGKILL delivery. The teardown assertion now observes only that exact fixture PID for at most 500 ms: ENOENT or zombie state passes; a surviving process fails and other read errors propagate. New delayed-exit, perpetual-survivor and unreadable-state fixtures verify this bounded observation. No product timeout, suite command, process signal, or required assertion was removed.

Final local validation after the bounded observation correction: 51 passed, 0 failed, with a real running-process negative control. Prior parallel startup-pressure and immediate-teardown-observation failures remain retained as evidence.

## Resumed local Worker gate — October 7

The user resumed the synced PR166 candidate in Mac chat `01a11484-a484-7191-baa7-5e64f424f68b`. Runner transferred the existing assignment to this chat; the original acceptance remains open. The canonical Mac checkout and its handoff archive remain untouched. Implementation continues in the managed `relay-runtime-reliability` worktree from PR head `4e1c38e0f178849a53d20b073d743aff9b4a0752`; its parent remains the rollback for this added slice.

Wrangler is now an exact root development dependency, 4.148.0, with workerd 1.20261006.1 resolved in the lock. Previously installed Wrangler 4.129.0 bundled a September 3 runtime, older than the configured September 29 compatibility date. Existing dependency versions are retained. The toolchain stays Node 22.23.3 / npm 10.9.9.

`npm run verify:runtime` first verifies the existing exact-source web build receipt, then checks installed Wrangler against its manifest and lock pin. It produces a dry-run Worker bundle, hashes every emitted file, and executes those exact bytes without rebundling through Wrangler's official `createTestHarness` API. It requires health JSON, the website's exact source header, and 401/auth-challenge responses from unauthenticated MCP and operator API requests. Bundle and source identity are checked again afterward. Installed workerd must match its lock entry and support the configured compatibility date; the smoke harness rejects outbound requests outside loopback. Each subprocess has a 60-second bound using the existing process-group and diagnostic accounting. Failed startup, missing evidence, mismatched identity and cancellation stay nonpassing.

The gate deliberately uses local R2 and Durable Object simulations and omits the remote Browser binding, production vars, secrets and routes. It does not prove authenticated success, remote storage, Browser Run, Cloudflare deployment acceptance or production correctness. An unfamiliar configuration field requires explicit review rather than silently losing runtime coverage. The generated payload receipt remains distinct from the new bundle/runtime receipt.

Quality CI runs this gate after building and before installing Chromium. Its result and bundle are retained even on failure, and required-suite blocked accounting includes the runtime prerequisite. The existing five suites remain mandatory. Focused contract tests exercise stale identity, wrong health, open MCP/API, missing auth challenge, exact dependency pins and isolated configuration. Local Mac testing does not replace hosted Linux CI; two pre-existing Linux-only process observations are skipped on macOS.

Official API and dry-run references: https://developers.cloudflare.com/workers/wrangler/api/ and https://developers.cloudflare.com/workers/wrangler/commands/workers/ .

Remaining broader scope remains source-to-test mapping, universal/large/native source preservation, full failure-stage taxonomy, approval-evidence continuity and durable release freezes. No merge or deployment is authorized by the resume.

Validation checkpoint: the initial exact-commit Mac build and actual bundled workerd smoke passed. A broader Mac run passed inspector, layout, contracts and web; Runner reported seven Linux-descriptor-only checkpoint errors in unchanged files. This is an explicit platform limitation, not a full-suite pass. The final candidate requires focused revalidation, runtime revalidation and hosted Linux CI before review readiness.

## Early source and named-test contracts — October 7

The next reliability slice starts from verified PR166 head `588e3d65c4d855aba98fba41cc7db85c93d7411b`, which remains its source rollback. The existing assignment and branch are preserved. All five required suites remain mandatory; this adds cheap failure discovery before build, runtime and browser setup.

`npm run test:source-contracts` compares exact base/head snapshots, including both sides of renames and deletions. It parses literal imports, reexports, requires and `import.meta.url` resource URLs with the existing locked TypeScript 5.9.3 compiler. Reverse dependencies retain base-side callers even when a candidate removes an import. `test/source-test-contracts.json` records reviewed non-import links for toolchain/workflow configuration, web-builder inputs and communication fixtures. The graph selects named Node test files; browser imports, compiled modules and generated payload prerequisites are deferred and listed. Reading TypeScript/browser source as fixture text does not require those runtimes.

The receipt binds the exact diff range, clean source/tree/toolchain/lock, manifest hash, parser version, affected paths, selected/deferred tests, unmapped changed paths and unresolved dynamic references. Source identity is refreshed after execution. Named test failures retain their original exit and bounded redacted diagnostics; cancellation, setup failure and missing selections cannot become success. The always-run mapping tests include a real Git/source/caller regression that executes a failing assertion. Its initial negative control exposed Node's inherited NODE_TEST_CONTEXT marker skipping nested --test runs with exit zero; the subprocess clears that internal marker and the identical failing assertion now exits one. CI retains the mapping receipt on failure and accounts for all five full suites as blocked when the prerequisite fails.

This is an early dependency audit, not exhaustive semantic coverage or release acceptance. String-built paths, aliases, nonliteral imports and external runtime links need reviewed edges or later full-suite/runtime checks. Unmapped paths and deferred tests are visible in the receipt. A pre-existing syntax error in unrelated `scripts/evidence-run.test.mjs` is recorded; it is not part of this candidate's changed chain or a claimed passing test. Affected candidate syntax errors block mapping. No existing test assertion is relaxed.

Required final checks for the new candidate: focused graph/toolchain/runtime/workflow contracts; exact-commit mapping/build/workerd gate; hosted Linux quality with all five suites. Mac cannot establish Linux descriptor-based checkpoint behavior. Broader large/native durable checkpoints, full failure-stage classification, authorization-evidence continuity and durable release freezes remain open. Source retention and recovery are separate from temporary transfer expiry. No merge or deployment authority is included.


## Command-stage evidence — October 7

This reliability slice starts from green PR166 head `c6acbcea29c6bcfd9d84c4c22d7fb73f2e7b9193`, retained as rollback. The existing assignment, branch and all five required suites are preserved.

`node scripts/ci-stage.mjs <stage> -- <executable> [arguments]` wraps the existing setup/build/runtime/visual commands with the existing process-group runner. Each job/stage records exact checkout/source identity, lock hash, Node/platform, run/attempt, start/finish, original exit or signal, observed outcome, bounded redacted diagnostic and a hashed log. Source/lock identity is compared after execution. The recorder retains up to one MiB of redacted head/tail output plus a truncation marker, and a separate bounded first/last failure excerpt preserves errors in the omitted middle even when passing test titles later contain “Error.” The complete emitted redacted stream remains in the hosted job log. Existing oversized-line protections remain in force.

Nonzero command exits remain their original codes. Signals remain explicit. Timeout returns 124 and observed cancellation returns 130 even if a terminated process exits zero; the original result remains separate. Process-start failure, command-exit failure, timeout, signal exit, cancellation observation, evidence failure and identity drift have distinct categories. Cause and cancellation actor remain undetermined/unknown. These categories are observed execution states, not automatic conclusions about permission review, user intent, tool-host cancellation or provider responsibility.

All three canonical jobs retain an always-run summary and stage artifact. Explicit workflow outcomes account for bootstrap failures, skipped prerequisites and conditional checks. Missing, stale-source or stale-run receipts cannot turn a successful workflow label into evidence. The existing full-suite orchestrator retains its five independent 15-minute caps; it is not wrapped in a shorter outer test timeout. Existing production/preview conditions, suite assertions and promotion boundaries remain intact. Quality-specific ordering tests now inspect the quality job after other jobs gained stable stage IDs.

Verification includes real child failures at exit 7/11, signals, timeouts with zero-exit handlers, cancellation without actor attribution, missing executables, redaction, bounded head/tail capture, exact medium-log reconstruction, post-command lock drift, missing/stale receipts and all five suite requirements. Hosted quality on the final candidate is still required. Production and preview command wiring can be inspected and tested locally without asserting those normally skipped jobs ran or activating publication.

Limit: a failed checkout/Node bootstrap, artifact-upload failure or hard runner/job cancellation may prevent the finalizer or local artifact from running. The hosted check conclusion and job log remain authoritative for that gap. This slice adds CI command-stage accounting; transport/provider/permission attribution outside CI and large/native source checkpoints, authorization-evidence continuity and release freezes remain unfinished. No merge/deployment is authorized.
