# rtxForge Linux continuation handoff for Claude
Prepared by Julian, October 21, 2026, 6:40 PM Eastern. Lauren says Claude is available again at 7:31 PM Eastern tonight. This is a handoff for Lauren to give Claude, not evidence that Claude has received it or a scheduled start.

## FIRST: installed local app does not open
Lauren approved the final preview: “that was perfect. you can make that my actual local Linux build.” Codex reported installing checkpoint `dabf55a` as the normal Linux AppImage behind the existing app-menu launcher, retaining a timestamped backup and leaving settings/game files unchanged. Its packaged startup check reportedly found GTK under Wayland.

**Lauren subsequently reports that clicking the installed launcher does absolutely nothing.** Treat launchability as broken/unverified, regardless of the earlier startup-check pass. No diagnosis has been established. First inspect the actual desktop entry and Exec target, installed file and executable permission, then capture stdout/stderr from the exact launched command. Check packaging/runtime dependencies and paths based on that evidence. Preserve settings, source and backup; do not clear application data or blindly reinstall. Verify both direct startup and app-menu startup in the real session after fixing. The preview worked; the installed build has not been proven usable.

## Preserve and recover the existing work
- Computer: `lomachine`, Linux loewOS/Bazzite 44. Do not confuse with historical Windows sessions on the same hardware.
- Repository: `lrnolivia/rtxForge`.
- Integration branch reported: `rtxforge/linux-ui-parity-20261021`, in a separate clone. Original checkouts were preserved; main had unrelated documentation changes.
- **Latest reported local source/install checkpoint: `dabf55a`.** Resolve the full SHA locally; do not assume remote contains it.
- Existing detailed handoff relative path: `relay-handoff/docs/rtxforge/LINUX_PARITY_TAKEOVER_20261021.md`.
- Codex repeatedly updated a verified Git recovery bundle and the handoff. An earlier bundle was named `rtxforge-local-checkpoint-a5f711b.bundle`; later reports say bundles were refreshed for subsequent checkpoints. Locate the latest actual bundle, verify its refs and integrity, and retain earlier recovery artifacts.
- Relay confirms the integration clone is /home/loew/Documents/Codex/2026-10-21/task/rtxforge-integration. The existing local handoff is /home/loew/Documents/Codex/2026-10-21/task/relay-handoff/docs/rtxforge/LINUX_PARITY_TAKEOVER_20261021.md. Recovery bundles are in the parent task directory. Exact installed AppImage/backup paths and the latest bundle name must be read from that handoff or verified locally. Forge Lab uses validation-20261021 with a private steamapps layout; preservation evidence includes forge-lab-baseline.json in the task workspace.
- Draft UI PR50: https://github.com/lrnolivia/rtxForge/pull/50
- Draft runtime PR51: https://github.com/lrnolivia/rtxForge/pull/51
- Original Claude heads inspected: UI `0a2f50b`, runtime `5ac3364`. Both clean, open drafts at takeover.
- Relay later confirms public base 06e5212ded4c216900b119cfe506fd8fd0319786, after earlier bbb8f60a88031c69d9ced120578987a0243032a7. Latest edits through dabf55a were reported local-only. Refresh the live remote before any push. Neither a merge nor release was reported.
- Checkpoint progression in reports: `06e5212`, `a5f711b`, `576313b`, `7d8e2d6`, `72ede95`, `dabf55a`. Preserve ancestry, do not reset to the old PR head.
- Relay UI assignment transferred to Codex; runtime assignment marked superseded into UI while retaining PR51/branch. Context revision 196 was verified before this new handoff. Current assignment is rtxforge-linux-latest-feature-parity-20261020, owner 01a1586d-75af-751f-96b1-2556defbe011. Runtime assignment is rtxforge-linux-runtime-parity-20261021. Refresh current authority/revision before takeover or writes.
- Codex hit its usage limit after installation. Its attempted final consolidation did not complete. This document is assembled from completed worker reports and Lauren's latest feedback, not a fresh filesystem audit.

