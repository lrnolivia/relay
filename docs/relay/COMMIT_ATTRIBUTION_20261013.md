# Prospective project commit attribution

Lauren requested that Relay, Codex and Claude stop appearing as project contributors. This local candidate implements attribution for ordinary local Git commits and explicitly prepared local final commits, including squash results. It preserves legitimate human coauthors. It has not been pushed, merged, deployed, or installed in another project's checkout.

Assignment `relay-project-attribution-20261013` is owned by Mac worker thread `01a132f7-348f-772b-99fb-aabd339d0037`. The initial live main/base was `c96e4a79b79a55d5f0097d0b85e749b249865c17`; the isolated checkout includes its own supported coordination claim commit `2b215221e8fadc9954a5c1ca21b29ba1543c9693`. Preflight admitted only the new helper/tool/config/tests and the thin agent pointers. The broad Relay rebuild remains held by `claude-open` at `80b887cc457ad7a1c55477cf43bcbbd0b61a6957`; its reserved source handlers and workflows are unchanged. The rtxForge design checkout is untouched.

## Identity and policy

Use `Lauren Olivia <lrnoliv@gmail.com>` for new commits through this tool. This exact address was observed, not generated: GitHub commit `lrnolivia/gwfamily@368f109a63505b9bea976f42217522899fa5d39f` has Lauren as both raw Git author and committer, and both GitHub account links resolve to `lrnolivia`, numeric ID `311277794`. The existing authenticated `gh api user` returns that same account. Setup and tool-created commits revalidate these two existing read-only routes and fail closed on another account or changed witness.

This proves the address's existing GitHub association. The credential cannot read `/user/emails`: GitHub returned HTTP 404 with a request for `user` scope. The email's current verified-email flag is therefore unverified by this worker. No scope, token or credential was added. If that independent flag is required, Lauren must separately authorize the existing credential's email-read permission; the commit-linked identity does not require that expansion.

`Co-authored-by` entries matching the three observed tool addresses are removed: `noreply@anthropic.com`, `codex@openai.com`, and `335984207+relay-by-loew-fi[bot]@users.noreply.github.com`. Matching is case-insensitive. Human coauthors, other trailers and quoted examples are retained; a person's display name alone never triggers removal. Unknown future tool addresses require a reviewed policy extension.

Do not add tool credits to commit messages. Do not replace legitimate human authorship or coauthors in work outside Lauren's explicitly authorized project changes. Do not amend/rebase published commits, force-push, change global Git configuration, invent addresses, or replace existing signing/hook policy.

Lauren's mandatory prospective rule also excludes voluntary vendor/model/tool credits in PR descriptions, generated-by headers, badges and advertising. Pass the rule to every delegated worker; automatic credit instructions must not reintroduce it. Preserve required legal notices, useful comments and functional product AI references, and do not falsely claim that AI was not used. Established loew.fi personas are presentation identities unless an existing authorized Git identity is separately verified. Do not invent persona emails or map historical tool commits to personas.

## Local adoption and checks

For an explicitly authorized local-only implementation, the native coordination CLI separates preparation from publication:

```sh
node scripts/coordinate.mjs local-preflight relay /path/to/owner-and-complete-paths.json
```

The request contains only `id`, `owner` and all changed `paths`. The read-only helper verifies current registration/engine, live active owner/lease, exact declared scope, budget and all applicable overlap/drift findings. Only the current assignment's absent remote branch is deferred. Its receipt has `local_work_admitted`, `phase="local-preparation"` and `publication_admitted=false`, plus remaining publication blockers. It creates no branch/claim or remote write and grants no host permission. Public MCP preflight and the CLI `preflight`/`pr-gate` remain publication gates; a real remote branch is required even before the inventory's one-hour missing-branch grace interval. A caller cannot request local mode through the public MCP schema. Use publication admission before a later authorized remote source change.

Global guidance was subsequently corrected to retain the attribution preference and verified identity without exporting this task's Git/history restrictions to every future task. Operational actions follow current explicit user authorization and actual host permissions. The sandbox/approval/security profile and current task's no-publication/no-history limits were not changed. The unexpectedly emptied global Codex AGENTS file was preserved; its prior instructions were not blindly restored.

Run from an admitted, separately owned Lauren project checkout, using the retained Relay tool path:

```sh
node /path/to/relay/scripts/project-attribution.mjs configure --repo /path/to/project
node /path/to/relay/scripts/project-attribution.mjs commit /path/to/reviewed-message.txt --repo /path/to/project
node /path/to/relay/scripts/project-attribution.mjs check HEAD --repo /path/to/project
```

