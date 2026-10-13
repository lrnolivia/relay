export function qaContext(value = {}) {
  const evidence = value.evidence || value;
  const context = evidence.context || {};
  return {
    evidence_id: evidence.evidence_id || value.evidence_id || null,
    project: context.project || null,
    environment: context.environment || null,
    surface: evidence.step_label || context.surface || "review",
    captured_at: evidence.captured_at || null,
    reviewed: Boolean(value.review?.overall || evidence.qaReview?.overall)
  };
}
