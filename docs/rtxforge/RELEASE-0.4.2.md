# RTXForge 0.4.2 — Proton runtime handoff

- Native Streamline DLSS-G replaces the legacy Enabler route. Enabler is excluded, including previously managed private fallback components during an update.
- RTXForge-MFG carries the startup NR-panel switch and generic 4X capability advertisement in both early and native Streamline state queries. Game multiplier requests are preserved.
- A separately hash-pinned NR layer sources its forwarder, root patched model, private NR runtime and NR plugin from DLSS-Unlocked v0.3.0. MFG files are not replaced with that archive's MFG defaults.
- Clean games no longer require adoption. Invalid derived package caches rebuild from verified pinned archives; dry runs remain read-only.
- The app icon is simplified to a flat green forge/flame symbol on charcoal, designed alongside the Papirus visual language.

RTXForge is Linux-only and ships as an AppImage. Building a PE DLL for Proton is an implementation detail, not a Windows application roadmap.

Static verification and compiled-artifact identity are recorded separately from runtime acceptance. In-game menus and NR behavior are not claimed verified until a controlled cold-start game check. The complete combined NR/MFG behavior is still experimental.
