# Dashboard product checkpoint — 2026-09-30

Canvas #135 is merged as 854038a3e84f41cd590a4ad18b24fcd4127e2fba and verified in production; see CANVAS_PROMOTION_RECEIPT_20260930.md.

Dashboard draft [#136](https://github.com/lrnolivia/field/pull/136) now publishes the preserved 19-path recovery on that main baseline. Current head: 9fd1357d54841e255efb0596b2be4162958fc879. Isolated worktree: /private/tmp/field-consolidation-dashboard-20260930. Original source branches and PRs remain retained.

## Product changes
- In-app permanent-delete confirmation with explicit Cancel default and disabled actions during deletion.
- Failed rename/delete stays open, displays the error inside the dialog, and can be retried. Rename preserves the entered value; delete removes the card only on successful API completion.
- Rename focuses/selects the name, trims submitted text, traps keyboard focus across enabled controls and blocks dismissal while saving.
- Delete traps focus while idle and busy. Modal closure restores connected previous focus.
- Project menus focus their first action, navigate with Up/Down/Home/End, dismiss on outside pointer/Escape and restore trigger focus before opening dialogs.
- Sidebar current-view/search semantics, collection/list/card semantics, counts, loading and empty-state announcements recovered.
- Immediate project creation, refresh and thumbnail behavior preserved. NewProjectWizard recovery remains dormant; Dashboard does not render the wizard.

## Validation and limits
- Full current Dashboard run: 57 passed / 1 failed out of 58. The sole failure is the unchanged main source-string visual-polish assertion about .field-project-placeholder-grid; no baseline assertion was weakened.
- Current interaction checks: 25 tests across four suites pass, including Dashboard-level failed-action/retry flows. Focused lint and diff checks pass.
- All three production builds passed on b84ce2d1d3d32978de3321d81857e7f44db58658 before the later bounded interaction changes. Do not present that build as current-head proof.
- Registry 36702480952 was dispatched for b84ce2d and remains older-head evidence, even if it passes.
- Authenticated persistence and exact deployed Dashboard behavior are still unproven. Draft stays unmerged pending those gates.
- User explicitly directed product implementation over Wrangler/Preview troubleshooting. No DNS, Access, Preview policy or infrastructure changes were made for this Dashboard batch.

## Controls #83 review
Historical head e09f3940df94d141fcde3b85e53090333aa8a2f8 (field/options-panel-effects-v3) changes Fill, Filter, Shadow and a source-string test. Current main already has later EffectOptionsPanel/EffectOptionSection composition, split Layer blur/Adjustments sections, scalar controls, Shadow preview, and 300px effects launchers.
Its Fill change restores an OptionsPanel wrapper and kind: options launcher, conflicting with today's canonical PaintPickerShell. The historical test asserts exact older JSX/launcher strings; those assertions are not current product truth.
Disposition: do not transplant the four-file patch wholesale or close #83 from this review alone. Compare remaining Shadow behavior and provenance/write-target coverage against current implementation, then record a precise superseded/recovered decision. Runtime nested-picker QA remains separate.

## Next action
Keep #136 claim current and finish its publication gates in the background. Continue ordered Controls/Assets accounting without resurrecting old Inspector or Fill behavior. Preserve existing Mobile ownership and shared paths; connected panels remain deferred. No original branch deletion, PR retirement or new worker creation is authorized by an equivalence observation alone.
