# Stopped website-language candidate

The unshipped PR179 candidate `d41262431b904364fdbed0219994ff01bc40bc58` passed deterministic checks but exposed an obsolete Relay panel in its sample preview. Lauren rejected that surface. It was never merged or deployed.

The complete candidate remains in Git history. The exact pending retirement patch is preserved in `docs/relay/OBSOLETE_PANEL_RETIREMENT_20261007.md` at checkpoint `bfecb14f957256c07578d7bea9b1ebcefa84d96e`. It includes the valid neutral-query wording and the unfinished retirement work; no product retirement or new wording is claimed live here.

PR179 is temporarily isolated to a backend diagnostic repair so an unconfirmed coordination transaction can reveal existing allowlisted provider facts. All frontend product files and CI match the verified live PR178 baseline. The extra test at `apps/web/test/review-language.test.mjs` now covers only the backend diagnostic/presentation boundary. Full workspace wording belongs to canonical CTRL and requires its linked assignment against current source.
