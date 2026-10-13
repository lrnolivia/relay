# field QA classification overlay

> Read current `lrnolivia/loew-runner@main/LOEW_CHAT_BIBLE.md` section 11 first. Runner owns the universal classification meanings, retry/watchdog rules, fallbacks, and danger-zone boundary.

field uses the Runner vocabulary without weakening it:

## PASS
Direct evidence proves the criterion on the recorded exact artifact/SHA.

## FAIL — FIELD
The harness successfully exercised the intended behavior and direct evidence shows field violated the criterion. This is field's specialization of Runner `FAIL — PRODUCT`.

## BLOCKED/UNVERIFIED — HARNESS
Product correctness is unknown because the selected harness could not prove the criterion.

## BLOCKED — ENVIRONMENT
The required external/runtime environment is unavailable or invalid.

## DANGER ZONE — HUMAN QA REQUIRED
Automated QA has been deliberately exited under Runner section 11, deterministic gates that must pass are satisfied or inapplicable, and an isolated exact-SHA Preview plus human-QA packet is ready. This is a stop state for automatic promotion, not a pass.

## NOT RUN
The required check has not been attempted.

Missing or ambiguous evidence is never a pass. If the tested head changes, affected automated and human runtime evidence becomes stale.
