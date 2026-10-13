import test from "node:test";
import assert from "node:assert/strict";
import { uploadCloudSourceVersion, validateCloudUploadArguments } from "./cloud-upload.js";

const commit = "a".repeat(40);
const owner = "lrnolivia";
const repo = "relay";
const script = "loew-inspector";

function encoded(content, path) {
  return {
    type: "file",
    path,
    encoding: "base64",
    content: Buffer.from(content).toString("base64"),
    truncated: false
  };
}

function fixture(options = {}) {
  const githubCalls = [];
  const cloudCalls = [];
  const uploads = [];
  const versions = [...(options.versions || [])];
  const files = {
    "wrangler.jsonc": JSON.stringify({
      name: options.wranglerName || script,
      main: "src/relay-entry.js",
      compatibility_date: "2026-09-29",
      compatibility_flags: ["nodejs_compat"],
      vars: options.vars || {}
    }),
    "src/relay-entry.js": options.entry || 'import { value } from "./dep.js";\nexport default { value };\n',
    "src/dep.js": options.dep || 'import { createHash } from "node:crypto";\nexport const value = createHash("sha1").update("x").digest("hex");\n'
  };

  const github = async (path) => {
    githubCalls.push(path);
    if (path.endsWith("/git/commits/" + commit)) return { sha: commit };
    const match = path.match(/\/contents\/(.+)\?ref=([a-f0-9]{40})$/);
    if (!match) throw new Error("Unexpected GitHub path " + path);
    const sourcePath = decodeURIComponent(match[1]).replace(/%2F/gi, "/");
    assert.equal(match[2], commit);
    if (!(sourcePath in files)) throw Object.assign(new Error("Not Found"), { status: 404 });
    return encoded(files[sourcePath], sourcePath);
  };

  const cloud = async (path) => {
    cloudCalls.push(path);
    if (path.endsWith("/settings")) {
      return {
        bindings: [
          { name: "BROWSER", type: "browser" },
          { name: "EVIDENCE", type: "r2_bucket" },
          { name: "CLOUDFLARE_API_TOKEN", type: "secret_text" }
        ]
      };
    }
    if (path.endsWith("/versions")) return { items: versions };
    throw new Error("Unexpected Cloudflare path " + path);
  };

  const rawUpload = async (path, metadata, modules) => {
    uploads.push({ path, metadata, modules });
    const version = {
      id: options.versionId || "11111111-2222-3333-4444-555555555555",
      annotations: { ...metadata.annotations }
    };
    versions.unshift(version);
    if (options.timeoutAfterWrite) throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    return version;
  };

  const env = {
    RELAY_GITHUB_OWNER: owner,
    RELAY_CLOUDFLARE_WRITE_SCRIPTS: options.writeScripts || "loew-inspector,relay",
    CLOUDFLARE_ACCOUNT_ID: "account123",
    CLOUDFLARE_API_TOKEN: "token"
  };
  return { github, cloud, rawUpload, env, versions, uploads, githubCalls, cloudCalls };
}

const args = {
  script,
  repo,
  commit_sha: commit,
  message: "Exact merged source",
  purpose: "diagnostic"
};

test("upload arguments require exact bounded identities", () => {
  assert.throws(() => validateCloudUploadArguments({ script, repo, commit_sha: "main" }), /exact source commit/);
  assert.throws(() => validateCloudUploadArguments({ ...args, extra: true }), /Unsupported argument/);
  assert.equal(validateCloudUploadArguments(args), args);
});

