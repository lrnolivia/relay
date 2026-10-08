import { githubApiRequest } from "./source.js";
import { cloudWriteScripts, deployCloudVersion, cloudWorkerSummary, recoverCloudVersion, activeCloudVersion, retainedCloudVersion, cloudBuilds, cloudflareApiRequest } from "./cloud.js";
import { guardAutonomy, autonomyRequest, validateAutonomyInput } from './autonomy-control.js';

const PROJECT = /^[a-z0-9-]{1,80}$/;
const decode = content => Buffer.from(String(content || "").replace(/\s/g, ""), "base64").toString("utf8");

function validateRegistration(value, project) {
  if (!value || value.id !== project || value.managed !== true) throw new Error("Invalid managed project registration");
  const cloud = value.cloud;
  if (!cloud) return null;
  if (cloud.provider !== "cloudflare" || typeof cloud.worker !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$/.test(cloud.worker) || typeof cloud.write !== "boolean") {
    throw new Error("Invalid project Cloud registration");
  }
  if (cloud.transport !== undefined && !["workers-builds", "manual"].includes(cloud.transport)) throw new Error("Invalid project Cloud transport");
  if (cloud.manual_upload !== undefined && !["allowed", "recovery-only", "disabled"].includes(cloud.manual_upload)) throw new Error("Invalid project manual upload policy");
  if (cloud.production_branch !== undefined && (typeof cloud.production_branch !== "string" || !cloud.production_branch)) throw new Error("Invalid project production branch");
  if (cloud.build_command !== undefined && typeof cloud.build_command !== "string") throw new Error("Invalid project build command");
  if (cloud.deploy_command !== undefined && typeof cloud.deploy_command !== "string") throw new Error("Invalid project deploy command");
  return cloud;
}

export async function projectCloudStatus(env, project, apiOverride) {
  if (!PROJECT.test(project || "")) throw new Error("Invalid project");
  const api = apiOverride || ((path, options) => githubApiRequest(env, path, options));
  const controlRepository = String(env?.RELAY_RUNNER_CONTROL_REPOSITORY || "lrnolivia/relay");
  const file = await api(`/repos/${controlRepository}/contents/projects/${project}.json?ref=main`);
  if (file?.type !== "file" || file.encoding !== "base64" || file.truncated) throw new Error("Project registration is incomplete");
  const registration = JSON.parse(decode(file.content));
  const cloud = validateRegistration(registration, project);
  const runtimeAllowed = Boolean(cloud?.worker && cloudWriteScripts(env).includes(cloud.worker));
  return {
    ok: true,
    namespace: "relay.CLOUD",
    project,
    repository: registration.repository,
    provider: cloud?.provider || null,
    worker: cloud?.worker || null,
    transport: cloud?.transport || "manual",
    production_branch: cloud?.production_branch || registration.default_branch || "main",
    build_command: cloud?.build_command || null,
    deploy_command: cloud?.deploy_command || null,
    manual_upload: cloud?.manual_upload || "allowed",
    rollback: cloud?.rollback || null,
    project_write: cloud?.write === true,
    runtime_allowlisted: runtimeAllowed,
    writable: Boolean(cloud?.write === true && runtimeAllowed),
    authorization: "project-registration+runtime-allowlist"
  };
}

function rollbackProfile(status){
  const profile=status.rollback;
  if(!status.writable||!profile||!profile.compatibility_id||!profile.source_header||!profile.compatibility_header)throw Error('Project has no proven compatible Worker recovery profile');
  for(const key of ['identity_url','health_url']){
    const url=new URL(profile[key]);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.loew.fi')||url.username||url.password||url.port)throw Error('Invalid registered recovery endpoint');
  }
  if(new URL(profile.health_url).hostname!==new URL(profile.identity_url).hostname)throw Error('Recovery health must use the same bound Worker hostname');
  return profile;
}

