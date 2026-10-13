# Relay 1.7 expedited merge and agent-independent handoff

This document is the durable handoff for **any agent**, including agents outside Codex. Canonical source and control authority are `lrnolivia/relay`; production is `https://relay.loew.fi`, MCP `https://relay.loew.fi/mcp`. No Codex memory, hidden conversation, local workspace or paid design generation is required to continue.

## User instruction and disposition

The user added queued assignment `relay-1.7-tool-identity-20260930` to the current design work, then explicitly instructed: **merge everything now, make a handoff, no tests, no verifications**. This is an expedited source snapshot, not a claim that all Relay 1.7 acceptance criteria or production delivery are complete. Do not infer deployed status from a merge.

Assignment and owner: `relay-1.7-tool-identity-20260930`.
Admitted branch: `relay/1.7-tool-identity-20260930`.
Admission captured base `d065ed9c531acfa8692d73eef75ca7eeea16e281`; branch was created by Relay from `d4a946826016224c6dff09bcbfbfe8c71ce69441` after the claim transaction.
The PR containing this document supplies exact final source/merge identity. Look it up by the exact branch, not historical local HEADs.

Earlier assignment `relay-brand-glyphs-20260930` is held and narrowed to `docs/relay/brand-recovery/`, resource `relay-brand-glyphs-recovery`. Its useful uncommitted icon/design code was transferred to the admitted 1.7 branch; its obsolete internal-context-only identity policy must never be shipped. The older local checkout was preserved, not reset or force-pushed. Reconcile its remaining documentation reservation separately after the 1.7 disposition is known.

The separately held `relay-mcp-icon-metadata-20260930` / PR #47 belongs to `codex-relay-mcp-icon-01a0f3f5`. Its files `apps/mcp/index.js`, `apps/mcp/branding.js`, `test/mcp-branding.test.mjs` were deliberately not absorbed. This handoff does not authorize taking over another owner's work.

## Source snapshot being merged

- Shared Terra Prime web/MCP layout, straight sidebar, warm light/dark colors, badges, Orient → Act → Resolve flow, soft shadows and five-color top accent bar.
- Official unchanged Relay, Runner and Inspector PNGs under `apps/web/public/brand/`; parent Relay favicon bundled into the HTML.
- Runner and Inspector named visibly in navigation/context headers; Inspector mark in the floating QA instrument. Existing `#projects` / `#review` routes and MCP/API namespaces remain compatible.
- Service extension version `1.7.0` in `src/relay-entry.js`.
- Heavy rounded shared glyphs with hover/press motion and reduced-motion support.
- Authenticated repository-backed project-icon discovery with bounded credential-scoped caching, safe image data URLs and blob provenance. Relay has an immediate bundled official icon fallback. Icons added to project list, detail, Today, automations, Review and Night Shift; project marks reduced to 28px and unframed.
- Stronger teal selected navigation/project/filter controls and sienna action controls, so highlighted buttons separate from their card surfaces.
- Width breakpoints plus a compact-height style pass and scrollable QA panel body.
- QA autosave sequencing/dirty state and Resolve receipt treatment.
- Production-smoke browser capture/Visuals ingestion support and workflow dependencies are included as source, but were not executed for this snapshot.
- Generated `apps/web/generated.js` rebuilt directly with `node apps/web/build.mjs` so committed source and served shared bundle travel together. No test/check command was invoked at the final expedited checkpoint.

Binary PNGs and generated bundle exceed Relay's bounded text-write capability. Authorized local Git was used narrowly for source commit/push; admission, PR lifecycle and merge use Relay. No history rewrite or protection bypass.

## Design authority and preferences

Figma: https://www.figma.com/design/6hjtD0UcLwU44DPDDrAKht/Terra-Prime-%E2%80%94-Human-Interface-System
Nodes: foundations `4:4`, components/app examples `2:4`, flows `2:3`; reviewed dark app `24:59`, light app `24:200`, decision `9:58`, resolution `9:67`, floating instrument `9:93`.
Superdesign: https://superdesign.dev/teams/72c67edc-160b-4899-8c4a-43e63b517d0e/projects/53fb12b3-0280-476b-903c-0b3f5460f4e7
Selected draft `dace79c8-f692-497c-bebb-71bc186b7381`, version 4. GPT-5.6 version 3 is the composition the user loved; version 4 contains direct finishing edits. The repo source contains newer feedback than the canvas. Update canvas by direct HTML import, **no further paid generation**.

