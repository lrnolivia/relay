# Sample UI build and production follow-up

Message for the current Windows implementation owner, at Lauren's explicit request. These changes are implemented in the private capture fork. The active implementation checkout and installed production app were not edited.

## New working build

- Executable: `C:/Users/lrnol/AppData/Local/rtxForge-samples/app-20261021-ready/rtxForge.exe`
- Required final arguments: `--sample-library "C:/Users/lrnol/AppData/Local/rtxForge-samples/full-library-20261021-v2/library.json"`. Prefix `--game-mode` to start in Game Mode.
- DLL SHA-256: `51eea3af1802301a75537a6f3ddf9a3b98c5b447d276095172f93d93e7f7e254`.
- Reused UI revision: `ac901ad719d9b896aa0bf3616524e1a2da3e0b56`; capture tooling revision: `b720587a8b1e58559e2781f7c28a234b7f6c291e`.
- Tooling worktree: `C:/Users/lrnol/Repos/rtxForge-sample-preview`, branch `rtxforge/private-sample-library-20261021`; draft [PR #44](https://github.com/lrnolivia/rtxForge/pull/44) targets the existing Windows branch. Source changes are confined to `windows/sample-preview/`.
- Generated native source: `C:/Users/lrnol/AppData/Local/Temp/rtxforge-sample-20261021-ready/source/windows/RtxForge.Windows`.
- Existing sample profile, removals, selection and simulated install state are reused, without re-export/reset. The Desktop sample shortcut points at the new executable. The running `app-20261021-progress-final` window was deliberately left open while Lauren records; it is the preceding build and does not contain the latest category/badge refinements.

## UI changes to carry into production

1. Install presets are substantially tighter in both Desktop and Game Mode. Primary NR and Multi-Frame Generation controls are grouped first, with all remaining variables retained under More settings. Existing numeric units, enablement and value bindings remain unchanged. The action says Review games. Desktop maximum dialog width is 840 effective pixels; Game Mode uses a responsive 1120-unit modal instead of 1500. Normal standalone presets and Game Details editors are unchanged.
2. Move Game Mode scale, navigation placement and button glyphs from Appearance into Gaming Mode → Layout and labels, in both settings views. Appearance retains app-wide theme and desktop presentation. All persistence keys/bindings are preserved. `ButtonGlyphs`, `NavigationPosition` and `UiScaleKey` are used by Game Mode; Desktop Compact header stays in Appearance.
3. In light mode, READY and other review/feature/Library status badges use a pale tint of their text/accent hue with readable darker ink and a matching subtle outline where applicable. The fixed dark artwork badge palette was the READY cause; selected Library pills also carried dark-only colors. Desktop and Game Mode are covered, including theme changes on attached review pills. Dark-mode colors remain unchanged.

Portable transformations and the native badge helper are in `capture_flow.py`, `settings_categories.py`, `badge_theme.py` and `SampleBadgeTheme.cs` under `windows/sample-preview/`. These transformations target the exact reused UI revision and fail closed if anchors drift; adapt the actual native changes to the current implementation instead of replacing newer work wholesale. The rest of the sample bootstrap must not be copied into production.

## Simulation boundary and evidence

Lauren requested a ten-second simulated install loading bar for screenshots and video. Desktop and Game Mode share that simulation; the entire install batch lasts about ten seconds regardless of game count, with fractional progress and cancellation. This pacing belongs only to the capture sample, never the production installer. Any recording using it is a UI demonstration, not a measurement of real install speed. This supersedes the earlier prohibition on using sample progress for a demonstration clip; it does not establish a real installation result.

Native build passed with zero warnings and errors. Thirty-four checks against the compiled sample passed, including badge luminance/contrast for four hues, single/batch timing, monotonic progress, cancellation, separate persistence and unchanged live settings bytes. Measured batch: 10.02 seconds; single game: 10.01 seconds. The exporter fixture passed. Settings property references were compared across both views and all bindings were preserved. Fourteen native XBF resources are packaged.

Lauren approved the preceding compact install flow as looking smooth. The new category and light badge changes have compile/logic verification, but have not received a new rendered visual pass. Computer Use stopped during the prior attempted inspection, and Lauren is still recording; no further screen/input actions were taken. Leave her current window alone until she is ready to restart.

Relay's context inbox currently requires reauthentication. This document is the durable message fallback, referenced from the active sample assignment; saving it does not claim a native chat notification or start an executor. Build/test logs and receipts remain in `G:/rtxforge-build/sample-library-20261021`.
