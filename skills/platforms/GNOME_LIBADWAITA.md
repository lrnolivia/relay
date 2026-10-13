---
name: relay-platforms-gnome-libadwaita
description: Design and verify GTK/libadwaita desktop flows with native adaptation, navigation, focus, appearance and accessibility.
---

# GNOME / GTK / libadwaita craft

Design for GNOME with clear header bars, adaptive layout, keyboard navigation, sensible preferences, and libadwaita patterns where they support the task.

Prefer native adaptive behavior over fixed desktop breakpoints. Preserve GNOME's directness and low-chrome feel while allowing strong product identity in content, iconography, typography, and semantic accents.

Avoid porting Windows/macOS/web chrome verbatim. Use AdwNavigationView, split views, banners/toasts, dialogs, status pages, and preferences patterns appropriately.

Test narrow adaptive layouts, dark/light appearance, keyboard/focus, and reduced motion.

## Workflow inputs and actions

Inspect installed GTK/libadwaita versions, application actions, UI templates, navigation model and existing style. Use APIs available to that version; do not migrate toolkit generations as incidental polish. Map wide and narrow navigation and the back path before choosing split-view/navigation components.

Implement meaningful empty/loading/error states with platform-appropriate status pages, banners or dialogs. Exercise keyboard shortcuts and focus traversal, narrow windows, restored selection, text scaling and appearance. Prefer application actions over custom click-only handlers when commands are shared across menus and shortcuts.

Deliver changed components/templates plus wide/narrow state evidence and the exact toolkit/environment used. Inspect AT semantics and keyboard operation in the real app. When a display/native runtime is unavailable, validate source/build and supply the remaining GNOME reproduction rather than claiming a native pass. If an API is missing, choose a supported adaptive pattern; return a required toolkit upgrade as a separate decision.