Preserve the selected composition. No illustrations. Do not alter official icon geometry or put extra colored frames around icons. Genuine project/application icons come from registered repositories; never invent replacements. Five accents are teal, sienna, amber, green and coral. Page title is exactly lowercase `relay`. Both web and MCP app must adapt to width and height.

Exact official asset SHA-256 provenance and implementation detail: `docs/relay/BRAND_GLYPHS_TERRA_PRIME_PASS.md`.

## Unfinished work for the successor

1. First read live `contracts/manifest.json`, `LOEW_CHAT_BIBLE.md`, `docs/WORK_COORDINATION.md`, applicable Runner/QA contracts, target bootstrap and current `projects/relay.json` / `coordination/relay.json`. Fresh remote records outrank this handoff.
2. Acquire a recorded owner handoff or renew only as the actual persistent owner. Do not infer that held/expired ownership is free. Continue the same 1.7 task/branch while unmerged; never push to a completed/merged branch. If this snapshot has merged and further source work is required, reconcile the remaining assignment and admit the required follow-up through Runner before opening a branch.
3. Complete Linux icon discovery: read `.desktop` `Icon=` declarations and prefer matching `hicolor/.../apps/` assets. Known inventory: GameBridge `lite/assets/com.loew.gamebridgelite.png` and `lite/icons/hicolor/*/apps/com.loew.gamebridgelite.png`; rtxForge `gui/icons/hicolor/*/apps/io.github.lrnolivia.RTXForge.png` / scalable SVG. Avoid `.../actions/` decorative symbols. loew-shell had no app icon in its observed main tree; use a neutral fallback unless current repository evidence changes.
4. Make glyph motion visibly meaningful; the user explicitly said it was not animating noticeably. Current motion is hover/press only. Preserve reduced-motion support.
5. Finish height-responsive QA/control behavior and compact narrow flow summaries. Final height styles have not been browser-tested. Check supported embedded MCP widths/heights as well as web.
6. Finish the Runner/Inspector presence across relevant project, queue, worker/execution, inspection/visual-QA/evidence/verification surfaces without creating separate products or stores. Current snapshot has navigation/context marks, not a completed every-surface identity audit.
7. Update zero-credit Superdesign canvas to latest five-color bar, smaller icons, visible tool labels, highlighted-button contrast and responsive refinements. Canvas version 4 still predates those final changes.
8. When authorized to resume validation, update browser assertions for visible Runner/Inspector labels, run the necessary workspace/build checks and exact-head Runner admission. Historical pre-1.7 tests are not final evidence. Autosave changes and final navigation need focused regression coverage. Inspect possible stale save-message interaction when closing one review and opening another.
9. Run authenticated exact-source smoke, web and native MCP UI QA, and attach actual Runner Visuals receipts. Source contains smoke support but **no final production Visuals receipt exists for this snapshot**.
10. Publish/deploy only the accepted exact merged source with existing Relay cloud tools and confirm runtime readback. This expedited merge performs **no deployment**. Then complete Runner with the actual same-branch merged PR, exact head/merge identities, durable evidence and explicit remaining-work accounting. Do not mark the whole 1.7 assignment complete merely because this snapshot merged.
11. Reconcile the old held brand recovery claim via its recorded owner/protocol and a proper disposition record. No blind deletion/release. Keep PR #47's owner separate unless an explicit handoff is recorded.

All six consolidation batches are already complete. Do not recreate Runner/Inspector repos, domains, Workers, durable stores, Access apps or old control bindings. Existing useful evidence storage and authenticated controls remain inside Relay.

## Portable execution paths

Prefer Relay MCP `relay_runner_project`, `relay_runner_assignments`, `relay_runner_coordinate`, `relay_runner_preflight`, source PR lifecycle and cloud deployment tools. An agent without Relay MCP can use the canonical deterministic `scripts/coordinate.mjs` / GitHub coordination workflow after reading the current contract; these use the same records and require no AI inference. Normal source changes use admitted branches and draft PRs. Never bypass repository-required checks.

Local preview tooling is `apps/web/server.mjs`; prior preview at `127.0.0.1:4242` was running from the older checkout and **was not restarted/read back at the expedited checkpoint**. Production status is not established by that preview. Rebuild served assets with the dedicated build script; `npm run build` also invokes checks, so it was deliberately not used under the user's no-tests/no-verifications instruction.
