# Historical pre-consolidation record

This document retains historical evidence. Current authority is `lrnolivia/relay@main`, project `relay`, Worker `relay`, web `https://relay.loew.fi`, MCP `https://relay.loew.fi/mcp`. Runtime and retirement truth: [Relay retirement](relay/LEGACY_RETIREMENT.md). Historical hostnames and repository instructions below must not be used for current execution.

# loew.fi access + control surfaces

Updated: 2026-09-30  
Status: Relay SOURCE/CLOUD/Builds and direct authenticated Runner read verified; Worker renamed in place; legacy retirement is separate  
Authority: Runner operational documentation; live Cloudflare/GitHub state outranks this snapshot if they diverge.

## Relay credential and Worker rename closeout — 2026-09-30

- Relay v1.1.0 is live at https://relay.loew.fi/mcp.
- SOURCE uses GitHub App auth, app ID 5133504; authenticated repository reads succeed and SOURCE reports read/write.
- [Inspector PR #30](https://github.com/lrnolivia/loew-inspector/pull/30), merge 53c0bf0556d881969c2701be28de4021f9fcbde9, routes only Workers Builds through CLOUDFLARE_BUILDS_API_TOKEN; other Cloud calls retain CLOUDFLARE_API_TOKEN. Tests and Runner admission passed. Its claim is completed.
- [Inspector PR #31](https://github.com/lrnolivia/loew-inspector/pull/31), tested head 84639addf0e40ed67c77207c2dcc935b54a4a2f9, merge 5648b9147c63f68d34517c31d903a0f8464c5670, aligns Wrangler, cloud fallback/write allowlist, tests and CI triggers with loew-inspector. Tests and admission passed.
- Cloudflare renamed loew-inspector-gateway **in place** to loew-inspector. Worker ID remains 734382bfc38a43cfb8cf9115116ed688. All nine bindings, including all five secret bindings, were retained; no secret contents were read or copied.
- Exact merged source deployed at 2026-09-30T10:20:35.420697Z as version **34**, 7c35957d-2611-4cf6-a849-1fef7752eceb, deployment 22fcad2c-f36b-4411-b7d7-96098ba5dae7 at 100%.
- Custom domains relay.loew.fi, relay-inspector.loew.fi and inspector.loew.fi retain their IDs and point to loew-inspector. Browser and private R2 bindings remain.
- Live relay.CONTROL reports SOURCE github_app/read-write, CLOUD configured, Builds configured, no missing bindings, and write_scripts=[loew-inspector].
- Live relay_cloud_worker(loew-inspector) succeeds; relay_cloud_builds(loew-inspector) returns {"ok":true,"builds":[]}. Empty history is a successful authenticated response.
- Direct relay_verify_fetch_url on https://runner.loew.fi/api/workers succeeds with HTTP 200 and untruncated JSON. This run used direct authenticated Relay MCP tools, not GitHub Actions.
- Historical compatibility/Access retirement below remains separate work; no Access applications, policies, tokens or compatibility domains were deleted in this closeout. The old workers.dev hostname is historical after the rename; current Worker URL is https://loew-inspector.lrnoliv.workers.dev. Do not infer that its old hostname-specific Access application migrated.
- Last-known-good pre-rename version: 33, 641ca585-3aa0-4cf6-9158-d69232757390. Any rollback must align Worker name and write allowlist, not blindly deploy stale configuration.

## Purpose

This document records the canonical naming, current Cloudflare Access topology, relay plugin identity, migration state, and rollback rules for loew.fi control surfaces.

It exists because most of the current Zero Trust complexity grew out of the field pilot and the inspector/runner control path. That history must not become a rule that every loew.fi project needs its own Access application.

## Naming and product boundaries

Human-facing identities:

- `loew.fi` — parent/company
- `relay` — ChatGPT-facing control product and universal handoff surface
- `runner` — execution/orchestration/state backend
- `inspector` — runtime QA/evidence backend

Architecture:

- `loew.CONTROL` — underlying control architecture used by relay
- `source.CONTROL` — source-control subsystem
- `cloud.CONTROL` — cloud/infrastructure subsystem
- `runtime.VERIFY` — runtime/visual/deployment verification subsystem

Human-facing names stay lowercase. The `name.FUNCTION` form is for technical ownership and architectural systems.

Do not rename relay to runner merely because runner executes work. Relay is the surface a user hands work to; runner is one backend relay can use.

## Access applications are not projects

Cloudflare Access applications represent distinct authentication/trust boundaries.

They are **not** a registry of Runner-managed projects.

A new project does not get a dedicated Access app merely because it exists or is registered in Runner. Create another Access app only when the project genuinely needs a different audience, authentication method, trust relationship, or public/private boundary.

This explains why simpler/public projects such as `loewtorials` and `thetake` currently have no dedicated Access application. That absence is not itself a configuration gap.

Field has more Access surface because it was the guinea pig for private editor access, branch Preview, QA routes, inspector verification, and Runner integration.

## relay plugin

Current private ChatGPT plugin:

- product/display name: `relay`
- plugin backend ID: `plugins_6ab77ef4151c819183a37174b69ba08f`
- immutable backend/package name: `relay-github`
- current verified release: `0.4.2`
- current release ID: `pluginrel_6abc909d56a08191a8c55ee583361f2c`
- icon asset: `assets/relay.png` (Relay Loop mark)
- `composerIcon`: `./assets/relay.png`
- `logo`: `./assets/relay.png`

The immutable package name does not define the product identity.

Current skill/system names:

- `loew.CONTROL`
- `source.CONTROL`
- `cloud.CONTROL`
- `runtime.VERIFY`
- `field.OVERLAY` only for legacy field-specific compatibility when Runner still requires it

Some physical skill directories still use older names because Plugin Creator updates overlay files and do not delete old paths. Do not treat the directory names as canonical architecture.

Current implementation note: relay is the product-level router. GitHub/source writes are still proven through the connected Composio GitHub path; Cloudflare may use connected cloud tooling; the canonical MCP endpoint described below is still backed by the inspector gateway. Do not claim the MCP endpoint already aggregates every relay capability.

## Canonical MCP/OAuth ingress

Canonical endpoint:

`https://relay.loew.fi/mcp`

Cloudflare Access app:

- name: `relay`
- app ID: `5a1fef21-95e9-48e2-b9ab-c6f890726285`
- primary domain: `relay.loew.fi`
- compatibility destination retained: `relay-inspector.loew.fi`
- reusable human policy: `Only Me`
- Managed OAuth: enabled
- Dynamic Client Registration: enabled
- ChatGPT redirects:
  - `https://chatgpt.com/connector_platform_oauth_redirect`
  - `https://chatgpt.com/connector/oauth/*`
- access-token lifetime: 10m
- OAuth grant/session duration: 336h

Verified on 2026-09-30:

- Public relay health: HTTP 200, gateway version `0.7.0`, browser binding present.
- Unauthenticated relay MCP: HTTP 401 with Cloudflare Managed OAuth challenge.
- Protected-resource discovery: HTTP 200; resource is `https://relay.loew.fi/mcp`, authorization server is `https://loewfi.cloudflareaccess.com`.
- [inspector PR #21](https://github.com/lrnolivia/loew-inspector/pull/21) fixed the gateway's rejection of the relay Access audience. Merged source: `c1c84888f581ac985c50a083b202a90070949182`.
- Repository CI: [run 36670407075](https://github.com/lrnolivia/loew-inspector/actions/runs/36670407075), 26 tests passed.
- Cloudflare deployment at 04:50:20 UTC: deployment `cd29cc58-23f8-431d-80de-2143f757b813`, Worker version `ef55a05c-ab23-4856-9038-6f869d9e5727` at 100%. All nine source modules came from that merged source; BROWSER, EVIDENCE and ENCRYPTION_KEY bindings were retained.
- [Runner read 36670686271](https://github.com/lrnolivia/loew-inspector/actions/runs/36670686271): relay HTTP 200, target `https://runner.loew.fi/api/workers` HTTP 200, JSON body, `LOEW_INSPECTOR_RESULT.ok=true`.
- [field read 36670928962](https://github.com/lrnolivia/loew-inspector/actions/runs/36670928962): relay HTTP 200, protected field root HTTP 200, HTML body.
- Access logs for the Runner read identify the canonical relay app and `loew.fi private`, both allowed at 04:50:54 UTC. This is evidence of the new linked-app path.

Earlier user-reported OAuth authentication succeeded during the hostname migration. A fresh **normal ChatGPT OAuth tool call** on canonical relay has not been verified in this Codex run: no relay MCP tool was exposed to this session. Service-token workflow success does not prove the ChatGPT OAuth grant/token path. Keep the legacy auth surfaces until that acceptance check passes.

The previous relay health redirect caveat is resolved: `loew.fi private` no longer contains `loew.fi` or `*.loew.fi`.

## Worker custom domains

Current `loew-inspector` Worker custom domains:

- `relay.loew.fi` — canonical product-facing hostname
- `relay-inspector.loew.fi` — compatibility hostname
- `inspector.loew.fi` — legacy hostname

Worker name and Wrangler configuration are now `loew-inspector`; product ingress remains `relay.loew.fi`.

Do not detach compatibility domains until clients and fallbacks have been verified idle.

## Universal private boundary

Cloudflare Access app:

- name: `loew.fi private`
- app ID: `56fc78e2-f03d-4e2b-a7ac-29be9763003a`
- destinations:
  - `field.loew.fi`
  - `runner.loew.fi`

This is the shared private boundary for loew.fi properties that use the same trust model.

During migration it intentionally contains more than the target steady state:

- app-local `Legacy inspector token` service-token trust, ID `925a7ba8-bf40-4b93-a0e4-7c6e1b81a4c7`
- reusable `Only Me`
- linked old `loew-inspector-mcp`
- linked `loew-inspector GitHub transport`
- linked `relay`, app-local policy `Allow relay`, ID `d394d748-be13-48ef-ac71-dbad1d27d66c`

Target steady state is to keep the smallest trust set that still satisfies real runtime needs, ideally human `Only Me` plus relay-linked machine trust. Remove legacy trust only after live verification and traffic observation.

## field QA exception boundary

Cloudflare Access app:

- name: `field-qa`
- app ID: `467df74e-d415-4889-b90a-4a52e3912f24`
- app-local policy: bypass `Public field QA`, ID `bb5c8e99-bfe3-417f-b7b1-95f4f8380a5b`
- the former reusable bypass `Everyone` reference and policy were removed
- destinations include:
  - `field.loew.fi/builder/noauth`
  - `field.loew.fi/assets/*`
  - `field.loew.fi/qa/work/*`
  - `canvas.field.loew.fi/*`
  - `preview.field.loew.fi/*`

Keep this while it is the proven public-path exception mechanism.

After `field-access` was removed, external probes verified:

- `field.loew.fi/` remains protected by the universal private boundary
- `field.loew.fi/builder/noauth` remains reachable without Access authentication (application currently returned 404, which is an origin/app response rather than an Access block)
- `canvas.field.loew.fi/` returned 200
- `preview.field.loew.fi/` returned 200

Do not collapse `field-qa` into another app until the exact public-path behavior is proven under the replacement configuration.

## Legacy compatibility paths still in use

### old inspector MCP

- app name: `loew-inspector-mcp`
- app ID: `c6f650d8-2f90-481f-bd1d-3ea1710c36de`
- domain: `inspector.loew.fi`

Keep until the canonical relay MCP has completed a real authenticated inspector call and dependent clients have moved.

### GitHub transport

- app name: `loew-inspector GitHub transport`
- app ID: `e03969b6-ecb4-40d5-b66d-c11ac91ce7a1`
- domain: `loew-inspector-gateway.lrnoliv.workers.dev`
- service token ID: `fdb21fea-0b00-4672-9c63-40a07d4a6a62`

This is a retained legacy ingress, pending the normal ChatGPT OAuth gate. Current GitHub automation has already moved to relay.

A historical seven-day query showed 199 authentication events for this app. That is historical usage, not proof that current workflows still use workers.dev. inspector PR #20 moved inspect.yml, browser-call.mjs and evidence-run.mjs to relay; the subsequent relay workflow test is now green.

The service token was renamed `relay-github-bridge`; keep it after deleting this legacy Access app because the canonical relay app still uses it. This architecture intentionally retains one automation service token.

## Removed redundant applications

Removed 2026-09-30:

- `runner-access` — ID `6e1fdcaf-fc90-4232-a07a-11df984d4eab`
- `loew-runner` — ID `ec330c27-6c33-425d-9a8a-3f6c1523c769`
- `loew-runner - Cloudflare Workers` — ID `5d54bda7-e928-4efe-899e-07e13eae410f`
- `field-access` — ID `428ef374-dae0-4c25-8ca8-460e6851bf91`

The three Runner-specific apps had no recent Access events in the inspected seven-day window and were already covered by `loew.fi private`.

`field-access` had historical traffic, so it was removed only after the broad private boundary and `field-qa` paths were re-probed and showed the intended protected/public split.

Do not recreate these apps just because an old note, screenshot, or handoff names them.

## Reusable policies after cleanup

Only `Only Me` remains: `8aeefda8-a1e1-4eda-a4b4-a8402a136f0e` (three app references while old inspector OAuth remains).

Deleted after immediate zero-reference checks on 2026-09-30:

- `loew-inspector` — `6a71b7ef-1b7c-4ba5-bc79-dd22c1db17a5`
- `Cloudflare account members` — `6b229391-724f-490c-8ebd-90f7dc4001a5`
- `Everyone` (bypass) — `0ebe135b-5c56-4f17-aacc-5e03a27212dc`
- `Everyone` (allow) — `01bb0c39-5424-41ad-9ce3-75dd2854dcdb`
- `field-qa-temporary` — `a4590326-217d-4e50-b123-121a290881f7`
- `One Time Pin` — `ffa071bf-eed5-47a8-b0b9-d3e7bf4d2e2d`
- `temporary-public-wa` — `01931b25-0227-436c-87dd-9065b503946c`

Before detaching the reusable legacy token policy, an equivalent app-local policy was created and its decision/include/exclude/require rules were compared. This preserves compatibility without global policy clutter. QA likewise retained its pre-existing equivalent local bypass.

## Legacy service token

Old service token:

- name: `loew-inspector`
- token ID: `af1bebf5-cdce-4ee0-9faa-7ab21a2c1d09`

Do not remove until its reference count is zero and downstream access has been proven through relay or another approved replacement.

## Safe migration rule

All Access/control migrations use an additive-first sequence:

1. snapshot live applications, policies, service tokens, Worker domains, and relevant traffic
2. add the replacement hostname/app/trust path without removing the old one
3. verify DNS/Worker routing
4. verify OAuth challenge and discovery
5. authenticate the real client
6. run an actual end-to-end tool/action through the new path
7. verify downstream protected resources
8. inspect Access logs to identify which app and transport are actually in use
9. remove one redundant/legacy layer at a time
10. immediately re-probe the affected protected and public paths
11. delete service tokens/policies only after references are zero
12. detach legacy Worker domains only after clients are moved and fallback traffic is absent

Temporary duplication is preferable to an outage.

## Recovery / rollback

If a migration step behaves unexpectedly:

- stop deleting
- refresh live Cloudflare state rather than trusting this document
- compare the failing path with the last-known-good compatibility path
- restore/add trust before removing more configuration
- use `inspector.loew.fi/mcp` or the GitHub transport as compatibility paths while they still exist
- preserve app IDs, policy IDs, service-token IDs, and hostnames in incident notes
- distinguish Access-layer failures from Worker/origin/product failures
- query Access logs before concluding an app is unused

A successful API write is not sufficient proof. Re-read configuration and probe the actual hostname/path.

## Desired steady state

The long-term shape should stay small:

- `relay` — one canonical ChatGPT-facing OAuth/MCP control identity
- `loew.fi private` — one shared private boundary for properties with the same trust model
- narrow exception apps such as `field-qa` only when a genuinely different public/private policy is required
- no per-project Access application by default
- no legacy service-token or bridge layers once direct replacement paths are proven and idle

The goal is simple shared infrastructure, not symmetry for its own sake.

## Final audit and remaining gate

Current audit: **5 Access apps, 1 reusable policy, 2 service tokens**. The five apps are relay, loew.fi private, field-qa, old inspector MCP and old GitHub transport. No broad wildcard destination remains.

| Unauthenticated route | Observed status | Classification |
| --- | --- | --- |
| relay /health | 200 | Public health works |
| relay /mcp | 401 | OAuth required |
| field root | 302 to Access | Protected |
| runner /api/workers | 302 to Access | Protected |
| field /builder/noauth | 404 without Access redirect | Origin route absent; auth bypass works |
| canvas.field.loew.fi | 200 | Public |
| preview.field.loew.fi | 200 | Public |
| loew.fi, thetake.loew.fi, loewtorials.loew.fi | 200 | Public |

### Next authorized action

In a fresh normal ChatGPT chat with relay v0.4.2 enabled, request:

> Use relay's direct MCP fetch_loew_url tool to read https://runner.loew.fi/api/workers. Authenticate if prompted. Report target status and JSON. Do not substitute GitHub Actions for this OAuth test.

Record the exact tool result and confirm canonical relay ingress. A source-control or Cloudflare action through Composio alone does not satisfy this gate.

After that succeeds, perform the already-authorized retirement:

1. Remove private app policies `c9cffb9c-9b32-4faf-acf1-720af5cfdb68`, `eb0289df-8d22-4b09-aa21-3a656bd80fff`, and `925a7ba8-bf40-4b93-a0e4-7c6e1b81a4c7`. Keep Only Me and Allow relay.
2. Re-run protected Runner and field reads.
3. Disable workers.dev **and preview URLs** for loew-inspector, then delete old GitHub transport app `e03969b6-ecb4-40d5-b66d-c11ac91ce7a1`.
4. Remove the legacy inspector custom domain before deleting its Access app, so it is not briefly left public; delete old MCP app `c6f650d8-2f90-481f-bd1d-3ea1710c36de`. First verify remaining clients no longer use it.
5. Delete token `af1bebf5-cdce-4ee0-9faa-7ab21a2c1d09` only after fresh reference checks. Keep `relay-github-bridge` token `fdb21fea-0b00-4672-9c63-40a07d4a6a62`.
6. Remove relay-inspector alias only after clients are confirmed migrated. Update relay Access destinations and Worker source routes together.
7. Set `workers_dev:false` and `preview_urls:false` in wrangler.jsonc; keep canonical relay route. Remove the two retired gateway JWT audiences in a tested change.
8. Re-probe public/protected paths, rerun the workflow and normal-chat tests, and update this document.

Current source routes were aligned in [inspector PR #22](https://github.com/lrnolivia/loew-inspector/pull/22), merged `852eac42ad7bcfbe79f73f093040270e1191c728`. It adds both relay routes alongside the legacy inspector route; workers.dev remains enabled deliberately until retirement. Runtime JavaScript is identical to deployed c1c8488.

### Worker rollback

Previous deployment: `2f1a7e52-8e74-41c1-85a3-ebe89da4eae3`; previous Worker version: `6a605b6e-33b8-40dc-b119-35fe088dc1a7`. It lacks relay audience support, so rolling back restores old compatibility behavior but will break canonical relay again. Prefer repairing the evidenced auth defect rather than assuming the old version is relay-capable.

Do not restore deleted unused reusable policies as a default recovery step. Their former needed behavior is preserved by app-local policies; restore a specific policy only if new evidence requires it.
