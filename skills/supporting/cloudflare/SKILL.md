---
name: relay-cloudflare
description: Inspect Workers, builds, versions, deployments, bindings, Access, cache, R2 and browser evidence using registered bounded cloud operations.
---

# Cloudflare operational workflows

Use for registered Worker diagnostics, build/deployment evidence, binding/cache/R2 analysis and approved cloud actions. Compose with release for promotion and QA for runtime claims. This pack grants no new credential or Access authority.

## Inputs

Resolve project-to-Worker mapping, registered Git-native publication route, runtime allowlist, exact source head and existing authorized connection. Identify the affected environment and service bindings without printing secret values. Gather relevant build/version/deployment IDs, request/error evidence and intended outcome.

## Supported actions

Use discovered bounded CLOUD primitives. Inspect build status, immutable Worker version and traffic deployment separately. Check source identity and request behavior at the actual runtime. For binding failures compare declared bindings and deployed environment; preserve secrets, Access audience/policies and origin checks.

For cache/CDN issues distinguish browser cache, edge cache and origin response. Inspect headers/cache keys and invalidation scope before an authorized purge; never infer correctness from one warm response. For R2 use bounded pagination and object metadata/readback. Shared receipts use conditional writes and exact revisions; uncertain results require readback. Browser/evidence requests must use available capabilities and bind output to the tested artifact.

## Output and verification

Return canonical Worker/environment, exact source/build/version/deployment identities, observed behavior, evidence and next action. A successful build is separate from deployed traffic and runtime verification. For approved changes verify the affected route plus protected behavior; no service credential or authorization bypass belongs in a diagnostic artifact.

## Recovery

Classify denied Access, missing binding, rate limit, capacity or unavailable entitlement as environment state. Respect retry/reset guidance and bound equivalent retries. If deployment identity is uncertain, reconcile version/traffic before any new write. Escalate an out-of-scope binding, secret or policy change to the owner with concrete evidence; preserve the last known good deployment.
