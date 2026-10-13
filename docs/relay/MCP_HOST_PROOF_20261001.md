# Relay actual-host card proof

Assignment `relay-mcp-host-proof-20261001`; owner `01a0f914-aad0-71e4-8f0c-20c1bf0a2016`, Ellis. Admission record `812401edfdcdf7f80ddd87c3fd76003178ba37bd`, receipt `668d4a517cd839c64866b0deec1b34f432a9880c`, base `be058177e95d08db85719dcb20f402b6e4dd21db`. Four admitted files; fresh preflight passed before implementation. No website/shared-UI/auth changes.

## Falsifiable experiment

One additive read-only tool, `relay_test_card_connection`, declares `ui://relay/host-proof/20261001.1.html`. Build label `20261001.1`. The self-contained HTML needs no fonts, images, network fetches or model context updates. It does not start work or write project data. Both initial and button-triggered results return a server observation time and unique sample identity. A useful text result explicitly separates successful server response from visible card rendering.

Milestones are independent:
1. **Card appeared** — static HTML. If absent, do not diagnose script or data hydration yet.
2. **Script started** — the actual embedded script ran.
3. **Host connected** — supported standard `ui/initialize` response received and initialized notification sent.
4. **Data arrived** — a matching-build initial tool result was delivered separately from initialization. Early result delivery is supported.
5. **Dimensions** — measured local size; once connected, height was sent to the host. Sending size is not proof the host honored it or that the card is usable.
6. **Read-only check worked** — the host advertised `serverTools`, accepted a user-triggered call to the diagnostic tool, and returned a matching-build sample. No optimistic success on timeout or error.

This first experiment deliberately uses only standard MCP Apps transport, with no `window.openai` fallback or speculative transport rewrites. Initialization requires the tested UI protocol `2026-01-26`; another negotiated version is shown as an explicit unsupported boundary. This is separate from Relay's unchanged server MCP protocol `2025-03-26`. A supported legacy-only host can therefore fail this diagnostic while still supporting some original cards; compare the preserved controls before a conclusion.

Host names/version, selected context fields and capability names appear in optional technical details. Request user-agent hints are bounded strings and are informational only. No auth tokens, user identity, arbitrary metadata or local filesystem paths are captured. Messages must originate from the iframe's parent; replies correlate to pending IDs. No arbitrary tool name, argument, URL or server operation is accepted from card content. The one button calls only the read-only diagnostic.

## Baseline and inventory

The installed model catalog has 51 tools. Authenticated server discovery has those same 51 **plus the existing app-only `relay_ui_request` bridge**. Preserve all 52 original server descriptors/capabilities; the proof adds one tool (53 total, 52 model-visible). The distinction was observed in real endpoint integration tests and the pre-existing bridge declaration, not hidden by deleting an unexpected tool.

Original card controls remain:
- `relay_render_context_card` → `ui://relay/context-card/v9.html`.
- `relay_runner_progress` → historical `ui://relay/context-card/v2.html`.
- `relay_show_legacy_bridge_card` → `ui://relay/status-card/v3-legacy-bridge.html`.
- Control center → `ui://relay/control-center/v4.html`.

No approved Inspector/Momo/feature-mark art, CSS or card meaning is replaced. This diagnostic is not the future product card or the website dashboard. The fixed lowercase title request, shared identities/plain language and ambient status remain subsequent accepted batches. If a later conversational layout reuses floating navigation, it belongs at the top with actual-height/safe-area/scroll/focus clearance; contextual cards need not acquire website chrome.

## Evidence matrix

| Consumer | Static | Script | Init | Initial result | Usable dimensions | Read-only action |
| --- | --- | --- | --- | --- | --- | --- |
| Authenticated local Worker route + synthetic Chromium host | Automated fixture | Automated fixture | Automated fixture | Automated fixture | Local layout only | Synthetic host only |
| Actual ChatGPT desktop | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Actual ChatGPT browser | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Actual iPhone app | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

Automated tests exercise the real resource string in a sandboxed iframe, early/late result delivery, missing capabilities, initialization errors/version mismatch/timeout, read-only action errors, forged child messages, disabled scripts and narrow/large-text reachability. This proves the controlled component behavior, not any native host. Never translate a green test suite, Inspector view or desktop mobile viewport into an iPhone pass.

