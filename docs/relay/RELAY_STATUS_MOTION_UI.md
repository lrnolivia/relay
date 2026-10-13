# Relay semantic status + motion UI

Task class: **design**

This release makes Relay's visual language match its observed-progress semantics without changing any backend state or authority.

## naming

Human-facing feature identity is lowercase and consistent everywhere:

- today
- runner
- inspector
- night shift

The runner page no longer presents itself as "Projects", and inspector no longer presents itself as "Review". Section headers and shared workspace labels follow the same lowercase language.

## semantic status system

Relay's existing state semantics drive one shared presentation palette:

- working → cyan active pulse
- external-system wait → cool blue breathing signal
- waiting for human / needs action → orange attention pulse
- possibly stale / stale / warning → amber caution signal
- failed / blocked → coral-red alert pulse
- complete / healthy → green steady signal
- quiet / zero / paused → neutral, no ambient animation

Color is never the only cue: labels remain present and every animated state has a visible status light.

Runner summary metrics use the same system. Zero counts remain quiet; nonzero values inherit the semantic status color and signal.

## motion thesis

Motion communicates liveness only.

- working uses a bounded expanding status-light pulse
- external waits breathe at a slower cadence
- attention states pulse more urgently
- stale states use a slow caution fade
- failures use a restrained alert ring
- healthy/complete remains calm and steady

Cards, layouts, and content do not loop. Large areas do not animate. Motion is isolated to the status indicator.

All loops stop under prefers-reduced-motion while the color, label, shape and static indicator remain visible.

## visual constraints

- no gradients
- no fake bottom-border depth
- retain the shared horizontal project tab rail
- retain flat card/action geometry
- retain quiet ChatGPT settings utility
- preserve current Terra Prime palette and approved Relay / Runner / Inspector marks

## verification

The browser contract asserts:

- lowercase feature navigation and page heading identity
- semantic nonzero runner metrics
- failed status uses bad/danger presentation rather than neutral gray
- alert status lights have an active animation under normal motion
- reduced-motion removes the loop without removing semantic color
- desktop, MCP-hosted, and mobile views remain overflow-safe

Full repository tests, shared web/MCP build, no-gradient scan, and compiled motion-keyframe checks must pass before merge.
