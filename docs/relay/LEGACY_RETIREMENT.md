# Relay legacy retirement

Canonical product/source/control: `lrnolivia/relay`, managed project `relay`, Worker `relay`, web `https://relay.loew.fi`, MCP `https://relay.loew.fi/mcp`. Runner and Inspector are internal subsystems; Night Shift is a Relay feature.

## Verified prerequisites

Batch 2 preserved Runner source `71a5fdbae3303b28a840579d816dc846aaae5186` and all 246 original ancestors via two-parent import `fdefc6c724f94cbf9605cfa72665208380a7ee2b`, Relay merge `fc3eb586931d33c887d5e2b58c63a8e002fecf33`. Batch 3 preserved the complete frozen Runner main/state `3972446e667b956961f21eaeeb98d29a99f6b8fb` via import/merge `e4998b36f9dac8b484c05cfa4b7fbdc37f83ee63`; `contracts/control-state-import.json` verifies original objects and counts. Relay/Inspector ancestry remains intact.

Batch 4 PR44 implements the shared Terra Prime interface without illustrations. Batch 5 PR45 merged `ea8fd9b7f63e9c132908e901f2949ba19fdb98b5`; same Worker ID `734382bfc38a43cfb8cf9115116ed688`, active version `21b95737-16d0-4ded-babb-1b77586bbe9e`, deployment `fd1098cc-8db5-4e04-91cb-c7422a54e755`. Authenticated exact-source production verification passed: https://github.com/lrnolivia/relay/actions/runs/36742121446 . Existing MCP binding was read back as `https://relay.loew.fi/mcp`; live MCP app connected to the shared UI.

## Retirement sequence and preservation

After this PR's exact-head tests and admission/merge, deploy its source through Relay upload/deploy and repeat authenticated production smoke. Detach `runner.loew.fi`, `inspector.loew.fi`, `relay-inspector.loew.fi`; retain only canonical Relay domain. Remove those names from Access destination lists, retaining Field destinations/guards. Retire obsolete Inspector MCP/transport Access apps and their specific policies; retain shared Only Me and GitHub bridge identity. Remove legacy Runner Worker only after canonical API/UI proof. Disable workers.dev and previews on Relay, so canonical domain remains the single product ingress.

Archive `lrnolivia/loew-runner` read-only instead of deleting it. `LEGACY_RECOVERY_INVENTORY.json` records exact twelve branch heads and eight open PRs; they remain in the archive. Unmerged branches are recovery evidence, not silently accepted implementations. The two other owners' active/held historical Runner claims remain owned recovery records, exposed only through their historical snapshot; no lease expiry, reassignment or fabricated completion. Old project registrations are non-managed compatibility aliases of Relay. Existing future durable-operation work stays queued: consolidation does not invent operation receipts or mark unimplemented work complete. Standalone Inspector product queue is explicitly superseded by B4/B6 through exact-record CAS after merge. Batch queue states reconcile only against actual completed merge evidence.

Storage `loew-inspector-evidence`, Browser binding, secrets, OAuth identity, and GitHub App stay intact. Its historical bucket name is an identity-preservation exception, not another product. AI worker execution remains parked when the canonical repository lacks OPENAIKEY; deterministic coordination and human UI require no model inference. No credits, secret recreation, or unrelated Field mutation is performed.

## Capability exceptions and recovery

Relay has no domain/Access deletion or repository archive primitive. Use only searched Cloudflare API endpoints and authenticated GitHub repository archive API for these bounded retirement writes; refresh inventory before each action and read back afterward. The retirement ledger CLI is a one-time canonical GitHub content CAS with merged-B6 proof, owner preservation, and full readback, because the native coordinate schema has no queue supersession action. No blind record overwrite.

Rollback: retained Relay versions and exact merged SHAs support native version rollback. Canonical Access application ID/audience stays unchanged; shared R2 survives. GitHub archive can be reversed and all branch heads are recoverable. Recreating old URLs would require an explicit rollback instruction; current operations must use Relay. The final B6 completion receipt records actual deployment, smoke run, removals and archive readback rather than treating this planned sequence as evidence of execution.
