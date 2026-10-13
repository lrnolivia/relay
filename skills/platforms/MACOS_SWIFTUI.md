---
name: relay-platforms-macos-swiftui
description: Design and verify macOS SwiftUI workspaces with windows, commands, menus, inspectors, focus and persisted desktop state.
---

# macOS / SwiftUI craft

Design for macOS as a desktop workspace, not an enlarged mobile screen.

Prefer native window/toolbars, commands, focus, keyboard shortcuts, menus, sheets, inspectors, sidebars, split views, drag/drop, and system materials when they support the product's hierarchy.

Use SwiftUI structure and platform conventions without flattening brand identity. Respect accessibility, reduced motion/transparency, light/dark appearance, and pointer/keyboard-first workflows.

Avoid iOS-style oversized controls and excessive card nesting. Dense professional layouts may still feel calm when hierarchy is strong.

## Workflow inputs and actions

Read deployment target, SwiftUI/AppKit boundaries, scene/window model, commands and persisted document/selection state. Identify the primary desktop task and approved visual system. Choose sidebar/split-view/inspector roles around that task, retaining native menu and keyboard access to shared commands.

Implement selection, loading/error, undo/cancel and focus behavior explicitly. Check resizing and minimum useful window size, multiple windows when supported, reopen/restoration and unsaved-change flows. Verify light/dark, increased text, VoiceOver, reduced motion/transparency and pointer/keyboard use on the deployment target.

Deliver the component/scene changes or native handoff, commands and state matrix, and build/runtime evidence. A web preview cannot verify macOS window/VoiceOver behavior. If native execution is unavailable, mark those checks open with reproduction steps. Resolve unsupported SwiftUI APIs through existing compatible patterns or an explicit deployment-target decision; do not quietly substitute mobile navigation or raise the OS requirement.
