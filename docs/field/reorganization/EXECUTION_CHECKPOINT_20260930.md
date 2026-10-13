Current superseding receipt: [live ownership and recovery](LIVE_OWNERSHIP_RECEIPT_20260930.md). Read it before historical checkpoints below.

## Verified promotion — 2026-09-30 10:14 UTC

PR #135 merged as `854038a3e84f41cd590a4ad18b24fcd4127e2fba` after Registry and exact-head deployed Preview QA passed. Production `/api/build` reports this merge and deployment `2ae1aa2f-dbc1-4aed-b883-0951c9da32af`. [Current receipt](CANVAS_PROMOTION_RECEIPT_20260930.md) supersedes older pending/Preview-blocked statements below. Relay Worker fetch 1053 is a transport-path limitation; direct HTTP and GitHub Chromium passed on exact Preview deployment `6255045b…`. No DNS, domain, Access or product routing change was needed. Preserve original branches, Mobile and deferred-panel scope. Next: complete Canvas claim/shared-file return, then serially admit preserved Dashboard work against fresh main.

# Consolidation execution checkpoint — 2026-09-30

## Live checkpoint — 2026-09-30 09:44 UTC

Current Field PR #135 head is `57f4765b591286c6c456439ba217d8de282c38c9` (draft, mergeable/clean), not the older `77e8148…` publication head below. Diagnostic Registry run `36694828578` / job `109820178700` proved 57 branch failures vs 61 exact-main failures with **zero branch-only failures** and four baseline-only failures (crop-math cover overflow, two CameraAnimator reduced-motion expectations, workspace-layout viewport-padding hard margin). Current head changes the comparator to allow baseline-only improvements while still failing any branch-only regression.

On this current lane, Runner admission, Media/editor verification and Workers build are green. Registry rerun `36697728462` / job `109829617442` was still in progress when this checkpoint was written. Do not perform product repairs from the 57-count alone; the branch is regression-free relative to exact main by the diagnostic comparison.

Preview remains a separate infrastructure gate. Relay evidence `vis_ec1567cf-2eab-4779-997c-ee641fb2ef9d` records the exact loew Preview custom-host Cloudflare 1053 failure. Production Group QA control evidence `vis_5f651b2a-7b7a-4016-8f35-c89d4a83bbb0` passed, and the exact workers.dev deployment rendered read-only Group QA. Source merge remains blocked until the current Registry rerun is green and exact-head deployed Preview QA is available/passing.


The current publication receipt is [PUBLICATION_HANDOFF_20260930.md](PUBLICATION_HANDOFF_20260930.md); exact results and the 57 remaining failure names are in [PUBLICATION_EVIDENCE_20260930.json](PUBLICATION_EVIDENCE_20260930.json). This checkpoint supersedes the earlier local-candidate observations.

Published source:
- Draft [field #135](https://github.com/lrnolivia/field/pull/135), `77e81482897d6530989882c6df18669d5e4cfde4`: Frame/Group recovery and validation repairs. Three production builds and ten focused desktop Chromium tests pass. Required clean install, full tests (57 failures), lint (five reserved-file errors), and exact Preview block merge.
- Draft [field #133](https://github.com/lrnolivia/field/pull/133), `cc38e107fedd1b33088bf64dd6534f6d3d97965f`: recovered lockfile/Media CI prerequisite; full tests/lint remain uncleared. #135 is based on current main and does not contain this prerequisite.

Dashboard's complete unpublished delta, including untracked tests, is preserved in Runner's recovery patch. Admission, current-main reconciliation, authenticated persistence and Preview QA remain. Original branches and PRs stay retained until semantic and unique-merge accounting is complete.

Connected mobile landscape panels are deferred by the user: [requirements](DEFERRED_CONNECTED_PANEL_REQUIREMENTS_20260930.md). The existing Mobile lane owns shared lockfile/camera/shell paths. No panel implementation was published. No new worker was created.

Next: serial ownership reconciliation for the lockfile and five remaining lint errors, remaining test failure classification/repairs, final required gates and exact Preview, then source merge and ordered Dashboard/Controls/Assets closeout. Refresh live Runner ownership and Git state first; do not infer authority from this snapshot.
