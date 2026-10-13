# Authenticated GitHub response preservation

This is the separately committed six-file transport repair in the current MCP rebuild assignment. It fixes a reproduced identity-switching bug that can obscure a missing branch404 with a later anonymous403. The real Field transaction's first upstream endpoint/status remains unproven; this repair does not retrospectively label that failure a false permission denial.

## Admission and authority

Assignment `relay-mcp-feedback-routing-20261001`, actual owner `01a0f914-aad0-71e4-8f0c-20c1bf0a2016`, branch `relay/mcp-feedback-routing-20261001`, draft PR113. Parent verified supported rescope commit `3d3ef037bc9f0f7703ce08dbffed84f174debe9f`, adding four paths to the prior17 (21 admitted) and resources `relay-source-authenticated-reads`, `runner-retirement-verification`, `relay-provider-error-provenance`. Existing Runner-control paths were already reserved by this assignment, so no competing branch/claim was created. Fresh readback confirmed21paths and7resources; preflight passed before edits.

The separate acceptance amendment initially failed. Original acceptance remains preserved; the repair authorization and requirements are in the verified rescope next_action and explicit parent handoff. Do not claim that unsuccessful amendment was committed.

Lauren authorized the current agreed feedback update and disclosed handoff-check repair to merge/automatically deploy after final tests and independent review. Website111's production verification and completion receipt were supplied by Julian. Release still requires fresh review of the revised exact head and serialization through the established Git-native flow. No unrelated PRs, credential/grant changes, permission bypass or old-branch reuse.

## Reproduction and behavior

Prior canonical source blob `38b60ca19a1e840f00b5affe11c77066e650c7dc` wrapped token acquisition and the target resource request in one catch. Every read404 fell through to legacy or anonymous access, including404 returned after obtaining an installation token. An isolated mock of the actual source reproduced installation success, authenticated ref404, anonymous ref403 and a final reported403. A separate authenticated403 correctly made no fallback. Ordinary installation-discovery404 retained public reads. The mock used generated synthetic signing material and no live GitHub/Field request.

The repaired source separates acquisition from resource access. Once an authenticated transport is selected, its404/401/403/429/5xx/timeout propagates without a legacy/anonymous retry. Ordinary read-only tools retain supported public fallback specifically for an installation-discovery404; token-mint failures and writes never justify that fallback.

Retirement's branch read passes internal `requireAuthenticated: true`. This is a server-selected transport requirement, not a new tool argument or grant. Existing GitHub App and legacy-token transports remain supported. No configured authenticated transport fails before any anonymous ref request. Installation discovery and token mint failures propagate with their phase and cannot establish branch absence. The retirement guard still accepts only404, and rejects acquisition/public404 provenance. Existing trusted local/API override executors retain their authenticated transport contract; no live CLI alternative was used.

## Diagnostics and permission boundary

Source failures carry bounded GitHub provenance: original HTTP status when available, method, endpoint without query, phase and authenticated transport kind. Runner exposes only allowlisted values; raw provider messages, headers, tokens, bodies and unknown fields remain redacted. Phase distinguishes `installation_discovery`, `token_mint`, `resource_request` and `auth_selection`.

An ordinary403 remains permission failure.429 or403 with explicit zero remaining quota is classified `rate_limit`, retaining original status and available numeric reset/retry information. Rate-limit errors are not automatically retryable; wait for the recorded window, refresh state and reconcile any uncertain write. No identity switching or browser-capacity label is used on this Runner path. This bounded repair does not claim to fix every historical error normalizer elsewhere in Relay.

## Validation and release gates

Targeted mocked tests cover authenticated ref404 (including cached token and configured legacy fallback),401/403/429/5xx/timeout without alternate identity, ordinary public discovery, guarded discovery failure, token-mint404/403, legacy authenticated404, no-credential zero-request lookup, rate-limit provenance/query redaction, retirement's authenticated flag, acquisition/public404 zero-write rejection, true authenticated404 acceptance and unchanged ownership/head/CAS/drift/replay guards. All coordination writes in tests use disposable memory fixtures.

Run required full tests/build/typecheck and packaged Worker proof at the revised head. Request focused independent review of this separate commit and regression confirmation of the prior feedback changes; prior PR113 approval does not automatically cover this repair. Exact-head CI/admission and approved Git-native production source/build/version verification remain release gates.

Local validation passed: all369 repository tests (271 Inspector/source,58 Runner,3 layout,17 contracts,20 web), build and web typecheck. The actual Wrangler dry-run Worker was executed with synthetic authentication and mocked GitHub: authenticated branch404 produced one memory-fixture transition and one ref read; authenticated403 produced zero writes; installation-discovery404 produced zero writes and zero ref reads. Every scenario made zero anonymous requests. Separate packaged feedback proof preserves59 tools, classification schema and original diagnostic envelopes. These are isolated proofs, not live Field retries or production acceptance.

The paused Field operation remains pending: `field-consolidation-workspace-20260930`, owner `01a0f989-2e52-701b-a57c-009bedceb014`, successor `field-mobile-integration-20261002`, operation `field-dashboard-to-mobile-20261002-0008`. No live retirement retry, record edit or completion assertion occurred in this repair. Only after the repaired runtime is released and verified may the authorized Field operator reassess a same-path retry using fresh canonical owner/record/head evidence and the supported connector/schema. Genuine denial still stops the operation; no CLI/anonymous workaround.

All feedback acceptance and unresolved MCP program criteria remain: ordinary ChatGPT card failure; original Mac Work connection/action PASS with historical timeout; remaining iPhone/Safari/same-build/new-comparison observations; unverified native delivery; legacy visual review/event dual-write and later feedback disposition work. No live feedback report or acknowledgement was submitted.
