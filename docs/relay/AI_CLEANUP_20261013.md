# AI Cleanup — local candidate and integration contract

Lauren approved a project-scoped capability to inventory unwanted development residue, produce a reviewable cleanup patch, and propose lossless migration of misplaced development records. Existing history is separate. This candidate implements an executable local CLI and the backend handler/descriptor for `relay_ai_cleanup`, titled **AI Cleanup**. It is not yet registered in Relay's MCP entrypoint, installed in clients, published, or deployed. Existing source/merge attribution writers remain unchanged.

The existing assignment `relay-project-attribution-20261013`, owner Mac worker `01a132f7-348f-772b-99fb-aabd339d0037`, received an additive scope/acceptance amendment for five new, non-overlapping files. Live preflight admitted them. The held `claude-open` rebuild and concurrent rtxForge design task are untouched. The prospective attribution checkpoint remains `379911c73d4ef624768406a6dbc966faf3520441`; the final AI Cleanup checkpoint and exact validation receipts are provided in the worker handoff.

## Classification before any proposed edit

The scanner treats files, comments and instructions as data. It never executes repository content, follows embedded instructions, or blindly removes words such as AI, Codex, Claude, OpenAI, Anthropic or LLM.

- Exact standalone `Generated with/by Claude Code`, Codex or ChatGPT credits, and the three previously observed tool coauthor addresses, can become selected patch candidates. Source removals are limited to whole comment lines in the file prologue, before the first code token. Markdown candidates are isolated credit lines outside examples/frontmatter/raw HTML. Patches remove those lines only.
- Product AI features, API/model integrations, strings/templates, commands, technical comments, examples, human credits and ambiguous references remain preserved. A name alone is never a removal rule.
- License/NOTICE/COPYING/AUTHORS/CREDITS/CONTRIBUTORS/third-party files, detected legal notices, generated/DO NOT EDIT provenance, binary assets and build/tool configuration are preserved. Protected exclusions are identified in the report and are not represented as fully content-scanned.
- Agent guidance, AGENTS/CLAUDE/SKILL files and `.agents` content are review-only; the capability cannot select them for a generated removal. A required bootstrap can retain a thin pointer after separately verified migration, but no pointer or source deletion is produced automatically.
- Named handoffs, development/session notes, worklogs and similar non-product records in other managed projects receive lossless migration proposals to `lrnolivia/relay:docs/<project>/<original-path>`. The original bytes, mode, blob identity and SHA-256 are retained. Migration source remains in place; external publication, copy verification and caller/reference changes are required before any separate removal. Relay's own docs/assignments/coordination/reports are already canonical and stay intact.

This conservative classifier may leave residue for manual review. It does not claim a complete semantic understanding of every language, document or AI mention.

## Boundaries and identities

Both adapters resolve a current managed project registration in `lrnolivia/relay`. The repository must belong to Lauren and match the registration. Caller-supplied arbitrary repositories, credential paths, glob/traversal paths and mutation arguments are rejected.

Every scan binds project/repository, branch, exact Git HEAD/tree, registry-policy blob SHA, explicit scope and per-file blob SHA. Source bytes are independently checked against Git blob identities. GitHub reads the expected branch head before and after inventory; truncation, incomplete source, byte mismatch and moved heads fail closed. The local adapter reads immutable Git objects, not dirty filesystem content. Local preparation additionally requires the selected working scope to be clean and its HEAD unchanged.

Limits: 64 explicitly named files, 64 KiB per text file, 128 KiB total text, 4,096 inventory entries, 256 findings and 768 KiB serialized review output. Literal scope paths currently use bounded ASCII repository names; unsupported names require a separate manual workflow. Oversize/incomplete input is an error, never a silent partial patch. Inventory lists tracked paths only; it does not claim content inspection. Scans cover only their declared files.

Preparation requires the exact deterministic scan digest and an explicit unique selection of eligible finding IDs. It recomputes the scan from the current exact snapshot. Protected, ambiguous, stale or unknown selections are rejected. Potential sensitive content blocks before/after byte export for manual review. This is a conservative heuristic, not a general secret detector; review artifacts remain private local files.

Plans contain a standard unified patch, exact before/after hashes and bytes, modes, source/report identities, selected finding IDs and a plan digest. `verify` independently recomputes the original source-bound plan and checks the real working bytes/modes in the requested before/after phase. It rejects tampered plans, dirty/stale before state, changed protected/unselected scoped files, unexpected after bytes, symlink redirection and premature migration-source removal. It writes a verification receipt, never applies a patch.

The capability exposes no apply, delete, history-rewrite, commit, push, merge, deploy or credential operation. Later use of a patch through another tool still needs normal ownership/admission and exact-source checks. `git apply --check` alone is not proof of the exact original source state. Rollback is the retained original bytes or reverse application after verifying the exact after hashes; this candidate performs neither on a real project.

