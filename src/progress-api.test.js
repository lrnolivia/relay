import test from "node:test";
import assert from "node:assert/strict";
import { queuedProgress, progressResponse, PROGRESS_CONTRACT_VERSION } from "./progress-api.js";

test("1.8 consumer contract keeps queued intent separate from observed progress", () => {
  const q = queuedProgress({id:"q",next_action:"later"});
  const response = progressResponse("relay", [], [q]);
  assert.equal(PROGRESS_CONTRACT_VERSION, "1.7.5");
  assert.equal(response.observed_progress, true);
  assert.equal(response.queue[0].observed, false);
});

import { createHash } from "node:crypto";
import { callProgress } from "./progress-api.js";
import {githubApiRequest} from './source.js';
function progressFixture(overrides = {}) {
  const record = Buffer.from(JSON.stringify({ claims: [], queue: [], legacy_branches: [], retained_evidence: "x".repeat(1024 * 1024) }));
  const sha = createHash("sha1").update(`blob ${record.length}\0`).update(record).digest("hex");
  const registration = Buffer.from(JSON.stringify({ repository: "lrnolivia/relay", coordination: { record: "coordination/relay.json" } }));
  const calls = [];
  const api = async path => {
    calls.push(path);
    if (path.includes("/contents/projects/")) return { type: "file", encoding: "base64", sha: "a".repeat(40), content: registration.toString("base64") };
    if (path.includes("/contents/coordination/")) return { type: "file", encoding: "none", sha, size: record.length, ...overrides.file };
    if (path.includes("/git/blobs/")) return { sha, size: record.length, encoding: "base64", content: record.toString("base64"), ...overrides.blob };
    if (path.includes("/branches?") || path.includes("/pulls?")) return [];
    throw new Error("Unexpected path " + path);
  };
  return { api, calls, sha };
}
test("live progress resolves the exact large ledger blob rather than reporting an incomplete file", async () => {
  const fixture = progressFixture();
  const result = await callProgress({ project: "relay" }, {}, fixture.api);
  assert.equal(result.observed_progress, true);
  assert.deepEqual(result.progress, []);
  assert.deepEqual(fixture.calls.filter(path => path.includes('/git/blobs/')), [`/repos/lrnolivia/relay/git/blobs/${fixture.sha}`]);
});
test("progress rejects a substituted immutable blob", async () => {
  const fixture = progressFixture({ blob: { content: Buffer.from('{}').toString('base64') } });
  await assert.rejects(callProgress({ project: "relay" }, {}, fixture.api), /identity verification failed/);
});
test("progress refuses oversized or truncated ledgers without fetching arbitrary bytes", async () => {
  for (const file of [{ size: 8 * 1024 * 1024 + 1 }, { truncated: true }]) {
    const fixture = progressFixture({ file });
    await assert.rejects(callProgress({ project: "relay" }, {}, fixture.api), /incomplete/);
    assert.equal(fixture.calls.some(path => path.includes('/git/blobs/')), false);
  }
});

test('current progress paths reduce twenty concurrent display reads from140 resource calls to45, retaining exact large-ledger integrity',async t=>{
  const count=20,head='a'.repeat(40),claims=Array.from({length:count},(_,i)=>({id:'assignment-'+i,branch:'branch-'+i,owner:'fixture',state:'active',goal:'Synthetic scope',next_action:'later'}));
  const record=Buffer.from(JSON.stringify({claims,queue:[],legacy_branches:[],padding:'x'.repeat(1024*1024)}));
  const sha=createHash('sha1').update(`blob ${record.length}\0`).update(record).digest('hex');
  const reg=Buffer.from(JSON.stringify({repository:'lrnolivia/fanout-fixture',coordination:{record:'coordination/relay.json'}}));
  let network=0;
  const valueFor=path=>{
    if(path.includes('/contents/projects/'))return {type:'file',encoding:'base64',sha:'b'.repeat(40),content:reg.toString('base64')};
    if(path.includes('/contents/coordination/'))return {type:'file',encoding:'none',sha,size:record.length};
    if(path.includes('/git/blobs/'))return {sha,size:record.length,encoding:'base64',content:record.toString('base64')};
    if(path.includes('/branches?'))return claims.map((c,i)=>({name:c.branch,commit:{sha:i.toString(16).padStart(40,'0')}}));
    if(path.includes('/pulls?'))return [];
    if(path.includes('/check-runs?'))return {check_runs:[]};
    if(path.includes('/commits/'))return {sha:head,commit:{committer:{date:'2026-10-07T00:00:00Z'}}};
    throw Error('Unexpected fixture route '+path);
  };
  const direct=async path=>{network++;return valueFor(path);};
  await Promise.all(claims.map(c=>callProgress({project:'relay',assignment:c.id},{},direct)));assert.equal(network,140);network=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{network++;return Response.json(valueFor(String(url).replace('https://api.github.com','')),{headers:{ETag:'"fixture"','x-ratelimit-limit':'5000','x-ratelimit-remaining':'4000','x-ratelimit-reset':'2000000000','x-ratelimit-resource':'core'}});});
  const env={RELAY_GITHUB_TOKEN:'synthetic-fanout-credential'};
  const results=await Promise.all(claims.map(c=>callProgress({project:'relay',assignment:c.id,display_cache:true},env)));
  assert.equal(network,45);assert.equal(results.length,20);assert.ok(results.every(r=>r.progress.length===1));assert.ok(results.every(r=>r.github_reads.network_observed));
  assert.equal(results.reduce((sum,r)=>sum+r.github_reads.network_requests,0),45);assert.equal(results.reduce((sum,r)=>sum+r.github_reads.logical_requests,0),140);
  await Promise.all(claims.map(c=>callProgress({project:'relay',assignment:c.id,display_cache:true},env)));assert.equal(network,45);
  const fresh=await callProgress({project:'relay',assignment:claims[0].id},env);assert.equal(network,52);assert.equal(fresh.github_reads.mode,'upstream-revalidated');
});
