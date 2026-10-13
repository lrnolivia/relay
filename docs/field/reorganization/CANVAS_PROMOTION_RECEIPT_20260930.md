# Field Canvas consolidation promotion — 2026-09-30

Field PR [#135](https://github.com/lrnolivia/field/pull/135) was squash-merged at 10:14:32 UTC. Tested source head: `57f4765b591286c6c456439ba217d8de282c38c9`. Merge commit: `854038a3e84f41cd590a4ad18b24fcd4127e2fba`. Base: `760774a6bd628827f93190fb0abaf7a6e26acbea`.

## Verified gates

- Registry [36697728462 / 109829617442](https://github.com/lrnolivia/field/actions/runs/36697728462/job/109829617442): success. Clean install, all builds, lint and baseline-aware test gate clear. Branch failures 57; exact-main failures 61; zero branch-only failures; four baseline-only improvements. This does not mean the full suite has zero failures.
- Media/editor and Workers build green at tested source head; Workers build `791a8bc0-9cd1-4c80-8b9e-d3f3e4bed6e7`.
- Immutable Preview deployment `6255045b-1ed2-4cea-81b4-d44d353923c9`; build API returns exact source head.
- Real-project deployed Preview [preflight 36700859927](https://github.com/lrnolivia/loew-inspector/actions/runs/36700859927): editor and Canvas HTTP 200; Canvas first paint; matching Canvas iframe; CORP cross-origin, COOP same-origin, COEP credentialless, Origin-Agent-Cluster ?1.
- Real-project [Stage 0 sweep 36700862882](https://github.com/lrnolivia/loew-inspector/actions/runs/36700862882): Canvas first paint, Full, Focus and Float pass. Persisted run `run_3650ba19-f7ca-4552-9792-f6a761eb3cf0`; captures `vis_1e8faac8-dbae-46ec-a15b-91a4df082193`, `vis_021ba290-0cac-4059-a0bc-1656d4f83bed`, `vis_4218029a-a47c-4795-87ed-c8e24203a4f5`, `vis_0eebaa33-ff5d-437d-8457-582964b91810`.
- Fresh exact-head desktop Frame/Group Chromium tests: 10 passed in 36.4 seconds, no retries. Tests exercise 100×100 click Frames, Space bypass, Group child refit, fixed Frame bounds, Group/Ungroup geometry, Ctrl+Alt+G, encapsulation and wrapping. They do not prove touch/device behavior.

Preview: https://6255045b.field-preview.loew.fi/qa/work/05d8ff47-006f-4293-9190-da0b1391b40c
Canvas: https://6255045b.canvas-preview.loew.fi/

## 1053 classification corrected by independent evidence

Relay Worker fetch returns Cloudflare 1053 for these custom Preview hosts, while direct local HTTP and GitHub Chromium successfully reach the exact deployment. Do not describe this as globally unavailable Preview routing or a Field regression. No domain, DNS, Access or product routing mutation was needed. Preview-only domain flags `previews_enabled:true, enabled:false` are correct per current Cloudflare documentation.

The preflight recorded five aborted asset requests during navigation; Canvas first paint and the subsequent deterministic sweep passed. Production promotion runtime is separate from the tested branch Preview and must be refreshed after merge.

## Remaining work and ownership

Consolidation is not complete. Retain original branches and PRs until code, intent, acceptance, unique merge resolutions and unfinished QA are accounted for. Mobile #123 remains with its existing owner; connected panels stay deferred.

Return the serial shared-file reservation (`package-lock.json`, `CanvasMouseController.ts`, `CameraCommands.ts`) to Mobile after the merged consolidation claim completes. #133's install/Media CI prerequisite is now included in #135; compare exact diffs before retiring that draft. Do not treat preserved source as proof of Mobile QA.

Next: verify current main/production identity after merge, complete Canvas claim with this receipt, then serially admit the preserved Workspace/Dashboard lane against fresh main. Preserve its dirty source worktree and recovery patch; reconcile before applying. Authenticated persistence and applicable exact-head runtime QA remain required for Dashboard. Then continue the original ordered panel, Controls and Assets ledger closeout.
