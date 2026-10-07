# Human-language website and review slice

Base: `ba35b3344ec379d5fdc61cd3b0fc318d46b2acb1`, after the verified GW deployment-permission release in PR178. The separately preserved favicon patch is excluded.

## What changes

- Unknown query and command results say “Update available,” without implying a write was recorded. Operation and mutation facts remain unchanged.
- Website work labels reuse the common state formatter. Reservations mean waiting to start; an enabled worker does not promise a scheduled run. Opening a pull request does not claim readiness for review, and recording a deployment does not establish live verification. Unknown and prototype-like values keep a conservative string fallback.
- Review controls explicitly say “Mark review complete,” “Mark out of date,” “Archive completed reviews,” “Archive out-of-date reviews,” “Reopen review” and “Restore to review list.” Existing action IDs, exact loaded-item scope, confirmation, source identity checks, and reversible Undo remain intact. Cancel restores focus to the originating action.
- Successful per-item receipts give grammatical confirmed counts. Missing, duplicate or incomplete receipts remain uncertain. A lost write response triggers the existing readback, and the warning survives that refresh. The latest review statuses are displayed without replaying the write or claiming task completion. Sanitized diagnostic detail stays expandable.

## Preview and verification

The existing authenticated, content-addressed retained-preview workflow now also runs for this admitted same-repository draft branch after quality passes. It builds the exact candidate, uses synthetic data, verifies the served bundle, and checks an opaque-origin, network-denying sandbox. It creates no Worker, credential, permission or production binding. Each coherent UI candidate must deliver its verified preview URL and a brief change note; previews are unfinished review artifacts, not release evidence.

Tests cover query versus command neutrality, semantic label distinctions, unknown values, actual generated desktop/mobile review recovery, a saved write with a lost response, incomplete and partial receipts, no mutation replay, confirmed counts, archive scope, Cancel focus, and unchanged task state. All five suites, exact build, source contracts, workerd, browser and post-merge production gates still apply. Browser fixtures are synthetic; they do not prove native ChatGPT behavior or a real human-account review lifecycle.

## Remaining scope and rollback

This is not the full proposed language catalog. Legacy summary diagnostic filtering, notification/Files/execution copy, review quota timing and provider classifications remain explicit open surfaces in the manifest. Existing API codes, payloads and security boundaries remain authoritative.

Revert this coherent source change through the normal checked release path to restore prior website copy and behavior. The preexisting presentation flag remains available for the common MCP/card layer; it does not roll back this website slice. Neither rollback removes review records, task data, source checkpoints or Files tombstones. Preserve the GW permission registration and allowlist from PR178.
