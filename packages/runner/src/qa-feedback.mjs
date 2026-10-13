const ROOT = "feedback/qa/";
const EVENT_LIMIT = 100;
const IDENTITY_FIELDS = ["project", "assignment", "owner", "branch"];

function text(value, max = 500) {
  return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;
}

function safeSegment(value) {
  const normalized = text(value, 240);
  return normalized && /^[a-zA-Z0-9._:-]+$/.test(normalized) ? normalized : null;
}

function pad(sequence) {
  return String(sequence).padStart(20, "0");
}

async function readJson(bucket, key) {
  const object = await bucket?.get?.(key);
  if (!object) return null;
  try { return await object.json(); }
  catch { return null; }
}

function identityFromEvidence(evidence = {}) {
  const context = evidence.context || {};
  return {
    project: safeSegment(context.project),
    assignment: safeSegment(context.assignment || context.assignment_id),
    owner: safeSegment(context.owner),
    branch: text(context.branch, 240),
    evidence_id: safeSegment(evidence.evidence_id),
    commit_sha: /^[a-f0-9]{40}$/i.test(context.commit_sha || "") ? context.commit_sha : null,
    pr: Number.isInteger(context.pr_number) && context.pr_number > 0 ? context.pr_number : null,
    deployment_id: text(context.deployment_id, 128)
  };
}

function reviewSnapshot(review = {}) {
  return {
    overall: review.overall || null,
    answers: review.answers && typeof review.answers === "object" ? review.answers : {},
    notes: typeof review.notes === "string" ? review.notes : "",
    disposition: review.disposition || null,
    updated_at: review.updated_at || null,
    disposition_updated_at: review.disposition_updated_at || null
  };
}

function stateKey(project) {
  return ROOT + project + "/state.json";
}

function eventPrefix(project) {
  return ROOT + project + "/events/";
}

function eventKey(project, sequence, evidenceId) {
  return eventPrefix(project) + pad(sequence) + "-" + evidenceId + ".json";
}

function ackKey(project, assignment, eventId) {
  return ROOT + project + "/acks/" + assignment + "/" + eventId + ".json";
}

function applicability(event, target) {
  const conflicts = [];
  const identity = event?.identity || {};
  for (const field of IDENTITY_FIELDS) {
    if (field === "project") {
      if (identity.project !== target.project) conflicts.push(field);
      continue;
    }
    if (field === "assignment") {
      if (!identity.assignment) conflicts.push("missing-assignment");
      else if (identity.assignment !== target.assignment) conflicts.push(field);
      continue;
    }
    if (field === "branch") {
      if (!identity.branch) conflicts.push("missing-branch");
      else if (identity.branch !== target.branch) conflicts.push(field);
      continue;
    }
    if (field === "owner" && identity.owner && target.owner && identity.owner !== target.owner) conflicts.push(field);
  }
  return { safe_to_apply: conflicts.length === 0, conflicts };
}

export async function recordQaFeedback(bucket, evidence, review, now = new Date().toISOString()) {
  if (!bucket?.get || !bucket?.put) throw new Error("Visual evidence R2 binding unavailable.");
  const identity = identityFromEvidence(evidence);
  if (!identity.project || !identity.evidence_id) throw new Error("QA feedback requires trusted project and evidence identity.");

  const key = stateKey(identity.project);
  const state = await readJson(bucket, key) || { schema: 1, last_sequence: 0 };
  const next = Math.max(Number(state.last_sequence || 0) + 1, Date.parse(now) || 1);
  const event = {
    schema: 1,
    event_id: "qaf_" + pad(next) + "_" + identity.evidence_id.slice(4, 16),
    sequence: next,
    created_at: now,
    identity,
    review: reviewSnapshot(review)
  };

  await bucket.put(eventKey(identity.project, next, identity.evidence_id), JSON.stringify(event), {
    httpMetadata: { contentType: "application/json" }
  });
  await bucket.put(key, JSON.stringify({ schema: 1, last_sequence: next, updated_at: now }), {
    httpMetadata: { contentType: "application/json" }
  });
  return event;
}

