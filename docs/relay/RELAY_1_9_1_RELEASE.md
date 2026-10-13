# Relay 1.9.1

Relay 1.9.1 is the first small-slice architecture release under the universal loew development cadence.

## Scope

- Add canonical `amend` support to `relay.RUNNER` for queued and claimed assignments.
- Preserve stable assignment identity, owner, claimed branch, and claimed base SHA.
- Allow amendments to goal, acceptance, next action, paths, resources, task class, and ledger refs.
- Require a human-readable amendment reason.
- Conflict-check claimed path/resource changes against current ownership.
- Keep a compact bounded amendment audit: total amendment count plus the latest 20 human-readable entries.
- Add `design`, `architecture`, and `maintenance` task classes and stable ledger references to queue/claim intent.
- Codify universal patch-release cadence in `docs/relay/DEVELOPMENT_CADENCE.md`.
- Establish the rule that file/document/context/request size limits are transport constraints, not blockers.
- Begin sharding the findings ledger with stable per-RFS files so growth does not require whole-ledger rewrites.

## Consumer refresh

This patch changes the Runner tool contract. After exact-source deployment:

1. verify runtime reports Relay 1.9.1;
2. refresh/reload Relay tools in ChatGPT;
3. reopen or refresh the ChatGPT session if required for tool discovery;
4. confirm `relay_runner_coordinate` exposes `amend`;
5. use `amend` on the active 1.9 assignment itself to fold in RFS-020/RFS-021/RFS-022 and prove the new flow from the consumer side.

## Next patch

The next independently shippable architecture slice should add scalable relay.SOURCE mutation transport: precise patch/edit, bounded chunking/append where appropriate, and deterministic readback so payload ceilings never require noncanonical writers.
