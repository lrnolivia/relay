# ChatGPT inline card clean-room

Research date: 2026-10-01

## What ChatGPT supports

Inline MCP App UI is a normal ChatGPT conversation surface. The model-visible render tool links itself to a registered UI resource with `_meta.ui.resourceUri`. The resource is served as `text/html;profile=mcp-app`; ChatGPT mounts it in an iframe alongside the conversation and sends tool lifecycle data over the MCP Apps JSON-RPC bridge.

Current OpenAI references:
- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/plugins/build/app-quickstart
- https://developers.openai.com/plugins/concepts/ui-guidelines
- https://developers.openai.com/plugins/reference
- https://developers.openai.com/plugins/changelog
- https://developers.openai.com/plugins/deploy/troubleshooting

## Clean contract

1. `relay_render_context_card` remains the dedicated model-visible render tool.
2. Its `_meta.ui.resourceUri` points to one immutable card resource identity.
3. The card resource is `text/html;profile=mcp-app`.
4. The iframe always sends `ui/initialize`, then `ui/notifications/initialized`.
5. Tool input normally comes from `ui/notifications/tool-input`; on a ChatGPT remount Relay may also hydrate the already-persisted invocation from `window.openai.toolInput`.
6. Tool output normally comes from `ui/notifications/tool-result`; when ChatGPT remounts historical UI without replaying that notification, Relay may hydrate the persisted `window.openai.toolOutput` and subscribe to `openai:set_globals` as compatibility fallbacks.
7. Widget helper actions use standard `tools/call`.
8. `window.openai` is additive compatibility only: it never replaces the MCP Apps `ui/initialize` / `ui/notifications/initialized` handshake. ChatGPT-only helpers such as `requestModal` remain optional enhancements.
9. If a historical remount provides input but no output through either path, Relay performs one bounded read-only `relay_runner_progress` recovery call and renders current canonical state instead of leaving an empty iframe.
10. UI resource URIs are immutable cache identities. Any HTML, JS, or CSS change rotates both Relay card resource URIs before deployment.

## What was wrong with v6

The v6 widget treated the presence of `window.openai` as a reason to skip the standard `ui/initialize` handshake and instead depended on compatibility globals such as `window.openai.toolOutput` and `openai:set_globals`. OpenAI's current guidance is standards-first, so v7 correctly made the MCP Apps bridge primary. However, OpenAI issue #195 documents a separate remount failure: ChatGPT can recreate a historical MCP App iframe without replaying `ui/notifications/tool-result`, while the compatibility globals still retain the historical tool data. Removing every compatibility hydration path therefore made v7 spec-clean but vulnerable to a known host lifecycle gap.

## Why v8 / status-card v2 exists

The remount hotfix keeps the standard MCP Apps bridge primary and restores only additive hydration fallbacks. Relay first accepts standard tool input/result notifications, then checks persisted ChatGPT compatibility globals, listens for `openai:set_globals`, and finally performs one bounded canonical progress read if the host supplies invocation input but no historical output. The card shell must never remain blank while Relay has enough project context to recover. The resource identities rotate to `context-card/v8.html` and `status-card/v2.html` so ChatGPT cannot reuse stale widget code from cache.

The separate later symptom—no iframe appearing when Relay is invoked through a nested orchestration/Code Mode tool path—must not be confused with the blank-frame bug. MCP App UI metadata belongs to the model-visible MCP tool call. A nested Relay call is not accepted as consumer UI-mount proof unless ChatGPT explicitly surfaces the nested tool's UI metadata.

## Preserved

This reset intentionally preserves the approved card CSS, feature marks/art, state/tone mappings, staff presentation, progress/check/PR modes, technical-evidence disclosure, and Inspector QA-media behavior. The transport/bootstrap is replaced; the visual design is not redesigned.

## Consumer gate

After merge/deploy and plugin refresh, acceptance requires direct ordinary-ChatGPT tool invocations, not nested orchestration evidence. In browser: render at least three cards in one conversation, reload or leave/revisit that same conversation, and verify the historical cards repaint rather than becoming blank frames. In native desktop: directly invoke the Relay render tool and verify an inline MCP App surface mounts; desktop non-mount is tracked as a separate client compatibility gate rather than treated as unsupported by definition. A successful server call observed only inside an outer orchestration tool is insufficient.

## Native desktop known-good bisect

The 2026-09-30 23:42:42 ET native macOS screenshot is a production known-good point. Worker version 67 had deployed commit `085d35ac00b57695b5089e78681504f7b7b8a6ee` at 23:31:23 ET with `ui://relay/context-card/v3.html`. That v3 resource rendered synchronously from `window.openai.toolOutput`, seeded `toolInput` from `window.openai.toolInput`, subscribed to `openai:set_globals`, preferred `window.openai.callTool`/`requestModal`, and skipped `ui/initialize` when the ChatGPT compatibility host was already present.

For an isolated consumer bisect, the normal `relay_render_context_card` + `ui://relay/context-card/v8.html` path stays unchanged as the standards-first control. The temporary `relay_show_legacy_bridge_card` tool uses the fresh immutable resource `ui://relay/status-card/v3-legacy-bridge.html`. It reuses the current v8 visual/data model but restores the known-good v3 host/bootstrap decision: compatibility globals render immediately when present; otherwise the widget falls back to the standard MCP Apps initialize/notification bridge. This temporary identity exists only to distinguish host-mount/bootstrap behavior from card design/data behavior.

Consumer test: refresh ChatGPT tools, invoke `relay_show_legacy_bridge_card` directly in an ordinary chat, and compare the same conversation across native macOS desktop, browser, and mobile. If the temporary legacy bridge mounts on desktop while `relay_render_context_card` does not, the regression is in the post-v3 host/bootstrap path rather than the current card UI/data model.

## Historical v2 final probe

This branch restores the actual `ui://relay/context-card/v2.html` implementation from `de5d8d6e8b6b1a3026e4f52feefe5121958a6ac7` under isolated symbols. Only `relay_runner_progress` receives the v2 contextual-card metadata. The resource is advertised/read through the pre-PR-85 `relay-entry` wrapper path, while current v8 and v3 controls remain unchanged. Consumer acceptance is the same direct `relay_runner_progress({project:"relay"})` turn compared on native macOS desktop, web, and iPhone after one tool refresh.
