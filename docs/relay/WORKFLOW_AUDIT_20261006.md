# Workflow audit — 2026-10-06

## Verified findings

Default-branch coordination consumers in GameBridge, loew-shell, loewfi and loewtorials still referenced the retired loew-runner repository. Relay's canonical cleanup reporter distinguishes operational completion from outstanding coordination findings; the retired CLI exits 2 for either. Strict admission and audit gates remain intentional.

The loew-shell, loewfi and loewtorials two-reference corrections are merged in PR4 in each repository. GameBridge has an independently tested correction within its existing foundation PR3; publication must preserve that PR's stated limits. Bazzite's registration names a workflow absent from main; an unfinished bootstrap branch retains an obsolete copy. Do not erase its retained work or infer a successful installation from registration alone.

Thirty-three distinct readable workflow files were inspected. Twenty-seven use one or more v4 official GitHub actions. Observed Node20 deprecation warnings justify compatibility maintenance, but are not evidence those actions caused the specific failed jobs. Relay's separate scheduled Field audit can keep reporting unresolved coordination records; cleanup success must not close those records or weaken admission.

## Private workflow discovery

The separate GitHub connector could not enumerate a private repository's workflow directory while Relay's existing GitHub App could read known files. Extend source inventory with a bounded, read-only `.github/workflows` listing at the exact default-branch commit already resolved by that call. Return path, blob SHA and size only. This uses existing repository authorization and introduces no credentials, access grants or public visibility changes.

Directory absence, access denial, rate limiting and provider failure are distinct. An unavailable listing is never an empty successful audit. Provider error details and secrets are not returned. Truncation is explicit at 200 entries. Unsupported identities fail the listing closed; existing branch/PR inventory remains available.

## Verification

Focused source lifecycle tests cover exact repository/ref, read-only requests, denied/absent/error states, malformed file paths and bounded responses. Hosted exact-head quality and admission remain required before deployment. After deployment, read back the private workflow inventory, audit its returned files, and report the actual scope covered. A code test is not proof of a live private-repository read.
