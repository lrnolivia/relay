# Relay release pipeline

## Canonical path

Relay uses GitHub as the source of truth and Cloudflare Workers Builds as the normal production transport.

1. Work happens on an admitted branch and is reviewed through a pull request.
2. GitHub Actions runs the single Relay quality gate.
3. A green pull request merges to `main`.
4. Cloudflare Workers Builds checks out that Git commit directly from `lrnolivia/relay`.
5. Workers Builds runs `npm run build`.
6. Workers Builds runs `npx wrangler deploy` against the existing `relay` Worker.
7. Relay reads Cloudflare build/deployment state and verifies runtime behavior.
8. Rollback uses a known-good Worker version when needed.

Cloudflare exposes `WORKERS_CI_COMMIT_SHA` and build metadata for the originating commit, so exact-source provenance does not require Relay to download the repository and reconstruct a Worker upload.

## What Relay should not do in the normal release path

The following are not part of the canonical Relay publication path:

- downloading source files back out of GitHub through the Contents API in order to upload them to Cloudflare;
- splitting generated application payloads solely to fit a source-read transport limit;
- calling `relay_cloud_upload_version` for the canonical Relay Worker;
- repeating the same full test matrix after an exact head has already passed the canonical quality gate;
- holding branch capacity for completed, superseded, or missing-branch assignments.

For Relay itself, recovery means deploying a known-good existing Worker version or rerunning the Git-native Workers Build for a known-good commit. `relay_cloud_upload_version` remains available only for other explicitly allowlisted Workers that still use direct source publication.

## CI contract

The Relay quality gate intentionally uses one runner for the normal test matrix:

- one repository checkout;
- one `npm ci`;
- one Chromium installation;
- `npm run build`;
- Relay 2.0 typecheck;
- the existing workspace, Runner, Inspector, contract, API, browser, and React tests.

Generated Relay web/MCP bundles are ephemeral build output. They are ignored by Git and recreated by `npm run build` in CI and Workers Builds.

The Inspector visual-review job remains separate and only runs for the narrow review branch class that needs screenshot evidence.

## Workers Builds configuration

Connect the existing Cloudflare Worker `relay` to GitHub repository `lrnolivia/relay` with:

- production branch: `main`
- root directory: `/`
- build command: `npm run build`
- deploy command: `npx wrangler deploy`
- preview builds: optional; keep off until the production path is proven

Cloudflare's Git integration should own normal production transport. Relay owns orchestration, status, verification, recovery and rollback.

## Build artifacts

The first Git-native production deployment is proven. Generated web payloads are build-time artifacts only and are not stored in Git. This permanently removes the source-file-size failure mode that exposed the old uploader bottleneck.