export async function listQaFeedback(bucket, target = {}) {
  if (!bucket?.list || !bucket?.get) return { available: false, events: [], conflicts: [] };
  const project = safeSegment(target.project);
  const assignment = safeSegment(target.assignment);
  const owner = safeSegment(target.owner);
  const branch = text(target.branch, 240);
  if (!project || !assignment || !branch) return { available: true, events: [], conflicts: [] };

  const listed = await bucket.list({ prefix: eventPrefix(project), limit: EVENT_LIMIT });
  const objects = Array.isArray(listed?.objects) ? listed.objects.slice(0, EVENT_LIMIT) : [];
  const events = [];
  const conflicts = [];

  for (const item of objects.sort((a, b) => String(a.key).localeCompare(String(b.key)))) {
    const event = await readJson(bucket, item.key);
    if (!event || event.identity?.assignment !== assignment) continue;
    if (await bucket.get(ackKey(project, assignment, event.event_id))) continue;
    const check = applicability(event, { project, assignment, owner, branch });
    if (check.safe_to_apply) events.push(event);
    else conflicts.push({ event, conflicts: check.conflicts });
  }

  return { available: true, events, conflicts };
}

export async function consumeQaFeedback(bucket, target = {}, now = new Date().toISOString()) {
  const pending = await listQaFeedback(bucket, target);
  if (!pending.available || !bucket?.put) return { ...pending, acknowledged: [] };
  const acknowledged = [];
  for (const event of pending.events) {
    const key = ackKey(event.identity.project, event.identity.assignment, event.event_id);
    await bucket.put(key, JSON.stringify({
      schema: 1,
      event_id: event.event_id,
      sequence: event.sequence,
      consumed_at: now,
      assignment: event.identity.assignment,
      branch: event.identity.branch
    }), { httpMetadata: { contentType: "application/json" } });
    acknowledged.push(event.event_id);
  }
  return { ...pending, acknowledged };
}

// Versioned text reports share the QA journal and binding. Legacy visual writes
// remain unchanged; their review/event dual-write repair is a separate batch.
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify(value))))].map(x => x.toString(16).padStart(2, '0')).join('');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const failure = (code, message) => Object.assign(new Error(message), { code });
const reportPrefix = target => `${ROOT}${target.project}/reports/${target.assignment}/`;
const reportKey = (target, id) => reportPrefix(target) + id + '.json';
const validReportId = id => /^fbr_[a-f0-9]{64}$/.test(id || '');

function requireBucket(bucket, write = false) {
  if (!bucket?.get || (write && !bucket?.put)) throw failure('unavailable', 'Feedback storage is unavailable');
}

export function feedbackApplicability(identity, target) {
  const conflicts = [];
  for (const field of ['project', 'assignment', 'owner', 'branch', 'repository', 'commit_sha']) {
    if (!identity?.[field] || !target?.[field]) conflicts.push('missing-' + field);
    else if (identity[field] !== target[field] && !(field === 'commit_sha' && target.historical && identity.review_mode === 'historical' && target.completed_commits?.includes(identity[field]))) conflicts.push(field);
  }
  const unverified = [];
  // A source SHA does not identify a tested native/web runtime. Historical
  // reports without a declared kind remain readable, but cannot imply this.
  if (!['source', 'runtime'].includes(identity?.kind)) unverified.push('artifact_kind');
  if (identity?.kind === 'runtime' && !['deployment_id', 'runtime_sha256'].some(field =>
    identity?.[field] && target?.[field] && identity[field] === target[field])) {
    unverified.push('runtime_identity');
  }
  for (const field of ['deployment_id', 'runtime_sha256']) {
    if (identity?.[field] && !target?.[field]) unverified.push(field);
    else if (identity?.[field] && identity[field] !== target[field]) conflicts.push(field);
  }
  if (identity?.pr && target?.pr && target.pr !== identity.pr) conflicts.push('pr');
  else if (identity?.pr && !target?.pr) unverified.push('pr');
  if (target?.terminal && !(target.historical && identity?.review_mode === 'historical')) conflicts.push('terminal-assignment');
  return { safe_to_apply: !conflicts.length && !unverified.length, routing_matches: !conflicts.length,
    conflicts, unverified };
}

