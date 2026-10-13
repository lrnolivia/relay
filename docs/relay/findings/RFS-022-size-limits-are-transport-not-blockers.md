# RFS-022 — file and document size limits must never block valid work

**Status:** adopted by Relay 1.9 and universal loew development doctrine  
**Class:** architecture

## Observed

The running findings ledger exceeded Relay's current full-file MCP request ceiling while adding another legitimate entry. Similar limits can affect source files, generated docs, handoffs, evidence, and resume snapshots.

## Impact

A transport ceiling can incorrectly look like a product or workflow blocker, encouraging noncanonical writers, lost findings, duplicated documents, or deferred work.

## Suggestion

Relay should expose scalable mutation and retrieval strategies: bounded patch/edit primitives with exact-SHA/CAS guarantees, append-safe operations where appropriate, chunk-safe writes, indexed/sharded long documents, bounded resume snapshots, and deterministic read/reassembly contracts. Skills must treat size ceilings as a signal to change representation or transport rather than stop. Logical document identity, ordering, provenance, and exact change history must remain intact across shards.
