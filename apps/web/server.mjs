import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { projectIcon } from "../../packages/runner/src/project-icons.mjs";
const execute = promisify(execFile);
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webAssets } from "./generated.js";
import { loadAllWorkers } from "../../packages/runner/src/config.mjs";
import { loadState } from "../../packages/runner/src/state.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body, type = "application/json") => { res.writeHead(status, { "Content-Type": type }); res.end(type === "application/json" ? JSON.stringify(body) : body); };
  try {
    if (req.method !== "GET") return send(403, { error: "Local preview is read-only. Use the authenticated Relay app for controls and review." });
    if (webAssets[url.pathname]) return send(200, webAssets[url.pathname].text, webAssets[url.pathname].type);
    if (url.pathname === "/api/workers") return send(200, await Promise.all((await loadAllWorkers()).map(async config => ({ ...config, runtime: await loadState(config.id) }))));
    if (url.pathname === "/api/projects") {
      const files = (await fs.readdir(path.join(root, "projects"))).filter(name => name.endsWith(".json"));
      const projects = await Promise.all(files.map(file => read("projects/" + file)));
      return send(200, { projects: projects.filter(project => !project.alias_of) });
    }
    const iconMatch = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9._-]+)\/icon$/);
    if (iconMatch) {
      const project = await read("projects/" + iconMatch[1] + ".json");
      return send(200, await projectIcon(project, async apiPath => JSON.parse((await execute("gh", ["api", apiPath], { maxBuffer: 8 * 1024 * 1024, timeout: 15000 })).stdout), "local-gh"));
    }
    const match = url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9._-]+)$/);
    if (match) {
      const project = await read("projects/" + match[1] + ".json");
      return send(200, { project, coordination: project.coordination?.record ? await read(project.coordination.record) : null });
    }
    if (url.pathname.startsWith("/api/visual")) return send(503, { error: "Captured evidence and review are available in the authenticated Relay app." });
    return send(404, { error: "Not found" });
  } catch (error) { send(500, { error: error.message }); }
});
server.listen(Number(process.env.PORT || 4242), "127.0.0.1", () => console.log("Relay local read-only preview: http://127.0.0.1:" + (process.env.PORT || 4242)));
