# Staff-led Relay cards — draft implementation

Assignment `relay-staff-led-cards-20261030`, branch `relay/staff-led-cards-20261030`. Draft review only; merge and deployment are outside this assignment.

## Direction contract

The approved direction makes the staff member who owns the current recorded step the card's first read, with a small team emblem and a project badge. A routing lead is explicitly labeled **Assignment lead**; a team-only card is equally valid. One assignment owns one ordered checklist across machine or staff handoffs.

This extends the existing Terra Prime telemetry family: Momo Trust Display, Inter, graphite layered surfaces, recessed real-record rings, neutral explanatory text and accessible accent headings. It preserves intrinsic inline sizing and explicit fullscreen screenshot inspection. Desktop and narrow cards share the same evidence and actions, with responsive composition. First observation settles; observed numeric changes use 680ms cubic-out interpolation. Calm, reduced-motion and hidden-document states settle ongoing motion.

The finish condition is a reviewed, tested draft with every shipped portrait tied to approved canonical identity and provenance. Pending asset approval and unverified production integration remain explicit.

## Exact design sources

- ctrl `e0f931e38f1cf70011822549acbfebbdf25fecad`: `packages/shared-ui/{tokens,control-center,telemetry,polish}.css`, `TelemetryMosaic.tsx`, `MetricTiles.tsx`, `ProjectBadge.tsx`, `useTelemetryMotion.ts`.
- Team emblems: Figma `1HWvmmJIxAfU6rmnuRaePt`, node `147:158`, fourteen exact exported dark/light SVGs. Library `libfile_dbfb4217ebc081918f9aaa834c4fa2a5`; SHA-256 manifest is in `assets/teams/manifest.json`. The source set was inspected as rendered pixels in Figma.
- New avatar-base/card-stroke rule: identity-file `VariableID:2:7` (`icon/color/border`) aliases `VariableID:9f4c5db60f3d5bf27147f2e9789a38d1c482345f/530:9` (`color/border`), whose two modes both resolve to `#3d3935`. The same numeric variable ID in a different Figma file is not the same token.
- Preview PNGs are direction, not production token or pixel specifications. No preview colors were sampled into production CSS.

## Implemented visual rules

The implementation source is `src/relay-context-card-style.js`, with identity selection in `src/relay-card-identity.js` and evidence projection in `src/relay-card-steps.js`. These are observed rules for this card extension, not a replacement Terra Prime system. Permanent handoff documentation stays in `docs/relay/`; root `DESIGN.md` and `.impeccable/` are outside this assignment's admitted scope.

The card's reused CSS tokens are exact, with light/dark mode values below. The border and avatar container use the shared `--stroke` value documented above in both modes. Exported team SVGs retain their own exact source colors.

| Role / token | Light | Dark |
| --- | --- | --- |
| Card / `--surface` | `#fafaf7` | `#1c1b19` |
| Recess / `--sunken` | `#f0efeb` | `#211f1d` |
| Raised detail / `--raised` | `#fff` | `#292724` |
| Main text / `--ink` | `#222220` | `#f2f1ee` |
| Explanatory text / `--muted` | `#686862` | `#c2c1bb` |
| Engineering, Reliability, passed / `--good` | `#16794e` | `#3bcb8d` |
| Release, failed / `--bad` | `#b3283e` | `#ff6f78` |
| Planning & Research, Knowledge, waiting / `--wait` | `#8d6900` | `#ffca28` |
| Design & QA, Integrations, information / `--info` | `#087a88` | `#18afc0` |

**Identity color follows identity.** The staff heading follows the selected identity's team, independently of the card feature accent. Nico therefore keeps the Engineering green heading when the card displays CI. A valid current-step receipt naming a staff owner takes priority; otherwise the routing lead is labeled Assignment lead, or the card presents a team update. A portrait or routing label never supplies execution evidence.

