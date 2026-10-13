# Human QA Helper

Runner's human QA helper turns exact evidence into a small, focused review for the user. Agents populate it; the user should not have to reverse-engineer what they are being asked to inspect.

Machine-readable contract: [`contracts/human-qa-helper.json`](../contracts/human-qa-helper.json).

## What belongs in the helper

Use the helper when the remaining question is genuinely human: visual quality, product direction, usability, interaction feel, layout hierarchy, wording, comparison, or another judgment that deterministic QA cannot prove.

Do not send routine machine-verifiable work to the user. Agents own tests, status codes, logs, source identity, exact deployment/version identity, required checks, and other deterministic facts.

Every helper packet is bound to exact review identity:

- project
- repository and exact head SHA
- PR/branch when applicable
- environment and route when applicable
- deployment/version identity when applicable
- Runner Visuals evidence IDs and/or run ID when media exists

If that identity changes materially, preserve the old answers as history but treat them as stale for the new artifact.

## Questions

Generate the questions before asking the user to review. Do not ask the user to invent the questions.

Default to **2–4 questions**. Hard limit: **6**.

A good question:

- asks one judgment
- is tied to an acceptance criterion, known ambiguity, or product decision
- tells the user what to look at or try
- uses plain product language
- can be answered while the relevant preview/evidence is visible

Bad:

> does this look good?

Better:

> does the darker secondary header feel clearly subordinate to the page title without disappearing into the warm charcoal background?

Bad:

> can you verify the deployment SHA is correct?

That is the agent's job.

Question responses may be yes/no/not sure, a bounded choice, or short text. The helper's overall verdict remains separate: `looks_good`, `needs_work`, or `not_sure`.

## Checklists

Use a checklist when the review has multiple observable conditions or a short interaction sequence. Default to **3–6 items**; hard limit: **10**.

Checklist items should be fast to scan while the preview is open. Examples:

- floating Runner stays readable without covering the element under review
- live preview can be interacted with
- captured fallback is shown when the preview is unavailable
- secondary headers are visibly smaller than primary headers
- notes remain present after reopening the same review

Do not put automated assertions in the checklist just to make the user reconfirm them.

For a truly single-criterion review, a checklist is optional.

## Population workflow for agents

1. Read the assignment acceptance criteria and current project QA overlay.
2. Verify deterministic facts first.
3. Register or resolve the exact Visuals evidence/run and artifact identity.
4. Identify what remains uncertain specifically because human judgment is required.
5. Populate targeted questions from those uncertainties.
6. Add checklist items for observable states/interaction steps.
7. Include known issues and deterministic evidence as context, not user homework.
8. Open or link the qa-shell helper only after the packet is populated.
9. Record answers, notes, checklist state, and overall verdict against that exact packet/evidence identity.
10. If head/evidence/deployment changes materially, invalidate the affected review and generate a fresh packet rather than silently carrying the old verdict forward.

If there is no meaningful human judgment left after deterministic QA, do not manufacture a human review step.

## Relationship to Visuals

Questions and checklists may be registered while screenshot/video bytes are still `queued` or `uploading`. The producer does not wait for transfer completion.

However, a visual criterion is not human-proven until the referenced image/video or live preview is actually viewable. Upload accounting and review truth are separate.

The QA helper should consume Runner Visuals evidence; it must not create a second evidence store.

## What the user should experience

The user should open qa-shell and immediately understand:

- what exact thing is being reviewed
- why their judgment is needed
- what the agent has already verified
- the few specific things to look at
- any short checklist they can work through
- where to leave notes
- the overall verdict
- what happens next if they choose `needs_work`, `not_sure`, or `looks_good`

The helper exists to reduce review effort, not transfer agent work to the user.
