# Web-family release contract — 2026-10-01

Field, loew.fi, loewtorials, and The Take already had working GitHub main → Cloudflare Workers Builds connections. Relay's missing transport fields incorrectly labeled them manual. This repair aligns the registry with actual build evidence.

Normal path: admitted branch → PR → required project validation → main → Workers Builds → build/deploy → Relay verifies. Ordinary source upload is rejected before source reads/cloud requests. Explicit recovery or diagnostic purpose is required by schema and handler; canonical Relay source upload remains disabled even for recovery. Prefer known-good version rollback. The bounded uploader retains its existing JSONC/module-only limits and is not a static assets build system.

| Project | Build | Deploy |
| --- | --- | --- |
| field | npm run build:all | npx wrangler deploy |
| loewfi | pnpm build | npx wrangler deploy --assets ./dist --compatibility-date 2026-08-28 |
| loewtorials | none; static files + Worker | npx wrangler deploy |
| thetake | npm run build through Wrangler build.command | npx wrangler deploy |

Production triggers retain main, root /, commands, credentials, bindings and repository IDs. Caching is enabled. Exclusions: coordination/**, assignments/**, docs/**, .github/**, AGENTS.md, README.md, LICENSE, NOTICE. Existing preview triggers are preserved. Field's existing repository ID 1384739474 resolves to lrnolivia/field; its stale revyme-loewfi connection display name was corrected without creating a second connection.

## Exact-source evidence

The latest existing successful production push builds matched current GitHub main when read on 2026-10-01:

| Project | Main/build SHA | Successful build |
| --- | --- | --- |
| field | 06c2b0e00c45451e72a7de1c7382f6b0b53df3c0 | dd215346-a318-4ff8-8518-df2962c6243b |
| loewfi | 82cf4225187ba63cd5f69e819149f208a5db5bb1 | e3c3499b-94b9-4186-a30b-f9d479255eba |
| loewtorials | a2f4821ac059d03247cc9aaf65f2f5a065e84205 | 81fb46b8-1611-4c42-b056-727ac4c0b983 |
| thetake | 3645a887b75d1a83ade5969ab2bdc8e45936b2cc | a26dfca8-8e19-4522-b88b-722ea7102a3d |

These are existing successful builds, not new post-change product builds. Trigger settings were independently read back after edits; product commands and targets are preserved. Runtime checks and exact policy deployment are recorded in the PR/completion receipt.

## Validation and limits

17 focused uploader tests pass: all four ordinary releases fail before any source/cloud call; explicit recovery/diagnostic uploads work; Relay source upload stays disabled; binding inheritance and timeout reconciliation remain covered. Run the exact PR's full Relay quality and coordination admission checks before merging.

This contract standardizes transport/policy. It does not claim Cloudflare waits for GitHub Actions or that the four project-specific quality workflows are consolidated. Preserve existing required checks and validate product changes using each registration. No product binaries, routes, authentication, data stores or bindings change.

Recovery: reviewed policy revert or known-good version rollback. Previous trigger cache/path settings are retained in Cloudflare build history.
