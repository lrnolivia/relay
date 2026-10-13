# Relay 1.7.5 — observed progress pipeline

Relay 1.7.5 is an independently shippable backend/control-plane release for the active Relay 1.8 UI work.

## What changed

### Observed execution progress

`relay_runner_progress` is the canonical 1.8 consumer contract. It reconstructs execution state from durable Runner coordination, GitHub branch/commit/PR/check evidence, and configured Cloudflare deployment/version evidence.

Claim state, lease presence, and `next_action` prose are context only. They are never sufficient evidence that work is currently executing.

The contract exposes:

- canonical `state` and `stage`
- stable evidence-derived events and a compact receipt
- `last_meaningful_progress_at`
- worker heartbeat timestamp/freshness separately from external-system activity
- exact known baseline/head/branch/PR/check/merge/Worker/version/deployment identities
- waiting/blocker reason and recovery action
- reconciliation disposition
- queued intent separately with `observed: false`

State vocabulary includes `queued`, `reserved-but-idle`, `working`, `waiting-on-external-system`, `waiting-for-human`, `blocked`, `possibly-stale`, `officially-stale`, `failed`, and `complete`.

Default liveness semantics are:

- 5 minutes: heartbeat target
- 10 minutes: possibly stale
- 20 minutes: officially stale unless current external evidence proves a dependency is still active

Progress events use stable content-derived ids and are reconstructed from durable provider/control-plane records, so reconnecting clients do not require chat history and unchanged observations dedupe deterministically.

## Runner claim contract

`base_sha` remains server-derived. On claim Relay reads the live registered default-branch head and pins that exact SHA into the coordination transaction. Callers must not provide `request.base_sha`.

Generic `relay.SOURCE` direct-default-branch commits remain blocked. Coordination state is a Runner control-plane transaction and continues to use Relay's SHA-checked coordination writer.

Relay's tool help now describes GitHub App source auth rather than implying a legacy token is required. GitHub App-only source write status remains covered by tests.

## Project-driven Cloud authority

Canonical project registrations now map the Worker-backed projects explicitly:

- relay → `relay`
- field → `field`
- loewfi → `loewfi`
- loewtorials → `loewtorials`
- thetake → `thetake`

Each mapping uses:

```json
{
  "cloud": {
    "provider": "cloudflare",
    "worker": "<script>",
    "write": true
  }
}
```

New project-aware Cloud tools require **both** project registration authorization and the existing runtime Worker allowlist. The runtime allowlist remains a second, fail-closed safety rail; no wildcard is introduced and credentials are not widened.

The live five-Worker allowance is now also durable in `wrangler.jsonc`:

`relay,field,loewfi,loewtorials,thetake`

Projects without a Cloud registration do not become deployable merely because they are registered in Runner.

Legacy script-oriented Cloud tools remain compatible during migration.

## Relay 1.8 consumer handoff

Relay 1.8 must bind dashboard/cards to `relay_runner_progress` and project-aware Cloud state rather than reconstructing progress from assignment labels.

The UI must:

1. treat `progress[].state`, `stage`, `latest_event`, `last_meaningful_progress_at`, `worker`, `external`, `identities`, `waiting_reason`, `recovery_action`, and `reconciliation` as the backend truth contract;
2. display worker liveness separately from GitHub/Cloudflare waiting;
3. never call a held or merely reserved claim "working" without observed evidence;
4. order recency views from observed event time, not assignment declaration time;
5. keep `next_action` as explanatory context only;
6. use project-aware Cloud authorization for deploy controls;
7. preserve exact identity fields when deep-linking or refreshing cards.

1.8 owns presentation only; it must not fork or reimplement the 1.7.5 progress state machine.