export async function verifyReleaseTarget(env,status,target,deps={}){
  const profile=rollbackProfile(status);
  if(target.worker!==status.worker||target.compatibility_id!==profile.compatibility_id)throw Error('Release target does not match registered Worker compatibility');
  const snapshot=await (deps.snapshot||((worker)=>cloudWorkerSummary(env,worker)))(status.worker);
  const active=(Array.isArray(snapshot.deployments)?snapshot.deployments:snapshot.deployments?.deployments)?.[0];
  const versions=Array.isArray(snapshot.versions)?snapshot.versions:snapshot.versions?.items;
  if(active?.versions?.length!==1||active.versions[0].version_id!==target.version_id||active.versions[0].percentage!==100)throw Error('Target is not the retained exact active version at 100%');
  if(!versions?.some(v=>v.id===target.version_id)){
    const retained=await (deps.retained||((worker,version)=>retainedCloudVersion(env,worker,version)))(status.worker,target.version_id);
    if(retained?.id!==target.version_id)throw Error('Target is not a retained exact Worker version');
  }
  const host=new URL(profile.identity_url).hostname;
  if(!snapshot.domains?.some(d=>d.service===status.worker&&d.hostname===host&&d.enabled!==false))throw Error('Recovery endpoint is not bound to this Worker');
  const request=deps.fetch||fetch;
  if(!deps.fetch&&!deps.accessJwt)throw Error('Authenticated release verification identity is required');
  // Workers supports manual/follow, not the Node/browser redirect:error mode.
  // Manual preserves the exact endpoint; all redirects fail the checks below.
  const options={redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(10000),...(deps.accessJwt?{headers:{'Cf-Access-Token':deps.accessJwt}}:{})};
  const identity=await request(profile.identity_url,options);
  if(!identity.ok||identity.redirected||identity.headers.get(profile.source_header)!==target.source_sha||identity.headers.get(profile.compatibility_header)!==profile.compatibility_id)throw Error('Production source or recovery compatibility identity does not match');
  await identity.body?.cancel();
  const health=await request(profile.health_url,{...options,signal:AbortSignal.timeout(10000)});
  if(!health.ok||health.redirected)throw Error('Production critical health endpoint failed');
  const body=await health.json();
  if(body.ok!==true||body.service!==status.worker)throw Error('Production critical health endpoint failed');
  const after=await (deps.active||((worker)=>activeCloudVersion(env,worker)))(status.worker);
  if(after.version_id!==target.version_id)throw Error('Deployment changed during production verification');
  return {version_id:target.version_id,source_sha:target.source_sha,deployment_id:after.deployment_id,health_url:profile.health_url};
}

