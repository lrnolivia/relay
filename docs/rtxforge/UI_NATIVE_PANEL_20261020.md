# Windows UI and native panel integration

Source: 4fb267a31c8cb3dce0517d372af0cf4406fc6cb5, PR43. Native delivery: PR38, exact preserved head 24e16dc2ee1383277c46c731962e55be325eed64.

## Coordination decision

Lauren authorized adoption and merge of the final native delivery. Its separate checkout was clean at the delivered head and remains untouched. The native assignment was superseded into the existing Windows assignment through the canonical coordinator, retaining the branch, PR, original acceptance and recovery evidence. Retirement receipt ce43539ffe8930a61842eb6f80af21f7f03c3c6f; full replacement scope receipt abe5950b3d5e31a0720fc8f8124aae39b3bcf1bc. The existing Windows assignment's goal, branch, PR28 and recovery records were preserved. Preflight passed with the four reclaimed native paths and native startup resource. PR38 is integrated as an ancestor of PR43; the former native branch is retained.

The context connection requires reauthentication. This Git note is the durable fallback; no context entry or revision was fabricated.

## Current Windows behavior and Linux parity

- Game Mode Settings keeps its categories and ordering in a single full-width list, with roomier cards and leading semantic icons. Do not return to multi-column settings lanes.
- Game Mode Presets uses the available content width. Library, Presets, Settings and Details share responsive outer insets of 32/48/64 design units. The Details rail fills the workspace; no gap before hero art.
- Desktop and Game Mode Details heroes contract while content scrolls. Scroll handling does not recreate controls or query the engine.
- Only Game Mode Library hides filters when scrolling down and reveals them on upward scroll or focus. Desktop filters stay visible.
- Remove the unused Library grid row; the compact/footer heights are 48/58 design units with 8-unit vertical padding.
- Input hints switch on controller activity, including gamepad key messages and trigger/right-stick activity. Small stray pointer changes must not immediately replace controller hints.
- Footer and controller guide share circular vector prompts. Xbox: green A, red B, blue X, yellow Y. PlayStation: colored cross/circle/square/triangle. Nintendo retains physical south=B/east=A/west=Y/north=X positions. Steam Controller uses neutral ABXY circles. Add Steam to both settings selectors. Steam Input may expose a virtual Xbox device; manual family selection remains available.
- Desktop-only main Settings > Appearance > Game Details chooses in-app tabs or a separate window with a section sidebar. Shared preference: separate_game_details, default false. The separate window follows the main resolved theme and scales its initial size for display DPI. Dialogs and feedback use that window.
- Linux should default to tabs inside the main Desktop window and retain its existing separate-window option under the same main Settings preference. Game Mode stays embedded.

## Native panel

PR38's HDR colors/text, commit-on-release NR sliders, 400 ms rebuild spacing and MFG On/Off plus Auto/Custom/Dynamic controls are retained. Main already contains the required ForgePanelIcon.h LF rule. This integration adds a neutral Reset button and normal-height Disable shortcut action. Candidate source digests were refreshed; no candidate performance or default-promotion flags were changed.

Native Dynamic MFG Save/replay remains pending: protocol 6 does not carry that state. The app's reviewed INI preset path supports Dynamic. Do not describe native Save as supporting it or silently extend the protocol without matching engine/schema tests.

## Verification and local installation

Local x64 build/publish passed. The native source/route suite passed (3 tests); companion controls passed (24 tests); the C# fixture passed 50 prompt/mapping/default/serialization checks. Rendered preview checks covered full-width Presets, categorized Settings, roomier Details cards and scrolling, light Settings, circular controller-guide glyphs, and detached Details creation/close, DPI size and resolved theme. Physical controller switching, new native runtime performance, and Linux rendering remain unverified.

Installed on Lauren's PC from source 4fb267a. Installer SHA256 c6eb9e4085da1c33bab3e55255d480c246747fb0b5ecb095be3065c4790708e6. Eleven installed files match the staged app/private .NET/native archive. Settings were byte-identical through installation; test theme was restored to system and separate details to false. Scratch receipts: G:/rtxforge-build/ui-cards-native38/installation.json and install.log.

The installed native archive was retained at SHA256 f1e8840813d7236daa73b944cdeb3ae7f64499daf84be4f126bfc0a7fda77778; this UI installation did not rewrite game packages. The existing helper was left running from its prior location. Retained rollback: G:/rtxforge-build/ui-overlay-glyphs/self-contained-setup/rtxForge-Setup-1.0.0-rc.1-x64.exe, SHA256 0e1c843b0de9bb26d52d6018aaa441cf6fad8130c7bbfc9c8e329e1ee1a156eb.

