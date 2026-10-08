import { guardRepository, autonomyRequest } from './autonomy-control.js';
const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const DEFAULT_WRITE_SCRIPTS = ["relay"];

function configured(env) {
  return Boolean(env?.CLOUDFLARE_ACCOUNT_ID && env?.CLOUDFLARE_API_TOKEN);
}

function buildsConfigured(env) {
  return Boolean(env?.CLOUDFLARE_ACCOUNT_ID && env?.CLOUDFLARE_BUILDS_API_TOKEN);
}

export function cloudWriteScripts(env) {
  const configuredList = String(env?.RELAY_CLOUDFLARE_WRITE_SCRIPTS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configuredList.length ? configuredList : DEFAULT_WRITE_SCRIPTS;
}

export function cloudStatus(env) {
  return {
    ok: true,
    namespace: "relay.CLOUD",
    configured: configured(env),
    account_configured: Boolean(env?.CLOUDFLARE_ACCOUNT_ID),
    token_configured: Boolean(env?.CLOUDFLARE_API_TOKEN),
    builds_configured: buildsConfigured(env),
    builds_token_configured: Boolean(env?.CLOUDFLARE_BUILDS_API_TOKEN),
    mutation_tools_exposed: true,
    authorization_mode: "project-registration+runtime-allowlist",
    write_scripts: cloudWriteScripts(env),
    required_bindings: configured(env) ? [] : [
      ...(!env?.CLOUDFLARE_ACCOUNT_ID ? ["CLOUDFLARE_ACCOUNT_ID"] : []),
      ...(!env?.CLOUDFLARE_API_TOKEN ? ["CLOUDFLARE_API_TOKEN"] : [])
    ],
    builds_required_bindings: buildsConfigured(env) ? [] : [
      ...(!env?.CLOUDFLARE_ACCOUNT_ID ? ["CLOUDFLARE_ACCOUNT_ID"] : []),
      ...(!env?.CLOUDFLARE_BUILDS_API_TOKEN ? ["CLOUDFLARE_BUILDS_API_TOKEN"] : [])
    ]
  };
}

function validateScriptName(value) {
  if (typeof value !== "string" || !/^[a-z0-9_][a-z0-9-_]{0,127}$/i.test(value)) {
    throw new Error("Invalid Cloudflare Worker script name");
  }
  return value;
}

function validateVersionId(value) {
  if (typeof value !== "string" || !/^[a-f0-9-]{32,40}$/i.test(value)) throw new Error("Invalid Worker version id");
  return value;
}

function assertWritable(env, script) {
  if (!cloudWriteScripts(env).includes(script)) throw new Error("relay.CLOUD writes are not allowed for " + script);
}

export async function cloudflareApiRequest(env, path, options = {}) {
  const token = options.token || env?.CLOUDFLARE_API_TOKEN;
  if (!env?.CLOUDFLARE_ACCOUNT_ID || !token) throw new Error("relay.CLOUD credentials are not configured");
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID);
  if (typeof path !== "string" || !path.startsWith("/accounts/" + accountId + "/") || path.includes("://")) {
    throw new Error("Invalid Cloudflare API path");
  }
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/json"
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(CLOUDFLARE_API + path, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    const message = body?.errors?.[0]?.message || ("Cloudflare request failed with " + response.status);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body?.result;
}

export async function listCloudScripts(env) {
  const id = String(env.CLOUDFLARE_ACCOUNT_ID);
  const result = await cloudflareApiRequest(env, "/accounts/" + id + "/workers/scripts");
  return Array.isArray(result) ? result : [];
}

async function scriptRecord(env, script) {
  const scripts = await listCloudScripts(env);
  return scripts.find((item) => item?.id === script || item?.name === script) || null;
}

export async function cloudWorkerSummary(env, scriptName) {
  const script = validateScriptName(scriptName);
  const id = String(env.CLOUDFLARE_ACCOUNT_ID);
  const [settings, deployments, versions, domains, record] = await Promise.all([
    cloudflareApiRequest(env, "/accounts/" + id + "/workers/scripts/" + encodeURIComponent(script) + "/settings"),
    cloudflareApiRequest(env, "/accounts/" + id + "/workers/scripts/" + encodeURIComponent(script) + "/deployments"),
    cloudflareApiRequest(env, "/accounts/" + id + "/workers/scripts/" + encodeURIComponent(script) + "/versions"),
    cloudflareApiRequest(env, "/accounts/" + id + "/workers/domains"),
    scriptRecord(env, script)
  ]);
  const allDomains = Array.isArray(domains) ? domains : domains?.items || [];
  return {
    ok: true,
    script,
    record,
    settings,
    deployments,
    versions,
    domains: allDomains.filter((item) => item?.service === script)
  };
}

export async function cloudBuilds(env, scriptName) {
  const script = validateScriptName(scriptName);
  if (!buildsConfigured(env)) throw new Error("relay.CLOUD Workers Builds credential is not configured");
  const id = String(env.CLOUDFLARE_ACCOUNT_ID);
  const record = await scriptRecord(env, script);
  const externalId = record?.tag || record?.id || script;
  return cloudflareApiRequest(
    env,
    "/accounts/" + id + "/builds/workers/" + encodeURIComponent(externalId) + "/builds",
    { token: env.CLOUDFLARE_BUILDS_API_TOKEN }
  );
}

export async function deployCloudVersion(env, scriptName, versionId, message) {
  const script = validateScriptName(scriptName);
  const version = validateVersionId(versionId);
  assertWritable(env, script);
  await guardRepository(env, script);
  const id = String(env.CLOUDFLARE_ACCOUNT_ID);
  const body = {
    strategy: "percentage",
    versions: [{ version_id: version, percentage: 100 }]
  };
  if (typeof message === "string" && message.trim()) {
    body.annotations = { "workers/message": message.trim().slice(0, 1000) };
  }
  const deployment = await cloudflareApiRequest(
    env,
    "/accounts/" + id + "/workers/scripts/" + encodeURIComponent(script) + "/deployments",
    { method: "POST", body }
  );
  return { ok: true, script, version_id: version, deployment };
}

export async function activeCloudVersion(env, scriptName) {
  const script=validateScriptName(scriptName);
  const result=await cloudflareApiRequest(env,'/accounts/'+env.CLOUDFLARE_ACCOUNT_ID+'/workers/scripts/'+encodeURIComponent(script)+'/deployments');
  const deployment=(Array.isArray(result)?result:result?.deployments)?.[0];
  if(deployment?.versions?.length!==1||deployment.versions[0].percentage!==100)throw Error('Recovery requires one exact active Worker version at 100%');
  return {version_id:validateVersionId(deployment.versions[0].version_id),deployment_id:deployment.id};
}

export async function retainedCloudVersion(env,scriptName,versionId){
  const script=validateScriptName(scriptName),version=validateVersionId(versionId);
  return cloudflareApiRequest(env,'/accounts/'+env.CLOUDFLARE_ACCOUNT_ID+'/workers/scripts/'+encodeURIComponent(script)+'/versions/'+version);
}

// This narrow recovery path has no caller-selected artifact or guard bypass flag.
// Its target comes only from the pending, durable, exact rollback operation.
export async function recoverCloudVersion(env,scope,operationId) {
  const read=async()=>{
    const {state}=await autonomyRequest(env,{action:'status',scope});
    if(!state.held||state.rollback?.state!=='pending'||state.rollback.operation_id!==operationId)throw Error('Exact held rollback operation is required');
    return state.rollback;
  };
  const pending=await read(),script=validateScriptName(pending.target.worker),version=validateVersionId(pending.target.version_id);
  assertWritable(env,script);
  const retained=await retainedCloudVersion(env,script,version);
  if(retained?.id!==version)throw Error('Retained rollback artifact identity changed');
  const active=await activeCloudVersion(env,script);
  if(active.version_id===version)return {ok:true,script,version_id:version,reconciled:true,deployment_id:active.deployment_id};
  if(active.version_id!==pending.expected_current_version)throw Error('Deployment changed; recovery must be reconciled before another write');
  const current=await read();
  if(JSON.stringify(current)!==JSON.stringify(pending))throw Error('Rollback intent changed before provider write');
  const deployment=await cloudflareApiRequest(env,'/accounts/'+env.CLOUDFLARE_ACCOUNT_ID+'/workers/scripts/'+encodeURIComponent(script)+'/deployments',{
    method:'POST',body:{strategy:'percentage',versions:[{version_id:version,percentage:100}],annotations:{'workers/message':'Relay bounded recovery '+operationId}}
  });
  return {ok:true,script,version_id:version,deployment};
}
