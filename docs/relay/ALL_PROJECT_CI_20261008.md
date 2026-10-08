# All-project CI and autonomous release assurance

Status: active after Lauren's explicit “keep going” on 2026-10-08 UTC. Chat `01a118b2-63d5-7a63-8d3a-55bf649b1f89` owns Relay assignment `relay-mcp-rebuild-continuation-20261003`. Preserve unrelated holds, the original rebuild acceptance and Files-last ordering.

## Objective and authorization

Streamline CI across ALL projects, permanently repair discovered failures, and complete approved work autonomously through deployment and verification. The safety controls must honor one chat instruction to stop or roll back. Healthy and explicitly Lauren-approved release targets remain distinct. No new credentials, spending, platform migration, force push or discarded work is authorized.

Lauren authorized CI-only takeovers for rtxForge, GameBridge, The Take and loew-shell, followed by release of their scopes. GW is the active product chat and remains the sole source/workflow writer. Lauren's later instruction to coordinate GW first was handled by owner application of the reviewed CI patch.

## Verified published CI slices

| Repository | PR | Merge |
| --- | --- | --- |
| loewfi | [5](https://github.com/lrnolivia/loewfi/pull/5) | `b08c58f28f5f13ef0c1b5816d8992dc8a9de7e04` |
| loewtorials | [5](https://github.com/lrnolivia/loewtorials/pull/5) | `70db9e6b0ae2121c3f21d203db1deb88e9ac212b` |
| CTRL | [31](https://github.com/lrnolivia/ctrl/pull/31) | `0dfe6c3926b4ae02068bdcc9b339aa625ddbd062` |
| Field | [148](https://github.com/lrnolivia/field/pull/148) | `4f2d5a091fc0b4a2cd19a1f71907015590c88450` |
| GameBridge | [4](https://github.com/lrnolivia/GameBridge/pull/4) | `5c7b3a68cf8fe94e1036c67e1c5f10266e4069a0` |
| The Take | [5](https://github.com/lrnolivia/thetake/pull/5) | `f9e47f26016b0ee2071d6e7f5356e3b5f7b92f2b` |
| loew-shell | [5](https://github.com/lrnolivia/loew-shell/pull/5) | `3f20ab8bda534c45c9c83a1f99254f7a7b141750` |
| rtxForge | [16](https://github.com/lrnolivia/rtxForge/pull/16) | `0778d5e577e95a6d65bdd68ffcf860ea90cff635` |

All eight exact candidates passed applicable checks. Published changed bytes were read back and restored into isolated directories with Git blob/content integrity checks. Their bounded CI assignments are completed; workflow scopes are released, and product branches remain. rtxForge's original test reservation was restored after the fixture repair.

Hygiene changes from 48 to 1 scheduled triggers per day per project, a 97.9% trigger reduction. Admission remains immediate and manual controls remain. Obsolete PR checks cancel; commands, assertions, platform coverage, required job names and permissions remain. Billed-minute savings are not yet measured.

rtxForge's capture helper legitimately returns “frame not ready.” Its fixture incorrectly dereferenced that result. The repair retains its pending step, waits through GTK's event loop for at most five seconds, and preserves every image/behavior assertion. Exact head `3576dc91213ee64c09f4fe58735d905bfd80be68` passed native, KDE, Wayland and admission.

Accented [PR12](https://github.com/lrnolivia/Accented/pull/12), `1d5bb319a2165c82e6bb0cc448bd1da18d0e3c0e`, cancels obsolete PR checks while giving main/tag/manual runs unique identities. Native, package, Flatpak and release gates remain intact. All native, DEB/RPM and Flatpak checks passed. Merged at `be698e1e6d9ea23d1912a7c53471d33eb4f88e25`; workflow readback and isolated restoration verified.

## Relay release and current candidate

PR184: merge `6c3b76cac53c3c28046cbca9d66330d603314d02`; sampled PR runner time 783s to 152s, main 205s versus 186s. No main speedup is claimed.

PR185: merge `cbeebc118e14848cab5949723b09f52fd3a70866`; Linux main [37711059476](https://github.com/lrnolivia/relay/actions/runs/37711059476) passed all five suites, runtime and production gates. Production receipt identifies that source and web build `20d311e5b7d8fb7d98dca2c6a036bb2456cfb32297a218c10e9333feb6cba00a`. Provider readback showed version `905fd216-f5ce-40e0-8a85-ecff0ee85149` at 100%, deployment `93d8428f-5632-4aa2-9141-6f13a46dca32`.

The new local Relay candidate uses separate safety atoms on the existing `RELAY_EVENTS` binding. Fresh global/project holds guard Relay source publication, deployment and new execution. Admitted executors request cancellation at checkpoints; process exit remains separate evidence. Reads, cancellation and coordination receipts remain usable.

Authenticated `relay_autonomy` and operator API record holds/resumes and exact healthy/user-approved targets. Rollback holds the project, selects only the requested recorded target, checks provider retention, production identity and registered compatibility, and remains held after verification. Unknown provider outcomes stay pending and reconcile before another write. Missing/incompatible targets remain held. Approval is attributed to the explicit user instruction; no historical approval is invented.

Only Relay currently has a recovery profile. Its new build declares `relay-autonomy-v1`; older builds lacking the control capability cannot become these targets. No explicitly Lauren-approved target has been seeded. Focused state, provider, source, authentication, API and runtime-contract checks passed 176 tests. An expanded Mac run also encountered seven existing Linux-only descriptor/capture gates; those must pass in canonical Linux CI. Local workerd passed on exact source59e64c0. Canonical Linux run37716018608 failed only the real process-termination observation: Linux returned ESRCH during a proc stat read as the killed task disappeared. The helper now accepts that documented absence alongside ENOENT, preserves the live-process negative control and bounded deadline, and propagates permission/I/O errors. Focused follow-up:42pass,0fail,2Linux-only checks explicitly skipped on macOS. Canonical Linux/runtime/release gates remain required on the amended candidate.

Field preview QA [37711177470](https://github.com/lrnolivia/relay/actions/runs/37711177470) failed when Inspector fetched Relay's own protected API and received 522. The prior Relay QA report already recorded this self-origin limitation. The new `global_fetch_strictly_public` flag follows [Cloudflare's documented routing behavior](https://developers.cloudflare.com/workers/configuration/compatibility-flags/). The actual protected request after deployment must establish the fix.

Relay hygiene becomes daily. Its redundant twice-hourly legacy default-Field audit schedule is removed; the manual audit/transaction interface and separate hourly model-free observer remain. Existing expired/scope-drift findings still require owner reconciliation, not false audit passes or deletion of retained work.

## Remaining portfolio work

- GW: active chat `GW Dev 10/7 - Round 3`, owner `01a118bb-6944-7fc1-aeb8-c886955c79d6`, applied the reviewed workflow in PR12 exact `7d95382c95246ea05075638179c5dd55caa528f7`. This chat independently compared all remote workflow bytes with reviewed SHA256 `6c5a04f9f3bdcdb48af2dca1acea45025c77ee7d3f5994fc91562e83b39e052d`. Full mapping preserves17suites/32engine invocations, both verify check names, fixture order and every prior QA/build artifact. Shared frontend/backend units/builds/year-safe artifact run once; both lanes fail on source/archive/file-hash mismatch. Separate media/live steps and one tee per suite preserve complete failures. Review rejects duplicate log writers. [Canonical run37717353012](https://github.com/lrnolivia/gwfamily/actions/runs/37717353012): shared job passed (independent check readback); browser gates running, owner reports recovery failure under diagnosis. Owner reports1038frontend/333backend and59artifact-file hashes verified. No competing writer/run. CI integration is published; full browser acceptance/release remains pending. Reviewed delivery bundle readback and isolated restoration verified in private transfer `tr_3bb7bbfa2253da9d30e8c2bfebdd0a4b`,72h delivery; integrated Git is permanent source.
- Bazzite (`lrnolivia/bazzite-custom`, `086e0a9ff2efa21418279867cca8936f0230ecfd`): already daily, with cancellation and scoped disk-image triggers. Preserve upstream OS/package refresh. Unchanged repository code is insufficient reason to skip. Further savings need a dependency-complete cache/change criterion.
- RTXForge-MFG (`7b7220bbb4994a9c8ae60cfc75a44cb67995efb8`): sampled zero Actions activity. Preserve manual Windows/release/signing workflows. Review live active triggers; claim no unmeasured savings.
- Adwaita-for-Steam (`1e92107a51f6ed53c59c38646444c9eb3a52b030`): workflow directory absent; no CI is introduced to manufacture a change.
- Arc: registered upstream is unmanaged and outside first-party ownership; do not mutate upstream under a blanket local rollout.
- Inspect Field's branch-specific mobile pipeline and repeated Fedora setup in rtxForge against fresh ownership/runtime evidence. Compare post-rollout runner minutes against the 103-run sample; Relay's initial baseline collected 1000 of 1008 runs, preserving that coverage limitation.

## Next actions and operational limits

1. Validate one exact Relay candidate in local workerd and canonical Linux, deploy via existing Workers Builds, then verify the protected self-fetch and authenticated controls.
2. Retain and restore-verify exact compiled approved/healthy artifacts before advertising indefinite recovery retention. An artifact pointer or expiring Actions artifact is insufficient.
3. Connect independent CLI/CI/Workers Builds writers to the tested gate and reconcile already queued external work. No universal stop coverage is yet claimed.
4. Add guarded post-release health/recovery automation with one bounded recovery attempt. Prove normal release, failed health, uncertain write, actual rollback, hold and process exit in the representative runtime. No background monitoring/execution is invented.
5. Enable other projects' recovery only after identity, compatibility, retained bytes and critical-health checks are proven.
6. Verify GW's owner-integrated browser gate and complete remaining heavy-pipeline reductions; Accented is already merged and verified. Preserve remaining original executor, Night Shift, skills, feedback recipient acknowledgement, native-client acceptance and Files-last work.

Workspace: `/Users/lrnolivia/.codex/worktrees/relay-finish/relay`. Local `qa-evidence/` contains downloaded receipts, inventory and restoration checks. Durable published proof is GitHub source/PR history and cited canonical runs; local copies are not separately durable backups. Canonical repositories remain preserved.
