import test from "node:test";
import assert from "node:assert/strict";
import { cloudStatus, cloudWriteScripts, cloudBuilds } from "./cloud.js";

test("relay.CLOUD status is truthful and writes are bounded", () => {
  const empty = cloudStatus({});
  assert.equal(empty.configured, false);
  assert.equal(empty.builds_configured, false);
  assert.deepEqual(empty.required_bindings, ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);
  assert.deepEqual(empty.builds_required_bindings, ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_BUILDS_API_TOKEN"]);
  assert.deepEqual(cloudWriteScripts({}), ["relay"]);
  const ready = cloudStatus({
    CLOUDFLARE_ACCOUNT_ID: "a",
    CLOUDFLARE_API_TOKEN: "primary",
    CLOUDFLARE_BUILDS_API_TOKEN: "builds",
    RELAY_CLOUDFLARE_WRITE_SCRIPTS: "one,two"
  });
  assert.equal(ready.configured, true);
  assert.equal(ready.builds_configured, true);
  assert.equal(ready.builds_token_configured, true);
  assert.equal(ready.authorization_mode, "project-registration+runtime-allowlist");
  assert.deepEqual(ready.write_scripts, ["one", "two"]);
  assert.deepEqual(ready.builds_required_bindings, []);
});

test("relay.CLOUD uses the dedicated user token only for Workers Builds", async () => {
  const originalFetch = globalThis.fetch;
  const authorizations = [];
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(options.redirect,'manual');
    authorizations.push({ url: String(url), authorization: options.headers.Authorization });
    if (String(url).endsWith("/workers/scripts")) {
      return new Response(JSON.stringify({
        success: true,
        result: [{ id: "loew-inspector", tag: "worker-tag" }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (String(url).endsWith("/builds/workers/worker-tag/builds")) {
      return new Response(JSON.stringify({
        success: true,
        result: { builds: [] }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: false, errors: [{ message: "unexpected request" }] }), { status: 500 });
  };

  try {
    const result = await cloudBuilds({
      CLOUDFLARE_ACCOUNT_ID: "account",
      CLOUDFLARE_API_TOKEN: "primary-token",
      CLOUDFLARE_BUILDS_API_TOKEN: "builds-token"
    }, "loew-inspector");

    assert.deepEqual(result, { builds: [] });
    assert.deepEqual(authorizations, [
      {
        url: "https://api.cloudflare.com/client/v4/accounts/account/workers/scripts",
        authorization: "Bearer primary-token"
      },
      {
        url: "https://api.cloudflare.com/client/v4/accounts/account/builds/workers/worker-tag/builds",
        authorization: "Bearer builds-token"
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
