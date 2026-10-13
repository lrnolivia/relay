# Historical pre-consolidation record

This document retains historical evidence. Current authority is `lrnolivia/relay@main`, project `relay`, Worker `relay`, web `https://relay.loew.fi`, MCP `https://relay.loew.fi/mcp`. Runtime and retirement truth: [Relay retirement](relay/LEGACY_RETIREMENT.md). Historical hostnames and repository instructions below must not be used for current execution.

# runner architecture

Universal chat/execution law lives in `LOEW_CHAT_BIBLE.md` and its versioned `contracts/manifest.json`. Managed project repositories should point to that authority rather than carrying forked copies of generic execution rules.

`runner` is the universal GitHub control plane for loew.fi project automation.

Repository: `lrnolivia/loew-runner`  
Human-facing name: **runner**  
Workflow name: **Night Shift**

## Principle

Product repositories own product truth.

`loew-runner` owns reusable execution infrastructure.

A target repository should not need to carry a copy of the Night Shift contract, assignment templates, blocker doctrine, promotion logic, dependency doctor, or scheduler.

## System

```text
normal ChatGPT chats
PJM / Master / Contract Worker / Night Shift Manager
                    │
                    │ human steering
                    ▼
             loew-runner
      ┌──────────────────────────┐
      │ policy + project registry│
      │ assignments + QA         │
      │ scheduler + agent state  │
      │ dependency doctor        │
      │ branch promotion         │
      │ blocker repair           │
      │ dashboard + reports      │
      └─────────────┬────────────┘
                    │
                    │ GitHub API / Composio transport
                    ▼
        managed GitHub repositories
        field · rtxForge · GameBridge · ...
```

## Control surfaces and naming

The human-facing product/control vocabulary is intentionally small:

- `relay` — ChatGPT-facing control product and canonical handoff surface
- `runner` — execution, orchestration, durable state, scheduling, and project control backend
- `inspector` — runtime verification, screenshots, browser evidence, and QA service
- `loew.CONTROL` — underlying control architecture
- `source.CONTROL`, `cloud.CONTROL`, and `runtime.VERIFY` — architectural subsystems where the dotted form is useful

Human-facing product/service names stay lowercase. Dotted uppercase names describe architecture, not separate products.

Cloudflare Access applications are authentication/trust boundaries, not a project registry. A new Runner-managed project does **not** automatically get its own Access application. Public or simpler products may need no dedicated Access application at all. This is why projects such as `loewtorials` and `thetake` can exist in Runner without appearing as dedicated Zero Trust applications.

The canonical ChatGPT OAuth/MCP ingress is `https://relay.loew.fi/mcp`. The live endpoint is currently backed by the inspector gateway while relay continues to route source/cloud work through the appropriate connected providers. See `docs/ACCESS_CONTROL.md` for exact current topology, legacy compatibility paths, IDs, verification state, and the safe migration/rollback procedure.

The shared private boundary now lists only `field.loew.fi` and `runner.loew.fi`; public properties are outside it. The canonical relay backend and linked trust path are verified through GitHub automation. Only `Only Me` remains reusable; machine/QA policies are app-local. Legacy auth paths remain until a direct normal ChatGPT OAuth tool call passes.

## Three kinds of truth

### Product truth

Lives in the target repository:

- source
- tests
- build configuration
- product documentation
- durable product architecture
- releases
- implementation branches
- pull requests

### Runner policy

Lives on `loew-runner/main`:

- Night Shift contract
- assignment authoring rules
- blocker doctrine
- promotion rules
- project manifests
- templates
- runner source
- dashboard source

### Runtime/control truth

Should converge on a dedicated `loew-runner/control` branch:

- assignments
- worker mailboxes
- QA records
- session IDs
- run state
- dependency diagnostics
- promotion state
- blocker reports
- event history

Keeping mutable control state off `main` prevents automated state churn from polluting runner development history.

## Universal repository model

Every GitHub repository visible to the configured owner is discoverable.

