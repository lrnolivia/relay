# loew runner 3.0 — human control plane

Status: PRODUCT / IMPLEMENTATION PLAN  
Product: loew runner  
Target release: 3.0  
Current UI baseline at planning time: 0.6  
Primary goal: make Runner usable as the human-facing operating system for multi-project, multi-agent loew.fi development without requiring ChatGPT or Codex for routine coordination.

## Product thesis

Runner 3.0 is not an AI chat embedded in a dashboard.

It is a deterministic human control plane over:

- projects
- first-class project workers / Masters / PJMs
- assignments
- branches and PRs
- ownership
- overlap
- QA evidence
- repository hygiene
- notes / reports / trackers
- provider capacity / execution infrastructure
- historical decisions and handoffs

The user should be able to understand the state of the whole loew.fi development environment in seconds, drill into any project, see exactly what every worker is doing, spot collisions before they become merge conflicts, and perform routine maintenance from Runner without opening ChatGPT or Codex.

AI is optional augmentation later. Core project-management and repo-maintenance flows must work without paid inference.

## Current gap

The current dashboard is worker-first and exposes:

- scheduler workers
- enable / pause
- run now
- runtime settings
- field Dependency Doctor / Repair
- visual evidence review

It does not provide first-class UI for:

- projects
- project stages / milestones
- assignments
- first-class Worker / Master / PJM topology
- branch / PR mapping
- ownership boundaries
- overlap visualization
- repository hygiene
- note / tracker consolidation
- handoff generation
- stale-work detection
- safe cleanup
- cross-project status
- actionable attention queue

3.0 addresses that gap.

## Core design principles

1. **Project-first**
   - the first screen answers “what is happening across loew.fi?”
   - workers, assignments, QA and repository state are viewed in project context

2. **Human-readable before machine-readable**
   - every status has a plain-language explanation
   - technical detail is one click deeper
   - do not require the user to interpret SHAs, run IDs or JSON to understand health

3. **Deterministic by default**
   - Git / Runner / Inspector state drives status
   - do not require an LLM to classify obvious repository facts

4. **Explain every red state**
   - a failure must say whether it is product, QA assertion, dependency drift, auth, provider quota, rate limit, transport, provider outage or stale evidence
   - “GitHub run failed” is not an acceptable final explanation

5. **Show overlap before merge conflict**
   - path ownership + changed-file intersections + assignment shared/protected paths should surface collisions early

6. **Safe actions from the dashboard**
   - routine coordination and repository hygiene should not require leaving Runner
   - destructive actions require deterministic proof and explicit confirmation

7. **Durable worker, short-lived branch**
   - Runner visualizes first-class worker ownership separately from temporary implementation branches

8. **No hidden AI requirement**
   - every critical 3.0 workflow must have a zero-inference path
   - optional AI may summarize or suggest, never become required infrastructure

9. **Professional compact UI**
   - dense, precise, calm
   - strong field/Figma UI3 influence
   - restrained Terra Prime accent use
   - avoid generic SaaS dashboard cards where structured rows, panes and inspectors are better

## Information architecture

Top-level navigation:

1. **Home**
2. **Projects**
3. **Team**
4. **Assignments**
5. **Visual**
6. **Infrastructure**
7. **Activity**

Current “workers” scheduler UI moves under **Infrastructure → Automations**.

### Home — attention

The default dashboard is an attention surface, not a metrics vanity page.

Top row:

- Projects healthy / attention / blocked
- Active first-class workers
- Active assignments
- Open PRs
- Repo hygiene warnings
- QA blocked/deferred
- provider capacity summary

Primary content:

**Needs attention**
- semantic overlap
- assignment with no owner
- worker with no assignment
- assignment branch missing
- stale PR
- PR failing product QA
- dependency drift
- provider quota deferred
- unclassified red run
- branch with unique commits and no active assignment
- active work that exceeds its owned paths

**Recently changed**
- merges
- assignments started/completed
- worker reports
- human QA decisions
- repo cleanup actions
- ownership changes

No user should need to open each project to discover a critical blocker.

## Projects index

Each project appears as a compact structured row, not a huge card.

Columns / signals:

- project
- current product stage
- health
- active workers
- active assignments
- open PRs
- branch hygiene
- QA state
- latest material change
- next milestone