`configure` writes only the target clone's local `user.name`, `user.email`, `user.useConfigOnly` and a `commit-msg` hook. The hook strips known tool trailers and blocks incorrect Git author or committer overrides. Setup refuses linked worktrees/shared Git directories, another GitHub owner, existing `core.hooksPath`, and an existing unrelated `commit-msg` hook. Such hooks require integration by their owner; this tool does not disable them. Setup is idempotent for its own hook.

The hook references the retained tool and Node paths. Keep those files in place while the hook is installed; moving them requires reinstallation after accounting for the old hook. Rollback consists of removing only the exact generated hook and restoring that clone's previous local identity values from its checkpoint. Signing settings remain intact. Git hooks are cooperative local checks; external API writers and explicit hook bypasses do not run them.

`commit` accepts only a message file and the already-staged index. It creates a new local commit, preserves existing hooks/signing behavior, then reads the actual raw commit object to verify author, committer and message. It exposes no push, merge, amend or history-rewrite operation. `check` is read-only and ignores mailmap display aliases by inspecting the raw object.

For a future separately authorized GitHub merge, verify the exact returned final SHA:

```sh
node /path/to/relay/scripts/project-attribution.mjs check-github lrnolivia/PROJECT EXACT_FINAL_SHA
```

That check requires Lauren's raw author identity and linked GitHub account; it rejects AI/tool coauthors and bot authors. It permits GitHub's normal `GitHub <noreply@github.com>` / `web-flow` server committer, or Lauren's linked committer. PR creation/merge actors are distinct metadata and remain visible in the audit trail.

`.claude/settings.json` disables Claude's generated commit and PR attribution and its session trailer/link for this repository. Installed Claude Code `2.1.251` contains the `attribution.commit`/`attribution.pr` settings schema, where an empty string hides attribution, and `attribution.sessionUrl=false`. The supported deprecated `includeCoAuthoredBy=false` also disables legacy credits. At initial inspection, no explicit AI-credit requirement was found in the selected tracked or local instruction files. `AGENTS.md` and `CLAUDE.md` point both tools to this policy. Other project checkouts need their own admitted adoption; this patch does not edit the active rtxForge task.

Lauren subsequently authorized Mac-wide prospective instructions/settings. The worker installed the compact policy in `~/.codex/AGENTS.md`, documented `developer_instructions` in `~/.codex/config.toml`, `~/.claude/CLAUDE.md`, and the same Claude controls in `~/.claude/settings.json`, preserving unrelated configuration with private backups. Codex desktop's inspected local source supports a blank `commit_attribution` fallback; its account-level `commit_attribution_enabled` takes precedence. Computer Use denied access to that app, so the account toggle remains unverified. Fresh native Codex prompt rendering checks instruction ingestion; existing sessions, higher-precedence project/managed/CLI settings, Windows and external workers still need explicit propagation. These instruction/config controls are not a replacement for exact commit checks or the reserved API/merge integration below.

## Local writer integration; publication pending

Lauren subsequently authorized an attribution-only serial carve-out. The existing Relay coordination handler was invoked through her existing verified `gh` connection with explicit metadata and exact readback. Control commits `0c18168d0d61ad733c4930ab7fdb327c7e4b5e5f` (shrink), `85b1aa3427977d36c5c10388d20f35a90e38bf05` (expand), and `8aa7648df5f6b873eac32b4434c34ad499a14872` (own activation) are all Lauren-authored/committed, with no tool trailer. Eleven writer/template/validation paths were transferred; the other 182 held rebuild paths, resources, objectives and WIP `80b887cc457ad7a1c55477cf43bcbbd0b61a6957` remain preserved. The umbrella was not resumed. Remote preflight reports only the intentionally unpublished task branch; its publication gate was not weakened. The current explicit instruction permits this local candidate and prohibits source publication/deployment.

The local candidate now applies `attributedCommitBody` to multi-file, ancestry-sync, bounded text, Contents and coordination writes and reads back exact GitHub metadata. Git Database objects are checked against author/account, committer, message, tree and parents before a non-force ref update. Contents updates are atomic: unexpected readback is reported as unverified rather than success. A lost coordination response is reconciled by a bounded history lookup matching both record blob identities and its parent, followed by exact metadata validation; it does not assume the latest main commit belongs to that transaction or replay a write. The three native workflows configure local Lauren identity and check the actual Git object before pushing. The dependency repair PR body omits its tool advertisement. The existing worker prompt repeats the mandatory attribution rule without changing the admitted objective.

The merge action now refuses App/public authentication and unverified rebase routes before mutation. An existing human-token route must verify Lauren through the same account/witness, require a Lauren-created PR and compliant exact head, preserve green/check/head gates and a complete exact-head PR commit inventory, retain source messages/sign-offs and legitimate human credits, and remove known tool coauthors. The custom merge message and exact final GitHub object are verified. Wrong final metadata is reported as unverified after mutation; no unauthorized historical rollback is attempted. The production App connection is not replaced or augmented. Its automated merges remain blocked once this candidate is deployed, until an existing authorized compliant human route is used.

