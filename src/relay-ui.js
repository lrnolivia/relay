import { mcpHtml } from "../apps/web/generated.js";
export const RELAY_CONTROL_CENTER_URI = "ui://relay/control-center/v5-ctrl-handoff.html";
export function relayControlCenterResource() {
  return {
    uri: RELAY_CONTROL_CENTER_URI,
    mimeType: "text/html;profile=mcp-app",
    text: mcpHtml,
    _meta: {
      ui: { prefersBorder: false, csp: { resourceDomains: ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "blob:"], frameDomains: ["https://*.loew.fi"], redirectDomains: ["https://chatgpt.com"] } },
      "openai/ui": { availableDisplayModes: ["inline", "fullscreen"] }
    }
  };
}
