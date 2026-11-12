# rtxForge documentation ownership

Canonical non-product documentation for `lrnolivia/rtxForge`.

- `product/` mirrors source-authoritative product docs when a Runner mirror is useful. Repository copies remain authoritative for product truth.
- `handoffs/` is the canonical home for implementation handoffs, audits, continuation records, and execution history.
- `qa/` is the project-specific QA overlay under Runner Bible section 11 and section 18.
- planning, roadmaps, worker notes, research, and coordination records belong here rather than in the product repository.

The product repository may retain README/LICENSE/NOTICE, tooling-required files, source-authoritative product docs, and a thin `AGENTS.md` bootstrap.

- `../../WORK_COORDINATION.md` defines mandatory concurrent work admission and lifecycle under Bible section 20.
- `../../../coordination/rtxforge.json` holds current atomic claims and the task queue; `../../../projects/rtxforge.json` sets the project policy and active budget.
- Existing branches present at registration are frozen as legacy recovery provenance. New work must use Runner admission and the registered branch prefix.


## Merging rtxForge pull requests

Open pull requests through the verified maintainer account. Use **Create a merge commit** so the reviewed commits keep their original authors and any legitimate human coauthors. GitHub's squash merge attributes the new commit to the pull request opener, so squash merging is disabled for rtxForge.

Check that **Commit attribution** and the other review checks passed for the exact pull request head. From the verified maintainer account, merge that head with `gh pr merge <number> --repo lrnolivia/rtxForge --merge --match-head-commit <reviewed-head-sha>` or the equivalent GitHub API call with `merge_method: merge` and the reviewed head SHA. Check the returned merge SHA with `node scripts/project-attribution.mjs check-github lrnolivia/rtxForge <merge-sha>` from this repository, then verify the attribution check on main.