// A human may approve a retained release after a newer deployment. Bind that
// approval to provider deployment output and its actual production CI gates.
// Fresh live verification still governs healthy promotion and every rollback.
export async function verifyApprovedTarget(env,status,target,deps={}){
  const profile=rollbackProfile(status);
  if(target.worker!==status.worker||target.compatibility_id!==profile.compatibility_id)throw Error('Release target does not match registered Worker compatibility');
  const snapshot=await (deps.snapshot||((worker)=>cloudWorkerSummary(env,worker)))(status.worker);
  const active=(Array.isArray(snapshot.deployments)?snapshot.deployments:snapshot.deployments?.deployments)?.[0];
  if(active?.versions?.length===1&&active.versions[0].version_id===target.version_id&&active.versions[0].percentage===100)
    return verifyReleaseTarget(env,status,target,{...deps,snapshot:async()=>snapshot});
  const retained=await (deps.retained||((worker,version)=>retainedCloudVersion(env,worker,version)))(status.worker,target.version_id);
  if(retained?.id!==target.version_id)throw Error('Requested approved version is not retained');
  const hostname=new URL(profile.identity_url).hostname;
  if(!snapshot.domains?.some(d=>d.service===status.worker&&d.hostname===hostname&&d.enabled!==false))throw Error('Recovery endpoint is not bound to this Worker');
  const history=await (deps.builds||((worker)=>cloudBuilds(env,worker)))(status.worker);
  const builds=(Array.isArray(history)?history:history?.builds||[]).filter(b=>b.build_outcome==='success'&&b.build_trigger_metadata?.commit_hash===target.source_sha&&b.build_trigger_metadata.branch===status.production_branch&&b.build_trigger_metadata.deploy_command===status.deploy_command);
  if(builds.length!==1)throw Error('Historical approval requires one exact successful canonical provider build');
  const build=builds[0];
  if(!/^[a-f0-9-]{36}$/.test(build.build_uuid||''))throw Error('Invalid provider build identity');
  const ids=new Set(),cursors=new Set();let cursor,complete=false,bytes=0;
  for(let page=0;page<6;page++){
    const logs=await (deps.buildLogs||((id,after)=>cloudflareApiRequest(env,'/accounts/'+env.CLOUDFLARE_ACCOUNT_ID+'/builds/builds/'+id+'/logs'+(after?'?cursor='+encodeURIComponent(after):''),{token:env.CLOUDFLARE_BUILDS_API_TOKEN})))(build.build_uuid,cursor);
    if(!Array.isArray(logs?.lines)||logs.truncated===true)throw Error('Provider deployment evidence is incomplete');
    // Completed Builds returns its final cursor again with an empty page.
    if(logs.lines.length===0&&(!logs.cursor||logs.cursor===cursor)){complete=true;break;}
    for(const row of logs.lines){
      if(!Array.isArray(row)||typeof row[1]!=='string')throw Error('Invalid provider deployment evidence');
      bytes+=new TextEncoder().encode(row[1]).byteLength;if(bytes>524288)throw Error('Provider deployment evidence exceeds limit');
      for(const match of row[1].replace(/\x1b\[[0-9;]*m/g,'').matchAll(/Current Version ID:\s*([a-f0-9-]{36})/g))ids.add(match[1]);
    }
    cursor=logs.cursor;if(!cursor){complete=true;break;}
    if(typeof cursor!=='string'||cursor.length>4096||cursors.has(cursor))throw Error('Invalid provider deployment evidence cursor');cursors.add(cursor);
  }
  if(!complete||ids.size!==1||!ids.has(target.version_id))throw Error('Provider build does not prove this exact retained version');
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(status.repository||''))throw Error('Invalid registered source repository');
  const api=(path)=>githubApiRequest(env,path),root='/repos/'+status.repository;
  const file=await (deps.sourceProfile||(()=>api(root+'/contents/projects/'+status.project+'.json?ref='+target.source_sha)))();
  if(file?.type!=='file'||file.encoding!=='base64'||file.truncated)throw Error('Historical source profile is incomplete');
  const historic=validateRegistration(JSON.parse(decode(file.content)),status.project);
  if(historic?.worker!==status.worker||historic.rollback?.compatibility_id!==profile.compatibility_id)throw Error('Historical source recovery compatibility is not established');
  const checks=await (deps.checks||(()=>api(root+'/commits/'+target.source_sha+'/check-runs?per_page=100')))();
  if(checks.total_count>checks.check_runs?.length)throw Error('Historical production checks are incomplete');
  const quality=checks.check_runs?.filter(c=>c.name==='quality'&&c.app?.slug==='github-actions').sort((a,b)=>b.id-a.id)[0];
  if(quality?.head_sha!==target.source_sha||quality.status!=='completed'||quality.conclusion!=='success')throw Error('Exact historical production quality did not pass');
  const prefix='https://github.com/'+status.repository+'/actions/runs/';
  const jobId=quality.html_url?.startsWith(prefix)&&/^\d+\/job\/([0-9]+)$/.exec(quality.html_url.slice(prefix.length))?.[1];
  if(!jobId)throw Error('Historical production job identity is missing');
  const job=await (deps.job||((id)=>api(root+'/actions/jobs/'+id)))(jobId);
  if(job.head_sha!==target.source_sha||job.conclusion!=='success'||!['Verify exact live source and capture actual website pages','Retain and verify exact interactive sample build'].every(name=>job.steps?.some(s=>s.name===name&&s.conclusion==='success')))throw Error('Historical production and retained-build verification did not pass');
  return {version_id:target.version_id,source_sha:target.source_sha,build_id:build.build_uuid,production_job_id:jobId,currently_active:false,verification:'retained-provider-deployment+exact-source-production-ci'};
}

