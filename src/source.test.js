import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from 'node:crypto';
import { sourceAuthStatus, githubApiRequest, readSourceChecks, readBoundedJobLog, readSourceTree, SOURCE_TREE_LIMITS, syncIdenticalSourceBranch } from "./source.js";

test("relay.SOURCE status prefers GitHub App auth", () => {
  assert.equal(sourceAuthStatus({}).auth_mode, "public_read");
  assert.equal(sourceAuthStatus({ RELAY_GITHUB_TOKEN: "x" }).auth_mode, "legacy_token");
  const app = sourceAuthStatus({ RELAY_GITHUB_APP_ID: "1", RELAY_GITHUB_APP_PRIVATE_KEY: "pem" });
  assert.equal(app.auth_mode, "github_app");
  assert.equal(app.write_enabled, true);
  assert.equal(app.legacy_token_configured, false);
});

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const appEnv = { RELAY_GITHUB_APP_ID: 'synthetic', RELAY_GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
let fixtureNumber = 0;
function githubFixture(t, config = {}) {
  const repo = 'synthetic-transport-' + (++fixtureNumber);
  const installationId=123+fixtureNumber;
  const path = `/repos/lrnolivia/${repo}/git/ref/heads/fixture%2Fabsent`;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const endpoint = String(url).replace('https://api.github.com', '');
    const authenticated = Boolean(options.headers.Authorization);
    calls.push({ endpoint, method: options.method, authenticated });
    if (endpoint.endsWith('/installation')) return Response.json({ id: installationId }, { status: config.discoveryStatus || 200 });
    if (endpoint === '/app/installations/'+installationId+'/access_tokens') return Response.json({ token: 'synthetic-token', expires_at: '2099-01-01T00:00:00Z' }, { status: config.mintStatus || 200 });
    if (endpoint.split('?')[0] === path) {
      if (config.timeout) throw Object.assign(new Error('Synthetic timeout with private text'), { name: 'TimeoutError' });
      return Response.json({ message: 'Synthetic provider-private-text', object: { sha: 'a'.repeat(40) } },
        { status: authenticated ? config.status || 404 : config.publicStatus || 200, headers: config.headers });
    }
    throw new Error('Unexpected mocked path');
  });
  return { path, calls };
}

test('authenticated resource404 remains authoritative without identity fallback, including cached tokens', async t => {
  const f = githubFixture(t, { status: 404, publicStatus: 403 });
  for (let i = 0; i < 2; i++) await assert.rejects(githubApiRequest({ ...appEnv, RELAY_GITHUB_TOKEN: 'synthetic-unused-legacy' }, f.path), error =>
    error.status === 404 && error.github.phase === 'resource_request' && error.github.auth_mode === 'github_app_installation');
  assert.equal(f.calls.filter(x => x.endpoint === f.path).length, 2);
  assert.equal(f.calls.filter(x => x.endpoint.endsWith('/installation')).length, 1);
  assert.equal(f.calls.some(x => !x.authenticated), false);
});

test('authenticated denial, rate limit, outage and timeout never switch identity', async t => {
  for (const status of [401, 403, 429, 500]) {
    const f = githubFixture(t, { status });
    await assert.rejects(githubApiRequest(appEnv, f.path), error => error.status === status);
    assert.equal(f.calls.filter(x => x.endpoint === f.path).length, 1);
    assert.equal(f.calls.some(x => !x.authenticated), false);
  }
  const f = githubFixture(t, { timeout: true });
  await assert.rejects(githubApiRequest(appEnv, f.path), error => error.name === 'TimeoutError' && error.github.phase === 'resource_request');
  assert.equal(f.calls.some(x => !x.authenticated), false);
});

