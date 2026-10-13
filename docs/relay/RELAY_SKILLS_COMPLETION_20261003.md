# Relay skills completion candidate — 2026-10-03

Assignment: `relay-skills-completion-20261003`; owner `01a1028b-03c4-718c-b205-24c35c97b0d7`; branch `relay/skills-completion-20261003`. Original 1.9 acceptance remains preserved in `docs/handoffs/2026-10-03/relay-cleanup-mutation-guidance-20261003.json`. This is a draft source candidate, not closure of the full MCP rebuild or production publication.

## Completed source workflows

All 28 existing packs now give usable routing, task inputs, supported actions, reviewable outputs, verification and bounded recovery. Changes retain existing product direction and authority boundaries:

- Nine supporting packs: engineering traces observable behavior and validates a reversible patch; research records version-bound primary evidence and experiments; documentation produces canonical resumable evidence; QA binds criteria to exact artifacts and classifications; accessibility exercises real keyboard/AT/reflow states; security traces bounded trust/authority checks; GitHub handles admitted source/PR/check/readback flows; Cloudflare separates Worker/build/version/traffic, bindings, Access, cache/R2 and evidence diagnostics; release records exact-head readiness, publication proof and rollback baseline.
- Six platform packs: web covers responsive state/hydration and keyboard/touch; macOS covers scenes/commands/restoration; Windows covers window/focus/scaling/high contrast; Android covers back/insets/lifecycle and TV focus; GNOME covers version-compatible adaptive/navigation actions; Figma covers real file identity, editable components and verified readback. Native/device execution must be reported honestly when unavailable.
- Creative packs translate thesis, flows, motion and visual QA into concrete state/implementation decisions. New `relay.creative.design-systems` supplies token/component anatomy, variants, consumer migration and verification; new `relay.creative.visual-reference` maps actual references into tokens/components with explicit inference and canonical asset preservation.
- Performance packs now cover image/font/payload budgets, hydration/JS/CSS costs, Core Web Vitals versus lab evidence, network/cache/CDN correctness, platform profiling, frame pacing, paint/compositing and lifecycle cleanup. Numeric budgets are chosen for the actual task/device and measured against comparable fixtures.
- New `relay.supporting.regression-protection` records known-working tool/client/UI and approved-design baselines; maps changed contracts/paths to meaningful bug reproducers; checks desktop/iOS/browser mount/actions, intended-recipient feedback acknowledgement, retained preview/refresh and exact-artifact release/rollback gates. Meaningful design deviations outside explicit scope are surfaced for review and require a verified easy live restoration option for approved visuals, proportions, behavior and defaults before promotion. Its QA/release dependencies are enforced atomically and fail closed for missing/tampered guidance. Both additions were recorded through canonical additive acceptance amendments before implementation. Runtime CI/host integration and live restoration controls remain Julian’s implementation responsibility.
- Planning and coordination packs specify canonical input/readback, resume eligibility, amendment reconciliation, telemetry gaps, explicit messaging authority and lead-only relationship curation. They do not create workers or transfer ownership.

## Packaging and discovery

31 self-contained portable entrypoints. Revised existing packs are version 1.1.0; the three new packs start at 1.0.0. The builder preserves exact authored bytes with source/content SHA-256, bounded load cost, pinned updates, private source license, existing dependency declarations and the Figma required-capability gate; the new regression-protection pack explicitly requires QA and release. No upstream code/assets/licenses or product dependencies were added. Task vocabulary now discovers testing, handoffs, tokens, fonts, profiling, Workers/R2, PR checks and other intended domains through deterministic tags. No resolver/tool/API changes were necessary.

Self-contained instructions suffice for these workflows, so references/scripts/assets were not added. The builder now rejects unsupported Markdown resource layouts instead of accidentally publishing them as unrelated packs. Existing runtime/vendor/install formats still support entrypoint and upstream license only; multi-file authored resources require a separately reviewed integrity/containment contract.

## Verification evidence

Generated artifact: `src/skills-bundles.js`, SHA-256 `d74f6b470df41f635f3a15f2c7ece650bcce871141af0c8124c6ed3d87f8c405`. Isolated task checkout based on `1ceefdf318d9126d878f67b504d5c144409c695b`; the draft PR head records the complete candidate. No UI, cards, broker, auth, credential, operations-document or lockfile changes.

- `npm ci`: passed with unchanged lockfile.
- Skill-creator `quick_validate.py`: all 31 entrypoints passed using temporary PyYAML 6.0.2 outside the repository.
- Deterministic builder/source-byte/provenance/budget tests: passed, including rejection of symlinks and unsupported resource layouts; tests run through standard repository discovery.
- Skill pipeline checks: catalog, task-vocabulary search, read, audit, vendor, deterministic resolution, context limits, dependency closure/cycles, project isolation, capability denial, update/license drift and tampered bytes passed.
- Representative compositions: engineering + QA; design system + web + accessibility; performance profiling; GitHub + release; Cloudflare + release; visual-reference analysis; regression protection with enforced QA/release dependency closure. Each resolves the expected narrow set, exports exact bytes, installs only after admission, verifies installed content and replays the immutable install. Missing Figma rejects that pack; neutral design/reference packs remain usable without counterfeiting Figma work.
- Registered Node 22.23.3: `npm test` passed **497/497**, zero skipped; `npm run build` and web `typecheck:2.0` passed. The first sandboxed full test attempt could not launch Chromium (Mach-port permission); the unchanged harness passed with macOS launch permission. This was a harness restriction, not a product correction.
- `git diff --check`: passed. Admission/preflight covers the full changed-path set. Generated website QA media from required tests is retained outside the checkout, not included in this skills PR or used as skill behavior proof.

## Remaining proof and limitations

These checks establish content/packaging/composition/install mechanics, not autonomous model behavior or real production provider/device execution. No subagent evaluation, live GitHub/Cloudflare mutation, Figma edit, physical/native AT test, host installation or production promotion is claimed. No merge is authorized for this draft. The guide describes those workflows and honest stopping conditions; real acceptance evidence must come from an authorized target environment.

Selection uses exact intent tags and available capabilities, not natural-language inference. Resource-bearing bundles are still unsupported. Staff affinities and existing dependency declarations stay unchanged; regression protection loads its required QA/release closure, while other guidance composes packs explicitly without loading everything. The root-owned `MCP_REBUILD_OPERATIONS_20261003.md` still describes the previous 28-pack inventory and should be reconciled by its owner after this candidate is accepted.

Next action: review the draft skill workflows and exact-head CI, then choose authorized publication/host execution checks. Preserve the full rebuild's remaining objectives; source completion does not close them.
