import test from "node:test";
import assert from "node:assert/strict";
import { callRunnerCleanup, validateRunnerCleanupArguments } from "./runner-cleanup.js";
import { RUNNER_ENGINE_SHA } from "./runner-control.js";
import { augmentToolList, RELAY_EXTENSION_VERSION } from "./relay-entry.js";

const head = "a".repeat(40);
const merge = "b".repeat(40);
const other = "c".repeat(40);

function completed(extra = {}) {
  return {
    id: "done-task",
    owner: "worker",
    branch: "relay/done-task",
    paths: ["src/file.js"],
    resources: ["cleanup-test"],
    goal: "done",
    acceptance: "done",
    next_action: "done",
    base_sha: other,
    state: "completed",
    created_at: "2026-09-30T00:00:00.000Z",
    updated_at: "2026-09-30T01:00:00.000Z",
    lease_until: "2026-09-30T13:00:00.000Z",
    pr: 9,
    merged_head_sha: head,
    merge_commit_sha: merge,
    evidence: "https://github.com/lrnolivia/relay/pull/9",
    work_accounted: true,
    completed_at: "2026-09-30T01:00:00.000Z",
    ...extra
  };
}

function active(extra = {}) {
  return {
    id: "active-task",
    owner: "other",
    branch: "relay/active-task",
    paths: ["other/"],
    resources: [],
    goal: "active",
    acceptance: "active",
    next_action: "active",
    base_sha: other,
    state: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lease_until: new Date(Date.now() + 3600000).toISOString(),
    ...extra
  };
}

function fixture(options = {}) {
  const registration = {
    id: "relay",
    name: "relay",
    repository: "lrnolivia/relay",
    managed: true,
    default_branch: "main",
    implementation: {
      branch_prefixes: ["relay/"],
      excluded_branches: ["main"]
    },
    coordination: {
      status: "enabled",
      record: "coordination/relay.json",
      max_active_branches: 4,
      lease_hours: 12
    }
  };
  const record = {
    schema: 1,
    project: "relay",
    claims: options.claims || [completed()],
    queue: [],
    legacy_branches: options.legacy || ["main"]
  };
  const branches = new Map([
    ["main", "d".repeat(40)],
    ["relay/done-task", options.branchHead || head]
  ]);
  for (const [name, sha] of Object.entries(options.extraBranches || {})) branches.set(name, sha);
  const deletes = [];
  const calls = [];
  const file = (value, sha = "e".repeat(40)) => ({
    type: "file",
    sha,
    encoding: "base64",
    content: Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64")
  });
  const pr = options.pr || {
    number: 9,
    merged: true,
    base: { ref: "main", repo: { full_name: "lrnolivia/relay" } },
    head: {
      ref: "relay/done-task",
      sha: head,
      repo: { full_name: "lrnolivia/relay" }
    },
    merge_commit_sha: merge
  };

  const api = async (path, request = {}) => {
    calls.push({ path, request });
    if (path.includes("/contents/projects/relay.json")) return file(registration, "f".repeat(40));
    if (path.includes("/contents/coordination/relay.json")) {
      const value = typeof options.recordOnReread === "function" ? options.recordOnReread(record, calls) : record;
      return file(value, "1".repeat(40));
    }
    if (path.includes("/contents/src/coordination.mjs")) return file("", options.engineSha || RUNNER_ENGINE_SHA);
    if (path.includes("/repos/lrnolivia/relay/branches?")) {
      return [...branches.entries()].map(([name, sha]) => ({ name, commit: { sha } }));
    }
    if (path.endsWith("/repos/lrnolivia/relay/pulls/9")) return pr;
    if (path.includes("/git/ref/heads/relay/done-task")) {
      if (!branches.has("relay/done-task")) throw Object.assign(new Error("Not Found"), { status: 404 });
      return { object: { sha: branches.get("relay/done-task") } };
    }
    if (path.includes("/git/refs/heads/relay/done-task") && request.method === "DELETE") {
      deletes.push("relay/done-task");
      branches.delete("relay/done-task");
      return null;
    }
    throw new Error(`Unexpected path ${path}`);
  };
  return { api, deletes, calls, record, branches };
}

test("cleanup requires an explicit bounded mode", () => {
  assert.throws(() => validateRunnerCleanupArguments({ project: "relay" }), /mode/);
  assert.throws(() => validateRunnerCleanupArguments({ project: "relay", mode: "all" }), /dry_run or execute/);
  assert.throws(() => validateRunnerCleanupArguments({ project: "relay", mode: "execute", branch: "x" }), /Unsupported argument/);
});

test("dry-run reports exact eligible completion without deleting", async () => {
  const f = fixture();
  const result = await callRunnerCleanup({ project: "relay", mode: "dry_run" }, {}, f.api);
  assert.equal(result.ok, true);
  assert.equal(result.mode, "dry_run");
  assert.equal(result.eligible.length, 1);
  assert.equal(result.eligible[0].merged_head_sha, head);
  assert.deepEqual(result.deleted, []);
  assert.deepEqual(f.deletes, []);
});

