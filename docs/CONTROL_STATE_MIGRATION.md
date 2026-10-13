# Relay control-state migration

Source snapshot `4e74c707282c1eaac8fba63289a8bd295897d38c` from `lrnolivia/loew-runner`. `contracts/control-state-import.json` records every source blob and directory count. Every existing claim, queue, project, worker, report, assignment, contract, QA helper record and execution document is imported. `coordination/relay.json` is the canonical continuation of the inspector-managed product, preserving exact assignment/owner/branch/history. Legacy registries are compatibility snapshots, not new authorities.

The shared R2 EVIDENCE binding, Visuals/run/session/QA keys and historical artifact identifiers stay unchanged. No new evidence bucket, approval registry or scheduler is created. Old ids remain historical identities and compatibility input aliases; active canonical Relay coordination uses `projects/relay.json` and `coordination/relay.json`.

Before live binding cutover: refresh original Runner main; compare all imported live record hashes; reconcile any changed state; verify remote canonical counts and exact claim identities; merge exact green source; then deploy the authority binding change and read through Relay's native tools. Keep the old authority available until this proof is complete. Source snapshot changes are a stop/reconciliation condition, not permission to overwrite concurrent work.

The old Runner project's active owners remain reserved in their original migrated coordination record. Their paths, branches, evidence and owner ids are preserved; no expired claim is taken over. Standalone branding/shell roadmap items are preserved as historical intent and must be explicitly marked superseded by the one-product consolidation before retirement.

Freeze bridge: Runner PR #45 merged at `3972446e667b956961f21eaeeb98d29a99f6b8fb` with all source record values compared before merge. Original records are frozen; canonical copies omit only the freeze marker and retain original reservations.
