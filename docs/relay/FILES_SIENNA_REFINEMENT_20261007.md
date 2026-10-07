# Relay Files and Sienna refinement

The user requested that Files move into Relay's main body, reuse CTRL's new shared file manager, and use Sienna as Relay's primary accent. This is a focused website slice of the existing `relay-mcp-rebuild-continuation-20261003` assignment; it does not replace its full acceptance or close the quota investigation.

The Files launcher now has a visible label alongside the connection actions inside the main panel. The home page primary action, hover and focus use Relay's existing `--feature-relay` token (`#b5471f`), as defined in `RELAY_FEATURE_SHELL_UI.md`. Semantic status and other feature colors retain their meanings.

`file-manager.js`, `file-manager.css` and the shared `work-controls.js`/`work-controls.css` were read from committed CTRL source `2fc343285f41894096e0c488b6181bee61025979`. Relay retains the same upload/resume/download protocol and signed-in account isolation. Its existing glyph family and narrowly scoped styles adapt the shared manager to Relay. Search, readiness/type filters, sorting, a grouped controls platter, keyboard radio navigation and focus restoration are reused. No CTRL working files were changed.

## Verification and limits

- Node 22.23.3, npm 10.9.9, Playwright 1.60.0; existing lockfile SHA-256 `302f01f74eef065ae1bea00a1fe6d0922b8cc60fe181e36ecd1c1e7ae24aa034`.
- Typecheck passed. Focused browser/query tests passed on the implementation: combined filters and sort preserve inventory; an interrupted 4 MiB upload resumed and downloaded with an identical SHA-256; search, readiness/type filters and arrow-key choices worked; close/Escape restored focus; action contrast passed in light/dark; page and open filters fit 320/390/768/1440 widths.
- Desktop/mobile and light/dark rendered fixture screenshots were inspected. Fixture storage and identity are synthetic, not live authenticated persistence. Hosted exact-candidate quality/admission and production verification remain publication gates.
- The one mechanical design scan reported only existing Inter font declarations. The established Inter/Momo typography is intentionally preserved within this refinement.

## Source and rollback

Base and verified production release: PR #168, `e709fc1127d750804c9c865342c96d5bbd9c86f3`. Hosted run `37581167172` passed quality and authenticated production on that exact source; captured production telemetry explicitly displayed partial records rather than complete counts. Worker build `4ced0e2c-c538-4a9c-a526-4724ec2e7a92` succeeded; deployment `16497f33-9b45-4620-aa4a-926052a214d5`, version `c9d2212b-960a-47b8-8d2a-1e4dac80b3d9`, had 100% traffic.

For this UI slice, restore that Worker version through the existing Cloudflare release operation if verification identifies a regression. Preserve its source, required runtime bindings and current data; a UI rollback does not remove uploaded files. A revert of the UI commit through the normal protected workflow restores the source for subsequent builds. The prior fully verified rollback `e8076bb7fbcb6d979ffee065b19fdecc5aa5a3c2` remains an older recovery reference.

The confirmed `/api/work-review` 403 was GitHub installation `166454233` quota exhaustion. CTRL's same 22-assignment read returned 200 after reset and handled null review records. The separate reported 404 is unreproduced; missing initial records are not an established cause. Review-store independence, affected-project refresh/backoff and measurement of all active quota callers remain separate work. This UI slice does not claim those repairs.

Local logs, generated screenshots and exact-candidate gate receipts remain under `qa-evidence/local-github-workflow/`; immutable hosted artifacts and independently restored Git source establish durable publication evidence. Refresh canonical ownership and admission before integration and record the resulting exact candidate there.

## Connection action grouping follow-up

Lauren's attached screenshot showed the connection check, an unlabelled refresh icon, AI setup and Files as four similarly weighted controls. The requested refinement keeps the primary connection check and a visibly labelled Refresh tools together, then separates the quieter AI setup and Files utility row with16px spacing and a subtle divider. At320px the service actions stack while setup/Files remain a compact utility row. DOM and keyboard order follow that reading order; the two groups have accessible names. Files remains inside the main body, with the existing upload manager and Sienna icon.

The focused home browser checks pass with the two named action groups and all original connection/refresh/setup behavior. Populated renders at1440/390/320 were inspected together and showed no overflow; the existing320/768/1024/1440 geometry assertions pass. The layout detector reported no findings before the edit. This slice uses the established typography, palette, targets and motion; it does not redesign the page. Exact source build/runtime, hosted gates and production verification remain publication requirements.

Base source is PR170 merge `74f373ea67709f35fb485ee51d17800aad111c94`, whose quality passed and production verification was still running when this follow-up was prepared. PR169 merge `b944efa8c4a7ae015caa7c419d2a6f58ef892ab8` / Worker version `e1f64aec-cc38-4191-be47-5b2241049997` remains the preceding fully verified fallback until the newer production check passes. Use the normal protected revert or verified Worker restoration; do not remove uploaded data.

CTRL remote main `9e1a99ae6437cabbd6f2ec619d06baac3dce8c07` was checked at06:45UTC and already contains the pinned shared Files color/UI commit `2fc343285f41894096e0c488b6181bee61025979`. Those four shared modules had no further delta. At the next Files sync, inspect newer committed main changes and import applicable UI/color tweaks while preserving Relay's Sienna adaptation, authorization and upload protocol. Do not edit the active CTRL checkout or imply continuous monitoring.
