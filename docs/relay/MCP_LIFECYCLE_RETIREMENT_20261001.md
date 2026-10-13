# Relay MCP rebuild: lifecycle prerequisite evidence

## Identity and boundary

- Persistent lead/owner: `01a0f914-aad0-71e4-8f0c-20c1bf0a2016`; staff Ellis.
- Canonical assignment: `relay-mcp-rebuild-20261001`.
- Branch: `relay/mcp-lifecycle-retirement-20261001`.
- Admitted baseline: `80abcd05325155ec42e0c7582bb82b1001e3634a`.
- Admission record: `d5ba1f3c4e29ee0c757f6d59339371616460cb15`; control commit `ff6a6071557592fd91e5c6c2c99af985e6aaec9c`.
- Preflight passed before implementation at 2026-10-01 20:24 UTC for all 19 admitted paths and four resources. Heartbeat verified at 20:34 UTC, record `91e4d25d3829f4ac352201a444f1a3a7b9bdcfee`. Publication preflight passed again at 20:38 UTC with that record; unrelated historical inventory findings do not block this assignment.
- Separate clone; the active Julian website checkout and its edits were not touched. No probe/card/auth/release-configuration source changed. Build generated only ignored local test inputs.
- Astra High was requested in delegation; actual model/effort is not independently exposed by this executor.

This draft implements only the lifecycle prerequisite. No merge, production deployment, live cancellation/supersession, old PR closure, or branch deletion is authorized or performed. PR92 and PR96 are historical evidence; neither branch nor code was adopted. The 51-capability MCP program and the clean real-host proof remain future bounded stages under this same lead.

## Why this batch exists

The existing coordination engine reserves every claim except `completed`, including held and expired work. Completion requires a real merged PR and durable work accounting. Marking abandoned experiments completed would falsely claim delivery; simply dropping them would erase ownership/history. This batch adds explicit retirement without either behavior.

The transaction preserves original work and intent, requires current owner and record/head evidence, stores a stable operation receipt, and releases only reservations. Supersession requires a distinct extant nonterminal successor. A lost response can be reconciled with refreshed CAS and the same operation id without writing again. There is no restore operation. Branch-head reads and record CAS are not one atomic GitHub transaction: writers must be quiescent and unpublished work accounted for by the caller.

MCP, CLI and workflow retirement share one validator/adapter. The progress queue view still lists only pending queued work; retired queue-only records remain visible through assignments and terminal resume checkpoints. Retired claims have explicit terminal observed-progress states. Canonical source, runtime mirror and Git blob pin are synchronized. The existing sync helper pointed to the wrong adapter file after the core split; it now targets the actual core pin and supports explicit local-candidate synchronization. Completion proof and cleanup eligibility are unchanged. Retired branches cannot be automatically deleted or reused.

## Validation

- `npm ci`: passed; 84 packages, zero reported vulnerabilities.
- `npm run build`: passed, including workspace syntax checks.
- Targeted lifecycle/transport/status/cleanup suite: 71 passed, zero failures.
- Full `npm test`: passed all 300 tests (213 Inspector/source/browser, 54 Runner, 3 layout, 17 contracts, 13 web); zero failures or skips.
- `npm run typecheck:2.0 --workspace @relay/web`: passed.
- Local runtime: Node 26.8.1; CI uses Node 22 and remains a separate required check.
- Test-generated web screenshots were moved out of the implementation checkout into task evidence; no website files are included in the diff.
- Additional resume-route integration: passed (11 resume tests total), confirming retired queue-only visibility and no duplicate claim/queue mirror checkpoint. Added after the full 300-test run.
- Mocked CLI subprocess tests execute the real validator and adapter, proving stale CAS/head rejection, permission-vs-absence handling, engine drift rejection, one write on uncertainty, exact readback reconciliation, and zero-write replay. They do not call production.
- Engine provenance regression checks canonical source bytes equal the mirror and the Git blob SHA equals the runtime pin.
- Cleanup tests assert both retired dispositions are retained even when completion-like evidence is present. Existing merged-completion tests remain intact.

Full regression attempts exposed a changed completion error message and a shortened tool-discovery dependency description; both implementations were repaired to preserve existing contracts. The sandbox also prevented local Chromium from launching (`bootstrap_check_in` permission denied). The suite was rerun with approved local test execution outside that sandbox; no expectations were weakened or skipped. These browser tests exercise existing local UI contracts, not real ChatGPT client support.

## Preserved research and next proof