export async function callAutonomyControl(env,input,deps={}){
  const rollback=input?.action==='rollback';
  const prepared=rollback?{...input,action:'prepare_rollback'}:input;
  validateAutonomyInput(prepared);
  if(!['status','hold','resume','healthy','approve','rollback'].includes(input.action))throw Error('Unsupported operator safety action');
  if(['status','hold','resume'].includes(input.action))return autonomyRequest(env,input);
  if(input.operation_id.length>110)throw Error('Release operation identity exceeds 110 characters');
  const status=await projectCloudStatus(env,input.scope,deps.github);
  if(rollback){
    await autonomyRequest(env,{action:'hold',scope:input.scope,expected_revision:input.expected_revision,
      operation_id:input.operation_id+'-hold',reason:input.reason});
    prepared.expected_revision=input.expected_revision+1;
  }
  const profile=rollbackProfile(status);
  if(!rollback){
    const proof=await (input.action==='approve'?verifyApprovedTarget:verifyReleaseTarget)(env,status,input.target,deps);
    const result=await autonomyRequest(env,input);
    return {...result,verified_release:proof};
  }
  const {state}=await autonomyRequest(env,{action:'status',scope:input.scope});
  if(state.rollback?.operation_id===input.operation_id&&state.rollback.state==='verified'){
    await autonomyRequest(env,prepared);
    const proof=await verifyReleaseTarget(env,status,state.rollback.target,deps);
    return {ok:true,state,duplicate:true,verified_release:proof};
  }
  const target=state.rollback?.operation_id===input.operation_id?state.rollback.target:input.kind==='healthy'?state.last_healthy:state.last_user_approved;
  if(!target)throw Error('Requested rollback target is missing; no substitute is allowed');
  if(target.compatibility_id!==profile.compatibility_id||state.last_healthy?.compatibility_id!==profile.compatibility_id)throw Error('Rollback data/configuration compatibility is not established');
  await autonomyRequest(env,prepared);
  const recover=deps.recover||((scope,operation)=>recoverCloudVersion(env,scope,operation));
  const receipt=await recover(input.scope,input.operation_id);
  // An uncertain provider response deliberately leaves the pending operation held.
  const proof=await verifyReleaseTarget(env,status,target,deps);
  const latest=(await autonomyRequest(env,{action:'status',scope:input.scope})).state;
  const result=await autonomyRequest(env,{action:'finish_rollback',scope:input.scope,expected_revision:latest.revision,
    operation_id:input.operation_id+'-finish',reason:input.reason,result:{state:'verified',version_id:target.version_id,evidence:JSON.stringify(proof)}});
  return {...result,recovery:receipt,verified_release:proof};
}

export async function deployProjectCloudVersion(env, project, versionId, message, deps = {}) {
  await guardAutonomy(env, [project]);
  const status = await projectCloudStatus(env, project, deps.github);
  if (!status.worker) throw new Error(`Project ${project} has no Cloudflare Worker registration`);
  if (!status.project_write) throw new Error(`Project ${project} does not authorize Cloud writes`);
  if (!status.runtime_allowlisted) throw new Error(`Project ${project} Worker is not in Relay's runtime write allowlist`);
  const deploy = deps.deploy || ((worker, version, note) => deployCloudVersion(env, worker, version, note));
  const result = await deploy(status.worker, versionId, message);
  return { ...result, project, authorization: status.authorization };
}
