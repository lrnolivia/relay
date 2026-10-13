# current state

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



## GitHub browser bridge failure handling

- `capture.yml` persists every result in `browser-result.json` and exposes `status` / `qa_passed` outputs.
- Browser capacity, HTTP 429, and temporary gateway 502/503/504 states are deferred, with QA explicitly blocked/unverified. A successful dispatch job alone does not prove QA passed.
- Retry metadata and deterministic fallback hints are preserved; no capacity retry occurs before reset and no automatic fallback claims session equivalence.
- Snapshot/screenshot gateway failures get at most one bounded retry when Retry-After is ten seconds or less. Session mutations and uncertain transport outcomes are never automatically replayed.
- Authentication, malformed responses, RPC/tool errors, and failed QA results remain failures.

## Gen 2.1

- evidence controller chooses the cheapest capable engine deterministically
- deterministic recipes use GitHub Chromium; Browser Run is reserved for exploratory/session work
- Browser Run 429s are first-class deferred capacity states with retry metadata and GitHub Chromium fallback
- authenticated external evidence ingest writes GitHub Chromium screenshots into the same private R2 contract
- evidence runs have lifecycle state and grouped step metadata
- `evidence.yml` executes one Chromium browser per suite
- `field.stage0` currently captures Canvas first paint, Full, Focus, and Float against `/qa/work/{projectId}`
- `/builder/noauth` remains smoke-only and is not used by real-project evidence runs


## Gen 2 Wave 1

- Browser Run foundation: implemented on the Gen 2 branch
- Browser binding: `BROWSER`
- evidence store: private R2 bucket `loew-inspector-evidence`
- browser tools: `browser_screenshot`, `browser_snapshot`
- normal Chat compatibility workflow: `capture.yml`
- HTTP inspector remains unchanged as a separate diagnostic path
- Quick Actions limitation is explicit: console errors and failed-request traces are not fabricated
- interactive session tools: browser_open, browser_interact, browser_capture, browser_close
- session state is Browser Run + private R2 metadata, never Worker process memory
- interaction vocabulary is bounded; arbitrary JavaScript is not exposed
- cross-call console/network event history remains marked unsupported because Browser Run does not replay prior CDP event streams to a newly connected client

## verified relay cutover — 2026-09-30

- Canonical gateway: https://relay.loew.fi/mcp, gateway version 0.7.0.
- Auth fix merged in inspector PR #21: c1c84888f581ac985c50a083b202a90070949182.
- 26 repository tests passed in run 36670407075.
- Explicitly deployed Cloudflare Worker version ef55a05c-ab23-4856-9038-6f869d9e5727 at 100%; deployment cd29cc58-23f8-431d-80de-2143f757b813.
- BROWSER, private R2 EVIDENCE and ENCRYPTION_KEY bindings retained.
- Canonical relay protected Runner read: [run 36670686271](https://github.com/lrnolivia/loew-inspector/actions/runs/36670686271), inspector HTTP 200, target HTTP 200, JSON, LOEW_INSPECTOR_RESULT.ok=true.
- Canonical relay protected field read: [run 36670928962](https://github.com/lrnolivia/loew-inspector/actions/runs/36670928962), inspector HTTP 200, target HTTP 200, HTML.
- Access logs confirm relay app → loew.fi private for the Runner test.
- Public relay health returns 200; missing MCP auth returns 401; protected-resource discovery returns 200.
- Source deployment routes aligned in inspector PR #22, merged 852eac42ad7bcfbe79f73f093040270e1191c728. Runtime source unchanged from deployed auth fix.
- Full topology, policies, IDs, probes and rollback are in ../ACCESS_CONTROL.md.

## compatibility and remaining acceptance check

inspect.yml, browser-call.mjs and evidence-run.mjs now use relay.loew.fi, authenticated with the renamed relay-github-bridge service token. The relay app allows that token, and downstream private resources trust relay's linked app identity. No public auth bypass was added.

The old inspector.loew.fi OAuth app, workers.dev transport app, old token and aliases remain deliberately until a **direct normal ChatGPT OAuth MCP tool call** succeeds on canonical relay. The Codex session used for this cutover did not expose relay MCP tools. Workflow/service-token success proves automation and downstream trust; it does not prove the normal-chat OAuth path.

Current Access count: five apps, one reusable policy (Only Me), two service tokens. The old reusable legacy token rule was replaced with an identical app-local rule; field QA uses its local bypass. Seven unused reusable policies were deleted.

After direct OAuth smoke, follow the already-authorized retirement sequence in ../ACCESS_CONTROL.md. Keep relay-github-bridge because current automation still needs it. Disable both workers.dev and preview URLs, align Wrangler source, and remove legacy JWT audiences only in a tested follow-up.

## historical evidence

Earlier normal-chat workflow runs 36296247963 and 36296334657 demonstrated the former inspector GitHub bridge. They remain historical evidence, not proof of canonical relay OAuth tool loading. The old workers.dev route was introduced after Bot Fight Mode challenges; do not infer that this workaround remains the current canonical ingress.

## QA decision

Preview remains runtime truth.

Inspector QA is external verification only. Add checks only where they provide evidence Preview cannot provide by itself, such as Access reachability, status/final URL, origin-vs-Access failure classification, content markers, or later DOM/screenshot parity evidence.
