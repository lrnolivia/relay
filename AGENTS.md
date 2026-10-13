# relay agent bootstrap

Universal execution authority:
- `lrnolivia/relay@main/LOEW_CHAT_BIBLE.md`
- `lrnolivia/relay@main/contracts/manifest.json`

Read those before project work. This repository is canonical Relay source and owns its product and implementation truth. Non-product documentation (handoffs, notes, trackers, state, decisions, research, operations, assignments, QA records, release history) lives in `lrnolivia/relay` under `docs/relay/`; write new ones there, never here. See Bible section 18.

Composio is valid for remote GitHub/control-plane operations on any platform. An authorized local clone may also be used where available; local availability does not disable Composio.

If Runner is temporarily unreachable, use conservative fallback behavior: refresh live state, do not invent evidence, bound identical retries, change strategy instead of looping, verify writes, preserve authority/ownership boundaries, park only the blocked path, and persist the next safe action. Reload the canonical Bible as soon as access returns.


Canonical source, coordination authority, runtime and MCP binding are `lrnolivia/relay`, project `relay`, and `https://relay.loew.fi/mcp`. Old repository/project names are recovery references only.

For prospective project commit attribution (Codex, Claude and Relay), read `docs/relay/COMMIT_ATTRIBUTION_20261013.md` and use `scripts/project-attribution.mjs`. Preserve legitimate human coauthors.
