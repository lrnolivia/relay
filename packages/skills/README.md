# Relay portable skills

A portable skill bundle is intentionally boring:

- a validated manifest matching `contracts/skills/manifest-v1.schema.json`;
- a relative entrypoint such as `SKILL.md`;
- optional bounded references/assets that remain inside the bundle root;
- no ambient credentials or authority.

The runtime resolves skills deterministically from task intent, platform, staff affinity, project overlays, available capabilities and context budget. Required capabilities are gates, not suggestions.

Project-private skills may extend a general skill through `extends` + `project`; they do not fork or overwrite the upstream/base manifest.

Upstream skills remain pinned to explicit provenance/integrity. License or executable-content uncertainty blocks automatic ingestion.

Binary assets follow `docs/skills/ARTIFACT_INGRESS.md`: canonical bytes are transported exactly, never manually recreated by a model.