Momo Trust Display sets the staff heading (400, 24px/1.15) and main metric (400, 34px/1.05). Inter sets the explanatory body (13px/1.5), task headline (600, 16px/1.35), labels and actions. The card has a 24px radius and 20px padding; the sculpted telemetry recess has an 18px radius, 14px padding and inset shadows (`inset 0 2px 5px #00000012,inset 0 -1px 0 #ffffff07`). The portrait is 56px; its small exact team SVG is 20px inside a 25px emblem. Team-only marks use 40px SVGs.

At widths up to 480px, card padding/radius become 16px/20px, portraits become 48px, heading/metric sizes become 22px/30px and the telemetry ring becomes 76px rather than 92px. Suite rows move from three columns to two. At widths up to 350px, the badge and counts reflow and card padding becomes 12px. Actions and general expandable summaries have 44px minimum heights; step-receipt summaries use 32px, with a 2px accent focus outline offset by 3px. Meaningful updates use the 680ms behavior in the direction contract; unchanged snapshots, first observations and motion-suppressed states do not replay it.

## Identity and asset status

Avatars are authored fictional AI staff, not real employees. Names, roles, home teams and active/reserve/retired status come from `staff-registry.js`. Identity conveys neither execution authority nor proof of contribution.

The **v3** roster is integrated, with five subsequent user refinements pending: fourteen active and three reserve fictional staff. Nico, Julian, Rafael and Dominique preserve their facial identities with approved new wardrobe and poses; Valentina has the approved new portrait. The other twelve portraits are byte-identical to v2. The face locks do not require retaining the original photographs. Retired Felix has no asset.

The authoritative bundle is Library `libfile_ceaa943f4d648191901d06957d3b4737`, archive SHA-256 `3ed80350ba3c4b5e294a00d8fa0fcd99608eae95e1fd3986876590a313a61b63`, 28,403,590 bytes. The complete contact sheet was inspected before integration. All 34 PNG1024/WebP512 source hashes and all 24 retained-v2 source-file comparisons passed. `assets/staff/manifest.json` binds all seventeen canonical IDs, approved-v3 status, facial-identity locks, source hashes, and card derivative hashes. `final:false` records the new pending refinements: stronger body poses for Nico, Julian, Rafael and Dominique while preserving faces/v3 clothing, and a user-selected blonde/cream Valentina recast. The other twelve remain approved.

Card derivatives are 128px JPEG quality80 made with `sips`, with unchanged composition and sticky identity. Exact source and derivative hashes are recorded per file. Compact derivatives retain the existing self-contained card size budget. Portrait backgrounds retain the authored studio variation around `#3d3935`; the CSS container uses that exact token.

## Evidence model and compatibility

`relay-card-steps.js` defines a bounded presentation projection, `relay-card-steps/v1`. An ordered plan has assignment ID, stable revision, unique step IDs and dependencies referencing earlier steps. A non-pending state requires a receipt bound to the same assignment, plan revision and step, with an evidence reference and observation time. A claimed pass with an unverified prerequisite becomes unknown. Pending, running, passed, failed, skipped, blocked, cancelled, stale and unknown remain distinct. Partial plans have no full denominator. No prose is parsed into steps and arbitrary `progress_percent` fields no longer drive completion.

`continuityCardSteps` adapts an existing native plan/journal pair after matching the SHA-256 plan digest and checking ordered criteria coverage. It carries actual verifier receipts, treats dispatch intent as unconfirmed execution, never invents staff ownership, and does not promote subobjective completion to whole-objective completion. Its observation time comes from the producer's snapshot read, not an invented completion time. Effective additions beyond the bound base plan make the projection partial.

Canonical admitted acceptance additions can appear as partial, unconfirmed checklist records. Their admission never implies completion. Older records without a structured plan remain valid and say no ordered plan is recorded. Ordinary progress and queue adapters now preserve staff routing and bounded structured step evidence, without changing machine ownership, execution or coordination authority.

