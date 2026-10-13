# RTXForge 0.3.1

> Historical release notes. RTXForge 0.4.2 supersedes the MFG route described below with native Streamline DLSS-G as the default and Enabler as a compatibility fallback.

Extract and run **RUN RTXFORGE GUI**.

- Full-resolution tall posters and wide capsules retain their proportions. Wide view never substitutes a tall poster. Artwork cache refreshes once for the corrected sources.
- NVIDIA-style green accents return; each game's selection, hover, checkbox and details button use an accent sampled from its artwork.
- Steam compatibility tools, runtimes and recognized utility apps are excluded before game inspection.
- Installer composition now separates NR components from the shared MFG payload. MFG Only excludes both NR DLLs and the private NR Streamline plugin; previously managed NR files are removed transactionally when switching to MFG Only.
- NR + MFG retains startup activation and now verifies the model against a pinned SHA256 independently of mutable cache metadata. MFG defaults remain NvNGX → Artur headless → DLSS-G. Existing tuning stays intact.
- Install/update/repair still modify explicitly selected games, with backups and rollback. Changing providers or deployment methods recommends a full uninstall/reinstall.

`baselines/mfg-v1.json` records the current shared payload hashes and provider commit. `baselines/standalone-diff.json` records the file comparison with the cached pinned DLSS-Unlocked standalone archive. These are static evidence, not runtime proof. The standalone package differs in core and several private dependencies; wholesale replacement would change MFG too. No speculative replacement or Windows-only NR gate is enabled in this release. Reliable Proton NR remains outstanding.

Verification: Python compilation, whitespace checks and a native demo smoke run. No live game deployment or runtime test was performed.
