const REVIEW_PREFIX = "reviews/human-qa/";
const QUESTION_ANSWERS = new Set(["yes", "no", "not_sure"]);
const OVERALL_VERDICTS = new Set(["looks_good", "needs_work", "not_sure"]);
const REVIEW_DISPOSITIONS = new Set(["pending", "completed", "stale", "archived"]);

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function isSafeLoewUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "loew.fi" || url.hostname.endsWith(".loew.fi"));
  } catch {
    return false;
  }
}

function question(id, prompt, reason) {
  return { id, prompt, reason, answers: ["yes", "no", "not_sure"] };
}

export function qaQuestionsForEvidence(record = {}) {
  const questions = [];
  const step = String(record.step_label || record.step_id || "").trim();
  const surface = String(record.context?.surface || "").trim();
  const environment = String(record.context?.environment || "unknown").trim();
  const width = Number(record.viewport?.width || 0);

  const stepKey = step.toLowerCase();
  if (stepKey.includes("focus")) {
    questions.push(question(
      "focus-clear",
      "Does Focus view keep the work area clear and distraction-free?",
      "This capture specifically exercises the Focus layout."
    ));
  } else if (stepKey.includes("float")) {
    questions.push(question(
      "float-placement",
      "Do the floating controls stay out of your way while still being easy to find?",
      "This capture specifically exercises the Float layout."
    ));
  } else if (stepKey.includes("full")) {
    questions.push(question(
      "full-balance",
      "Does Full view feel balanced, with nothing important cut off or awkwardly crowded?",
      "This capture specifically exercises the Full layout."
    ));
  } else if (stepKey.includes("first paint")) {
    questions.push(question(
      "first-paint-ready",
      "When this screen first appears, does it look ready and stable rather than broken or unfinished?",
      "This is the first-paint capture."
    ));
  } else {
    questions.push(question(
      "intent",
      `Does ${step || surface || "this screen"} look like what you intended?`,
      "Runner needs your visual judgment, not another automated check."
    ));
  }

  const failedAssertions = (Array.isArray(record.assertions) ? record.assertions : [])
    .filter(item => item?.status === "fail")
    .slice(0, 2);

  failedAssertions.forEach((item, index) => {
    const detail = String(item.detail || item.id || "an automated check").trim();
    questions.push(question(
      `assertion-${index + 1}`,
      `Inspector flagged “${detail}”. Can you see a real problem in the screen?`,
      "An automated QA assertion failed, so Runner is asking for a human call."
    ));
  });

  if (width > 0 && width <= 480) {
    questions.push(question(
      "mobile-fit",
      "On this phone-size view, is anything cramped, clipped, or hard to tap?",
      "The capture uses a narrow mobile viewport."
    ));
  } else if (surface === "editor") {
    questions.push(question(
      "editor-orientation",
      "Can you immediately tell where to work and what the main action is?",
      "This is an editor surface, where orientation matters more than implementation detail."
    ));
  }

  if (environment === "preview") {
    questions.push(question(
      "preview-ready",
      "Would you be comfortable moving this preview forward based on what you see here?",
      "This evidence came from a preview environment."
    ));
  }

  return questions.slice(0, 4);
}

export function normalizeQaReview(input = {}, questions = [], now = new Date().toISOString()) {
  const allowedIds = new Set(questions.map(item => item.id));
  const rawAnswers = input.answers && typeof input.answers === "object" && !Array.isArray(input.answers)
    ? input.answers
    : {};
  const answers = {};

  for (const [id, value] of Object.entries(rawAnswers)) {
    if (!allowedIds.has(id)) continue;
    if (!QUESTION_ANSWERS.has(value)) throw badRequest("Invalid QA answer.");
    answers[id] = value;
  }

  const overall = input.overall == null || input.overall === ""
    ? null
    : String(input.overall);
  if (overall && !OVERALL_VERDICTS.has(overall)) throw badRequest("Invalid QA verdict.");

  const notes = input.notes == null ? "" : String(input.notes);
  if (notes.length > 6000) throw badRequest("QA notes must be 6000 characters or fewer.");

  const disposition = input.disposition == null || input.disposition === ""
    ? null
    : String(input.disposition);
  if (disposition && !REVIEW_DISPOSITIONS.has(disposition)) throw badRequest("Invalid QA disposition.");

  return {
    schema: 1,
    overall,
    answers,
    notes,
    disposition,
    updated_at: now
  };
}

function reviewKey(evidenceId) {
  return REVIEW_PREFIX + evidenceId + ".json";
}

export async function getQaReview(bucket, evidenceId) {
  if (!bucket?.get) throw new Error("Visual evidence R2 binding unavailable.");
  const object = await bucket.get(reviewKey(evidenceId));
  if (!object) return null;
  try { return await object.json(); }
  catch { return null; }
}

