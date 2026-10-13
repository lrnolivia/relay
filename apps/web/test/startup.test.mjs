import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

test("dashboard publishes base data before slow progress and retains activity on failed reads", async () => {
  const bundle = await build({ entryPoints: [new URL("../src/api.ts", import.meta.url).pathname], bundle: true, write: false, format: "esm", platform: "node" });
  const { loadDashboard } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
  const original = globalThis.fetch;
  const calls = [];
  let resolveProgress;
  let fail = false;
  const progress = new Promise(resolve => { resolveProgress = resolve; });
  const response = value => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  globalThis.fetch = async (path, options) => {
    calls.push(path);
    assert.ok(options.signal instanceof AbortSignal, "every request has a bounded lifetime");
    if (path === "/api/projects") return response({ projects: [{ id: "relay" }] });
    if (path === "/api/workers") return response([{ id: "field", enabled: true }]);
    if (path === "/api/projects/relay") return response({ coordination: {
      claims: [{ id: "current", state: "active" }, { id: "history", state: "completed" }],
      queue: [{ id: "queued", state: "queued" }, { id: "claimed", state: "claimed" }]
    } });
    assert.equal(path, "/api/progress/relay?assignment=current", "completed history must not fan out during dashboard startup");
    if (fail) throw new Error("provider unavailable");
    return progress;
  };
  try {
    const updates = [];
    let first;
    const base = new Promise(resolve => { first = resolve; });
    const pending = loadDashboard(snapshot => { updates.push(snapshot); first(snapshot); });
    const initial = await base;
    assert.equal(initial.workers[0].id, "field");
    assert.deepEqual(initial.loadingProgress, ["relay"]);
    assert.deepEqual(initial.progress, {});
    resolveProgress(response({ project: "relay", progress: [{ assignment: "current", state: "working" }] }));
    const completed = await pending;
    assert.deepEqual(completed.loadingProgress, []);
    assert.equal(completed.progress.relay.progress[0].assignment, "current");
    assert.deepEqual(completed.progress.relay.queue.map(item => item.id), ["queued"]);
    assert.ok(updates.length > 1);
    fail = true;
    const failed = await loadDashboard(undefined, completed);
    assert.deepEqual(failed.failedProgress, ["relay"]);
    assert.equal(failed.progress.relay.progress[0].assignment, "current", "a failed refresh preserves known work instead of inventing an empty history");
    assert.ok(calls.every(path => !path.includes("assignment=history")));
  } finally { globalThis.fetch = original; }
});