test("native upload binds exact Git source, module graph, config and inherited bindings", async () => {
  const f = fixture();
  const result = await uploadCloudSourceVersion(args, f.env, {
    github: f.github,
    cloud: f.cloud,
    rawUpload: f.rawUpload
  });

  assert.equal(result.ok, true);
  assert.equal(result.commit_sha, commit);
  assert.equal(result.already_exists, false);
  assert.equal(result.reconciled_after_transport_error, false);
  assert.deepEqual(result.modules.sort(), ["src/dep.js", "src/relay-entry.js"]);
  assert.equal(f.uploads.length, 1);

  const upload = f.uploads[0];
  assert.match(upload.path, /\/versions\?bindings_inherit=strict$/);
  assert.equal(upload.metadata.main_module, "src/relay-entry.js");
  assert.equal(upload.metadata.compatibility_date, "2026-09-29");
  assert.deepEqual(upload.metadata.compatibility_flags, ["nodejs_compat"]);
  assert.deepEqual(upload.metadata.bindings, [
    { name: "BROWSER", type: "inherit" },
    { name: "EVIDENCE", type: "inherit" },
    { name: "CLOUDFLARE_API_TOKEN", type: "inherit" }
  ]);
  assert.equal(upload.metadata.annotations["workers/commit_sha"], commit);
  assert.equal(
    f.githubCalls.filter(path => path.includes("/contents/")).every(path => path.endsWith("?ref=" + commit)),
    true
  );
  assert.equal(f.cloudCalls.some(path => path.includes("/deployments")), false);
});

test("existing exact-commit version is reused without another upload", async () => {
  const existing = {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    annotations: { "workers/commit_sha": commit }
  };
  const f = fixture({ versions: [existing] });
  const result = await uploadCloudSourceVersion(args, f.env, {
    github: f.github,
    cloud: f.cloud,
    rawUpload: f.rawUpload
  });
  assert.equal(result.version_id, existing.id);
  assert.equal(result.already_exists, true);
  assert.equal(f.uploads.length, 0);
});

test("timeout after accepted upload reconciles by exact commit annotation", async () => {
  const f = fixture({ timeoutAfterWrite: true });
  const result = await uploadCloudSourceVersion(args, f.env, {
    github: f.github,
    cloud: f.cloud,
    rawUpload: f.rawUpload
  });
  assert.equal(result.ok, true);
  assert.equal(result.reconciled_after_transport_error, true);
  assert.equal(f.uploads.length, 1);
});

test("disallowed Worker script fails before cloud mutation", async () => {
  const f = fixture();
  await assert.rejects(
    uploadCloudSourceVersion({ ...args, script: "other-worker" }, f.env, {
      github: f.github,
      cloud: f.cloud,
      rawUpload: f.rawUpload
    }),
    /writes are not allowed/
  );
  assert.equal(f.uploads.length, 0);
  assert.equal(f.githubCalls.length, 0);
});

test("Wrangler identity mismatch fails closed", async () => {
  const f = fixture({ wranglerName: "wrong-worker" });
  await assert.rejects(
    uploadCloudSourceVersion(args, f.env, {
      github: f.github,
      cloud: f.cloud,
      rawUpload: f.rawUpload
    }),
    /name does not match/
  );
  assert.equal(f.uploads.length, 0);
});

test("unsupported relative module types are rejected instead of silently omitted", async () => {
  const f = fixture({ entry: 'import "./style.css";\nexport default {};\n' });
  await assert.rejects(
    uploadCloudSourceVersion(args, f.env, {
      github: f.github,
      cloud: f.cloud,
      rawUpload: f.rawUpload
    }),
    /must include \.js or \.mjs/
  );
  assert.equal(f.uploads.length, 0);
});


test("canonical relay Worker rejects diagnostic source upload", async () => {
  const f = fixture({ wranglerName: "relay" });
  await assert.rejects(
    uploadCloudSourceVersion(
      { ...args, script: "relay" },
      f.env,
      { github: f.github, cloud: f.cloud, rawUpload: f.rawUpload }
    ),
    /Workers Builds/
  );
  assert.equal(f.githubCalls.length, 0);
  assert.equal(f.uploads.length, 0);
});