## Executable local workflow

Run the retained Relay tool from an admitted, separate project checkout. The existing `gh` connection reads project registration; no new credentials or scopes are configured. `--out` must name a new directory outside the target checkout. Existing directories and symlinks are preserved. The completed artifact is published under that directory's `bundle/` child, with private file permissions.

```sh
node /path/to/relay/scripts/ai-cleanup.mjs inventory --project PROJECT_ID --repo /path/to/project --out /path/to/new-inventory
node /path/to/relay/scripts/ai-cleanup.mjs scan --project PROJECT_ID --repo /path/to/project --scope /path/to/scope.json --out /path/to/new-scan
node /path/to/relay/scripts/ai-cleanup.mjs prepare --project PROJECT_ID --repo /path/to/project --report /path/to/new-scan/bundle/report.json --select /path/to/selection.json --out /path/to/new-plan
node /path/to/relay/scripts/ai-cleanup.mjs verify --project PROJECT_ID --repo /path/to/project --plan /path/to/new-plan/bundle/report.json --phase before --out /path/to/new-verification
```

The scope file is a JSON array of actual tracked file paths chosen from inventory. The selection file is a JSON array of actual eligible finding IDs chosen from that exact scan. Empty or protected selections fail rather than choosing everything implicitly. Review `report.json`, `cleanup.patch`, `files/*.before` / `*.after` and `migration/docs/<project>/...`. Only a separately authorized workflow can apply the patch or publish external docs. After a later authorized application, the same `verify` command with `--phase after` checks the reviewed outcome and that migration sources remain intact.

## Backend contract and pending MCP registration

`src/ai-cleanup.js` exports `aiCleanupTool`, `validateAiCleanupArguments`, `githubCleanupSnapshot` and `callAiCleanup`. The MCP actions are `scan` and `prepare_patch`; both are read-only with respect to repository/source state. They use the existing bounded GitHub reader and current Runner registration routes. The handler is executed in tests and was smoke-tested against three real Relay files through the existing authorized `gh` read connection. That is backend read evidence, not authenticated HTTP/MCP discovery, installed-client delivery or deployment evidence.

Minimum registration handoff: `src/relay-entry.js`, currently reserved by held assignment `relay-mcp-rebuild-continuation-20261003` / owner `claude-open`. A new dedicated integration test file such as `src/ai-cleanup-mcp-integration.test.js` can avoid taking existing tests. The owner or an explicitly authorized operator must serially admit this narrow registration slice while preserving the rebuild's held state, WIP and other scope. No broad rebuild takeover/resumption is required or implied.

The registration patch must import the descriptor/validator/handler, add the descriptor to `augmentToolList`'s extension tools, recognize its name in `isExtensionTool`, and dispatch to `callAiCleanup` inside the existing authenticated extension path. Preserve the current `authProbe`, security schemes, error classification, result shaping and all existing tools. Test real discovery/title/schema, authenticated scan/preparation, denied unauthenticated calls, invalid/stale inputs and absence of source mutations. Then rebuild/test the exact candidate. Publication and client tool refresh remain later gates; this worker has not modified the reserved entrypoint or tool-contract tests.

## Evidence

Twenty AI Cleanup regressions and fourteen existing attribution regressions passed on pinned Node 22.23.3. Coverage includes real forward/reverse `git apply` in fictional fixtures; CRLF and missing-final-newline preservation; human/legal/generated/build provenance; source strings/templates, Markdown examples/frontmatter/HTML; byte-integrity, stale/dirty source, tampered plans, migration-source retention, output preservation and GET-only registered-project adapters. The existing required Inspector suite discovers the new source test file, which imports the CLI regression file.

Read-only real inventory observed 829 tracked paths at source `379911c73d4ef624768406a6dbc966faf3520441`. A ten-file real local scan reported zero automatic patch candidates, preserving actual Relay/Codex product behavior and canonical docs while marking the two bootstrap guides review-only. A separate three-file backend smoke scan at remote Relay head `aa125eb6cbe52fd9c4cb76a4c1d5b23162115d3c` also reported zero automatic candidates. Those results are explicitly bounded scans, not an all-repository cleanup verdict. Source was unchanged. The worker receipt supplies subsequent full-suite/build results for the final implementation checkpoint.

Existing Git history and contributors are not inspected or rewritten by AI Cleanup. Prospective attribution remains documented separately in `COMMIT_ATTRIBUTION_20261013.md`; wiring that policy into reserved source/merge writers is still pending. Removing development residue from files does not change historical Git author/coauthor or PR/merge actor records.
