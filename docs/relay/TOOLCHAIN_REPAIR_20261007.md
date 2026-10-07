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
