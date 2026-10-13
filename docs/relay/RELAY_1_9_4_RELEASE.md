# Relay 1.9.4

Relay 1.9.4 establishes the canonical named staff identity layer.

## Ships

- Sticky staff identities with active, reserve, and retired lifecycle.
- Initial active cast: Julian, Valentina, Vivienne, Naomi, Ellis, Luca, Nico, Margot, Roman, Imani, Rafael, Adrian, Gabriel, and Sabine.
- Approved reserve: Mateo, Bianca, Dominique.
- Felix is explicitly retired and protected from automatic reuse.
- Human roles, role affinities, subnet/subsystem memberships, and optional worker bindings.
- Compact personality profiles for presentation/communication only.
- Deterministic staff lookup and candidate resolution.
- Explicit binding helper that requires canonical owner identity and refuses retired staff.
- `relay_staff_directory` read-only MCP tool.
- Strict machine contract in `contracts/staff/registry-v1.schema.json`.
- Human directory in `docs/relay/staff/DIRECTORY.md`.

## Safety and authority

Names never grant authorization. Runner owner ids, path/resource ownership, leases, admission, and exact-source rules remain authoritative.

Personality never changes technical truth, evidence, permissions, or safety. No canned joke bank or autonomous relationship engine is introduced.

## Tests

Tests cover canonical roster counts, active/reserve/retired names, case-insensitive sticky lookup, retired-name protection, owner-preserving bindings, deterministic role/subnet lookup, personality policy, validator failures, and the bounded directory read contract.

## Next

The skills-runtime release will consume these stable identities for role-driven skill posture. Planning/communication will later add Julian-managed relationship context and staff-to-worker assignment history without changing authorization semantics.
