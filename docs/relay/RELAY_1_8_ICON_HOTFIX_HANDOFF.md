# Relay 1.8 icon hotfix handoff

This is the immediate visual-successor handoff for Relay 1.8.

## Boundary

Do not reopen or rewrite Relay 1.8 architecture. Consume the shipped 1.8 card/dashboard contracts exactly as released.

This successor is for **design** work:
- a final Today mark/icon if one is approved;
- a final lowercase `night shift` mark/icon;
- replacement Relay illustrations where they materially improve the UI;
- any small visual alignment needed after those assets land.

It is not a control-plane, progress-model, or deployment-authority assignment.

## Existing MCP icon work

PR #47 / assignment `relay-mcp-icon-metadata-20260930` is separate held work for advertising the supplied official Relay Loop PNG through MCP server identity metadata.

Do not absorb, supersede, or rewrite PR #47 without explicit reconciliation. This hotfix should avoid `apps/mcp/index.js`, `apps/mcp/branding.js`, and `test/mcp-branding.test.mjs` unless that claim is formally completed or handed off.

## Acceptance

- preserve approved Relay / Runner / Inspector marks exactly;
- keep human-facing `night shift` lowercase;
- use Terra Prime's neutral greige/cream foundation and existing accent system;
- do not use yellow as the primary new icon accent;
- no generic decorative illustration should replace a real product mark;
- responsive web and MCP surfaces remain stable;
- reduced-motion behavior remains intact;
- design-only scope must not silently absorb architecture or maintenance work.

Recommended successor assignment: `relay-1.8.1-icon-hotfix-20260930`.
