Read [AGENTS.md](AGENTS.md), the shared Codex/Claude bootstrap, before project work. It selects the current canonical Bible, ownership/revision gates and attribution policy. Adapter capabilities and limits are documented in [execution continuity](docs/relay/EXECUTION_CONTINUITY_20261020.md).

The credential-free native task adapter currently proves Codex native tools only; see `docs/relay/NATIVE_CONTINUITY_20261020.md`. Shared canonical acceptance does not imply native Claude task control.

Test maintenance follows the shared workflow in `AGENTS.md`. Claude's Playwright Test Agents adapter is `npx playwright init-agents --loop=claude`, run only when the project's Claude definitions are missing or Playwright changed.