export async function saveQaReview(bucket, evidenceId, input, evidence) {
  if (!bucket?.put) throw new Error("Visual evidence R2 binding unavailable.");
  const questions = qaQuestionsForEvidence(evidence);
  const previous = await getQaReview(bucket, evidenceId);
  const hasDisposition = Object.prototype.hasOwnProperty.call(input || {}, "disposition");
  const normalized = normalizeQaReview({
    ...(input || {}),
    disposition: hasDisposition ? input.disposition : (previous?.disposition || null)
  }, questions);
  const previousDisposition = previous?.disposition || null;
  const review = {
    evidence_id: evidenceId,
    ...normalized,
    disposition_updated_at:
      normalized.disposition === previousDisposition
        ? (previous?.disposition_updated_at || null)
        : normalized.updated_at
  };
  await bucket.put(reviewKey(evidenceId), JSON.stringify(review), {
    httpMetadata: { contentType: "application/json" }
  });
  return review;
}

function parseFrameAncestors(csp) {
  const match = String(csp || "").match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i);
  return match ? match[1].trim().split(/\s+/).filter(Boolean) : null;
}

function sourceAllowsRunner(source, target, runner) {
  if (source === "*") return true;
  if (source === "'none'") return false;
  if (source === "'self'") return target.origin === runner.origin;
  if (source === "https:") return runner.protocol === "https:";
  if (source === runner.origin) return true;
  if (source === "https://*.loew.fi") return runner.protocol === "https:" && runner.hostname.endsWith(".loew.fi");
  return false;
}

export function frameEmbeddingPolicy(headers, targetUrl, runnerUrl) {
  const target = new URL(targetUrl);
  const runner = new URL(runnerUrl);
  const xfo = String(headers?.get?.("x-frame-options") || "").trim().toLowerCase();

  if (xfo.includes("deny")) {
    return { embeddable: false, reason: "The preview blocks embedding with X-Frame-Options: DENY." };
  }
  if (xfo.includes("sameorigin") && target.origin !== runner.origin) {
    return { embeddable: false, reason: "The preview only allows same-origin frames." };
  }

  const ancestors = parseFrameAncestors(headers?.get?.("content-security-policy"));
  if (ancestors && !ancestors.some(source => sourceAllowsRunner(source, target, runner))) {
    return { embeddable: false, reason: "The preview Content-Security-Policy does not allow Runner to frame it." };
  }

  return { embeddable: true, reason: null };
}

async function probe(url, fetcher) {
  let current = new URL(url);
  for (let redirects = 0; redirects < 4; redirects += 1) {
    let response = await fetcher(current.toString(), { method: "HEAD", redirect: "manual" });
    if (response.status === 405) {
      response = await fetcher(current.toString(), { method: "GET", redirect: "manual" });
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, url: current };
      const next = new URL(location, current);
      if (!isSafeLoewUrl(next.toString())) {
        return { response, url: current, unsafeRedirect: true };
      }
      current = next;
      continue;
    }

    return { response, url: current };
  }
  return { response: null, url: current, redirectLimit: true };
}

export async function inspectLivePreview(evidence, runnerUrl, fetcher = fetch) {
  const target = evidence?.target_url;
  if (!isSafeLoewUrl(target)) {
    return {
      active: false,
      embeddable: false,
      status: null,
      url: null,
      reason: "No safe loew.fi preview URL is attached to this evidence.",
      checked_at: new Date().toISOString()
    };
  }

  try {
    const result = await probe(target, fetcher);
    if (!result.response) {
      return {
        active: false,
        embeddable: false,
        status: null,
        url: result.url.toString(),
        reason: "The preview redirected too many times.",
        checked_at: new Date().toISOString()
      };
    }

    if (result.unsafeRedirect) {
      return {
        active: false,
        embeddable: false,
        status: result.response.status,
        url: result.url.toString(),
        reason: "The preview redirected outside loew.fi, so Runner will not open it.",
        checked_at: new Date().toISOString()
      };
    }

    const active = result.response.status >= 200 && result.response.status < 400;
    const framing = active
      ? frameEmbeddingPolicy(result.response.headers, result.url.toString(), runnerUrl)
      : { embeddable: false, reason: `The preview returned HTTP ${result.response.status}.` };

    return {
      active,
      embeddable: active && framing.embeddable,
      status: result.response.status,
      url: result.url.toString(),
      reason: framing.reason,
      checked_at: new Date().toISOString()
    };
  } catch (error) {
    return {
      active: false,
      embeddable: false,
      status: null,
      url: target,
      reason: error?.message || "The preview could not be reached.",
      checked_at: new Date().toISOString()
    };
  }
}
