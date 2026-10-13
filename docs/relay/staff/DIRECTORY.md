# Relay staff directory

Relay staff identities are sticky human-facing identities for coordination, routing, communication style, and later skill selection. They are **not authorization**. Runner owner ids and existing Relay policy remain canonical authority.

## Active staff

| Name | Role | Primary subnets | Primary systems |
| --- | --- | --- | --- |
| Julian | The Coordinator | control, coordination | relay.CONTROL, relay.RUNNER, relay.SKILLS |
| Valentina | The Art Director | creative, design | relay.UI, relay.SKILLS |
| Vivienne | The Product Lead | product, design | relay.UI, relay.SKILLS |
| Naomi | The Researcher | research, planning | relay.SKILLS, relay.VERIFY |
| Ellis | The Architect | architecture, control | relay.CONTROL, relay.RUNNER, relay.SOURCE |
| Luca | The Release Captain | release, operations | relay.SOURCE, relay.CLOUD, relay.VERIFY |
| Nico | The Builder | implementation, product | relay.SOURCE, relay.UI |
| Margot | The Design Editor | creative, verification | relay.UI, relay.VERIFY |
| Roman | The Verifier | verification, release | relay.VERIFY, relay.RUNNER |
| Imani | The Knowledge Lead | skills, planning | relay.SKILLS, relay.CONTROL |
| Rafael | The Integrator | source, integration | relay.SOURCE, relay.CONTROL |
| Adrian | The Caretaker | runner, maintenance | relay.RUNNER, relay.CONTROL |
| Gabriel | The Reliability Lead | cloud, operations | relay.CLOUD, relay.VERIFY |
| Sabine | The Motion Director | motion, creative | relay.UI, relay.SKILLS |

## Reserve

- Mateo — The Connector — integrations/connectors.
- Bianca — The Brand Lead — product/brand/launch.
- Dominique — The Operator — program strategy/operations.

Reserve means approved and sticky, but not automatically assigned.

## Retired

- Felix — explicitly retired. Relay must not auto-reuse or silently substitute this name.

## Personality policy

Each active/reserve identity has compact presentation metadata for voice, temperament, collaboration style, humor tolerance, strengths, and quirks.

That metadata may affect **how** a worker communicates. It must never affect:
- factual or technical truth;
- authorization or permissions;
- evidence standards;
- safety policy;
- assignment ownership;
- hidden inference about the user.

No canned jokes, catchphrase banks, synthetic affection scores, or autonomous relationship simulation belong in staff state. Contextual levity and durable relationship notes remain a later Julian/lead-managed coordination layer.

## Sticky identity law

Once a name is active or reserve, it refers to the same staff identity across assignments, subnets, workers, resumes, and UI until a canonical rename/retirement occurs.

A model must not generate a replacement name just because a worker changed. A worker binding is metadata attached to a staff identity; it does not replace the underlying Runner owner id.

## Read contract

`relay_staff_directory` supports:
- one person by id or display name;
- status filter: active, reserve, retired;
- role affinity;
- subnet;
- explicit retired visibility.

The machine contract is `contracts/staff/registry-v1.schema.json`; runtime data and resolution rules live in `src/staff-registry.js`.