The exact report `libfile_1aecf8ccbe1881918aa2f5b81a2681a8`, version1, was materialized consumer-locally and read completely: 122105 bytes, SHA-256 `b513cf397660d05116d2bcce0165ed998372ce3815b8f934caeb1e39dafe648b`. Historical report blockers were not treated as current authority.

Fresh bootstrap observed Relay 1.9.9 with 51 tools. The current bridge is handwritten; a standards-first resource URI/MIME and UI handshake remains a hypothesis to test, not an established root cause. A static card shell and script parse exist in source. A modal points at a v2 control-center resource while the current resource is v4; that is a navigation discrepancy, not evidence explaining a missing initial mount. Existing Inspector/Momo/feature-mark art and state meaning remain untouched.

No exact-build native client matrix has been proved in this batch:

| Client | Evidence | Remaining need |
| --- | --- | --- |
| ChatGPT desktop | Native app access was denied by computer-use safety control; no alternate control path attempted | Authorized actual-client access or a narrowly specified human check |
| ChatGPT web | Not exercised against a new registered probe build | Same app/tool/build control comparison |
| iPhone | Historical PR evidence only | Human device check of that same build |

Local Chromium/iframe/mobile-viewport tests cannot substitute for this matrix. App identity/install path, client versions and conversation modes still need exact capture. After this prerequisite is reviewed and separately released, request the next bounded claim scope for a clean, read-only visible card shell with unique resource/build identity; prove HTML, script, initialization, result delivery, dimensions and one read-only action separately, retaining text output. Any temporary host connection/deployment must first specify destination, auth/access and rollback to Julian. No paid backend, new credentials, DNS changes, endpoint replacement or manual production-upload workaround is authorized.


## First publication and canonical admission blocker

Draft PR [108](https://github.com/lrnolivia/relay/pull/108) initially published at `cc764a101ccbf93eebc3bb90deb4df08858603f3`. Its [canonical-main admission run](https://github.com/lrnolivia/relay/actions/runs/36923261816/job/110574246148) failed before policy evaluation with `spawnSync gh ENOBUFS`: the 769161-byte coordination record becomes more than the default 1 MiB child-process buffer once base64-encoded by GitHub Contents. This is transport capacity, not an owner conflict, browser capacity or permission error. The workflow deliberately checks out main, so a candidate-only repair cannot clear that check.

The admitted CLI now uses an explicit bounded 8 MiB response buffer. A real subprocess regression retires synthetic work while preserving an 820000-byte retained-history field whose encoded response exceeds 1 MiB. No live record is modified by that test. This repair stays within the declared transport files. The canonical check remains a release blocker until an independently authorized canonical fix is present; no workflow gate was weakened, no failing check rerun blindly, and no merge performed. Julian must coordinate that prerequisite and then rerun the existing exact-head admission check. The separate live MCP preflight has passed the same assignment/scope.

## Independent review repairs

At `7c631e4`, review exposed a missing two-claim cleanup case: an older completed receipt and a newer retired claim could reference the same reused branch. Both MCP and CLI cleanup considered only active reservations, so retirement could allow deletion through that older receipt. The defect was reproduced with the actual MCP adapter and a synthetic API for both retired dispositions at initial eligibility and at the pre-delete reread; no real branch was deleted.

Canonical rescope added `src/runner-cleanup.js` (20 paths total), record `a4b8c0f7af40a01fddf239ac1664b1804a7f1880`, receipt commit `7eff3767e9793f7dd404b66ec73a4f8502efb87b`. Fresh preflight passed at 20:57 UTC before that file was edited. The repair protects any retired branch reference independently of whether it reserves capacity, in both initial eligibility and the pre-delete record reread. A dedicated `retired_branch` retention reason explains MCP results. CLI cleanup applies matching protection. Completion and exact merged-head eligibility are unchanged.

Three new regression tests failed against the old implementation, then the complete cleanup/transport suite passed 18/18 after the repair. They exercise both cancelled and superseded states with two claims sharing one branch, including a retired claim visible only at the final record reread. Full exact-head CI is recorded on the PR.

A separate cutover risk was also reproduced: the pre-lifecycle canonical engine accepts a fresh heartbeat for either retired state and changes it to active; the candidate engine rejects both. Old standalone CLI/workflow writers do not use the runtime adapter's engine-drift check. See the new first-retirement checklist in `docs/WORK_COORDINATION.md`: all such writers, including already-running jobs, must be quiesced, upgraded and verified before live retirement. Neither this code repair nor MCP deployment alone establishes that operational prerequisite.
