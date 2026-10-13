import test from "node:test";
import assert from "node:assert/strict";
import { discoverProjectIcon, projectIcon } from "../../../packages/runner/src/project-icons.mjs";
import { validateUiRequest } from "../api.js";

test("project icon follows the registered app declaration and pins genuine blob provenance", async () => {
  const sha = digit => digit.repeat(40);
  const blobs = {
    [sha("a")]: '<link rel="icon" href="/brand/field.svg"><link rel="icon" href="https://evil.example/tracker.png">',
    [sha("b")]: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z"/></svg>'
  };
  const calls = [];
  const request = async path => {
    calls.push(path);
    if (path.includes("/git/trees/")) return { tree: [{ type: "blob", path: "index.html", sha: sha("a"), size: 120 }, { type: "blob", path: "public/brand/field.svg", sha: sha("b"), size: 100 }] };
    const content = blobs[path.split("/").pop()];
    return { encoding: "base64", content: Buffer.from(content).toString("base64") };
  };
  const result = await discoverProjectIcon({ repository: "lrnolivia/field", default_branch: "main" }, request);
  assert.equal(result.icon.path, "public/brand/field.svg");
  assert.equal(result.icon.blob_sha, sha("b"));
  assert.match(result.icon.data_url, /^data:image\/svg\+xml;base64,/);
  assert.ok(calls.every(path => path.startsWith("/repos/lrnolivia/field/")));
  assert.equal(validateUiRequest({ path: "/api/projects/field/icon" }).method, "GET");
  assert.throws(() => validateUiRequest({ path: "/api/projects/field/icon", method: "POST" }));
});

test("icon discovery fails honestly on incomplete trees, unsafe SVG, oversized assets and absent identity", async () => {
  assert.equal((await discoverProjectIcon({ repository: "https://evil.example" }, () => { throw Error("must not fetch"); })).status, "unavailable");
  assert.equal((await discoverProjectIcon({ repository: "lrnolivia/field" }, async () => ({ truncated: true, tree: [] }))).status, "unavailable");
  const result = await discoverProjectIcon({ repository: "lrnolivia/field" }, async path => path.includes("/trees/") ? { tree: [
    { type: "blob", path: "public/favicon.svg", size: 100, sha: "a".repeat(40) },
    { type: "blob", path: "public/logo.png", size: 999999, sha: "b".repeat(40) }
  ] } : { encoding: "base64", content: Buffer.from('<svg><script>alert(1)</script></svg>').toString("base64") });
  assert.deepEqual(result, { status: "unavailable", icon: null });
});

test("coalesced icon cache does not cross credential contexts", async () => {
  let calls = 0;
  const request = async () => { calls++; return { tree: [] }; };
  const project = { repository: "lrnolivia/cache-icon-test" };
  await Promise.all([projectIcon(project, request, "credential-a"), projectIcon(project, request, "credential-a")]);
  assert.equal(calls, 1);
  await projectIcon(project, request, "credential-b");
  assert.equal(calls, 2);
});
