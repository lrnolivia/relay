# loew development cadence

This doctrine applies to every Relay-managed loew project and future product.

## Default release shape

Prefer small, coherent, independently verifiable patch releases (`x.x.#`) for architecture, tooling, contracts, integrations, migrations, and other slices that can safely ship on their own.

A minor or major release may remain the product umbrella, but useful architecture should not accumulate behind one long-lived branch when it can be deployed and tested independently. A patch release must represent a meaningful boundary; do not create version churn for trivial internal edits.

## Canonical patch loop

For each independently shippable slice:

1. finish the smallest coherent owned change;
2. run required tests and exact-head admission;
3. merge the exact admitted source;
4. deploy/release the exact merged source when the project has a runtime;
5. verify runtime/readback against the exact release identity;
6. when the patch changes MCP tools, schemas, contracts, client discovery, plugin/app metadata, or another consumer-visible integration surface, refresh/reload that integration;
7. reopen or refresh the consuming client/session when required for it to discover the new surface;
8. verify the newly exposed surface from the consumer side;
9. resume subsequent work from that new canonical state.

Do not force client refreshes for patches that cannot affect the consumer surface.

## Scale and transport doctrine

File size, document length, context size, or MCP/request payload ceilings are transport constraints, never reasons to abandon or defer valid work.

Workers and Relay should automatically choose the smallest safe mutation strategy available:

- precise patch/edit over full-file replacement;
- append-only entry over rewriting a growing ledger;
- indexed/sharded documents over an endlessly growing monolith;
- bounded chunks with deterministic ordering when one mutation cannot fit;
- summaries/indexes for discovery while retaining exact source fragments;
- exact-SHA/CAS validation and readback across every mutation strategy.

A logically single artifact may be physically sharded. Its index, IDs, links, ordering, and retrieval contract must preserve the experience of one coherent document for humans and skills.

When a size limit is encountered, the canonical response is to change the transport/storage strategy and continue. Never bypass ownership, provenance, exact-head safety, or canonical tooling merely because a payload is large.