export function feedbackStatus(report, target) {
  const applicability = feedbackApplicability(report.identity, target);
  const seen = report.receipts?.find(receipt => receipt.kind === 'seen') || null;
  return { saved: { at: report.created_at }, queued: !target.terminal && !seen && applicability.routing_matches,
    historical_review: Boolean(target.historical),
    delivered: null, seen, incorporated: null, fixed: null, verified: null,
    delivery_limitation: 'No verified native-task push or consumer identity. An explicit acknowledgement is an authenticated caller report, not proof of native delivery.',
    applicability };
}

async function readReportObject(bucket, target, id) {
  requireBucket(bucket);
  if (!validReportId(id)) throw failure('validation', 'Invalid feedback report id');
  const object = await bucket.get(reportKey(target, id));
  if (!object) return null;
  const report = await object.json();
  if (report.schema !== 2 || report.report_id !== id || report.identity?.project !== target.project ||
      report.identity?.assignment !== target.assignment || !Array.isArray(report.receipts)) {
    throw failure('provider', 'Feedback report identity is invalid');
  }
  return { report, etag: object.etag };
}

export async function getTextFeedback(bucket, target, id) {
  const object = await readReportObject(bucket, target, id);
  if (!object) throw failure('not_found', 'Feedback report not found for this assignment');
  return { ...object.report, status: feedbackStatus(object.report, target) };
}

export async function submitTextFeedback(bucket, { target, identity, operation_id, original_text, actor, related_report_id = null }, now = new Date().toISOString()) {
  requireBucket(bucket, true);
  const report_id = 'fbr_' + await digest([target.project, target.assignment, operation_id]);
  // Only caller intent participates in replay comparison; a refreshed canonical
  // owner/head does not make a lost-response replay create a second report.
  const intent = canonical({ identity, operation_id, original_text, related_report_id });
  const intent_digest = await digest(intent);
  const previous = await readReportObject(bucket, target, report_id);
  if (previous) {
    if (previous.report.intent_digest !== intent_digest) throw failure('conflict', 'Operation id already used for different feedback');
    return { ...previous.report, replayed: true, status: feedbackStatus(previous.report, target) };
  }
  if (related_report_id) await getTextFeedback(bucket, target, related_report_id);
  const report = { schema: 2, kind: 'text', report_id, operation_id, intent_digest, original_text,
    identity, related_report_id, created_at: now, revision: 1, reporter: actor, receipts: [] };
  let saved;
  try {
    saved = await bucket.put(reportKey(target, report_id), JSON.stringify(report), {
      onlyIf: new Headers({ 'If-None-Match': '*' }), httpMetadata: { contentType: 'application/json' }
    });
  } catch {
    // A timeout may follow a successful put; inspect this exact operation only.
    const recovered = await readReportObject(bucket, target, report_id);
    if (!recovered) throw failure('uncertain_write', 'Feedback write outcome unknown; retry the same operation id');
    if (recovered.report.intent_digest !== intent_digest) throw failure('conflict', 'Operation id already used for different feedback');
    return { ...recovered.report, replayed: true, status: feedbackStatus(recovered.report, target) };
  }
  if (!saved) {
    const recovered = await readReportObject(bucket, target, report_id);
    if (!recovered) throw failure('uncertain_write', 'Conditional feedback write could not be confirmed');
    if (recovered.report.intent_digest !== intent_digest) throw failure('conflict', 'Operation id already used for different feedback');
    return { ...recovered.report, replayed: true, status: feedbackStatus(recovered.report, target) };
  }
  return { ...report, replayed: false, status: feedbackStatus(report, target) };
}

