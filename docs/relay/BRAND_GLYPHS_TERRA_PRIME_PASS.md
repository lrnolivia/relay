# Relay shared interface: Terra Prime and official identity

Assignment and owner: `relay-1.7-tool-identity-20260930`. The earlier `relay-brand-glyphs-20260930` identity direction is superseded; its useful uncommitted work was transferred into this admitted release branch.

## Selected design and provenance

User selected the Terra Prime sidebar direction refined with GPT-5.6 Sol, then requested straight sidebar edges, unframed app icons, soft shadows and the five-color top accent strip. No illustrations.

Figma authority: file `6hjtD0UcLwU44DPDDrAKht`; foundations `4:4`, app dark `24:59`, app light `24:200`, decision `9:58`, resolution `9:67`, floating review instrument `9:93`.

Superdesign canvas: https://superdesign.dev/teams/72c67edc-160b-4899-8c4a-43e63b517d0e/projects/53fb12b3-0280-476b-903c-0b3f5460f4e7
Selected draft: `dace79c8-f692-497c-bebb-71bc186b7381`, version 4. Versions 1–2 establish the baseline/direction; version 3 is GPT-5.6 refinement; version 4 applies deterministic requested finishing changes without further generation credits. Local tooling context/resume remains under ignored `.superdesign/`; this durable record preserves remote identities.

Official PNGs copied byte-for-byte from user-provided assets into `apps/web/public/brand/`:

| Asset | SHA-256 |
| --- | --- |
| relay-loop.png | fd0390dfa527f2e40a411f99fb1018a247cd6b386025c38d3051b602d3408e6d |
| inspector-views.png | 68ffbe9da191e9c9de1d6e4e02e80f346f4032b2155b21b57d601b8a6c41d2cb |
| runner-dispatch-final.png | 608720072f92f1f024acda4c0090a5f242905995093a9c3311d81e0dcebb79c7 |

Relay is the parent product and favicon. Runner and Inspector are visibly named tools with their official marks in navigation, headers and the review instrument. No extra backgrounds frame brand/project icons. Shared glyphs use original heavy rounded 24px geometry with Field-inspired hover/press motion and reduced-motion support. Soft shadows provide depth.

## Shared implementation and boundaries

The existing vanilla web/MCP bundle remains one implementation. Desktop uses a 340px sidebar, which narrows and becomes horizontal navigation as the actual viewport contracts. Capsule badges use 9px signals. Neutral warm Figma surfaces and teal Orient/sienna Act/amber Resolve are semantic phases. QA preserves exact capture identity and the existing evidence store. A Resolve receipt appears only after the backend records a verdict; edits return to Act and concurrent autosaves cannot replace newer local answers/notes with older responses.

Projects discover icons through `/api/projects/<registered-id>/icon`. The existing authenticated GitHub connection reads the registered repository tree, app favicon/manifest declaration, then bounded repository-brand candidates. Responses carry repository/path/blob SHA and image bytes as a data URL for the sandboxed MCP app. Cache is bounded and credential-scoped; external icon URLs, oversized/unsafe SVGs and incomplete trees cannot introduce arbitrary network fetches. Missing assets produce a neutral nonbrand glyph. This does not create duplicate logos or persist new coordination state.

Binary assets and the generated shared bundle exceed native Relay file-write limits, so the authorized local Git checkout is used for the source commit/push. Relay retains claim/admission, draft/ready/merge and runtime upload/deploy/readback authority.

## Validation status at expedited handoff

Earlier checks on the pre-1.7 working state were historical only. The user explicitly requested immediate merge and handoff with no tests or verifications. No new test suite, browser QA, production smoke, deployment or runtime readback was performed for this final snapshot. The generated web/MCP asset was rebuilt to include the source changes; building is packaging, not a test result. Automatic repository checks remain controlled by GitHub and Relay merge policy.

See `docs/relay/RELAY_1_7_RELEASE.md` for the remaining work and exact handoff.
