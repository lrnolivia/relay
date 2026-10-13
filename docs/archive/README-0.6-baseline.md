# loew-runner

> Universal chat operating contract: `LOEW_CHAT_BIBLE.md`  
> Machine-readable contract manifest: `contracts/manifest.json`

A small, durable headless execution layer for background research and project continuity.

`loew-runner` exists because ordinary ChatGPT scheduled tasks are intentionally limited. It does **not** try to replace the normal ChatGPT Project chats that remain the user-facing place to plan, steer, and review work.

Instead, it provides a separate execution layer:

```text
normal ChatGPT / Project chats
            │
            │ steer + review
            ▼
       GitHub project truth
            ▲
            │
      loew-runner scheduler
            │
            ▼
      OpenAI Responses API
```

The first pilot is **field**.

## Gen 2.1 visual evidence

Runner now includes the protected `visual` review surface for loew inspector evidence. It is an evidence/review console, not a browser engine.

- Inspector chooses among HTTP, GitHub Chromium, and scarce Cloudflare Browser Run capacity.
- GitHub Chromium is the deterministic workhorse for real-project `/qa/work/{projectId}` recipes.
- Evidence is normalized into private R2 regardless of capture engine.
- Runs group multiple captures from one browser session and expose progress/state in `visual`.
- Versioned recipes can be compiled from bounded Browser Run traces and replayed deterministically.
- Review uses explicit assertions first, then same-step/same-project/same-environment baselines, structured DOM/accessibility comparison, manual pixel-delta comparison, and first-divergence reporting.
- Tiny serialization-only byte drift is tolerated when structural counts remain stable; material DOM/accessibility changes still surface.
- `/builder/noauth` remains smoke-only. Real project QA uses `/qa/work/{projectId}`.

Current Gen 2.1 Runner package: **v0.6.0**.

## Design goals

- one scheduler can manage many jobs
- durable Responses API continuity chain per job
- GitHub is durable project state
- jobs are disabled by default
- no surprise API spending
- read-only target access first
- clear stop / blocked states
- no hidden dependency on one ChatGPT conversation
- compact, pleasant dashboard
- zero runtime npm dependencies in loew-runner itself

That last point is intentional: the tool that diagnoses dependency failures should still run when dependency installation is the thing that is broken.

## Current status

**v0.1 foundation**

Included:

- zero-dependency Node 22 runner core
- JSON worker registry
- persisted session state
- OpenAI Responses API session creation / continuation
- GitHub context ingestion
- hosted web search support
- hourly GitHub Actions scheduler
- local dashboard
- field pilot configuration
- dependency doctor workflow for field
- dependency failure classifier
- CI for loew-runner itself

The field runner job is committed **enabled**, but it fails closed into `waiting_credentials` until `OPENAI_API_KEY` exists. Missing credentials do not create an hourly failure loop or API spend. Once the secret is present, the next scheduled tick can begin automatically.

Runner is intentionally independent of ChatGPT Plus/Codex runtime availability. ChatGPT plugins, Work/Codex limits, and user-visible chats are control surfaces only; they are never scheduler dependencies. OpenAI API billing is separate from ChatGPT subscription/usage credits.

## Quick start

Clone the repository and run:

```bash
npm run dashboard
```

There is no `npm install` step. The project uses only Node built-ins.

Open:

```text
http://localhost:4242
```

Run static checks and tests:

```bash
npm run check
npm test
```

Run one scheduler tick:

```bash
npm run tick
```

Run one worker regardless of cadence:

```bash
npm run run -- field
```

## Required secret

For live agent work, add this GitHub Actions repository secret:

```text
OPENAI_API_KEY
```

The key needs the permissions required by the OpenAI Responses API, including agent session read/write and model inference.

The field pilot reads a public GitHub repository, so it does not require a cross-repository GitHub token.

For future private target repositories, add:

```text
RUNNER_GITHUB_TOKEN
```

as a fine-grained token with the minimum required read access.

## Workers

Workers live in:

```text
workers/
```

Example:

```json
{
  "id": "field",
  "name": "field",
  "enabled": true,
  "cadence_minutes": 60,
  "model": {
    "id": "gpt-5.6-sol",
    "reasoning_effort": "medium",
    "web_search": true
  },
  "target": {
    "repository": "lrnolivia/field",
    "branch": "main",
    "write_mode": "read_only"
  }
}
```

v0.1 deliberately permits only `read_only` target mode.

Each worker has durable state in `state/<id>.json` including its OpenAI session ID. Reports accumulate in `reports/<id>.md`.

## Scheduling

`.github/workflows/runner.yml` wakes the scheduler once per hour.

The workflow itself does not mean every worker runs every hour. Each worker has its own cadence and the scheduler decides whether it is due.

