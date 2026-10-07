# Human-language foundation: first bounded slice

Base: `995705af5014663808a0438c4d409861363ae662`, after the documentation-only handoff PR176. Product baseline remains PR175. This is an additive presentation migration, not completion of the full Relay rebuild or the full language proposal.

## Changed behavior

- Extend the existing communication-presentation module with a closed typed catalog, deterministic normalization, safe default output and additive `human_v1` metadata. Unknown results remain unconfirmed. The catalog currently has no free-form interpolated parameters; producer details are allowlisted separately.
- Explicit tool/action metadata distinguishes mixed query and command families. Timeout classification for execution/context/Night Shift/UI commands now conservatively requires readback; it no longer guesses from a name regex. Existing codes, HTTP/JSON-RPC envelopes, `isError`, auth boundaries and machine facts otherwise remain intact.
- Quota deadlines mean request eligibility, never a scheduled retry. Invalid/past observed deadlines do not promise resumption. Unknown mutations and pre-manifest upload failures do not promise replay safety or retained bytes.
- Errors, failed/cancelled checks, partial data and stale observations take precedence over a merged source milestone. A merged PR does not suppress a pending release action. Skipped/neutral checks are distinct from passed checks; observed green checks do not establish complete required-suite coverage.
- Context-card error compaction preserves the error class and retry timing. The current and legacy host bridges use one generated browser model derived from the same server module. The build rejects stale generated model bytes. The existing project/assignment drill-down uses that model for state and summary, including partial-overview warnings and readable event names.
- Short, safe recorded next steps stay visible. Long or opaque version details remain expandable; neither is converted into an invented chat-connection repair. Normal progress uses a typed latest event when present and avoids repeating the state label. User-authored names/goals stay safe content slots. Unknown incoming `human_v1` objects cannot override typed facts.
- Keep the established card layout, host integration, navigation, Files backend and website code unchanged apart from the generated-model build check. The website/Files/review language migrations remain open.

## Compatibility and rollback

MCP text remains in its legacy JSON/prose form; no prose-only text capability is invented. First-party consumers can use the additive `structuredContent.human_v1`. Existing legacy raw protocol/error text is intentionally not claimed as fully migrated or redacted by this slice.

`RELAY_HUMAN_PRESENTATION=legacy` is a presentation-only rollback switch. It omits the new human object and asks cards to use the byte-preserved previous canonical renderer. Setting a deployed variable still requires the normal authorized configuration workflow. Alternatively revert this coherent PR through reviewed source gates. Neither rollback changes task/file data, permissions, source-checkpoint protections or Files tombstones.

`contracts/human-output-surfaces.json` records the covered boundaries and explicit migration exclusions. English is the initial supported catalog locale; other locales conservatively fall back to English. Complete localization and website coverage are not claimed.

## Verification and release boundary

Local baseline recovery independently matched the handoff archive SHA-256, all 773 source files and modes, Git tree, packet hashes and release lockfile. The exact handoff build passed with pinned Node 22.23.3/npm 10.9.9.

Candidate checks include catalog/schema alignment, malformed inputs, hostile diagnostics, immutable machine payloads, provider timing, unknown writes, failure precedence, explicit mixed-tool classification, legacy rollback, actual bundled Worker model parity and both maintained card bridge resources. Browser navigation expectations were audited before CI, including assignment summaries and status labels.

The stage-log fixtures also required disabling environment-injected experimental Node warnings; their original failed log is retained. A process-exit race in an unrelated baseline fixture received one bounded retry, without weakening its assertion. Local Chromium installation was blocked by the environment's domain allowlist. The unmodified canonical local runtime harness drops user configuration variables, then Wrangler expects a writable home directory that this sandbox does not have. These are recorded environment/harness limits, not product failures or passes. No network or auth boundary was weakened, and the source was not changed to hide either limit.

All five required hosted suites, source-contract mapping, exact pinned build, workerd runtime, actual generated browser navigation/captures and authenticated exact-source production checks remain mandatory before promotion. Their exact run/source/deployment receipts must be recorded separately; this document is not a claim those future gates already passed.

## First hosted candidate correction

Run 37604665836 identified the intentionally changed legacy presentation fixture and a real card-size regression. The pure formatter now lives behind the existing communication module facade, keeping the unrelated staff registry out of the browser bundle. The initial canonical Relay icon remains byte-exact and usable without JavaScript; its script reference reuses those bytes instead of duplicating them. The original 512 KiB ceiling is unchanged. The old and new legacy host/style shells were independently compared byte-for-byte and have the same SHA-256, 7f4696e724d991398f6def4dc5b34006f580c59415aec3b478643fec9b37d40c. Only the intentionally versioned presentation program is excluded from that shell hash; its actual generated output retains separate server/browser parity tests.

Pixel review of the ten successful c704061a hosted captures identified duplicated error text and inherited mobile styling that could hide the next step or clamp a material warning. The follow-up hides a redundant non-numeric status metric, keeps the single error explanation intact, and makes an available next step visible on mobile. Numeric counts, real percentages, fonts, canonical images and existing spacing remain unchanged. Dedicated 320px browser cases now assert full quota/unknown-write copy and visible safe recovery text. The prior capture evidence is stale for this correction and must be regenerated at its new head.
