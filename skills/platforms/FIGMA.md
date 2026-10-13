---
name: relay-platforms-figma
description: Inspect or author editable Figma systems and handoffs through an available Figma capability, preserving real file identity and design intent.
---

# Figma orchestration

Use the real Figma capability when design work must be created, inspected, or handed off in Figma.

## When available

- inspect the existing design system/components before inventing replacements;
- preserve canonical tokens, spacing, component names, and variants;
- create flows/screens as editable layers, not screenshot-like flattening;
- use realistic content and clearly mark illustrative runtime data;
- keep implementation notes close to the relevant component/state;
- compare the rendered product to the approved Figma intent during QA.

## When unavailable

Do not claim a Figma edit occurred. Produce an implementation-neutral design specification with component anatomy, states, tokens, layout behavior, motion, and interaction flow that can be transferred later.

Figma is a design dependency, not a source of runtime truth.

## Workflow inputs, output and recovery

Collect file/page/node identity, edit authorization, approved reference, existing library/tokens and intended implementation target. Discover the actual Figma tool surface; its existence is not permission to edit an unrelated file. Inspect relevant nodes/components before changing them, then work within the requested scope. Preserve the user's ongoing edits and canonical component identities.

Deliver the real file/node link, modified components/states, responsive rules and implementation notes. Verify the resulting layers/variants and rendered design using the available readback/screenshot capability; distinguish illustrative data from runtime evidence. Re-read after an uncertain write before retrying to avoid duplicate frames.

The portable runtime requires the figma capability for this pack. Without it, resolution intentionally rejects the pack. Use general design-system, flow and visual-reference packs to produce a neutral handoff; label Figma creation unperformed. Do not invent a tool call, editable file or successful native handoff.