test("canonical relay Worker rejects manual upload even for recovery", async () => {
  const f = fixture({ wranglerName: "relay" });
  await assert.rejects(
    uploadCloudSourceVersion(
      { ...args, script: "relay", purpose: "recovery" },
      f.env,
      { github: f.github, cloud: f.cloud, rawUpload: f.rawUpload }
    ),
    /source upload is disabled/
  );
  assert.equal(f.githubCalls.length, 0);
  assert.equal(f.uploads.length, 0);
});

test('upload includes multiline named imports and reexports', async () => {
 const f = fixture({entry: 'export {\n value\n} from "./dep.js";\nexport default {};\n'});
 const result = await uploadCloudSourceVersion(args, f.env, {github:f.github, cloud:f.cloud, rawUpload:f.rawUpload});
 assert.ok(result.modules.includes('src/dep.js'));
 const g = fixture({entry: 'import {\n value\n} from "./dep.js";\nexport default {value};\n'});
 const imported = await uploadCloudSourceVersion(args,g.env,{github:g.github,cloud:g.cloud,rawUpload:g.rawUpload});
 assert.ok(imported.modules.includes('src/dep.js'));
});

 test("committed non-secret runtime identities update while resource and secret identities are inherited", async () => {
  const f = fixture({ vars: { RELAY_RUNNER_CONTROL_REPOSITORY: "lrnolivia/relay", RELAY_CLOUDFLARE_WRITE_SCRIPTS: "relay" } });
  await uploadCloudSourceVersion(args, f.env, f);
  assert.ok(f.uploads[0].metadata.bindings.some(binding => binding.name === "RELAY_RUNNER_CONTROL_REPOSITORY" && binding.text === "lrnolivia/relay"));
  assert.deepEqual(f.uploads[0].metadata.bindings.find(binding => binding.name === "CLOUDFLARE_API_TOKEN"), { name: "CLOUDFLARE_API_TOKEN", type: "inherit" });
});

test("source vars cannot replace secrets or arbitrary bindings", async () => {
  const f = fixture({ vars: { CLOUDFLARE_API_TOKEN: "not-allowed" } });
  await assert.rejects(uploadCloudSourceVersion(args, f.env, f), /Unsupported non-secret/);
  assert.equal(f.uploads.length, 0);
  const g = fixture({ vars: { RELAY_GITHUB_APP_ID: "5133504" } });
  const cloud = async path => path.endsWith("/settings") ? { bindings: [{ name: "RELAY_GITHUB_APP_ID", type: "secret_text" }] } : g.cloud(path);
  await assert.rejects(uploadCloudSourceVersion(args, g.env, { ...g, cloud }), /protected binding/);
  assert.equal(g.uploads.length, 0);
});

for (const project of ["field", "loewfi", "loewtorials", "thetake"]) {
  test(project + " ordinary publication fails before any source read or cloud mutation", async () => {
    const f = fixture({ wranglerName: project, writeScripts: project });
    const { purpose, ...ordinary } = args;
    await assert.rejects(
      uploadCloudSourceVersion({ ...ordinary, script: project, repo: project }, f.env, f),
      /Workers Builds; manual upload requires explicit recovery or diagnostic purpose/
    );
    assert.deepEqual(f.githubCalls, []);
    assert.deepEqual(f.cloudCalls, []);
    assert.deepEqual(f.uploads, []);
  });
}
test("manual recovery requires an explicit supported purpose", async () => {
  const f = fixture({ wranglerName: "field", writeScripts: "field" });
  await assert.rejects(
    uploadCloudSourceVersion({ ...args, script: "field", repo: "field", purpose: "production" }, f.env, f),
    /requires explicit recovery or diagnostic purpose/
  );
  assert.deepEqual(f.githubCalls, []);
  for (const purpose of ["recovery", "diagnostic"]) {
    const g = fixture({ wranglerName: "field", writeScripts: "field" });
    const result = await uploadCloudSourceVersion({ ...args, script: "field", repo: "field", purpose }, g.env, g);
    assert.equal(result.ok, true);
    assert.equal(g.uploads[0].metadata.annotations["workers/tag"], "relay-" + purpose + "-source-upload");
  }
});
