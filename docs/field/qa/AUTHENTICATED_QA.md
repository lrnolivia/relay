# Authenticated / human QA

> Universal process authority: read `lrnolivia/loew-runner@main/LOEW_CHAT_BIBLE.md` and `contracts/manifest.json` first. This file is a field-specific overlay and must not fork the universal operating contract.

Apply current Runner Bible section 11 first. Authenticated/project-native verification is the field-specific harness for criteria that require protected state, credentials, persistence, account metadata, or an environment generic Inspector/browser paths cannot prove.

`/builder/noauth` is smoke-only; `/qa/work/<projectId>` is read-only real-project truth. Neither proves authenticated persistence or account behavior.

Examples include Cloudflare Access authentication/re-authentication, dashboard project listing/rename/star/trash/restore, R2 persistence, real account metadata, authenticated API behavior, ETag/stale-session conflict behavior, multi-browser or multi-session persistence, and production-only integration behavior.

Record the exact tested branch/main/deployed SHA when knowable, environment/URL, non-secret auth context, steps, expected result, actual result, and PASS / FAIL / BLOCKED / NOT RUN.

Do not place secrets, cookies, tokens, or private credentials in QA records.

Authenticated/human QA is separate evidence. It does not make stale branch QA current and does not permit claiming an untested SHA was validated.