test('real transport preserves authenticated304 bytes and captures successful quota headers',async t=>{
  const endpoint='/repos/fixture/conditional/get',env={RELAY_GITHUB_TOKEN:'synthetic-etag-credential'};let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(String(url),'https://api.github.com'+endpoint);assert.equal(options.headers.Authorization,'Bearer synthetic-etag-credential');calls++;
    if(calls===1){assert.equal(options.headers['If-None-Match'],undefined);return Response.json({revision:7},{headers:{ETag:'"v7"','x-ratelimit-limit':'5000','x-ratelimit-used':'22','x-ratelimit-remaining':'4978','x-ratelimit-reset':'2000000000','x-ratelimit-resource':'core'}});}
    assert.equal(options.headers['If-None-Match'],'"v7"');return new Response(null,{status:304,headers:{'x-ratelimit-remaining':'4978'}});
  });
  const first=await githubApiRequest(env,endpoint),second=await githubApiRequest(env,endpoint);
  assert.deepEqual(second,first);assert.equal(calls,2);assert.ok(sourceAuthStatus(env).read_transport.not_modified>0);
  assert.doesNotMatch(JSON.stringify(sourceAuthStatus(env).read_transport),/synthetic-etag-credential|revision/);
});
test('cold concurrent installation reads mint one token and coalesce explicit display requests',async t=>{
  const repo='cold-display-'+(++fixtureNumber),endpoint='/repos/lrnolivia/'+repo+'/branches';const calls=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const path=String(url).replace('https://api.github.com','');calls.push(path);
    if(path.endsWith('/installation'))return Response.json({id:900000+fixtureNumber});
    if(path.endsWith('/access_tokens'))return Response.json({token:'synthetic-display-token',expires_at:'2099-01-01T00:00:00Z'});
    assert.equal(path,endpoint);return Response.json([{name:'main'}],{headers:{ETag:'"branches"'}});
  });
  const results=await Promise.all(Array.from({length:20},()=>githubApiRequest(appEnv,endpoint,{readCache:'display'})));
  assert.equal(results.length,20);assert.equal(calls.filter(p=>p.endsWith('/installation')).length,1);assert.equal(calls.filter(p=>p.endsWith('/access_tokens')).length,1);assert.equal(calls.filter(p=>p===endpoint).length,1);
});

test('ordinary uninstalled-repository discovery retains public reads while guarded lookups fail closed', async t => {
  const publicRead = githubFixture(t, { discoveryStatus: 404 });
  assert.equal((await githubApiRequest(appEnv, publicRead.path)).object.sha, 'a'.repeat(40));
  assert.equal(publicRead.calls.at(-1).authenticated, false);
  const guarded = githubFixture(t, { discoveryStatus: 404 });
  await assert.rejects(githubApiRequest(appEnv, guarded.path, { requireAuthenticated: true }), error =>
    error.status === 404 && error.github.phase === 'installation_discovery');
  assert.equal(guarded.calls.length, 1);
  const write = githubFixture(t, { discoveryStatus: 404 });
  await assert.rejects(githubApiRequest(appEnv, write.path, { method: 'POST', body: {} }));
  assert.equal(write.calls.length, 1);
});

test('token-mint failures cannot fall back or establish branch absence', async t => {
  for (const mintStatus of [404, 403]) {
    const f = githubFixture(t, { mintStatus });
    await assert.rejects(githubApiRequest(appEnv, f.path), error => error.status === mintStatus && error.github.phase === 'token_mint');
    assert.equal(f.calls.some(x => x.endpoint === f.path), false);
    assert.equal(f.calls.some(x => !x.authenticated), false);
  }
});

test('legacy authenticated404 is preserved and no-credential guarded lookup makes zero requests', async t => {
  const legacy = githubFixture(t, { status: 404 });
  await assert.rejects(githubApiRequest({ RELAY_GITHUB_TOKEN: 'synthetic-legacy-token' }, legacy.path, { requireAuthenticated: true }), error =>
    error.status === 404 && error.github.auth_mode === 'legacy_token');
  assert.equal(legacy.calls.length, 1); assert.equal(legacy.calls[0].authenticated, true);
  const empty = githubFixture(t);
  await assert.rejects(githubApiRequest({}, empty.path, { requireAuthenticated: true }), error => error.code === 'auth');
  assert.equal(empty.calls.length, 0);
});

