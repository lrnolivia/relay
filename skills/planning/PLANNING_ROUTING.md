---
name: relay-planning-planning-routing
description: Route current work and dependency-aware multitasking from resume, amendment and finding records while preserving acceptance, ownership and ready releases.
---

# Planning and ledger routing

Relay planning starts from canonical state, not chat archaeology.

1. Read the latest valid resume checkpoint first.
2. Read only amendments newer than the worker's consumed cursor.
3. Scan relevant open findings and classify each as adopt, defer, reject, or supersede.
4. Prefer amending the best existing assignment when the finding belongs to work already in flight.
5. Create a successor only when independent ownership or a clean release boundary is genuinely required.
6. Keep ledger linkage/status current after the decision.

Assignment taxonomy is routing metadata, not authority. Category, labels, tags, primary role, and supporting roles inform filtering and skill selection while Runner owner/path/resource policy remains authoritative.

No-change amendment reads add no model context. Scope-changing or blocking changes force canonical reconciliation before more conflicting work.

## Inputs and outcome

Read live project/assignment registration, current claim, valid resume checkpoint, amendment cursor and relevant findings. Compare findings with existing open work before deciding to amend, defer, reject or propose an independently owned successor. Record the decision, evidence, acceptance linkage and next executable action through supported canonical tools.

Verify scope and ownership before implementation; planning metadata is not admission. If the cursor/history or owner disagrees with local memory, refresh and reconcile instead of continuing the stale plan. When the next action requires unavailable capability or human authority, park that path and select another admitted useful action. Never treat elapsed time as a released claim.

## Dependency-aware multitasking

Classify the next steps by the evidence each actually needs:

- A hard dependency prevents correct or authorized execution: an unresolved interface, conflicting source ownership, missing access, or a deployment required for an integration assertion. Name the producer, exact artifact/contract and condition that releases the dependent step.
- A verification dependency delays a particular proof or promotion, while implementation, fixtures, isolated checks and review preparation can continue against the agreed contract. Keep those results labelled with their source and environment.
- Independent work shares a project or release calendar but needs none of the blocked inputs. Continue useful admitted work rather than waiting for every neighboring deployment.

For example, a frontend can implement and test an agreed feedback-binding interface while the backend deploys; pause the live integration check until that exact backend is available. An unrelated layout correction need not wait for either deployment. Do not invent a contract to make dependent implementation appear independent.

Keep a release that already passed its exact-head gates separate from follow-up changes. Preserve its immutable source, checks, deployment and rollback evidence; use an isolated checkout or an admitted branch after publication for follow-up work. Do not mix new edits into a ready candidate or reuse its green checks for a changed head.

Multitasking does not grant another writer, claim or messaging permission. Use the existing worker for independent steps by default; overlapping paths/resources still require canonical reconciliation. Respect the user's worker limit and avoid spawning workers, extra usage or repeated polling just to fill an external wait.

Report what advanced, the specific step still waiting, its release condition and the next independent action. A check-in is liveness; count progress only when an implementation, check or artifact actually changes. Revisit the dependent step when new evidence arrives, preserving the original acceptance and remaining proof gaps.
