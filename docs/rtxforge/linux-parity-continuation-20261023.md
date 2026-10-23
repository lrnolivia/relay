# Linux parity continuation — 23 October 2026

Source: 903184acef5d43ab5dc8a3463ced4bf00f5c1851
PR: https://github.com/lrnolivia/rtxForge/pull/63

The owner requested Windows completion now and Linux work later. Prepared Linux source is pushed with the shared engine. Final Linux acceptance remains pending.

Implemented: native Game Mode icons; responsive header density; seamless main backdrop; full-width lone Game Details cards; thin rounded idle artwork edges; matching overlay package review flow, per-game preferences and graphics API labels; approved NR model bundle and optional local override; bounded BG3/RDR2 Vulkan routing. Existing motion and reduced-motion behavior remain.

Last evidence: 33 native GTK tests passed in Fedora 44/GTK 4.22/libadwaita 1.9 before the final API-label/shared-route edits. Visual source 7bf5c8e was captured at 3840×2160, GDK_SCALE=2, Game Mode 130%; full-width Details and backdrop pixels passed. Screenshots remain in linux-parity/screenshots. Software-rendered Xvfb results do not establish physical GPU or Gamescope performance.

Resume: validate this exact source in hosted Fedora GTK; exercise global/per-game overlay forms and inherited preferences; capture 1080p and 4K/130%; build and inspect the exact-source AppImage with the runtime bundle. Per-game Game Mode still lacks its own panel-shortcut editor; Desktop has one. Qualify Proton prefix failure/recovery and review binding before promoting Linux runtime. Preserve the Wine generator/channel pair from 3d0628b. Linux GPU, controller, Gamescope and live gameplay remain untested.

Disposable environment: C:/Users/lrnol/rtxForge-previews/motion/linux-vm/build.qcow2; guest /home/fedora/linux-parity; SSH 127.0.0.1:22228 with build_key/known_hosts alongside the disk. QEMU is off. Two PC restarts were reported; Windows logged bugcheck 0x139, cause undetermined. No further diagnosis requested. Use hosted builds or real Bazzite later. No actual game files changed.

Runtime component: vulkan-runtime-1.0.0-rc.1 release, outer bundle SHA-256 663bd10a35bdd31130a6d2b6a594a76e7c5e98ab4481f5c4606c239027047902, candidate source 13e5de743440fd3ee6e903ef8b88493764363c4b. Experimental, not hardware-qualified.

Current disposition: Linux is explicitly deferred to the next worker by the owner. The prepared files are committed on PR #63, with no dirty source remaining. Source 903184a also preserves legacy engine-review compatibility; 19 focused review/overlay/route fixtures passed locally. Hosted Fedora engine checks passed on this revision and native UI captures are running. Windows local self-contained publish/installer built; approved existing bridge/Feeder binaries were reused without modifying native source. Final Windows install in progress. Do not require the next Linux worker to rebuild through the local VM.
