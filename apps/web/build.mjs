import '../../scripts/build-skills.mjs';
import { presentationMenu } from "../../packages/shared-ui/presentation.js";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import react from "@vitejs/plugin-react";
import { themeBootstrap } from "./public/theme.js";
import { inspectorWebsiteNavigation } from "./public/inspector-navigation.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = async name => fs.readFile(path.join(here, "public", name), "utf8");
const bundle = async entry => (await esbuild({
  entryPoints: [path.join(here, entry)],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2022",
  minify: true,
  loader: { ".png": "dataurl" }
})).outputFiles[0].text;
const escapeScript = value => value.replace(/<\/script/gi, "<\\/script");

const legacyScript = await bundle("public/operator.js");
const bridge = await bundle("mcp-bridge.js");
const relayIcon = "data:image/png;base64," + (await fs.readFile(path.join(here, "../../icons/relay-icon.png"))).toString("base64");
const legacyCss =
  await source("operator.css") + "\n" +
  await fs.readFile(path.join(here, "../../packages/shared-ui/tokens.css"), "utf8") + "\n" +
  await fs.readFile(path.join(here, "../../packages/shared-ui/components.css"), "utf8") + "\n" +
  await source("operator-1.8.css") + "\n" +
  await source("qa.css") + "\n" +
  await fs.readFile(path.join(here, "../../packages/shared-ui/notifications.css"), "utf8") + "\n" +
  await fs.readFile(path.join(here, "../../packages/shared-ui/telemetry.css"), "utf8") + "\n" +
  await fs.readFile(path.join(here, "../../packages/shared-ui/responsive-shell.css"), "utf8") + "\n" +
  await fs.readFile(path.join(here, "../../packages/shared-ui/motion.css"), "utf8");

const legacyShellOverrides = `
.operator-brand strong,
.operator-nav .nav-copy strong,
.nav-label {
  font-family: "Momo Trust Display", Inter, system-ui, sans-serif;
  font-weight: 400;
}
`;

let inspectorHtml = (await source("index.html"))
  .replace("__RELAY_PRESENTATION_MENU__", () => presentationMenu())
  .replaceAll("__RELAY_ICON__", relayIcon)
  .replace("__RELAY_THEME_BOOTSTRAP__", () => "<script>(" + themeBootstrap.toString() + ")()</script>")
  .replace(/<link rel="stylesheet" href="\/(?:operator|operator-1\.8|qa).css">/g, "")
  .replace("<title>relay</title>", "<title>relay inspector</title>")
  .replace("</head>", () => "<style>" + legacyCss + "\n" + legacyShellOverrides + "</style><script data-relay-inspector-navigation>(" + inspectorWebsiteNavigation.toString() + ")()</script></head>");

const viteResult = await viteBuild({
  root: here,
  configFile: false,
  publicDir: false,
  plugins: [react()],
  logLevel: "silent",
  build: {
    write: false,
    sourcemap: false,
    minify: "esbuild",
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "assets/relay-2.0.js",
        chunkFileNames: "assets/relay-2.0-[name].js",
        assetFileNames: asset => asset.name?.endsWith(".css") ? "assets/relay-2.0.css" : "assets/[name][extname]"
      }
    }
  }
});
const outputs = (Array.isArray(viteResult) ? viteResult : [viteResult]).flatMap(output => output.output || []);
const htmlAsset = outputs.find(item => item.type === "asset" && item.fileName === "index.html");
const jsChunk = outputs.find(item => item.type === "chunk" && item.isEntry);
const cssAsset = outputs.find(item => item.type === "asset" && item.fileName.endsWith(".css"));
if (!htmlAsset || !jsChunk || !cssAsset) throw new Error("Relay 2.0 Vite build did not emit the expected HTML, JS and CSS assets.");

const brandFiles = {
  relay: "relay-icon.png",
  today: "today-icon.png",
  runner: "runner-icon.png",
  inspector: "inspector-icon.png",
  "night-shift": "nightshift-icon.png.png"
};
const brandUrls = Object.fromEntries(await Promise.all(Object.entries(brandFiles).map(async ([name, file]) => [
  "/brand/" + name + ".png",
  "data:image/png;base64," + (await fs.readFile(path.join(here, "../../icons", file))).toString("base64")
])));
const inlineBrandUrls = value => {
  let next = String(value);
  const declarations = [];
  let index = 0;
  for (const [url, data] of Object.entries(brandUrls)) {
    next = next.replaceAll(url, data);
    const literal = JSON.stringify(data);
    const symbol = `__relayBrand${index++}`;
    if (next.includes(literal)) {
      next = next.replaceAll(literal, symbol);
      declarations.push(`const ${symbol}=${literal};`);
    }
  }
  return declarations.join("") + next;
};

