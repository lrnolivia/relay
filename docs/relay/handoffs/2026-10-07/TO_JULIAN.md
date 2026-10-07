# Relay continuation handed to Julian

Prepared 7 October 2026 by **RELAY Dev 10/7**, owner `01a11484-a484-7191-baa7-5e64f424f68b`, for **Julian**, thread `01a1146d-0267-735e-8332-fa38cf7fb007`. This packet preserves work; current Relay records determine ownership and admission. A transfer or message is not proof that an internal executor started.

Lauren's direct instruction in the sending chat is: **“i'm passing the rest of your work to Julian to run on internal work. prepare what you must.”** Product implementation stopped in the sending chat. Julian may organize the remaining authorized work internally; preserve actual owner/executor identities and use current supported admission rather than inventing another assignment system. Existing authorization includes “push and merge and continue” and using local source/Git/GitHub tools while updating Relay. No new credentials, spending, access grants or protection bypass are inferred.

## Start here

1. Refresh `LOEW_CHAT_BIBLE.md`, `contracts/manifest.json`, project `relay`, assignment `relay-mcp-rebuild-continuation-20261003`, inbox/context and current branch/PR inventory. Read the applicable role and QA contracts. Continue **the same assignment and branch `relay/mcp-rebuild-20261003`**. Check the final CAS transfer receipt; do not impersonate the previous owner.
2. Read [manifest.json](manifest.json), [preserved acceptance](acceptance.md), the [original execution handoff](https://github.com/lrnolivia/relay/blob/dbe7904787503dc04a115e0157638d5c23443012/docs/handoffs/2026-10-03/RELAY-MCP.md) and its sibling original-contract/reflow evidence. Historical statements about CTRL PR7, the old Mac identity or engine limitations are provenance, not current facts. The full original rebuild remains unfinished.
3. Recover the exact pushed handoff commit in an isolated checkout outside `~/Repos`. Verify the manifest hashes. Product files must match the verified release below; the additional handoff files do not establish a new deployed release. Preserve the existing draft documentation PR and account for it before another product batch.
4. Refresh admission and rescope exact paths before the next source edit. Next product slice is the typed human-language foundation after checking that a current quota failure is not blocking it. Audit affected fixtures, callers and generated consumers before expensive CI. Verify each coherent batch before advancing. Files interface integration stays **last**.

The sending managed checkout is `/Users/lrnolivia/.codex/worktrees/relay-runtime-reliability/relay`. Its product source was tracked-clean at release `1b949160cd43e879efbf405da52f6333ffa61843`; only local `qa-evidence/` was untracked before this documentation packet. No product patch or coding process is left running here. Keep this checkout until the successor has verified recovery; local QA receipts are supplementary, not the only source copy. Preserve the older canonical checkout and its unrelated local files.

## Verified release, evidence and rollback

Canonical repository is `lrnolivia/relay`, runtime/MCP `https://relay.loew.fi/mcp`. The latest independently verified product release is **`1b949160cd43e879efbf405da52f6333ffa61843`**, tree `a3655affe1779d0e5a76937ee325447d70ea8639`, merged [PR 175](https://github.com/lrnolivia/relay/pull/175). Its reviewed head is `b9f5aa9262d34703198578de502a78eddb806092`. A fresh read at 09:07 UTC found newer main `68cfa42d0ce4b42743e43918b192015a60bab319`; its difference from the release is coordination JSON only. Refresh again before integration or release.

PR 175 rejects unsupported protected execution before capability advertisement, a new lease, CLI-version reads or child start. Linux descriptor protection and legacy execution remain supported; existing uncertain operations are reconciled first. It does not make source protection work on macOS or Windows. The injected Windows fixture is not native Windows execution.

Evidence already verified for that exact source:

- 13 supported Mac executor/legacy checks and 15 source-map checks passed, plus the actual bundled Worker under local workerd. The complete Linux-descriptor suite is intentionally run on Linux, not represented as passing on macOS.
- [Hosted quality run 37594693262](https://github.com/lrnolivia/relay/actions/runs/37594693262): all five required Linux suites, source contracts, runtime and ten context-card captures passed. Nine stage-log hashes and capture readback/local hashes were verified. [Admission run 37594693250](https://github.com/lrnolivia/relay/actions/runs/37594693250) passed.
- [Main run 37595323077](https://github.com/lrnolivia/relay/actions/runs/37595323077): all five quality suites, authenticated exact-source production, retained captures and the service-private Files rename/delete/restore lifecycle passed. Four production and four retained capture hashes and fourteen successful stage logs were verified. Manifest retains the compact receipts and production Visuals IDs. Hosted logs/artifacts have provider retention limits; durable Visuals receipt IDs and Git source are separate evidence.
- Observed by 08:49 UTC: Workers Build `dfdc4f9e-8424-4001-9783-05467feb1e79` succeeded at release source; deployment `24accc92-b05c-40d7-b3cb-0ca9c0a588ae`, version `822badf0-7c27-47bb-a449-e29c74b163ee` at 100%, created `2026-10-07T08:40:53.491842Z`. Web digest `f1f353e16f2638c33b1ce0365a9ca5385be4781faf062239e8ed4c8df05c2702`. These are timed observations, not continuous monitoring.
- The three PR 175 source/doc files were independently fetched from GitHub, restored into an isolated directory and hash-compared. Merged bytes matched. The handoff packet receives separate remote readback and incremental restoration verification; see the final Relay context receipt.

**Rollback baseline is release `1b949160cd43e879efbf405da52f6333ffa61843`.** For a later failed slice, revert only that coherent change through a reviewed PR and normal exact-source gates. Do not reset the shared branch, replay old coordination JSON or discard later work. Preserve existing source-checkpoint objects and Files metadata/tombstone readers. A blanket rollback to pre-Files backend could unhide deleted files or remove rename presentation. Word-formatting rollback should disable the additive presentation slice while preserving the machine protocol and data.

Reproduction uses the existing lockfile, Node **22.23.3**, npm **10.9.9**, Wrangler **4.148.0**, workerd **1.20261006.1** and Playwright **1.60.0**. Lock SHA-256 is `302f01f74eef065ae1bea00a1fe6d0922b8cc60fe181e36ecd1c1e7ae24aa034`. Use `npm ci`, focused checks, `RELAY_SOURCE_SHA=<exact full committed SHA> npm run build`, and the existing Worker-runtime verification command. Do not use the Mac's default Node 26 for release gates. One canonical hosted Linux pipeline per new source candidate; required main runtime gates remain distinct.

## Remaining batches, in agreed order

### 1. Reliability and stale-test prevention

Toolchain pinning, source/test mapping, suite aggregation, stage logs, actual Worker startup and PR 175 platform admission are delivered. They do not prove every semantic test expectation is current. Continue this discipline in every subsequent batch: inspect changed callers, fixtures, selectors, generated resources and protocol contracts first; update only assertions made obsolete by approved behavior, preserve real coverage, and distinguish harness defects, baseline failures and product regressions. Do not repeatedly discover predictable stale fixtures through full CI or lower the bar for a pass.

### 2. Human-language foundation — next product slice

[human-language-proposal.md](human-language-proposal.md) is a byte-exact copy of Lauren's supplied **Relay human-language contract.md**, SHA-256 `4a4a119d0b5414d2c970297fa086ac82ff7bd3be49cfd125f20ed5ea114381e8`, Library `libfile_3adfc8a6abc08191af5e6491fdb2f90b`, version 0. The proposal is source-grounded design input, **not shipped code or independent authority**. Its historical P170/UI839/CP findings must be checked against current source. Julian's verified human instructions authorized pushing it with the workflow fixes and starting the agreed ordered work.

Use a deterministic typed catalog/normalizer and formatter, without an LLM runtime. Add `human_v1` alongside legacy `human`, structured results and JSON text; preserve HTTP/JSON-RPC semantics, auth headers, errors, permissions and identifiers. Typed operation/outcome/mutation/next-action/evidence/retry states must determine wording. Never infer success from HTTP 200, drop pending QA because a PR merged, promise a scheduled retry from eligibility alone, or invite a second mutation before reconciling an unknown outcome. Preserve last good partial/stale data and redact/allowlist technical evidence.

First bounded slice: common errors, context-card formatting and legacy compatibility with fixtures for quota deadline, unknown mutation, partial refresh, merged-but-QA-pending and upload before a retained manifest exists. Cover pure formatting, current producer/consumer compatibility and generated browser/Worker resources. Broader catalog/surface registration follows deliberate review; `contracts/human-output-surfaces.json` is proposed, not currently implemented or admitted.

Read-only current-source findings to verify before editing:

- Extend `src/communication-presentation.js` and its existing tests/evals instead of creating a competing presentation system.
- `src/relay-chat-ui.js` has server `contextCardModel`, `compactContextCardResult` and a static generated `BROWSER_CONTEXT_MODEL`. Current technical-note regex changes next steps; merged PR inference can drop pending actions; PR/check presentation can override blocked/error tone; compact errors lose retry classification. Audit the existing tests before changing expectations. Resource identity is `ui://relay/context-card/v15.html`; preserve normal-host behavior and actual rendering requirements.
- Bundled function serialization can acquire workerd/esbuild `keepNames` helpers. Existing production-model tests cover this. `apps/web/build.mjs` imports generated brand assets; avoid a new build cycle or toolchain when sharing formatter code.
- `src/index.js` has direct Runner-control and generic JSON/structured-result paths. Register typed operations explicitly; do not replace all JSON content with prose or infer operations by tool-name regex.
- Shared Files client has generic sign-in/resume and retained-chunk claims that need actual typed upload state. Do not treat pre-manifest bytes as recoverable. Future Files UI features remain batch 6.

### 3. Remaining GitHub quota and review reliability

Shared caching, concurrent-request coalescing, ETag/304 support, typed quota errors and website deadline/cooldown/reload suppression shipped in preceding releases. Live attribution of calls/cache hits, authenticated conditional-304 quota proof, reducing review storage's fresh GitHub lookup dependency without weakening authorization, and refreshing only affected projects remain open.

The captured `/api/work-review` 403 identified exhausted GitHub installation **166454233** quota. After reset the same CTRL 22-assignment read returned 200 and valid null review records. The separate 404 is **unreproduced**; do not claim missing initial records caused it. Capture its exact request/body/route separately. Last quota header snapshot at 06:56 UTC is stale and must not be used as today's allowance. Move quota work ahead of wording only if a fresh active failure blocks work. Respect the actual reset/backoff; new tokens for the same installation do not reset its shared allowance. Independently authorized local Git/gh transport is allowed by Bible section 4.1, but does not bypass authentication, permission, account-wide limits or denied identity.

### 4. Real execution and recovery acceptance

Existing source protection is opt-in Linux only, bounded to 128 KiB total, 64 entries and 192 KiB serialized, with initial-head recovery binding. Large/native/root/commit-changing cases and retired-owner handoff recovery are not proven and may be unsupported. Approval-evidence continuity and immutable release-candidate freeze require an audit against the current broker/admission behavior before adding only necessary machinery.

Real installed coding execution, capability-based local/remote routing, skill installation and in-run consumption, actual Night Shift away-time work, independent oversight and idempotent Shift handoff need real environment receipts. Fixtures and documentation do not close these gates. Refresh host capability and existing authorization; no new credential or spending authority is supplied.

### 5. Consumer and review acceptance

Worker-authored feedback save, explicit acknowledgement and same-modal readback have historical evidence. Actual owner preview → feedback → incorporated fix → verified live version, native installed actions and ordinary ChatGPT web/macOS/iPhone/Linux parity remain separate acceptance. Verify the requested surface: website, work-item cards and conversational MCP UI are distinct. Skills installation/execution and authorized relationship curation also require actual use evidence, not only catalog presence.

### 6. Relay Files interface — last

Backend rename, soft delete and restore already shipped in PR 173/174 and remain proven at PR 175 production. Human account identity hash is unchanged. Signed service identity is separately scoped, without Access-policy or Origin weakening. Capabilities are advertised; rename is ready-only; delete hides files and returns 410 across read/write paths; restore is supported only until original expiry. Metadata CAS retries are bounded; content/hash/original 72-hour expiry do not change. This is temporary private transfer, not permanent backup or a new Trash system.

CTRL [PR 30](https://github.com/lrnolivia/ctrl/pull/30) merged at `81648924c9949f76745dc103a49f1c027f7484ac`, candidate `ad7bb982ee6eefd5e80d15393fca574bcfeec8d8`. Merge identity was independently confirmed; its authenticated human desktop/390px UI and cancel/focus checks were reported by CTRL's worker, with no human file mutations. Refresh current CTRL main before importing. Relevant files include shared file-manager JS/CSS, glyphs, browser/proxy tests and worker proxy routes; copy only applicable dependencies into Relay's established architecture. Relay's current shared client still has Download/Resume, so this UI remains unfinished.

Preserve Relay's Sienna accent, the approved 8px spacing/padding, Files in the main body and the approved separated control hierarchy. Add ready-only rename, destructive confirm/cancel/focus, actual soft delete/restore deadline/Undo, honest unknown outcomes and responsive authenticated browser checks. Request a CTRL assignment only for a real newly discovered downstream change; no duplicate CTRL worker or automatic launch. Two real human-account mutation isolation was not performed here; signed runtime/workerd and service-private lifecycle proof must not be mislabeled.

## Deferred and separate ownership

[screenshot-evidence-proposal.md](screenshot-evidence-proposal.md) is Lauren's exact supplied planning document, SHA-256 `2da2c8407f24945e2926e0c582c5e8851fe45c7c27f65af48f3ce91ef10753cf`, Library `libfile_ec0bb87065dc819184bcd26d008cd68a`. Its queued assignment `relay-screenshot-evidence-plan-20261007` is planning-only and needs explicit future implementation approval. This transfer does not activate it. Stream/video work, purchases and new automation are outside this handoff.

The approval-friction audit and coordination-cleanup audit retain their separate queued owners. The expired/missing-branch production-smoke claim retains its reservation; no takeover or blanket cleanup is authorized. Preflight reports historical unregistered branches. Old open PRs and recovery branches remain provenance; do not close/delete them without ownership and work accounting.

Relevant durable Relay Context: original ordered plan revisions 15–18, inbox acknowledgements 22–24, corrected order amendment 25, exact release receipt 26 (`ctx_368faee36e7dba1822f20d38a272bcc591f222def1bf8ba4444f4a0a140e5856`). Read with pagination returned by the tool; a blind offset 20 previously looked empty even though the entry was present in the first page. Reading is not acknowledgement. Record new CAS-backed recovery, handoff and successor-admission receipts without rewriting earlier evidence.

## Transfer completion boundary

The final Relay context/coordination receipt will identify the published handoff commit, remote restoration verification and owner transition. This packet deliberately does not guess that future receipt. The successor must acknowledge receipt and verify source/admission before internal execution. Preserve full acceptance as open; this documentation PR is work preservation, not rebuild completion or a new runtime release.
