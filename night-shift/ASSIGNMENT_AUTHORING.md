> Canonical authority: [LOEW_CHAT_BIBLE.md](../LOEW_CHAT_BIBLE.md), especially sections5,6.1.1,18,20. Codex and Claude share this task contract.

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

Follow the canonical [Bible section6.1.1](../LOEW_CHAT_BIBLE.md#611-goal-preserving-expansion). Necessary supporting features and directly related strengthening improvements may extend the current assignment’s acceptance plan while preserving its original goal. Record reason, goal relationship, dependencies, acceptance, verification and admitted scope before execution. Related improvements do not require another permission ceremony. Unrelated work or a materially different goal gets a separate admitted assignment. Additions remain bounded, deduplicated and cycle-free and survive resume; they are not a new per-chat branch.

## Artificial blocker rule

Workflow defects should normally become bounded repair work rather than reasons to stop.

See `BLOCKER_POLICY.md`.
