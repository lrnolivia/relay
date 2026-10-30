# Staff-led Relay cards

Assignment `relay-staff-led-cards-20261030`, branch `relay/staff-led-cards-20261030`. Initially draft-only; the user authorized merge and production release on2026-10-30 at01:50UTC after final checks. Release still requires exact reviewed-source verification and canonical deployment health/readback.

## Direction contract

The approved direction makes the staff member who owns the current recorded step the card's first read, with a small team emblem and a project badge. A routing lead is explicitly labeled **Assignment lead**; a team-only card is equally valid. One assignment owns one ordered checklist across machine or staff handoffs.

This extends the existing Terra Prime telemetry family: Momo Trust Display, Inter, graphite layered surfaces, recessed real-record rings, neutral explanatory text and accessible accent headings. It preserves intrinsic inline sizing and explicit fullscreen screenshot inspection. Desktop and narrow cards share the same evidence and actions, with responsive composition. First observation settles; observed numeric changes use 680ms cubic-out interpolation. Calm, reduced-motion and hidden-document states settle ongoing motion.

The finish condition includes reviewed exact-source checks and the authorized production release, with every shipped portrait tied to approved canonical identity and provenance. Implementation verification and production activation are reported separately.

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
| Design & QA, information / `--info` | `#087a88` | `#18afc0` |
| Integrations heading / `--source` (exact exported emblem accent) | `#1c8c93` | `#1c8c93` |

**Identity color follows identity.** The staff heading follows the selected identity's team, independently of the card feature accent. Nico therefore keeps the Engineering green heading when the card displays CI. A named staff member always retains their canonical home-team emblem and heading, including Rafael’s Integrations emblem and source teal. A different step team or assignment team is explicit in Technical evidence. Integrations headings stay 24px at narrow widths: source teal has contrast 3.85:1 on the light surface and 4.28:1 on the dark surface, meeting large-text AA. A valid current-step receipt naming a staff owner takes priority; otherwise the routing lead is labeled Assignment lead, or the card presents a team update. A portrait or routing label never supplies execution evidence.

Momo Trust Display sets the staff heading (400, 24px/1.15) and main metric (400, 34px/1.05). Inter sets the explanatory body (13px/1.5), task headline (600, 16px/1.35), labels and actions. The card has a 24px radius and 20px padding; the sculpted telemetry recess has an 18px radius, 14px padding and inset shadows (`inset 0 2px 5px #00000012,inset 0 -1px 0 #ffffff07`). The portrait is 56px; its small exact team SVG is 20px inside a 25px emblem. Team-only marks use 40px SVGs.

At widths up to 480px, card padding/radius become 16px/20px, portraits become 48px, heading/metric sizes become 22px/30px and the telemetry ring becomes 76px rather than 92px. Suite rows move from three columns to two. At widths up to 350px, the badge and counts reflow and card padding becomes 12px. Actions and general expandable summaries have 44px minimum heights; step-receipt summaries use 32px, with a 2px accent focus outline offset by 3px. Meaningful updates use the 680ms behavior in the direction contract; unchanged snapshots, first observations and motion-suppressed states do not replay it.

## Identity and asset status

Avatars are authored fictional AI staff, not real employees. Names, roles, home teams and active/reserve/retired status come from `staff-registry.js`. Identity conveys neither execution authority nor proof of contribution.

The **final v4** roster is integrated: fourteen active and three reserve fictional staff. The final user choices are Nico’s front-facing blue jacket, Julian/Rafael/Dominique’s revised poses with preserved faces, and Valentina’s blonde/cream option C. The other twelve identities remain unchanged. Retired Felix has no asset. No portrait approval is pending.

The authoritative bundle is Library `libfile_5f9a32a653388191a095a1a6989b0db2`, archive SHA-256 `4b6177a003d7155db796a9a06723f031aaae78d3309422d93468f69200ea3016`, 28,747,825 bytes. The contact sheet was inspected and all 51 PNG1024/WebP512/avatar512 manifest hashes verified. `assets/staff/manifest.json` binds every canonical ID, status, source hashes, normalized crop box and card derivative. It records `final:true` and `approved-v4` for all17.

