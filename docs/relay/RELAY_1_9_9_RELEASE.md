# Relay 1.9.9 — ChatGPT-native experience

Status: release candidate — final generated artifact refreshed and temporary rebuild helper removed

Relay 1.9.9 closes the 1.9 patch train around the three surfaces a human actually sees: compact in-chat cards, the opened Relay workspace, and Inspector QA.

## In-chat cards

- `relay_render_context_card` is the canonical compact MCP Apps renderer.
- Card resource identity is `ui://relay/context-card/v6.html`.
- The card reports intrinsic height to ChatGPT after initial paint and later data/media updates so a mounted iframe does not remain visually collapsed.
- Relay, Runner, Inspector, night shift, Source, Cloud, Release and Skills share the same compact card language while preserving feature identity and accent.
- Exact technical evidence remains subordinate to human-readable status.
- Existing Inspector screenshots can be reused inside the card by exact `evidence_id`, or the card can request the latest stored QA image for a project with `show_qa`.
- Screenshot reuse goes through the existing authenticated Inspector evidence API. It does not create a second capture or evidence store.
- Missing/unavailable images degrade to the normal text/status card.

## Inspector

- Inspector includes a visible **chat cards** preview studio for Relay, Runner, Inspector and night shift card families.
- The evidence review queue remains available below the preview studio.
- The floating QA instrument follows the approved compact single-column direction and keeps artifact-bound autosave/evidence identity.
- Inspector canvas navigation follows the Field-style interaction contract: fit-to-view, pan/zoom camera behavior, responsive reclamping, draggable/resizable floating QA, edge docking, reduced-motion handling and adaptive dock contrast.
- Live preview remains the preferred QA surface; captured video/image remain evidence fallbacks.

## Build and release

The current 1.9 web runtime still imports the committed `apps/web/generated.js` artifact. Relay SOURCE cannot transport that ~1 MB file in one MCP mutation, so the release branch used a temporary self-removing GitHub Actions helper to run the canonical `npm run build` and commit the exact generated output. The helper removes itself before merge; it is not part of the shipped runtime.

Relay 2.0 is separately queued to replace this mechanism with a Vite + React frontend whose build artifacts are ephemeral CI/deploy outputs rather than committed generated source.

## Release gates

Before 1.9.9 is completed:

1. exact-head Runner admission and repository tests are green;
2. the generated web/MCP artifact matches authored web sources;
3. the exact merged source is deployed to the Relay Worker;
4. Inspector is captured through Relay VERIFY for human visual review;
5. ChatGPT tools are refreshed and a final `relay_render_context_card` consumer smoke is run;
6. the consumer result is recorded exactly: visible populated card, or a bounded remaining ChatGPT host defect if the iframe still mounts without content.
