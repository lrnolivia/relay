# Canonical documentation routing and cleanup inventory

The authoritative operating contract is [lrnolivia/relay@main/LOEW_CHAT_BIBLE.md](https://github.com/lrnolivia/relay/blob/main/LOEW_CHAT_BIBLE.md), selected by `contracts/manifest.json`. Inspection began at main`f28ae62fb11daf4a3f99cd7ed10fd22f4738c025`; the Bible's content last changed in deployed commit`6138926ddfcd63e696b0ff20c12bcd51a6f61de1`, blob`427ffe55fcc804f9afa62c98c0f7a1bf6d2a301d`. Its displayed October14 version lagged that October20 content change. This change aligns the Bible/manifest display version to2026-10-20.2. Git commit/blob readback remains the currentness proof.

The existing verified operational home is **`lrnolivia/relay`, branch`main`, `docs/<project-id>/`**. Relay's own records use `docs/relay/`; Field's internal records use `docs/field/` in Relay. This is not a new service or an instruction to put operational logs back in another product repository. Task-only scratch logs/intermediate audits belong in the allocated task artifact directory outside source. Prescribed CI/build outputs may remain ephemeral in their required paths for artifact upload; they are not automatically committed documentation.

Product/user/contributor docs, public changelogs, architecture and build-required runbooks remain legitimate product-repository material. Relay also keeps universal contracts, schemas and skill sources as its control-plane product inputs. Prefer canonical links; required mirrors retain provenance and never become an alternate operating contract. The retired `LOEW_CHAT_BIBLE_CURRENT.md` remains a tombstone because live/historical references still exist.

## Actual Relay cleanup

The following useful operational records were preserved under Relay's canonical internal archive. Their original paths now contain one-line canonical/historical pointers, and moved relative links are rebased. No original prose was destroyed, and immutable import manifests/history remain intact.

| Previous location | Canonical preserved location | Reason |
|---|---|---|
| `docs/STATE.md` | `docs/relay/archive/pre-consolidation-state.md` | September30 pre-consolidation status; its “current state” title could be mistaken for live truth. |
| `docs/RUNNER_IMPORT_PROVENANCE.md` | `docs/relay/archive/runner-import-provenance.md` | Completed import receipt and one-time merge exception, not ongoing release policy. |
| `docs/CONTROL_STATE_MIGRATION.md` | `docs/relay/archive/control-state-migration.md` | Historical control migration instructions and source identities. |
| `docs/CONSOLIDATION_PROGRAM.md` | `docs/relay/archive/consolidation-program.md` | Internal one-product consolidation plan and operational history. |

`docs/ARCHITECTURE.md`, `docs/MONOREPO_LAYOUT.md`, `docs/ACCESS_CONTROL.md`, `docs/HUMAN_QA_HELPER.md`, `docs/VISUAL_EVIDENCE_POLICY.md` and `docs/WORK_COORDINATION.md` remain product architecture/runbooks/contract inputs. Their placement is not maintenance clutter. The active bootstrap, Bible/manifest, Night Shift contract/authoring/blocker/promotion guidance, planning/recovery/communication skill sources, engineering/documentation/regression packs and generated executor context are reconciled to canonical rules. The old blanket prohibition on growing an existing assignment is replaced with the original-goal/additive-admission rule. Historical archives and immutable source-import records are labelled historical rather than rewritten as current policy.

## Representative Field inventory — read-only

The registered repository is `lrnolivia/field`. Its complete tree at`709ab685539ff6a751099d7d6458ac1b5cc42473` was inventoried by filename/size/blob without reading Claude chats or changing its checkout, assignments or source.

| Candidate/group | Classification and handling |
|---|---|
| `README.md`, `CONTRIBUTING.md` | Legitimate user/contributor documentation; preserve. |
| `docs/FIGMA_BEHAVIOR_PARITY.md`, `docs/PRODUCT_LANGUAGE.md`, `docs/readme/*` | Product behavior/design language and user-facing assets; preserve. |
| `.field/handoff-kit/CONTRACT.md`, `CHAT_BOOTSTRAP.md`, `ASSIGNMENT_AUTHORING.md`, `CURRENT_WORKER_SELF_REGISTRATION.md`, `templates/*.md` | Likely operational-guidance overlap; names indicate internal worker/assignment rules, but this is an installer-backed kit with manifest, tests and executable consumers. Do not delete or move individual files while Claude owns Field. Reconcile the kit as a unit through its owner if later authorized. |
| `.field/handoff-kit/installer/INSTALLER_CONTRACT.md`, `bin/field-handoff`, `tests/*`, `qa/*` | Tooling/runtime/QA consumers establish a migration dependency; preserve together until an evidenced unit migration. |
| Relay root `docs/FIELD_REPOSITORY_REORGANIZATION.md`, `docs/FIELD_NIGHT_SHIFT_MIGRATION.md`, `docs/FIELD_GUIDANCE_CLEANUP_MANIFEST.md` | Likely older operational routing candidates; some are referenced by a registered Field cleanup assignment or immutable import provenance. They were inventoried, not rewritten or used to restart that assignment. Current authority is the canonical Bible; a coordinated Field-interface migration is separate from this source change. |

No claim is made that every repository or external Project source is now purged. Larger cleanup involving another active owner, an installed kit, an immutable provenance record or an unavailable external source remains an explicit inventory item. New Relay-generated execution context supplies the fully qualified destination so Codex and Claude do not infer “this product's docs/” from the word Runner.