Small cards use the supplied `avatar-crop512/{id}.webp` composition, including dedicated face crops for the wider Julian/Rafael portraits. Self-contained 128px JPEG quality80 derivatives preserve those approved crops; they are not resized full-body portraits. Exact source and derivative hashes are recorded. Portrait backgrounds retain the authored studio variation around `#3d3935`; the CSS container uses the exact token.

## Evidence model and compatibility

`relay-card-steps.js` defines a bounded presentation projection, `relay-card-steps/v1`. An ordered plan has assignment ID, stable revision, unique step IDs and dependencies referencing earlier steps. A non-pending state requires a receipt bound to the same assignment, plan revision and step, with an evidence reference and observation time. A claimed pass with an unverified prerequisite becomes unknown. Pending, running, passed, failed, skipped, blocked, cancelled, stale and unknown remain distinct. Partial plans have no full denominator. No prose is parsed into steps and arbitrary `progress_percent` fields no longer drive completion.

`continuityCardSteps` adapts an existing native plan/journal pair after matching the SHA-256 plan digest and checking ordered criteria coverage. It carries actual verifier receipts, treats dispatch intent as unconfirmed execution, never invents staff ownership, and does not promote subobjective completion to whole-objective completion. Its observation time comes from the producer's snapshot read, not an invented completion time. Effective additions beyond the bound base plan make the projection partial.

Canonical admitted acceptance additions can appear as partial, unconfirmed checklist records. Their admission never implies completion. Older records without a structured plan remain valid and say no ordered plan is recorded. Ordinary progress and queue adapters now preserve staff routing and bounded structured step evidence, without changing machine ownership, execution or coordination authority.

### Live publication path

`runContinuityExecution` publishes meaningful observations through `publishContinuityCard`, the existing `relay_runner_coordinate` amendment transport, and the canonical coordination record. Both standalone and native continuity adapters use this path. The native adapter retains its exact request/start/reply protocol. `relay_runner_progress` reads the canonical projection through `src/progress-api.js`; card refresh consumes it through the same existing progress call.

The strict publication contract permits at most32 ordered stable step IDs, a plan revision, objective digest, monotonic sequence, current machine owner/branch, and bounded verifier receipts. Stable plan identity covers original ordered stages and criteria, surviving provider handoff and local verifier environment changes. Journal-to-plan digest matching remains mandatory before projection. Supporting priorities cannot disappear on an old journal replay. Original plan coverage is distinct from whole-objective completion; partial/subobjective plans have no full denominator.

Only actual passing local verifiers produce pass receipts, with input digest, output digest, source SHA and observation time. Dispatch intent stays unknown. Before a resumed checkpoint is published, changed inputs/environment invalidate old pass receipts and dependent observations. Routing staff never become contributors or receipt owners automatically. Published evidence is an authenticated owner’s recorded verifier evidence, not independent server execution or proof that a named human contributed. The server validates the bound structure and ownership; raw private verifier output is deliberately unavailable to it.

Publication requires an active unexpired current owner and matching branch/objective, then an exact canonical record CAS. The server refuses scope/routing/objective changes bundled with a checklist update. A changed objective removes its old projection. After mutation the producer independently reads back the exact projection, owner and new record revision. Lost responses can reconcile to that readback; a stale/mismatched result leaves a private pending intent and stops further writes without replay. Unchanged observations preserve timestamps and generate no redundant amendments. An authoritative no-application rejection stops the current run but clears that rejected intent after readback, allowing a later fresh guarded attempt; it is not treated as an uncertain write. New acceptance additions atomically mark a prior complete checklist partial before the next publisher run, retaining its verified evidence. Raw journals, prompts, commands, environment data, stdout and stderr stay outside the repository and canonical card record.

