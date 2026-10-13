# relay

Keep project work, the people and agents doing it, and the evidence behind it in one place.

relay is loew.fi's control plane for source, runtime checks, work coordination, and deployment. It helps carry a task from an assignment through implementation and review, with a record of what changed and what was actually checked.

This repository contains the control service, its internal Runner and Inspector packages, and the project records they use. It is an operator and developer tool; using the deployed service requires the configured access and project permissions.

## What lives here

- **Coordination:** assignments, ownership, scoped work, handoffs, and completion records.
- **Runner:** project execution and scheduling, including Night Shift.
- **Inspector:** HTTP checks and browser evidence for runtime verification.
- **Evidence:** screenshots and run metadata associated with the project and build being reviewed.
- **Control interface:** the web application and supporting packages.
- **AI Cleanup:** read-only project scans and source-bound patch proposals that preserve legal notices, human credits and functional AI references.

## Start with the source

Use the toolchain pinned in `package.json`: Node.js 22.23.3 and npm 10.9.9.

```sh
npm ci
RELAY_SOURCE_SHA="$(git rev-parse HEAD)" npm run build
RELAY_SOURCE_SHA="$(git rev-parse HEAD)" npm test
npm run check
```

Build first so the shared web and MCP payloads are available to the tests. Build provenance requires a clean committed checkout. The build checks the toolchain, builds the web application, and records its build identity. Authenticated integrations use the configured project connections and permissions.

## Find the right guide

- [Repository layout](docs/MONOREPO_LAYOUT.md)
- [Work coordination and handoffs](docs/WORK_COORDINATION.md)
- [Visual evidence](docs/VISUAL_EVIDENCE_POLICY.md)
- [Access control](docs/ACCESS_CONTROL.md)
- [Commit attribution and verified human publication](docs/relay/COMMIT_ATTRIBUTION_20261013.md)
- [AI Cleanup scans and patch preparation](docs/relay/AI_CLEANUP_20261013.md)

Runner and Inspector are internal Relay subsystems.

## Runtime evidence

Inspector uses HTTP checks for responses and headers, GitHub Chromium for repeatable browser checks, and Browser Run for exploratory or session-based work. Screenshots and metadata use private evidence storage. A deferred or failed capture must remain visible as such.

For protected loew.fi reads, access is authenticated and navigation is limited to the configured HTTPS destinations. Keep credentials out of source, URLs, logs, and evidence metadata.