Example:

```
field       Stage 0     ATTENTION   5 workers   4 active   3 PRs   8 stale   1 QA deferred
loew-runner 3.0         HEALTHY     1 worker    2 active   1 PR    clean     green
inspector   Gen 2.1     HEALTHY     1 worker    1 active   0 PR    clean     green
```

Clicking a project opens its project workspace.

## Project workspace

Project header always shows:

- project name
- repository
- current stage / milestone
- project health
- main SHA
- active worker count
- active assignment count
- open PR count
- repo hygiene count
- QA status
- last refresh

Project tabs:

1. **Overview**
2. **Work**
3. **Team**
4. **Map**
5. **Repo**
6. **QA**
7. **Notes**
8. **History**

### Project / Overview

A compact operational summary:

- current goal / stage
- current milestone acceptance criteria
- active work
- blockers / deferred work
- next integration gates
- latest merged work
- top overlap warnings
- top repo-hygiene warnings
- project-wide quick actions

Quick actions:

- Refresh truth
- Consolidate status
- Reconcile trackers
- Generate handoff packet
- Run project doctor
- Review safe cleanup
- Run required QA
- Freeze / unfreeze new work

### Project / Work

First-class assignment board.

Views:

- list
- grouped by owner
- grouped by tranche
- grouped by status

Assignment row:

- title
- tranche / domain
- owner
- state
- branch
- PR
- base/main divergence
- QA
- overlap
- last material change
- next action

Assignment states:

- READY
- ACTIVE
- WAITING_QA
- DEFERRED
- BLOCKED
- HUMAN_QA
- COMPLETE
- SUPERSEDED
- ARCHIVED

Click opens assignment inspector.

Assignment inspector:

- goal
- why it exists
- owner
- domain
- owned paths
- approved shared paths
- protected paths
- branch / PR / head SHA
- dependencies
- dependents
- acceptance criteria
- validation
- QA evidence
- recent reports
- blockers
- next action
- history

Actions:

- Start
- Pause
- Mark blocked
- Mark complete
- Reassign
- Approve shared-path overlap
- Generate handoff
- Copy Codex prompt
- Copy ChatGPT review packet
- Open PR
- Run QA
- Archive

No AI is required to generate handoff/prompts: use deterministic templates from assignment fields.

## Project / Team

This is the human-facing first-class agent topology.

Important vocabulary correction:

- **Team** = PJM / Master / Worker / human-managed agents
- **Automations** = current Runner scheduled `workers/*.json` jobs

Do not visually mix them.

Team row:

- name
- role
- durable mission
- domain
- current assignment
- branch / PR
- status
- last report
- current conflicts
- can Runner wake it? yes/no

Runner must be explicit that arbitrary ChatGPT/Codex chats cannot be awakened automatically.

Worker inspector:

- mission
- authority / reporting line
- owned domain
- allowed shared domains
- active assignment
- branch / PR
- last checkpoint
- next action
- dependency graph
- overlap warnings
- historical assignments
- current handoff packet

Actions:

- Assign work
- Reassign work
- Pause ownership
- Retire worker
- Generate resume packet
- Copy worker bootstrap
- View reports

## Project / Map

This is the organizational graph.

Two toggleable maps:

### Ownership map

Nodes:
- Master / PJM
- Workers
- domains
- assignments

Edges:
- reports to
- owns
- depends on
- hands off to

### Overlap map

Nodes:
- active assignments / workers

Edges are generated from:
- changed-file intersection
- owned-path intersection
- shared-path declarations
- protected-path violations
- branch / PR target overlap

Severity:

- neutral — related, no overlapping write surface
- green — explicitly approved shared surface
- amber — overlapping paths but no current changed-file collision
- red — both active and touching same unapproved paths
- dark red — protected-path violation

Click an edge to see the exact files/paths causing overlap and which assignment owns them.

This must be deterministic. No semantic LLM required.

## Project / Repo

Human-friendly repository control surface.

Summary:

- current main
- open PRs
- active branches
- merged branches awaiting deletion
- stale branches
- orphan branches
- branches with unique commits
- branches with no assignment
- PRs with no assignment
- assignments with no branch/PR
- branch naming violations
- behind/ahead counts
- current cleanup candidate count

