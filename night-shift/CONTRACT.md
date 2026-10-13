# Night Shift universal contract

> Universal authority: read `../LOEW_CHAT_BIBLE.md` first. This contract specializes Night Shift behavior and may not weaken or fork the Bible.

Night Shift is runner's reusable Contract Worker execution system.

It applies to repositories explicitly managed by `loew-runner`.

## 1. Separation from the Codex lane

Codex lane:

```text
PJM → Master → Codex Worker
```

Night Shift lane:

```text
Night Shift Manager
→ Contract Worker
→ assignment branch / Draft PR
→ validation + QA
→ runner promotion gate
→ main
```

Do not silently mix the two lanes.

## 2. Terminology

**Contract Worker** — ordinary ChatGPT execution chat working under one bounded repository assignment.

**Night Shift** — one or more Contract Workers operating asynchronously.

**Night Shift Manager** — standing coordination chat for the Contract Worker lane. It is not a PJM.

**runner** — deterministic control plane, scheduler, state store, diagnostic layer, and promotion manager.

Transport executors are infrastructure, not organizational agents.

## 3. Canonical ownership

Target repositories own implementation and product truth.

`loew-runner` owns reusable Night Shift process and mutable coordination state.

A project may retain local project documentation, but it should not carry a forked copy of the universal Night Shift contract.

## 4. Project policy

Every managed repository has one manifest in:

```text
projects/<project-id>.json
```

The manifest defines repository-specific behavior.

If universal policy and a project manifest conflict, fail closed and report the conflict.

## 5. Assignment identity

Every assignment has one unique ID.

For an activated implementation assignment:

```text
assignment ID
↔ runner control record
↔ target implementation branch
↔ Draft PR
↔ Contract Worker chat
```

Branch naming comes from the project manifest.

## 6. Ownership

Assignments declare:

```text
owned
approved_shared
protected
```

Parent/child path overlap counts.

Before activation and before merge, runner checks active ownership.

Do not silently acquire another assignment's owned path.

## 7. Mail and QA

Each assignment receives runner-owned records for:

- assignment
- mailbox
- QA
- event history

A successful build is not automatically runtime QA.

Never claim validation passed unless it actually ran.

## 8. Artificial blockers

A bounded defect in runner-owned workflow, metadata, dependency setup, Git bookkeeping, or QA harness should normally be repaired automatically when authority and evidence are sufficient.

See `BLOCKER_POLICY.md`.

## 9. Promotion

Automatic merge is permitted only when the project manifest enables it and the exact-SHA promotion gate passes.

See `PROMOTION_POLICY.md`.

## 10. Safety

Never:

- force-push
- bypass branch protection
- weaken required validation to obtain green status
- merge a branch with unresolved semantic conflict
- invent QA evidence
- make a product-direction decision merely to unblock automation
- merge excluded/control/proof branches

## 11. Continuity

Chat history is not durable project state.

Assignments, QA, blockers, session state, and promotion evidence must be reconstructable from Git-backed runner state.


## 12. Overnight progress watchdog

Night Shift inherits the Bible's recovery, failure-fingerprint, bounded-retry, sanity-gate, and loop-watchdog rules.

A blocked assignment is a scheduling event. Revalidate the blocker from fresh evidence, park only the affected path, and continue another safe ready assignment when one exists.

The Night Shift Manager must not end the night merely because one QA harness, branch, workflow, or assignment path is stuck.
