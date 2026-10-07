import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectAuthority, readJsonFile } from "../src/cloudflare-worker.mjs";
import worker from '../src/cloudflare-worker.mjs';

test("managed project authority is distinct from the read-only automation target", () => {
  const config = {
    id: "field",
    target: {
      repository: "lrnolivia/field",
      branch: "main",
      write_mode: "read_only"
    }
  };
  const projectFile = {
    sha: "project-sha",
    value: {
      id: "field",
      repository: "lrnolivia/field",
      managed: true,
      default_branch: "main",
      implementation: {
        branch_prefixes: ["field/"],
        draft_pr_required: true
      },
      coordination: {
        status: "enabled",
        record: "coordination/field.json",
        max_active_branches: 4
      }
    }
  };
  const coordinationFile = {
    sha: "coordination-sha",
    value: {
      project: "field",
      claims: [
        { id: "active", state: "active" },
        { id: "held", state: "held" },
        { id: "done", state: "completed" }
      ],
      queue: [{ id: "queued", state: "queued" }]
    }
  };

  const authority = buildProjectAuthority(config, projectFile, coordinationFile);

  assert.equal(config.target.write_mode, "read_only");
  assert.equal(authority.automation_target_role, "observation_only");
  assert.equal(authority.repository, "lrnolivia/field");
  assert.equal(authority.default_branch, "main");
  assert.equal(authority.write_authority.mode, "managed_coordination");
  assert.equal(authority.write_authority.enabled, true);
  assert.equal(authority.write_authority.direct_default_branch_writes, false);
  assert.deepEqual(authority.write_authority.branch_prefixes, ["field/"]);
  assert.equal(authority.write_authority.draft_pr_required, true);
  assert.equal(authority.coordination.record, "coordination/field.json");
  assert.equal(authority.coordination.record_sha, "coordination-sha");
  assert.equal(authority.coordination.active_or_held_claims, 2);
  assert.equal(authority.coordination.queued_assignments, 1);
});

test("unmanaged or mismatched projects do not become authority", () => {
  const config = { id: "field", target: { write_mode: "read_only" } };
  assert.equal(buildProjectAuthority(config, { value: { id: "field", managed: false } }, null), null);
  assert.equal(buildProjectAuthority(config, { value: { id: "other", managed: true } }, null), null);
});

test("browser project metadata reads the exact large ledger blob", async () => {
  const value = {project:"relay",claims:[{id:"current",state:"active"}],padding:"x".repeat(1024*1024)};
  const bytes = Buffer.from(JSON.stringify(value));
  const sha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  const calls=[];
  const file = await readJsonFile({}, "coordination/relay.json", async route => {
    calls.push(route);
    if(route.includes("/contents/"))return {type:"file",encoding:"none",sha,size:bytes.length};
    assert.equal(route, `/repos/lrnolivia/relay/git/blobs/${sha}`);
    return {encoding:"base64",sha,size:bytes.length,content:bytes.toString("base64")};
  });
  assert.equal(file.sha,sha);
  assert.equal(file.value.claims[0].id,"current");
  assert.equal(calls.length,2);
});
test("browser metadata refuses a substituted large ledger blob", async () => {
  const bytes=Buffer.from('{"project":"relay"}'),sha=createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  await assert.rejects(readJsonFile({}, "coordination/relay.json", async route => route.includes("/contents/")
    ? {type:"file",encoding:"none",sha,size:bytes.length}
    : {encoding:"base64",sha,size:bytes.length,content:Buffer.from('{"project":"other"}').toString("base64")}),/identity verification failed/);
});
test('browser quota errors expose the actual retry deadline and block repeated upstream reads, preserving Runner identity',async t=>{
  const reset=Math.floor(Date.now()/1000)+120;let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer synthetic-worker-quota');return Response.json({message:'API rate limit exceeded'},{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':String(reset),'x-ratelimit-resource':'core'}});});
  const env={RUNNER_GITHUB_TOKEN:'synthetic-worker-quota',RELAY_GITHUB_TOKEN:'synthetic-unused-other',RELAY_GITHUB_APP_ID:'configured-but-not-selected',RELAY_GITHUB_APP_PRIVATE_KEY:'not-used'};
  const request=()=>new Request('https://relay.loew.fi/api/projects',{headers:{'Cf-Access-Jwt-Assertion':'synthetic-authenticated-fixture'}});
  const first=await worker.fetch(request(),env);assert.equal(first.status,403);assert.equal((await first.json()).retry_at,new Date(reset*1000).toISOString());assert.ok(Number(first.headers.get('Retry-After'))>0);
  const second=await worker.fetch(request(),env);assert.equal((await second.json()).code,'rate_limit');assert.equal(calls,1);
});
test('browser permission403 is distinct from quota and Access rejection performs no GitHub call',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({message:'Resource not accessible by integration'},{status:403});});
  const env={RELAY_GITHUB_TOKEN:'synthetic-worker-permission'};
  const response=await worker.fetch(new Request('https://relay.loew.fi/api/projects',{headers:{'Cf-Access-Jwt-Assertion':'synthetic-authenticated-fixture'}}),env);
  const body=await response.json();assert.equal(response.status,403);assert.equal(body.code,undefined);assert.equal(body.retry_at,undefined);assert.equal(calls,1);
  const locked=await worker.fetch(new Request('https://relay.loew.fi/api/projects'),env);assert.equal(locked.status,403);assert.equal(calls,1);
});
