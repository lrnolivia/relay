import { readRunnerFile } from '../../../src/runner-control-core.js';
import { executionBrowser } from './execution-browser.mjs';
import { nightShiftBrowser } from './night-shift-browser.mjs';
import { handleFeedbackBrowser, feedbackBindingForEvidence } from '../../../src/feedback-browser.js';
import { handleRetainedPreview, getRetainedBundle, retainedMetadata } from "../../../src/retained-preview.js";
import { githubApiRequest, sourceAuthStatus } from "../../../src/source.js";
import { callProgress } from "../../../src/progress-api.js";
import { projectIcon } from "./project-icons.mjs";
import { applyWorkerSettings, publicWorkerSettings } from "./settings.mjs";
import { listVisualEvidence, getVisualEvidence, getVisualImage, compareVisualEvidence, listVisualRuns, reviewVisualRun } from "./visual-evidence.mjs";
import { getQaReview, saveQaReview, qaQuestionsForEvidence, inspectLivePreview } from "./human-qa.mjs";
import { reviewBatch } from "./work-review.mjs";
import { workerSource } from "../../shared-ui/work-view-model.js";
import { recordQaFeedback } from "./qa-feedback.mjs";
const OWNER = "lrnolivia";
const REPOSITORY = "relay";
const BRANCH = "main";

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function accessGuard(request, env, authenticatedMcp = false) {
  if (authenticatedMcp) return null;
  if (String(env.REQUIRE_ACCESS ?? "true") === "false") return null;
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (assertion) return null;
  return json({
    error: "Cloudflare Access is not protecting this request. Controls remain locked until Access is active on this hostname."
  }, 403);
}

function humanQaGuard(request, authenticatedMcp = false) {
  if (authenticatedMcp) return null;
  if (request.headers.get("Cf-Access-Jwt-Assertion")) return null;
  return json({ error: "Human QA is available only through the Access-protected Runner." }, 403);
}

function tokenGuard(env) {
  if (env.RUNNER_GITHUB_TOKEN || sourceAuthStatus(env).write_enabled) return null;
  return json({
    error: "Relay GitHub App authentication is not configured."
  }, 503);
}

async function githubRequest(env, path, options = {}) {
  // Preserve this handler's existing explicit Runner-token selection while
  // sharing the bounded reader, conditional requests and quota classification.
  const selected=env.RUNNER_GITHUB_TOKEN?{...env,RELAY_GITHUB_APP_ID:undefined,RELAY_GITHUB_APP_PRIVATE_KEY:undefined,RELAY_GITHUB_TOKEN:env.RUNNER_GITHUB_TOKEN}:env;
  return githubApiRequest(selected, path, {
    ...options,
    body: typeof options.body === "string" ? JSON.parse(options.body) : options.body
  });
}

function decodeBase64Utf8(value) {
  const binary = atob(String(value).replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function safeWorkerId(value) {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(value ?? "");
}

export async function readJsonFile(env, path, api = route => githubRequest(env, route)) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const file = await readRunnerFile(api, `/repos/${OWNER}/${REPOSITORY}`, encoded, BRANCH);
  return { sha: file.sha, value: JSON.parse(file.content) };
}

async function writeJsonFile(env, path, value, sha, message) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return githubRequest(env, `/repos/${OWNER}/${REPOSITORY}/contents/${encoded}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: encodeBase64Utf8(`${JSON.stringify(value, null, 2)}\n`),
      sha,
      branch: BRANCH
    })
  });
}

async function listWorkerIds(env) {
  const data = await githubRequest(
    env,
    `/repos/${OWNER}/${REPOSITORY}/contents/workers?ref=${encodeURIComponent(BRANCH)}`
  );
  if (!Array.isArray(data)) throw new Error("workers/ is not a repository directory.");
  return data
    .filter((entry) => entry.type === "file" && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -5))
    .filter(safeWorkerId)
    .sort();
}

export function buildProjectAuthority(config, projectFile, coordinationFile) {
  const project = projectFile?.value;
  if (!project || project.id !== config.id || project.managed !== true) return null;

  const coordination = coordinationFile?.value;
  const coordinationEnabled =
    project.coordination?.status === "enabled" &&
    project.coordination?.record &&
    coordination?.project === project.id;

  return {
    kind: "managed_project",
    source: `projects/${project.id}.json`,
    project: project.id,
    repository: project.repository,
    default_branch: project.default_branch,
    automation_target_role: "observation_only",
    write_authority: {
      mode: coordinationEnabled ? "managed_coordination" : "read_only",
      enabled: Boolean(coordinationEnabled),
      direct_default_branch_writes: false,
      branch_prefixes: project.implementation?.branch_prefixes ?? [],
      draft_pr_required: Boolean(project.implementation?.draft_pr_required)
    },
    coordination: coordinationEnabled
      ? {
          status: "enabled",
          record: project.coordination.record,
          record_sha: coordinationFile.sha,
          max_active_branches: project.coordination.max_active_branches ?? null,
          active_or_held_claims: Array.isArray(coordination.claims)
            ? coordination.claims.filter((claim) => ["active", "held"].includes(claim.state)).length
            : null,
          queued_assignments: Array.isArray(coordination.queue) ? coordination.queue.length : null
        }
      : {
          status: project.coordination?.status ?? "unavailable",
          record: project.coordination?.record ?? null,
          record_sha: null,
          max_active_branches: project.coordination?.max_active_branches ?? null,
          active_or_held_claims: null,
          queued_assignments: null
        }
  };
}

async function projectAuthorityView(env, id, config) {
  try {
    const projectFile = await readJsonFile(env, `projects/${id}.json`);
    const recordPath = projectFile.value?.coordination?.record;
    const coordinationFile = recordPath ? await readJsonFile(env, recordPath) : null;
    return buildProjectAuthority(config, projectFile, coordinationFile);
  } catch {
    return null;
  }
}

async function workerView(env, id) {
  const [{ value: config }, { value: runtime }] = await Promise.all([
    readJsonFile(env, `workers/${id}.json`),
    readJsonFile(env, `state/${id}.json`)
  ]);
  const authority = await projectAuthorityView(env, id, config);
  return { ...config, target_role: "automation_observation", authority, runtime };
}

async function workersView(env) {
  const ids = await listWorkerIds(env);
  return Promise.all(ids.map((id) => workerView(env, id)));
}

async function readBody(request) {
  if (!request.body) return {};
  const text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 }); }
}

async function dispatchWorkflow(env, workflow, inputs = {}) {
  await githubRequest(
    env,
    `/repos/${OWNER}/${REPOSITORY}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: BRANCH, inputs })
    }
  );
  return { ok: true, workflow };
}

