import { relayIconBase64 } from "./relay-icon.js";

// Exact user-supplied Relay PNG; embedded in MCP identity metadata so discovery needs no extra asset request.
export const relayIcon = {
  src: `data:image/png;base64,${relayIconBase64}`,
  mimeType: "image/png",
  sizes: ["1024x1024"]
};

export async function brandInitializeResponse(request, response) {
  if (response.status !== 200) return response;
  let message;
  try { message = await request.json(); } catch { return response; }
  if (message?.method !== "initialize") return response;
  let payload;
  try { payload = await response.clone().json(); } catch { return response; }
  if (payload?.error || !payload?.result?.serverInfo) return response;
  payload.result.serverInfo = {
    ...payload.result.serverInfo,
    description: "Coordinate loew.fi projects, deployments, and QA.",
    icons: [relayIcon]
  };
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
