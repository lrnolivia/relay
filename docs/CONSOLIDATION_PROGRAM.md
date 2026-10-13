# relay consolidation program

Canonical target:

- one product: `relay`
- one repository: `lrnolivia/relay`
- one public hostname: `relay.loew.fi`
- runner becomes an internal coordination/automation subsystem
- inspector becomes an internal verification/evidence subsystem
- night shift becomes a Relay feature/view

## authoritative execution order

1. identity bridge
2. monorepo import
3. control/state migration
4. Cloudflare/runtime cutover
5. legacy retirement
6. unified web + in-chat UI

The queued assignment originally named `relay-consolidation-b4-unified-ui-20260930` is intentionally executed **last**, despite its historical numeric id. The program owner is the authority for sequencing.

## gates

Each stage must merge and pass exact-head tests/readback before the next stage starts.

The Cloudflare/runtime cutover may create and switch the canonical Relay production runtime, but it must not delete old resources.

Legacy retirement is the only stage allowed to remove old public hostnames, Worker/script identities, obsolete Access surfaces, and old active project/repository identities after Relay production is proven healthy.

The unified UI is last so it is built against the final repository, state, runtime, routing, and product architecture rather than temporary compatibility state.
