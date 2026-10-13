/** Publish one coherent dashboard revision after its project requests settle. */
export function settledSnapshot(previous, next) {
  if (!next || next.loadingProgress?.length) return previous;
  return next;
}
