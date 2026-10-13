# Fresh inline status-card identity experiment

Assignment: `relay-status-card-reset-20261001`.

The new native MCP render tool `relay_show_status_card` points to the new resource `ui://relay/status-card/v1.html`. Both register through the same native list/read/call and OAuth security decoration as the working control center. The new tool has standard `ui.resourceUri`, compatibility `openai/outputTemplate`, model/app visibility, and no global/sidebar entrypoint. The resource remains inline-only with the existing CSP.

The approved v7 card HTML, feature art, state model, inputs, validation, Runner assignments data and Inspector evidence behavior are shared unchanged. `relay_render_context_card` and `ui://relay/context-card/v7.html` remain registered and readable. No existing card transport or visual design was rewritten.

Regression exercises the authenticated production Worker entry through tools/list, resources/list, resources/read and invalid tools/call arguments; verifies security metadata parity with the control center, absence of sidebar behavior, exact HTML/resource metadata equality with v7, and retention of the old identities. Existing iframe lifecycle tests remain applicable because the HTML is identical.

Consumer acceptance remains a direct invocation of `relay_show_status_card` in an ordinary ChatGPT chat after refreshing Relay's tools. A successful nested tool call, descriptor/readback, or Inspector rendering is not proof of a visible ChatGPT mount. Keep the old tool until that mount is observed. Do not alter visuals to chase host surfacing.

References: https://developers.openai.com/plugins/build/chatgpt-ui and https://developers.openai.com/plugins/reference.
