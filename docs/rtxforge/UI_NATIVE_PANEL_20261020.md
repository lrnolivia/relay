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