Views:

### Pull requests
- assignment
- owner
- domain
- head
- freshness
- checks
- exact QA
- overlap
- disposition

### Branches
- branch
- linked assignment
- owner
- ahead/behind main
- unique commits
- open PR
- last update
- cleanup safety

### Cleanup ledger
Every item must be one of:

- KEEP ACTIVE
- MERGE AFTER GATE
- TRANSPLANT
- SUPERSEDED
- CLOSE AFTER VERIFICATION
- DELETE AFTER VERIFICATION
- QUARANTINE
- NEEDS DECISION

Quick actions:

- Refresh branch inventory
- Build cleanup ledger
- Delete merged branches
- Close explicitly superseded PRs
- Remove branches proven to have no unique work
- Normalize branch names for *new* work
- Find orphan work
- Find missing assignment links

### Safe cleanup

There must be a dry-run review before mutation.

Safe automatic deletion requires all:

- not default/protected branch
- no open PR
- either merged or zero unique commits against authoritative main
- not referenced by active assignment
- not protected by project policy
- not current Mobile protected branch or equivalent active exception

Anything else requires explicit individual confirmation.

No bulk force push. No history rewrite.

## Project / QA

Unifies deterministic checks and Inspector evidence.

Sections:

- required checks
- exact-SHA QA state
- first divergence
- latest evidence
- human QA queue
- deferred provider-capacity work
- stale evidence

Failure classification is mandatory:

- PRODUCT
- QA_ASSERTION
- DEPENDENCY_DRIFT
- AUTH
- PROVIDER_QUOTA
- RATE_LIMIT
- TRANSPORT
- PROVIDER_OUTAGE
- STALE_RUN
- NOT_RUN

A provider quota state renders “deferred”, not “failed product”.

Buttons:

- Run required QA
- Run deterministic recipe
- Recheck exact SHA
- Send to danger zone
- Record human pass/fail
- Open visual evidence

## Project / Notes

This is where the “one-click consolidate notes and trackers” requirement lives.

Runner 3.0 defines canonical structured truth so consolidation can be deterministic.

Sources may include:

- Runner reports
- assignment JSON
- project state
- worker checkpoints
- project trackers
- handoff docs
- active PR metadata
- active branch metadata

### Consolidate status

One click produces/updates a canonical project digest with:

- current stage
- active workers
- active assignments
- branches/PRs
- blockers
- deferred work
- latest verified outcomes
- unresolved decisions
- next integration gates
- stale/conflicting sources

The zero-AI implementation does not “interpret prose”.
It uses structured assignment/report metadata and latest-source precedence.

If a prose-only source cannot be deterministically reconciled, Runner links it under **Needs review** rather than inventing a conclusion.

### Reconcile trackers

One click:

- inventories configured tracker/note files
- identifies exact duplicates
- identifies stale snapshots by SHA/date
- identifies multiple files claiming canonical current state
- generates a proposed canonical index
- moves only pre-authorized historical files to archive
- leaves semantic conflicts for review

### Archive stale reports

Safe only when:
- a newer canonical structured record supersedes the report
- source remains reachable in Git history
- no active assignment references it

### Generate handoff

Produces a deterministic markdown/text packet from structured state:

- role
- project
- goal
- current state
- branch / PR / SHA
- dependencies
- protected boundaries
- acceptance criteria
- QA
- exact next action

Buttons:
- Copy for Codex
- Copy for ChatGPT
- Download / copy plain handoff
- Open source files

No model call required.

## Infrastructure

### Capacity

At-a-glance provider state:

- GitHub Actions
- Cloudflare Workers Builds
- Browser Run
- Composio
- OpenAI API if configured
- Inspector
- Runner scheduler

Each provider shows:

- available / degraded / exhausted / unknown
- current usage when obtainable
- concurrency
- next reset/retry where known
- latest provider error

Runner infrastructure agent owns this logic.

### Automations

This is where current `workers/*.json` scheduler jobs live.

Controls remain:

- enable / pause
- run now
- cadence
- model
- reasoning
- web
- budgets

They are not presented as the project’s first-class Team.

### Operations

- dependency doctors
- repairs
- scheduled workflows
- recent control-plane writes
- failed control actions
- retry/defer queue

