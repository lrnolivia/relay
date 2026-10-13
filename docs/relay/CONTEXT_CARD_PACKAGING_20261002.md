# Context card packaging repair

Lauren requested direct Relay execution without workers on 2026-10-02.

## Reproduction
Regression commit 68e3bc7d6b10fca7729eaa19fd922140a4106e06, quality run 36949388134 job110658694136, fails in the actual embedded contextCardModel with ReferenceError: __name is not defined after esbuild keepNames bundling. Existing unbundled browser tests did not exercise this artifact. An unrelated action-probe teardown assertion also failed in this run; it remains separately tracked, not weakened.

## Bounded fix
The production v10 context resource receives stable literal model source instead of serializing a transformed server function. Server and embedded browser model parity is asserted for representative state/error/check/terminal/progress cases, and the bundled HTML executes in a browser. Card art, static shell, styling and host transport remain unchanged. The legacy bridge remains the original comparison control. The separate v2 historical probe still has its own reservation and is not changed here. No helper shim or injected bootstrap replacement is introduced for this repair.

## Verification boundaries
This proves a browser hydration defect, not why ordinary ChatGPT sometimes never mounts a frame. The direct dot widget delivery attempt at 00:59UTC returned widget unavailable. Mac Work original connection test previously passed; ordinary desktop/Safari failures and iOS action remain unresolved. PR110/112 diagnostic resources remain unchanged. All original capabilities and PR113 feedback remain intact.

Publication uses guarded source commits and draftPR114; no native client pass or deployed fix is claimed until verified.
