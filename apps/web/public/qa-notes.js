// Recognize only the exact legacy producer envelope. Arbitrary JSON/user text
// is never evaluated, removed or treated as executable instructions.
export function splitReviewNotes(value = '') {
  const marker = 'Agent-prepared review packet (pending human judgment):';
  if (!value.startsWith(marker)) return { prefix: '', notes: value, guidance: null };
  const start = value.indexOf('{', marker.length);
  if (start < 0) return { prefix: '', notes: value, guidance: null };
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < value.length; index++) {
    const char = value[index];
    if (quoted) { if (escaped) escaped=false; else if (char==='\\') escaped=true; else if (char==='"') quoted=false; continue; }
    if (char === '"') { quoted=true; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) {
      try {
        const guidance = JSON.parse(value.slice(start,index+1));
        if (!guidance || !Array.isArray(guidance.questions) || typeof guidance.title !== 'string') break;
        const prefix = value.slice(0,index+1);
        const remainder = value.slice(index+1);
        const delimiter = '\n\nHuman notes:\n';
        const rest = remainder.startsWith(delimiter) ? remainder.slice(delimiter.length) : remainder;
        return {prefix, notes:rest, guidance};
      } catch { break; }
    }
  }
  return { prefix: '', notes: value, guidance: null };
}
export function joinReviewNotes(prefix, notes) { return prefix ? prefix + (notes ? '\n\nHuman notes:\n' + notes : '') : notes; }