Exact-head Windows CI is running (39537476902). Merge PR43 and PR38 through human Git only after checks pass. No beta/dev public release is authorized by this receipt; the owner's final UI/overlay acceptance gate still applies.


## Current checkpoint: 727e4fb

Source 727e4fb94db6996b7921d4de52d137ea4bb831af includes roomy centered Game Mode fields, frameless detached Details controls and sidebar glyphs, a native back icon, foreground-only Valve desktop Raw Input activity and WGI/XInput gamepad paths. Windows installer CI now bundles the exact native panel artifact; fresh enabled native NR installs use that bridge. Native overlay update review preserves configuration, runtime pins and original restore boundaries, with atomic metadata/loader update and tested rollback. Candidate archive 7dbd778475f3d73e9a7cd4b67ca561137ad0afcab91cf5562e457469f957191e has unchanged native source from d67. Local source tests and self-contained publish passed. CI39539513035 and39539513048 remain pending. No installer/helper/game promotion has happened for this source. Computer Use immediately reported Escape stop after owner resume; UI acceptance and actual Steam Controller detection remain unverified.

Live state inventory excludes retired records:26Skynizz bridge games,7legacy MFG games,5Feeder games. Native updater supports verified Skynizz bridge recipes only. Other loaders are explicitly preserved and shown as unavailable; all-game deployment acceptance remains incomplete until their compatible route is resolved. Do not replace ReShade/Feeder with an unrelated proxy.

New public-release gate from owner: target Universal MFG1.6.1 and only add live DLSS presets when using that route. Existing working integration is the y4my Ada unlock ported into Skynizz NR, using OptiScaler10.0. Universal1.6.1 is pinned as candidate, not installable or game-verified. Verify NR composition, disable the integrated competing unlock, test controls, restore and real gameplay before public promotion. No comparative speed/reliability claim is established. Native Dynamic preset save remains a recorded follow-up.


## Consolidated owner notes: current UI, packages and delivery

This checklist preserves the owner's current requests and earlier related acceptance. It does not reset the original assignment or mark a request complete merely because it appears here. Current installed source is 727e4fb94db6996b7921d4de52d137ea4bb831af. Branch head is 9ebd6b21bf4c2ff144de03aab1de4c4c34189875; subsequent sticky-hero, glyph, overlay-label and window-chrome changes are uncommitted and not installed. The custom rounded back button in that head was explicitly rejected and must be replaced by the actual NavigationView back button before the next install.

### Desktop navigation and shared presentation

- UI01: Use the actual native WinUI 3 NavigationView back button on Desktop, at its normal size and with its native highlight. Keep the hamburger at the far right with normal padding; collapsing the sidebar must leave a visible way to expand it.
- UI02: Keep NR Only / MFG Only / NR + MFG anchored to the content area's left edge, with generous internal padding; changing installation action labels must not move them.
- UI03: Use US English. Replace oversized Technical details disclosures with compact information buttons wherever present; diagnostic copy must not break layouts or dominate installation reviews.
- UI04: Keep actionable review text plain and short, with small supported/unavailable feature badges, reasons and readable action labels. Preset actions should be horizontal, right aligned and ordered for normal users.
- UI05: Keep responsive cards and horizontal groups where they use space well, with narrow-window list fallback. Preserve native WinUI components on Desktop. Fix Light-mode contrast and harsh focus borders/shadows across Presets and Game Details; retain rounded, restrained accent-aware focus treatment.

### Settings and Game Mode

- UI06: Game Mode Settings retains its organized categories but uses full-width single-column card lists, not multiple columns. Add internal padding and breathing room. Make the right-hand option fields a little wider and center their contents.
- UI07: Apply leading semantic glyphs consistently to Settings categories and Game Details cards/sidebar rows. Increase glyph-to-label spacing in Game Mode. Desktop Global and Overlay categories need their missing glyphs too.
- UI08: Align Desktop and Game Mode Settings categories and grouping, including moving appearance options out of System. Put descriptions inside their cards; place the overlay shortcut and its controls together in a normal settings row.
- UI09: Choice settings open a menu rather than immediately cycling. Align choice popups beneath the right-side option/chevron. Selected/focused items remain rounded and readable in Light and Dark modes; noninteractive branding must not be selectable.
- UI10: Game Mode Library, Presets, Settings and Details use consistent, slightly larger side padding and the available width. Presets should not remain a narrow column. Remove the Library's unnecessary bottom gap and keep the bottom bar compact.
- UI11: Hide the Library filter bar on downward scroll in Game Mode and reveal appropriately on upward scroll/focus. Keep Desktop filters visible. Use skeleton cards for library loading; no extra spinner is needed when skeletons are present. Keep distinct loading, empty and error states, with fast cached first paint and fresh discovery.
- UI12: Poster titles may wrap to two lines and library items can scale a little smaller.
- UI13: Controller activity should immediately switch hints, including Steam Controller desktop/Steam Input behavior. Use consistent circular, system-colored glyphs for Xbox, PlayStation, Nintendo and Steam, with Auto plus a manual family override. Physical Steam Controller acceptance remains unverified.

