# field Night Shift extraction

## Decision

The reusable Night Shift framework currently developed inside field is being promoted into `loew-runner`.

`field` remains the pilot project.

## Current authority

The extraction is now an authority boundary, not merely a future migration direction:

- `loew-runner@main/LOEW_CHAT_BIBLE.md` owns universal execution and QA law
- `loew-runner@main/projects/field.json` resolves the current project repository as `lrnolivia/field`
- `lrnolivia/field@main/AGENTS.md` owns the field-specific bootstrap/product overlay
- field-local handoff/QA documents are overlays and must re-read Runner before use
- historical Revyme repository names and checkout paths must not be used as current field targets


## Move to runner

The following concepts are universal and belong in runner:

- Contract Worker terminology
- Night Shift Manager lane
- assignment model
- ownership model
- mailbox model
- QA evidence model
- exact-SHA merge gate
- artificial-blocker repair doctrine
- deterministic promotion
- dependency diagnostics
- generic GitHub transport rules
- reusable templates
- dashboard/control behavior

## Remain field-specific

The following remain project policy/data:

- repository `lrnolivia/field`
- branch prefix `field/`
- `field/control` legacy compatibility during migration
- field build/test/lint commands
- field Preview/Canvas endpoints
- field-specific runtime QA criteria
- field product architecture
- source ownership for active field assignments

These values are represented by `projects/field.json`.

## Migration behavior

During migration, runner must understand both:

1. legacy active field coordination on `field/control`
2. new runner-owned control records

Do not invalidate active assignments merely to move their bookkeeping.

New universal assignments should be created in runner control state once the control branch implementation is ready.

After all legacy field assignments close, the project-local handoff kit can become a small migration pointer or be removed in a deliberate cleanup change.

## Important

Do not merge `field/control` into field main.

The extraction changes coordination ownership, not field product architecture.