Initial validation at `b6eb2b8`: 12 new endpoint/component tests and the full **317-test** suite passed, with build/typecheck and canonical admission. Independent review found one diagnostic bug: cancellation could be overwritten by the still-armed result timer. A new fake-clock regression failed before repair, then all **13 targeted tests** passed after cancellation became terminal against both the 15-second timer and late tool results. Exact revised-head CI is recorded on the PR; prior-head green checks do not validate later edits. Static local shell capture is retained in this task's evidence directory for review, not counted as host evidence.

Pre-release packaging inspection found another real defect before deployment: Wrangler 4.129.0 adds `__name` helpers when bundling functions. Serializing the browser function with `toString()` captured calls to that server-side helper without its definition inside the iframe. The diagnostic now stores one literal browser program, preserving its source through bundling without injecting shims or replacing strings. A keep-names bundle regression failed before repair, then all **14 targeted tests** passed; a fresh actual Wrangler dry-run also preserved the literal browser program. No faulty diagnostic was deployed. This check is packaging evidence, not a native-client result or a conclusion about every historical card failure.

Release source SHA, PR, exact-head checks, Workers Build, active version and installed-schema refresh receipt are pending. Deploy only after the website release slot is clear. After deployment, Julian routes one actual client check at a time: invoke the exact diagnostic tool, note which milestone labels appear and the build label, click **Check connection** once if enabled, and record whether the whole card/button remains reachable. Save screenshot/log evidence, app/browser version and conversation mode when obtainable. A missing card needs only that observation first, not developer-console work. Native-control restrictions remain in force.

## Current host/executor routing finding

Current `src/index.js` initialization ignores incoming `clientInfo` and client capabilities and returns its fixed server protocol/capability envelope. Its control-status capabilities describe Relay's configured server integrations, not the caller's local editor or shell. A differential authenticated endpoint test sends distinct Codex/ChatGPT identities and roots capabilities and observes identical initialization responses. This is current source behavior; no actual client's initialize traffic was captured here.

Protocol potential differs from current behavior: MCP initialization can carry client implementation details and negotiated capabilities. MCP Apps initialization can expose host information/context and UI capabilities. OpenAI's user-agent metadata is optional and not a stable host detector. Names are hints, not authenticated execution authority; UI `serverTools` means a proxy to server tools, not client-disk access. Filesystem roots describe permitted locations where implemented; a remote Worker cannot read a Mac/Linux path merely because a root URI exists.

Required future routing: prefer an authorized local repository edit/test/git-push path in Codex on either Mac or Linux when that actual executor, machine identity, project root and permissions are available. Preserve unrelated edits, isolate the task checkout, refresh remote state, obey canonical admission and verify pushes. Ordinary ChatGPT uses its actually available remote tools/executor; do not infer a local filesystem or start an agent from a queue record. The choice depends on verified capabilities and task context, not branding or claimed user-agent text. No Linux machine access/setup or new execution adapter is introduced by this proof.

## Official references checked 2026-10-01

- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview): tool resource declaration, iframe boundary, host-controlled capabilities; direct protocol implementation is supported without the convenience SDK.
- [UI initialize request](https://apps.extensions.modelcontextprotocol.io/api/interfaces/app.McpUiInitializeRequest.html), [result](https://apps.extensions.modelcontextprotocol.io/api/interfaces/app.McpUiInitializeResult.html), [host capabilities](https://apps.extensions.modelcontextprotocol.io/api/interfaces/app.McpUiHostCapabilities.html), [UI protocol version](https://apps.extensions.modelcontextprotocol.io/api/variables/app.LATEST_PROTOCOL_VERSION.html), [size notification](https://apps.extensions.modelcontextprotocol.io/api/interfaces/app.McpUiSizeChangedNotification.html).
- [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle) and [roots](https://modelcontextprotocol.io/specification/2025-03-26/client/roots).
- [OpenAI reference](https://developers.openai.com/plugins/reference): model/component result visibility and optional user-agent hint; [connection refresh guidance](https://developers.openai.com/plugins/build/app-quickstart).
