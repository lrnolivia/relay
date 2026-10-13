# Night Shift blocker policy

> Universal authority: read `../LOEW_CHAT_BIBLE.md` first. This policy specializes blocker handling.

## Rule

A blocker caused by our own machinery is usually work.

A blocker requiring new authority, product judgment, or unresolved semantics is real.

## Artificial / repairable

Examples:

- branch behind main but conflict-free
- missing Draft PR for an activated assignment
- stale branch / PR / SHA metadata
- stale runner assignment status
- missing runner-owned mailbox or QA record
- transient registry/network failure
- transient GitHub/API failure
- safe rerun of a flaky infrastructure check
- deterministic tool invocation error
- runner dashboard/config drift
- lockfile drift when declared dependency intent has not changed
- QA harness defect whose repair does not change product behavior
- stale universal Night Shift instructions

Default action:

1. verify current truth
2. repair within runner authority
3. validate repair
4. record the repair
5. retry the original operation
6. continue work

Bounded retries are required. Never loop indefinitely.

## Real blockers

Examples:

- semantic merge conflict
- repeatable product test failure
- repeatable build failure caused by product code
- security or credential requirement not already authorized
- missing external service entitlement
- ambiguity about intended product behavior
- conflicting active ownership that cannot be reconciled mechanically
- repair requires changing declared dependency intent
- repair would weaken a safety or validation boundary
- production/runtime QA cannot be performed with available authority
- destructive migration needs user approval

Default action:

1. stop only the affected path
2. continue independent safe work where possible
3. preserve exact evidence
4. report the smallest actionable blocker
5. state what decision/credential/action would unblock it

## Escalation quality

Do not report:

> CI failed.

Report:

> field/dashboard-interaction-polish cannot promote because test `X` fails reproducibly on head `abc123` against main `def456`. Clean dependency install and build pass. The failure changes expected navigation behavior, so runner will not rewrite it automatically.

Real blockers should arrive already diagnosed.


## Failure fingerprint and loop escape

For every retryable failure, track the operation, target, relevant SHA/state, error class, and normalized error as the failure fingerprint.

The default identical retry budget is two attempts.

If the same fingerprint occurs twice without new evidence, do not perform a third identical retry. Refresh live truth and either use a materially different approved path, repair the bounded machinery and retry once, park the affected path and continue other safe work, or escalate the smallest real blocker.

A prior `BLOCKED` state is never self-authenticating. Revalidate it on each new invocation before inheriting it.