const reactHtml = String(htmlAsset.source).replace("</head>", () => "<script>(" + themeBootstrap.toString() + ")()</script></head>");
const reactJs = inlineBrandUrls(jsChunk.code);
const reactCss = String(cssAsset.source);
const webBuildId = createHash("sha256").update(JSON.stringify([reactHtml, reactJs, reactCss, inspectorHtml, legacyScript])).digest("hex");
const webSourceSha = process.env.WORKERS_CI_COMMIT_SHA || process.env.RELAY_SOURCE_SHA || process.env.GITHUB_SHA || "";
const cssTag = reactHtml.match(/<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"[^>]*>/)?.[0];
const scriptTag = reactHtml.match(/<script type="module"[^>]*src="\/assets\/[^"]+\.js"><\/script>/)?.[0];
if (!cssTag || !scriptTag) throw new Error("Relay 2.0 HTML did not reference the expected Vite JS/CSS assets.");

const generatedReact =
  "// Generated by apps/web/build.mjs — React web/MCP payload.\n" +
  "export const reactHtml=" + JSON.stringify(reactHtml) + ";\n" +
  "export const reactJs=" + JSON.stringify(reactJs) + ";\n" +
  "export const reactCss=" + JSON.stringify(reactCss) + ";\n" +
  "export const bridge=" + JSON.stringify(bridge) + ";\n";

const generatedInspector =
  "// Generated by apps/web/build.mjs — preserved Inspector payload.\n" +
  "export const inspectorHtml=" + JSON.stringify(inspectorHtml) + ";\n" +
  "export const legacyScript=" + JSON.stringify(legacyScript) + ";\n";

const generated =
  "// Generated by apps/web/build.mjs from split Relay React + Inspector payloads.\n" +
  "import { reactHtml, reactJs, reactCss, bridge } from \"./generated-react.js\";\n" +
  "import { inspectorHtml, legacyScript } from \"./generated-inspector.js\";\n" +
  "export const contextCardBrandAssets=" + JSON.stringify(Object.fromEntries(Object.entries(brandUrls).filter(([url]) => !url.includes("today")).map(([url, data]) => [url.slice(7, -4), data]))) + ";\n" +
  "export const webBuildId=" + JSON.stringify(webBuildId) + ";\n" +
  "export const webSourceSha=" + JSON.stringify(webSourceSha) + ";\n" +
  "const escapeScript=value=>value.replace(/<\\/script/gi,\"<\\\\/script\");\n" +
  "export const webAssets={" +
    JSON.stringify("/") + ":{type:\"text/html; charset=utf-8\",text:reactHtml}," +
    JSON.stringify("/index.html") + ":{type:\"text/html; charset=utf-8\",text:reactHtml}," +
    JSON.stringify("/" + jsChunk.fileName) + ":{type:\"text/javascript; charset=utf-8\",text:reactJs}," +
    JSON.stringify("/" + cssAsset.fileName) + ":{type:\"text/css; charset=utf-8\",text:reactCss}," +
    JSON.stringify("/inspector") + ":{type:\"text/html; charset=utf-8\",text:inspectorHtml}," +
    JSON.stringify("/inspector/") + ":{type:\"text/html; charset=utf-8\",text:inspectorHtml}," +
    JSON.stringify("/relay-app.js") + ":{type:\"text/javascript; charset=utf-8\",text:legacyScript}" +
  "};\n" +
  "export const mcpHtml=reactHtml.replace(" + JSON.stringify(cssTag) + ",\"<style>\"+reactCss+\"</style>\").replace(" +
    JSON.stringify(scriptTag) + ",\"<script type=\\\"module\\\">\"+escapeScript(bridge+\"\\n\"+reactJs)+\"</script>\");\n";

await Promise.all([
  fs.writeFile(path.join(here, "generated-react.js"), generatedReact),
  fs.writeFile(path.join(here, "generated-inspector.js"), generatedInspector),
  fs.writeFile(path.join(here, "generated.js"), generated)
]);
console.log("Built split Relay React/MCP + preserved Inspector payloads");

