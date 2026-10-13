# Relay 1.9.6 MCP UI hotfix

## Problem

ChatGPT mounted the Relay MCP app container but rendered a blank dark rectangle for the control center while Relay tools continued working.

The control-center HTML/JavaScript had evolved substantially while remaining published under the original `ui://relay/control-center/v1.html` resource identity. MCP Apps hosts may treat the resource URI as a cache key, so reusing it across breaking UI changes can leave a client with stale cached component content.

## Fix

- publish the control center under `ui://relay/control-center/v2.html`;
- update the context-card launcher to request the same v2 resource;
- keep the existing control-center HTML and tool contract unchanged;
- pin regression tests so the control center cannot silently fall back to the stale v1 identity.

This hotfix intentionally avoids `apps/web/generated.js`, which is owned by the active Inspector visual-polish assignment.

## Verification

After exact-source deployment, refresh the Relay plugin connection in ChatGPT and invoke `relay_ui_control_center`. The expected result is a painted Relay control-center surface instead of an empty reserved rectangle.