When state or reports change, the workflow commits them back to this repository so a later run can continue from the same session.

## Dashboard

The dashboard is an intervention and maintenance console, not the runtime.

It shows:

- enabled / paused
- idle / running / blocked / complete
- cadence
- target repository
- model
- last run
- next run
- latest summary
- next focus
- dependency health

The protected hosted control API allows enabling/pausing workers and editing a small whitelist of operational settings. Secrets are never placed in browser JavaScript.

## Dependency Doctor

Dependency failures from ephemeral chat environments are difficult to interpret because the failure may belong to the environment rather than the repository.

The Dependency Doctor gives us a clean-room answer.

For the field pilot:

```text
GitHub-hosted Ubuntu runner
        ↓
Node 22
        ↓
npm ci
        ↓
build
        ↓
tests
        ↓
lint
        ↓
classified report + logs
```

Run it manually from **Actions → field dependency doctor → Run workflow**.

A clean install passing in Actions means a failure in a chat/container is probably environment-specific. A failure in Actions means the repository or lockfile genuinely needs attention.

The doctor does not auto-rewrite dependencies in v0.1. Automatic repair should happen on a branch/PR after the diagnostic path proves reliable.

## Safety

- target repositories are read-only in v0.1
- the field agent starts disabled
- no OpenAI call occurs without `OPENAI_API_KEY`
- session state is explicit and inspectable
- blocked and failed sessions stop instead of looping
- the runner does not call itself a PJM, Master, or first-class Worker
- no target repository is modified by the scheduler

## Planned next steps

1. validate the field dependency doctor on GitHub-hosted infrastructure
2. add `OPENAI_API_KEY`
3. enable field for one controlled agent cycle
4. verify session continuation on the next scheduled cycle
5. deploy the dashboard/control API
6. add guarded repair-PR mode for dependency failures
7. add event-driven wakeups in addition to schedules
8. add budgets and per-worker run limits

## Field pilot: dependency recovery

The field pilot now treats dependency health as a first-class gate before any AI worker is enabled.

**Doctor** is safe and automatic:

1. checks out `lrnolivia/field` on a fresh GitHub-hosted Ubuntu runner
2. pins Node 22
3. runs `npm ci`
4. classifies an install failure
5. if the lockfile is stale, generates a temporary `package-lock.json` candidate with `npm install --package-lock-only --ignore-scripts`
6. reruns `npm ci`
7. runs `build:all`, unit tests, and lint
8. writes the result back to `state/field.json`

Doctor never pushes to field.

The first field diagnosis was a real lockfile mismatch:

```text
Missing: @swc/helpers@0.5.23 from lock file
```

The repaired candidate has already proven that a regenerated lockfile restores a clean install and allows `build:all` to pass. Full test/lint verification remains the gate before Repair is considered safe.

**Repair** is deliberately guarded:

- it is manual/dashboard-dispatched only
- it requires `RUNNER_GITHUB_TOKEN`
- it may change only `package-lock.json`
- it must pass clean install, build, unit tests, and lint
- it creates a new branch and pull request
- it never pushes directly to `field/main`

## Dashboard controls

For the field pilot, the dashboard exposes:

- **Doctor** — run clean-room dependency diagnosis
- **Repair** — unlocked only after the Doctor records `dependency_health: repairable`
- **Enable / Pause** — control the background AI job
- **Run now** — start one bounded agent cycle when enabled
- **Runtime settings** — collapsed maintenance editor for cadence, model/reasoning, web search, and daily API budgets

The browser never receives OpenAI or GitHub credentials. Workflow dispatch happens through the local runner backend.

## Credentials

### OPENAI_API_KEY

Required for AI inference. ChatGPT Plus/Codex credits do not fund API calls; API billing is separate.

Store it as a GitHub Actions secret in `loew-runner` for scheduled execution. Do not place it in worker JSON or browser code.

### RUNNER_GITHUB_TOKEN

Not required for the public, read-only field research job itself.

It is required for:

- dashboard-triggered GitHub Actions
- private target repositories
- guarded repair PR creation

Use a **fine-grained** GitHub token with the narrowest repository access possible.

For the current field repair pilot:

- `lrnolivia/field`: Contents — read/write
- `lrnolivia/field`: Pull requests — read/write
- `lrnolivia/loew-runner`: Actions — read/write if dashboard workflow dispatch is used

The repair workflow fails closed when the token is absent.

## Safety model

The execution model is intentionally asymmetric:

```text
research/diagnosis     → automatic, read-only
state persistence      → runner repo only
target repair          → explicit + verified + PR
target main branch     → never written directly
```

That keeps routine background work cheap and low-friction without giving an unattended agent broad repository mutation authority.

