---
name: relay-platforms-windows-winui
description: Design and verify WinUI desktop journeys with command navigation, scaling, high contrast, focus and window state.
---

# Windows / WinUI craft

Design for Windows with WinUI 3 conventions, keyboard/mouse fluency, scalable typography, system window behavior, and accessible controls.

Use NavigationView, command bars, teaching tips, dialogs, info bars, progress controls, and acrylic/mica only when they improve hierarchy and remain performant. Brand styling may override defaults while preserving expected input/focus behavior.

Do not imitate macOS chrome or web-app card stacks when a native Windows pattern is clearer.

Test scaling, high-contrast/accessibility, light/dark, keyboard navigation, and window resizing.

## Workflow inputs and actions

Read Windows App SDK/WinUI version, minimum OS, existing XAML/style resources, navigation and window/state owners. Define the keyboard/mouse journey and approved brand before selecting NavigationView, command bars or dialogs. Use native control semantics and version-compatible APIs.

Exercise resizing, maximize/restore, keyboard activation and focus return from dialogs. Test display/text scaling, high contrast, dark/light appearance and Narrator semantics. Treat Mica/acrylic availability as optional material enhancement; preserve readable opaque states when transparency is disabled or unsupported.

Deliver XAML/component changes or a handoff with navigation/state choices and tested OS/SDK/scaling settings. Verify on a Windows runtime; source/build checks do not establish window or Narrator behavior. If unavailable, report exact remaining native checks. On rendering/focus regressions isolate scaling and resource overrides before replacing native controls or upgrading SDKs. Preserve saved state and deployment requirements during recovery.
