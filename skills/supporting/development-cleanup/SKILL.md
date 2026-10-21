---
name: relay-development-cleanup
description: Reclaim development storage after builds, tests, releases and handoffs while preserving active work, source changes, evidence and usable recovery artifacts.
---

# Development storage cleanup

Use at engineering and release completion, before accumulating another large build, and for requested workspace/storage cleanup. This is a host-executed workflow, not a background daemon. If the current adapter cannot inspect the machine, report that limit rather than claiming local cleanup.

## Keep temporary work temporary

Use the task's scratch directory or the repository's prescribed generated output paths for publish copies, extracted installers, test installations and screenshots. Do not stage every development iteration inside an application's persistent recovery directory. Keep one current candidate and only the additional copies required by an active test or retained recovery target. Reuse unchanged verified artifacts instead of making another full copy.

Before creating a large output, check actual volume free space and the expected output size. Prefer a suitable existing secondary volume when authorized and supported; do not silently relocate an installed application, active checkout or operational state.

## Decide what is disposable

Read current task ownership, Git/worktree status, processes and release/recovery records. Routine authority covers reproducible generated artifacts belonging to the completed task. Unrelated software uninstalls, personal files, cloud documents, conversation history and live application restore records require their own authorization.

Classify by purpose, not folder name, age or size alone:

- Repeated publish trees, old extracted installers and finished test installations are candidates once their writers have stopped and no active process, scheduled task, service or configured launch path uses them.
- Source, dirty/untracked work, local-only commits and nested repositories are retained. An ignored directory is not automatically disposable. Remove an obsolete worktree through Git only after verifying clean state, current merged ancestry, no active owner/writer and no primary/common Git store inside the target. Never force a dirty worktree or delete branches to free disk space.
- Retain the current installed/candidate artifact, the exact last healthy artifact and the distinct last user-approved artifact, including compatible configuration and a usable restore route. Absence of an identifiable approved target is uncertainty, not permission to invent one. A receipt, hash or source commit alone cannot replace required binary bytes.
- Distinguish old developer deployment copies from operational baselines and transaction backups. In rtxForge, `state/runtime-transactions`, engine baselines/targets and interrupted-operation records can supply restoration of changed game files. Do not purge these merely because an operation completed. Keep saves, mods, installed runtimes and their required originals.
- Preserve required QA evidence until its canonical durable receipt/archive is verified under the current Visual Evidence Policy. Publish compact receipts to `lrnolivia/relay/docs/<project-id>/`; do not preserve every temporary full build as a substitute for evidence accounting.

For a requested wider audit, measure actual allocated bytes where available. Cloud placeholders, hard links and Windows packaged-app redirection can expose misleading logical sizes or the same bytes through multiple paths. Do not add aliases together as independent storage.

## Execute a bounded cleanup

List exact absolute candidates, their purpose, measured size, retention decision and current writer/reference checks. Resolve each source and destination within its explicit allowed root before a recursive delete or move. Do not follow junctions or symbolic links into another tree. Preview native cleanup commands and inspect the expansion: a selector intended for a child can match an ignored parent. Prefer exact paths and supported Git/application lifecycle tools.

Immediately before mutation, refresh writer/ownership state and retained recovery identities. Remove only verified disposable outputs in scope. A recovery archive on an authorized secondary volume is a reversible alternative when appropriate; verify destination bytes and retained path references before considering the move complete. An archive on the same volume does not reclaim that volume's space. Never clear an entire shared Temp, application-data or package tree as routine task cleanup.

Respect host policy, permission denials and automatic approval review. Stop the rejected operation and report its exact boundary; do not disguise it as another script, tool or executor. A materially safer action must receive its own normal tool review. Reconcile partial or uncertain outcomes before retrying, and keep unrelated safe work moving.

## Close the task

At successful build/test checkpoints, after verified installation/release and before completion or handoff, perform the applicable cleanup pass. Record removed or archived paths, retained targets and reasons, before/after free bytes and any blocked items. Verify intended source paths/Git state and the installed launch/restore references remain usable. Report actual measured space reclaimed; distinguish C: space reclaimed by archiving from data permanently deleted. If nothing is safely disposable, record that result without manufacturing a cleanup action.