test('upstream rate-limit provenance is explicit while provider payloads stay out of diagnostics', async t => {
  const f = githubFixture(t, { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1790900000', 'retry-after': '60' } });
  await assert.rejects(githubApiRequest(appEnv, f.path + '?sensitive-query=hidden'), error => {
    assert.equal(error.code, 'rate_limit'); assert.equal(error.github.status, 403);
    assert.equal(error.github.rate_limit_remaining, 0); assert.equal(error.github.retry_after_seconds, 60);
    assert.equal(error.github.endpoint.includes('?'), false);
    assert.equal(JSON.stringify(error.github).includes('hidden'), false);
    return true;
  });
});

test('source batches retain executable modes and safely default new files',async t=>{
 const {commitSourceFiles}=await import('./source.js');let submitted;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  const path=String(url).replace('https://api.github.com','');const method=options.method||'GET';
  if(path==='/repos/owner/repo')return Response.json({default_branch:'main'});
  if(path.endsWith('/git/ref/heads/work'))return Response.json({object:{sha:'a'.repeat(40)}});
  if(path.endsWith('/git/commits/'+'a'.repeat(40)))return Response.json({tree:{sha:'b'.repeat(40)}});
  if(path.endsWith('/git/trees/'+'b'.repeat(40)))return Response.json({tree:[{path:'scripts',type:'tree',mode:'040000',sha:'c'.repeat(40)}]});
  if(path.endsWith('/git/trees/'+'c'.repeat(40)))return Response.json({tree:[{path:'run.sh',type:'blob',mode:'100755',sha:'d'.repeat(40)}]});
  if(path.endsWith('/git/blobs'))return Response.json({sha:'e'.repeat(40)});
  if(path.endsWith('/git/trees')&&method==='POST'){submitted=JSON.parse(options.body);return Response.json({sha:'f'.repeat(40)});}
  if(path.endsWith('/git/commits'))return Response.json({sha:'1'.repeat(40)});
  if(path.endsWith('/git/refs/heads/work'))return Response.json({object:{sha:'1'.repeat(40)}});
  throw Error('Unexpected fixture path '+path);
 });
 await commitSourceFiles({RELAY_GITHUB_TOKEN:'synthetic-test-token'},{owner:'owner',repo:'repo',branch:'work',expectedHeadSha:'a'.repeat(40),message:'test',files:[{path:'scripts/run.sh',content:'#!/bin/sh\ntrue\n'},{path:'scripts/new.txt',content:'new'}]});
 assert.deepEqual(submitted.tree.map(x=>[x.path,x.mode]),[['scripts/run.sh','100755'],['scripts/new.txt','100644']]);
});
test('source batches reject symlink replacement before creating remote objects',async t=>{
 const {commitSourceFiles}=await import('./source.js');let writes=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  const path=String(url).replace('https://api.github.com','');if(options.method&&options.method!=='GET')writes++;
  if(path==='/repos/owner/repo')return Response.json({default_branch:'main'});
  if(path.includes('/git/ref/'))return Response.json({object:{sha:'a'.repeat(40)}});
  if(path.includes('/git/commits/'))return Response.json({tree:{sha:'b'.repeat(40)}});
  if(path.includes('/git/trees/'))return Response.json({tree:[{path:'linked',type:'blob',mode:'120000',sha:'c'.repeat(40)}]});
  throw Error('Unexpected fixture path');
 });
 await assert.rejects(commitSourceFiles({RELAY_GITHUB_TOKEN:'synthetic-test-token'},{owner:'owner',repo:'repo',branch:'work',message:'test',files:[{path:'linked',content:'replacement'}]}),/symlinks or submodules/);
 assert.equal(writes,0);
});

test("source checks expose bounded failure annotations without querying successful jobs", async () => {
  const routes=[];
  const checks=await readSourceChecks({}, "lrnolivia", "rtxForge", "main", async route => {
    routes.push(route);
    return route.includes("/annotations?")
      ? [{path:"workflow",start_line:1,end_line:1,annotation_level:"failure",message:"Packaging failed"}]
      : {total_count:2,check_runs:[{id:42,conclusion:"failure",output:{annotations_count:1}},{id:43,conclusion:"success"}]};
  });
  assert.equal(routes.length,2);
  assert.equal(routes[1],"/repos/lrnolivia/rtxForge/check-runs/42/annotations?per_page=50");
  assert.equal(checks.check_runs[0].failure_details.annotations[0].message,"Packaging failed");
  assert.equal(checks.check_runs[1].failure_details,undefined);
});
test("annotation read failure never fabricates successful diagnostic evidence", async () => {
  const checks=await readSourceChecks({}, "lrnolivia", "rtxForge", "main", async route => {
    if(route.includes("/annotations?"))throw new Error("unavailable");
    return {check_runs:[{id:42,conclusion:"failure"}]};
  });
  assert.equal(checks.check_runs[0].conclusion,"failure");
  assert.equal(checks.check_runs[0].failure_details.available,false);
});
test("source check annotations remain bounded and report incomplete coverage", async () => {
  let calls=0;
  const checks=await readSourceChecks({}, "lrnolivia", "rtxForge", "main", async route => {
    calls++;
    return route.includes("/annotations?")?[{message:"x".repeat(9000)}]:
      {check_runs:Array.from({length:7},(_,id)=>({id:id+1,conclusion:"failure",output:{annotations_count:75}}))};
  });
  assert.equal(calls,6);
  assert.equal(checks.failure_details_truncated,true);
  assert.equal(checks.check_runs[0].failure_details.truncated,true);
  assert.equal(checks.check_runs[0].failure_details.annotations[0].message.length,8000);
});

