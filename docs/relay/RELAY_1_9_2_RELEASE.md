# Relay 1.9.2

Relay 1.9.2 is the scalable SOURCE mutation release.

## What ships

- `relay_source_edit_text` edits an existing UTF-8 file by sending only bounded exact search/replace fragments.
- `relay_source_append_text` appends one bounded UTF-8 chunk and returns the next exact identities for chained appends.
- Relay loads the existing Git blob server-side, so callers do not need to resend the whole document just to change a small section.
- Every mutation requires both the expected branch-head SHA and expected file-blob SHA.
- Direct default-branch writes remain forbidden.
- Exact replacement counts prevent ambiguous edits.
- Existing file mode is preserved.
- Branch head and resulting blob are read back after the write; transport errors are reconciled only when the exact commit/blob actually landed.
- Physical UTF-8 blobs are bounded to a safe server-side edit window. Larger logical documents should be represented as indexed/sharded files so size changes representation rather than blocking the work.

## Chunk-safe workflow

For large logical edits:

1. read the current branch head and target file blob SHA;
2. send one bounded exact edit or append chunk;
3. use the returned `head_sha` and `blob_sha` as the next expected identities;
4. repeat until the logical change is complete.

This keeps every MCP request small while preserving exact-SHA/CAS safety across the chain.

## Tests

Focused tests cover tool publication/validation, exact edits, append chaining, file-mode preservation, stale branch/head rejection, stale blob rejection, ambiguous match rejection, default-branch refusal and transport-error reconciliation.

## Refresh boundary

After exact-source deployment, verify Relay reports 1.9.2, refresh Relay tools in ChatGPT, reopen/refresh the session if required, and confirm both new SOURCE tools are visible before continuing to Relay 1.9.3.
