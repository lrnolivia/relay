# Night Shift assignment authoring

> An assignment is the smallest complete executable representation of the next unit of work.

## Create an assignment when

- implementation intent is sufficiently decided
- a bounded repair is needed
- a separate follow-up tranche exists
- ownership requires a split
- QA closeout needs a dedicated pass

Do not create assignments for vague aspirations.

## Modes

- handoff
- plan-to-action
- repair
- follow-up
- qa-closeout

## Required data

Each assignment records:

- project
- unique ID
- status
- branch
- PR
- base SHA
- type
- execution class
- owned paths
- approved shared paths
- protected paths
- goal
- current verified state
- settled decisions
- implementation intent
- acceptance criteria
- bounded investigation
- non-goals
- validation
- runtime QA
- completion contract

## Truth categories

Keep these separate:

- landed / verified
- in progress
- decided but not implemented
- unknown / unverified

## Follow-up rule

Separate work gets a successor assignment.

Do not silently grow an assignment because the same chat discovered adjacent work.

## Artificial blocker rule

Workflow defects should normally become bounded repair work rather than reasons to stop.

See `BLOCKER_POLICY.md`.