test("job log diagnostics extract failure context with bounded output", async()=>{
 const r=await readBoundedJobLog(new Response("setup\nstart\nTraceback: missing module\nModuleNotFoundError: absent\nexit code 2\ncleanup\n"));
 assert.equal(r.available,true);assert.match(r.excerpt,/ModuleNotFoundError/);assert.equal(r.truncated,false);
});
test("source checks read only the matching repository job",async()=>{
 const routes=[];
 const checks=await readSourceChecks({}, "lrnolivia","rtxForge","main", async (route,options)=>{
  routes.push(route);
  if(route.endsWith("/logs")){assert.equal(options.jobLog,true);return {available:true,excerpt:"failed build"};}
  if(route.includes("/actions/jobs/"))return {id:77,steps:[{name:"Build",conclusion:"failure"}]};
  if(route.includes("/annotations?"))return [];
  return {check_runs:[{id:1,conclusion:"failure",html_url:"https://github.com/lrnolivia/rtxForge/actions/runs/22/job/77"},
   {id:2,conclusion:"failure",html_url:"https://github.com/other/private/actions/runs/22/job/88"}]};
 });
 assert.equal(checks.check_runs[0].failure_details.job.steps[0].name,"Build");
 assert.equal(checks.check_runs[0].failure_details.log.excerpt,"failed build");
 assert.equal(routes.some(path=>path.includes("/88")),false);
});

test("identical-tree synchronization preserves files and uses a non-force ancestry commit", async()=>{
 const head="a".repeat(40),base="b".repeat(40),tree="c".repeat(40),next="d".repeat(40),writes=[];
 let current=head;
 const result=await syncIdenticalSourceBranch({}, {owner:"lrnolivia",repo:"rtxForge",branch:"rtxforge/work",expectedHeadSha:head,expectedBaseSha:base},async(path,options)=>{
  if(options?.method){writes.push({path,...options});if(options.method==="POST"){assert.equal(options.body.tree,tree);assert.deepEqual(options.body.parents,[head,base]);return {sha:next};}assert.equal(options.body.force,false);current=next;return {};}
  if(path.endsWith("/rtxForge"))return {default_branch:"main"};
  if(path.includes("/git/commits/"))return {tree:{sha:tree}};
  return {object:{sha:path.endsWith("/heads/main")?base:current}};
 });
 assert.equal(result.files_changed,false);assert.equal(result.head_sha,next);assert.equal(writes.length,2);
});
test("different-tree synchronization refuses to overwrite pending changes",async()=>{
 let writes=0;
 await assert.rejects(syncIdenticalSourceBranch({}, {owner:"lrnolivia",repo:"rtxForge",branch:"rtxforge/work",expectedHeadSha:"a".repeat(40),expectedBaseSha:"b".repeat(40)},async(path,options)=>{
  if(options?.method){writes++;throw Error("Unexpected write");}
  if(path.endsWith("/rtxForge"))return {default_branch:"main"};
  if(path.includes("/git/commits/"))return {tree:{sha:(path.endsWith("a".repeat(40))?"c":"d").repeat(40)}};
  return {object:{sha:(path.endsWith("/heads/main")?"b":"a").repeat(40)}};
 }),/Trees differ/);
 assert.equal(writes,0);
});
test("default branch synchronization is prohibited",async()=>{
 await assert.rejects(syncIdenticalSourceBranch({}, {owner:"lrnolivia",repo:"rtxForge",branch:"main",expectedHeadSha:"a".repeat(40),expectedBaseSha:"b".repeat(40)},async()=>({default_branch:"main"})),/prohibited/);
});

test("job diagnostics retain the terminal failure after noisy expected test errors",async()=>{const noise=Array.from({length:250},(_,i)=>`expected fixture failure ${i}\nfixture passed`).join("\n");const r=await readBoundedJobLog(new Response(noise+"\nPublish release\nERROR: cannot update release asset\nProcess completed with exit code 1\ncleanup complete"));assert.match(r.excerpt,/cannot update release asset/);assert.ok(r.excerpt.length<=24000)});

