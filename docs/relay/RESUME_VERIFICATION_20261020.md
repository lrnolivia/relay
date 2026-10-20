# Relationship context and Night Shift continuation — 2026-10-20

This continues `relay-mcp-rebuild-continuation-20261003` on its existing branch,
`relay/mcp-rebuild-20261003`. The original acceptance and separate project owners
remain in force. This batch does not complete the full Relay rebuild.

## Intake and source preservation

Lauren explicitly resumed work in the receiving chat and supplied checkpoint
`6c6d33508a35ebfa03f0d3694bd683e36d53302b`. Its READY FOR CODEX handoff records
the previous writer's stop. Fresh GitHub blob readback confirmed the held
`codex-open` pickup marker; the earlier cached MCP read still showed its old
owner. Supported CAS handoff and heartbeat admitted owner
`01a1576d-4e3d-78f2-bdde-a1658b3598d0`, followed by passing preflight.

Main and the old checkpoint had unrelated histories. Integration commit
`4984055315ac4bbb64bb0682d1ad5d8416828de2` retains both checkpoint and canonical
main `1a0575abdff9c8f7779ec44c1837e3ecbca451be` as parents. Its tree starts with
that complete main tree and reapplies only the eight checkpoint files. Current
attribution, AI Cleanup, nudge and other project records are preserved. No
published history was rewritten, and the older local checkouts and untracked
recovery files were left intact.

## Corrections after intake

- The existing snapshot containment check compared canonical dependency-link
  targets with an aliased snapshot root. This failed on macOS temporary paths.
  `9fd0bbf` canonicalizes the containing root. The regression deliberately uses
  a directory alias on every platform and retains the external-link rejection.
- The checkpoint's cancellation race tests returned `ok:false`, while the real
  MCP client throws on rejected results. `5b17a66eca66883fec642815b8b69f8c10573bb8`
  reconciles thrown failures with one status reread; a retry requires a changed
  revision. A lost successful cancel response is recognized as already terminal
  without sending another cancel.
- A failed mid-run safety read is now a stop reason that still attempts exact-job
  cancellation through the separate execution endpoint. If that endpoint or
  persistence also fails, the receipt retains reconciliation requirements.

Three tests using the real `createMcpClient` with an injected fixture transport
failed before those cancellation corrections and passed afterward. No real
coding job, remote host, scheduler or away window was started by these tests.

## Verification

Source `5b17a66eca66883fec642815b8b69f8c10573bb8`, Node 22.23.3, npm 10.9.9:

- Exact clean-source build passed.
- All five required suites passed: 957 passes, zero failures, two platform skips.
- Source/test mapping ran seven selected test files: 136 passes. Sixteen deferred
  test files remain explicitly classified by the mapper and are covered by the
  required suites; the handoff Markdown is the sole unmapped changed path.
- All 17 Night Shift coordinator tests and all 10 snapshot tests passed.
- Pinned workerd verification passed: health and exact source identity, rejected
  unauthenticated MCP/panel requests, and real local durable safety state.
  This is local runtime evidence, not production or authenticated-user proof.

Security review `3400c912-19c8-4190-a1ac-54e46fa0a8ab` binds the original
eight-file integration to frozen range `1a0575a..4984055`. Its seven source
files and the handoff Markdown are accounted for separately. The initial
inventory helper selected Apple Git 2.39.5, which lacks `cat-file -Z`. The same
scan's inventory was recovered through the official stdio server with the
already-installed Git 2.53.0 selected only for that subprocess; native inventory
readback confirmed all seven source files. No persistent configuration or
credential change was needed. Managed scan artifacts retain the review result
and the frozen-source cancellation discrepancies; the later corrections above
must be assessed against their own exact source and regression evidence.

## Operational boundaries and recovery

No `RELATIONSHIP_CURATOR_BINDING` is configured by this batch. Curation fails
closed without a verified fixed-boundary Access principal and exact server-side
project/assignment/owner/branch/issuer/subject binding. Staff labels do not grant
that authority. Relationship projection is staff-specific task context, while
the ordinary project entries remain shared context rather than a staff ACL.

Night Shift remains uninstalled and unscheduled. A declared plan, authorized
transport, real oversight executor and actual away window are still needed for
operational proof. Cancellation requested, broker terminal state and verified
process exit remain distinct. Remote execution parity and native-client/user
acceptance are unverified; they do not erase passing independent source work.

Fresh provider readback before publication showed production version
`4dedd854-f4c6-44ff-8323-9df5385727a0` at 100%, deployment
`ca46bc1d-79c9-4098-a119-e69f9a6a9b6c`. The current healthy recovery source is
`8a017002d055ae21c9e3d5315acd5f71fc4ea6dc`; user-approved PR186 remains separate.
Refresh these identities and the retained compatible recovery receipt before
promotion. Publication, final CI, deployment and postflight receipts belong in
the live assignment context; this document does not assert those later actions.

The previously approved Builds-token replacement still requires the private
human handoff. No credential values were inspected or changed. CTRL, PC CI, GW
and the attribution carve-out retain their own recorded ownership.