export async function handleApi(request, env, { authenticatedMcp = false } = {}) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true, service: "relay", subsystem: "runner", version: "0.6" });
  }

  const accessError = accessGuard(request, env, authenticatedMcp);
  if (accessError) return accessError;
  if (url.pathname.startsWith('/api/feedback/')) {
    const guard = humanQaGuard(request, authenticatedMcp); if (guard) return guard;
    return await handleFeedbackBrowser(request, env, { authenticated: true }) || json({ error: 'Feedback route not found' }, 404);
  }
  if(url.pathname.startsWith('/api/execution/')) {
    const guard=humanQaGuard(request,authenticatedMcp);if(guard)return guard;
    return executionBrowser(request,env,{authenticated:true});
  }
  if(url.pathname.startsWith('/api/night-shift/')) {
    const guard=humanQaGuard(request,authenticatedMcp);if(guard)return guard;
    return nightShiftBrowser(request,env,{authenticated:true});
  }
  if(url.pathname.startsWith('/api/retained-preview')) {
    const guard=humanQaGuard(request,authenticatedMcp);if(guard)return guard;
    return await handleRetainedPreview(request,env.EVIDENCE)||json({error:'Retained build route not found'},404);
  }

  if (request.method === "POST" && !authenticatedMcp) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return json({ error: "Cross-origin control writes are blocked." }, 403);
  }
  if (request.method === "POST" && url.pathname === "/api/work-review") {
    const guard=humanQaGuard(request,authenticatedMcp);
    if(guard) return guard;
    if(!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'JSON is required.'},415);
    const reader=request.body?.getReader(); let size=0, chunks=[];
    if(reader) while(true) {const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>131072){await reader.cancel();return json({error:'Review request exceeds 128 KiB.'},413);}chunks.push(part.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return json({error:'Invalid JSON.'},400);}
    const registrations=new Map(), progress=new Map();
    const registration=project=>{if(!registrations.has(project))registrations.set(project,readJsonFile(env,'projects/'+project+'.json'));return registrations.get(project);};
    // Validate registered identity for both reads and writes without touching source task state.
    if(!Array.isArray(input?.items) || input.items.length>100 || input.items.some(item=>!item || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(item.project||''))) return json({error:'Invalid review identities.'},400);
    for(const project of new Set(input.items.map(item=>item.project))) {const entry=await registration(project);if(entry.value.alias_of || entry.value.id!==project)return json({error:'Use a registered canonical project.'},400);}
    const resolveSource=async item=>{
      if(item.kind==='evidence'){const evidence=await getVisualEvidence(env.EVIDENCE,item.id);return evidence?.context?.project===item.project?evidence:null;}
      if(item.kind==='check'){if(item.id!==item.project)return null;return workerSource(await workerView(env,item.id));}
      const key=item.project+':'+item.id;
      if(!progress.has(key))progress.set(key,callProgress({project:item.project,assignment:item.id},env));
      const result=await progress.get(key);return result.progress?.find(source=>source.assignment===item.id)||null;
    };
    return json(await reviewBatch(env.EVIDENCE,input,resolveSource));
  }
  if (request.method === "GET" && url.pathname === "/api/projects") {
    const entries = await githubRequest(env, `/repos/${OWNER}/${REPOSITORY}/contents/projects?ref=main`);
    const projects = await Promise.all(entries.filter(item => item.type === "file" && item.name.endsWith(".json"))
      .map(item => readJsonFile(env, "projects/" + item.name)));
    return json({ projects: projects.map(item => item.value).filter(item => !item.alias_of) });
  }
  const progressMatch = url.pathname.match(/^\/api\/progress\/([a-zA-Z0-9._-]+)$/);
  if (request.method === "GET" && progressMatch) {
    const assignment = url.searchParams.get("assignment") || undefined;
    return json(await callProgress({ project: progressMatch[1], assignment, display_cache:true }, env));
  }

  const iconMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9._-]+)\/icon$/);
  if (request.method === "GET" && iconMatch) {
    const registration = await readJsonFile(env, "projects/" + iconMatch[1] + ".json");
    if (registration.value.alias_of) return json({ error: "Use the canonical project " + registration.value.alias_of }, 409);
    return json(await projectIcon(registration.value, path => githubRequest(env, path), env.RUNNER_GITHUB_TOKEN || env.RELAY_GITHUB_TOKEN || env.RELAY_GITHUB_APP_PRIVATE_KEY || "public-read"));
  }
  const projectMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9._-]+)$/);
  if (request.method === "GET" && projectMatch) {
    const registration = await readJsonFile(env, "projects/" + projectMatch[1] + ".json");
    const project = registration.value;
    if (project.alias_of) return json({ error: "Use the canonical project " + project.alias_of }, 409);
    const record = project.coordination?.record;
    const coordination = record ? await readJsonFile(env, record) : null;
    return json({ project, coordination: coordination?.value || null, record_sha: coordination?.sha || null });
  }

  if (request.method === "GET" && url.pathname === "/api/visual/runs") {
    return json(await listVisualRuns(env.EVIDENCE, 30, {
      project: url.searchParams.get("project"),
      environment: url.searchParams.get("environment"),
      pr: url.searchParams.get("pr")
    }));
  }

  const runReviewMatch = url.pathname.match(/^\/api\/visual\/runs\/(run_[a-zA-Z0-9._-]{8,128})\/review$/);
  if (request.method === "GET" && runReviewMatch) {
    const review = await reviewVisualRun(env.EVIDENCE, runReviewMatch[1]);
    return review ? json(review) : json({ error: "Evidence run not found." }, 404);
  }

  if (request.method === "GET" && url.pathname === "/api/visual") {
    return json(await listVisualEvidence(env.EVIDENCE, 60, {
      project: url.searchParams.get("project"),
      environment: url.searchParams.get("environment"),
      pr: url.searchParams.get("pr"),
      run: url.searchParams.get("run"),
      cursor: url.searchParams.get("cursor")
    }));
  }

  if (request.method === "GET" && url.pathname === "/api/visual/compare") {
    const comparison = await compareVisualEvidence(
      env.EVIDENCE,
      url.searchParams.get("base"),
      url.searchParams.get("current")
    );
    return comparison ? json(comparison) : json({ error: "Evidence comparison target not found." }, 404);
  }

  const qaMatch = url.pathname.match(/^\/api\/visual\/(vis_[a-zA-Z0-9-]{8,128})\/qa$/);
  if (qaMatch && (request.method === "GET" || request.method === "POST")) {
    const qaAccessError = humanQaGuard(request, authenticatedMcp);
    if (qaAccessError) return qaAccessError;
    const evidence = await getVisualEvidence(env.EVIDENCE, qaMatch[1]);
    if (!evidence) return json({ error: "Evidence not found." }, 404);
    const questions = qaQuestionsForEvidence(evidence);
    if (request.method === "GET") {
      const review = await getQaReview(env.EVIDENCE, qaMatch[1]);
      const feedback_binding = await feedbackBindingForEvidence(evidence, env);
      return json({ ok: true, evidence, questions, review, feedback_binding });
    }
    const input = await readBody(request);
    const review = await saveQaReview(env.EVIDENCE, qaMatch[1], input, evidence);
    const feedback = input.feedback_transport === 'schema2' ? { routed: false, reason: 'Explicit schema-2 submission follows save' } : await recordQaFeedback(env.EVIDENCE, evidence, review);
    return json({ ok: true, evidence_id: qaMatch[1], questions, review, feedback });
  }

  const liveMatch = url.pathname.match(/^\/api\/visual\/(vis_[a-zA-Z0-9-]{8,128})\/live$/);
  if (request.method === "GET" && liveMatch) {
    const qaAccessError = humanQaGuard(request, authenticatedMcp);
    if (qaAccessError) return qaAccessError;
    const evidence = await getVisualEvidence(env.EVIDENCE, liveMatch[1]);
    if (!evidence) return json({ error: "Evidence not found." }, 404);
    const retainedId=evidence.dom?.retained_preview?.id;
    if(typeof retainedId==='string'&&/^rp_[a-f0-9]{64}$/.test(retainedId)) {
      const retained=await getRetainedBundle(env.EVIDENCE,retainedId);
      if(retained&&retained.bundle.source_sha===evidence.context?.commit_sha)return json({ok:true,evidence_id:liveMatch[1],live:{active:false,embeddable:false,reason:'An exact retained build replaces the mutable live target for this capture.',retained:retainedMetadata(retained)}});
    }
    const live = await inspectLivePreview(evidence, url.origin);
    return json({ ok: true, evidence_id: liveMatch[1], live });
  }

  const visualMatch = url.pathname.match(/^\/api\/visual\/(vis_[a-zA-Z0-9-]+)(?:\/(image))?$/);
  if (request.method === "GET" && visualMatch) {
    const [, evidenceId, resource] = visualMatch;
    if (resource === "image") {
      const image = await getVisualImage(env.EVIDENCE, evidenceId);
      if (!image) return json({ error: "Evidence image not found." }, 404);
      return new Response(image.body, {
        headers: {
          "Content-Type": image.contentType || "image/png",
          "Cache-Control": "private, no-store",
          "Content-Length": String(image.size)
        }
      });
    }
    const evidence = await getVisualEvidence(env.EVIDENCE, evidenceId);
    return evidence ? json(evidence) : json({ error: "Evidence not found." }, 404);
  }

  const tokenError = tokenGuard(env);
  if (tokenError) return tokenError;

  if (request.method === "GET" && url.pathname === "/api/workers") {
    return json(await workersView(env));
  }

  const match = url.pathname.match(/^\/api\/workers\/([^/]+)\/(toggle|settings|run|doctor|repair)$/);
  if (!match || request.method !== "POST") return json({ error: "Not found" }, 404);

  const [, id, action] = match;
  if (!safeWorkerId(id)) return json({ error: "Invalid worker id." }, 400);

  if (action === "toggle") {
    const path = `workers/${id}.json`;
    const { value: config, sha } = await readJsonFile(env, path);
    const body = await readBody(request);
    config.enabled = typeof body.enabled === "boolean" ? body.enabled : !config.enabled;
    await writeJsonFile(
      env,
      path,
      config,
      sha,
      `dashboard: ${config.enabled ? "enable" : "pause"} ${id}`
    );
    return json({ ok: true, enabled: config.enabled });
  }

  if (action === "settings") {
    const path = `workers/${id}.json`;
    const { value: config, sha } = await readJsonFile(env, path);
    const body = await readBody(request);
    const next = applyWorkerSettings(config, body);
    await writeJsonFile(env, path, next, sha, `dashboard: update ${id} runner settings`);
    return json({ ok: true, settings: publicWorkerSettings(next) });
  }

  if (action === "run") {
    const { value: config } = await readJsonFile(env, `workers/${id}.json`);
    if (!config.enabled) return json({ error: "Enable this worker before running it." }, 409);
    return json(await dispatchWorkflow(env, "runner.yml", { worker_id: id }), 202);
  }

  if (id !== "field") {
    return json({ error: `No ${action} workflow is configured for this worker yet.` }, 404);
  }

  if (action === "doctor") {
    return json(await dispatchWorkflow(env, "field-dependency-doctor.yml"), 202);
  }

  const { value: state } = await readJsonFile(env, `state/${id}.json`);
  if (state.dependency_health !== "repairable" || state.dependency?.repair_verified !== true) {
    return json({
      error: "Repair unlocks only after Dependency Doctor verifies the package-lock repair through clean install and build."
    }, 409);
  }
  return json(await dispatchWorkflow(env, "field-dependency-repair.yml"), 202);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      const status = Number(error?.status) || 500;
      const limited=error?.code==='rate_limit';
      const reset=error?.github?.rate_limit_reset,delay=error?.github?.retry_after_seconds;
      const retryAt=error?.github?.retry_at||(Number.isSafeInteger(reset)?new Date(reset*1000).toISOString():Number.isSafeInteger(delay)?new Date(Date.now()+delay*1000).toISOString():null);
      return json({ error: error?.message ?? "Unexpected runner error.",...(limited?{code:'rate_limit',retry_at:retryAt}: {}) }, status,
        limited&&retryAt?{'Retry-After':String(Math.max(0,Math.ceil((Date.parse(retryAt)-Date.now())/1000)))}:{});
    }
  }
};
