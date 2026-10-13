# Relay 1.9.5

Relay 1.9.5 is the first-class skills runtime foundation.

## Ships

- strict portable skill manifest contract;
- deterministic registry with project-private overlay relationships;
- provenance/license/integrity audit primitives;
- exact-byte artifact-ingress law from RFS-027;
- deterministic resolver using task tags, platform, staff affinity, project scope, available capabilities and bounded context;
- runtime load gate that rechecks audit/capabilities and bounded content before loading;
- pinned/manual/tracked upstream drift policy with license-change review;
- staff affinities from the canonical 1.9.4 directory may shape selection but never authorization.

## Design constraints

No ambient credentials. No one-tool-per-skill explosion. No giant permanent prompt dump. Untrusted/executable upstream content does not gain authority by being discovered.

Project-private overlays extend a base skill without replacing or mutating the base manifest.

## Artifact law

When canonical bytes already exist, use exact-byte/binary-safe intake and verify stored byte count + SHA-256. Model-authored reconstruction of existing binary bytes is prohibited. Direct upload to the exact admitted GitHub location is preferred when that is the cleanest transport.

## Tests

Coverage includes manifest validation, path containment, duplicate IDs, capability overlap, project overlays, deterministic ranking, context budgets, missing-tool explanations, runtime re-gating, exact-byte mismatch rejection, upstream license/executable blocks and pinned drift.
