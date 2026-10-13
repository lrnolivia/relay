# Relay 1.9.6.2 — operational staff routing and conversational cards

Assignment: `relay-1.9.6.2-operational-staff-routing-20261001`
Owner: `relay-1.9-wrapup-20261001`
Umbrella: `relay-1.9-skills-runtime-creative-20260930`

Runner persists canonical `primary_staff` and `supporting_staff` directory IDs on queue/claim/amend. New assignments resolve active staff deterministically from role/category; reserve identities require explicit selection; retired/unknown identities, duplicate teams and incompatible declared roles are rejected. Claim inherits the queued team. Explicit null/empty bindings are allowed. Reads preserve legacy unbound records, and amendments audit any newly resolved bindings. Handoffs keep the team while changing the machine owner through existing Runner authority.

Resume/checkpoint hashes, amendment windows, progress, worker messages and executive presentation carry the team. Canonical machine IDs, CAS, ownership, scope, branch/base identity, leases and exact-head gates remain authoritative. Staff metadata grants no access and is never a productivity score.

Normal conversational tools select `ui://relay/context-card/v2.html`. This compact resource renders staff, progress, blockers, connected handoffs, QA and next actions. Exact evidence is subordinate in an expandable panel. The explicit Open Relay action opens the full dashboard. The resource supports ChatGPT globals and MCP Apps initialization/tool-result notifications, binds elements explicitly to avoid browser API collisions, and displays connection/error uncertainty without manufacturing success.

Validation and deployment receipts will be appended before completion. The 1.9 umbrella remains open until successor creative/platform/performance/integration work is accounted for and fresh-consumer verification passes.

## Initial shipment and consumer-led correction

PR #72 tested head `a015761290cf86ada0c48e0537dbede1ce4e6cb2` passed full local tests/build, Chromium card initialization and exact-head Runner/CI gates. Squash merge `de5d8d6e8b6b1a3026e4f52feefe5121958a6ac7` deployed as version `14b11840-1c72-4402-a5da-e47d33e2ac4d`, deployment `10961170-a08b-4074-936f-7189084bcbcb`, at 100%. Runtime and source readback confirmed 1.9.6.2 and context-card/v2; canonical amendment and resume showed Julian with Ellis and Roman under the unchanged machine owner.

Readback exposed technical canonical next-action notes leaking into the human layer. A bounded correction keeps those exact notes in evidence and uses practical verification language in the default card. This assignment remains active until that correction and refreshed-consumer verification are complete.

The corrected card publishes under `ui://relay/context-card/v3.html` so consumers that cached v2 receive the corrected human layer after metadata refresh.
