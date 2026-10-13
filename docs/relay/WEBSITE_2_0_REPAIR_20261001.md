# Actual Relay website 2.0 repair

Assignment: `relay-website-2.0-repair-20261001`

The website root serves React, but the preserved `/inspector` document also retained legacy Today, Runner and Night Shift bodies. Its navigation selected those old bodies rather than leaving Inspector. This repair installs a website-only navigation bootstrap: Inspector remains at `/inspector#review`, while its other navigation items and historical hashes return to the React root. Review/evidence deep links remain intact. Direct `/today`, `/runner` and `/night-shift` paths redirect to the React hash routes.

The React summary deck now expands the approved Inspector mark/copy/insight family into compact workspace cards: two across on desktop, horizontal pan on narrow screens, canonical `/icons` artwork, Momo labels and metrics, existing semantic colors and reduced-motion behavior. The actual Inspector preview renderer is unchanged.

Acceptance checklist:
- Actual built website round trips Inspector → Today/Runner/Night Shift → Inspector at 1440px and 390px.
- Historical Inspector hashes return to React instead of displaying legacy content.
- Every React page uses canonical icon bytes, Momo navigation, four accessible summary cards, and no document overflow.
- Inspector review filters, dispositions, feedback and previews remain available.
- Website responses identify the exact generated artifact with `X-Relay-Web-Build`; Git-driven builds expose `X-Relay-Source-Sha`.
- No inline-card implementation, MCP resource identity, registration or lifecycle is changed.

Legacy component tests use an explicitly isolated test fixture; they do not certify obsolete website navigation. New website tests exercise the real generated root and Inspector documents. CI retains screenshots for all four website pages at both widths.

Local install, full build, TypeScript and website-entrypoint checks passed. Canonical CI run 36907282368 passed full Chromium coverage and retained all eight website screenshots. Visual review found long Night Shift status words splitting in the numeric metric styling and a literal newline escape above Inspector; both are corrected in the final source. Final CI must verify that source. Production closure requires the Git-native build receipt, exact source/build header readback and actual authenticated website captures; a Worker deployment receipt alone is insufficient.

Git-native release repair is owned by its separate lane and is preserved. No manual source upload or generated-file splitting is part of this repair.

Production run 36908575483 confirmed the exact PR #104 source/artifact but timed out waiting for the dashboard. Authenticated diagnostic run 36910052538 showed Node and browser project/worker APIs returning HTTP 200 while React remained connecting. Startup awaited comprehensive progress for every project, including completed historical claims; that fan-out also exhausted the GitHub installation request budget.

The follow-up publishes base data immediately, reads coordination first and requests only active/held assignment progress through the existing API. Reads have bounded timeouts, successful assignment results appear independently, failed refreshes retain previous work, and pending/unavailable coverage is explicit. Today and Runner suppress empty-history/all-clear claims until coverage is complete. Dashboard polling is once per minute instead of every eight seconds. History and explicit assignment APIs are preserved. Startup regression coverage verifies early publication, exclusion of completed claims and retention after provider failure.
