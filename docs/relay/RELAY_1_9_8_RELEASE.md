# Relay 1.9.8 — agentic tool contract hardening

Relay 1.9.8 applies a versioned production tool-design standard to Relay's MCP surface using Arcade's Agentic Tool Patterns as an external review baseline.

## What changed

- added `TOOL_DESIGN_STANDARD.md` with family-level applicability/deviation matrix;
- formalized query / discovery / command / recipe roles and dependency hints;
- improved high-value Runner and SOURCE descriptions so agents know which read must precede guarded mutation and how to recover;
- extension errors now expose structured class, retryability, auth/user requirements, and recovery guidance while retaining a concise text error;
- mutation timeouts/uncertain outcomes require readback before retry;
- Runner capacity errors are explicitly retryable while authority/conflict errors remain reconciliation-first;
- introduced a machine-readable agentic-tool contract schema;
- defined durable recipe contracts for ship-change, publish-worker, qa-then-merge, and rollback-release so the operation framework shares the same contract rather than inventing a parallel tool philosophy;
- added conformance/eval coverage for descriptions, dangerous-input constraints, error shaping, side-effect disclosure, bounded recipes, and duplicate high-level intent.

## Deliberate choices

Relay does not implement every Arcade pattern mechanically. It keeps exact low-level primitives where they are needed for evidence/recovery, and uses recipes only for repeated fragile chains. It does not add a generic fallback writer: fallback is allowed only when authority and truth are preserved.

Human staff/team identity remains routing/presentation context, never an authorization anchor. Credentials remain server-side.

## Release boundary

1.9.8 hardens the tool interface and recipe contracts. The durable operation execution/persistence framework is a linked successor that consumes these contracts. 1.9.9 consumes the resulting human-first, structured tool surface for ChatGPT-native cards/workspace.