## Work accomplished after Claude's handoff
The UI/runtime branches were integrated locally rather than rebuilt. Reports describe:
- Linux overlay mailbox portability correction: Windows LONG is 32-bit, but Linux ctypes.c_long was 64-bit. Explicit 32-bit accesses were introduced; verify final diff.
- Global/menu overlay review handling tested against fixtures, session-bound with stale-session refusal and single-use Apply.
- Shared schema Presets editor in desktop Presets, Game Details and installation dialogs, including legacy packages with unsupported controls disabled and correct legacy serialization.
- Advanced controls grouped below More settings; sliders retain raw numeric entry and Windows-style captions.
- Popup scrolling with fixed action buttons; compact MFG/NR cards and resizable popup.
- Wide two-column Presets layout maintained down to 820 logical pixels; DLSS Presets top-left below MFG; separate card surfaces; bottom-right fixed actions in Presets and Game Details.
- Header Back button and Alt+Left; navigation check passed.
- Embedded Details X removed, tabs below hero; detached windows retain parent association to appear above the app.
- Appearance artwork spacing corrected.
- Icon failure traced to isolated smoke HOME being unable to access user-installed Papirus-Dark. App-only Adwaita fallback added, desktop theme unchanged.
- Extras changed to wide capsule artwork/accent borders; warning icon reduced; MFG crowding addressed.
- Packages gained curated cards and In use status.
- AppImage staging source-directory error corrected; final package built and installed, but see critical launch failure above.

Lauren interactively reviewed multiple preview iterations and approved the final one. Preserve that design, rather than replacing it with an earlier interpretation. Exact Windows-wide parity and all Game Mode parity were still not fully verified.

## Validation: be precise about what is and is not proven
Reported passing at various checkpoints (rerun relevant checks after new changes):
- 213 engine tests.
- Linux runtime suite grew from 62 to 64 passing tests.
- 85 Windows-host Python tests in the Linux integration work; this is not a full native Windows pass.
- GTK smoke, fixture GTK regression and focused scrolling/navigation/layout checks.
- A prior-commit bridge DLL build and Windows ARM64 check passed.

Outstanding failures/gaps:
- Windows x64 Feeder lifecycle test failure in CI.
- Full UI parity and Game Mode parity unfinished in latest explicit reports.
- Actual NR/MFG/overlay operation in a Proton game remains unverified. No successful real-game launch was reported.
- Final installed app-menu launch now fails silently for Lauren.
- Earlier follow-up push was denied by approval review because permission covered only `bbb8f60`; that rejected push did not execute. Do not infer blanket permission from it. Check later user approvals/current remote state and obtain any actually missing approval without repeating already-authorized steps.

## Forge Lab testing authorization and safeguards
Lauren explicitly authorized: “make copies of the games in Forge Lab and do it,” in response to testing NR/MFG/overlay by installing into CONTROL Resonant from Linux and launching through Steam.

Use the established Forge Lab copies, not original installs. Worker reported the copy's 310 files had separate inodes from originals, about 3.46 TB free, and original config/prefix-registry hashes saved for preservation checks. Locate those manifests and paths. Isolate test prefixes/configuration and protect original saves. Do not use hardlinks or symlinks that allow test writes into originals. Reuse existing prepared copies rather than unnecessarily copying again. Coordinate visible game launch with Lauren's desktop use.

## Continue in this order
1. Recover/verify latest local checkpoint and repair real installed launcher; retain working rollback.
2. Refresh Relay ownership, PR state, local-vs-remote divergence and CI. Preserve all concurrent/unrelated changes.
3. Finish and verify full 24-control Windows schema parity, Dynamic MFG per-game capability gating and Game Mode controller layout. Recheck Adoption, Global, Apply to Installed Games, App Storage, subset offers and optiscaler_hotkey contract against combined code.
4. Resolve native Windows x64 Feeder lifecycle failure and verify the correct bridge DLL matches the integrated source.
5. Test isolated Forge Lab game copies under Proton for actual NR, MFG and overlay save/reset/preset replay. Capture runtime evidence and compare original preservation hashes. Do not substitute file presence or synthetic passes for runtime proof.
6. Finish real desktop/controller/Gamescope validation and website screenshots only from the real integrated build. Keep validation limitations explicit.
7. Prepare merge-ready changes through appropriate Relay paths; verify permission and gates before merging or releasing. No automatic release is authorized by this handoff alone.

Canonical UI reference: https://github.com/lrnolivia/relay/blob/main/docs/rtxforge/UI_NATIVE_PANEL_20261020.md . Goal: embedded top tabs by default, optional detached section sidebar, native platform controls, Game Mode embedded. Keep operational maintenance documentation canonical in Relay docs/rtxforge, preserving genuine product documentation in rtxForge.

## Relay publication note
This complete document is the continuation handoff. Relay context accepted parts 1–5 of operation julian-claude-handoff-20261021-part-* at revisions 197–201, then refused part 6 because context capacity was reached. Those excerpts are incomplete; use this complete document. No history was deleted or archived. This document is published on a documentation-only Relay branch/draft PR, not main. Product source through dabf55a and its recovery bundle remain local, not uploaded by Julian.
