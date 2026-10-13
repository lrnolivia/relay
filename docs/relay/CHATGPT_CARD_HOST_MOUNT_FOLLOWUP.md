# ChatGPT card host-mount follow-up

Status: active investigation

## Observed facts

- Relay 1.9.9 Worker v72 is deployed from merge `197f43801ac2298efa3a99aebc3159240350cd34`.
- A fresh ChatGPT tool refresh exposed the v6 `relay_render_context_card` schema, including `evidence_id` and `show_qa`.
- The renderer executed successfully against the canonical 1.9.9 assignment and production Inspector evidence, but the user saw no inline card.
- Relay's control-center UI has visibly mounted in ChatGPT before.

## Source-level difference

The working control center is registered natively in `src/index.js`: its resource is present in the core `resources/list`, served directly by core `resources/read`, its tool descriptor is present in the core `tools/list`, and core `tools/call` returns its result.

Before this follow-up, the context card was different. Its tool/resource were injected by `src/relay-entry.js` after delegating to the legacy/core MCP server, and the card tool call was intercepted by that wrapper before core dispatch.

That wrapper path is the only meaningful server-registration difference between the working and failing UI surfaces. The card's actual MCP Apps contract already matches current OpenAI guidance: `text/html;profile=mcp-app` resource, `_meta.ui.resourceUri` on the render tool, and a normal structured tool result.

OpenAI's current UI guide also recommends the decoupled pattern: data tools should remain data-first, and only the dedicated render tool should own `_meta.ui.resourceUri`. Relay previously attached the card template to several contextual data tools as well as the dedicated renderer.

References:
- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/plugins/reference

## Current experiment

1. Register `relay_render_context_card` and `ui://relay/context-card/v6.html` natively in `src/index.js`, alongside the working control-center registration path.
2. Let `src/relay-entry.js` preserve that native registration instead of injecting or intercepting the card.
3. Keep contextual human-readable result shaping for Runner/Source/Cloud/Verify tools, but stop giving those data tools UI-template metadata. The dedicated render tool is the sole owner of the card resource.
4. Preserve the existing v6 HTML/CSS/QA-media implementation unchanged. This experiment is registration/host integration only.
5. After exact-head tests and deployment, refresh ChatGPT tools and run one direct `relay_render_context_card` smoke.

## Decision rule

If the natively registered card mounts, the root cause was Relay's wrapper-injected MCP Apps registration path. If it still does not mount while the natively registered control center does, the remaining difference is in the ChatGPT invocation/host path rather than Relay's card registration contract. Do not respond to that outcome by redesigning the card.