### Game Details

- UI14: Shrinking heroes must remain sticky while the content scrolls, on Desktop and Game Mode. Keep the Game Mode sidebar full height and remove the gap between it and the hero.
- UI15: Desktop main Settings chooses embedded tabbed Game Details or a separate window with a glyph sidebar. Linux defaults to embedded tabs and retains a separate-window option. Game Mode remains embedded.
- UI16: The separate window defaults shorter and wider, matching the owner's Avatar example. Keep it frameless. Use a circular close button over the hero, with a matching minimize button revealed to its left on hover. Both need stronger, more opaque hero-tinted surfaces and a hover region/delay that leaves minimize clickable.
- UI17: Improve hero title readability by moving the content lower / making the hero taller, rather than raising the gradient over more artwork. The game title gets the strongest game accent; neutral text and icons keep hierarchy. Use sensible 4K scaling, around the requested 130% Game Mode baseline.
- UI18: Put hero pills immediately after the developer/date line in both modes, without artificial Game Mode indentation or far-right displacement. Wrap naturally. Show the primary/first-listed developer instead of long studio lists; Ubisoft studio lists should display simply Ubisoft. Preserve full metadata outside the compact hero.
- UI19: Refresh all Game Details sections with consistent responsive cards, glyphs and padding; keep genuine lists as lists and place small related cards on shared rows. Remove redundant Overview information already present in the hero.
- UI20: Performance / Presets must fit their intended workspace without a needless long vertical scroll. Keep desktop, Game Details, modal and Game Mode presets aligned with the overlay's options/order/units while using appropriate native controls. Remove stray panel backgrounds and cramped embedding.

### Presets and overlay

- OV01: Spell out Multi-Frame Generation. Use an independent MFG On/Off switch, put 5x and 6x in the multiplier button row, and offer Auto / Custom / Dynamic tabs. Preserve these semantics across app and overlay.
- OV02: Retain Unified controls and rename Classic to Advanced. Advanced mirrors available native controls and their real units, including 0.0–2.0 values rather than silently converting them to percentages. Include supported NR tuning, anti-flicker controls and sharpening when the installed package exposes them.
- OV03: Overlay is a minimal rounded left-side game-rendered panel, with subdued translucent dark surfaces, soft shadow, restrained tonal game accents, neutral rtxForge branding/icons and strongest accent on the game title. Use quick scale-and-fade open/close motion and matching minimal card treatment across sections.
- OV04: Overlay requires an eligible focused game, detects that game automatically and does not expose a game selector. It must not raise the Windows taskbar or behave as a normal foreground window. Keep idle/closed performance lightweight and measure before making performance claims.
- OV05: Current chosen shortcut is Backtick/tilde, with custom binding. Preserve OptiScaler and ReShade's own controls/keys. Keep both rtxForge and original/native interfaces available through settings.
- OV06: Name overlay choices rtxForge and Native; Native refers to original package interfaces, including OptiScaler, Feeder and ReShade as applicable. Remove obsolete native-panel window material controls. Keep overlay visibility and startup/welcome messages independently configurable per supported component, preserving the working hidden Feeder/ReShade intros.
- OV07: Keep a settings gear beside close and expose the same Overlay settings there. Save preset and Reset share the panel width with distinct green/save and red/reset roles. Feature-status pills must distinguish installed/owned files from actual runtime activity rather than overclaiming live status.
- OV08: Global is a one-time reviewed bulk change to installed games, with a globe entry in app and overlay, consistent card styling, quick review and useful per-game unsupported/running/error reasons. It must not silently become a persistent override.
- OV09: Native Dynamic MFG Save/replay is still pending because protocol 6 does not carry that state; implement matching engine/schema behavior and verification before claiming it works.

### Feeder and installation routing

