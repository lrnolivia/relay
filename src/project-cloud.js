import { githubApiRequest } from "./source.js";
import { cloudWriteScripts, deployCloudVersion, cloudWorkerSummary, recoverCloudVersion, activeCloudVersion, retainedCloudVersion } from "./cloud.js";
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
  // Workers supports manual/follow, not the Node/browser redirect:error mode.
  // Manual preserves the exact endpoint; all redirects fail the checks below.
  const options={redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(10000)};
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
    const proof=await verifyReleaseTarget(env,status,input.target,deps);
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
