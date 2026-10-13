---
name: relay-github
description: Operate repository, branch, pull-request, check and release workflows through admitted bounded source primitives and verified readback.
---

# GitHub source workflows

Use for repository/branch inspection, scoped source publication, draft PRs, check diagnosis and authorized release metadata. Implementation uses engineering; deployment promotion uses release.

## Inputs

Resolve canonical repository/default branch, project policy, current assignment/owner/scope and exact base/head. Inspect live PR/check/ref state and local dirty changes. Acquire the supported durable claim before creating an implementation branch or worktree. Keep concurrent owners in separate checkouts.

## Supported actions

Use discovered Relay bounded SOURCE actions or the authorized repository CLI. Inspect exact files/callers at the intended revision; submit coherent edits with expected file/ref identities. Preserve unpublished changes and recovery branches. Push the admitted branch and create a draft PR that states the concrete behavior, relevant validation and remaining uncertainty.

Read checks for the PR's current head, including completed conclusions and pending runs. Diagnose the first failing step before rerunning. For confirmed merge, require merged=true, correct base repository/branch and matching source head; merge-like metadata on an open PR is insufficient. Tags/releases require the separately authorized target and exact artifact.

## Output and verification

Return repository, assignment, branch, exact head, PR URL/state and check evidence. Re-read every changed remote ref/file/PR after publication. Do not report dispatch acceptance as a completed check, a pushed branch as merged, or a release entry as deployment. Preserve branch protection and required checks; never force push or bypass them.

## Recovery

On CAS/ref conflict refresh ownership and content, then reevaluate the complete patch instead of overwriting another writer. On uncertain writes read back before retrying. Respect provider rate-limit reset/retry guidance; do not switch identities to evade it. Two identical failures require a changed strategy or blocker. Cleanup only accounted eligible branches through the canonical lifecycle.