const manifestCommit = 'a'.repeat(40), manifestTree = 'b'.repeat(40);
const manifestArgs = { owner: 'lrnolivia', repo: 'manifest-fixture', commitSha: manifestCommit };
const manifestEntry = (path, mode='100644', type='blob') => ({path,mode,type,sha:'c'.repeat(40),url:'https://api.example/ignored',content:'must-not-leak'});
function manifestFixture(entries, {truncated=false, commit={}, tree={}}={}) {
 const calls=[];
 const api=async(path,options)=>{
  calls.push({path,options});assert.equal(options.requireAuthenticated,true);assert.equal(options.maxResponseBytes,SOURCE_TREE_LIMITS.response_bytes);assert.equal(options.method,undefined);
  if(path.endsWith('/git/commits/'+manifestCommit))return {sha:manifestCommit,tree:{sha:manifestTree},...commit};
  assert.equal(path,'/repos/lrnolivia/manifest-fixture/git/trees/'+manifestTree+'?recursive=1');return {sha:manifestTree,truncated,tree:entries,...tree};
 };
 return {api,calls};
}
test('source tree returns exact immutable metadata with stable bounded pages and no file contents',async()=>{
 const entries=[manifestEntry('z.test.js'),manifestEntry('a'),manifestEntry('folder','040000','tree'),manifestEntry('folder/run','100755'),manifestEntry('link','120000'),manifestEntry('module','160000','commit')];
 const f=manifestFixture(entries);const all=[];let cursor,first;let offset=0;
 do{
  const page=await readSourceTree({}, {...manifestArgs,limit:2,...(cursor?{cursor}:{})},f.api);first ||= page;
  assert.equal(page.repository,'lrnolivia/manifest-fixture');assert.equal(page.commit_sha,manifestCommit);assert.equal(page.tree_sha,manifestTree);
  assert.equal(page.manifest_complete,true);assert.equal(page.truncated,false);assert.equal(page.page_offset,offset);assert.equal(page.returned_entry_count,2);
  assert.equal(page.manifest_sha256,first.manifest_sha256);assert.equal(page.observed_entry_count,6);
  assert.doesNotMatch(JSON.stringify(page),/must-not-leak|api\.example/);
  for(const row of page.entries)assert.deepEqual(Object.keys(row),['path','mode','type','sha']);
  all.push(...page.entries);offset+=page.entries.length;cursor=page.next_cursor;
 }while(cursor);
 assert.deepEqual(all.map(x=>x.path),['a','folder','folder/run','link','module','z.test.js']);
 const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(JSON.stringify(all)).digest('hex'),first.manifest_sha256);
 assert.equal(f.calls.length,6);assert.equal(entries[0].path,'z.test.js','never mutate the provider object');
});
test('empty and provider-truncated manifests remain distinct from complete delivered source',async()=>{
 let f=manifestFixture([]),page=await readSourceTree({},manifestArgs,f.api);assert.equal(page.observed_entry_count,0);assert.equal(page.manifest_complete,true);assert.equal(page.next_cursor,null);
 f=manifestFixture([manifestEntry('partial.test.js')],{truncated:true});page=await readSourceTree({},manifestArgs,f.api);
 assert.equal(page.ok,true);assert.equal(page.manifest_complete,false);assert.equal(page.truncated,true);assert.match(page.incomplete_reason,/not a complete repository manifest/);assert.equal(page.next_cursor,null);assert.match(page.recovery,/do not prove source bytes/);
});
test('source manifest refuses branch refs, invalid paging and repository traversal before any request',async()=>{
 for(const args of [{...manifestArgs,commitSha:'main'},{...manifestArgs,repo:'..'},{...manifestArgs,owner:'else/where'},{...manifestArgs,limit:0},{...manifestArgs,limit:501},{...manifestArgs,limit:'2'},{...manifestArgs,cursor:'not!base64'},{...manifestArgs,extra:true}]){
  let calls=0;await assert.rejects(readSourceTree({},args,async()=>{calls++;}),error=>error.code==='validation');assert.equal(calls,0);
 }
});
test('source manifest cursor cannot cross repository, commit, tree, digest or range',async()=>{
 const f=manifestFixture([manifestEntry('a'),manifestEntry('b'),manifestEntry('c')]);const first=await readSourceTree({}, {...manifestArgs,limit:1},f.api);const raw=JSON.parse(Buffer.from(first.next_cursor,'base64url').toString());
 for(const change of [{repository:'lrnolivia/other'},{commit_sha:'d'.repeat(40)},{tree_sha:'d'.repeat(40)},{manifest_sha256:'d'.repeat(64)},{offset:3},{offset:-1},{offset:1.5},{unexpected:true}]){
  const cursor=Buffer.from(JSON.stringify({...raw,...change})).toString('base64url');await assert.rejects(readSourceTree({}, {...manifestArgs,cursor},f.api),error=>error.code==='validation');
 }
 const changed=manifestFixture([manifestEntry('a'),manifestEntry('changed'),manifestEntry('c')]);await assert.rejects(readSourceTree({}, {...manifestArgs,cursor:first.next_cursor},changed.api),/exact manifest/);
});
test('source manifest rejects unverifiable identities, malformed entries and ambiguous completeness',async()=>{
 for(const f of [manifestFixture([],{commit:{sha:'d'.repeat(40)}}),manifestFixture([],{tree:{sha:'d'.repeat(40)}}),manifestFixture([],{tree:{truncated:undefined}}),manifestFixture([manifestEntry('x'),manifestEntry('x')]),manifestFixture([manifestEntry('../x')]),manifestFixture([manifestEntry('/absolute')]),manifestFixture([manifestEntry('folder//x')]),manifestFixture([manifestEntry('bad\0name')]),manifestFixture([manifestEntry('bad','100644','tree')]),manifestFixture([{...manifestEntry('bad'),sha:'main'}])])await assert.rejects(readSourceTree({},manifestArgs,f.api),error=>error.code==='provider');
});
test('source manifest limits entries and page bytes without dropping an entry or inventing completeness',async()=>{
 const tooMany=manifestFixture(Array.from({length:SOURCE_TREE_LIMITS.entries+1},(_,i)=>manifestEntry(String(i))));await assert.rejects(readSourceTree({},manifestArgs,tooMany.api),error=>error.code==='capacity');
 const entries=Array.from({length:80},(_,i)=>manifestEntry(String(i).padStart(3,'0')+'x'.repeat(4000))),f=manifestFixture(entries);let cursor,seen=0;
 do {const page=await readSourceTree({}, {...manifestArgs,limit:500,...(cursor?{cursor}:{})},f.api);assert.ok(Buffer.byteLength(JSON.stringify(page.entries))<=SOURCE_TREE_LIMITS.page_bytes);assert.ok(page.entries.length>0);seen+=page.entries.length;cursor=page.next_cursor;}while(cursor);
 assert.equal(seen,80);
});
test('source manifest requires existing authenticated transport and preserves provider denials',async t=>{
 let external=0;t.mock.method(globalThis,'fetch',async()=>{external++;throw Error('No external request expected');});
 await assert.rejects(readSourceTree({},manifestArgs),/Authenticated GitHub transport/);assert.equal(external,0);
 for(const status of [401,403,404,429,500]){
  const expected=Object.assign(new Error('synthetic denial'),{status});let calls=0;
  await assert.rejects(readSourceTree({},manifestArgs,async()=>{calls++;throw expected;}),error=>error===expected);assert.equal(calls,1);
 }
});
test('bounded manifest transport cancels oversized streams without changing ordinary reads',async t=>{
 let cancelled=false;
 t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"too_large":true}'));},cancel(){cancelled=true;}})));
 await assert.rejects(githubApiRequest({RELAY_GITHUB_TOKEN:'synthetic-manifest-limit'},'/repos/lrnolivia/manifest-limit/git/trees/'+manifestTree,{requireAuthenticated:true,maxResponseBytes:8}),error=>error.code==='capacity'&&error.github.method==='GET');assert.equal(cancelled,true);
});
test('bounded manifest transport validates size headers and exact-cap successful JSON',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('{"ok":true}',{headers:{'content-length':'100'}}));
 await assert.rejects(githubApiRequest({RELAY_GITHUB_TOKEN:'synthetic-manifest-header'},'/repos/lrnolivia/manifest-header/git/trees/'+manifestTree,{requireAuthenticated:true,maxResponseBytes:20}),error=>error.code==='capacity');
 t.mock.method(globalThis,'fetch',async()=>new Response('{"ok":true}'));
 assert.deepEqual(await githubApiRequest({RELAY_GITHUB_TOKEN:'synthetic-manifest-exact'},'/repos/lrnolivia/manifest-exact/git/trees/'+manifestTree,{requireAuthenticated:true,maxResponseBytes:11}),{ok:true});
});
