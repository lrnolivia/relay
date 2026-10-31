# Assignment card refresh and identity repair

The v25 card binds both manual and automatic read-only refresh to its mounted project and assignment. Ordinary query, render and work-card snapshots converge on `relay_runner_progress`; typed CI inputs retain `relay_source_checks`. A single request runs at a time. A target generation and server observation timestamp fence late responses; newer host output wins. Explorer overview/project navigation cancels the assignment session. Widget hydration echoes do not reset the timer or replace newer evidence.

Visible active cards read every 30 seconds (CI every 15 seconds), without the former 90-read cap. Hidden cards pause; visibility, online and page restoration reconcile immediately. Failure retries use 30/60/120-second bounded backoff, pausing after five consecutive failures with an explicit manual retry. Failed work can recover; completed/cancelled/superseded/retired work stops automatic reads. A successful read displays its checked/as-of time separately from work evidence.

The canonical 10/20-minute delayed/stale progress policy is unchanged. A fresh heartbeat proves worker liveness, not work progress. Stale ordinary cards identify the last commit/check/deployment evidence timestamp and explain that distinction. No plan, receipt, staff execution or completion is inferred from polling or heartbeat. The reported rtxforge assignment remains outside this repair's mutation scope; its design lead and absent supporting staff/step receipts are routing facts, not proof that Valentina performed its expanded engineering work.

## Identity and presentation

Staff headings use their canonical home-team family independently from job status. Design/QA uses the palette's Terra Prime orange family (`#b5471f` light, existing `--color-act` family `#f0643b` dark); Engineering/Integrations mix 82% approved turquoise with the theme ink for normal-text contrast at small sizes. Generic Relay remains Relay orange. Status colors are unchanged. Actual light/dark browser contrast is tested.

The 17 approved v4 avatar source files and manifest remain byte-identical. `PORTRAIT_FRAMING` supplies normalized square presentation windows over those existing avatar crops, from the designer's source-hash-verified proposal (Library `libfile_fc78ce8d4b0c81918a7f2de0c1791481`). It is applied once through a clipped frame, never through both recropped images and CSS. Team emblems scale with the slot so they do not obscure faces at 32px. Original identities and poses are preserved. All 17 require actual rounded-slot pixel inspection in light/dark at 32/48px, plus a full Julian card.

Momo's canonical source is the embedded WOFF in `src/relay-context-card-style.js`, converted from Google Fonts blob `dd404d44335869459b216b0f543c5bbf98fec5d8`; its complete SIL OFL stays embedded. There is no new external font request. The extracted WOFF bytes have SHA256 `abe33a73c4dc7471c1bfb92136ac3aa1066ccb94304d19ce40cfc60bde5e8f1d` (the designer's delivered file extension was initially `.woff2`, but its magic is `wOFF`).

## Verification and test maintenance

New production-DOM tests cover ordinary snapshots without work_card, over 90 reads, duplicate notifications, shared manual/automatic targeting, project/assignment switches, late/older/malformed responses, hidden/resume, page restoration, online recovery, backoff and terminal behavior. A real `deriveObservedProgress` producer result passes through the mounted read path and retains stale source evidence despite fresh heartbeat and successful fetch. Existing CI, icons, native/browser bridge, intrinsic resizing, reduced motion and historical resource aliases remain required.

Intent-aware assertion changes:
- Failed-refresh feedback moved from the work blocker to the separate live-fetch status. The last work view and exact one-call assertion remain.
- Entering an explorer assignment now performs its own assignment-bound read; expected calls include that read.
- Manual refresh preserves navigation instead of navigating through project view; hydration test waits for actual new receipt rather than incidental widget-state echo counts, and expects the exact assignment argument.
- A genuinely newer host fixture now carries a newer generated_at timestamp; old output is intentionally rejected.
- Engineering heading expects its canonical turquoise/ink family instead of status green; all 17 headings require 4.5:1 contrast at mobile size.
- Repeated short content after a longer update remains an unchanged intrinsic-sizing requirement; a real duplicate-filter regression was fixed without weakening that test.

Pinned Playwright 1.60.0 does not support the Codex Test Agents loop. Existing node:test/Playwright production-DOM tests are used without dependency changes or new skips. Browser fixtures are not native host acceptance. The separate native specialist activation continuation remains queued and incomplete, with its private receipts preserved; this card repair neither resumes it nor claims specialist delivery proof.
