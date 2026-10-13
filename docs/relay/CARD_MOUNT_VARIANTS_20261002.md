# Relay card mount variants

Prepared directly through Relay in Julian's existing chat, with no worker launch.

## What this isolates

PR114 fixed a verified browser packaging error; it did not establish host mounting. Lauren refreshed tools/restarted and reported no card at all. Exact previous test invocation/resource remains unknown. Existing production v10, connection test and action comparison stay intact.

Three small, separately named, read-only tools make host discovery testable without changing the production card art:

1. A — relay_test_card_static_standard: only the standard ui.resourceUri tool link; HTML contains no script.
2. B — relay_test_card_static_compat: only the documented openai/outputTemplate compatibility alias; byte-identical static HTML to A.
3. C — relay_test_card_lifecycle_standard: standard metadata with a bounded self-contained script that marks Script started, Host connected and Data arrived.

All use text/html;profile=mcp-app, unique resource URIs under ui://relay/mount-variants/20261002.1/, explicit output schemas and existing authentication. No network dependencies, project data, callbacks, credential changes or mutations.

## Test order after deployment and discovery refresh

On the same ordinary ChatGPT client and connection, request A, then B. Record tool name/build, no frame versus visible static card. Only test C after that; record its last visible milestone. Do not run every client repeatedly until one difference is established.

- Neither A nor B mounts: this test does not reach browser script. Investigate client/discovery/resource-fetch path; do not claim a JS/CSS fix is needed.
- A alone mounts: standard metadata path works, compatibility-only path does not in that host.
- B alone mounts: compatibility metadata works, standard-only path does not in that host.
- Both mount: linkage works; C locates script/init/result delivery next.
- C static only: script execution failed or was blocked.
- C Script started only: host initialization path is unresolved.
- C Host connected without Data arrived: result delivery is unresolved.
- C Data arrived: this variant's mount/bridge/data works, not all production card actions.

Expected server text alone is never a visible-card pass. Local browser fixtures are not native ChatGPT evidence.

## Regression coverage

Authenticated production endpoint preserves all 59 existing server tools and adds exactly three. A/B HTML equality, empty arguments, output schemas and resource identity are checked. Worker keepNames bundling preserves all browser source bytes. Browser tests cover disabled scripts, 320px horizontal layout, normal/early/absent/invalid host and forged non-parent messages.

The pre-existing action-comparison teardown test intermittently advanced fake time before cross-document teardown was delivered. This change waits for the actual teardown acknowledgement before advancing time, retains all original assertions and still rejects late timeout effects. It is a bounded test synchronization repair, not a production lifecycle change.

No release or native-client success is claimed until exact-head CI and deployment receipts are recorded. Original MCP capability/rebuild and prior failed host criteria remain unresolved. Current website polish is stopped with unpublished Mac changes; Field is parked until these variants are prepared.

Official metadata reference: https://developers.openai.com/plugins/reference
Official UI flow: https://developers.openai.com/plugins/build/chatgpt-ui