The following original findings identify the existing **live, unreleased** writer behavior and historical root cause; they are not a claim that the new local candidate lacks these integrations.

The helper explicitly supplies both Git author and committer and sanitizes messages for Git Database/Contents API writes. Its now-integrated local call sites are:

- `src/source.js`: multi-file Git commits and ancestry-sync commits.
- `src/source-text-mutation.js`: bounded text-mutation Git commits.
- `src/index.js`: Contents API updates.
- `src/runner-control-core.js` and `scripts/coordinate.mjs`: coordination Contents API writes.
- `.github/workflows/runner.yml`, `field-dependency-doctor.yml`, and `field-dependency-repair.yml`: ordinary Git state commits currently configured as `relay <actions@users.noreply.github.com>`.

The original reservation was resolved only for the explicitly authorized attribution slice. Existing authorized GitHub App writes can specify Git commit author metadata without creating credentials; the App remains the API audit actor. Earlier admission transactions used the old bot writer; the later serial carve-out used the verified human route described above. No existing commit was rewritten.

`src/source-lifecycle.js` currently uses the GitHub squash merge endpoint with only expected SHA/method. The REST endpoint accepts commit title/message, expected head SHA and merge method, but no Git author override. `gwfamily` PR36 demonstrates the consequence: its Lauren-authored source has no AI trailer, yet final squash `c5333491d668a24be892f38b6cfcf869b626be9d` is Relay-bot authored, GitHub committed, with Lauren retained as a human coauthor. PR creator and merger are both the Relay App. `rtxForge` squash `acd71e9a3da59a86c04794247ac8ead60fdbb95a` is also Relay-bot authored and retained Codex, Relay and Lauren coauthors.

Removing trailers or setting the source commit author does not solve that squash behavior. A reviewed merge route must create Lauren-authored final metadata through an existing authorized identity route, preserve protection/check/expected-head gates, and read back the exact resulting object. A local final commit prepared by this tool is verified locally; it is not proof of a GitHub merge. No persistent auth change was attempted. If an accepted remote merge route needs a human user token or additional app permission unavailable today, stop that path and obtain explicit authorization for that exact route; do not create credentials or silently replace the App connection.

## Validation and retrospective limits

Focused command: `node --test src/commit-attribution.test.js`: **14 passed** on pinned Node **22.23.3**. `npm ci` completed with the existing lockfile; `npm run check` passed. The existing required Inspector suite automatically discovers this file; it imports the real-Git regression suite. Tests inspect actual raw Git objects for ordinary branch commits and a local squash result, assert its single parent and source-equivalent tree, preserve human coauthors, reject wrong authors/committers/accounts, preserve existing hooks/global config, refuse hook symlink redirection, and verify exact final-provider SHA/account metadata with isolated API fixtures. There are no remote write/merge tests.

The candidate at `353a33731e0e2449e31c6ab1913a62c5e85a71b8` completed the exact-source build/check and all five required suites: **919 passed, 2 existing skips, 0 failed**. Its 34 focused attribution/AI Cleanup tests also passed. Logs are retained in the task directory. Earlier failed runs remain preserved; the final run used the existing Mac temporary-directory contract and an approved execution context for local runtime servers/browser launch. No assertions or required checks were weakened. The later global policy installer has five tests covering exact rollback, concurrent edits, tampering and symlink rejection. The install reported three existing high-severity dependency advisories; dependency remediation is outside this attribution slice.

Historical commits still contain the original author/coauthor metadata. Removing those contributors from history would require a separately approved repository-specific rewrite of every affected reachable commit and descendant, followed by coordinated publication/ref updates and GitHub statistic refresh. Rewriting changes SHAs, invalidates signatures and exact-SHA release/Relay receipts, and disrupts branches, clones, PR provenance and deployments. It does not erase historical PR/merge audit actors. No historical rewrite is authorized or performed.

The current GitHub documentation says contributor graphs omit merge/empty commits and depend on default-branch commits and linked author email; statistics can take about 24 hours to refresh after history changes, with GitHub Support needed for persistent stale data. Do not promise that a `.mailmap`, trailer-free future commits, or a revert removes old sidebar contributors. The contributor sidebar itself was not independently inspected here.

Primary references: [Git commit metadata API](https://docs.github.com/en/rest/git/commits#create-a-commit), [merge API parameters](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request), [GitHub contributor display](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors), [Claude settings](https://code.claude.com/docs/en/settings).
