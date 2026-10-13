# loew inspector documentation ownership

Canonical non-product documentation for `lrnolivia/loew-inspector`.

- `product/` mirrors source-authoritative product docs when a Runner mirror is useful. Repository copies remain authoritative for product truth.
- `handoffs/` is the canonical home for implementation handoffs, audits, continuation records, and execution history.
- `qa/` is the project-specific QA overlay under Runner Bible section 11 and section 18.
- planning, roadmaps, worker notes, research, and coordination records belong here rather than in the product repository.

The product repository may retain README/LICENSE/NOTICE, tooling-required files, source-authoritative product docs, and a thin `AGENTS.md` bootstrap.

- `../../WORK_COORDINATION.md` defines mandatory concurrent work admission and lifecycle under Bible section 20.
- `../../../coordination/loew-inspector.json` holds current atomic claims and the task queue; `../../../projects/loew-inspector.json` sets the project policy and active budget.
- Existing branches present at registration are frozen as legacy recovery provenance. New work must use Runner admission and the registered branch prefix.

## relay worker

- [Relay worker handoff](handoffs/RELAY_WORKER_HANDOFF.md): batched tool foundations, Access hardening, MCP app UI, review/conflicts/approvals, project workflows and field integration. Planned work is distinct from the verified credential/Worker baseline.
