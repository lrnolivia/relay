# Relay MCP receipt and lifecycle repair

Lauren directed this existing Mac Codex chat to take the Relay MCP work. Receiving chat and actual bounded implementation owner: `01a10033-4d88-7872-990c-e45b7bd4c1c2`.

## Preserved objective

The full program remains `relay-mcp-rebuild-continuation-20261003`. Its original and latest acceptance is preserved in the live record and [the exact supplied handoff](https://github.com/lrnolivia/relay/blob/353cd0ed83776a259cb02ffb00630350297a2c86/docs/handoffs/2026-10-03/RELAY-MCP.md), including the original 1.9 contract in the sibling mutation-guidance file. This receipt does not replace that acceptance or close any of its remaining review delivery, Night Shift, sync safeguard, website, client, skills, or executor requirements.

Live inspection confirmed that queued-only handoff is unsupported and claim refuses a different queued owner. The umbrella received an additive next-action amendment naming this receiving chat; its owner and complete acceptance were preserved. A separate linked prerequisite, `relay-mcp-lifecycle-reconciliation-20261003`, was admitted to this actual chat, using branch `relay/mcp-lifecycle-reconciliation-20261003` from `488b67ac2808766e6fb2350e55492bc68ef6bf5c`. This is a bounded engine repair, not a replacement program or a claim made under the predecessor identity.

The canonical checkout at `~/Repos/relay` remains on its original branch. Implementation uses a managed worktree outside `~/Repos`. ctrl PR7 and its recovery files, the reserved production-smoke and minimal-probe lanes, and all older provenance remain untouched.

## Changed behavior

- `complete` synchronizes a matching claimed queue row to completed in the same record transaction. Each row retains its own goal, acceptance, amendments and other evidence. Completion still requires provider-verified merged PR proof and work accounting.
- `handoff` supports queued-only work, preserves queued status and full scope, records from/to ownership history, and creates no claim, branch, process or execution evidence. A busy successor may receive queued work but cannot evade normal admission when claiming it. Active handoff synchronizes a matching queue owner and retains the existing branch and active/held state.
- New `reconcile` repairs exactly one stale claimed queue row belonging to an already completed claim. It requires the same current owner on both rows and the original PR number. The adapter verifies that GitHub still reports the PR merged from the claimed branch/repository into registered main, with the exact head and merge identity recorded at completion. Active, held, queued, retired, mismatched-owner and incomplete-proof records are rejected. The completed claim is unchanged. An already completed pair returns without a write or timestamp change.
- MCP and CLI lifecycle mutations retain explicit record CAS, canonical engine/policy drift checks, strict schema validation and exact readback. A lost successful response is reconciled from readback; CAS conflicts are not automatically replayed. Callers cannot provide the server's verified merge identity.

CLI `handoff`, `complete`, `reconcile` and `retire` now use the same adapter and require `expected_record_sha` in the request JSON. Older CLI handoff/completion invocations without that field must refresh the record and include it. The workflow dispatch exposes `reconcile`; request JSON follows the same contract.

Example reconcile request shape (replace all example values with fresh, verified values):

```json
{
  "expected_record_sha": "<current coordination record blob SHA>",
  "id": "<exact completed assignment>",
  "owner": "<matching claim and queue owner>",
  "pr": 123
}
```

Run through `node scripts/coordinate.mjs reconcile <project> <request.json>` only after the reviewed engine is canonical and release/cutover authority exists. MCP puts the expected revision at top level and the remaining three fields inside `request`.

## Validation and publication boundary

Local `npm ci`, build, React typecheck and the full workspace test command passed before publication. Focused coverage exercises terminality, owner and exact merge mismatches, preservation of full acceptance, no-execution queued handoff, active queue synchronization, stale CAS, engine drift, uncertain readback, lost responses and no-write replay through engine, MCP adapter and real CLI process boundaries with a mocked GitHub provider. Local runtime was Node 26; repository CI provides the configured Node 22 validation.

This source change has not normalized the historical 39 Relay and 2 Field pairs or completed the umbrella handoff. No merge, production deployment, client-rendering verification or live reconciliation is implied by local tests. The live release and historical pair application remain separate evidence and authorization steps.

After authorized merge/release: verify the canonical engine blob, byte-exact runtime mirror, deployed pin and discovered schema; refresh authorized writers and drain stale lifecycle writers as necessary. Never bypass the drift guard between source merge and runtime publication. Refresh every historical pair and its PR proof before its individual CAS transaction; verify readback before advancing. Do not replay a bulk stale snapshot or retire old reservations. Transfer the queued umbrella through the supported owner-authorized handoff and retain this repair's review/release outcome in its original record. The next product batch is the ctrl-critical artifact-bound review/feedback backend contract, coordinated with the existing ctrl frontend owner.
