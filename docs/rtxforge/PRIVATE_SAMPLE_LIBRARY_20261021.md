# Private full-library sample — 2026-10-21

## Delivered and open

Lauren explicitly requested a fork of the recent native preview, or replacement of its preview library, so she can curate a real-library-derived sample without touching the real library. The private native sample is open, responsive and left alone for her. No screenshot, input or window resizing occurred during validation; only a read-only accessibility observation. The Control screenshot foreground hold was honored and released by the capture owner before launch. Actual Control game was not closed or controlled.

- App: C:/Users/lrnol/AppData/Local/rtxForge-samples/app-20261021/rtxForge.exe
- Arguments: --sample-library "C:/Users/lrnol/AppData/Local/rtxForge-samples/full-library-20261021-v2/library.json"
- Desktop shortcut: C:/Users/lrnol/OneDrive/Desktop/rtxForge Sample Library.lnk
- Sample profile: C:/Users/lrnol/AppData/Local/rtxForge-samples/full-library-20261021-v2
- Private preferences/removals: profile/rtxForge/settings.json; selections: profile/selection.json; simulated install state: profile/game-state.json.
- PID36172, HWND5509590 at verification. Refresh identity before later interaction.
- UIA observed Sample badge, expanded sidebar, Poster View and authentic real-library card/title/image elements. Virtualization exposed the current rows without scrolling. The manifest/service retains all53entries; no unsupported/tool/duplicate installation rows were dropped.
- Artwork:140actual copied local files:50posters,51capsules,51heroes. Missing local poster for1666uses Steam CDN fallback; the two Valhalla test entries genuinely lacked artwork and retain natural fallback.
- Exact reused UI source: ac901ad719d9b896aa0bf3616524e1a2da3e0b56. Private tooling source:0c2f427e0c958471d0d5ccc5d690b54523436100. DLL SHA256ad797d4ae44f002c826a340964303efbb41c5c7874c42de5974d273e0f514f06.

## Isolation and verification

The existing preview shared live ForgeSettings, so replacing only its eight demo rows was insufficient. The private fork redirects every local-app-data reference to its own profile, uses a profile-specific settings mutex, requires a validated manifest, prevents real engine startup, and replaces every helper registry/pipe/startup operation with inert methods. Existing preview engine actions remain simulated/disabled; private game IDs and locations cannot reference real installation targets. Fresh sample installed/tested/managed/recovery state is clear. No real credentials, notes, package records or recovery ownership were exported. Catalog and artwork stay private, outside Git and releases.

Native build passed with0warnings/0errors. Twenty checks against the actual compiled service/settings implementation passed, covering remove/relaunch, selection/relaunch, independent settings/static overlay edits/clones/preserveOverlay, persisted simulated install, refusal to start the real engine, missing/malformed manifest failure and unchanged live settings bytes. Export fixture passed for duplicate installations, display-field allowlisting, extensionless cached artwork, repeat-export refusal and output containment.

Live settings SHA256remained6d9789842ff569e6b09e2b3457e29427762badfc1bfd5b3f62b747a5f6e72d8b through tests and actual sample launch. Source/real game files were not changed. Current live helper and the current implementation checkout were left untouched. Original source at C:/Users/lrnol/Repos/rtxForge-skynizz is read-only input; this tooling has its own worktree C:/Users/lrnol/Repos/rtxForge-sample-preview and admitted scope windows/sample-preview/ only, resource rtxforge-private-capture-sample.

The G: artifact junction caused padded intermediate XML, so generation/build moved to a normal C: private source directory. Custom dotnet build output omitted loose XBF resources; packaging the14compiled XBF files resolved the diagnosed Cannot locate MainWindow.xaml startup error. Older sample-launch-error.log entries describe those resolved attempts, not a current crash. No failing candidate was installed over the live app. Generated source is at C:/Users/lrnol/AppData/Local/Temp/rtxforge-sample-20261021/source; durable raw build/test/delivery receipts are in G:/rtxforge-build/sample-library-20261021. App executable/runtime/artwork are ready for continued private use via the shortcut.

Game Mode uses the same catalog, service, persistent selection/removals/settings. Its rendered appearance was not navigated/verified because Lauren is curating the open Desktop sample. No image/pixel-perfect rendering claim is made from UIA. Normal existing window sizing is retained; no imposed geometry or resize.

## Coordination and remaining boundaries

Assignment rtxforge-private-sample-library-20261021, owner01a13ce6-a9d7-7790-a1a8-58b870d22789, branchrtxforge/private-sample-library-20261021. Separate generic tooling draft targets the existing Windows provider branch so its source diff is confined to the nine new tooling files; no application release or merge was performed. The current Windows implementation owner retains all existing source, WIP, goals and public-release gates.

The beta screenshot worker01a15ad4-0fe2-7230-a024-20a4a4dba118 was successfully messaged with exact paths/counts/hashes/runtime identity and the curation boundary. **Do not interact with, resize or photograph this sample until Lauren says trimming is finished.** Preserve her sample selections/removals/preferences. Refresh actual geometry after her go; do not confuse original2913x1754screenshots, historical2909x1752client and2935x1765outer dimensions. Future coherent Windows screenshot refresh/public website publication remains with that worker; private sample setup does not complete media acceptance.

Parked separately from sample work: Control overlay Reset label disappears on its normal white surface and becomes readable on hover; game HUD/objective text draws through/over upper panel. The capture worker has authentic Mac originals. Exact compositor cause unverified. Do not retouch or publish that defective overlay, or interrupt sample curation to fix it. Real install video remains deferred and must not use simulated sample progress.
