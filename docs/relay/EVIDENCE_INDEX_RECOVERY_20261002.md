# Inspector evidence-index recovery

## Reproduced production blocker
PR118's exact-head quality and admission passed at 0b843e3289f2db3946d56706e968fab099d747d1. Visual capture run36978489055 successfully ingested vis_fb3a86b0-7c1e-4026-a75e-36983623d3c8, then both QA and image lookup returned404. Production source capped all visual-key enumeration at1000 objects before resolving an ID; each capture contributes PNG plus JSON, so successful newer captures could disappear from reads.

The first website branch is preserved, not shipped. It was superseded through the supported coordination transaction, with every requirement copied to relay-website-catchup-release-20261002. This bounded backend repair must ship before live capture readback can pass. The successor will use a NEW main-based branch and transplant the exact preserved PR118 product diff. No branch/PR or screenshot deletion, force push, protection bypass or new credential is involved.

## Repair
New captures retain original files and add direct-ID and reverse-time metadata indexes. Exact historical IDs paginate keys, stopping only on match or a complete catalog; a20-page safety budget reports an explicit503 rather than false absence. Indexed exact reads avoid enumeration.

Recent lists combine the newest200 indexed records with a bounded650-record legacy window, with20-at-a-time reads and explicit partial coverage. Legacy key enumeration is bounded at20000 objects; larger catalogs return an explicit capacity error. Existing run comparisons paginate keys and remain bounded at850 capture metadata records; they fail explicitly beyond that budget rather than silently compare an incomplete prefix. Long-term historical backfill/pagination is still a separate scalability enhancement; no full-history completeness is claimed.

## Verification
Sixteen focused index/legacy/visual tests passed locally, covering >1000 objects, date boundaries, corrupt/missing index records, invalid IDs/cursors, bounded reads and unchanged original data. Full CI and exact production recovery remain pending before completion.

## Rollback
Revert product changes through a new admitted PR or deploy the prior known-good Worker version. Original visual objects are unchanged; leave additive indexes in place. No automatic purge is added. Existing screenshot30-day metadata is unchanged; retained interactive build lifecycle is a separate next batch.
