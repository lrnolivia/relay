import { workspaceLink } from './workspace-links.js';
// Project context already has a URL query contract. Carry only that explicit
// selection between documents; an absent query is the aggregate default.
export function projectFromHash(hash) {
  return new URLSearchParams(String(hash || "").split("?")[1] || "").get("project") || "";
}
export function projectHref(destination, project) {
  const [path, query = ""] = destination.split("?");
  const params = new URLSearchParams(query);
  if (project) params.set("project", project);
  else params.delete("project");
  const result=path + (params.size ? "?" + params.toString() : "");
  if(!globalThis.__retainedFixture&&(globalThis.location?.hostname==='relay.loew.fi'||globalThis.__RELAY_MCP__)) {
    const destination=result.startsWith('/runner')||result.startsWith('/today')||result.startsWith('/night-shift')?'/#'+result:result;
    return workspaceLink(destination);
  }
  return result;
}
