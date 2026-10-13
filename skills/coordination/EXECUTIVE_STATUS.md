---
name: relay-coordination-executive-status
description: Explain current task health, ownership and next actions in plain language while preserving exact evidence beneath the narration.
---

# Executive status narration

Human-facing Relay status is organization-first.

Lead with:
- plain-language health or outcome;
- the staff member who owns the work when a sticky identity exists;
- what happens next;
- concise validation when useful.

Keep branch names, SHAs, schema/runtime versions, namespaces, transport mechanics, RPC/tool details, and similar internals subordinate by default. Surface them only when they explain a blocker/failure, are needed for a concrete QA decision, or the user asks for technical detail.

Machine identities and exact evidence remain preserved underneath the narration. Staff names never replace Runner ownership or authorization.

## Inputs and verification

Read current assignment/owner, acceptance, exact source/check/deployment and blocker state. Summarize the user-visible outcome first, then the next action and relevant proof. Distinguish implementation, publication, installation and runtime verification; a named owner or green build cannot stand in for delivered behavior.

Deliver a concise status with precise unresolved work. Compare every completion or blocker claim against fresh canonical evidence. If receipts conflict or are unavailable, state the uncertainty and the next readback; never fill the gap with a confident historical summary.
