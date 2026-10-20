---
name: relay-coordination-worker-communication
description: Prepare or deliver explicitly authorized artifact-bound worker messages and handoffs with exact recipient identity and canonical readback.
---

# Worker communication

Relay workers communicate as a staff organization, not as anonymous transport processes.

Before sending a cross-worker message:
1. inspect current canonical assignment/resume state;
2. classify it as FYI, request, blocker, decision, handoff, or scope-change;
3. use canonical sticky staff identity when a binding exists; never invent a replacement name;
4. preserve exact project/assignment/owner/branch/PR/evidence identity underneath the human name;
5. state context, impact, and requested action;
6. suppress duplicate/no-op chatter.

A message is never hidden coordination state. Handoffs and scope changes require the canonical Runner transaction.

Human narration defaults to person + ownership + outcome + validation. Tool transport, SHA and RPC details are subordinate unless they explain the result or a blocker.

## Inputs, output and recovery

Gather explicit messaging authorization, actual recipient identity, current assignment/scope, artifact/evidence and the requested response. Discover the available communication interface; do not assume it can wake native chats. Send only within the authorized purpose, with a stable operation ID when the transport provides one.

Deliver message/receipt identity, intended recipient and actual delivery state. Readback verifies storage; recipient acknowledgement is a separate fact and requires that recipient's current identity. If outcome is uncertain, reconcile the same intent before sending again. If no transport or authority exists, prepare the message and record the blocker without claiming delivery. A message does not transfer ownership; use the canonical handoff transaction for that.

## Canonical shared continuation

Follow `lrnolivia/relay@main/LOEW_CHAT_BIBLE.md` sections5,6.1.1,18,20. Necessary supporting features and directly related strengthening improvements may expand the active task’s acceptance while its original goal stays fixed. The coordinator records reason, relationship, dependencies, acceptance, verifier profile and admitted paths; accepted additions must execute/verify before completion. Preserve the bounded append-only expansion ledger and unresolved scope/job intents through resume and provider handoff. Semantic duplicates, cycles and exhausted budgets do not create more work. Material goal changes, unrelated tasks, sensitive permissions and paid services need their actual authority.

Codex and Claude share ownership/acceptance/evidence rules, with explicit real adapter identity/capabilities. Never replay an uncertain job on another provider or write one checkout concurrently. Native chat delivery/acknowledgement is separate from process or storage receipts. Permanent operational handoffs and maintenance records go to `lrnolivia/relay/docs/<project-id>/`; prefer canonical references and keep temporary artifacts outside source. Product/user/contributor/architecture/build-required docs remain with their product.