**Current integration limit:** the live assignment-card refresh calls `relay_runner_progress`; `src/progress-api.js` → `callProgress` reads canonical claims and GitHub branch, commit, PR and check evidence. It does not read a private local continuity journal. `scripts/relay-continuity.mjs` persists `continuity.json` locally, while `scripts/relay-native-continuity.mjs` restricts the RPC requests it will service. The request schema in `src/runner-control.js`, action allowlists in `src/runner-control-core.js`, and mutation fields in `src/coordination-engine.js` do not admit `card_steps`. There is no producer publication path from the local journal into the canonical record consumed by live refresh.

The validated adapter and preservation of explicit projections are therefore not evidence of live automatic step completion. Producer integration requires additional admitted scope for those five files (`scripts/relay-continuity.mjs`, `scripts/relay-native-continuity.mjs`, `src/runner-control.js`, `src/runner-control-core.js`, `src/coordination-engine.js`) and their relevant tests. The exact ten-path rescope (those five files and five relevant test files) was rejected before execution by automatic approval review for missing trusted exact-scope authorization in the delegated transcript. No producer file was edited, no canonical mutation occurred, and the request was not retried unchanged. Admission remains pending with the parent coordinator. A future implementation must publish bounded, validated receipts under canonical ownership and verify the full producer-to-live-refresh path; local fixtures and routing records cannot substitute for that evidence.

CI remains the existing `relay-ci-card/v1` model. Test passed/failed/skipped counts are separate from suites finished. A known suite denominator can drive the ring when total tests remain unknown. Only actual suite records are marked; a bounded visible subset is labeled against its total. Failure explanations remain expandable in full. Refreshes preserve open step evidence and keyboard focus, and unchanged snapshots do not replay progress animations.

The legacy bridge's byte-exact host/style shell is preserved. v20 intrinsic sizing logic remains unchanged. The v20 resource cache alias remains an explicit held integration gap under the separately owned entrypoint alias policy. This draft does not edit `src/index.js` or retry the previously denied alias work; the heading review does not clear that hold.

## Validation checkpoint

Current focused working-tree verification after the heading fix: 74 tests passed, 0 failures, 0 skips. The prior full run of five required suites recorded 1128 passes, 2 existing skips and 0 failures; `npm run check` and the web build also passed at that earlier checkpoint. The final exact-head suite is still pending. No final source head or release receipt is established by this document.

Actual production card HTML was rendered in 32 synthetic QA states: desktop 720px and narrow 360px, light/dark, across CI, shared plan, unknown, team-only, failed, stale, long blocker and empty fixtures. The second capture batch had no script errors or horizontal overflow. Synthetic counts and receipts are test inputs, never production contribution claims. Browser tests cover bridge compatibility, host intrinsic sizing and repeated expand/collapse, live refresh, observed motion, reduced-motion changes, keyboard focus, long blockers and contrast. Screenshots and computed-style results are retained outside source at `/Users/lrnolivia/Codex/2026-10-29/task/card-rendered/` (`results.json` and 32 PNGs); test logs remain in this task's artifact directory.

The finish reviewer returned **ship** for the sole final correction: Nico's heading stays Engineering green in the CI fixture at 720px and 360px in both light and dark modes, with no observed regression in that review. The result clears that bounded visual correction, not portrait approval, producer integration, cache alias work, final exact-head verification, merge or deployment.

## Remaining draft gates

1. Resolve the five newly pending portrait refinements; retain the twelve approved portraits. Rerender production DOM evidence and verify the exact source after the asset update.
2. Freeze and commit final source, run exact-head build and required checks, open and verify a draft PR. The bounded heading correction has cleared finish review; final-head validation remains pending.
3. Keep producer publication and the held v20 entrypoint cache alias explicit as separate integration gaps. The producer requires the additional scope and end-to-end verification described above; neither gap is closed by this UI draft or its synthetic evidence.
