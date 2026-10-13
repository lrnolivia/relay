# Latest decisions and cleanup receipt

Updated October 3, 2026, 05:09 UTC. These decisions override earlier drafts where they conflict.

## Field appearance and shared casing
The user selected this naming direction for the actual existing palette:
- teal: aqua teal
- sienna: sienna solstice
- gold: gold halo
- green: flora green
- coral: terra coral
- monochrome: monochrome
- neutrachrome: lunar chrome

Names are spaced and lowercase; monochrome is one word. Keep monochrome and lunar chrome adjacent. Preserve stable theme IDs, aliases and saved preferences; these are display names, not a destructive migration.

Appearance popover: compact chrome preview at the top, showing sample UI text and the accent name; labeled light/dark switch beneath; clickable swatch row below. Hover or keyboard focus previews color and name without committing. Click/tap selects and persists. Touch has a usable equivalent. Earlier alternative cards/separators were abandoned.

Shared loew design standard: built-in interface chrome and copy use lowercase in branded mode, including buttons, settings labels, brand and theme names. Preserve the user's own page/project names and authored content exactly. Font names inside font previews can retain normal casing; underlying identifiers remain unchanged. Inspect and honor the existing branded/off option if present; do not force lowercase over an opt-out or invent a setting before inspection. This casing audit applies to Field and related ctrl/Relay built-in UI.

## Canonical cleanup mutations completed
- ctrl review-delivery claim is held; draft code and local recovery preserved.
- rtxForge held claim amended with complete handoff link; Julian implementation stopped, including icon integration.
- Relay MCP queued continuation amended with original and latest handoff; user starts Mac Codex, receiver identity still pending.
- Field appearance queue amended; obsolete hold-before-PR138-release instruction removed because PR138 already shipped.
- Ten old queued-only Relay assignments were superseded into the existing MCP continuation, not marked delivered. Full original goal/acceptance remains in original-records/relay.json.
- Documentation and recovery artifacts are in Relay PR138, branch relay/execution-handoffs-20261003. No production deployment.

## Remaining cleanup boundaries
- 41 queue rows still say claimed although matching claims are completed. Their exact pairs are preserved. Current engine offers no safe normalization action; the MCP handoff includes the required narrow CAS-guarded fix. Do not bypass guards or restart them as work.
- The queued desktop-card-parity record remains unchanged after ownership safety review blocked retirement. User approval was requested for supersession into the existing MCP continuation. Preserve its native-client proof requirements regardless of record status.
- Four expired reservations require writer/provenance accounting before retirement: Relay production smoke, Relay minimal probe, Field mobile focus, loewOS bootstrap. Expiry is not authority to take over.
- Actual receiving Codex owner IDs are not known. Documents/code are accessible now; administrative claim/handoff follows when the receiving sessions identify themselves.

## Plugin account cleanup
The user explicitly wants obsolete personal-created entries removed except current Relay App ID asdk_app_6abe234861d881919e30db65d656492f, Version ID asdk_app_v_6abe234861e481919f6452cfb12d250f.
Seven obsolete records remain. The authorized loew Inspector workaround was attempted: both old Inspector entries expose Open in desktop app rather than an Install action; installed-plugin search finds neither, so no Delete control was reachable. Creator tools expose no delete action; uninstall is not deletion of a creation record. No entry was removed and the current Relay remains untouched. Do not claim success or repeatedly retry unsupported routes.

## Additional Field requests at 05:10 UTC
- Main/popup menu items need meaningful glyphs from Field's established animated family, consistent size/alignment and accessible labels. Confirm the actual main popup surface before implementation.
- Find the canonical Field logo in Figma and create matching variants for the actual new accent palette, preserving existing geometry, materials, highlights and family consistency. Inspect current master/variants before recoloring. Use exact theme tokens, editable component/vector exports, and the shared discoverable asset manifest. This is additional variants, not a logo redesign. Source master is not yet positively identified. Design implementation remains paused until cleanup is complete.

## Field toolbar canon at 05:12 UTC
The existing Media panel is the exact reference for every toolbar popup: same width, card treatment, list items, dividers, window sizing and spacing. Measure and reuse that actual component; do not create merely similar wider panels. Other toolbars preserve their functional contents and omit the Browse Media section. Maintain responsive viewport bounds and mobile behavior. This requirement remains queued during the cleanup pause.

## Field inspector refinements at 05:14 UTC
- Carry the newer accented-icon treatment into every toolbar panel, including Media. Media supplies the exact layout/card/width canon; the other panels supply the accented-icon treatment. Only Media retains Browse Media.
- Remove decorative outer panel strokes from Inspector and other panels; preserve the intentional internal dividers and necessary control/focus boundaries. Earlier retrieved notes requested restrained borders/surface hierarchy, but did not explicitly establish this blanket removal. The latest user direction is authoritative.
- Remove/hide the nonfunctional Prototype panel/affordance. Inspect actual supported features; a coherent useful existing function may occupy that area, otherwise remove it. Do not invent prototyping support or arbitrary filler, and do not delete legitimate backend functionality unnecessarily. Older retrieved assignment retained Design/Prototype tabs, so this is an explicit superseding update.

## Field implementation order
Correct the Field right-side Inspector first, including panel separation, supported functions and removal of the empty Prototype surface. Then redesign the left panels to match that corrected Inspector. Do not propagate the current defects as a template. This is separate from the Media panel, which is the exact canonical template for toolbar popups, and separate from ctrl's Inspector review page.
