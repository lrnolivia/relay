// Shared by both MCP entry paths. Source batches allow 1,000,000 characters;
// JSON escaping can use six bytes per character. Keep bounded envelope headroom.
export const MAX_MCP_REQUEST_BYTES = 8 * 1024 * 1024;
const bodies = new WeakMap();
export class McpBodyError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function cancel(stream) { try { Promise.resolve(stream?.cancel()).catch(() => {}); } catch {} }
export function mcpBodyErrorResponse(error) {
  if (!(error instanceof McpBodyError)) throw error;
  return Response.json({
    error: error.status === 413 ? "Request too large" : "Invalid request body",
    message: error.message,
    max_request_bytes: MAX_MCP_REQUEST_BYTES,
    recovery: error.status === 413
      ? "Send a smaller complete-file batch within the request limit. No source write was attempted."
      : "Send a valid UTF-8 JSON request. No source write was attempted."
  }, { status: error.status });
}
export function readMcpBody(request) {
  // Consume once without teeing an unbounded unread clone. Legacy forwarding
  // receives the same Request identity and reuses this bounded result.
  if (!bodies.has(request)) bodies.set(request, readBody(request));
  return bodies.get(request);
}
async function readBody(request) {
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > MAX_MCP_REQUEST_BYTES) {
    cancel(request.body);
    throw new McpBodyError(413, "Relay accepts MCP requests up to 8 MiB, including JSON encoding.");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  const parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MCP_REQUEST_BYTES) {
        cancel(reader);
        throw new McpBodyError(413, "Relay accepts MCP requests up to 8 MiB, including JSON encoding.");
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } catch (error) {
    cancel(reader);
    if (error instanceof McpBodyError) throw error;
    throw new McpBodyError(400, "Could not read the request as UTF-8 JSON.");
  } finally {
    reader.releaseLock();
  }
}
