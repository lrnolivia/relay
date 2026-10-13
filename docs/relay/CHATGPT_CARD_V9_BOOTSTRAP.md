# ChatGPT card v9 bootstrap

Relay card v9 keeps the v8 card design and data model, but patches the HTML returned by `cardHtml()` at serve time. The legacy bridge card continues to call `cardHtml()` directly and is intentionally unchanged so it remains the consumer control.

The v9 bootstrap paints immediately from `window.openai.toolInput` / `window.openai.toolOutput` when those globals are already present. The standards `ui/initialize` handshake runs in parallel instead of blocking first paint, with a 4 second timeout. Tool calls prefer `window.openai.callTool` when the ChatGPT compatibility bridge exposes it, then fall back to MCP `tools/call`.

The card reports intrinsic size through both `ui/notifications/size-changed` and `window.openai.notifyIntrinsicHeight` when available. A small diagnostic line is rendered at the bottom in this format:

`host check: globals yes/no · handshake ok Nms / pending / timeout · height N`

The legacy bridge resource remains the unchanged control. Its purpose is to distinguish card/bootstrap failures from ChatGPT host mounting or registration failures.

## Consumer matrix

After merge, deployment, and a ChatGPT tool refresh, call `relay_render_context_card` directly with `{"project":"relay"}` in an ordinary chat on native desktop, browser, and mobile. Repeat the same matrix with `relay_show_legacy_bridge_card`.

For every client record whether a frame appears, whether it is blank or painted, approximate seconds to content, the complete diagnostic line, and whether the card survives leaving and reopening the conversation.

Interpret results as follows:

- Visible card with `globals yes` and a pending or timed-out handshake means the host did not answer the standards handshake; v9's non-blocking paint is working.
- A successful handshake with height 0, or a still-blank mounted frame, points to host sizing behavior.
- No card and no diagnostic line means the iframe did not mount; compare the legacy control and investigate host/registration rather than redesigning card HTML.
- If the legacy control mounts while v9 does not, compare the advertised resource URIs and exact tool-refresh time before rotating the contextual resource identity again.