Automation is opt-in per repository through `projects/<id>.json`.

A project manifest defines:

- repository
- default branch
- implementation branch prefixes
- excluded branches
- package manager/runtime
- dependency install command
- build/test/lint commands
- required QA
- preview/runtime endpoints
- protected paths
- promotion policy
- repair authority
- deployment policy

The dashboard should distinguish:

- discovered
- managed
- paused
- active
- blocked
- healthy

## Night Shift

Night Shift is a workflow, not a field-specific subsystem.

```text
Night Shift Manager
→ Contract Worker
→ assignment branch / Draft PR
→ project-appropriate validation
→ exact-SHA promotion gate
→ main
```

The existing PJM → Master → Codex Worker lane remains separate.

## Promotion

Promotion is deterministic wherever GitHub can answer the question directly.

The runner may automatically:

- create a missing Draft PR for an activated assignment
- refresh stale branch metadata
- update a PR branch from main when conflict-free
- retry transient CI infrastructure failures
- rerun an appropriate failed check
- repair runner-owned metadata
- repair safe lockfile drift when declared dependencies are unchanged
- merge validated work when the project's promotion contract is satisfied

The runner must not:

- force-push
- bypass required checks
- mark failed QA as passed
- resolve semantic merge conflicts by guessing
- change product direction to make a branch mergeable
- silently broaden assignment ownership

## Exact-SHA gate

Immediately before automatic merge, runner refreshes:

1. PR head SHA
2. current main SHA
3. assignment ownership
4. required checks
5. required QA record
6. tested head SHA
7. tested main SHA
8. mergeability

If main moved after material QA, runner reconciles and reruns affected validation.

Only the exact validated head may merge.

## Blocker doctrine

The system distinguishes **repairable blockers** from **real blockers**.

Repairable blockers become work.

Real blockers become reports.

See `night-shift/BLOCKER_POLICY.md`.

## Dependency Doctor

Dependency health is universal and adapter-based.

Examples:

- npm: lockfile → Node version → `npm ci`
- pnpm: lockfile → Corepack/pnpm → frozen install
- Python: declared environment → clean virtualenv install
- Rust: toolchain → locked Cargo build

The first implementation is npm/Node because field is the pilot.

## Dashboard

The approved Runner 3.0 direction is a project-first human control plane. The shipped 0.6 dashboard remains worker-first until migration. Scheduled/headless automations stay a subsystem under Infrastructure; first-class Team identities remain separate. See `STATE.md` for verified implementation and `RUNNER_3_0_HUMAN_CONTROL_PLANE.md` for accepted product scope.

It should eventually support:

- all discovered repositories
- enable/manage repository
- active assignments
- current branches and PRs
- validation state
- dependency health
- real blockers
- artificial blockers repaired
- run now
- pause/resume
- merge queue
- recent merges
- agent/session spend
- event history

Routine operation should not require editing YAML, JSON, Actions files, or cron expressions by hand.


## Runtime independence

Runner must remain operational when no ChatGPT chat is open and must not depend on ChatGPT Plus allowances, Codex availability, plugin availability, or a specific conversation surface.

The scheduler, durable state, GitHub transport, Preview/QA orchestration, and OpenAI API execution live outside ChatGPT. ChatGPT/Codex/Work may inspect or steer Runner, but are not part of its liveness path.

OpenAI API billing is a separate budget boundary from ChatGPT subscriptions and ChatGPT usage credits. Missing API credentials fail closed without retry spam.

Routine ticks should be deterministic and cheap. AI inference should occur only when new evidence or a decision actually requires it.


## Instruction architecture

`loew-runner` is the GitHub-wide authority for generic chat execution behavior.

Each target repository should keep a thin root `AGENTS.md` bootstrap that points back to the current Runner Bible and contains only a minimal emergency invariant set plus repository-specific product/process overlays.

Platform is not an organizational split. Composio is available universally for remote control-plane operations. Authorized local clones may be used for implementation/testing where available, including Linux/Codex workflows, and may be combined with Composio remote operations.
