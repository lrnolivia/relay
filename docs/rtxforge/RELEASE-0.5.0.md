# RTXForge 0.5.0 — provider integration preview

The desktop and terminal now share the RC1.38-derived transaction engine, with a choice of separately pinned y4my Multipass v4 or DLSS-Unlocked NR-v0.8.6 packages. This is a prerelease pending game validation.

- Corrected the dormant startup policy: `nofg` input/output prevents selecting OptiScaler's private DLSS-G output while leaving native game FG available. A Settings switch explicitly activates Ada MFG and selected NR before launch.
- Both MFG Only and NR + MFG use the selected provider consistently. Stock upstream NR panels may remain visible in MFG Only.
- New payloads refuse replacing root native DLSS/Streamline files. Uninstall refuses removing native files without recorded original backups.
- Provider/version controls, notes, test status, manual test records, bounded log capture and local support ZIPs are integrated. Bench skips bulk install/repair.
- Persistent AppImage installation and the simple F icon are retained. Application updates do not deploy games automatically.

Validation: imported engine tests passed (276 tests plus 10 subtests), followed by four targeted new startup/restore/provider-model regressions. Native GTK and packaged AppImage smoke passed; packaged CLI help passed. Exact upstream archives were downloaded and hash-verified. Actual pinned payload install/restore fixtures passed for y4my MFG Only and both DLSS-Unlocked profiles, preserving native DLL bytes.

No installed game was changed or launched. The reported native 2× loss across games remains unresolved; this build does not claim to restore it. The startup correction has source evidence but still requires game validation. Close Steam before applying. Uninstall/reinstall when switching providers. y4my NR requires a suitable local model; DLSS-Unlocked carries its model. Arbitrary repositories, independent provider updates and automatic test monitoring remain future work.
