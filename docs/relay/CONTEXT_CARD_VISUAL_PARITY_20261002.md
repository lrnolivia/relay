# Contextual card visual parity

## Scope and authority

Finish the user's cards-last pass after the released website polish and retained interactive previews. Inspector's chat-card gallery is the visual authority: preserve its composition, product art, Momo typography and compact density. This is a contextual response object, not another dashboard. The native Linux ChatGPT card absence is a separate, still-open consumer investigation.

## Changes

- The contextual resource advances from v10 to v11. The dedicated render tool keeps its name, schema, annotations and host transport.
- Exact existing Relay, Runner, Inspector and Night Shift PNGs are embedded at build time from `icons/`. Source/Cloud/Release/Skills keep their existing vector symbols.
- A 76 px desktop / 54 px phone mark, 43 / 30 px artwork and Momo feature title match the approved Inspector card. The redundant eyebrow is hidden, and host diagnostics remain available inside Technical evidence.
- Buttons meet 44 px minimum targets. Long labels wrap, screenshots use contain rather than crop, compact widths stay single-column, and focus/forced-colors/reduced-motion are explicit. Ambient animation pauses when hidden.
- Missing, blank, boolean or invalid percentages are unknown. An explicitly reported numeric zero stays zero. This fixes the prior `Number(null) === 0` false-progress display in both the server model and its stable browser-source counterpart.
- The legacy consumer control retains its original model and HTML. Its pre-pass SHA-256 is `b6ac2036387ead1d9e9bd861c510752ec6c6fc9d0ae112e793932075fb0b332b`; the preservation test requires identical bytes. Static probes and original diagnostic resources are untouched.

## Font provenance

Momo Trust Display Regular comes from the official Google Fonts repository, `ofl/momotrustdisplay/MomoTrustDisplay-Regular.ttf`, Git blob `dd404d44335869459b216b0f543c5bbf98fec5d8` (93,640 bytes). FontTools converted the complete, unsubsetted font to WOFF (48,068 bytes). No glyphs or names were modified. The entire copyright and SIL Open Font License 1.1 are embedded as a human-readable CSS comment alongside the font, so every distributed card carries the license. There is no runtime external font request or new CSP domain.

## Verification

Local checks: JavaScript parse checks; four style/model/asset/preserved-control unit tests pass against exact source assets. Full workspace tests and production build run in CI, including the existing actual-bundled-model execution test that guards against esbuild keepNames serialization failures.

`scripts/verify-context-card-visuals.mjs` renders eight exact-head Chromium MCP host fixtures: wide/narrow light/dark, working, review, waiting, blocked, empty, finished and loading. It checks Momo/artwork, overflow, accessible target size, reduced motion, unknown percentages, hidden obsolete next actions, refresh/read-tool and Open Relay actions. Captures are uploaded to Inspector with an explicit fixture/native-not-verified label and read back by SHA-256. The CI artifact includes the receipt.

Fixture success is not a claim that ordinary ChatGPT web, iPhone or Linux native mounting has changed. The old connection-test browser/iPhone evidence does not automatically validate the contextual v11 resource. Record actual consumer results separately.

## Release and rollback

Use the normal GitHub pull request and Workers Builds release path, then verify exact deployed source. Preserve Relay as the working fallback before ctrl migration. Rollback is a reviewed revert of this bounded source diff, retaining the older resource/control identities and all prior evidence. Do not manually upload a canonical Worker or rewrite host transport to compensate for an unverified client symptom.
