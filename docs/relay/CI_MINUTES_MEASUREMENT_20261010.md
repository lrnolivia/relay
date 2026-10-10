# Post-rollout CI usage measurement

Status: measured 2026-10-10 for assignment `relay-mcp-rebuild-continuation-20261003` (owner `claude-ai-chat-20261007`). This closes the "billed-minute savings are not yet measured" gap in `ALL_PROJECT_CI_20261008.md` for the repositories this session could read. It is read-only evidence: no CI run was dispatched and no other repository was written.

## Method

- Source: GitHub Actions run history (`repos/<repo>/actions/runs`), completed runs only, created 2026-09-24 through 2026-10-10 20:00Z.
- Split point: each repository's CI-slice merge commit time (below). Relay uses 2026-10-08T00:00Z, when its hygiene schedule became daily.
- Windows: 7 days before the split vs the ~2.8 days after it. Values are per day.
- Runner time is `updated_at − run_started_at` per run (wall-clock run time, not per-job billed time).
- `schedule` events are separated from everything else (push, pull_request, dispatch, workflow_run). Only the scheduled column is attributable to the rollout. The other column mostly reflects how much development happened in each window.

| Repository | Merge | Merge time (UTC) |
| --- | --- | --- |
| loewfi | `b08c58f` | 2026-10-08 01:06 |
| ctrl | `0dfe6c3` | 2026-10-08 01:08 |
| thetake | `f9e47f2` | 2026-10-08 01:29 |
| loew-shell | `3f20ab8` | 2026-10-08 01:29 |
| rtxForge | `0778d5e` | 2026-10-08 01:42 |

## Results

| Repository | Scheduled runs/day | Scheduled min/day | Other runs/day | Other min/day |
| --- | --- | --- | --- | --- |
| loewfi | 4.6 → 1.1 | 1.0 → 0.3 | 0.3 → 0.0 | 0.1 → 0.0 |
| ctrl | 3.6 → 1.1 | 1.0 → 0.4 | 25.1 → 0.4 | 33.4 → 0.7 |
| thetake | 4.6 → 1.1 | 1.1 → 0.3 | 2.9 → 0.0 | 3.6 → 0.0 |
| loew-shell | 4.6 → 1.1 | 1.2 → 0.3 | 0.3 → 0.0 | 0.1 → 0.0 |
| rtxForge | 4.6 → 1.1 | 1.1 → 0.3 | 21.0 → 0.4 | 25.9 → 0.4 |
| relay | 17.9 → 9.9 | 7.1 → 3.9 | 127.0 → 43.8 | 220.0 → 59.1 |

Findings:

1. **Scheduled runs fell about 76% in the five project repositories (~4.6 → 1.1/day) and 45% in Relay (17.9 → 9.9/day).** The earlier "48 → 1 triggers/day, 97.9%" figure counted cron entries. GitHub actually executed only about 4.6 of those per day, so measured executions dropped far less than configured triggers did.
2. **The time saved is small: about 0.7–0.8 runner-minutes per day per project repo, and ~3.2 minutes per day for Relay.** Scheduled hygiene was never the expensive part.
3. **Billed cost did not change.** Every measured repository is public, and GitHub-hosted standard runners are free for public repositories, so the billed-minute saving is $0. The value of the rollout is less noise and less runner contention, not spend.
4. **The large drops in non-scheduled runs (ctrl, rtxForge, Relay) are not attributable to the CI change.** They follow development activity. For example, Relay ran 864 runs on 2026-10-01 to 10-04 during the release push. Do not cite them as rollout savings.

## Relay "hourly" schedules run about every six hours

`runner.yml` (`7 * * * *`, the model-free sync safeguard) and `schedule-preview-qa.yml` (`23 * * * *`) are both configured hourly. Since 2026-10-03 each executed 33 times, with a median gap of 6.0 h and 5.9 h, a maximum gap of 9.5 h and 9.3 h, and a minimum gap of 3.4 h and 2.8 h. Every run since 10-08 succeeded. GitHub is dropping most scheduled executions. In practice the "hourly" safeguard is a roughly six-hourly safeguard with gaps up to ~9.5 h.

This is a timing-guarantee gap, not a failure. Do not describe these workflows as hourly in status or recovery claims. Options for a real hourly cadence (an external scheduler such as the existing Cloudflare Worker cron triggering `workflow_dispatch`) change trigger authority and need a product decision. Nothing was changed here.

## RTXForge-MFG trigger review

Live workflows: `clang-format.yml` (`on: [push, pull_request]`) and `rtxforge-proton.yml`. Neither has a schedule. The default branch `dlss-neural-rendering` was last pushed 2026-09-12. The repository has 28 runs in total, and none since 09-12. Its idle cost is zero, so no change is warranted and no savings are claimed. `clang-format Check` has failed on every recent push. That failure predates this work and is left to the project owner; it is not a CI-cost item.

## Not measured

- loewtorials, field, GameBridge and Accented: GitHub API access was not granted to this session, so they were not measured.
- GW (`gwfamily`) stays with its owner. Bazzite, Adwaita-for-Steam and Arc are unchanged, as recorded in `ALL_PROJECT_CI_20261008.md`.
- The after-window is only about 2.8 days. Re-measure after 14 days for a stable rate.

## Evidence

Raw run listings (JSON lines as fetched; no duplicate run ids) have these SHA256 sums: relay `00af1e9c7a7583aaac16c90c89344b39842840feab4b0526aef92ace10763037` (1501 runs), ctrl `7cea30f38eb885a5af23ed1c3111df4cc50948b01de372864da004fccf6ba94f` (205), rtxForge `2775248a2b5aff09d8baae9afb6d94a1849fe8a4ce46d1a91cc887fecc9993c5` (191), thetake `99c7f73423164048ad55eef67b4716b103014a59ad380396ef22eaa85c674681` (60), loewfi `dc6b506e3e442b58bb4a9391402791d4b61f5cd501b7808c192bbd42d622a682` (42), loew-shell `7b68d5940054b597bee585338d85f5086df770019d6a26ca7fa80cc9c7297ba0` (42). These are session-local listings and are not retained remotely. Re-derive them from the Actions API with the method above.