`src/coordination.mjs` is canonical; `scripts/sync-coordination-engine.mjs --local` generates the byte-exact `src/coordination-engine.js` copy and its pin in `runner-control-core.js`. The live canonical-main drift guard is preserved. Admission expanded to these bounded producer/transport tests and the canonical counterpart before edits. Existing owners and unrelated held paths remain untouched.

The real integration test creates a temporary Git checkout, executes actual verifier subprocesses, uses the real control/schema/CAS/readback code with a mocked GitHub network boundary, calls actual progress projection and renders the production HTML in Chromium. It observes pending→passed per priority, retained ordering, correct routing labels, privacy and duplicate-refresh suppression. It is implementation evidence, not a deployed production run.

**Activation boundary:** this candidate has not yet been merged or deployed. The currently deployed tool schema does not yet admit this new publication field. No live checklist publication was attempted against that old schema. The authorized release must update the canonical engine and runtime together, then observe a real post-release milestone and card refresh. This replaces the prior missing-producer limitation with a tested implementation and an explicit deployment boundary.

CI remains the existing `relay-ci-card/v1` model. Test passed/failed/skipped counts are separate from suites finished. A known suite denominator can drive the ring when total tests remain unknown. Only actual suite records are marked; a bounded visible subset is labeled against its total. Failure explanations remain expandable in full. Refreshes preserve open step evidence and keyboard focus, and unchanged snapshots do not replay progress animations.

The legacy bridge's byte-exact host/style shell and v20 intrinsic sizing logic are preserved. New tool metadata advertises v21; clients retaining v19 or v20 resource URIs receive the current card HTML and metadata under their requested URI. All existing older aliases remain available. The user explicitly approved the exact `src/index.js` / `src/relay-entry.test.js` carve-out at2026-10-30 02:16UTC; canonical admission was independently verified before these bounded alias edits. Other consumer-verification work remains held and untouched.

## Validation and review

Focused checks cover the producer, schema, native RPC transport, progress adapters, staff identity, portrait bytes, rendered DOM and legacy inline sizing. Negative cases reject malformed/private/malicious receipts, unsupported completion claims, wrong owners, expired/held claims, stale CAS, stale readback, obsolete plan digests and lost priority IDs. An unresolved write cannot be replayed automatically. Existing source/generated provenance assertions remain intact. The legacy coordinate CLI still does not support amend; a regression asserts that unsupported path performs no write. Publication uses the existing RPC adapter, not a new CLI fallback.

Actual production HTML was rendered in32 synthetic QA states: desktop720px and narrow360px, light/dark, across CI, shared plan, unknown, team-only, failure, stale, long blocker and empty inputs. All17 final staff cards were also rendered. The v4 review batch had zero script errors and no horizontal overflow. The synthetic counts/receipts are labeled test inputs. Browser tests cover keyboard focus, collapsed/expanded details, repeated refresh, motion, reduced-motion changes, intrinsic host sizing and loaded font metrics. Exact-head build/full-suite results and final Library capture versions belong in the draft PR report.

The independent finish reviewer inspected the compact Inspector, mobile, shared checklist, light theme and revised portrait cards and returned **ship** for the final asset integration and identity correction. No material visual regression was found. This visual verdict does not authorize deployment.

Installed Playwright1.60.0 runs the browser tests but does not support `init-agents --loop=codex`; no host substitution, dependency upgrade or added skip was used. The existing two Linux-only process tests retain their platform skips on macOS.

## Remaining release boundaries

- Final report supplies exact tested head, commands/counts, checks, rendered evidence, human-attributed merge and production readback. Release authorization does not bypass checks or ownership.
- A real production milestone/refresh is verified only after the authorized release of the new schema and canonical engine.
- The separately held v20 entrypoint cache-alias work remains outside this reservation. No edits to `src/index.js` or previously denied alias scope were made.
