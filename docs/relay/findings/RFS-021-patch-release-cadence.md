# RFS-021 — all loew development should prefer independently shippable patch slices

**Status:** adopted as forward development doctrine; implementation owned by Relay 1.9 planning/coordination skills  
**Class:** architecture

## Observed

Large release umbrellas can accumulate multiple independent architecture changes before runtime, MCP tools, client metadata, and real workflows are refreshed against the newly shipped state.

## Impact

Workers can build against stale tool surfaces for too long, branches become harder to resume, and integration surprises arrive late.

## Suggestion

Across every loew project, prefer coherent `x.x.#` patch releases for independently deployable architecture, tooling, contracts, integrations, and migrations. After a patch that changes MCP/tool/schema/contract/client-discovery surfaces, use the canonical sequence:

exact-source merge/deploy → runtime verification → refresh/reload integration → reopen/refresh consuming client/session when required → verify new consumer surface → continue from the new canonical state.

Avoid both giant architecture batches and meaningless version churn.