- PK01: Feeder source files must live in reusable rtxForge-managed package storage rather than depending on a Sims 4 game directory. Import/verify the local stack once if needed. Preserve verified original backup manifests and restore data; do not discard them when improving the setup UI.
- PK02: Feeder must coexist in the app with selected DX12-friendly providers. Choose the compatible route per game automatically; users must not deselect Skynizz/another package or change global mode merely to install Feeder NR on a compatible game. This request does not assume two conflicting proxy loaders can safely be combined in the same game's directory.
- PK03: With NR + MFG selected, review and offer whichever feature each game actually supports instead of dropping all partially eligible games. Feeder can supply NR-only where applicable; show its actual limits in the review and keep the primary DX12 selection intact.
- PK04: Fresh Feeder installs include the compatible ReShade, Feeder, RenoDX, shaders and selected verified NR runtime. Recognize/adopt existing TS4 and Mass Effect installations and mark verified managed installs active. Keep Adoption and adopt-and-clean-install available across compatible packages, with a review surfaced after rescan.
- PK05: Keep NR off by default on fresh installs unless Enable on launch is explicitly checked in sensible, limited locations. Preserve tuning, backups and restore boundaries. Continue support for native DLL updates on the normal install route.
- PK06: Keep Curated Packages complete and responsive, with clear NR/MFG components and a release selector rather than a free-form version box. Open Folder must work from Game Details. Rescan, Add folder, removal, pinned-build identification/artwork and fresh eligibility checks remain required.
- PK07: Honor explicit offline exceptions for anti-cheat titles, including the user-verified Gears campaign route, without advertising online compatibility. Recognize/manage the working package through Adoption rather than silently losing it from installed status.

### Shipping, storage and parity

- SH01: Ship the exact rebuilt bridge, helper and engine together. Install the helper through the normal desktop context, verify its real HKCU settings from outside the shell's private registry layer, and update every compatible managed NR/MFG game. Fresh enabled installs follow the same path. Unsupported package families must be identified honestly and preserved.
- SH02: Bundle the private .NET runtime so installing the app does not require the user to chase a missing framework. Preserve current settings through installation and retain exact rollback artifacts.
- SH03: Manage app data growth across recovery snapshots, package/transaction state and engine state, with retention, clear accounting and protection for required restore data. Preserve the earlier request to identify what cannot safely be deleted.
- SH04: Keep a complete Linux parity handoff for app/UI/package/overlay/settings changes and honest platform validation gaps. No Linux runtime compatibility claim follows from Windows success alone.
- SH05: Carry the user's authorized merge/install path through current checks, but retain final release gates. Target Universal MFG 1.6.1 for the public NR + MFG composition, disable competing integrated unlocks for that route, verify provenance/install/restore/controls and actual RTX40 gameplay. RTX20/30 remain upstream-reported and locally unverified; no unavailable hardware test is invented.
- SH06: Only pursue live DLSS preset switching with the Universal MFG route, per the owner's latest direction. Do not imply the currently installed integrated Ada bridge is Universal 1.6.1.

### Verified installed checkpoint, superseding the earlier prepared-only wording

Source 727e4fb is installed from installer SHA256 908327c9726bb3818e93f1edac2ef005dcd677995461b525c9a14ea5bb6515f1. Eleven staged/installed file hashes matched; private .NET is included. Settings were preserved through setup, then controller glyph preference was set to Auto to match the owner's requested behavior. The installed helper was launched under Explorer, acknowledged reload commands, and a read-only probe launched outside the shell process tree confirmed actual desktop HKCU PanelKey=192, modifiers=0, InGamePanel=1.

Native archive 7dbd778475f3d73e9a7cd4b67ca561137ad0afcab91cf5562e457469f957191e was reviewed/applied to 26 managed Skynizz game targets with no errors and verified resulting write hashes, unchanged tuning and original restore boundaries. Five Feeder installations were preserved; native-panel support on Feeder is not established. Seven legacy MFG records point to missing old executables, not seven additional live games. Retain their backups. Receipts remain in G:/rtxforge-build/ui-cards-native38/next-installation.json, overlay-rollout-review.json, overlay-rollout-result.json, helper-next-receipt.json, overlay-real-registry.json and legacy-record-check.json. These facts are installation evidence, not acceptance of the newer uninstalled UI changes.

Next coherent batch: restore the true native Desktop back button, finish hero metadata wrapping/Ubisoft abbreviation, replace game-dependent Feeder setup with owned package inputs and automatic per-game routing, then compile/test the pending UI and exact native artifact before installing another candidate. No public beta/dev release, Universal compatibility, physical Steam Controller acceptance or native Dynamic Save completion is established by this note.