## Activity

Cross-project immutable-ish activity feed:

- assignment state changes
- owner changes
- branches created/deleted
- PR open/close/merge
- safe cleanup
- QA classification
- reports/checkpoints
- human QA verdicts
- project freezes
- provider incidents

Filter by project / worker / domain / event type.

## Data model

3.0 should formalize the following durable records.

### projects/<id>.json

Existing project registry expands to include:

- product stage
- current milestone
- project health policy
- ownership topology reference
- repo policy
- QA policy
- notes/tracker sources
- cleanup policy

### agents/<project>/<id>.json

First-class human-facing agent/role registry.

Fields:

- id
- name
- role: pjm | master | worker
- project
- mission
- domain
- reports_to
- status
- current_assignment
- current_branch
- current_pr
- can_wake
- last_report
- created_at
- retired_at

Do not reuse `workers/` for this because `workers/` already means Runner scheduler automation.

### assignments/<id>.json

Current schema becomes a supported first-class object.

Required additions:

- domain
- tranche
- owner_agent
- depends_on
- blocks
- branch
- pr
- head_sha
- status
- last_material_change
- overlap_approvals
- supersedes / superseded_by
- notes_sources

### ownership/<project>.json

Canonical domain ownership.

Contains:
- domains
- owner agents
- owned paths/patterns
- approved shared paths
- protected paths
- escalation owner

### snapshots/<project>.json

Generated live derived state.

Not hand-authored truth.

Contains:
- main SHA
- branches
- PRs
- assignments
- overlap edges
- repo hygiene
- QA health
- attention items
- refreshed_at

### events/

Append-only operational events where practical.

## Deterministic overlap engine

Inputs:

- assignment owned/shared/protected paths
- ownership policy
- PR changed files
- branch changed files
- active assignment state

For each pair of active assignments:

1. intersect changed files
2. intersect changed files against other owner's protected paths
3. intersect declared owned paths
4. check approved shared-path exemptions
5. classify edge

No LLM.

The UI must show exact causative paths, not an unexplained “72% overlap score”.

## Deterministic attention engine

Attention items are rule-based.

Examples:

- active assignment with missing owner
- active assignment with no current branch
- branch with no assignment
- PR with no assignment
- open PR head behind main beyond configured threshold
- assignment exact QA stale after head change
- protected-path overlap
- unclassified failed workflow
- provider quota deferred past retry time
- worker checkpoint older than configured threshold while branch changed
- “complete” assignment with open unique branch
- merged PR with undeleted safe branch
- multiple assignments claiming same exclusive domain

Each item includes:
- why it exists
- severity
- source
- suggested deterministic action
- whether one-click repair exists

## Dashboard action safety classes

### Safe
No confirmation beyond click:
- refresh truth
- generate reports
- build cleanup ledger
- generate handoff
- run read-only doctor
- run deterministic QA

### Guarded
Confirmation drawer:
- pause assignment
- reassign work
- create branch
- create PR
- archive superseded tracker
- delete branch proven safe
- close PR explicitly marked superseded
- approve shared-path overlap

### Danger
Explicit typed / two-step confirmation:
- delete branch with unique commits
- close active unsuperseded PR
- change project canonical repo
- change protected ownership policy
- bypass normal promotion
- any force operation

Runner 3.0 should not expose force push as a normal dashboard action.

## Zero-AI operating mode

3.0 must remain fully useful with no OPENAI_API_KEY.

Available with zero inference:

- project status
- worker/agent registry
- assignments
- branch/PR state
- ownership
- overlap detection
- repo hygiene
- cleanup ledger
- safe cleanup
- QA routing/status
- visual evidence
- notes inventory
- deterministic status consolidation
- handoff generation
- prompt packet generation
- provider capacity
- activity history

Optional future AI layer:

- prose synthesis
- semantic duplicate detection
- suggested assignment splits
- conflict explanation
- architecture review

If implemented, it must be clearly labeled optional and show spend/budget.

## ChatGPT / Codex integration without embedding them

Do not make 3.0 wait on native ChatGPT/Codex embedding.

Provide:

- **Copy Codex handoff**
- **Copy ChatGPT review packet**
- **Copy worker resume prompt**
- **Copy project status**
- **Copy QA packet**