export async function acknowledgeTextFeedback(bucket, { target, report_id, operation_id, expected_revision, actor }, now = new Date().toISOString()) {
  requireBucket(bucket, true);
  const object = await readReportObject(bucket, target, report_id);
  if (!object) throw failure('not_found', 'Feedback report not found for this assignment');
  const { report, etag } = object;
  const prior = report.receipts.find(x => x.operation_id === operation_id);
  if (prior) {
    if (prior.expected_revision !== expected_revision || prior.represented_owner !== target.owner || prior.actor !== actor)
      throw failure('conflict', 'Acknowledgement operation id already used for another intent');
    return { ...report, replayed: true, status: feedbackStatus(report, target) };
  }
  if (!feedbackApplicability(report.identity, target).routing_matches) throw failure('conflict', 'Feedback identity changed; reconcile before acknowledgement');
  if (report.revision !== expected_revision) throw failure('conflict', 'Feedback revision changed; read status before acknowledgement');
  if (!etag) throw failure('provider', 'Feedback storage omitted the conditional-write revision');
  if (report.receipts.length >= 32) throw failure('capacity', 'Feedback receipt history is full; retain this report and use an explicitly linked report');
  const receipt = { kind: 'seen', operation_id, expected_revision, at: now, represented_owner: target.owner,
    actor, provenance: 'authenticated-caller-reported', native_delivery_verified: false };
  const updated = { ...report, revision: report.revision + 1, receipts: [...report.receipts, receipt] };
  let saved;
  try {
    saved = await bucket.put(reportKey(target, report_id), JSON.stringify(updated), {
      onlyIf: { etagMatches: etag }, httpMetadata: { contentType: 'application/json' }
    });
  } catch {
    const current = await readReportObject(bucket, target, report_id);
    if (current?.report.receipts.some(x => x.operation_id === operation_id && JSON.stringify(x) === JSON.stringify(receipt)))
      return { ...current.report, replayed: true, status: feedbackStatus(current.report, target) };
    throw failure('uncertain_write', 'Acknowledgement outcome unknown; inspect report status');
  }
  if (!saved) throw failure('conflict', 'Feedback changed during acknowledgement; inspect status');
  return { ...updated, replayed: false, status: feedbackStatus(updated, target) };
}

export async function peekFeedback(bucket, target, { cursor, limit = 10 } = {}) {
  if (!bucket?.get || !bucket?.list) return { available: false, events: [], conflicts: [], truncated: false, next_cursor: null, reason: 'storage-unavailable' };
  const { record_sha: _revision, ...scope } = target;
  const binding = await digest(canonical(scope));
  let position = { phase: 'text', binding };
  if (cursor) {
    try {
      position = JSON.parse(atob(cursor));
      if (position.binding !== binding || !['text', 'legacy'].includes(position.phase) ||
          (position.cursor != null && typeof position.cursor !== 'string')) throw new Error();
    } catch { throw failure('conflict', 'Feedback cursor is invalid or target changed; restart the scan'); }
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw failure('validation', 'Feedback page limit must be 1 to 20');
  const prefix = position.phase === 'text' ? reportPrefix(target) : eventPrefix(target.project);
  const listed = await bucket.list({ prefix, limit, ...(position.cursor ? { cursor: position.cursor } : {}) });
  if (!Array.isArray(listed.objects) || (listed.truncated && !listed.cursor)) throw failure('provider', 'Incomplete feedback page');
  const events = [], conflicts = [];
  for (const item of listed.objects) {
    if (!item.key.startsWith(prefix)) throw failure('provider', 'Feedback page escaped its scope');
    const value = await readJson(bucket, item.key);
    if (!value) throw failure('provider', 'Feedback object unreadable; scan is incomplete');
    if (value.identity?.assignment !== target.assignment) continue;
    if (position.phase === 'text') {
      if (value.schema !== 2 || !validReportId(value.report_id) || !Array.isArray(value.receipts)) throw failure('provider', 'Invalid feedback report');
      const status = feedbackStatus(value, target);
      if (status.seen) continue;
      const summary = { ...value, original_text: value.original_text.slice(0, 1000), text_truncated: value.original_text.length > 1000, status };
      if (status.applicability.conflicts.length) conflicts.push(summary); else events.push(summary);
    } else {
      if (await bucket.get(ackKey(target.project, target.assignment, value.event_id))) continue;
      const check = feedbackApplicability(value.identity, target);
      // Legacy records never stored repository. The registered repository is
      // supplied only as a comparison context; preserve that missing provenance.
      conflicts.push({ ...value, legacy: true, applicability: check,
        reason: 'Legacy feedback requires explicit reconciliation; legacy consumption is not proof of seeing it.' });
    }
  }
  const next = listed.truncated ? { ...position, cursor: listed.cursor }
    : position.phase === 'text' ? { phase: 'legacy', binding } : null;
  return { available: true, events, conflicts, truncated: Boolean(next), next_cursor: next ? btoa(JSON.stringify(next)) : null,
    scan_policy: 'Restart after a completed scan to include newly inserted reports; acknowledgement controls pending state.' };
}
