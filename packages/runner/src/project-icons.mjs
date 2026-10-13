import { createHash } from 'node:crypto';
// Read-only discovery from the registered repository. Never fetch arbitrary URLs.
const mime = { png: "image/png", svg: "image/svg+xml", ico: "image/x-icon", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg" };
const limit = 256 * 1024;
const cache = new Map();
const safePath = value => typeof value === "string" && !/(?:^|\/)(?:node_modules|vendor|test|tests|fixtures|\.git)(?:\/|$)/i.test(value) && !/(?:vite|react|next)\.(?:svg|png)$/i.test(value);
function localPath(href, parent) {
  if (!href || /^(?:[a-z]+:|\/\/|#)/i.test(href)) return null;
  const clean = href.split(/[?#]/)[0];
  const parts = (clean.startsWith("/") ? clean.slice(1) : parent + "/" + clean).split("/");
  const normalized = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!normalized.length) return null; normalized.pop(); }
    else normalized.push(part);
  }
  return normalized.join("/");
}
const decode = value => Uint8Array.from(atob(value.replace(/\s/g, "")), char => char.charCodeAt(0));

export async function discoverProjectIcon(project, request) {
  const repository = project.repository;
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository || "") || project.alias_of) return { status: "unavailable", icon: null };
  const branch = project.default_branch || "main";
  const prefix = "/repos/" + repository;
  const tree = await request(prefix + "/git/trees/" + encodeURIComponent(branch) + "?recursive=1");
  if (tree.truncated || !Array.isArray(tree.tree) || tree.tree.length > 20000) return { status: "unavailable", icon: null };
  const files = tree.tree.filter(file => file.type === "blob" && safePath(file.path));
  const byPath = new Map(files.map(file => [file.path, file]));
  const candidates = [];
  const add = file => { if (file && !candidates.includes(file)) candidates.push(file); };
  const read = async file => {
    if (!file || file.size > limit || !/^[a-f0-9]{40}$/.test(file.sha || "")) return null;
    const blob = await request(prefix + "/git/blobs/" + file.sha);
    if (blob.encoding !== "base64" || typeof blob.content !== "string" || blob.content.length > limit * 1.4) return null;
    const bytes = decode(blob.content);
    return bytes.length <= limit ? { bytes, base64: blob.content.replace(/\s/g, "") } : null;
  };
  // An explicit product asset manifest wins over discovery. Invalid declarations
  // remain unavailable rather than silently replacing a chosen icon with a guess.
  const manifestFile=byPath.get('relay.assets.json')||byPath.get('apps/web/public/relay.assets.json');
  let declaredPrimary=null;
  if(manifestFile){
    try{
      const data=await read(manifestFile);if(!data||data.bytes.length>16384)throw Error('Invalid asset manifest');
      const manifest=JSON.parse(new TextDecoder().decode(data.bytes)),primary=manifest.variants?.primary;
      if(manifest.schema!==1||manifest.project!==project.id||!primary||typeof primary.path!=='string'||primary.path.startsWith('/')||primary.path.split('/').some(x=>!x||x==='.'||x==='..')||!/^[a-f0-9]{64}$/.test(primary.sha256))throw Error('Invalid asset declaration');
      const file=byPath.get(primary.path);const asset=await read(file);
      if(!asset||createHash('sha256').update(asset.bytes).digest('hex')!==primary.sha256||asset.bytes.length!==primary.bytes)throw Error('Asset integrity mismatch');
      declaredPrimary=file;add(file);
    }catch{return {status:'unavailable',icon:null,reason:'declared-asset-invalid'};}
  }
  // The app's declared favicon wins over filename guesses. Frontend public roots
  // are resolved locally in the same repository, never by following external links.
  const shells = files.filter(file => /(?:^|\/)index\.html$/.test(file.path)).sort((a, b) => a.path.length - b.path.length).slice(0, 4);
  for (const shell of declaredPrimary?[]:shells) {
    const data = await read(shell); if (!data) continue;
    const html = new TextDecoder().decode(data.bytes);
    const parent = shell.path.split("/").slice(0, -1).join("/");
    const publicRoot = parent.endsWith("/public") || parent === "public" ? parent : (parent ? parent + "/public" : "public");
    for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
      const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1];
      const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!/(?:^|\s)(?:icon|apple-touch-icon|manifest)(?:\s|$)/i.test(rel || "")) continue;
      const resolved = localPath(href, parent); if (!resolved) continue;
      const declared = byPath.get(resolved) || byPath.get(publicRoot + "/" + resolved.replace(/^public\//, ""));
      if (rel.toLowerCase() !== "manifest") { add(declared); continue; }
      const manifestData = await read(declared); if (!manifestData) continue;
      try {
        const manifest = JSON.parse(new TextDecoder().decode(manifestData.bytes));
        for (const icon of (manifest.icons || []).slice(0, 8)) add(byPath.get(localPath(icon.src, declared.path.split("/").slice(0, -1).join("/"))));
      } catch { /* A malformed optional manifest is not an icon. */ }
    }
  }
  const repoName = repository.split("/")[1].replace(/^loew-/, "");
  // Linux desktop application IDs often do not contain "icon" or "logo".
  // Restrict discovery to the standard application-icon namespace: never use
  // hicolor/actions glyphs, arbitrary artwork, or oversized binary assets.
  const nativeSize = file => {
    const match = file.path.match(/(?:^|\/)icons\/hicolor\/(?:(\d+)x(\d+)|scalable)\/apps\/[^/]+\.(?:svg|png|webp|ico)$/i);
    if (!match || file.size > limit || (match[1] && match[1] !== match[2])) return null;
    return match[1] ? Number(match[1]) : 256;
  };
  const appName = repoName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const native = files.filter(file => nativeSize(file) !== null);
  const nativeScore = file => {
    const name = file.path.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const identity = appName && name.endsWith(appName) ? 0 : 10000;
    const size = nativeSize(file);
    return identity + Math.abs(size - 256) + (size < 128 ? 1000 : 0);
  };
  native.sort((a, b) => nativeScore(a) - nativeScore(b) || a.path.localeCompare(b.path));
  if(!declaredPrimary)native.slice(0, 8).forEach(add);
  const fallback = files.filter(file => /\.(?:svg|png|ico|webp|jpe?g)$/i.test(file.path) && /(?:favicon|apple-touch-icon|(?:^|\/)(?:icon|logo)(?:[.-]|\/)|\/brand\/|\/branding\/)/i.test(file.path));
  fallback.sort((a, b) => {
    const score = file => (/favicon/.test(file.path) ? 0 : file.path.includes(repoName) ? 1 : 3) + file.path.split("/").length / 100;
    return score(a) - score(b);
  });
  if(!declaredPrimary)fallback.slice(0, 12).forEach(add);
  for (const file of candidates.slice(0, 12)) {
    const type = mime[file.path.split(".").pop().toLowerCase()]; if (!type) continue;
    const data = await read(file); if (!data) continue;
    if (type === "image/svg+xml") {
      const svg = new TextDecoder().decode(data.bytes);
      if (!/<svg[\s>]/i.test(svg) || /<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|javascript:|\/\/)/i.test(svg)) continue;
    }
    return { status: "found", icon: { data_url: "data:" + type + ";base64," + data.base64, repository, path: file.path, blob_sha: file.sha, sha256: createHash('sha256').update(data.bytes).digest('hex'), bytes:data.bytes.length, manifest:manifestFile?.path||null, source_url: "https://github.com/" + repository + "/blob/" + encodeURIComponent(branch) + "/" + file.path.split("/").map(encodeURIComponent).join("/") } };
  }
  return { status: "unavailable", icon: null };
}

export async function projectIcon(project, request, scope) {
  // Auth context is part of the key; an unavailable private repo must not borrow
  // an asset discovered through a different credential or installation.
  const key = scope + ":" + project.repository + ":" + (project.default_branch || "main");
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise;
  if (cache.size >= 64) cache.delete(cache.keys().next().value);
  const promise = discoverProjectIcon(project, request).catch(() => ({ status: "unavailable", icon: null }));
  cache.set(key, { expires: Date.now() + 300000, promise });
  return promise;
}