These are deterministic templates populated from Runner state.

Future optional integrations may launch supported URLs or use APIs, but the product remains functional without them.

## Visual direction

Runner 3.0 should feel like a professional operations/design tool, not a startup analytics dashboard.

Use:

- compact neutral chrome
- left project rail / list
- tabbed project workspace
- dense structured rows
- inspector/detail pane
- sparse status color
- restrained Terra Prime brand accents
- low radii
- minimal shadow
- precise alignment
- collapsible side/detail panes
- graph view only where relationships matter

Avoid:
- giant hero headings inside operational screens
- oversized metric cards
- decorative dashboards
- generic SaaS “cards everywhere”

The current visual-evidence viewer can remain a strong dedicated surface and be integrated into the new navigation.

## Implementation tranches

### 3.0-A — data model + read-only project control plane

Goal: make all state visible before adding broad mutation.

Deliver:

- Projects index
- project workspace shell
- first-class agents registry
- assignments registry/UI
- project stage/milestone
- branch/PR inventory
- repo hygiene summary
- overlap engine
- attention engine
- read-only notes/tracker inventory
- current scheduler workers moved conceptually to Infrastructure / Automations

No destructive actions yet.

### 3.0-B — guarded assignment + repo actions

Deliver:

- assignment create/edit/status
- assign/reassign
- branch/PR association
- ownership approvals
- safe branch cleanup
- superseded PR close
- dry-run cleanup ledger
- project freeze
- repo doctor
- full activity events

### 3.0-C — consolidation + handoff tools

Deliver:

- Consolidate status
- Reconcile trackers
- Archive stale reports
- Generate handoff
- Copy Codex packet
- Copy ChatGPT packet
- worker resume packet
- project digest

All zero-AI by default.

### 3.0-D — infrastructure/capacity integration

Coordinate with existing Runner/Inspector infrastructure owner.

Deliver UI consumption of:

- provider capacity
- retry/defer state
- failure classification
- evidence reuse
- queued QA
- operations history

Do not duplicate their underlying infrastructure logic.

### 3.0-E — polish + migration

- migrate current worker-first home to project-first home
- preserve visual evidence
- preserve existing Worker controls under Automations
- responsive desktop/tablet behavior
- accessibility
- empty/loading/error states
- migration docs
- retire “v0.6” presentation
- ship product version **Runner 3.0**

## Acceptance criteria

Runner 3.0 is complete when a user can, from the dashboard alone:

1. see every managed project and which need attention
2. open a project and understand its stage, active work, workers, branches, PRs, QA and blockers
3. see every first-class worker and exactly what they own / are doing
4. see deterministic overlap between active work with exact causative paths
5. create/update/reassign/pause assignments safely
6. see orphan, stale and superseded repo work
7. produce a safe cleanup ledger and execute safe cleanup actions
8. consolidate structured status and tracker state without an LLM
9. generate a complete Codex/ChatGPT handoff packet with one click
10. see QA state without confusing provider/harness failure with product failure
11. see provider/infrastructure capacity state
12. review an auditable history of dashboard actions
13. do all of the above with no paid inference configured

## Explicit non-goals for 3.0

- embedded ChatGPT
- embedded Codex
- autonomous product-direction decisions
- semantic merging of contradictory prose without review
- unrestricted repository mutation
- force-push UI
- replacing GitHub as code/history truth
- replacing Inspector as evidence executor
- impersonating first-class project agents

## Required coordination integration (2026-09-30)

Bible section 20, `docs/WORK_COORDINATION.md`, project `coordination` policy and `coordination/<project>.json` now define admission/lifecycle. The deterministic engine is `src/coordination.mjs`; `scripts/coordinate.mjs` supplies atomic GitHub transactions, preflight, inventory audit and managed cleanup. The scheduled/manual workflow is `coordination.yml`.

The 3.0 dashboard must consume these same records and rules, including the active branch cap, queued tasks without branches, expired reservations, scope drift and legacy recovery inventory. Do not build a second ownership registry or lock engine. Relay and local chats use the same SHA compare-and-swap protocol. Integrating UI or API endpoints is follow-up infrastructure-owner work; the existing CLI/workflow operates independently of that upgrade and of paid inference.
