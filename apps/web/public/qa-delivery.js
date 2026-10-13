// Delivery receipts survive reloads independently of the mutable review draft.
export function reviewText(evidence, review) {
  return `Review of ${evidence.evidence_id}\n\n${review.notes || ''}\n\nAnswers: ${JSON.stringify(review.answers || {})}\nOverall: ${review.overall || 'not answered'}\nDisposition: ${review.disposition || 'not set'}`;
}
export function deliveryLabel(receipt) {
  const status = receipt?.status;
  if (status?.verified) return 'Verified';
  if (status?.fixed) return 'Fix reported · verification pending';
  if (status?.incorporated) return 'Included in work';
  if (status?.seen) return 'Seen by the assignment caller';
  if (status?.historical_review) return 'Saved with completed work · no new execution queued';
  if (status?.queued) return 'Saved and queued · acknowledgement pending';
  return 'Saved · routing unconfirmed';
}
export async function deliverReview({ evidence, review, binding, api, storage, uuid = () => crypto.randomUUID() }) {
  if (!binding?.available) return { sent: false, label: binding?.reason || 'Saved · no verified assignment is available for routing.' };
  const key = 'relay.qa.delivery.v2.' + evidence.evidence_id;
  const text = reviewText(evidence, review);
  let previous;
  try { previous = JSON.parse(storage.getItem(key) || 'null'); } catch {}
  const intent = JSON.stringify({ ...binding.args, original_text: text });
  let pending = previous?.intent === intent ? previous : { intent, args: { ...binding.args, original_text: text, operation_id: uuid(),
    ...(previous?.receipt?.report_id ? { related_report_id: previous.receipt.report_id } : {}) } };
  // Refuse a network write if its retry identity cannot be durably retained locally.
  storage.setItem(key, JSON.stringify(pending));
  if (!pending.receipt) {
    const result = await api('/api/feedback/submit', { method: 'POST', body: JSON.stringify(pending.args) });
    if (!result.ok || !result.feedback?.report_id) throw Error(result.error?.message || 'Submission was not confirmed. Retry with the preserved operation ID.');
    pending.receipt = result.feedback;
    storage.setItem(key, JSON.stringify(pending));
  }
  const query = new URLSearchParams({ project: pending.args.project, assignment: pending.args.assignment, report_id: pending.receipt.report_id,
    ...(pending.args.review_mode ? { review_mode: pending.args.review_mode } : {}) });
  try {
    const result = await api('/api/feedback/status?' + query);
    if (result.ok && result.feedback?.report_id === pending.receipt.report_id) { pending.receipt = result.feedback; storage.setItem(key, JSON.stringify(pending)); }
  } catch { return { sent: true, receipt: pending.receipt, label: deliveryLabel(pending.receipt) + ' · latest status unavailable' }; }
  return { sent: true, receipt: pending.receipt, label: deliveryLabel(pending.receipt) };
}
