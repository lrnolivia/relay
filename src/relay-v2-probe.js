// Minimal ChatGPT MCP App host probe.
// Intentionally static: no Relay card model, no host handshake, no window.openai,
// no self-refresh, and no client-side JavaScript. The existing extension layer
// attaches this resource only to relay_runner_progress for consumer bisecting.

export const RELAY_V2_PROBE_URI = 'ui://relay/probe/minimal-v2.html';
const CONTEXTUAL_TOOLS = new Set(['relay_runner_progress']);

export function relayV2ProbeDescriptor() {
  return {
    uri: RELAY_V2_PROBE_URI,
    name: 'relay-mcp-minimal-probe',
    title: 'Relay MCP host probe',
    description: 'Static MCP App resource used to verify whether the ChatGPT host mounts Relay UI.',
    mimeType: 'text/html;profile=mcp-app'
  };
}

export function contextualizeRelayV2ProbeTool(tool) {
  if (!tool || !CONTEXTUAL_TOOLS.has(tool.name)) return tool;
  const meta = tool._meta || {};
  return {
    ...tool,
    _meta: {
      ...meta,
      ui: {
        ...(meta.ui || {}),
        resourceUri: RELAY_V2_PROBE_URI,
        visibility: meta.ui?.visibility || ['model', 'app']
      },
      'ui/resourceUri': RELAY_V2_PROBE_URI,
      'openai/outputTemplate': RELAY_V2_PROBE_URI,
      'openai/widgetAccessible': true,
      'openai/toolInvocation/invoking': 'Testing Relay UI…',
      'openai/toolInvocation/invoked': 'Relay UI probe ready.'
    }
  };
}

// Compatibility exports retained so older imports do not break while this probe is active.
export function relayV2ProbeModel(data = {}) {
  return { ok: data?.ok !== false, probe: 'relay-mcp-minimal-v1' };
}

export function contextualPresentation(data) {
  return data;
}

function probeHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      background: transparent;
      font: 14px/1.4 system-ui, sans-serif;
    }
    main {
      border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
      border-radius: 12px;
      padding: 14px 16px;
    }
    strong { display: block; margin-bottom: 4px; }
    p { margin: 0; opacity: .72; }
  </style>
</head>
<body>
  <main>
    <strong>relay probe works</strong>
    <p>static MCP App resource mounted successfully</p>
  </main>
</body>
</html>`;
}

export function relayV2ProbeResource() {
  return {
    uri: RELAY_V2_PROBE_URI,
    mimeType: 'text/html;profile=mcp-app',
    text: probeHtml(),
    _meta: {
      ui: { prefersBorder: false },
      'openai/widgetDescription': 'Static Relay MCP App host probe.',
      'openai/ui': { availableDisplayModes: ['inline'] }
    }
  };
}
