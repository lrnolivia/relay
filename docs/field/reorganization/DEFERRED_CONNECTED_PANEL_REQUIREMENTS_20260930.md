# Deferred connected panel requirements

Status: instructions only — implementation deferred at the user's request on 2026-09-30. Do not begin or publish these fixes merely because this document exists. Resume only when the user resumes this work, then acquire/renew the appropriate Runner claim with the existing Mobile/Workspace owner. Preserve Mobile PR #123 and its task branch; do not create a competing worker or continuation branch.

## User direction

Phone portrait keeps the sheet/card presentation. Phone landscape uses the desktop-style floating left panels, fully connected to the chrome, with one coherent geometry. Landscape must not reuse portrait card surfaces, borders, close headers, or independent slide-in geometry.

The user additionally reported that the floating Inspector's chrome does not include the topmost content bar, and that Insert's third/detail panels are detached and have inconsistent heights.

## Required behavior

1. **Landscape left shell:** the rail and the expanded panel share one continuous floating surface and one top/bottom/height calculation. Opening Layers, Insert, Library, CMS, or other left panels must not produce a separately framed card attached to the rail. No extra portrait-only close/header row in landscape. Preserve the stationary project pill and established desktop Float presentation.
2. **Landscape Inspector:** use the desktop floating shell. Its visible background, border, radius and shadow include the full topmost bar (collaborators/avatar, zoom, appearance, Preview and Publish) together with Design/Prototype and Inspector content. Header, content and backdrop must use the same position, drag offset and resolved height; no header floating naked above a body card.
3. **Insert third/detail panels:** Elements, Integrations, Icons, Utility, CMS and Creative detail/search surfaces attach to the adjacent main panel. Align their top and bottom edges and inherit the host's actual available height. Do not subtract or add a fixed 44px portrait/header offset when the landscape/desktop host does not have that row. Recompute bounds after opening, resizing, changing categories, rotating, and browser viewport changes, including touch-only interactions without mouse movement. Keep long content scrollable inside the available height and keep all panels inside the visible viewport.
4. **Portrait preservation:** portrait still uses the intended sheet/card layout, close affordances, safe-area and keyboard behavior. Rotating between portrait and landscape rebuilds presentation cleanly without persisting an override into the user's desktop preference. Preserve canonical panel content, touch interactions, selection, source and undo behavior.

## Findings to verify before implementation

- Screenshot `IMG_0055.PNG` identifies the existing Mobile Preview: `https://4e5857c1.field-preview.loew.fi`. Runner's Mobile report ties that Preview to PR #123 at `0a4c2cef6ce9a76dcc9011466956266bd00feb73`. Refresh the live branch/artifact before resuming; do not call this the current production build.
- Mobile's `ChromeIslands.tsx` suppresses the full right island and expanded left backdrop for every non-regular mobile presentation, including landscape. `FloatingLeftPanelHost.tsx` and `App.tsx` apply independently framed mobile panels to landscape. That conflicts with the clarified landscape requirement.
- Current-main `ChromeIslands.tsx` reads the raw stored `rightFloatingHeight` for the detached backdrop, while `App.tsx` resolves automatic height through `resolveRightFloatingHeight`. The stored automatic sentinel is `-1`; inspect this mismatch as a candidate cause for the uncovered top bar. Share the existing resolver, rather than adding a competing height rule.
- Insert's detail host currently uses `floatingInsertRect.top + 44` and `floatingInsertRect.height - 44`; its bounds refresh on pointer movement/window resize. Verify actual host/header geometry and touch/rotation/size observation before replacing those rules.
- These are source findings and user evidence, not final runtime proof. Brief local experiments were withdrawn when the user deferred implementation. They were not committed, pushed or deployed, and must not be treated as approved fixes or passing Mobile QA.

## Ownership and future verification

Mobile presentation changes belong to the existing Mobile owner. General Float/Insert geometry belongs to Workspace; shared shell paths require explicit serial ownership or handoff under Runner's live coordination rules. Keep the reported native camera failure separate from panel geometry, and preserve Runner/Inspector infrastructure ownership.

Before promotion, test the exact candidate in touch-enabled Chromium at phone landscape dimensions: rail and content continuity; every left-panel host; Insert detail/category/search alignment; expanded and collapsed Inspector including its top bar; viewport resize and portrait → landscape → portrait rotation. Also verify desktop Float and portrait sheet non-regression. Preserve actual touch input for touch-specific acceptance and record the exact artifact/SHA. Physical iOS Safari safe-area, browser chrome and keyboard behavior remains a separate gate.

Do not mark these requirements fixed merely because a build, geometry unit test or screenshot passes. Verify the connected surfaces and transitions against the user's stated behavior; do not weaken assertions or alter input mode to hide a failure.
