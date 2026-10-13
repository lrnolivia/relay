# Retained interactive review builds

## Release order and current state
The first complete Relay website batch is verified in production at fc26879f77e2ca13046d2926051235d9e376858d (PR120). This is the next admitted batch, relay-retained-interactive-previews-20261002. It does not claim Field's complete preview, ctrl migration or MCP client acceptance. No coding workers, new credentials, domain policy changes or service grants are introduced.

## Immutable build and isolation
The artifact is a content-addressed JSON bundle containing the exact compiled app/Inspector scripts, styles, embedded imagery and retained font bytes, with source SHA, web build hash and explicitly synthetic fixture data. Maximum bundle size is 8MiB. Upload retries reconcile the same digest and cannot replace old bytes or reset approval. Original source assets remain unchanged; the fixture adapter is bundled only into retained documents, never production web assets.

The existing authenticated operator gateway serves documents at /api/retained-preview/<digest>/view. Every document response carries HTTP CSP sandbox allow-scripts WITHOUT allow-same-origin, plus connect-src none, frame-src none, worker-src none, form-action none and data-only image/font policy. Inspector adds the same restrictive iframe sandbox. Thus direct openings remain sandboxed too. A real document URL preserves URL syntax needed by the unchanged app, while its security origin is opaque. This replaces the initial nested-srcdoc sketch.

Fetch and storage adapters operate only on synthetic in-memory data; browser CSP remains the enforcement boundary even if an adapter is removed. Real source tasks, worker state, reviews, cookies, parent DOM and persistent storage are unavailable. Preview actions reset on reload. Known navigation stays inside the same retained build. The parent accepts only a fixed route allowlist, exact iframe source, opaque event origin and current challenge nonce. The readiness response establishes rendering, never a human approval or claim of production correctness.

## Approval and retention
Pending builds have no application expiry. A clearly labeled human Approve this build button starts a 30-day availability window. Upload retries do not extend it. Reopen returns the copy to pending; expiry is reversible metadata, not permanent deletion. Screenshots and original bundle bytes are not automatically purged. External bucket lifecycle policy has not been independently verified, so storage-level indefinite retention is not asserted.

Approval uses revision preconditions and idempotent operation IDs, with bounded prior-state history. It is separate from question answers, queue completion, source execution and deployment approval. Unsaved question notes must save before changing the build review. Lost responses are refreshed, never automatically replayed.

## Build and evidence pipeline
Premerge quality uses the candidate API with emulated R2, and real browser isolation/interaction tests. Existing visual screenshots still use the deployed evidence service; new retained endpoints are not required before they exist in production.

After authorized deployment, the existing production verification runs first. A second step builds and uploads the retained artifact from that exact source, reads back its digest, opens the actual protected sandbox at desktop/mobile widths, checks opaque origin and synthetic data, exercises Settings, and captures app/Inspector evidence. Each capture is linked to the exact retained identity and verified by image hash and live-metadata readback. That step never approves the build or modifies real source data.

## Verification and limitations
Six focused storage/provenance/body-limit/CAS/retention/CSP tests pass locally. Full build/typecheck/browser/visual and production retained-build proof remain pending until recorded in the release receipt. Browser tests cover private parent/storage isolation, blocked network attempts, synthetic review mutations, route changes, reopen/reset and explicit approval/reopen at 1440 and 390 widths. Physical iPhone behavior is not claimed.

The bundled adapter currently supports Relay's review interface. Other products can use the artifact contract after providing their own self-contained synthetic adapter; this is not yet a frozen full Field editor with origin-dependent storage capabilities.

Rollback: revert this product batch in a new admitted PR or use the previous verified Worker version. Leave immutable bundles and approval history intact. Existing Captured and ordinary Live evidence paths remain available. No irreversible cleanup is part of this release.

Primary references: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox ; https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe ; https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
