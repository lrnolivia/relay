import test from "node:test";
import assert from "node:assert/strict";
import { normalizeViewport, normalizeSelector, browserRequestOptions } from "./browser.js";

test("normalizes safe browser viewport", () => {
  assert.deepEqual(normalizeViewport({ width: 1280, height: 720 }), { width: 1280, height: 720, deviceScaleFactor: 1 });
  assert.throws(() => normalizeViewport({ width: 100, height: 720 }), /Viewport width/);
  assert.throws(() => normalizeViewport({ width: 1280, height: 9000 }), /Viewport height/);
});

test("bounds selectors", () => {
  assert.equal(normalizeSelector("#stroke-panel"), "#stroke-panel");
  assert.equal(normalizeSelector(""), null);
  assert.throws(() => normalizeSelector("a\nbutton"), /Invalid selector/);
});

test("builds Access-authenticated Browser Run options without exposing credentials in URL", () => {
  const url = new URL("https://field.loew.fi/builder/noauth");
  const options = browserRequestOptions({ url, accessJwt: "jwt-value", viewport: { width: 1440, height: 900 } });
  assert.equal(options.url, url.toString());
  assert.equal(options.setExtraHTTPHeaders["Cf-Access-Token"], "jwt-value");
  assert.equal(new URL(options.url).search, "");
  assert.equal(options.gotoOptions.waitUntil, "networkidle2");
});