test("execute revalidates completion and exact head then verifies deletion", async () => {
  const f = fixture();
  const result = await callRunnerCleanup({ project: "relay", mode: "execute" }, {}, f.api);
  assert.deepEqual(result.deleted, ["relay/done-task"]);
  assert.equal(f.branches.has("relay/done-task"), false);
  assert.equal(f.deletes.length, 1);
  const coordinationReads = f.calls.filter(call => call.path.includes("/contents/coordination/relay.json"));
  assert.ok(coordinationReads.length >= 2);
  const prReads = f.calls.filter(call => call.path.endsWith("/pulls/9"));
  assert.ok(prReads.length >= 2);
});

test("post-merge commits are retained and never deleted", async () => {
  const f = fixture({ branchHead: other });
  const result = await callRunnerCleanup({ project: "relay", mode: "execute" }, {}, f.api);
  assert.deepEqual(result.deleted, []);
  assert.equal(result.retained.some(item => item.reason === "post_merge_commits"), true);
  assert.deepEqual(f.deletes, []);
});

test("active ownership on a completed branch retains the branch", async () => {
  const f = fixture({
    claims: [
      completed(),
      active({ branch: "relay/done-task", paths: ["other/"], resources: ["other"] })
    ]
  });
  const result = await callRunnerCleanup({ project: "relay", mode: "execute" }, {}, f.api);
  assert.deepEqual(result.deleted, []);
  assert.equal(result.retained.some(item => item.reason === "active_ownership"), true);
});

test("changed merged evidence fails closed before deletion", async () => {
  const f = fixture({
    pr: {
      number: 9,
      merged: true,
      base: { ref: "main", repo: { full_name: "lrnolivia/relay" } },
      head: { ref: "relay/done-task", sha: other, repo: { full_name: "lrnolivia/relay" } },
      merge_commit_sha: merge
    }
  });
  await assert.rejects(
    callRunnerCleanup({ project: "relay", mode: "execute" }, {}, f.api),
    /Merged evidence changed/
  );
  assert.deepEqual(f.deletes, []);
});

test("Runner engine drift fails closed", async () => {
  const f = fixture({ engineSha: other });
  await assert.rejects(
    callRunnerCleanup({ project: "relay", mode: "dry_run" }, {}, f.api),
    /Runner engine changed/
  );
  assert.deepEqual(f.deletes, []);
});


test("Relay extension publishes cleanup as a destructive bounded tool", () => {
  const tools = augmentToolList([{
    name: "relay_runner_audit",
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: true },
    securitySchemes: [{ type: "oauth2", scopes: [] }],
    _meta: {}
  }]);
  const cleanup = tools.find(tool => tool.name === "relay_runner_cleanup");
  assert.ok(cleanup);
  assert.equal(cleanup.annotations.destructiveHint, true);
  assert.deepEqual(cleanup.inputSchema.required, ["project", "mode"]);
  assert.match(RELAY_EXTENSION_VERSION, /^\d+\.\d+\.\d+(?:\.\d+)?$/);
});


test("cleanup reads policy and coordination from configured Relay control authority", async () => {
  const f = fixture();
  const result = await callRunnerCleanup(
    { project: "relay", mode: "dry_run" },
    { RELAY_RUNNER_CONTROL_REPOSITORY: "lrnolivia/relay" },
    f.api
  );
  assert.equal(result.ok, true);
  assert.ok(f.calls.some(call => call.path.startsWith("/repos/lrnolivia/relay/contents/projects/relay.json")));
});
test('retired claims never qualify for cleanup even with inherited completion-like evidence', async () => {
  for (const state of ['cancelled', 'superseded']) {
    const f = fixture({ claims: [completed({ state })] });
    const result = await callRunnerCleanup({ project: 'relay', mode: 'execute' }, {}, f.api);
    assert.deepEqual(result.eligible, []);
    assert.deepEqual(result.deleted, []);
    assert.deepEqual(f.deletes, []);
    assert.equal(f.branches.has('relay/done-task'), true);
  }
});

test('an older completion cannot delete a branch referenced by a newer retired claim', async () => {
  for (const state of ['cancelled', 'superseded']) {
    const f = fixture({ claims: [completed(), active({ id: 'newer-task', state, branch: 'relay/done-task' })] });
    const result = await callRunnerCleanup({ project: 'relay', mode: 'execute' }, {}, f.api);
    assert.deepEqual(result.eligible, []);
    assert.deepEqual(result.deleted, []);
    assert.deepEqual(f.deletes, []);
    assert.ok(result.retained.some(item => item.reason === 'retired_branch'));
  }
});
test('a retired reference appearing only on the pre-delete reread stops an older completion', async () => {
  for (const state of ['cancelled', 'superseded']) {
    const f = fixture({ recordOnReread(record, calls) {
      const reads = calls.filter(call => call.path.includes('/contents/coordination/relay.json')).length;
      return reads > 1 ? { ...record, claims: [...record.claims, active({ id: 'newer-task', state, branch: 'relay/done-task' })] } : record;
    } });
    await assert.rejects(callRunnerCleanup({ project: 'relay', mode: 'execute' }, {}, f.api), /Ownership or evidence changed/);
    assert.deepEqual(f.deletes, []);
    assert.equal(f.branches.has('relay/done-task'), true);
  }
});
