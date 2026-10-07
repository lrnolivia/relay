# Retirement continuation after the verified diagnostic release

This continuation is based on `9dc999c02f595923eca93d51abb6f1b5f41e7c17`, which includes verified PR179 diagnostic release `9171f6d3ad229ae86a59b6e77f91c97d4e165b39`. The entire earlier proposal and exact pending patch below are preserved as historical recovery evidence.

Current bounded work removes duplicate Relay control-panel entrypoints and programs. It keeps Relay's landing, Files, authenticated APIs, compact MCP context cards, backend execution/review capabilities, and CTRL intact. Both build entrypoints set `publicDir: false` so the old public Inspector assets cannot be copied into a standalone Vite build. The compatibility control-center tool and old resource URI become an inert CTRL handoff; the compact status card remains functional and is not redirected.

The six old full-panel test filenames are retained and rewritten as product-retirement gates: bundle exposure, auth/mutation boundaries, mobile inert-handoff accessibility, reduced-motion landing behavior, responsive landing layout, and exact context-preserving redirects. Camera mathematics, notes preservation, presentation/group/count models and the new diagnostic/presentation regression tests remain. React, website and retained-preview tests cover the actual replacement surfaces. All five full suites, toolchain/build/workerd checks, compact-card checks, draft preview and post-merge production verification remain required.

Historical retained bundles are not rewritten or deleted. They remain accessible only by their immutable retained-build identities under the existing authenticated sandbox, with their existing exact-source/sample-data labels. No historical full panel is served by current product entrypoints. New retained builds show only the legitimate landing and inert compatibility handoff.

At preparation, local build and TypeScript checks passed. Local browser execution was unavailable: the Playwright download returned invalid archives; the installed Chromium could not create required sockets under the sandbox; the permitted escalation failed during environment setup before launching tests. These are harness limitations, not product passes. Hosted exact-head Chromium and all ordinary gates must pass before any merge or deployment. No gate is weakened for the local limitation.

The existing shared-code wording changes are not copied from the stale full-panel candidate. They remain recorded in the historical patch for separate reconciliation against the actual active consumer. The stopped full-panel wording is not claimed delivered. Files UI redesign and the separate favicon patch remain outside this batch.

Rollback is the verified diagnostic release: source `9171f6d3ad229ae86a59b6e77f91c97d4e165b39`, Worker `2205b129-a9e9-449f-850f-dc3330a3cdb1`. Prefer isolating a failing landing/backend component rather than reactivating the rejected panel. No stored tasks, reviews, files or evidence are removed.

---

# Retire the obsolete Relay control panels

## Owner correction and exact boundary

Lauren rejected PR179's `d41262431b904364fdbed0219994ff01bc40bc58` preview as the old Relay control panel. It was an unfinished synthetic retained artifact, not a production deployment. PR179 was still an unmerged draft when promotion stopped. Production remained the verified PR178 permission release at `ba35b3344ec379d5fdc61cd3b0fc318d46b2acb1`.

CTRL is the only full workspace UI. Relay keeps its legitimate connection/telemetry landing page, Files, authenticated API/MCP/backend, compact status cards, source protections and evidence/retention services.

## Cause and correction

`apps/web/src/App.tsx` still imported the old Today/Runner/Night Shift pages and rendered their navigation. Its production redirect applied only at pathname `/` or `/index.html`. A retained document has a different pathname, so `#/runner` exposed the obsolete panel. `apps/web/build.mjs` also bundled the legacy Inspector program, and `src/relay-ui.js` exposed the full React payload under the control-center resource.

The corrected entrypoint imports only the Relay landing. Legacy paths and hashes hand off to CTRL, including under the retained-document pathname. No redirect exception can make the removed panel render. The build no longer reads or bundles `public/operator.js`, the old Inspector HTML/CSS program, or the MCP application bridge. Generated Inspector output is an inert compatibility handoff; the generated filename remains for the exact-build contract. `/relay-app.js` is explicitly retired with HTTP 410. The compatibility MCP tool keeps its machine name, uses a new handoff URI, and preserves the old v4 resource reader as a handoff. It has no embedded script, iframe, app transport or duplicate workspace controls.

Fresh retained builds contain the legitimate landing and an inert Inspector handoff. Sample previews disclose that connection checks, tool refreshes and Files are unavailable; they cannot claim a real MCP handshake. The existing opaque-origin, network-denying HTTP sandbox and memory-only sample data remain unchanged. Previously stored immutable artifacts and evidence records are not rewritten or deleted.

## Test replacement map

All five required suites remain mandatory. Backend/API/auth, quota behavior, exact-source build/workerd, source-checkpoint, compact-card, Files lifecycle, live landing, and post-merge production checks remain in force.

- `react.test.mjs` now checks actual generated landing behavior and retirement across desktop/mobile hash routes and alternate pathnames. It verifies that no old navigation, work viewer or review list can appear.
- `website.test.mjs` checks GET/HEAD source/build identity, context-preserving CTRL redirects, nested Runner paths, legacy-script retirement, no cross-origin mutation redirect and unchanged private API authentication.
- `retained-preview.test.mjs` checks the actual landing and handoff in the original opaque sandbox, parent/cookie/storage isolation, blocked network requests, historical artifact preservation and inability to resurrect old panels through hashes.
- Obsolete full-panel browser expectations in `browser`, `execution-browser`, `motion`, `presentation-layout`, `project-context`, and `mobile-inspector` are retired because those product surfaces belong to CTRL. The mistakenly added PR179 `review-language` browser suite is also retired from Relay. The original files remain recoverable at the stopped candidate and previous releases.
- The notes-preservation test in `notifications-review` and the pure settings/group/count contract in `work-views` remain. Active `relay-home`, `file-manager`, `telemetry-motion`, API, readback and underlying model tests are preserved.

This is a product-exposure retirement, not a blanket deletion of shared helpers or historical source. Unused legacy component source must not be reintroduced into the build. Any later physical cleanup needs an import audit so shared Files, telemetry, backend review models and historical readers survive.

## Wording ownership and rollback

The valid neutral common fallback, “Update available,” remains. PR179's full-panel wording edits are withdrawn from Relay. Current CTRL has a newer work-state model but still needs bounded event/scheduling wording and uncertain review-save handling; that work requires a linked CTRL assignment against its current source, not a wholesale copy of Relay's stale helper.

The safe rollback baseline is PR178 with its GW permission changes preserved. Reverting retirement would restore the explicitly rejected duplicate UI, so a rollback should first isolate the failing landing/backend component rather than silently reactivate obsolete panels. Git source checkpoints and previous Worker versions remain available for authorized recovery. No task, review, file, tombstone or retained artifact data is removed.

## Durable pre-diagnostic checkpoint

The stopped, unmerged source candidate is `d41262431b904364fdbed0219994ff01bc40bc58`. The following exact, unpublished retirement patch is preserved before temporarily isolating a backend-only diagnostic release. Its base is that commit; SHA-256 is `d9447d132bbc60534b3214bfcaca0f05816a3294f8ece12044db56ef0c3baab6`. The planning document above was the only untracked source file and is preserved here. Vite remains unedited because its additional scope transaction was not confirmed. No retirement or obsolete-panel wording is claimed live. The separate favicon patch is excluded.

The diagnostic candidate restores product files to verified production `ba35b3344ec379d5fdc61cd3b0fc318d46b2acb1` and changes only coordinator error evidence. The draft-preview workflow is restored to those same verified bytes now, so this checkpoint cannot publish another obsolete UI preview. All five required quality suites remain mandatory.

### Exact pending retirement patch

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index c8496c3..c51c0e6 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -270,12 +270,12 @@ jobs:
           name: relay-context-cards-${{ github.event.pull_request.number || github.sha }}
           path: qa-evidence/context-cards/
           if-no-files-found: error
-      - name: Preserve review language recovery captures
+      - name: Preserve landing and retirement captures
         if: always() && github.head_ref == 'relay/mcp-rebuild-20261003'
         uses: actions/upload-artifact@v4
         with:
-          name: relay-review-language-${{ github.event.pull_request.head.sha || github.sha }}
-          path: apps/web/qa-evidence/review-language/
+          name: relay-retirement-${{ github.event.pull_request.head.sha || github.sha }}
+          path: apps/web/qa-evidence/retirement/
           if-no-files-found: error
       - name: Preserve actual website route screenshots
         if: always() && (startsWith(github.head_ref, 'relay/retained-interactive-previews-') || startsWith(github.head_ref, 'relay/website-work-queue-views-') || startsWith(github.head_ref, 'relay/website-post-release-polish-') || startsWith(github.head_ref, 'relay/website-2.0-repair-') || startsWith(github.head_ref, 'relay/website-project-context-polish-') || startsWith(github.head_ref, 'relay/website-notifications-review-'))
diff --git a/apps/mcp/index.js b/apps/mcp/index.js
index 0d66920..c905a13 100644
--- a/apps/mcp/index.js
+++ b/apps/mcp/index.js
@@ -14,11 +14,13 @@ export default {
   },
   async fetch(request, env) {
     const url = new URL(request.url);
-    const websiteRoutes = { "/today": "/#/today", "/runner": "/#/runner", "/night-shift": "/#/night-shift", "/inspector": "/inspector" };
-    const destination = websiteRoutes[url.pathname.replace(/\/$/, "")];
-    if (destination && ["GET", "HEAD"].includes(request.method)) {
-      return Response.redirect("https://ctrl.loew.fi" + destination + url.search, 308);
+    const legacyPath=url.pathname.replace(/\/$/,"");
+    const workspaceRoute=/^\/(?:today|now|runner|night-shift|inspector)(?:\/|$)/.test(legacyPath);
+    if(workspaceRoute&&["GET","HEAD"].includes(request.method)){
+      const destination=legacyPath.replace(/^\/today(?=\/|$)/,'/now');
+      return Response.redirect("https://ctrl.loew.fi/#"+destination+url.search,308);
     }
+    if(url.pathname==='/relay-app.js'&&['GET','HEAD'].includes(request.method))return new Response(request.method==='HEAD'?null:'This legacy Relay interface is retired. Open https://ctrl.loew.fi/',{status:410,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
     if (url.pathname.startsWith("/api/")) {
       // File transport validates the same JWT in the gateway, without copying a
       // multi-megabyte Content-Length onto the small JSON authentication probe.
diff --git a/apps/web/build.mjs b/apps/web/build.mjs
index 4b9aa0d..98ae34f 100644
--- a/apps/web/build.mjs
+++ b/apps/web/build.mjs
@@ -1,10 +1,7 @@
 import '../../scripts/build-skills.mjs';
-import { presentationMenu } from "../../packages/shared-ui/presentation.js";
-import { build as esbuild } from "esbuild";
 import { build as viteBuild } from "vite";
 import react from "@vitejs/plugin-react";
 import { themeBootstrap } from "./public/theme.js";
-import { inspectorWebsiteNavigation } from "./public/inspector-navigation.js";
 import fs from "node:fs/promises";
 import path from "node:path";
 import { fileURLToPath } from "node:url";
@@ -14,48 +11,12 @@ import { execFileSync } from 'node:child_process';
 execFileSync(process.execPath,[fileURLToPath(new URL('../../scripts/build-context-card-model.mjs',import.meta.url)),'--check'],{stdio:'inherit'});
 
 const here = path.dirname(fileURLToPath(import.meta.url));
-const source = async name => fs.readFile(path.join(here, "public", name), "utf8");
-const bundle = async entry => (await esbuild({
-  entryPoints: [path.join(here, entry)],
-  bundle: true,
-  write: false,
-  format: "iife",
-  target: "es2022",
-  minify: true,
-  loader: { ".png": "dataurl" }
-})).outputFiles[0].text;
-const escapeScript = value => value.replace(/<\/script/gi, "<\\/script");
-
-const legacyScript = await bundle("public/operator.js");
-const bridge = await bundle("mcp-bridge.js");
-const relayIcon = "data:image/png;base64," + (await fs.readFile(path.join(here, "../../icons/relay-icon.png"))).toString("base64");
-const legacyCss =
-  await source("operator.css") + "\n" +
-  await fs.readFile(path.join(here, "../../packages/shared-ui/tokens.css"), "utf8") + "\n" +
-  await fs.readFile(path.join(here, "../../packages/shared-ui/components.css"), "utf8") + "\n" +
-  await source("operator-1.8.css") + "\n" +
-  await source("qa.css") + "\n" +
-  await fs.readFile(path.join(here, "../../packages/shared-ui/notifications.css"), "utf8") + "\n" +
-  await fs.readFile(path.join(here, "../../packages/shared-ui/telemetry.css"), "utf8") + "\n" +
-  await fs.readFile(path.join(here, "../../packages/shared-ui/responsive-shell.css"), "utf8") + "\n" +
-  await fs.readFile(path.join(here, "../../packages/shared-ui/motion.css"), "utf8");
-
-const legacyShellOverrides = `
-.operator-brand strong,
-.operator-nav .nav-copy strong,
-.nav-label {
-  font-family: "Momo Trust Display", Inter, system-ui, sans-serif;
-  font-weight: 400;
-}
-`;
-
-let inspectorHtml = (await source("index.html"))
-  .replace("__RELAY_PRESENTATION_MENU__", () => presentationMenu())
-  .replaceAll("__RELAY_ICON__", relayIcon)
-  .replace("__RELAY_THEME_BOOTSTRAP__", () => "<script>(" + themeBootstrap.toString() + ")()</script>")
-  .replace(/<link rel="stylesheet" href="\/(?:operator|operator-1\.8|qa).css">/g, "")
-  .replace("<title>relay</title>", "<title>relay inspector</title>")
-  .replace("</head>", () => "<style>" + legacyCss + "\n" + legacyShellOverrides + "</style><script data-relay-inspector-navigation>(" + inspectorWebsiteNavigation.toString() + ")()</script></head>");
+// Compatibility documents contain a handoff only. Never compile the retired
+// operator/Inspector scripts into a production or newly retained build.
+const handoffHtml = (title,href) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#191714;color:#f3eee8;font:16px/1.5 system-ui,sans-serif}main{max-width:36rem;padding:24px;margin:auto}a{color:#ed986f}h1{font-size:24px}</style></head><body><main data-relay-ctrl-handoff><h1>${title}</h1><p>Today, Runner, Inspector and Night Shift are in CTRL. Relay provides the connection, files and backend tools.</p><a href="${href}" target="_blank" rel="noopener noreferrer">Open CTRL</a></main></body></html>`;
+const inspectorHtml=handoffHtml('Inspector is in CTRL','https://ctrl.loew.fi/#/inspector');
+const mcpHandoffHtml=handoffHtml('Your work is in CTRL','https://ctrl.loew.fi/#/now');
+const legacyScript='',bridge='';
 
 const viteResult = await viteBuild({
   root: here,
@@ -129,12 +90,12 @@ const generatedReact =
   "export const bridge=" + JSON.stringify(bridge) + ";\n";
 
 const generatedInspector =
-  "// Generated by apps/web/build.mjs — preserved Inspector payload.\n" +
+  "// Generated by apps/web/build.mjs — CTRL compatibility handoff.\n" +
   "export const inspectorHtml=" + JSON.stringify(inspectorHtml) + ";\n" +
   "export const legacyScript=" + JSON.stringify(legacyScript) + ";\n";
 
 const generated =
-  "// Generated by apps/web/build.mjs from split Relay React + Inspector payloads.\n" +
+  "// Generated by apps/web/build.mjs from Relay landing + inert CTRL compatibility handoff.\n" +
   "import { reactHtml, reactJs, reactCss, bridge } from \"./generated-react.js\";\n" +
   "import { inspectorHtml, legacyScript } from \"./generated-inspector.js\";\n" +
   "export const contextCardBrandAssets=" + JSON.stringify(Object.fromEntries(Object.entries(brandUrls).filter(([url]) => !url.includes("today")).map(([url, data]) => [url.slice(7, -4), data]))) + ";\n" +
@@ -147,15 +108,13 @@ const generated =
     JSON.stringify("/" + jsChunk.fileName) + ":{type:\"text/javascript; charset=utf-8\",text:reactJs}," +
     JSON.stringify("/" + cssAsset.fileName) + ":{type:\"text/css; charset=utf-8\",text:reactCss}," +
     JSON.stringify("/inspector") + ":{type:\"text/html; charset=utf-8\",text:inspectorHtml}," +
-    JSON.stringify("/inspector/") + ":{type:\"text/html; charset=utf-8\",text:inspectorHtml}," +
-    JSON.stringify("/relay-app.js") + ":{type:\"text/javascript; charset=utf-8\",text:legacyScript}" +
+    JSON.stringify("/inspector/") + ":{type:\"text/html; charset=utf-8\",text:inspectorHtml}" +
   "};\n" +
-  "export const mcpHtml=reactHtml.replace(" + JSON.stringify(cssTag) + ",\"<style>\"+reactCss+\"</style>\").replace(" +
-    JSON.stringify(scriptTag) + ",\"<script type=\\\"module\\\">\"+escapeScript(bridge+\"\\n\"+reactJs)+\"</script>\");\n";
+  "export const mcpHtml=" + JSON.stringify(mcpHandoffHtml) + ";\n";
 
 await Promise.all([
   fs.writeFile(path.join(here, "generated-react.js"), generatedReact),
   fs.writeFile(path.join(here, "generated-inspector.js"), generatedInspector),
   fs.writeFile(path.join(here, "generated.js"), generated)
 ]);
-console.log("Built split Relay React/MCP + preserved Inspector payloads");
+console.log("Built split Relay React/MCP + CTRL compatibility handoffs");
diff --git a/apps/web/retained-fixture.js b/apps/web/retained-fixture.js
index 747134e..7bfce0c 100644
--- a/apps/web/retained-fixture.js
+++ b/apps/web/retained-fixture.js
@@ -36,7 +36,7 @@ let challenge='';
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='relay-preview-check'||typeof event.data.nonce!=='string'||event.data.nonce.length>100)return;
  challenge=event.data.nonce;const nonce=challenge;let attempts=0;
- const ready=()=>{if(challenge!==nonce||++attempts>200)return;if(!document.querySelector('.signal-card')||document.querySelector('[data-progress-notice] strong')?.textContent?.includes('Loading'))return setTimeout(ready,25);parent.postMessage({type:'relay-preview-ready',nonce:challenge,retained:true},event.origin);};ready();
+ const ready=()=>{if(challenge!==nonce||++attempts>200)return;if(!document.querySelector('.relay-home,[data-relay-ctrl-handoff]')||document.querySelector('.live-telemetry')?.getAttribute('data-loading')==='true')return setTimeout(ready,25);parent.postMessage({type:'relay-preview-ready',nonce:challenge,retained:true},event.origin);};ready();
 });
 function announce(message){let node=document.querySelector('#retained-notice');if(!node){node=document.createElement('div');node.id='retained-notice';node.setAttribute('role','status');node.style.cssText='position:fixed;bottom:8px;right:8px;max-width:280px;padding:8px 12px;border-radius:12px;background:#292621;color:#f6f2ed;font:12px/1.4 sans-serif;z-index:2147483647;pointer-events:none';document.body.append(node);}node.textContent=message;}
 function changeDocument(entry,hash){
diff --git a/apps/web/src/App.tsx b/apps/web/src/App.tsx
index 7485a9a..0cd83bf 100644
--- a/apps/web/src/App.tsx
+++ b/apps/web/src/App.tsx
@@ -1,88 +1,24 @@
+import {useEffect} from 'react';
+import {HashRouter,useLocation} from 'react-router-dom';
 import {bindFileManager} from '../../../packages/shared-ui/file-manager.js';
 import '../../../packages/shared-ui/file-manager.css';
 import '../../../packages/shared-ui/work-controls.css';
-import { RelayPage } from './pages/RelayPage';
-import { bindMotion } from "../../../packages/shared-ui/motion.js";
-import { useEffect } from "react";
-import { presentationMenu, bindPresentation } from "../../../packages/shared-ui/presentation.js";
-import { bindTheme } from "../public/theme.js";
-import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
-import { projectHref } from "../../../packages/shared-ui/project-context.js";
-import { LiveRelayProvider, useLiveRelay } from "./live";
-import { TodayPage } from "./pages/TodayPage";
-import { RunnerPage } from "./pages/RunnerPage";
-import { RunnerWorkPage } from "./pages/RunnerWorkPage";
-import { NightShiftPage } from "./pages/NightShiftPage";
-import { NotificationCenter } from './components/NotificationCenter';
+import {bindMotion} from '../../../packages/shared-ui/motion.js';
+import {bindPresentation} from '../../../packages/shared-ui/presentation.js';
+import {bindTheme} from '../public/theme.js';
+import {LiveRelayProvider} from './live';
+import {RelayPage} from './pages/RelayPage';
 
-const navItems = [
-  { to: "/today", label: "today", detail: "focus", feature: "today", icon: "/brand/today.png" },
-  { to: "/runner", label: "runner", detail: "coordinate", feature: "runner", icon: "/brand/runner.png" },
-  { to: "/night-shift", label: "night shift", detail: "monitor", feature: "night-shift", icon: "/brand/night-shift.png" }
-];
-
-function Shell() {
-  useEffect(()=>bindFileManager(),[]);
-  useEffect(() => { const presentation = bindPresentation(); const theme = bindTheme(); const motion = bindMotion(); return () => { presentation(); theme?.(); motion(); }; }, []);
-  const { state, project } = useLiveRelay();
-  const location = useLocation();
-  useEffect(()=>{if(window.location.hostname==='relay.loew.fi'&&['/','/index.html'].includes(window.location.pathname)&&location.pathname!=='/')window.location.replace('https://ctrl.loew.fi/#'+(location.pathname==='/today'?'/now':location.pathname)+location.search);},[location.pathname,location.search]);
-  const pageLabel = location.pathname.startsWith("/runner") ? "runner" : location.pathname.startsWith("/night-shift") ? "night shift" : "today";
-  const tone = state === "live" ? "good" : state === "offline" ? "bad" : "quiet";
-
-  if(location.pathname === "/")return <RelayPage />;
-
-  return (
-    <>
-      <div className="terra-accent" aria-hidden="true"><span/><span/><span/><span/><span/></div>
-      <header className="operator-topbar react-operator-topbar">
-        <a className="operator-brand react-brand" href={projectHref("#/today", project)}>
-          <img src="/brand/relay.png" alt="" width="52" height="52" />
-          <strong>relay</strong>
-          <span>project control</span>
-        </a>
-        <div className="nav-label">work</div>
-        <nav className="operator-nav react-operator-nav" aria-label="Relay">
-          {navItems.slice(0, 2).map(item => (
-            <NavLink key={item.to} to={projectHref(item.to, project)} data-feature={item.feature} className={({ isActive }) => isActive ? "active" : ""}>
-              <span className="glyph-chip"><img className="tool-mark" src={item.icon} alt="" /></span>
-              <span className="nav-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
-              <span className="nav-chevron" aria-hidden="true">›</span>
-            </NavLink>
-          ))}
-          <a href={projectHref("/inspector#review", project)} data-feature="inspector">
-            <span className="glyph-chip"><img className="tool-mark" src="/brand/inspector.png" alt="" /></span>
-            <span className="nav-copy"><strong>inspector</strong><small>review</small></span>
-            <span className="nav-chevron" aria-hidden="true">›</span>
-          </a>
-          {navItems.slice(2).map(item => (
-            <NavLink key={item.to} to={projectHref(item.to, project)} data-feature={item.feature} className={({ isActive }) => isActive ? "active" : ""}>
-              <span className="glyph-chip"><img className="tool-mark" src={item.icon} alt="" /></span>
-              <span className="nav-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
-              <span className="nav-chevron" aria-hidden="true">›</span>
-            </NavLink>
-          ))}
-        </nav>
-        <div className="operator-utility" dangerouslySetInnerHTML={{ __html: presentationMenu() }} />
-      </header>
-
-      <main className="operator-shell react-operator-shell">
-        <div className="workspace-context">
-          <div className="workspace-left"><span>your workspace <span aria-hidden="true">/</span> {pageLabel}</span></div>
-          <div className="connection-tools"><NotificationCenter /><div className="operator-connection" data-tone={tone}>{state}</div></div>
-        </div>
-        <Routes>
-          <Route path="/today" element={<TodayPage />} />
-          <Route path="/runner" element={<RunnerPage />} />
-          <Route path="/runner/:project/:assignment" element={<RunnerWorkPage />} />
-          <Route path="/night-shift" element={<NightShiftPage />} />
-          <Route path="*" element={<Navigate to="/" replace />} />
-        </Routes>
-      </main>
-    </>
-  );
+function Shell(){
+ const location=useLocation();
+ const path=location.pathname==='/today'?'/now':location.pathname;
+ const destination='https://ctrl.loew.fi/#'+(/^\/(now|runner|night-shift|inspector)(\/|$)/.test(path)?path+location.search:'/now');
+ const preview=Boolean((window as Window & {__retainedFixture?:{data_mode?:string}}).__retainedFixture?.data_mode==='synthetic');
+ useEffect(()=>bindFileManager(),[]);
+ useEffect(()=>{const presentation=bindPresentation(),theme=bindTheme(),motion=bindMotion();return()=>{presentation();theme?.();motion();};},[]);
+ useEffect(()=>{if(location.pathname!=='/'&&!preview&&window.location.hostname==='relay.loew.fi')window.location.replace(destination);},[location.pathname,destination,preview]);
+ if(location.pathname!=='/')return <main className="relay-home" data-relay-ctrl-handoff><section className="relay-main-panel"><h1>Your work is in CTRL</h1><p>Today, Runner, Inspector and Night Shift are available in CTRL.</p><a href={destination}>Open CTRL</a><p><a href="#/">Back to Relay connections and files</a></p></section></main>;
+ return <RelayPage/>;
 }
 
-export default function App() {
-  return <HashRouter><LiveRelayProvider><Shell /></LiveRelayProvider></HashRouter>;
-}
+export default function App(){return <HashRouter><LiveRelayProvider><Shell/></LiveRelayProvider></HashRouter>;}
diff --git a/apps/web/src/pages/RelayPage.tsx b/apps/web/src/pages/RelayPage.tsx
index fcf5ca7..073ca22 100644
--- a/apps/web/src/pages/RelayPage.tsx
+++ b/apps/web/src/pages/RelayPage.tsx
@@ -9,6 +9,7 @@ import { RELAY_PLUGIN_SETTINGS } from '../../public/relay-connection.js';
 type Check = { ok: boolean; checked_at: string; elapsed_ms: number; server?: { version: string }; tools?: { count: number; schema_sha256: string }; error?: string; refresh?: { message: string } };
 const endpoint = 'https://relay.loew.fi/mcp';
 export function RelayPage() {
+  const preview=Boolean((window as Window & {__retainedFixture?:{data_mode?:string}}).__retainedFixture?.data_mode==='synthetic');
   const { allSnapshot: snapshot, refresh } = useLiveRelay();
   const [check,setCheck]=useState<Check|null>(null),[busy,setBusy]=useState('check'),[message,setMessage]=useState(''),[showConnect,setShowConnect]=useState(false),[showRefresh,setShowRefresh]=useState(false);
   const items=Object.entries(snapshot?.progress||{}).flatMap(([project,payload])=>(payload.progress||[]).map(item=>({...item,project})));
@@ -21,6 +22,7 @@ export function RelayPage() {
   const checkInFlight=useRef(false);
   useEffect(()=>{void checkConnection('check',false);},[]);
   async function checkConnection(action='check',refreshWorkspace=true) {
+    if(preview){setBusy('');setMessage('This preview uses sample data. Connection checks and tool refreshes are unavailable here.');return;}
     if(checkInFlight.current)return;checkInFlight.current=true;setBusy(action);setMessage('');if(action==='refresh')setShowRefresh(true);
     const start=performance.now();
     try{const response=await fetch('/api/relay/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Connection check failed');setCheck(data);if(action==='refresh')setMessage(data.refresh.message);else if(refreshWorkspace)void refresh();}
@@ -33,10 +35,10 @@ export function RelayPage() {
     <section className="relay-main-panel" aria-labelledby="relay-title">
       <header className="relay-identity">
         <div className="relay-wordmark"><img src="/brand/relay.png" alt="" width="144" height="144"/><div><h1 id="relay-title">relay</h1><p>your tools, connected.</p></div></div>
-        <StatusLight tone={busy?'wait':check?.ok?'good':check?'bad':'quiet'} label={busy?'checking connection':check?.ok?'MCP connected':check?'connection unavailable':'connection not checked'}/>
+        <StatusLight tone={preview?'quiet':busy?'wait':check?.ok?'good':check?'bad':'quiet'} label={preview?'sample preview':busy?'checking connection':check?.ok?'MCP connected':check?'connection unavailable':'connection not checked'}/>
       </header>
       <div className="relay-connection-panel" aria-busy={Boolean(busy)}>
-        <div className="relay-connection-copy"><span className="relay-eyebrow">connection</span><strong>{busy?'Checking the connection…':check?.ok?'Relay is responding.':check?'Let’s reconnect.':'Ready when you are.'}</strong><p role="status">{check ? `${check.ok?'Authenticated MCP handshake':check.error} · ${check.elapsed_ms} ms · ${new Date(check.checked_at).toLocaleTimeString()}` : 'Check the live MCP service, then use your connected tools in your AI client.'}</p></div>
+        <div className="relay-connection-copy"><span className="relay-eyebrow">connection</span><strong>{preview?'Preview only':busy?'Checking the connection…':check?.ok?'Relay is responding.':check?'Let’s reconnect.':'Ready when you are.'}</strong><p role="status">{preview?'Sample data is shown below. This preview cannot check or change your real connection.':check ? `${check.ok?'Authenticated MCP handshake':check.error} · ${check.elapsed_ms} ms · ${new Date(check.checked_at).toLocaleTimeString()}` : 'Check the live MCP service, then use your connected tools in your AI client.'}</p></div>
         <div className="relay-connection-actions">
           <div className="relay-service-actions" role="group" aria-label="Connection actions">
             <button type="button" className="relay-primary-action" disabled={Boolean(busy)} onClick={()=>void checkConnection()}><span className={busy?'relay-check-pulse':''} aria-hidden="true">●</span> Check connection</button>
@@ -44,7 +46,7 @@ export function RelayPage() {
           </div>
           <div className="relay-utility-actions" role="group" aria-label="Setup and files">
             <button type="button" className="relay-connect-action" onClick={()=>setShowConnect(value=>!value)} aria-expanded={showConnect}>connect your AI <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
-            <button type="button" data-file-manager aria-label="Open files" title="Files"><span aria-hidden="true" dangerouslySetInnerHTML={{__html:fileManagerIcon}}/>Files</button>
+            <button type="button" data-file-manager aria-label="Open files" title={preview?'Files are unavailable in this sample preview':'Files'} disabled={preview}><span aria-hidden="true" dangerouslySetInnerHTML={{__html:fileManagerIcon}}/>Files</button>
           </div>
         </div>
       </div>
diff --git a/apps/web/test/browser.test.mjs b/apps/web/test/browser.test.mjs
deleted file mode 100644
index 18c3460..0000000
--- a/apps/web/test/browser.test.mjs
+++ /dev/null
@@ -1,373 +0,0 @@
-import {reviewFixture} from "./work-review-fixture.mjs";
-import test from "node:test";
-import assert from "node:assert/strict";
-import http from "node:http";
-import { chromium } from "playwright";
-import { webAssets } from "../generated.js";
-import { fitTransform, wheelPanDelta, wheelZoomFactor } from "../public/qa-viewport.js";
-// Inspector deliberately reuses Field camera semantics without importing Field editor state.
-// Dashboard triage is reversible: stale review evidence is archived, never deleted.
-// Review disposition actions preserve the same evidence identity and QA record.
-
-const evidence = {
-  evidence_id: "vis_12345678-abcd", captured_at: "2026-09-30T15:00:00Z", step_label: "Relay navigation",
-  screenshot_url: "/api/visual/vis_12345678-abcd/image", context: { project: "relay", commit_sha: "a".repeat(40), environment: "preview" }
-};
-const questions = [{ id: "intent", prompt: "Is the next action clear?", reason: "Check the Relay flow." }];
-const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlAAAAABJRU5ErkJggg==", "base64");
-
-test("Inspector camera math mirrors Field input semantics", () => {
-  const fit = fitTransform(1200, 800, 1440, 900);
-  assert.ok(fit.scale > 0 && fit.scale <= 2);
-  assert.ok(Number.isFinite(fit.x) && Number.isFinite(fit.y));
-  const pan = wheelPanDelta({ deltaMode: 0, deltaX: 12, deltaY: 18 }, 800);
-  assert.ok(pan.dx < 0 && pan.dy < 0);
-  assert.ok(wheelZoomFactor({ deltaMode: 0, deltaY: -12, metaKey: false }) > 1);
-});
-
-test("preserved legacy components and Inspector review support mobile, deep links and exact saves", async () => {
-  let review = null;
-  let heldPath = "";
-  let releaseLoading;
-  let loadingGate;
-  const hold = path => { heldPath = path; loadingGate = new Promise(resolve => { releaseLoading = () => { heldPath = ""; resolve(); }; }); };
-  const project = { id: "relay", name: "relay", managed: true };
-  const workers = [{ id: "relay", enabled: false, name: "relay", runtime: { status: "idle", last_summary: "Latest canonical run" } }];
-  const progress = {
-    contract_version: "1.7.5", observed_progress: true, project: "relay",
-    progress: [
-      {
-        assignment: "Complete consolidation", observed: true, state: "waiting-for-human", stage: "review",
-        worker: { heartbeat_at: "2026-09-30T15:00:00Z", freshness: "fresh" },
-        external: { active: false, system: null, detail: null },
-        last_meaningful_progress_at: "2026-09-30T15:00:00Z",
-        latest_event: { type: "source-commit", at: "2026-09-30T15:00:00Z" },
-        waiting_reason: "Review the exact current result.",
-        identities: { branch: "relay/test", head_sha: "c".repeat(40) },
-        next_action: "Keep implementing"
-      },
-      {
-        assignment: "Broken release", observed: true, state: "failed", stage: "checks",
-        worker: { heartbeat_at: "2026-09-30T14:58:00Z", freshness: "fresh" },
-        external: { active: false, system: null, detail: null },
-        last_meaningful_progress_at: "2026-09-30T14:58:00Z",
-        latest_event: { type: "check-completed", at: "2026-09-30T14:58:00Z" },
-        waiting_reason: "checks failed",
-        identities: { branch: "relay/broken", head_sha: "d".repeat(40) }
-      },
-      {
-        assignment: "Active build", observed: true, state: "working", stage: "implementation",
-        worker: { heartbeat_at: "2026-09-30T14:57:00Z", freshness: "fresh" },
-        external: { active: false, system: null, detail: null },
-        last_meaningful_progress_at: "2026-09-30T14:57:00Z",
-        latest_event: { type: "source-commit", at: "2026-09-30T14:57:00Z" },
-        identities: { branch: "relay/active", head_sha: "e".repeat(40) }
-      },
-      {
-        assignment: "External wait", observed: true, state: "waiting-on-external-system", stage: "checks",
-        worker: { heartbeat_at: "2026-09-30T14:56:00Z", freshness: "fresh" },
-        external: { active: true, system: "github", detail: "CI is running" },
-        last_meaningful_progress_at: "2026-09-30T14:56:00Z",
-        latest_event: { type: "check-started", at: "2026-09-30T14:56:00Z" },
-        identities: { branch: "relay/wait", head_sha: "f".repeat(40) }
-      }
-    ],
-    queue: []
-  };
-  const reviews=reviewFixture(item=>item.kind==='evidence'?evidence:progress.progress.find(p=>p.assignment===item.id));
-  const server = http.createServer(async (req, res) => {
-    const url = new URL(req.url, "http://localhost");
-    const send = body => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
-    // Isolate legacy component coverage from the real website navigation. The
-    // production /inspector route may never host legacy Today/Runner bodies.
-    if (url.pathname === "/legacy-components") {
-      res.setHeader("Content-Type", "text/html");
-      return res.end(webAssets["/inspector"].text.replace(/<script data-relay-inspector-navigation>[\s\S]*?<\/script>/, ""));
-    }
-    const asset = webAssets[url.pathname];
-    if (asset) { res.setHeader("Content-Type", asset.type); return res.end(asset.text); }
-    if (url.pathname === "/host") { res.setHeader("Content-Type", "text/html"); return res.end('<iframe id="app" style="width:100%;height:900px;border:0"></iframe>'); }
-    if (url.pathname === heldPath) await loadingGate;
-    if (url.pathname === "/api/work-review") return send(await reviews.handle(req));
-    if (url.pathname === "/api/projects") return send({ projects: [project] });
-    if (url.pathname === "/api/projects/relay/icon") return send({ status: "found", icon: { data_url: "data:image/png;base64," + pixel.toString("base64"), repository: "lrnolivia/relay", path: "apps/web/public/brand/relay-loop.png", blob_sha: "b".repeat(40) } });
-    if (url.pathname === "/api/projects/relay") return send({ project, coordination: { claims: [{ id: "work", state: "active", goal: "Legacy claim context" }] } });
-    if (url.pathname === "/api/progress/relay") return send(progress);
-    if (url.pathname === "/api/workers") return send(workers);
-    if (url.pathname === "/api/visual") return send({ evidence: [evidence] });
-    if (url.pathname.endsWith("/image")) { res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "image/png"); return res.end(pixel); }
-    if (url.pathname.endsWith("/live")) return send({ live: { active: false } });
-    if (url.pathname.endsWith("/qa")) {
-      if (req.method === "POST") {
-        let body = ""; for await (const chunk of req) body += chunk;
-        review = { ...JSON.parse(body), evidence_id: evidence.evidence_id, updated_at: new Date().toISOString() };
-      }
-      return send({ evidence, questions, review });
-    }
-    res.statusCode = 404; send({ error: "Unexpected test request " + url.pathname });
-  });
-  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
-  const origin = "http://127.0.0.1:" + server.address().port;
-  const browser = await chromium.launch({ headless: true });
-  try {
-    for (const mode of ["web"]) {
-      const page = await browser.newPage({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
-      const errors = []; page.on("pageerror", error => errors.push(error.message));
-      let view = page;
-      if (mode === "web") {
-        hold("/api/workers");
-        await page.goto(origin + "/legacy-components#today");
-        await view.locator("#today-work .content-skeleton").waitFor();
-        assert.equal(await view.locator("#today-attention .content-skeleton").getAttribute("role"), "status");
-        assert.equal(await view.locator("#operator-connection").evaluate(node => getComputedStyle(node, "::before").position), "static");
-        assert.equal(await view.locator("#operator-connection").evaluate(node => getComputedStyle(node, "::before").animationName), "connection-checking");
-        await page.emulateMedia({ reducedMotion: "reduce" });
-        assert.equal(await view.locator("#operator-connection").evaluate(node => getComputedStyle(node, "::before").animationName), "none");
-        assert.equal(await view.locator("#today-work .skeleton-block").first().evaluate(node => getComputedStyle(node).animationName), "none");
-        await page.screenshot({ path: "/tmp/relay-loading-skeletons.png" });
-        releaseLoading();
-        await page.emulateMedia({ reducedMotion: "no-preference" });
-      }
-      else {
-        await page.goto(origin + "/host");
-        await page.evaluate(html => {
-          window.addEventListener("message", async event => {
-            const message = event.data;
-            if (message?.jsonrpc !== "2.0" || message.id === undefined) return;
-            let result = {};
-            if (message.method === "tools/call") {
-              const args = message.params.arguments;
-              const response = await fetch(args.path, { method: args.method, headers: { "Content-Type": "application/json" }, body: args.body ? JSON.stringify(args.body) : undefined });
-              const content_type = response.headers.get("content-type");
-              const data = { status: response.status, content_type };
-              if (content_type.startsWith("image/")) data.base64 = btoa(String.fromCharCode(...new Uint8Array(await response.arrayBuffer())));
-              else data.body = await response.json();
-              result = { structuredContent: data };
-            }
-            event.source.postMessage({ jsonrpc: "2.0", id: message.id, result }, "*");
-          });
-          document.querySelector("iframe").srcdoc = html;
-        }, mcpHtml);
-        view = page.frameLocator("#app");
-      }
-      await view.locator("#operator-connection").filter({ hasText: "connected" }).waitFor({ timeout: 10000 }).catch(error => { throw new Error(mode + " connection failed: " + JSON.stringify(errors), { cause: error }); });
-      assert.equal(await view.locator(".page-statusline").count(), 0);
-      const todayHeader = view.locator('.feature-heading[data-feature="today"]');
-      await todayHeader.locator(".feature-mark").waitFor();
-      assert.equal(await todayHeader.locator("p").textContent(), "focus");
-      assert.equal(await todayHeader.evaluate(node => getComputedStyle(node).getPropertyValue("--feature-accent").trim()), "#ff6f78");
-      const todayIcon = await todayHeader.locator(".feature-mark").evaluate(node => ({ src: node.getAttribute("src"), naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight }));
-      assert.match(todayIcon.src, /^data:image\/png;base64,/);
-      assert.equal(todayIcon.naturalWidth, 1024);
-      assert.equal(todayIcon.naturalHeight, 1024);
-      assert.equal(await view.locator(".presentation-menu #app-settings").count(), 0, "Refresh tools belongs to the Relay connection panel");
-
-      const sidebar = view.locator(".operator-topbar");
-      const shell = view.locator(".operator-shell");
-      const collapsed = await sidebar.evaluate(node => ({ width: node.getBoundingClientRect().width, navOpacity: getComputedStyle(node.querySelector(".nav-copy")).opacity }));
-      assert.ok(collapsed.width >= 84 && collapsed.width <= 92, mode + " collapsed sidebar width");
-      assert.equal(collapsed.navOpacity, "0");
-      assert.ok(await view.locator('.operator-page[data-page="today"]').evaluate(node => node.getBoundingClientRect().width) <= 1121, mode + " centered content max-width");
-      assert.ok(parseFloat(await shell.evaluate(node => getComputedStyle(node).marginLeft)) >= 84);
-      const sidebarTransition = await sidebar.evaluate(node => getComputedStyle(node).transitionDuration);
-      assert.ok(sidebarTransition.split(",").every(value => parseFloat(value) <= .26), mode + " sidebar transition must stay fast");
-      await sidebar.hover();
-      await page.waitForTimeout(40);
-      assert.equal(await view.locator("body").getAttribute("data-shell-motion"), "expand");
-      const movingPage = view.locator('.operator-page[data-page="today"]');
-      assert.equal(await movingPage.evaluate(node => getComputedStyle(node).animationName), "none");
-      assert.ok(parseFloat(await movingPage.evaluate(node => getComputedStyle(node).animationDuration)) <= .26);
-      await page.waitForTimeout(220);
-      const expanded = await sidebar.evaluate(node => ({ width: node.getBoundingClientRect().width, navOpacity: getComputedStyle(node.querySelector(".nav-copy")).opacity }));
-      assert.ok(expanded.width >= 330 && expanded.width <= 350, mode + " expanded sidebar width");
-      assert.equal(expanded.navOpacity, "1");
-      assert.equal(parseFloat(await shell.evaluate(node => getComputedStyle(node).marginLeft)), Math.round(collapsed.width), "sidebar overlays without moving content");
-      await shell.hover();
-      await page.waitForTimeout(40);
-      assert.equal(await view.locator("body").getAttribute("data-shell-motion"), "collapse");
-      assert.equal(await movingPage.evaluate(node => getComputedStyle(node).animationName), "none");
-      await page.waitForTimeout(180);
-      const attention = view.locator(".attention-card").first();
-      await attention.waitFor();
-      const geometry = await attention.evaluate(node => {
-        const card = node.getBoundingClientRect();
-        const button = node.querySelector("button")?.getBoundingClientRect();
-        return button ? {
-          contained: button.left >= card.left && button.right <= card.right && button.top >= card.top && button.bottom <= card.bottom,
-          cardWidth: card.width,
-          buttonWidth: button.width
-        } : { contained: false };
-      });
-      assert.equal(geometry.contained, true, mode + " attention action must stay inside its card");
-      await view.getByRole("button", { name: "runner", exact: true }).click();
-      const runnerButton = view.getByRole("button", { name: "runner", exact: true });
-      assert.equal(await view.getByRole("heading", { name: "runner", level: 1, exact: true }).textContent(), "runner");
-      assert.equal(await view.locator('.feature-heading[data-feature="runner"] p').textContent(), "coordinate");
-      assert.equal(await view.locator('.feature-heading[data-feature="runner"]').evaluate(node => getComputedStyle(node).getPropertyValue("--feature-accent").trim()), "#3bcb8d");
-      assert.equal(await runnerButton.evaluate(node => getComputedStyle(node).getPropertyValue("--feature-accent").trim()), "#3bcb8d");
-      assert.ok(parseFloat(await runnerButton.evaluate(node => getComputedStyle(node).borderBottomWidth)) <= 1, "active nav must not use fake underline depth");
-      await view.getByRole("tab", { name: "relay", exact: true }).click();
-      await view.locator("#project-detail").filter({ hasText: "Complete consolidation" }).waitFor();
-      assert.equal(await view.locator('.overview-metric:has-text("moving")').getAttribute("data-tone"), "good");
-      assert.equal(await view.locator('.overview-metric:has-text("external wait")').getAttribute("data-tone"), "wait");
-      assert.equal(await view.locator('.overview-metric:has-text("needs you")').getAttribute("data-tone"), "act");
-      const failedBadge = view.locator('.progress-row[data-progress-state="failed"] .status-badge');
-      await failedBadge.waitFor();
-      assert.equal(await failedBadge.getAttribute("data-tone"), "bad");
-      assert.equal(await failedBadge.getAttribute("data-signal"), "danger");
-      assert.equal(await failedBadge.locator(".status-light").count(), 1);
-      assert.equal(await failedBadge.evaluate(node => getComputedStyle(node, "::before").display), "none");
-      const failedColor = await failedBadge.evaluate(node => getComputedStyle(node).color);
-      assert.notEqual(failedColor, "rgb(198, 191, 183)");
-      assert.notEqual(await failedBadge.locator(".status-light").evaluate(node => getComputedStyle(node, "::after").animationName), "none");
-      const failedRow = view.locator('.progress-row[data-progress-state="failed"]');
-      assert.equal(await failedRow.evaluate(node => getComputedStyle(node).borderLeftWidth), "0px");
-      assert.equal(await failedRow.evaluate(node => getComputedStyle(node).borderTopWidth), "0px");
-      const failedSurface = await failedRow.evaluate(node => getComputedStyle(node).backgroundColor);
-      const workingSurface = await view.locator('.progress-row[data-progress-state="working"]').evaluate(node => getComputedStyle(node).backgroundColor);
-      assert.equal(failedSurface, workingSurface, "User-directed neutral greige cards keep status color in the badge");
-      assert.equal(failedSurface, "rgb(28, 27, 25)");
-      assert.notEqual(failedColor, await view.locator('.progress-row[data-progress-state="working"] .status-badge').first().evaluate(node => getComputedStyle(node).color));
-      await view.locator('#project-tabs [data-project-id="relay"] [data-repo-icon="relay"][data-icon-sha="' + "b".repeat(40) + '"] img').waitFor();
-      assert.equal(await view.locator('#project-tabs [data-project-id="relay"] [data-repo-icon="relay"]').evaluate(node => getComputedStyle(node).backgroundColor), "rgba(0, 0, 0, 0)");
-      for (const width of [560, 900, 1360]) {
-        await page.setViewportSize({ width, height: 1000 });
-        assert.equal(await view.locator("body").evaluate(() => document.documentElement.scrollWidth > innerWidth), false, mode + " viewport " + width);
-      }
-      await page.emulateMedia({ reducedMotion: "reduce" });
-      assert.equal(await view.locator(".relay-glyph").first().evaluate(node => getComputedStyle(node).transitionDuration), "0s");
-      assert.equal(await shell.evaluate(node => getComputedStyle(node).transitionDuration), "0s");
-      assert.equal(await view.locator('.operator-page[data-page="projects"]').evaluate(node => getComputedStyle(node).animationName), "none");
-      assert.equal(await failedBadge.locator(".status-light").evaluate(node => getComputedStyle(node, "::after").animationName), "none");
-      assert.equal(await failedBadge.evaluate(node => getComputedStyle(node).color), failedColor);
-      await page.emulateMedia({ reducedMotion: "no-preference" });
-      assert.equal(await view.locator(".flow-band").count(), 0);
-      assert.equal(await view.locator(".page-overview").count(), 0);
-      assert.equal(await view.locator(".page-statusline").count(), 0);
-      assert.equal(await view.locator(".project-tabs").count(), 1);
-      await view.getByRole("button", { name: "night shift", exact: true }).click();
-      await view.locator("#night-shift-work").filter({ hasText: "Latest canonical run" }).waitFor();
-      if (mode === "web") hold("/api/visual");
-      await view.getByRole("button", { name: "inspector", exact: true }).click();
-      let skeletonWidth;
-      if (mode === "web") {
-        await view.locator(".skeleton-review .skeleton-card").first().waitFor();
-        assert.equal(await view.locator(".skeleton-review .skeleton-card").count(), 3);
-        skeletonWidth = (await view.locator(".skeleton-review .skeleton-card").first().boundingBox()).width;
-        releaseLoading();
-      }
-      if (mode === "mcp") await view.getByRole("button", { name: "all", exact: true }).click();
-      await view.locator("[data-review-id]").waitFor();
-      assert.equal(await view.locator(".inspector-signal-deck .signal-card").count(), 2);
-      assert.notEqual(await view.locator("#inspector-signal-visible").textContent(), "—");
-      assert.match(await view.getByRole("heading", { name: "inspector", level: 1 }).evaluate(node => getComputedStyle(node).fontFamily), /Momo Trust Display/);
-      await view.locator('#review-list[data-summary-state=ready]').waitFor();
-      await view.getByRole('button',{name:'All',exact:true}).click();
-      await view.locator('[data-select-visible]').check();
-      const apply=async label=>{await view.getByRole('button',{name:label,exact:true}).click();await view.locator('[data-confirm]').click();await view.locator('.work-message').filter({hasText:'1 review updated.'}).waitFor();};
-      await apply('Mark review complete');
-      assert.match(await view.locator('.review-row').innerText(),/Review: Completed/);
-      assert.equal(review,null,'handling a review never overwrites the evidence QA answers');
-      await apply('Mark out of date');
-      await view.getByRole('button',{name:'Out of date',exact:true}).click();
-      await apply('Archive out-of-date reviews');
-      await view.getByRole('button',{name:'Archived',exact:true}).click();
-      assert.match(await view.locator('.review-row').innerText(),/Archived/);
-      await apply('Restore to review list');
-      await view.getByRole('button',{name:'Out of date',exact:true}).click();
-      await apply('Reopen review');
-      await view.getByRole('button',{name:'Need review',exact:true}).click();
-      await view.locator('[data-review-id]').waitFor();
-      assert.equal(await view.locator('.work-results').evaluate(node=>getComputedStyle(node).display),'grid');
-      assert.equal(await view.locator('.review-row').first().evaluate(node=>getComputedStyle(node).display),'grid');
-      if (mode === "web") hold("/api/visual/vis_12345678-abcd/qa");
-      await view.locator("[data-review-id]").click();
-      if (mode === "web") {
-        await view.locator(".qa-review-loading").waitFor();
-        releaseLoading();
-        await view.locator(".qa-review-loading").waitFor({ state: "detached" });
-      }
-      await view.locator(".qa-project-pill strong").filter({ hasText: "relay" }).waitFor();
-      assert.equal(await view.locator(".qa-review-progress").textContent(), "Review 1 of 1");
-      assert.equal(await view.locator(".qa-tool-identity").count(), 0);
-      assert.equal(await view.locator(".qa-panel-head").count(), 0);
-      assert.equal(await view.locator(".qa-save-row").count(), 0);
-      assert.equal(await view.locator(".qa-overall").count(), 0);
-      assert.equal(await view.locator(".qa-details").count(), 0);
-      assert.equal(await view.locator("[data-qa-close]").count(), 0);
-      assert.equal(await view.locator(".qa-companion").evaluate(node => getComputedStyle(node).backgroundColor), "rgb(33, 31, 29)");
-      assert.equal(await view.locator(".qa-companion").evaluate(node => getComputedStyle(node).borderRadius), "28px");
-      await view.locator(".qa-camera").waitFor();
-      assert.notEqual(await view.locator(".qa-camera").evaluate(node => getComputedStyle(node).transform), "none");
-      if (mode === "web") {
-        const panel = view.locator(".qa-companion");
-        const before = await panel.boundingBox();
-        assert.ok(Math.abs(before.width - 450) < 2, "Inspector opens at the Figma 450px width");
-        await page.mouse.move(before.x + 3, before.y + 3);
-        await page.mouse.down();
-        await page.mouse.move(before.x - 90, before.y - 40, { steps: 8 });
-        await page.mouse.up();
-        const expanded = await panel.boundingBox();
-        assert.ok(expanded.width > before.width + 50, "Invisible edge resize expands the floating Inspector");
-        assert.equal(await panel.evaluate(node => getComputedStyle(node).resize), "none");
-        await panel.evaluate(node => { node.style.width = "450px"; node.style.height = ""; });
-        await page.screenshot({ path: "/tmp/relay-inspector-spatial-canvas.png" });
-      }
-      await view.getByRole("button", { name: "Yes, clear", exact: true }).click();
-      await view.locator(".qa-companion .qa-save-state").filter({ hasText: "Saved" }).waitFor();
-      assert.equal(review.evidence_id, evidence.evidence_id);
-      assert.equal(review.answers.intent, "yes");
-      assert.equal(review.overall, null);
-      await view.getByRole("button", { name: "Notes", exact: true }).click();
-      await view.locator(".qa-notes textarea").fill("A durable note on this exact capture.");
-      await view.locator(".qa-notes-popout .qa-save-state").filter({ hasText: "Saved" }).waitFor();
-      assert.equal(await view.locator(".qa-notes textarea").inputValue(), "A durable note on this exact capture.");
-      await view.getByRole("button", { name: "Done", exact: true }).click();
-      await page.keyboard.press("Escape");
-      await view.locator(".qa-stage").waitFor({ state: "detached" });
-      assert.equal(await view.locator(".work-results").evaluate(node => getComputedStyle(node).gap), "12px");
-      assert.equal(await view.locator(".operator-brand strong").evaluate(node => getComputedStyle(node).color), "rgb(251, 250, 247)");
-      await view.locator(".presentation-menu > summary").click();
-      await view.getByRole("button", { name: "Switch to light mode", exact: true }).click();
-      assert.equal(await view.locator("html").getAttribute("data-theme"), "light");
-      assert.equal(await view.locator(".operator-brand strong").evaluate(node => getComputedStyle(node).color), "rgb(181, 71, 31)");
-      await view.locator("[data-review-id]").click();
-      await view.locator(".qa-project-pill strong").waitFor();
-      assert.equal(await view.locator(".qa-companion").evaluate(node => getComputedStyle(node).backgroundColor), "rgb(240, 239, 235)");
-      await page.keyboard.press("Escape");
-      await view.locator(".qa-stage").waitFor({ state: "detached" });
-      await view.locator(".presentation-menu > summary").click();
-      await view.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
-      assert.equal(await view.locator("html").getAttribute("data-theme"), "dark");
-      assert.equal(await view.locator("#app-settings").count(), 0);
-      if (mode === "web") {
-        await page.emulateMedia({ colorScheme: "light" });
-        await page.reload();
-        assert.equal(await page.locator("html").getAttribute("data-theme"), "dark", "Manual choice survives reload and overrides system light");
-        await page.evaluate(() => localStorage.removeItem("relay-theme"));
-        await page.emulateMedia({ colorScheme: "dark" });
-        await page.goto(origin + "/legacy-components#projects?project=relay");
-        await page.locator("#project-detail").filter({ hasText: "Complete consolidation" }).waitFor();
-        assert.equal(await page.getByRole("tab", { name: "relay", exact: true }).getAttribute("aria-selected"), "true");
-        await page.screenshot({ path: "/tmp/relay-b4-dark.png" });
-        await page.setViewportSize({ width: 390, height: 844 });
-        await page.emulateMedia({ colorScheme: "light" });
-        await page.getByRole("button", { name: "today", exact: true }).click();
-        await page.locator("#operator-connection").filter({ hasText: "connected" }).waitFor();
-        assert.equal(await page.locator(".operator-topbar").evaluate(node => getComputedStyle(node).position), "relative");
-        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
-        assert.equal(overflow, false);
-        await page.screenshot({ path: "/tmp/relay-b4-mobile-light.png", fullPage: true });
-        await page.goto(origin + "/inspector#review?evidence=" + evidence.evidence_id);
-        await page.locator(".qa-stage").waitFor();
-        assert.equal(await page.locator(".qa-answer.selected").textContent(), "Yes, clear");
-        assert.equal(await page.locator(".qa-companion").evaluate(node => getComputedStyle(node).resize), "none");
-        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
-        await page.screenshot({ path: "/tmp/relay-inspector-polish-mobile.png" });
-      }
-      assert.deepEqual(errors, []);
-      await page.close();
-    }
-  } finally { releaseLoading?.(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
-});
-
diff --git a/apps/web/test/execution-browser.test.mjs b/apps/web/test/execution-browser.test.mjs
deleted file mode 100644
index 9162a95..0000000
--- a/apps/web/test/execution-browser.test.mjs
+++ /dev/null
@@ -1,30 +0,0 @@
-import test from 'node:test';
-import assert from 'node:assert/strict';
-import http from 'node:http';
-import {chromium} from 'playwright';
-import {webAssets} from '../generated.js';
-test('Shift retries the same durable intent and never presents a queued job as a process',async()=>{
- const server=http.createServer((req,res)=>{const asset=webAssets[new URL(req.url,'http://localhost').pathname];res.writeHead(asset?200:404,{'Content-Type':asset?.type||'text/plain'});res.end(asset?.text||'');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
- const browser=await chromium.launch({headless:true}),page=await browser.newPage();
- const row={assignment:'fixture',owner:'fixture-owner',branch:'relay/fixture',goal:'Synthetic execution request',state:'active',lease_until:'2099-01-01T00:00:00Z',job:null};let attempts=[];
- try{
-  await page.route('**/api/**',async route=>{const url=new URL(route.request().url());let value={};
-   if(url.pathname==='/api/projects')value={projects:[{id:'relay'}]};
-   else if(url.pathname==='/api/workers')value=[];
-   else if(url.pathname==='/api/projects/relay')value={coordination:{claims:[]}};
-   else if(url.pathname==='/api/execution/jobs')value={rows:[row],next_cursor:null};
-   else if(url.pathname==='/api/progress/relay')value={progress:[{assignment:'fixture',identities:{head_sha:'a'.repeat(40)}}]};
-   else if(url.pathname==='/api/execution/request'){
-    const args=route.request().postDataJSON();attempts.push(args);
-    if(attempts.length===1)return route.fulfill({status:503,json:{error:'Synthetic uncertain response'}});
-    row.job={id:'job_'+'b'.repeat(64),revision:2,state:args.action==='cancel'?'cancelled':'queued',observed_state:args.action==='cancel'?'cancelled':'queued'};value={ok:true,job:row.job};
-   }
-   await route.fulfill({json:value});
-  });
-  await page.goto(`http://127.0.0.1:${server.address().port}/#/night-shift`);
-  await page.getByLabel('Admitted work').selectOption('fixture');await page.getByLabel('Next bounded action').fill('Synthetic fixture only; do not start an executor.');
-  await page.getByRole('button',{name:'Shift',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic uncertain response'}).waitFor();
-  await page.getByRole('button',{name:'Shift',exact:true}).click();await page.getByText('No process start receipt.',{exact:false}).waitFor();assert.deepEqual(attempts[0],attempts[1]);
-  await page.getByRole('button',{name:'Cancel execution',exact:true}).click();await page.locator('.execution-receipt>strong').filter({hasText:'cancelled'}).waitFor();assert.equal(attempts[2].action,'cancel');assert.equal(await page.locator('.execution-receipt').textContent().then(x=>x.includes('Executor fixture')),false);
- }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
-});
diff --git a/apps/web/test/mobile-inspector.test.mjs b/apps/web/test/mobile-inspector.test.mjs
deleted file mode 100644
index 3809b8c..0000000
--- a/apps/web/test/mobile-inspector.test.mjs
+++ /dev/null
@@ -1,70 +0,0 @@
-import test from 'node:test';
-import assert from 'node:assert/strict';
-import { chromium } from 'playwright';
-import { mkdir } from 'node:fs/promises';
-import { contextFixture } from './project-context-fixture.mjs';
-
-test('mobile Runner stays within the document and the accent scrolls away', {timeout:30000}, async()=>{
-  const fixture=await contextFixture(), browser=await chromium.launch({headless:true});
-  try {
-    for (const width of [320,390]) {
-      const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
-      await page.route('**/api/progress/relay?*',async route=>{
-        const response=await route.fetch(), body=await response.json();
-        for(const item of body.progress||[]) item.next_action='Review '+ 'very-long-unbroken-evidence-identifier'.repeat(30);
-        await route.fulfill({json:body});
-      });
-      await page.goto(fixture.origin+'/#/runner');
-      await page.locator('.work-item').first().waitFor();
-      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page has no horizontal overflow at '+width);
-      await page.evaluate(()=>window.scrollTo(0,300));
-      await page.waitForFunction(()=>scrollY>100);
-      assert.ok((await page.locator('.terra-accent').boundingBox()).y<0,'accent scrolls with page');
-      await mkdir('qa-evidence/website',{recursive:true});
-      await page.screenshot({path:'qa-evidence/website/mobile-'+width+'-'+(await page.locator('.qa-stage').count()?'inspector':'runner')+'.png'});
-      await page.close();
-    }
-  } finally { await browser.close(); await fixture.close(); }
-});
-
-test('mobile Inspector exposes all answers and supports real touch pan pinch and fit', {timeout:30000}, async()=>{
-  const fixture=await contextFixture(), browser=await chromium.launch({headless:true});
-  try {
-    for(const width of [320,390]) {
-      const page=await browser.newPage({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'});
-      const evidence={evidence_id:'vis_context-capture-relay',screenshot_url:'/api/visual/vis_context-capture-relay/image',context:{project:'relay'},viewport:{width:1440,height:900}};
-      await page.route('**/api/visual/*/qa',route=>route.fulfill({json:{evidence,review:{answers:{},notes:'',overall:null},questions:[{id:'one',prompt:'Does Actual website night-shift-1440 look like what you intended?',reason:'Runner needs your visual judgment, not another automated check.'}]}}));
-      await page.goto(fixture.origin+'/inspector#review?evidence='+evidence.evidence_id);
-      await page.locator('.qa-answer').first().waitFor();
-      await page.waitForFunction(()=>document.querySelector('.qa-camera')?.style.transform.includes('scale('));
-      assert.equal(await page.locator('.qa-question-content').evaluate(n=>n.scrollHeight<=n.clientHeight+1),true,'normal question needs no internal scroll');
-      const panel=await page.locator('.qa-companion').boundingBox();
-      for(const selector of ['[data-qa-answer=yes]','[data-qa-answer=no]','[data-qa-answer=not_sure]','[data-qa-finish]']) {
-        const button=page.locator(selector);
-        assert.equal(await button.count(),1,selector+' exists');
-        const box=await button.boundingBox();
-        assert.ok(box.y>=panel.y && box.y+box.height<=panel.y+panel.height+1,selector+' visible in panel');
-      }
-      assert.ok((await page.getByRole('button',{name:'Hide questions',exact:true}).boundingBox()).width<=48);
-      await page.getByRole('button',{name:'Hide questions',exact:true}).click();
-      const camera=()=>page.locator('.qa-camera').evaluate(n=>{const m=new DOMMatrixReadOnly(getComputedStyle(n).transform);return {x:m.e,y:m.f,scale:m.a};});
-      const before=await camera(), cdp=await page.context().newCDPSession(page);
-      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:180,id:1}]});
-      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:145,y:200,id:1}]});
-      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
-      const moved=await camera();assert.ok(Math.abs(moved.x-before.x-25)<1);assert.ok(Math.abs(moved.y-before.y-20)<1);
-      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:180,id:1},{x:200,y:180,id:2}]});
-      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:180,id:1},{x:220,y:180,id:2}]});
-      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
-      assert.ok((await camera()).scale>moved.scale*1.4,'pinch changes zoom');
-      await page.getByRole('button',{name:'Fit preview',exact:true}).click();
-      assert.ok(Math.abs((await camera()).scale-before.scale)<0.001);
-      await page.getByRole('button',{name:'Show questions',exact:true}).click();
-      assert.equal(await page.locator('.qa-companion').isVisible(),true);
-      await mkdir('qa-evidence/website',{recursive:true});
-      await page.screenshot({path:'qa-evidence/website/mobile-'+width+'-'+(await page.locator('.qa-stage').count()?'inspector':'runner')+'.png'});
-      await page.close();
-    }
-  } finally {await browser.close();await fixture.close();}
-});
-
diff --git a/apps/web/test/motion.test.mjs b/apps/web/test/motion.test.mjs
deleted file mode 100644
index 32ddd02..0000000
--- a/apps/web/test/motion.test.mjs
+++ /dev/null
@@ -1,61 +0,0 @@
-import test from 'node:test';
-import assert from 'node:assert/strict';
-import { chromium } from 'playwright';
-import { contextFixture } from './project-context-fixture.mjs';
-
-async function settle(page, inspector) {
-  if(inspector) await page.locator('#review-list[data-summary-state=ready]').waitFor();
-  else {await page.locator('.operator-connection[data-tone=good]').waitFor();await page.locator('[data-progress-notice]').waitFor({state:'detached'});}
-}
-
-test('site motion bridges moving controls and Inspector effects, with strict mobile budget and global Calm', {timeout:20000}, async () => {
-  const fixture=await contextFixture(),browser=await chromium.launch();
-  try {
-    for(const width of [1440,390,320]) for(const inspector of [false,true]) {
-      const page=await browser.newPage({viewport:{width,height:844},colorScheme:'dark',reducedMotion:'no-preference'});
-      await page.goto(fixture.origin+(inspector?'/inspector#review':'/#/today'));await settle(page,inspector);
-      if(width<=900) {
-        assert.ok((await page.locator('.operator-topbar').boundingBox()).height<=140,'compact header with top nav');
-        await page.locator('.presentation-menu > summary').click();await page.locator('[name=preset]').selectOption('bottom');await page.keyboard.press('Escape');
-        const header=await page.locator('.operator-topbar').boundingBox();assert.ok(header.height<=61,'brand/tools row with bottom nav');
-        const brand=await page.locator('.operator-brand').boundingBox(),brush=await page.locator('.presentation-menu > summary').boundingBox();assert.ok(Math.abs(brand.y+brand.height/2-brush.y-brush.height/2)<=2);
-      }
-      // Finish earlier menu/glyph entrances before testing the separate control transition.
-      await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(animation=>animation.id==='relay-motion-blur' && animation.playState==='running').map(animation=>animation.finished.catch(()=>{})));});
-      const observed=await page.evaluate(async () => {
-        // Real transition events on existing interactive glyph layers.
-        const nodes=[...document.querySelectorAll('.signal-mark')];
-        // Observe the event itself; wall-clock sampling races under aggregate load.
-        await new Promise((resolve,reject)=>{
-          const timer=setTimeout(()=>{document.removeEventListener('transitionrun',onRun);reject(Error('Moving glyph transition did not start'));},1500);
-          function onRun(event) {if(event.propertyName==='transform' && nodes.includes(event.target)) {clearTimeout(timer);document.removeEventListener('transitionrun',onRun);resolve();}}
-          document.addEventListener('transitionrun',onRun);
-          for(const node of nodes) {getComputedStyle(node).transform;node.style.transition='transform 300ms';node.style.transform='translateY(-3px)';}
-        });
-        const effects=nodes.flatMap(node=>node.getAnimations()).filter(a=>a.id==='relay-motion-blur');
-        const frames=effects.map(a=>a.effect.getKeyframes());
-        const durations=effects.map(a=>a.effect.getTiming().duration);
-        await Promise.all(effects.map(a=>a.finished));
-        return {count:effects.length,frames,durations,rest:nodes.map(node=>getComputedStyle(node).filter)};
-      });
-      assert.ok(observed.count>0 && observed.count<=(width<=900?2:4),JSON.stringify({width,inspector,observed}));
-      assert.ok(observed.frames.every(frames=>frames.some(frame=>/blur/.test(frame.filter)) && frames.at(-1).filter==='none'));
-      assert.ok(observed.durations.every(duration=>duration<=(width<=900?240:400)));
-      assert.ok(observed.rest.every(filter=>filter==='none'),'no resting text/filter smear');
-      await page.locator('.presentation-menu > summary').click();await page.locator('.presentation-customize > summary').click();await page.locator('[name=motion]').selectOption('calm');
-      const calm=await page.evaluate(() => {
-        // Important legacy QA animation plus loading/status loops must all stop.
-        const edge=document.createElement('div');edge.className='qa-companion qa-edge-wiggle';edge.dataset.docked='left';document.body.append(edge);
-        const light=document.createElement('span');light.dataset.signal='working';light.innerHTML='<span class="status-light"></span>';document.body.append(light);
-        const skeleton=document.createElement('span');skeleton.className='skeleton-block';document.body.append(skeleton);
-        const names=[edge,skeleton,light.firstChild].map(node=>getComputedStyle(node).animationName);names.push(getComputedStyle(light.firstChild,'::after').animationName);
-        const result={names,animations:document.getAnimations().filter(a=>a.playState==='running').length};edge.remove();light.remove();skeleton.remove();return result;
-      });
-      assert.ok(calm.names.every(name=>name==='none'));assert.equal(calm.animations,0);
-      await page.locator('[name=motion]').selectOption('full');await page.emulateMedia({reducedMotion:'reduce'});
-      assert.equal(await page.locator('.signal-card').first().evaluate(node=>getComputedStyle(node).animationName),'none');
-      assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
-      await page.close();
-    }
-  } finally {await browser.close();await fixture.close();}
-});
diff --git a/apps/web/test/notifications-review.test.mjs b/apps/web/test/notifications-review.test.mjs
index 1bf3501..98bea3e 100644
--- a/apps/web/test/notifications-review.test.mjs
+++ b/apps/web/test/notifications-review.test.mjs
@@ -1,15 +1,6 @@
 import test from 'node:test';
 import assert from 'node:assert/strict';
-import { chromium } from 'playwright';
-import { mkdir } from 'node:fs/promises';
-import { contextFixture } from './project-context-fixture.mjs';
-import { splitReviewNotes, joinReviewNotes } from '../public/qa-notes.js';
-
-async function fillNotes(page, text) {
-  await page.getByRole('button',{name:'Notes',exact:true}).click();
-  await page.locator('.qa-notes textarea').fill(text);
-  await page.getByRole('button',{name:'Done',exact:true}).click();
-}
+import {splitReviewNotes,joinReviewNotes} from '../public/qa-notes.js';
 
 const marker='Agent-prepared review packet (pending human judgment):';
 const packet=marker+'\n'+JSON.stringify({title:'Old guidance',questions:[{prompt:'Check "quoted" text and braces } safely.'}]});
@@ -19,209 +10,3 @@ test('Legacy guidance preserves original packet and every human note character',
   assert.equal(parts.prefix,packet);assert.equal(parts.notes,notes);assert.equal(joinReviewNotes(parts.prefix,parts.notes),combined);
   for(const text of ['{"questions":[]}',marker+'\nnot JSON',marker+'\n{"title":"mine"}']) assert.equal(splitReviewNotes(text).notes,text);
 });
-
-test('Notifications retain attention after dismiss/timeout and survive Inspector round trips', {timeout:20000},async()=>{
-  const fixture=await contextFixture(),browser=await chromium.launch({headless:true});
-  try{
-    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',colorScheme:'dark'});
-    await page.goto(fixture.origin+'/#/today');
-    await page.locator('.notification-toasts .notification-message').waitFor();
-    const badge=await page.locator('[data-notification-count]').evaluate(node=>({text:node.textContent,width:node.offsetWidth,height:node.offsetHeight,radius:getComputedStyle(node).borderRadius,animation:getComputedStyle(node).animationName}));
-    assert.equal(badge.text,'1');assert.equal(badge.width,badge.height);assert.equal(badge.radius,'50%');assert.equal(badge.animation,'none');
-    assert.match(await page.locator('.notification-toasts').innerText(),/Night Shift · field/);
-    await page.getByRole('button',{name:'Dismiss notification',exact:true}).click();
-    await page.getByRole('button',{name:/^Notifications/}).click();
-    assert.match(await page.locator('.notification-menu').innerText(),/Toast dismissed/);
-    assert.match(await page.locator('.notification-menu').innerText(),/Needs attention/);
-    const menuRect=await page.locator('.notification-menu').boundingBox();assert.ok(menuRect.x>=0 && menuRect.x+menuRect.width<=390,'mobile menu fits the viewport');
-    await page.keyboard.press('Escape');assert.match(await page.locator(':focus').getAttribute('aria-label'),/^Notifications/);
-    await page.goto(fixture.origin+'/inspector');await page.locator('#review-list[data-summary-state="ready"]').waitFor();
-    await page.getByRole('button',{name:/^Notifications/}).click();assert.match(await page.locator('.notification-menu').innerText(),/field/);
-    await page.keyboard.press('Escape');await page.goto(fixture.origin+'/#/today');
-    assert.equal(await page.locator('.notification-toasts .notification-message').count(),0);
-    assert.equal(await page.locator('.notification-announcement').evaluate(node=>node.getBoundingClientRect().width),1);
-    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
-    const timeoutPage=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'dark'});
-    await timeoutPage.clock.install();await timeoutPage.goto(fixture.origin+'/#/today');await timeoutPage.locator('.notification-toasts .notification-message').waitFor();
-    assert.equal(await timeoutPage.locator('[data-notification-count]').evaluate(node=>getComputedStyle(node).animationName),'notification-count-pulse');
-    await timeoutPage.evaluate(()=>document.documentElement.dataset.presentationMotion='calm');assert.equal(await timeoutPage.locator('[data-notification-count]').evaluate(node=>getComputedStyle(node).animationName),'none');await timeoutPage.evaluate(()=>delete document.documentElement.dataset.presentationMotion);
-    await timeoutPage.locator('.notification-toasts a').focus();await timeoutPage.clock.fastForward(11000);
-    assert.equal(await timeoutPage.locator('.notification-toasts .notification-message').count(),1,'focused notification stays available');
-    await timeoutPage.locator('.notification-bell').focus();await timeoutPage.clock.fastForward(11000);
-    assert.equal(await timeoutPage.locator('.notification-toasts .notification-message').count(),0);
-    await timeoutPage.getByRole('button',{name:/^Notifications/}).click();assert.match(await timeoutPage.locator('.notification-menu').innerText(),/Needs attention/);
-    await mkdir('/tmp/relay-next-evidence',{recursive:true});await timeoutPage.screenshot({path:'/tmp/relay-next-evidence/notifications-desktop.png'});
-  }finally{await browser.close();await fixture.close();}
-});
-
-test('Review navigation, exact notes, sequential saves, retry and authorized preview fallback',{timeout:30000},async()=>{
-  const fixture=await contextFixture(),browser=await chromium.launch({headless:true});
-  let review={answers:{},notes:joinReviewNotes(packet,'Original human note'),overall:null,updated_at:'2026-10-01T00:00:00Z'},fail=false,slow=false,release;
-  const writes=[];const evidence={evidence_id:'vis_context-capture-relay',screenshot_url:'/api/visual/vis_context-capture-relay/image',context:{project:'relay'},viewport:{width:1440,height:900}};
-  try{
-    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',colorScheme:'dark'});
-    await page.route('**/api/visual/*/qa',async route=>{
-      if(route.request().method()==='POST'){
-        const payload=route.request().postDataJSON();writes.push(payload);
-        if(slow)await new Promise(resolve=>release=resolve);
-        if(fail)return route.fulfill({status:503,json:{error:'Fixture save unavailable'}});
-        review={...payload,updated_at:new Date().toISOString()};return route.fulfill({json:{review}});
-      }
-      await route.fulfill({json:{evidence,review,questions:[{id:'one',prompt:'Is the first step clear?'},{id:'two',prompt:'Is the result readable?'}]}});
-    });
-    await page.route('**/api/visual/*/live',route=>route.fulfill({status:503,json:{error:'No authorized live preview'}}));
-    await page.goto(fixture.origin+'/inspector#review?evidence='+evidence.evidence_id);
-    await page.locator('.qa-question').filter({hasText:'first step'}).waitFor();
-    assert.equal(await page.locator('.qa-notes textarea').inputValue(),'Original human note');
-    assert.equal(await page.locator('.qa-verdict').count(),0);
-    const navigation=await page.locator('.qa-question-nav').evaluate(node=>({alignment:getComputedStyle(node).justifyContent,back:getComputedStyle(node.querySelector('[data-qa-previous]')).backgroundColor,primary:getComputedStyle(node.querySelector('[data-qa-next]')).backgroundColor}));
-    assert.equal(navigation.alignment,'flex-end');assert.notEqual(navigation.back,navigation.primary,'main action has a distinct accent');
-    assert.equal(await page.locator('.qa-preview-picker select').inputValue(),'captured');
-    assert.match(await page.locator('.qa-preview-state').innerText(),/unavailable/);
-    await page.getByRole('button',{name:'Yes, clear',exact:true}).click();
-    assert.match(await page.locator('.qa-question').innerText(),/first step/);
-    await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Back',exact:true}).click();
-    assert.equal(await page.locator('[data-qa-answer=yes]').getAttribute('aria-pressed'),'true');
-    await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Not sure',exact:true}).first().click();
-
-    await page.locator('.qa-companion [data-qa-save-state]').filter({hasText:'Saved'}).waitFor();
-    slow=true;await fillNotes(page,'First edit');await page.locator('.qa-companion [data-qa-save-state]').filter({hasText:'Saving'}).waitFor();
-    while(!release)await new Promise(resolve=>setTimeout(resolve,20));
-    await fillNotes(page,'  Latest exact note\n');slow=false;release();
-    await page.locator('.qa-companion [data-qa-save-state]').filter({hasText:'Saved'}).waitFor();assert.equal(splitReviewNotes(review.notes).notes,'  Latest exact note\n');
-    fail=true;await fillNotes(page,'Kept during failure');await page.getByRole('button',{name:'Retry save'}).waitFor();
-    await page.getByRole('button',{name:'Back',exact:true}).click();assert.match(await page.locator('.qa-companion [data-qa-save-state]').innerText(),/failed/);
-    await page.reload();await page.getByRole('button',{name:'Retry save'}).waitFor();assert.equal(await page.locator('.qa-notes textarea').inputValue(),'Kept during failure');
-    assert.match(await page.locator('.qa-companion [data-qa-save-state]').innerText(),/Recovered unsaved/);
-    fail=false;await page.getByRole('button',{name:'Retry save'}).click();await page.locator('.qa-companion [data-qa-save-state]').filter({hasText:'Saved'}).waitFor();
-    await page.getByRole('button',{name:'Hide questions'}).click();assert.equal(await page.locator('.qa-companion').isVisible(),false);
-    await page.getByRole('button',{name:'Show questions'}).click();assert.equal(await page.locator('.qa-companion').isVisible(),true);
-    await mkdir('/tmp/relay-next-evidence',{recursive:true});await page.screenshot({path:'/tmp/relay-next-evidence/review-mobile.png'});
-    if(await page.locator('[data-qa-next]').count())await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Finish',exact:true}).click();await page.locator('.qa-stage').waitFor({state:'detached'});
-    assert.equal(splitReviewNotes(review.notes).notes,'Kept during failure');assert.ok(writes.length>=4);
-  }finally{release?.();await browser.close();await fixture.close();}
-});
-
-test('Authorized Live is preferred while an explicit Captured choice survives question navigation', {timeout:15000},async()=>{
- const fixture=await contextFixture(),browser=await chromium.launch();
- try{
-  const page=await browser.newPage({viewport:{width:320,height:740},colorScheme:'light'});
-  const evidence={evidence_id:'vis_context-capture-relay',screenshot_url:'/api/visual/vis_context-capture-relay/image',context:{project:'relay'}};
-  await page.route('**/api/visual/*/qa',route=>route.fulfill({json:{evidence,review:{answers:{},notes:'',overall:null},questions:[{id:'first',prompt:'First question'},{id:'last',prompt:'Last question'}]}}));
-  await page.route('**/api/visual/*/live',route=>route.fulfill({json:{live:{active:true,embeddable:true,url:fixture.origin+'/authorized-preview'}}}));
-  await page.route('**/authorized-preview',route=>route.fulfill({contentType:'text/html',body:'<main>Actual fixture live preview</main>'}));
-  await page.goto(fixture.origin+'/inspector#review?evidence='+evidence.evidence_id);await page.locator('.qa-question').waitFor();
-  assert.equal(await page.locator('.qa-preview-picker select').inputValue(),'live');
-  const compact=await page.locator('.qa-companion').boundingBox();assert.ok(compact.width>=280 && compact.width<=296 && compact.height<=360);assert.ok(compact.width*compact.height<320*740/3,'mobile questions leave most of the preview visible');
-  for(const selector of ['[data-qa-answer=yes]','[data-qa-answer=no]','[data-qa-answer=not_sure]','[data-qa-next]']){const control=await page.locator(selector).boundingBox();assert.ok(control.height>=44,'compact controls retain touch height');assert.ok(control.y>=compact.y && control.y+control.height<=compact.y+compact.height,'compact primary controls remain fully visible');}
-  await page.locator('.qa-preview-state').filter({hasText:/^Live preview$/}).waitFor();
-  const firstChoice=await page.locator('[data-qa-answer=yes]').boundingBox(),secondChoice=await page.locator('[data-qa-answer=no]').boundingBox();assert.equal(firstChoice.y,secondChoice.y);assert.ok(secondChoice.x>=firstChoice.x+firstChoice.width,'mobile choices share a visible row while retaining 44px touch targets');
-  assert.equal(await page.locator('.qa-question-content').evaluate(node=>node.scrollHeight<=node.clientHeight+1),true,'ordinary questions require no internal scrolling');
-  await page.getByRole('button',{name:'Notes',exact:true}).click();
-  assert.equal(await page.locator('.qa-notes-popout').getAttribute('open'),'');
-  assert.equal(await page.locator('.qa-notes textarea').evaluate(node=>document.activeElement===node),true);
-  await page.keyboard.press('Shift+Tab');await page.keyboard.press('Shift+Tab');
-  assert.equal(await page.locator('.qa-notes-popout').evaluate(node=>node.contains(document.activeElement)),true,'notes traps keyboard focus');
-  await page.screenshot({path:'/tmp/relay-mobile-notes-working.png'});
-  await page.keyboard.press('Escape');assert.equal(await page.locator('.qa-notes-popout').isVisible(),false);assert.equal(await page.locator('.qa-stage').isVisible(),true);
-  assert.equal(await page.locator('[data-qa-notes-open]').evaluate(node=>document.activeElement===node),true);
-  await page.screenshot({path:'/tmp/relay-mobile-stacked-working.png'});
-  await page.locator('.qa-preview-picker select').selectOption('captured');await page.getByRole('button',{name:'Next',exact:true}).click();
-  assert.equal(await page.locator('.qa-preview-picker select').inputValue(),'captured');
-  await page.getByRole('button',{name:'Hide questions'}).click();
-  for(const selector of ['.qa-exit','.qa-preview-picker','.qa-panel-toggle']) {const rect=await page.locator(selector).boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=320&&rect.y+rect.height<=740);}
-  await page.keyboard.press('Escape');await page.locator('.qa-stage').waitFor({state:'detached'});
- }finally{await browser.close();await fixture.close();}
-});
-
-test('A growing failed-save message keeps the desktop panel clear of floating controls', {timeout:15000},async()=>{
- const fixture=await contextFixture(),browser=await chromium.launch();
- try{
-  const page=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'dark'});
-  const evidence={evidence_id:'vis_context-capture-relay',screenshot_url:'/api/visual/vis_context-capture-relay/image',context:{project:'relay'}};
-  await page.route('**/api/visual/*/qa',route=>route.fulfill(route.request().method()==='POST'?{status:503,json:{error:'Fixture unavailable. Responses remain locally recoverable while the provider recovers.'}}:{json:{evidence,review:{answers:{},notes:'',overall:null},questions:[{id:'one',prompt:'Does the review remain usable after a failed save?'}]}}));
-  await page.route('**/api/visual/*/live',route=>route.fulfill({json:{live:{active:false}}}));
-  await page.goto(fixture.origin+'/inspector#review?evidence='+evidence.evidence_id);await page.locator('.qa-question').waitFor();
-  await page.getByRole('button',{name:'Yes, clear',exact:true}).click();
-  await page.getByRole('button',{name:'Retry save'}).waitFor();
-  await page.locator('.qa-companion').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
-  const panel=await page.locator('.qa-companion').boundingBox(),toggle=await page.locator('.qa-panel-toggle').boundingBox();
-  assert.ok(panel.y+panel.height<=toggle.y,'failed-save feedback cannot grow beneath Hide questions');
-  await page.getByRole('button',{name:'Retry save'}).click();await page.locator('.qa-companion [data-qa-save-state]').filter({hasText:'failed'}).waitFor();
- }finally{await browser.close();await fixture.close();}
-});
-
-test('Reopening during a save cannot replace confirmed responses with an older in-flight GET', {timeout:30000},async()=>{
- const fixture=await contextFixture(),browser=await chromium.launch();
- let review={answers:{},notes:'Old note',overall:null,updated_at:'2026-10-01T00:00:00Z'},holdLive=false,releasePost,releaseGet,postStarted,getStarted,qaReadStarted;
- const postGate=new Promise(resolve=>releasePost=resolve),getGate=new Promise(resolve=>releaseGet=resolve);
- const postSignal=new Promise(resolve=>postStarted=resolve),getSignal=new Promise(resolve=>getStarted=resolve),qaReadSignal=new Promise(resolve=>qaReadStarted=resolve);
- try{
-  const page=await browser.newPage({colorScheme:'dark'});
-  const evidence={evidence_id:'vis_context-capture-relay',screenshot_url:'/api/visual/vis_context-capture-relay/image',context:{project:'relay'}};
-  await page.route('**/api/visual/*/qa',async route=>{
-   if(route.request().method()==='POST'){const payload=route.request().postDataJSON();postStarted();await postGate;review={...payload,updated_at:new Date().toISOString()};return route.fulfill({json:{review}});}
-   const snapshot=structuredClone(review);if(holdLive)qaReadStarted();
-   return route.fulfill({json:{evidence,review:snapshot,questions:[{id:'one',prompt:'Is the result clear?'}]}});
-  });
-  await page.route('**/api/visual/*/live',async route=>{if(holdLive){getStarted();await getGate;}return route.fulfill({json:{live:{active:false}}});});
-  await page.goto(fixture.origin+'/inspector#review?evidence='+evidence.evidence_id);await page.locator('.qa-question').waitFor();
-  await page.getByRole('button',{name:'No, needs work',exact:true}).click();await fillNotes(page,'Newest confirmed note');
-  const signal=async(promise,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Regression phase timed out: '+label)),5000))]);}finally{clearTimeout(timer);}};
-  await page.evaluate(()=>{window.__exitPopped=false;addEventListener('popstate',()=>window.__exitPopped=true,{once:true});});
-  await page.getByRole('button',{name:'Exit review'}).click();await signal(postSignal,'pending POST started');
-  // Wait for the popstate event, not just its earlier history-state update.
-  await page.waitForFunction(()=>window.__exitPopped,null,{timeout:5000});
-  holdLive=true;const reopen=page.locator('[data-review-id="'+evidence.evidence_id+'"]');
-  // Exit's pointer position can hover-expand the desktop sidebar over the opener.
-  // Move away and focus the ordinary opener so neither hover nor nav focus holds it open.
-  await page.mouse.move(1200,680);await reopen.focus();
-  await page.waitForFunction(()=>document.querySelector('.operator-topbar').getBoundingClientRect().width<100,null,{timeout:5000});
-  await reopen.click({timeout:5000});await signal(Promise.all([getSignal,qaReadSignal]),'reopened live read and stale QA snapshot');
-  releasePost();await page.waitForFunction(id=>sessionStorage.getItem('relay.qa.draft.v1.'+id)===null,evidence.evidence_id,{timeout:5000});
-  releaseGet();await page.locator('.qa-question').waitFor();
-  assert.equal(await page.locator('.qa-notes textarea').inputValue(),'Newest confirmed note');
-  assert.equal(await page.locator('[data-qa-answer=no]').getAttribute('aria-pressed'),'true');
-  assert.equal(await page.locator('.qa-verdict').count(),0);
-  assert.equal(await page.locator('.qa-companion [data-qa-save-state]').innerText(),'Saved');
-  await page.locator('[data-qa-answer=yes]').click();await page.locator('.qa-companion [data-qa-save-state]').filter({hasText:'Saved'}).waitFor();assert.equal(review.notes,'Newest confirmed note','the next write must preserve the confirmed note');
- }finally{releasePost();releaseGet();await browser.close();await fixture.close();}
-});
-
-test('Known iframe failures fall back; cross-origin absence of a handshake is explicitly unconfirmed', {timeout:25000},async()=>{
- const fixture=await contextFixture(),other=await contextFixture(),browser=await chromium.launch();
- try{
-  for(const failure of ['http','framing','network','unverified']){
-   const page=await browser.newPage({colorScheme:'dark',viewport:{width:320,height:740}});await page.clock.install();
-   await page.addInitScript(()=>{window.__iframeErrors=0;new MutationObserver(()=>{const frame=document.querySelector('[data-qa-live-preview]');if(frame&&!frame.dataset.observed){frame.dataset.observed='true';frame.addEventListener('error',()=>window.__iframeErrors++);}}).observe(document,{subtree:true,childList:true});});
-   const evidence={evidence_id:'vis_context-capture-relay',screenshot_url:'/api/visual/vis_context-capture-relay/image',context:{project:'relay'}};
-   await page.route('**/api/visual/*/qa',route=>route.fulfill({json:{evidence,review:{answers:{},notes:'',overall:null},questions:[{id:'one',prompt:'Review this capture'}]}}));
-   await page.route('**/api/visual/*/live',route=>route.fulfill({json:{live:{active:true,embeddable:true,status:200,url:(failure==='unverified'?other.origin:fixture.origin)+'/broken-preview'}}}));
-   await page.route('**/broken-preview',route=>failure==='network'?route.abort('connectionrefused'):route.fulfill({status:failure==='http'?404:200,contentType:'text/html',headers:failure==='framing'?{'Content-Security-Policy':"frame-ancestors 'none'"}:{},body:'<main>Unavailable preview</main>'}));
-   await page.goto(fixture.origin+'/inspector#review?evidence='+evidence.evidence_id);await page.locator('.qa-question').waitFor();
-   await page.clock.fastForward(9000);
-   assert.equal(await page.locator('.qa-preview-picker select').inputValue(),failure==='unverified'?'live':'captured',failure+' keeps an honest preview state');
-   assert.match(await page.locator('.qa-preview-state').innerText(),/unconfirmed/);
-   const caption=await page.locator('.qa-preview-state').boundingBox(),panel=await page.locator('.qa-companion').boundingBox(),toggle=await page.locator('.qa-panel-toggle').boundingBox();assert.ok(caption.y>=panel.y+panel.height,'fallback caption stays below the panel');assert.ok(caption.x+caption.width<=toggle.x,'fallback caption stays beside Hide questions');
-   assert.equal(await page.evaluate(()=>window.__iframeErrors),0,'browser failure does not provide iframe error proof');
-   await page.close();
-  }
- }finally{await browser.close();await fixture.close();await other.close();}
-});
-
-test('A failed navigation invalidates previously confirmed iframe readiness', {timeout:15000},async()=>{
- const fixture=await contextFixture(),browser=await chromium.launch();
- try{
-  const page=await browser.newPage({colorScheme:'dark'});await page.clock.install();
-  const evidence={evidence_id:'vis_context-capture-relay',screenshot_url:'/api/visual/vis_context-capture-relay/image',context:{project:'relay'}};
-  await page.route('**/api/visual/*/qa',route=>route.fulfill({json:{evidence,review:{answers:{},notes:'',overall:null},questions:[{id:'one',prompt:'Review this capture'}]}}));
-  await page.route('**/api/visual/*/live',route=>route.fulfill({json:{live:{active:true,embeddable:true,status:200,url:fixture.origin+'/authorized-preview'}}}));
-  await page.route('**/authorized-preview',route=>route.fulfill({contentType:'text/html',body:'<main>Available preview <a href="/broken-preview">Broken destination</a></main>'}));
-  await page.route('**/broken-preview',route=>route.fulfill({status:404,contentType:'text/html',body:'<main>Not found</main>'}));
-  await page.goto(fixture.origin+'/inspector#review?evidence='+evidence.evidence_id);await page.locator('.qa-preview-state').filter({hasText:/^Live preview$/}).waitFor();
-  await page.frameLocator('[data-qa-live-preview]').getByRole('link',{name:'Broken destination'}).click();
-  await page.locator('.qa-preview-state').filter({hasText:'Checking live preview'}).waitFor();await page.clock.fastForward(9000);
-  assert.equal(await page.locator('.qa-preview-picker select').inputValue(),'captured');assert.match(await page.locator('.qa-preview-state').innerText(),/unconfirmed/);
- }finally{await browser.close();await fixture.close();}
-});
-
diff --git a/apps/web/test/presentation-copy.test.mjs b/apps/web/test/presentation-copy.test.mjs
index 6ff73b9..ece562e 100644
--- a/apps/web/test/presentation-copy.test.mjs
+++ b/apps/web/test/presentation-copy.test.mjs
@@ -6,22 +6,7 @@ test('display copy preserves meaningful work distinctions and unknown states',()
  assert.notEqual(statusLabel('deployed'),statusLabel('verified'));
  assert.equal(statusLabel('unknown-new-state'),'status not reported');
  assert.equal(phaseLabel(undefined),'phase not reported');
- assert.equal(eventLabel('pr-opened'),'pull request opened');
+ assert.equal(eventLabel('pr-opened'),'ready for review');
  assert.equal(summaryText('Node.js ENOBUFS packet error','A check needs help.'),'A check needs help.');
  assert.equal(summaryText('Review the new header','Next step unknown'),'Review the new header');
 });
-test('website labels distinguish observed facts from readiness, scheduling and progress',()=>{
- assert.equal(statusLabel('reserved-but-idle'),'waiting to start');
- assert.equal(statusLabel('active'),'assigned');
- assert.equal(statusLabel('enabled'),'enabled');
- assert.equal(statusLabel('idle'),'idle');
- assert.equal(statusLabel('waiting-for-human'),'needs review');
- assert.equal(eventLabel('source-commit'),'source change recorded');
- assert.equal(eventLabel('cloud-deployment'),'deployment recorded');
- assert.equal(phaseLabel('review'),'review');
- for(const value of ['constructor','__proto__','toString']){
-  assert.equal(statusLabel(value),'status not reported');
-  assert.equal(phaseLabel(value),'phase not reported');
-  assert.equal(eventLabel(value),'progress update');
- }
-});
diff --git a/apps/web/test/presentation-layout.test.mjs b/apps/web/test/presentation-layout.test.mjs
deleted file mode 100644
index 839a7aa..0000000
--- a/apps/web/test/presentation-layout.test.mjs
+++ /dev/null
@@ -1,54 +0,0 @@
-import test from 'node:test';
-import assert from 'node:assert/strict';
-import {chromium} from 'playwright';
-import {contextFixture} from './project-context-fixture.mjs';
-async function settle(page,inspector) {
- if(inspector) await page.locator('#review-list[data-summary-state=ready]').waitFor();
- else {await page.locator('.operator-connection[data-tone=good]').waitFor();await page.locator('[data-progress-notice]').waitFor({state:'detached'});}
-}
-async function checkClearance(page,desktop) {
- await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
- const geometry=await page.evaluate(desktop=>{
-  const bar=document.querySelector(desktop?'.operator-topbar':'.operator-nav'),page=[...document.querySelectorAll('.operator-page')].find(node=>node.getClientRects().length && !node.hidden);
-  return {bar:bar.getBoundingClientRect().toJSON(),content:page.getBoundingClientRect().toJSON(),padding:parseFloat(getComputedStyle(document.querySelector('.operator-shell')).paddingBottom),overflow:document.documentElement.scrollWidth>innerWidth};
- },desktop);
- assert.ok(geometry.content.bottom<=geometry.bar.top-12,JSON.stringify(geometry));assert.equal(geometry.overflow,false);
- const lastControl=page.locator('.operator-shell :is(a,button,input,select,summary)').filter({visible:true}).last();
- if(await lastControl.count()) {await lastControl.focus();await lastControl.evaluate(node=>node.scrollIntoView({block:'center'}));const rect=await lastControl.boundingBox();assert.ok(rect.y>=0 && rect.y+rect.height<=geometry.bar.top,'last control fully reachable');}
- await page.evaluate(()=>window.scrollTo(0,0));
-}
-test('optional desktop layouts retain identity and four destinations; measured dock clearance survives enlarged wrapped text',async()=>{
- const fixture=await contextFixture(),browser=await chromium.launch({headless:true});
- try {
-  for(const width of [1024,1440]) for(const inspector of [false,true]) for(const preset of ['desktop-bottom']) {
-   const page=await browser.newPage({viewport:{width,height:844},colorScheme:'dark',reducedMotion:'reduce'});
-   await page.goto(fixture.origin+(inspector?'/inspector#review':'/#/today'));await settle(page,inspector);
-   assert.equal(await page.locator('html').getAttribute('data-presentation-desktop'),'rail');
-   await page.mouse.move(width-1,1);
-   const brand=await page.locator('.operator-brand').evaluate(node=>({padding:getComputedStyle(node).padding,gap:getComputedStyle(node).gap,width:node.getBoundingClientRect().width}));assert.equal(brand.width,68);assert.equal(brand.gap,'6px');assert.equal(brand.padding,'14px 8px');
-   await page.locator('.presentation-menu > summary').click();await page.locator('[name=preset]').selectOption(preset);await page.keyboard.press('Escape');
-   const variant=await page.locator('.operator-topbar').evaluate(node=>({rect:node.getBoundingClientRect().toJSON(),brand:node.querySelector('.operator-brand').getBoundingClientRect().toJSON(),targets:[...node.querySelectorAll('.operator-nav > :is(a,button)')].map(item=>item.getBoundingClientRect().toJSON()),title:document.querySelector('.feature-heading').getBoundingClientRect().toJSON()}));
-   assert.equal(variant.targets.length,4);assert.ok(variant.targets.every(target=>target.width>=60 && target.height>=44 && target.left>=variant.rect.left && target.right<=variant.rect.right));assert.ok(variant.brand.left>=variant.rect.left && variant.brand.right<=variant.rect.right);assert.ok(variant.title.top>=0);
-   if(preset==='desktop-bottom') {
-    const alignment=await page.locator('.operator-topbar').evaluate(node=>{const box=node.getBoundingClientRect();return {height:box.height,center:box.y+box.height/2,centers:[node.querySelector('.operator-brand'),node.querySelector('.operator-nav'),node.querySelector('.presentation-menu > summary')].map(n=>{const r=n.getBoundingClientRect();return r.y+r.height/2;})};});
-    assert.ok(alignment.height<=76,'desktop pill stays compact: '+JSON.stringify(alignment));
-    assert.ok(alignment.centers.every(center=>Math.abs(center-alignment.center)<=2),'brand, navigation and settings share a centerline: '+JSON.stringify(alignment));
-    assert.ok(variant.rect.bottom<=828);await checkClearance(page,true);
-    const before=await page.locator('.operator-topbar').boundingBox();
-    await page.locator('.operator-nav .nav-copy strong').evaluateAll(nodes=>nodes.forEach(node=>{node.style.fontSize='32px';node.style.lineHeight='1.2';}));
-    await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.operator-shell')).paddingBottom)>=document.querySelector('.operator-topbar').getBoundingClientRect().height+32);
-    assert.ok((await page.locator('.operator-topbar').boundingBox()).height>before.height);await checkClearance(page,true);
-   }
-   await page.reload();await settle(page,inspector);assert.equal(await page.locator('[name=preset]').inputValue(),preset);
-   await page.locator('.presentation-menu > summary').click();await page.locator('[data-presentation-reset]').click();assert.equal(await page.locator('html').getAttribute('data-presentation-desktop'),'rail');await page.close();
-  }
-  for(const width of [320,390]) for(const route of ['today','runner','night-shift','inspector']) {
-   const inspector=route==='inspector',page=await browser.newPage({viewport:{width,height:844},colorScheme:'dark',reducedMotion:'reduce'});
-   await page.goto(fixture.origin+(inspector?'/inspector#review':'/#/'+route));await settle(page,inspector);
-   await page.locator('.presentation-menu > summary').click();await page.locator('[name=preset]').selectOption('bottom');await page.keyboard.press('Escape');await checkClearance(page,false);
-   // Resize is a deterministic zoom/reflow proxy; actual text enlargement exercises bar-height changes.
-   await page.setViewportSize({width:320,height:600});await page.locator('.operator-nav .nav-copy strong').evaluateAll(nodes=>nodes.forEach(node=>{node.style.fontSize='16px';node.style.whiteSpace='normal';node.style.lineHeight='1.25';}));
-   await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.operator-shell')).paddingBottom)>=document.querySelector('.operator-nav').getBoundingClientRect().height+28);await checkClearance(page,false);await page.close();
-  }
- } finally {await browser.close();await fixture.close();}
-});
diff --git a/apps/web/test/project-context.test.mjs b/apps/web/test/project-context.test.mjs
deleted file mode 100644
index deadd1b..0000000
--- a/apps/web/test/project-context.test.mjs
+++ /dev/null
@@ -1,185 +0,0 @@
-import test from 'node:test';
-import assert from 'node:assert/strict';
-import { chromium } from 'playwright';
-import { readFile } from 'node:fs/promises';
-import { contextFixture } from './project-context-fixture.mjs';
-
-async function settle(page, inspector = false) {
-  if (inspector) await page.locator('#review-list[data-summary-state="ready"]').waitFor();
-  else { await page.locator('.operator-connection[data-tone="good"]').waitFor(); await page.locator('[data-progress-notice]').waitFor({ state: 'detached' }); }
-}
-async function select(page, id, inspector = false) {
-  if (inspector) { const response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/visual"); await page.locator(`#project-tabs [data-project-id="${id}"]`).click(); await response; }
-  else { await page.getByRole('button', { name: id || 'all projects', exact: true }).click(); await page.getByRole('button', { name: id || 'all projects', exact: true }).and(page.locator('[aria-pressed="true"]')).waitFor(); }
-  await settle(page, inspector);
-}
-async function summary(page, label) { return page.locator('.signal-card').filter({ has: page.locator('.signal-label', { hasText: label }) }).locator('strong').textContent(); }
-
-async function verifySurface(page, feature, count) {
-  const cards = page.locator('.signal-card');
-  assert.equal(await cards.count(), count);
-  const boxes = await cards.evaluateAll(nodes => nodes.map(n => ({ rect: n.getBoundingClientRect().toJSON(), style: getComputedStyle(n), before: getComputedStyle(n, '::before').content })).map(({rect, style, before}) => ({rect, before, borderLeft:style.borderLeftWidth, borderTop:style.borderTopWidth})));
-  const grid = await page.locator('.signal-track').boundingBox();
-  for (const box of boxes) {
-    assert.ok(box.rect.width > 0 && box.rect.height > 0);
-    assert.ok(box.rect.x >= grid.x - 1 && box.rect.x + box.rect.width <= grid.x + grid.width + 1, 'every metric fits without carousel scrolling');
-    assert.equal(box.before, 'none');
-    assert.equal(box.borderLeft, '0px'); assert.equal(box.borderTop, '0px');
-  }
-  for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].rect.y > boxes[i-1].rect.y || boxes[i].rect.x > boxes[i-1].rect.x, 'stable accessible reading order');
-  assert.equal(await page.locator('.signal-mark svg.relay-glyph').count(), count);
-  assert.equal(await page.locator('.signal-mark img').count(), 0);
-  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
-  const order = await page.locator('.workspace-context, .feature-heading:visible, .project-context:visible, .signal-deck:visible').evaluateAll(nodes => nodes.map(n => ({cls:n.className,top:n.getBoundingClientRect().top})));
-  assert.ok(order[0].cls.includes('workspace-context') && order[1].cls.includes('feature-heading') && order[2].cls.includes('project-context') && order[3].cls.includes('signal-deck'));
-  assert.ok(order[0].top < order[1].top && order[1].top < order[2].top && order[2].top < order[3].top);
-  const colors = await page.evaluate(() => ['canvas','surface','contrast','raised','panel-cap'].map(role => getComputedStyle(document.documentElement).getPropertyValue('--color-' + role).trim().toLowerCase()));
-  assert.deepEqual(colors, ['#151412','#1c1b19','#211f1d','#292724','#514a45']);
-  const iconFile = feature === 'night-shift' ? 'nightshift-icon.png.png' : feature + '-icon.png';
-  const canonical = 'data:image/png;base64,' + (await readFile(new URL('../../../icons/' + iconFile, import.meta.url))).toString('base64');
-  assert.equal(await page.locator('.feature-heading:visible .feature-mark').getAttribute('src'), canonical);
-  assert.match(await page.locator('.feature-heading:visible h1').evaluate(n=>getComputedStyle(n).fontFamily), /Momo Trust Display/);
-  assert.equal(await page.locator('.terra-accent span').count(), 5);
-  assert.equal(await cards.first().evaluate(n=>getComputedStyle(n).animationName), 'none', 'reduced motion disables mosaic entrance');
-}
-
-test('built website scopes every summary and preserves explicit project context through document navigation and history', async () => {
-  const fixture = await contextFixture();
-  const browser = await chromium.launch({ headless: true });
-  try {
-    for (const width of [1440, 900, 390, 320]) {
-      const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: 'dark', reducedMotion: 'reduce' });
-      const errors = []; page.on('pageerror', e => errors.push(e.message));
-      await page.goto(fixture.origin + '/#/today'); await settle(page);
-      assert.equal(await page.getByRole('button',{name:'all projects',exact:true}).getAttribute('aria-pressed'),'true');
-      assert.equal(await summary(page,'moving'),'1'); assert.equal(await summary(page,'automatic checks'),'2');
-      await verifySurface(page,'today',4); assert.equal(await page.locator('[data-signal-id="needs"] .glyph-review').count(),1,'needs-you uses review rather than error glyph');
-      await select(page,'field'); assert.equal(await summary(page,'moving'),'0'); assert.equal(await summary(page,'automatic checks'),'1');
-      assert.equal(await page.locator('.attention-card').count(),0); assert.equal(await page.locator('.automation-row').count(),1);
-      await page.getByRole('link',{name:/^runner/}).click(); await page.getByRole('heading',{name:'runner',exact:true,level:1}).waitFor(); await settle(page);
-      assert.equal(await page.locator('.work-item').count(),1); assert.equal(await summary(page,'waiting for a response'),'1');
-      await verifySurface(page,'runner',4); const destination=new URL(await page.locator('.work-item .work-open').first().getAttribute('href'));assert.equal(destination.origin,'https://ctrl.loew.fi');await page.goto(fixture.origin+destination.pathname+destination.search+destination.hash); await page.locator('.work-detail').waitFor({timeout:5000}).catch(async e=>{throw new Error(JSON.stringify({width,url:page.url(),errors,text:await page.locator('body').innerText()}),{cause:e})});
-      await page.getByRole('link',{name:'← runner'}).click(); await page.getByRole('heading',{name:'runner',exact:true,level:1}).waitFor(); await settle(page);
-      assert.ok(page.url().endsWith('#/runner?project=field'));
-      await page.getByRole('link',{name:/^night shift/}).click(); await page.getByRole('heading',{name:'night shift',exact:true,level:1}).waitFor(); await settle(page);
-      assert.equal(await summary(page,'included projects'),'1'); assert.equal(await summary(page,'needs attention'),'1'); assert.equal(await page.locator('.work-item').count(),1);
-      await verifySurface(page,'night-shift',4); await page.getByRole('link',{name:/^inspector/}).click(); await settle(page,true); assert.ok(page.url().endsWith('/inspector#review?project=field'));
-      assert.equal(await page.locator('#inspector-signal-needs').textContent(),'1'); assert.equal(await page.locator('.review-row').count(),1);
-      await verifySurface(page,'inspector',2);
-      await select(page,'',true); assert.equal(await page.locator('#inspector-signal-needs').textContent(),'2');
-      await page.reload(); await settle(page,true); assert.equal(await page.locator('#project-tabs [data-project-id=""]').getAttribute('aria-selected'),'true');
-      await select(page,'relay',true); await page.reload(); await settle(page,true); assert.equal(await page.locator('.review-row').count(),1);
-      await page.locator('[data-nav="today"]').click(); await settle(page); assert.ok(page.url().endsWith('#/today?project=relay'));
-      await select(page,''); assert.equal(await summary(page,'automatic checks'),'2');
-      await page.goBack(); await settle(page); assert.equal(await summary(page,'automatic checks'),'1');
-      await page.goForward(); await settle(page); assert.equal(await summary(page,'automatic checks'),'2');
-      await page.reload(); await settle(page); assert.equal(await page.getByRole('button',{name:'all projects',exact:true}).getAttribute('aria-pressed'),'true');
-      assert.deepEqual(errors,[]); await page.close();
-    }
-    assert.ok(fixture.requests.every(path=> !path.startsWith('/api/progress/') || path.includes('?assignment=')), 'PR106 bounded assignment reads remain intact');
-  } finally { await browser.close(); await fixture.close(); }
-});
-
-test('partial activity and failed Inspector reads remain honestly labelled instead of all-clear zeros', async () => {
-  const fixture = await contextFixture(); fixture.controls.failField = true;
-  const browser = await chromium.launch({ headless: true });
-  try {
-    const page = await browser.newPage({ reducedMotion:'reduce',colorScheme:'dark' });
-    await page.goto(fixture.origin + '/#/today');
-    await page.locator('[data-progress-notice]').filter({hasText:'Some project activity is unavailable.'}).waitFor();
-    assert.equal(await summary(page,'moving'),'1+');
-    await select(page,'relay'); assert.equal(await summary(page,'moving'),'1');
-    await page.getByRole('button',{name:'field',exact:true}).click();
-    await page.locator('[data-progress-notice]').filter({hasText:'Some project activity is unavailable.'}).waitFor();
-    assert.equal(await summary(page,'needs you'),'pending'); assert.equal(await page.locator('.clear-card:has-text("You’re clear.")').count(),0);
-    fixture.controls.holdVisual = true;
-    await page.goto(fixture.origin + '/inspector#review?project=field'); await page.locator('#review-list .content-skeleton').waitFor();
-    await page.waitForFunction(()=>document.querySelector('#inspector-signal-needs').textContent==='pending');
-    fixture.controls.failVisual = true; fixture.controls.holdVisual = false; fixture.controls.releaseVisual();
-    await page.locator('#review-list[data-summary-state="error"]').waitFor();
-    await page.waitForFunction(()=>document.querySelector('#inspector-signal-needs').textContent==='unavailable');
-    assert.equal(await page.locator('#inspector-signal-visible').textContent(),'unavailable');
-  } finally { await browser.close(); await fixture.close(); }
-});
-
-// Presentation preferences affect rendering only and survive the existing document boundary.
-test('compact navigation, full-height rail and local presentation presets remain usable', async () => {
-  const fixture = await contextFixture(), browser = await chromium.launch({headless:true});
-  try {
-    for (const width of [320,390,900,1024,1440]) {
-      const page = await browser.newPage({viewport:{width,height:844},colorScheme:'dark',reducedMotion:'reduce'});
-      await page.goto(fixture.origin + '/#/today'); await settle(page);
-      const name = page.locator('.operator-brand strong');
-      assert.equal(await name.isVisible(), true); assert.equal(await name.textContent(),'relay');
-      if(width > 900) {
-        await page.mouse.move(width-1,400);
-        assert.equal(await page.locator('.operator-nav .nav-copy').first().evaluate(n=>getComputedStyle(n).opacity),'0');
-        assert.equal(await page.locator('.operator-brand').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(41, 39, 36)');
-        await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
-        const rail = await page.locator('.operator-topbar').boundingBox();
-        assert.equal(Math.round(rail.y),4); assert.equal(Math.round(rail.height),840);
-        await page.evaluate(()=>window.scrollTo(0,0));
-      } else {
-        const targets = await page.locator('.operator-nav > :is(a,button)').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
-        assert.equal(targets.length,4);
-        for(const target of targets) { assert.ok(target.width>=60 && target.height>=44); assert.ok(target.x>=0 && target.x+target.width<=width); }
-        assert.equal(new Set(targets.map(n=>Math.round(n.y))).size,1,'four routes together');
-        if(width<=760) assert.equal(new Set((await page.locator('.signal-card').evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().y))))).size,2,'compact overview has two rows');
-      }
-      const menu = page.locator('.presentation-menu'); await menu.locator('> summary').click();
-      await page.locator('[name=preset]').selectOption('rich');
-      assert.equal(await page.locator('html').getAttribute('data-presentation-richness'),'rich');
-      assert.match(await page.locator('[data-signal-id=moving] .signal-ratio').innerText(),/1 of 3 current work items/);
-      assert.match(await page.locator('[data-signal-id=automatic] .signal-ratio').innerText(),/2 of 2 automatic checks/);
-      assert.equal(await page.locator('.signal-ratio .ratio-value').first().evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
-      await page.locator('.presentation-customize > summary').click();
-      await page.locator('[name=motion]').selectOption('calm');
-      assert.equal(await page.locator('[data-presentation-state]').textContent(),'Custom');
-      await page.locator('[name=nav]').selectOption('bottom');
-      await page.keyboard.press('Escape'); assert.equal(await menu.getAttribute('open'),null);
-      await page.getByRole('link',{name:/^inspector/}).click(); await settle(page,true);
-      assert.equal(await page.locator('html').getAttribute('data-presentation-richness'),'rich');
-      assert.equal(await page.locator('html').getAttribute('data-presentation-nav'),'bottom');
-      if(width<=900) {
-        const nav = await page.locator('.operator-nav').boundingBox(); assert.ok(nav.y>700 && nav.y+nav.height<=845);
-        const pill=await page.locator('.operator-nav').evaluate(node=>({radius:getComputedStyle(node).borderRadius,shadow:getComputedStyle(node).boxShadow,rect:node.getBoundingClientRect().toJSON(),targets:[...node.children].map(child=>child.getBoundingClientRect().toJSON()),clearance:parseFloat(getComputedStyle(document.querySelector('.operator-shell')).paddingBottom)}));
-        assert.equal(pill.radius,'999px');assert.notEqual(pill.shadow,'none');
-        assert.ok(pill.rect.x>=12 && pill.rect.right<=width-12 && 844-pill.rect.bottom>=12,'pill floats clear of viewport edges');
-        assert.equal(pill.targets.length,4);assert.ok(pill.targets.every(target=>target.width>=60 && target.height>=44 && target.x>=pill.rect.x && target.right<=pill.rect.right));
-        assert.ok(pill.clearance>=pill.rect.height+12,'scroll content clears the floating pill');
-        await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
-        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
-      }
-      await page.reload(); await settle(page,true);
-      await page.locator('.presentation-menu > summary').click();
-      await page.locator('[data-presentation-reset]').click();
-      assert.equal(await page.locator('[name=preset]').inputValue(),'approved');
-      assert.equal(await page.evaluate(()=>localStorage.getItem('relay-presentation')),null);
-      await page.getByRole('button',{name:'Switch to light mode',exact:true}).click(); assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
-      assert.equal(await page.locator('#app-settings').count(),0,'Refresh tools is on the Relay connection panel');
-      await page.close();
-    }
-  } finally {await browser.close();await fixture.close();}
-});
-
-test('spring motion is finite and ends with sharp readable telemetry', async () => {
-  const fixture = await contextFixture(), browser = await chromium.launch({headless:true});
-  try {
-    const page = await browser.newPage({colorScheme:'dark',reducedMotion:'no-preference'});
-    await page.goto(fixture.origin+'/#/today');await settle(page);
-    const motion = await page.locator('.signal-card').first().evaluate(node => ({name:getComputedStyle(node).animationName,duration:parseFloat(getComputedStyle(node).animationDuration),fill:getComputedStyle(node).animationFillMode}));
-    assert.equal(motion.name,'signal-spring');assert.ok(motion.duration<=.5);assert.equal(motion.fill,'backwards');
-    await page.locator('.signal-card').evaluateAll(async nodes=>{await Promise.all(nodes.flatMap(node=>node.getAnimations({subtree:true})).map(animation=>animation.finished));});
-    assert.equal(await page.locator('.signal-card').first().evaluate(node=>getComputedStyle(node).filter),'none');
-    await page.locator('.presentation-menu > summary').click();await page.locator('.presentation-customize > summary').click();
-    await page.locator('[name=motion]').selectOption('calm');
-    assert.equal(await page.locator('.signal-card').first().evaluate(node=>getComputedStyle(node).animationName),'none');
-  } finally {await browser.close();await fixture.close();}
-});
-
-import {projectMembers} from '../../../packages/shared-ui/project-groups.js';
-test('Inspector scopes evidence before the API result limit and preserves child identities',async()=>{
- assert.deepEqual(projectMembers('field'),['field']);assert.deepEqual(projectMembers('bazzite-custom'),['bazzite-custom','loew-shell']);assert.deepEqual(projectMembers('rtxforge'),['rtxforge','rtxforge-mfg']);
- const fixture=await contextFixture(),browser=await chromium.launch({headless:true});
- try{const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto(fixture.origin+'/inspector#review?project=field');await settle(page,true);assert.ok(fixture.requests.includes('/api/visual?project=field'));assert.equal(await page.locator('[data-work-key]').count(),1);assert.match(await page.locator('[data-work-key]').getAttribute('data-work-key'),/^field\//);await page.close();}finally{await browser.close();await fixture.close();}
-});
diff --git a/apps/web/test/react.test.mjs b/apps/web/test/react.test.mjs
index c7a38f5..6a186d0 100644
--- a/apps/web/test/react.test.mjs
+++ b/apps/web/test/react.test.mjs
@@ -1,150 +1,47 @@
-import {reviewFixture,workerSource} from "./work-review-fixture.mjs";
-import test from "node:test";
-import assert from "node:assert/strict";
-import { fileURLToPath } from "node:url";
-import { chromium } from "playwright";
-import { createServer } from "vite";
-import { mcpHtml, webAssets } from "../generated.js";
-
-// This PR gate exercises the Vite/React boundary from the committed lockfile.
-const root = fileURLToPath(new URL("..", import.meta.url));
-
-const progress = {
-  project: "relay",
-  observed_progress: true,
-  progress: [
-    {
-      assignment: "relay-2.0-build",
-      goal: "Ship the Relay 2.0 live React experience",
-      observed: true,
-      state: "working",
-      stage: "implementation",
-      primary_staff: "nico",
-      last_meaningful_progress_at: "2026-10-01T08:00:00Z",
-      latest_event: { type: "source-commit", at: "2026-10-01T08:00:00Z" },
-      next_action: "finish release review",
-      identities: { branch: "relay/2.0-today-runner-react-slice-20261001", head_sha: "d".repeat(40) },
-      events: [{ type: "source-commit", at: "2026-10-01T08:00:00Z" }]
-    },
-    {
-      assignment: "relay-2.0-review",
-      goal: "Review Inspector feedback delivery",
-      observed: true,
-      state: "waiting-for-human",
-      stage: "review",
-      primary_staff: "vivienne",
-      waiting_reason: "Review the exact current result.",
-      last_meaningful_progress_at: "2026-10-01T08:01:00Z",
-      latest_event: { type: "qa-review", at: "2026-10-01T08:01:00Z" },
-      next_action: "approve visual QA",
-      identities: { branch: "relay/2.0-today-runner-react-slice-20261001", head_sha: "e".repeat(40) },
-      events: [{ type: "qa-review", at: "2026-10-01T08:01:00Z" }]
-    }
-  ],
-  queue: []
-};
-
-const workers = [{
-  id: "relay",
-  name: "relay",
-  enabled: true,
-  runtime: {
-    status: "idle",
-    last_summary: "Night shift verified the latest unattended work.",
-    last_run_at: "2026-10-01T07:30:00Z",
-    next_run_at: "2026-10-01T09:00:00Z"
-  }
-}];
-
-test("Relay 2.0 React shell renders human-first live surfaces responsively", async () => {
-  const vite = await createServer({ root, logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
-  await vite.listen();
-  const address = vite.httpServer?.address();
-  assert.ok(address && typeof address === "object");
-  const origin = "http://127.0.0.1:" + address.port;
-  const browser = await chromium.launch({ headless: true });
-
-  try {
-    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, colorScheme: "dark" });
-    await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
-    await page.route("https://fonts.gstatic.com/**", route => route.abort());
-    await page.route("**/api/projects", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ projects: [{ id: "relay", name: "relay", managed: true }] }) }));
-    await page.route("**/api/workers", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(workers) }));
-    await page.route("**/api/projects/relay", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ coordination: { claims: progress.progress.map(item => ({ id: item.assignment, state: "active" })) } }) }));
-    await page.route("**/api/progress/relay*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(progress) }));
-
-    const reviews=reviewFixture(item=>item.kind==='check'?workerSource(workers.find(w=>w.id===item.id)):progress.progress.find(p=>p.assignment===item.id));
-    await page.route('**/api/work-review',async route=>route.fulfill({json:await reviews.body(route.request().postDataJSON())}));
-    await page.goto(origin + "/#/today");
-    await page.locator('.operator-connection[data-tone="good"]').filter({ hasText: "live" }).waitFor();
-    await page.locator("[data-progress-notice]").waitFor({ state: "detached" });
-    // StrictMode can queue a second refresh while the first one settles. Assert
-    // the completed snapshot, not a legitimate intermediate "1+" count.
-    await page.waitForFunction(() => ['needs','moving','automatic'].every(id =>
-      document.querySelector(`[data-signal-id="${id}"] > strong`)?.textContent === '1'
-    ) && !document.querySelector('[data-progress-notice]'));
-
-    assert.equal(await page.getByRole("heading", { name: "today", level: 1 }).textContent(), "today");
-    assert.equal(await page.locator(".signal-card").count(), 4);
-
-    const mark = await page.locator(".feature-mark").boundingBox();
-    assert.ok(mark && Math.abs(mark.width - 96) < 2, "desktop feature mark keeps the approved 1.8/1.9 identity scale");
-    const font = await page.getByRole("heading", { name: "today", level: 1 }).evaluate(node => getComputedStyle(node).fontFamily);
-    assert.match(font, /Momo Trust Display/);
-    assert.equal(await page.locator("body").evaluate(node => getComputedStyle(node).backgroundImage), "none");
-    assert.equal(await page.locator(".signal-card").first().evaluate(node => getComputedStyle(node).backgroundImage), "none");
-
-    const track = await page.locator(".signal-track").boundingBox();
-    const first = await page.locator(".signal-card").nth(0).boundingBox();
-    const second = await page.locator(".signal-card").nth(1).boundingBox();
-    assert.ok(track && first && second);
-    const third = await page.locator(".signal-card").nth(2).boundingBox();
-    assert.ok(third && second.x > first.x && third.y > first.y, "mosaic preserves left-to-right then top-to-bottom summary order");
-    assert.ok(second.x + second.width <= track.x + track.width + 2);
-    assert.ok(third.x >= track.x && third.x + third.width <= track.x + track.width + 2, "all summaries fit the grid without horizontal navigation");
-    assert.equal(await page.locator(".signal-mark svg").count(), 4);
-    assert.equal(await page.locator(".signal-card").first().getAttribute("tabindex"), null);
-
-    await page.getByRole("link", { name: /^runner/ }).click();
-    await page.getByRole("heading", { name: "runner", level: 1 }).waitFor();
-    assert.equal(await page.locator(".signal-card").count(), 4);
-    assert.equal(await page.locator(".work-item").count(), 2);
-    assert.equal(await page.locator(".work-item details").first().getByText("Details").count(), 1);
-    assert.match(await page.locator(".work-item").first().innerText(), /Source:/);
-    const destination=new URL(await page.locator('.work-item .work-open').first().getAttribute('href'));assert.equal(destination.origin,'https://ctrl.loew.fi');await page.goto(origin+destination.pathname+destination.search+destination.hash);
-    await page.locator(".work-detail").waitFor();
-    assert.equal(await page.locator(".work-detail .signal-card").count(), 3);
-    await page.getByRole("link", { name: "← runner" }).click();
-
-    await page.getByRole("link", { name: /^night shift/ }).click();
-    await page.getByRole("heading", { name: "night shift", level: 1 }).waitFor();
-    assert.equal(await page.locator(".signal-card").count(), 4);
-    assert.equal(await page.locator('.signal-card:has-text("will anything happen?")').count(), 1);
-    assert.match(await page.locator(".work-item").first().textContent(), /Night shift verified/);
-
-    await page.setViewportSize({ width: 390, height: 844 });
-    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
-    const mobileMark = await page.locator(".feature-mark").boundingBox();
-    assert.ok(mobileMark && Math.abs(mobileMark.width - 48) < 2);
-
-    await page.emulateMedia({ reducedMotion: "reduce" });
-    assert.equal(await page.locator(".signal-track").evaluate(node => getComputedStyle(node).scrollBehavior), "auto");
-  } finally {
-    await browser.close();
-    await vite.close();
-  }
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import {mkdir} from 'node:fs/promises';
+import {chromium} from 'playwright';
+import {webAssets,mcpHtml} from '../generated.js';
+import {reactJs} from '../generated-react.js';
+import {legacyScript} from '../generated-inspector.js';
+import {contextFixture} from './project-context-fixture.mjs';
+
+test('production bundles contain the Relay landing and inert CTRL handoffs, without legacy application programs',()=>{
+ assert.equal(legacyScript,'');assert.equal(webAssets['/relay-app.js'],undefined);
+ assert.match(webAssets['/'].text,/id="root"/);
+ for(const html of [mcpHtml,webAssets['/inspector'].text,webAssets['/inspector/'].text]){
+  assert.match(html,/data-relay-ctrl-handoff/);assert.match(html,/https:\/\/ctrl.loew.fi\//);
+  assert.doesNotMatch(html,/<script|<iframe|id="root"|operator-nav|data-page="review"|relay_ui_request/);
+ }
+ assert.doesNotMatch(reactJs,/operator-nav react-operator-nav|data-bulk|qa-review-loading/);
 });
 
-
-test("generated cutover publishes the React control center through the authenticated MCP bridge", () => {
-  assert.match(webAssets["/"].text, /<title>relay 2\.0<\/title>/);
-  assert.ok(webAssets["/inspector"]);
-  assert.match(webAssets["/inspector"].text, /data-page="review"/);
-  assert.match(mcpHtml, /id="root"/);
-  assert.match(mcpHtml, /<script type="module">/);
-  assert.match(mcpHtml, /ui\/initialize/);
-  assert.match(mcpHtml, /ui\/notifications\/initialized/);
-  assert.match(mcpHtml, /tools\/call/);
-  assert.match(mcpHtml, /relay_ui_request/);
-  assert.match(mcpHtml, /\/inspector#review/);
+test('the actual generated landing stays intact and retired hash routes cannot render old panels at any pathname',async()=>{
+ const fixture=await contextFixture(),browser=await chromium.launch({headless:true});
+ try{
+  for(const width of [1440,390]){
+   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce',colorScheme:'dark'});
+   await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
+   await page.route('https://fonts.gstatic.com/**',route=>route.abort());
+   await page.route('**/api/relay/check',route=>route.fulfill({json:{ok:true,checked_at:new Date().toISOString(),elapsed_ms:4,tools:{count:1}}}));
+   await page.route(fixture.origin+'/preview/fixture',route=>route.fulfill({contentType:'text/html',body:webAssets['/'].text}));
+   await page.goto(fixture.origin+'/#/');await page.getByRole('heading',{name:'relay',level:1,exact:true}).waitFor();
+   await page.locator('.live-telemetry[data-loading=false]').waitFor();
+   assert.equal(await page.getByRole('button',{name:'Open files',exact:true}).isEnabled(),true);
+   assert.equal(await page.locator('.operator-nav,.work-viewer,#review-list').count(),0);
+   await mkdir('qa-evidence/retirement',{recursive:true});await page.screenshot({path:'qa-evidence/retirement/relay-landing-'+width+'.png',fullPage:true});
+   for(const path of ['/','/index.html','/preview/fixture'])for(const route of ['today','runner','night-shift','inspector']){
+    await page.goto(fixture.origin+path+'#/'+route+'?project=relay');
+    await page.getByRole('heading',{name:'Your work is in CTRL',exact:true}).waitFor();
+    const expected='https://ctrl.loew.fi/#/'+(route==='today'?'now':route)+'?project=relay';
+    assert.equal(await page.getByRole('link',{name:'Open CTRL',exact:true}).getAttribute('href'),expected);
+    assert.equal(await page.locator('.operator-nav,.work-viewer,#review-list').count(),0);
+   }
+   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
+   await page.screenshot({path:'qa-evidence/retirement/ctrl-handoff-'+width+'.png',fullPage:true});
+   await page.getByRole('link',{name:'Back to Relay connections and files'}).click();
+   await page.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();await page.close();
+  }
+ }finally{await browser.close();await fixture.close();}
 });
diff --git a/apps/web/test/retained-preview.test.mjs b/apps/web/test/retained-preview.test.mjs
index b3da589..425d29f 100644
--- a/apps/web/test/retained-preview.test.mjs
+++ b/apps/web/test/retained-preview.test.mjs
@@ -1,4 +1,3 @@
-import {mkdir,writeFile} from 'node:fs/promises';
 import test from 'node:test';
 import assert from 'node:assert/strict';
 import {chromium} from 'playwright';
@@ -8,77 +7,42 @@ import {storeRetainedBundle,getRetainedBundle} from '../../../src/retained-previ
 import {contextFixture} from './project-context-fixture.mjs';
 import {retainedStorageFixture} from './retained-storage-fixture.mjs';
 
-test('retained exact builds remain interactive, isolated, navigable and human-reviewable', {timeout:120000},async()=>{
+test('new retained builds show the legitimate landing, preserve historical records and keep the original opaque network isolation', {timeout:120000},async()=>{
  const sourceSha='a'.repeat(40),bucket=retainedStorageFixture();
- const {bundle,sha256}=await createRetainedBundle({webAssets,sourceSha,buildId:webBuildId,createdAt:'2026-10-02T08:00:00.000Z'});
+ const {bundle,sha256}=await createRetainedBundle({webAssets,sourceSha,buildId:webBuildId,createdAt:'2026-10-07T14:00:00.000Z',fontCss:''});
  const stored=await storeRetainedBundle(bucket,bundle);assert.equal(stored.sha256,sha256);
- let currentPage;const pageErrors=[];
+ const historical={...bundle,source_sha:'b'.repeat(40),documents:{app:'<!doctype html><html><body>Historical recovery fixture</body></html>',inspector:'<!doctype html><html><body>Historical Inspector fixture</body></html>'}};
+ const old=await storeRetainedBundle(bucket,historical);assert.notEqual(old.id,stored.id);
+ assert.deepEqual((await getRetainedBundle(bucket,old.id)).bundle.documents,historical.documents);
  const fixture=await contextFixture({retained:{bucket,id:stored.id,source_sha:sourceSha}}),browser=await chromium.launch();
  try{
-  // Serve the retained document at the real hostname without contacting production.
-  // Its opaque sandbox must stay in the saved build, not take the public ctrl redirect.
-  const archived=await browser.newPage();
-  await archived.route('https://relay.loew.fi/**',async route=>{
-   const url=new URL(route.request().url());
-   const response=await fetch(fixture.origin+url.pathname+url.search);
-   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
-  });
-  await archived.route('https://ctrl.loew.fi/**',route=>route.abort());
-  await archived.goto('https://relay.loew.fi/api/retained-preview/'+stored.id+'/view?entry=app#/today');
-  await archived.locator('.work-viewer[data-summary-state=ready]').waitFor();
-  assert.match(archived.url(),/\/api\/retained-preview\//);
-  assert.equal(await archived.evaluate(()=>window.origin),'null');
-  await archived.getByRole('link',{name:/^runner/}).click();
-  await archived.getByRole('heading',{name:'runner',exact:true,level:1}).waitFor();
-  assert.match(archived.url(),/\/api\/retained-preview\//);
-  await archived.close();
   for(const width of [1440,390]){
-   const page=await browser.newPage({viewport:{width,height:900},colorScheme:'dark',reducedMotion:'reduce'});currentPage=page;page.on('pageerror',error=>pageErrors.push(error.message));
-   await page.goto(fixture.origin+'/inspector#review');assert.equal(await page.evaluate(()=>Boolean(window.__retainedFixture)),false);await page.evaluate(()=>localStorage.setItem('host-secret','host-only'));await page.locator('#review-list[data-summary-state=ready]').waitFor();
-   const open=()=>page.locator('[data-review-id="vis_context-capture-relay"]').click();await open();
-   const frame=page.frameLocator('[data-qa-retained-preview]');await frame.locator('.feature-heading h1').filter({hasText:'today'}).waitFor();
-   await page.locator('.qa-preview-state').filter({hasText:'sample data · ready'}).waitFor();
-   assert.equal(await page.locator('[data-qa-retained-preview]').getAttribute('sandbox'),'allow-scripts');
-   await mkdir('qa-evidence/website',{recursive:true});await page.screenshot({path:'qa-evidence/website/retained-review-'+width+'.png'});
+   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
+   await page.goto(fixture.origin+'/');await page.locator('.live-telemetry[data-loading=false]').waitFor();
+   await page.evaluate(()=>localStorage.setItem('host-secret','host-only'));
+   await page.evaluate(id=>{const frame=document.createElement('iframe');frame.id='retained-test';frame.setAttribute('sandbox','allow-scripts');frame.src='/api/retained-preview/'+id+'/view?entry=app#/';frame.style.cssText='width:100%;height:800px';document.body.append(frame);},stored.id);
+   const frame=page.frameLocator('#retained-test');await frame.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();
+   await frame.locator('.live-telemetry[data-loading=false]').waitFor();
+   assert.equal(await frame.locator('.operator-nav,.work-viewer,#review-list').count(),0);
+   assert.equal(await frame.getByRole('button',{name:'Open files',exact:true}).isDisabled(),true);
+   assert.match(await frame.locator('.relay-connection-copy').innerText(),/cannot check or change your real connection/);
    const isolation=await frame.locator('body').evaluate(async()=>{
-    const violations=[];let resolveViolations;const observed=new Promise(resolve=>{resolveViolations=resolve;});
-    const onViolation=event=>{violations.push(event.effectiveDirective);if(violations.includes('connect-src')&&violations.includes('img-src'))resolveViolations();};
-    window.addEventListener('securitypolicyviolation',onViolation);
-    let parentBlocked=false,cookieBlocked=false,topBlocked=false;
-    try{void parent.document.body;}catch{parentBlocked=true;}
-    try{void document.cookie;}catch{cookieBlocked=true;}
-    try{top.location.href='/forbidden-top';}catch{topBlocked=true;}
-    let beacon;try{beacon=navigator.sendBeacon('/forbidden-beacon','preview');}catch{beacon=false;}
+    const violations=[];const onViolation=e=>violations.push(e.effectiveDirective);window.addEventListener('securitypolicyviolation',onViolation);
+    let parentBlocked=false,cookieBlocked=false;try{void parent.document.body;}catch{parentBlocked=true;}try{void document.cookie;}catch{cookieBlocked=true;}
+    try{navigator.sendBeacon('/forbidden-beacon','preview');}catch{}
     const image=new Image();image.src=location.origin+'/forbidden-image';
-    localStorage.setItem('preview-only','yes');
-    await Promise.race([observed,new Promise(resolve=>setTimeout(resolve,1000))]);window.removeEventListener('securitypolicyviolation',onViolation);
-    return {origin:window.origin,urlOrigin:location.origin,parentBlocked,cookieBlocked,topBlocked,beacon,violations,storage:localStorage.getItem('preview-only'),hostSecret:localStorage.getItem('host-secret'),secure:isSecureContext};
+    localStorage.setItem('preview-only','yes');await new Promise(resolve=>setTimeout(resolve,300));window.removeEventListener('securitypolicyviolation',onViolation);
+    return {origin:window.origin,parentBlocked,cookieBlocked,violations,storage:localStorage.getItem('preview-only'),hostSecret:localStorage.getItem('host-secret')};
    });
-   assert.equal(isolation.origin,'null',JSON.stringify(isolation));assert.equal(isolation.urlOrigin,fixture.origin);assert.ok(isolation.parentBlocked&&isolation.cookieBlocked);assert.equal(isolation.storage,'yes');assert.equal(isolation.hostSecret,null);assert.ok(isolation.violations.includes('connect-src')&&isolation.violations.includes('img-src'),JSON.stringify(isolation));assert.ok(page.url().startsWith(fixture.origin+'/inspector'));
-   await frame.locator('.work-viewer[data-summary-state=ready]').waitFor();
-   const requestsBefore=fixture.requests.filter(path=>path==='/api/work-review').length;
-   await frame.locator('[data-select-visible]').check();await frame.locator('[data-bulk=completed]').click();await frame.locator('[data-confirm]').click();
-   await frame.locator('.work-results .empty-card').waitFor();assert.ok(await frame.locator('body').evaluate(()=>window.__retainedFixture.reviewRecordCount()>0));
-   assert.equal(fixture.reviews.values.size,0,'synthetic review cannot write host review storage');
-   assert.equal(fixture.requests.filter(path=>path==='/api/work-review').length,requestsBefore,'child mutations never reached host APIs');
-   assert.equal(fixture.requests.some(path=>path.startsWith('/forbidden')),false,'CSP prevents fallback network requests');
-   await frame.locator('a[data-feature=inspector]').click();await frame.locator('.feature-heading h1').filter({hasText:'inspector'}).waitFor();
-   await page.locator('.qa-preview-state').filter({hasText:'sample data · ready'}).waitFor();
-   assert.match(await page.locator('[data-qa-retained-preview]').getAttribute('src'),/entry=inspector/);
-   await page.locator('[data-retained-review]').click();await page.locator('[data-retained-review]').filter({hasText:'Reopen build review'}).waitFor();
-   assert.equal((await getRetainedBundle(bucket,stored.id)).state,'approved');
-   await page.locator('.qa-preview-state').filter({hasText:'sample data · ready'}).waitFor();await page.screenshot({path:'qa-evidence/website/retained-approved-'+width+'.png'});
-   await page.locator('[data-retained-review]').click();await page.locator('[data-retained-review]').filter({hasText:'Approve this build'}).waitFor();assert.equal((await getRetainedBundle(bucket,stored.id)).state,'pending');
-   await page.locator('.qa-exit').click();await page.locator('.qa-stage').waitFor({state:'detached'});await open();
-   await frame.locator('.work-viewer[data-summary-state=ready]').waitFor();assert.equal(await frame.locator('body').evaluate(()=>window.__retainedFixture.reviewRecordCount()),0,'preview changes reset when reopened');
-   await page.locator('.qa-exit').click();await page.close();
+   assert.equal(isolation.origin,'null');assert.ok(isolation.parentBlocked&&isolation.cookieBlocked);assert.equal(isolation.storage,'yes');assert.equal(isolation.hostSecret,null);
+   assert.ok(isolation.violations.includes('connect-src')&&isolation.violations.includes('img-src'),JSON.stringify(isolation));
+   assert.equal(fixture.requests.some(path=>path.startsWith('/forbidden-')),false);
+   await frame.locator('body').evaluate(()=>{location.hash='#/runner?project=relay';});
+   await frame.getByRole('heading',{name:'Your work is in CTRL',exact:true}).waitFor();assert.equal(await frame.locator('.operator-nav,.work-viewer').count(),0);
+   await frame.getByRole('link',{name:'Back to Relay connections and files'}).click();await frame.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();
+   await page.evaluate(id=>{document.querySelector('#retained-test').src='/api/retained-preview/'+id+'/view?entry=inspector';},stored.id);
+   await frame.getByRole('heading',{name:'Inspector is in CTRL',exact:true}).waitFor();assert.equal(await frame.locator('#review-list,.qa-review,.operator-nav').count(),0);
+   assert.equal(await page.evaluate(()=>localStorage.getItem('preview-only')),null);await page.close();
   }
- }catch(error){
-  let diagnostics={pageErrors};
-  if(currentPage&&!currentPage.isClosed()){
-   diagnostics.frames=await Promise.all(currentPage.frames().map(async frame=>{try{return await frame.evaluate(()=>({url:location.href,origin:window.origin,ready:document.readyState,text:document.body?.innerText?.slice(0,2000)}));}catch(cause){return {error:cause.message};}}));
-   await mkdir('qa-evidence/website',{recursive:true});await currentPage.screenshot({path:'qa-evidence/website/retained-failure.png'});await writeFile('qa-evidence/website/retained-failure.json',JSON.stringify(diagnostics,null,2));
-  }
-  throw Error(error.message+'\nRetained diagnostics: '+JSON.stringify(diagnostics));
  }finally{await browser.close();await fixture.close();}
 });
diff --git a/apps/web/test/review-language.test.mjs b/apps/web/test/review-language.test.mjs
deleted file mode 100644
index eeaaf36..0000000
--- a/apps/web/test/review-language.test.mjs
+++ /dev/null
@@ -1,79 +0,0 @@
-import test from 'node:test';
-import assert from 'node:assert/strict';
-import {mkdir} from 'node:fs/promises';
-import {chromium} from 'playwright';
-import {contextFixture} from './project-context-fixture.mjs';
-import {reviewKey} from '../../../packages/shared-ui/work-view-model.js';
-
-test('actual generated review UI preserves an uncertain save through readback without replaying it',async()=>{
- const browser=await chromium.launch({headless:true});
- try{
-  for(const width of [1440,390])for(const outcome of ['saved-response-lost','incomplete-receipt','readback-incomplete']){
-   const fixture=await contextFixture(),page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce',colorScheme:'dark'});
-   let writes=0;
-   try{
-    await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
-    await page.route('https://fonts.gstatic.com/**',route=>route.abort());
-    await page.route('**/api/work-review',async route=>{
-     const input=route.request().postDataJSON();
-     if(input.action!=='set')return outcome==='readback-incomplete'&&writes?route.fulfill({json:{results:[]}}):route.continue();
-     writes++;
-     if(outcome!=='incomplete-receipt'){
-      await fixture.reviews.body(input);
-      return route.fulfill({status:503,json:{error:'Synthetic lost response'}});
-     }
-     return route.fulfill({status:200,json:{results:[]}});
-    });
-    await page.goto(fixture.origin+'/#/runner');
-    const viewer=page.locator('.work-viewer');
-    await viewer.locator('[data-filter=all]').click();
-    await page.locator('[data-progress-notice]').waitFor({state:'detached'});
-    await page.locator('.work-viewer[data-summary-state=ready]').waitFor();
-    const checkbox=viewer.locator('[data-select]').first(),key=await checkbox.getAttribute('data-select');
-    await checkbox.check();
-    const complete=viewer.getByRole('button',{name:'Mark review complete',exact:true});
-    await complete.click();await viewer.getByRole('button',{name:'Cancel',exact:true}).click();
-    assert.equal(writes,0);assert.equal(await complete.evaluate(node=>node===document.activeElement),true);
-    await complete.click();await viewer.locator('[data-confirm]').click();
-    const notice=viewer.locator('.work-message');
-    await notice.filter({hasText:outcome==='readback-incomplete'?"couldn't load the review statuses":'The latest review statuses are shown below.'}).waitFor();
-    if(outcome==='readback-incomplete'){assert.equal(await complete.isDisabled(),true);assert.doesNotMatch(await notice.innerText(),/latest review statuses are shown/);}
-    assert.match(await notice.innerText(),/couldn't confirm whether or not the change was saved/);
-    assert.doesNotMatch(await notice.innerText(),/HTTP|Synthetic|receipt/);
-    assert.equal(writes,1,'readback must not replay an uncertain mutation');
-    const row=viewer.locator('[data-work-key]').filter({has:page.locator('[data-select="'+key+'"]')});
-    assert.match(await row.innerText(),outcome==='saved-response-lost'?/Review: Completed/:/Review: Need review/);
-    assert.equal(fixture.progress.relay[0].state,'working','review actions do not complete the task');
-    await viewer.locator('[data-view=visual]').click();
-    assert.match(await notice.innerText(),/couldn't confirm whether or not/);
-    await viewer.locator('.work-message-details > summary').click();
-    assert.match(await viewer.locator('.work-message-details').innerText(),outcome==='saved-response-lost'?/HTTP 503/:/receipt is incomplete/);
-    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
-    await mkdir('qa-evidence/review-language',{recursive:true});
-    await page.screenshot({path:'qa-evidence/review-language/'+outcome+'-'+width+'.png',fullPage:true});
-   }finally{await page.close();await fixture.close();}
-  }
- }finally{await browser.close();}
-});
-
-test('review partial receipts give confirmed counts and preserve archive scope',async()=>{
- const fixture=await contextFixture(),browser=await chromium.launch({headless:true});
- try{
-  const page=await browser.newPage({viewport:{width:390,height:1000}});
-  await page.route('**/api/work-review',async route=>{
-   const input=route.request().postDataJSON();if(input.action!=='set')return route.continue();
-   const accepted=await fixture.reviews.body({...input,items:input.items.slice(0,1)});
-   return route.fulfill({json:{results:[...accepted.results,...input.items.slice(1).map(item=>({key:reviewKey(item),ok:false,error:'Synthetic conflict'}))]}});
-  });
-  await page.goto(fixture.origin+'/#/runner');const viewer=page.locator('.work-viewer');
-  await viewer.locator('[data-filter=all]').click();await page.locator('[data-progress-notice]').waitFor({state:'detached'});await page.locator('.work-viewer[data-summary-state=ready]').waitFor();
-  const count=await viewer.locator('[data-select]').count();assert.ok(count>1);
-  await viewer.locator('[data-select-visible]').check();await viewer.getByRole('button',{name:'Mark review complete',exact:true}).click();await viewer.locator('[data-confirm]').click();
-  await viewer.locator('.work-message').filter({hasText:'1 review updated.'}).waitFor();
-  assert.match(await viewer.locator('.work-message').innerText(),new RegExp((count-1)+' reviews? not updated'));
-  assert.doesNotMatch(await viewer.locator('.work-message').innerText(),/Synthetic/);
-  await viewer.getByRole('button',{name:'Archive completed reviews',exact:true}).click();
-  assert.match(await viewer.locator('.work-confirm').innerText(),/1 item/);await viewer.getByRole('button',{name:'Cancel',exact:true}).click();
-  assert.equal(fixture.progress.relay[0].state,'working');
- }finally{await browser.close();await fixture.close();}
-});
diff --git a/apps/web/test/website.test.mjs b/apps/web/test/website.test.mjs
index ba52f46..acc5b71 100644
--- a/apps/web/test/website.test.mjs
+++ b/apps/web/test/website.test.mjs
@@ -1,96 +1,25 @@
-import {reviewFixture,workerSource} from "./work-review-fixture.mjs";
-import test from "node:test";
-import assert from "node:assert/strict";
-import http from "node:http";
-import { mkdir, writeFile, readFile } from "node:fs/promises";
-import { chromium } from "playwright";
-import { webAssets, webBuildId } from "../generated.js";
-import worker from "../../mcp/index.js";
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import {webBuildId,webSourceSha} from '../generated.js';
+import worker from '../../mcp/index.js';
 
-test("website entrypoints serve React and expose a deterministic build identity", async () => {
-  for (const route of ["/", "/index.html"]) {
-    const response = await worker.fetch(new Request("https://relay.loew.fi" + route), {});
-    assert.equal(response.status, 200);
-    assert.equal(response.headers.get("X-Relay-Web-Build"), webBuildId);
-    assert.match(webBuildId, /^[a-f0-9]{64}$/);
-    assert.match(await response.text(), route === "/inspector" ? /data-relay-inspector-navigation/ : /id="root"/);
+test('Relay landing preserves deterministic source/build identity, while retired workspace URLs resolve only to CTRL',async()=>{
+ for(const method of ['GET','HEAD']){
+  for(const path of ['/','/index.html']){
+   const response=await worker.fetch(new Request('https://relay.loew.fi'+path,{method}),{});
+   assert.equal(response.status,200);assert.equal(response.headers.get('X-Relay-Web-Build'),webBuildId);
+   if(webSourceSha)assert.equal(response.headers.get('X-Relay-Source-Sha'),webSourceSha);
+   const body=await response.text();if(method==='HEAD')assert.equal(body,'');else assert.match(body,/id="root"/);
   }
-  const review=await worker.fetch(new Request("https://relay.loew.fi/inspector?project=relay"),{});assert.equal(review.status,308);assert.equal(review.headers.get("Location"),"https://ctrl.loew.fi/inspector?project=relay");
-  for (const route of ["today", "runner", "night-shift"]) {
-    const response = await worker.fetch(new Request("https://relay.loew.fi/" + route + "?project=relay"), {});
-    assert.equal(response.status, 308);
-    assert.equal(response.headers.get("Location"), "https://ctrl.loew.fi/#/" + route + "?project=relay");
+  for(const route of ['today','runner','runner/relay/exact-task','night-shift','inspector','inspector/']){
+   const response=await worker.fetch(new Request('https://relay.loew.fi/'+route+'?project=relay',{method}),{});
+   assert.equal(response.status,308);assert.equal(response.headers.get('Location'),'https://ctrl.loew.fi/#/'+(route==='today'?'now':route.replace(/\/$/,''))+'?project=relay');
   }
+  const retired=await worker.fetch(new Request('https://relay.loew.fi/relay-app.js',{method}),{});
+  assert.equal(retired.status,410);assert.equal(retired.headers.get('X-Content-Type-Options'),'nosniff');
+  assert.equal(retired.headers.get('Content-Type'),'text/plain; charset=utf-8');
+ }
+ assert.match(webBuildId,/^[a-f0-9]{64}$/);
+ const privateApi=await worker.fetch(new Request('https://relay.loew.fi/api/projects'),{});assert.equal(privateApi.status,401);
+ const post=await worker.fetch(new Request('https://relay.loew.fi/runner',{method:'POST'}),{});assert.notEqual(post.status,308,'mutations never redirect across origins');
 });
-
-test("actual built website navigation leaves Inspector for React on desktop and mobile", async () => {
-  const progress = { project: "relay", progress: [{ assignment: "website-repair", goal: "Restore the Relay website", state: "working", observed: true, stage: "implementation", primary_staff: "nico", next_action: "verify the deployed pages", last_meaningful_progress_at: new Date().toISOString(), events: [] }], queue: [] };
-  const workers = [{ id: "relay", name: "relay", enabled: true, runtime: { status: "idle", last_summary: "Website navigation and release verified.", last_run_at: new Date().toISOString() } }];
-  const reviews=reviewFixture(item=>item.kind==='check'?workerSource(workers.find(w=>w.id===item.id)):progress.progress.find(p=>p.assignment===item.id));
-  const server = http.createServer(async (req, res) => {
-    const url = new URL(req.url, "http://localhost");
-    const asset = webAssets[url.pathname];
-    if (asset) { res.setHeader("Content-Type", asset.type); return res.end(asset.text); }
-    res.setHeader("Content-Type", "application/json");
-    if (url.pathname === "/api/work-review") return res.end(JSON.stringify(await reviews.handle(req)));
-    if (url.pathname === "/api/projects") return res.end(JSON.stringify({ projects: [{ id: "relay", name: "relay" }] }));
-    if (url.pathname === "/api/workers") return res.end(JSON.stringify(workers));
-    if (url.pathname === "/api/progress/relay") return res.end(JSON.stringify(progress));
-    if (url.pathname === "/api/visual") return res.end(JSON.stringify({ evidence: [] }));
-    if (url.pathname === "/api/projects/relay") return res.end(JSON.stringify({ project: { id: "relay", name: "relay" }, coordination: { claims: [{ id: "website-repair", state: "active" }] } }));
-    res.statusCode = 404; res.end("{}");
-  });
-  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
-  const origin = "http://127.0.0.1:" + server.address().port;
-  const browser = await chromium.launch({ headless: true });
-  await mkdir("qa-evidence/website", { recursive: true });
-  try {
-    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
-      const page = await browser.newPage({ viewport, colorScheme: "dark", reducedMotion: "reduce" });
-      const errors = [];
-      page.on("pageerror", error => errors.push(error.message));
-      const captures = [];
-      for (const [label, nav, route] of [["today", "today", "today"], ["runner", "projects", "runner"], ["night shift", "night-shift", "night-shift"]]) {
-        await page.goto(origin + "/inspector#review");
-        await page.getByRole("heading", { name: "inspector", exact: true, level: 1 }).waitFor();
-        await page.locator(`[data-nav="${nav}"]`).click();
-        await page.getByRole("heading", { name: label, exact: true, level: 1 }).waitFor();
-        assert.equal(new URL(page.url()).pathname, "/");
-        assert.equal(new URL(page.url()).hash, "#/" + route);
-        assert.equal(await page.locator("#root .react-page").count(), 1);
-        assert.equal(await page.getByRole("group", { name: "All projects in alphabetical order" }).count(), 1);
-        await page.locator('.operator-connection[data-tone="good"]').waitFor();
-        await page.locator("[data-progress-notice]").waitFor({ state: "detached" });
-        const font = await page.locator(".react-operator-nav .nav-copy strong").first().evaluate(node => getComputedStyle(node).fontFamily);
-        assert.match(font, /Momo Trust Display/);
-        const image = await page.locator(".feature-mark").evaluate(node => ({ src: node.src, loaded: node.complete && node.naturalWidth > 0 }));
-        assert.equal(await page.locator(".signal-mark svg").count(), 4);
-        const file = route === "night-shift" ? "nightshift-icon.png.png" : route + "-icon.png";
-        const canonical = "data:image/png;base64," + (await readFile(new URL("../../../icons/" + file, import.meta.url))).toString("base64");
-        assert.ok(image.loaded && image.src === canonical, "page header retains exact canonical brand icon bytes");
-        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
-        await page.screenshot({ path: `qa-evidence/website/${route}-${viewport.width}.png`, fullPage: true });
-        captures.push(route);
-      }
-      await page.getByRole("link", { name: /^inspector/ }).click();
-      await page.getByRole("heading", { name: "inspector", exact: true, level: 1 }).waitFor();
-      assert.equal(await page.locator(".inspector-card-studio").getAttribute("open"),null);
-      await page.locator(".inspector-card-studio > summary").click();
-      await page.locator(".chat-card-preview").waitFor();
-      await page.screenshot({ path: `qa-evidence/website/inspector-${viewport.width}.png`, fullPage: true });
-      assert.equal(new URL(page.url()).pathname, "/inspector");
-      for (const [hash, target] of [["today", "today"], ["projects?project=relay", "runner?project=relay"], ["night-shift", "night-shift"]]) {
-        await page.goto(origin + "/inspector#" + hash);
-        await page.waitForURL(origin + "/#/" + target);
-        assert.equal(await page.getByRole("group", { name: "All projects in alphabetical order" }).count(), 1);
-      }
-      assert.deepEqual(errors, []);
-      await page.close();
-    }
-    await writeFile("qa-evidence/website/result.json", JSON.stringify({ build: webBuildId, ok: true, source: process.env.GITHUB_SHA || null, surfaces: ["today", "runner", "night-shift", "inspector"], viewports: [1440, 390] }, null, 2));
-  } finally {
-    await browser.close();
-    await new Promise(resolve => server.close(resolve));
-  }
-});
-
diff --git a/apps/web/test/work-views.test.mjs b/apps/web/test/work-views.test.mjs
index 3a0c6a8..38646a3 100644
--- a/apps/web/test/work-views.test.mjs
+++ b/apps/web/test/work-views.test.mjs
@@ -1,7 +1,5 @@
 import test from 'node:test';
 import assert from 'node:assert/strict';
-import {chromium} from 'playwright';
-import {contextFixture} from './project-context-fixture.mjs';
 import {normalizePresentation,countVisual} from '../../../packages/shared-ui/presentation.js';
 import {groupedProjects,projectInGroup} from '../../../packages/shared-ui/project-groups.js';
 
@@ -12,27 +10,3 @@ test('retired settings migrate without losing supported choices; fractions requi
  const groups=groupedProjects([{id:'bazzite-custom'},{id:'loew-shell'},{id:'field'},{id:'rtxforge'},{id:'rtxforge-mfg'}]);
  assert.equal(groups.length,3);assert.equal(groups[0].children[0].id,'loew-shell');assert.equal(projectInGroup('loew-shell','bazzite-custom'),true);assert.equal(projectInGroup('rtxforge','bazzite-custom'),false);
 });
-
-test('shared viewer keeps selection and source identity through views, reversible bulk changes, reload, and scoped filters',async()=>{
- const fixture=await contextFixture(),browser=await chromium.launch({headless:true});
- try{
-  for(const width of [1440,390]){
-   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:'dark'});
-   await page.goto(fixture.origin+'/#/runner');await page.locator('.work-viewer[data-summary-state=ready]').waitFor();
-   const viewer=page.locator('.work-viewer');await viewer.locator('[data-filter=all]').click();
-   const checkbox=viewer.locator('[data-select]').first(),key=await checkbox.getAttribute('data-select');await checkbox.check();
-   await viewer.locator('[data-view=visual]').click();assert.equal(await viewer.locator('[data-select]').first().isChecked(),true);assert.equal(await viewer.getAttribute('data-view'),'visual');
-   await viewer.locator('[data-bulk=completed]').click();assert.match(await viewer.locator('.work-confirm').innerText(),/1 item/);await viewer.locator('[data-confirm]').click();await viewer.locator('.work-message').filter({hasText:'1 review updated.'}).waitFor();
-   const row=viewer.locator('[data-work-key]').filter({has:page.locator('[data-select="'+key+'"]')});assert.match(await row.innerText(),/Review: Completed/);
-   assert.equal(fixture.progress.relay[0].state,'working');
-   await viewer.locator('[data-bulk=clear-complete]').click();await viewer.locator('[data-confirm]').click();await viewer.locator('.work-message').filter({hasText:'1 review updated.'}).waitFor();assert.match(await row.innerText(),/Archived/);
-   await viewer.locator('[data-undo]').click();await viewer.locator('.work-message').filter({hasText:'1 review updated.'}).waitFor();assert.match(await row.innerText(),/Review: Completed/,JSON.stringify([...fixture.reviews.values]));
-   await page.reload();await page.locator('.work-viewer[data-summary-state=ready]').waitFor();assert.equal(await viewer.getAttribute('data-view'),'visual');assert.equal(await viewer.locator('[data-select]:checked').count(),0);
-   // Dashboard progress is delivered incrementally; an earlier ready state may\n   // precede another exact-key review read. Await the persisted outcome itself.\n   await page.locator('[data-progress-notice]').waitFor({state:'detached'});\n   const restored=viewer.locator('[data-work-key]').filter({has:page.locator('[data-select="'+key+'"]')});\n   await restored.filter({hasText:'Review: Completed'}).waitFor();\n   assert.match(await restored.innerText(),/Review: Completed/,JSON.stringify([...fixture.reviews.values]));
-   await viewer.locator('[data-filter=all]').click();await viewer.locator('input[type=search]').fill('saved project');assert.equal(await viewer.locator('.work-item').count(),1);
-   await viewer.locator('[data-view=list]').click();assert.equal(await viewer.locator('input[type=search]').inputValue(),'saved project');assert.equal(await viewer.locator('.work-item').count(),1);
-   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
-   await page.close();
-  }
- }finally{await browser.close();await fixture.close();}
-});
diff --git a/contracts/human-output-surfaces.json b/contracts/human-output-surfaces.json
index 2046b27..7eeaefa 100644
--- a/contracts/human-output-surfaces.json
+++ b/contracts/human-output-surfaces.json
@@ -2,7 +2,7 @@
   "schema": 1,
   "catalog_version": 1,
   "reviewed_base": "995705af5014663808a0438c4d409861363ae662",
-  "scope": "Bounded common presentation, website status labels and review-action migration; remaining producers are explicitly open",
+  "scope": "First bounded presentation slice; not a repository-wide migration",
   "surfaces": [
     {
       "source": "src/communication-presentation.js",
@@ -81,16 +81,16 @@
       "reason": "Unstructured legacy errors and protocol/auth bodies remain unchanged. No claim that every MCP default text is human-v1 prose."
     },
     {
-      "source": "packages/shared-ui/",
+      "source": "apps/web/src/pages/RelayPage.tsx",
       "symbols": [
-        "notifications",
-        "file-manager",
-        "remaining execution and provider outcomes"
+        "connection status",
+        "live telemetry",
+        "file-manager"
       ],
       "audience": "human",
       "surface": "website",
       "status": "migration-pending",
-      "reason": "Website state/event labels and review actions are covered separately below. Notifications, Files and remaining execution/provider outcomes require later bounded migrations."
+      "reason": "Only the legitimate Relay landing and Files remain product UI here. Full workspace and review wording belongs to canonical CTRL. The stopped PR179 old-panel wording is not shipped."
     },
     {
       "source": "src/",
@@ -104,37 +104,16 @@
       "reason": "Unknown success shapes receive a neutral unrecognized result. Existing legacy error classifier text adapters are retained outside explicit operation typing; further producers need stable codes and fixtures."
     },
     {
-      "source": "packages/shared-ui/presentation-copy.js",
+      "source": "apps/web/build.mjs",
       "symbols": [
-        "statusLabel",
-        "phaseLabel",
-        "eventLabel"
+        "legacy Inspector output",
+        "MCP control-center compatibility resource",
+        "retained previews"
       ],
       "audience": "human",
-      "surface": "website-state-and-event-labels",
-      "status": "covered",
-      "fixtures": [
-        "website labels distinguish observed facts",
-        "prototype-like unknown values"
-      ],
-      "reason": "Reuses the typed common state catalog; reservations, enabled workers, PR events and deployment receipts do not imply readiness, scheduling or verification. Existing summaryText diagnostic filtering remains a legacy adapter."
-    },
-    {
-      "source": "packages/shared-ui/work-viewer.js",
-      "symbols": [
-        "render",
-        "loadRecords",
-        "apply"
-      ],
-      "audience": "human",
-      "surface": "review-actions-and-save-outcomes",
-      "status": "covered",
-      "fixtures": [
-        "actual generated review UI preserves an uncertain save",
-        "review partial receipts give confirmed counts",
-        "shared viewer keeps selection and source identity"
-      ],
-      "reason": "Actions explicitly name review metadata/archive semantics. Incomplete or lost receipts stay unconfirmed across readback; confirmed counts and Undo use only verified per-item receipts. Raw diagnostics are sanitized in expandable detail. Review quota/backoff and broad provider classification remain open."
+      "surface": "retired-full-panel-consumers",
+      "status": "internal-only",
+      "reason": "No full control-panel program is generated or served. Compatibility resources are inert CTRL handoffs. Historical source and immutable retention readers remain recovery evidence; new previews target the Relay landing."
     }
   ],
   "release_gates": [
diff --git a/docs/relay/HUMAN_LANGUAGE_WEBSITE_20261007.md b/docs/relay/HUMAN_LANGUAGE_WEBSITE_20261007.md
index a9533b2..2f88105 100644
--- a/docs/relay/HUMAN_LANGUAGE_WEBSITE_20261007.md
+++ b/docs/relay/HUMAN_LANGUAGE_WEBSITE_20261007.md
@@ -1,22 +1,7 @@
-# Human-language website and review slice
+# Stopped website-language candidate
 
-Base: `ba35b3344ec379d5fdc61cd3b0fc318d46b2acb1`, after the verified GW deployment-permission release in PR178. The separately preserved favicon patch is excluded.
+PR179 candidate `d41262431b904364fdbed0219994ff01bc40bc58` passed its deterministic gates, but Lauren rejected the preview because it exposed the obsolete Relay control panel. The candidate remained an unmerged draft and did not change production. Its code, test receipts and immutable synthetic preview are recovery evidence, not approved product UI.
 
-## What changes
+The neutral common fallback in `src/human-presentation.js` and its compatibility tests remain valid. The website status/review changes are withdrawn from Relay. CTRL is the canonical consumer and has evolved work-state logic; any port must be a linked, independently admitted change against current CTRL source, preserving its newer behavior.
 
-- Unknown query and command results say “Update available,” without implying a write was recorded. Operation and mutation facts remain unchanged.
-- Website work labels reuse the common state formatter. Reservations mean waiting to start; an enabled worker does not promise a scheduled run. Opening a pull request does not claim readiness for review, and recording a deployment does not establish live verification. Unknown and prototype-like values keep a conservative string fallback.
-- Review controls explicitly say “Mark review complete,” “Mark out of date,” “Archive completed reviews,” “Archive out-of-date reviews,” “Reopen review” and “Restore to review list.” Existing action IDs, exact loaded-item scope, confirmation, source identity checks, and reversible Undo remain intact. Cancel restores focus to the originating action.
-- Successful per-item receipts give grammatical confirmed counts. Missing, duplicate or incomplete receipts remain uncertain. A lost write response triggers the existing readback, and the warning survives that refresh. The latest review statuses are displayed without replaying the write or claiming task completion. Sanitized diagnostic detail stays expandable.
-
-## Preview and verification
-
-The existing authenticated, content-addressed retained-preview workflow now also runs for this admitted same-repository draft branch after quality passes. It builds the exact candidate, uses synthetic data, verifies the served bundle, and checks an opaque-origin, network-denying sandbox. It creates no Worker, credential, permission or production binding. Each coherent UI candidate must deliver its verified preview URL and a brief change note; previews are unfinished review artifacts, not release evidence.
-
-Tests cover query versus command neutrality, semantic label distinctions, unknown values, actual generated desktop/mobile review recovery, a saved write with a lost response, incomplete and partial receipts, no mutation replay, confirmed counts, archive scope, Cancel focus, and unchanged task state. All five suites, exact build, source contracts, workerd, browser and post-merge production gates still apply. Browser fixtures are synthetic; they do not prove native ChatGPT behavior or a real human-account review lifecycle.
-
-## Remaining scope and rollback
-
-This is not the full proposed language catalog. Legacy summary diagnostic filtering, notification/Files/execution copy, review quota timing and provider classifications remain explicit open surfaces in the manifest. Existing API codes, payloads and security boundaries remain authoritative.
-
-Revert this coherent source change through the normal checked release path to restore prior website copy and behavior. The preexisting presentation flag remains available for the common MCP/card layer; it does not roll back this website slice. Neither rollback removes review records, task data, source checkpoints or Files tombstones. Preserve the GW permission registration and allowlist from PR178.
+The corrected scope is documented in `OBSOLETE_PANEL_RETIREMENT_20261007.md`. Relay keeps its connection/telemetry landing, Files, authenticated backend and compact status cards. New previews must show that legitimate landing, never the old full control panels. Existing historical retention and recovery records stay intact.
diff --git a/packages/shared-ui/presentation-copy.js b/packages/shared-ui/presentation-copy.js
index 51b0ef0..5fe5152 100644
--- a/packages/shared-ui/presentation-copy.js
+++ b/packages/shared-ui/presentation-copy.js
@@ -1,22 +1,18 @@
-import {normalizeCommunicationResult,formatRelay} from '../../src/human-presentation.js';
 // Display-only language; original state and diagnostics remain available in Details.
 const statuses = {
-  running: 'running', 'waiting-for-human': 'needs review',
+  'reserved-but-idle': 'ready to start', queued: 'waiting to start', working: 'in progress', running: 'running',
+  'waiting-for-human': 'needs your decision', 'waiting-on-external-system': 'waiting for a response',
   blocked: 'needs help', failed: 'needs a fix', complete: 'completed',
   deployed: 'deployed', verified: 'verified', 'officially-stale': 'update overdue',
   'possibly-stale': 'may need an update', stale: 'last update may be old',
   live: 'up to date', connecting: 'connecting', reconnecting: 'refreshing', offline: 'unavailable',
-  enabled: 'enabled', paused: 'paused', idle: 'idle', waiting_credentials: 'needs access', recorded: 'update received', open: 'open', draft: 'draft', merged: 'merged', closed: 'closed'
+  enabled: 'scheduled', paused: 'paused', idle: 'ready', waiting_credentials: 'needs access', recorded: 'update received'
 };
-const phases = { checks: 'checking', held: 'on hold', reserved: 'waiting to start', 'liveness-check': 'checking for updates', 'pull-request': 'pull request', reconciliation: 'resolving a mismatch', planning: 'planning', implementation: 'building', coding: 'building', testing: 'checking', verification: 'verifying', review: 'review', delivery: 'delivery', deployment: 'deployment', complete: 'completed' };
-const events = { 'claim-created': 'work reserved', 'runner-heartbeat': 'work status refreshed', 'source-commit': 'source change recorded', 'pull-request-opened': 'pull request opened', 'pull-request-updated': 'pull request updated', 'check-started': 'check started', 'check-completed': 'check finished', 'cloud-deployment': 'deployment recorded', 'assignment-claimed': 'work assigned', 'work-started': 'work started', 'commit-created': 'source change recorded', 'pr-opened': 'pull request opened', 'pr-merged': 'changes merged', 'deployment-started': 'deployment started', 'deployment-completed': 'deployment finished', 'verification-passed': 'checks passed', 'verification-failed': 'checks need attention', completed: 'work completed' };
-export function statusLabel(value) {
-  if(value==='waiting-for-human')return statuses[value];
-  const normalized=normalizeCommunicationResult({state:value});
-  return normalized.message_id!=='data.unrecognized'?formatRelay(normalized).label.toLowerCase():Object.hasOwn(statuses,value)?statuses[value]:'status not reported';
-}
-export function phaseLabel(value) { return Object.hasOwn(phases,value)?phases[value]:Object.hasOwn(statuses,value)?statuses[value]:'phase not reported'; }
-export function eventLabel(value) { return Object.hasOwn(events,value)?events[value]:'progress update'; }
+const phases = { checks: 'checking', held: 'on hold', reserved: 'ready to start', 'liveness-check': 'checking for updates', 'pull-request': 'review', reconciliation: 'resolving a mismatch', planning: 'planning', implementation: 'building', coding: 'building', testing: 'checking', verification: 'verifying', review: 'ready for review', delivery: 'delivery', deployment: 'deployment', complete: 'completed' };
+const events = { 'claim-created': 'work reserved', 'runner-heartbeat': 'work status refreshed', 'source-commit': 'changes saved', 'pull-request-opened': 'ready for review', 'pull-request-updated': 'review updated', 'check-started': 'check started', 'check-completed': 'check finished', 'cloud-deployment': 'deployed', 'assignment-claimed': 'work picked up', 'work-started': 'work started', 'commit-created': 'changes saved', 'pr-opened': 'ready for review', 'pr-merged': 'changes merged', 'deployment-started': 'deployment started', 'deployment-completed': 'deployment finished', 'verification-passed': 'checks passed', 'verification-failed': 'checks need attention', completed: 'work completed' };
+export function statusLabel(value) { return statuses[value] || 'status not reported'; }
+export function phaseLabel(value) { return phases[value] || statuses[value] || 'phase not reported'; }
+export function eventLabel(value) { return events[value] || 'progress update'; }
 export function summaryText(value, fallback) {
   if (!value) return fallback;
   // Infrastructure diagnostics belong in optional Details, not the glance summary.
diff --git a/packages/shared-ui/work-viewer.js b/packages/shared-ui/work-viewer.js
index 47c1fe9..bd9abbc 100644
--- a/packages/shared-ui/work-viewer.js
+++ b/packages/shared-ui/work-viewer.js
@@ -4,23 +4,19 @@ import {projectInGroup} from "./project-groups.js";
 import {glyph} from './glyphs.js';
 import {reviewKey,effectiveReview,selectWork,reviewTransition} from './work-view-model.js';
 import {iconSlot,hydrateProjectIcons} from '../../apps/web/public/project-icons.js';
-import {statusLabel} from './presentation-copy.js';
-import {formatRelay,normalizeCommunicationResult,safePresentationText} from '../../src/human-presentation.js';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
-const labels={pending:'Need review',completed:'Completed',stale:'Out of date',archived:'Archived',all:'All'};
-const unknownSave=formatRelay(normalizeCommunicationResult({ok:false,error:{class:'uncertain_write'}},{operation:{name:'review_update',kind:'command'}})).summary;
-const reviewCount=count=>count+' review'+(count===1?'':'s');
+const labels={pending:'Need review',completed:'Completed',stale:'Stale',archived:'Archived',all:'All'};
 const names={relay:'relay',field:'field',loewfi:'loew.fi',rtxforge:'rtxForge','bazzite-custom':'loewOS',gamebridge:'GameBridge'};
 const name=id=>names[id]||id.replace(/[-_]+/g,' ');
 export function projectBadge(project){return '<span class="work-project-badge">'+iconSlot(project)+'<strong>'+escape(name(project))+'</strong></span>';}
 function safeHref(value){try{const url=new URL(value,location.origin);return url.origin===CTRL_ORIGIN?url.href:url.origin===location.origin?url.pathname+url.search+url.hash:'';}catch{return '';}}
 async function request(action,items){
  const response=await fetch('/api/work-review',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({action,items}),signal:AbortSignal.timeout(45000)});
- if(!response.ok)throw new Error('Review storage returned HTTP '+response.status+'.');
+ if(!response.ok)throw new Error('Review storage returned '+response.status+'. Refresh before trying again.');
  return response.json();
 }
 export function bindWorkViewer(root,{id,defaultView='list',onOpen,initialFilter='pending',predicates={},extensionControls=[]}={}){
- let items=[],records={},loaded=false,incomplete=true,project='',view=defaultView,query={filter:initialFilter,search:'',sort:'time',direction:'desc',extensions:{}},selection=new Set(),scope='selected',pending=null,undo=[],busy=false,message='',messageDetails='',uncertainSave=false,generation=0,disposed=false;
+ let items=[],records={},loaded=false,incomplete=true,project='',view=defaultView,query={filter:initialFilter,search:'',sort:'time',direction:'desc',extensions:{}},selection=new Set(),scope='selected',pending=null,undo=[],busy=false,message='',generation=0,disposed=false;
  const storageKey='relay.work-view.'+id;let anchorRestored=false;const fresh=new Set();
  try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved){view=['list','visual'].includes(saved.view)?saved.view:defaultView;const prior=saved.query||{};query={...query,filter:Object.hasOwn(labels,prior.filter)?prior.filter:initialFilter,search:typeof prior.search==='string'?prior.search:'',sort:['time','importance'].includes(prior.sort)?prior.sort:'time',direction:['asc','desc'].includes(prior.direction)?prior.direction:'desc',extensions:prior.extensions&&typeof prior.extensions==='object'&&!Array.isArray(prior.extensions)?prior.extensions:{}};}}catch{}
  const save=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({view,query}));}catch{}};
@@ -45,11 +41,10 @@ export function bindWorkViewer(root,{id,defaultView='list',onOpen,initialFilter=
    <p class="work-query-help">Time follows source activity. Importance uses reported priority; missing values stay unranked. Review status never changes the source task.</p>
    <div class="work-selection-bar"><label><input type="checkbox" data-select-visible data-focus="select-visible" ${rows.length&&rows.every(item=>selection.has(reviewKey(item)))?'checked':''}>Select these ${rows.length} items</label><span>${selection.size} selected${hidden?' · '+hidden+' outside these results':''}</span><button type="button" data-clear-selection ${!selection.size?'disabled':''}>Clear selection</button></div>
    <div class="work-bulk-bar"><label>Action scope<select name="scope" data-focus="scope"><option value="selected" ${scope==='selected'?'selected':''}>Selected items</option><option value="filtered" ${scope==='filtered'?'selected':''}>Current filtered results</option><option value="all-projects" ${scope==='all-projects'?'selected':''}>All projects · matching loaded results</option></select></label>
-   ${[['pending','Reopen review'],['completed','Mark review complete'],['stale','Mark out of date'],['clear-complete','Archive completed reviews'],['clear-stale','Archive out-of-date reviews'],['restore','Restore to review list']].map(([action,label])=>`<button type="button" data-bulk="${action}" ${busy||!loaded||!changedTargets(action).length?'disabled':''}>${label}</button>`).join('')}</div>
+   ${[['pending','Reopen'],['completed','Mark complete'],['stale','Mark stale'],['clear-complete','Clear complete'],['clear-stale','Clear stale'],['restore','Restore']].map(([action,label])=>`<button type="button" data-bulk="${action}" ${busy||!loaded||!changedTargets(action).length?'disabled':''}>${label}</button>`).join('')}</div>
    ${incomplete?'<p class="work-query-help">Some source results are unavailable or this feed is bounded. Actions affect only the exact loaded items shown in the confirmation.</p>':''}
    ${pending?`<div class="work-confirm" role="group" aria-label="Confirm review changes"><strong>${escape(pending.label)}: ${pending.items.length} item${pending.items.length===1?'':'s'} in ${new Set(pending.items.map(item=>item.project)).size} project(s)</strong><p>${escape(pending.scope)}. ${escape(query.search?'Search: '+query.search+'. ':'')}Source tasks and PRs remain unchanged.</p><button type="button" data-confirm ${busy?'disabled':''}>Apply to these ${pending.items.length} items</button><button type="button" data-cancel ${busy?'disabled':''}>Cancel</button></div>`:''}
    <div class="work-message" role="status">${escape(message)}${!loaded&&!busy?'<button type="button" data-refresh>Refresh review state</button>':''}${undo.length?'<button type="button" data-undo '+(busy?'disabled':'')+'>Undo last change</button>':''}</div>
-   ${messageDetails?'<details class="work-message-details"><summary>Technical details</summary><p>'+escape(messageDetails)+'</p></details>':''}
   </div>
   <div class="work-results" aria-label="Work items">${rows.length?rows.map(item=>{
    const key=reviewKey(item),review=effectiveReview(item,records[key]),url=safeHref(item.href||'');
@@ -58,8 +53,8 @@ export function bindWorkViewer(root,{id,defaultView='list',onOpen,initialFilter=
    return `<article class="work-item${item.kind==='evidence'?' review-row':''}" data-work-key="${escape(key)}" data-new-work="${fresh.has(key)}" tabindex="-1"><label class="work-select"><input type="checkbox" data-select="${escape(key)}" data-focus="select-${escape(key)}" ${selection.has(key)?'checked':''} aria-label="Select ${escape(item.title)} in ${escape(name(item.project))}"></label>
     <div class="work-item-visual" aria-hidden="true">${image?`<img src="${escape(image)}" alt="" loading="lazy">`:glyph(item.kind==='check'?'moon':item.sourceState==='blocked'?'repair':'play')}</div>
     <div class="work-item-copy">${projectBadge(item.project)}<h3>${title}</h3><p>${escape(item.detail)}</p><p class="work-next"><span>${item.detail&&['blocked','failed'].includes(item.sourceState)?'Blocked':'Next'}</span> ${escape(item.next)}</p>
-    <div class="work-item-meta"><span>Review: ${review.archived?'Archived · ':''}${labels[review.status]}</span><span>Source: ${escape(statusLabel(item.sourceState))}</span><time ${item.time==null?'':`datetime="${new Date(item.time).toISOString()}"`}>${item.time==null?'Time unknown':new Date(item.time).toLocaleString()}</time><span>${escape(item.priority||'Unranked')}</span></div>
-    <details><summary>Details</summary><div class="work-source-detail"><code>${escape(item.id)}</code><p>Source state: ${escape(item.sourceState)}</p>${item.source?.identities?.branch?`<p>Branch: ${escape(item.source.identities.branch)}</p>`:''}${item.source?.identities?.head_sha?`<p>Head: ${escape(item.source.identities.head_sha)}</p>`:''}${item.source?.identities?.pr?`<p>PR: ${escape(item.source.identities.pr)}</p>`:''}<p>${escape(item.source?.next_action||item.source?.runtime?.last_summary||'')}</p></div></details></div></article>`;
+    <div class="work-item-meta"><span>Review: ${review.archived?'Archived · ':''}${labels[review.status]}</span><span>Source: ${escape(item.sourceState)}</span><time ${item.time==null?'':`datetime="${new Date(item.time).toISOString()}"`}>${item.time==null?'Time unknown':new Date(item.time).toLocaleString()}</time><span>${escape(item.priority||'Unranked')}</span></div>
+    <details><summary>Details</summary><div class="work-source-detail"><code>${escape(item.id)}</code>${item.source?.identities?.branch?`<p>Branch: ${escape(item.source.identities.branch)}</p>`:''}${item.source?.identities?.head_sha?`<p>Head: ${escape(item.source.identities.head_sha)}</p>`:''}${item.source?.identities?.pr?`<p>PR: ${escape(item.source.identities.pr)}</p>`:''}<p>${escape(item.source?.next_action||item.source?.runtime?.last_summary||'')}</p></div></details></div></article>`;
   }).join(''):`<div class="empty-card"><strong>${items.length?'No matching work.':incomplete?'Waiting for source results.':'No work to show yet.'}</strong><p>${items.length?'Try All or change your search.':'Work appears when Relay receives source activity.'}</p></div>`}</div>`;
   settleMotionLayout(root,motionBefore);
   for(const item of rows)fresh.delete(reviewKey(item));
@@ -72,19 +67,18 @@ export function bindWorkViewer(root,{id,defaultView='list',onOpen,initialFilter=
   const gen=++generation;loaded=false;render();
   try{
    const found={};
-   for(let start=0;start<items.length;start+=100){const batch=items.slice(start,start+100);const response=await request('read',batch.map(({project,kind,id})=>({project,kind,id})));if(!Array.isArray(response.results)||response.results.length!==batch.length||new Set(response.results.map(row=>row?.key)).size!==batch.length||response.results.some(row=>!batch.some(item=>reviewKey(item)===row?.key)||typeof row.ok!=='boolean'||row.ok&&(row.record!==null&&(!row.record||typeof row.record!=='object'||Array.isArray(row.record))||row.etag!==null&&typeof row.etag!=='string')))throw Error('Review status receipt is incomplete.');if(response.results.some(row=>!row.ok))throw new Error('Some review states could not load. Refresh before changing them.');for(const row of response.results){const item=items.find(candidate=>reviewKey(candidate)===row.key),legacy=item?.source?.qaReview;found[row.key]=row.record?{...row.record,etag:row.etag}:legacy?{etag:null,source_revision:item.revision,status:legacy.disposition==='archived'?'stale':['completed','stale'].includes(legacy.disposition)?legacy.disposition:legacy.overall?'completed':'pending',archived:legacy.disposition==='archived'}:{etag:null};}}
-   if(disposed||gen!==generation)return;records=found;loaded=true;message=uncertainSave?unknownSave+' The latest review statuses are shown below. Check them before trying again.':'';if(!uncertainSave)messageDetails='';render();
-  }catch(error){if(!disposed&&gen===generation){message=(uncertainSave?unknownSave+' ':'')+"Relay couldn't load the review statuses. Changes are paused until the statuses can be checked.";messageDetails=safePresentationText(error.message);render();}}
+   for(let start=0;start<items.length;start+=100){const response=await request('read',items.slice(start,start+100).map(({project,kind,id})=>({project,kind,id})));if(response.results.some(row=>!row.ok))throw new Error('Some review states could not load. Refresh before changing them.');for(const row of response.results){const item=items.find(candidate=>reviewKey(candidate)===row.key),legacy=item?.source?.qaReview;found[row.key]=row.record?{...row.record,etag:row.etag}:legacy?{etag:null,source_revision:item.revision,status:legacy.disposition==='archived'?'stale':['completed','stale'].includes(legacy.disposition)?legacy.disposition:legacy.overall?'completed':'pending',archived:legacy.disposition==='archived'}:{etag:null};}}
+   if(disposed||gen!==generation)return;records=found;loaded=true;message='';render();
+  }catch(error){if(!disposed&&gen===generation){message=error.message;render();}}
  }
  async function apply(changes,isUndo=false){
-  if(busy)return;busy=true;pending=null;uncertainSave=false;messageDetails='';message='Saving review changes…';render();const accepted=[],errors=[];
+  if(busy)return;busy=true;pending=null;message='Saving review changes…';render();const accepted=[],errors=[];
   try{
    for(let start=0;start<changes.length;start+=100){const batch=changes.slice(start,start+100);const response=await request('set',batch.map(change=>change.payload));
-    if(!Array.isArray(response.results)||response.results.length!==batch.length||new Set(response.results.map(row=>row?.key)).size!==batch.length||response.results.some(row=>!batch.some(entry=>entry.key===row?.key)||typeof row.ok!=='boolean'||row.ok&&(!row.record||typeof row.record!=='object'||Array.isArray(row.record)||typeof row.etag!=='string'||['source_revision','status','archived'].some(key=>row.record[key]!==batch.find(entry=>entry.key===row.key).payload[key]))))throw Error('Review update receipt is incomplete.');
     for(const row of response.results){const change=batch.find(entry=>entry.key===row.key);if(row.ok){records[row.key]={...row.record,etag:row.etag};accepted.push({key:row.key,item:change.item,before:change.before,after:records[row.key]});}else errors.push(row.error);}
    }
-   undo=isUndo?[]:accepted;message=reviewCount(accepted.length)+' updated.'+(errors.length?' '+reviewCount(errors.length)+' not updated.':'');messageDetails=errors.length?safePresentationText(errors.join('; ')):'';
-  }catch(error){loaded=false;uncertainSave=true;message=unknownSave+' Check the latest review statuses before trying again.';messageDetails=safePresentationText(error.message);undo=isUndo?[]:accepted;}
+   undo=isUndo?[]:accepted;message=`${accepted.length} review item(s) updated.`+(errors.length?' '+errors.length+' not changed: '+errors[0]:'');
+  }catch(error){loaded=false;message='The save result is uncertain. Refresh review state before trying again. '+error.message;undo=isUndo?[]:accepted;}
   finally{busy=false;render();if(!loaded)void loadRecords();}
  }
  function newWork(event){for(const item of event.detail||[])fresh.add(reviewKey(item));}
@@ -101,7 +95,7 @@ export function bindWorkViewer(root,{id,defaultView='list',onOpen,initialFilter=
   if(button.dataset.view){view=button.dataset.view;save();render();}
   if(button.hasAttribute('data-clear-selection')){selection.clear();pending=null;render();}
   if(button.dataset.bulk){const action=button.dataset.bulk;pending={action,label:button.textContent,items:changedTargets(action).map(item=>({...item})),scope:scope==='selected'?`${selection.size} selected, including ${[...selection].filter(key=>!visible().some(item=>reviewKey(item)===key)).length} outside these results`:scope==='all-projects'?'All projects, matching loaded results':`Current results in ${project?name(project):'all projects'}`};render();root.querySelector('[data-confirm]')?.focus();}
-  if(button.hasAttribute('data-cancel')){const action=pending?.action;pending=null;render();if(action)root.querySelector('[data-bulk="'+action+'"]')?.focus();}
+  if(button.hasAttribute('data-cancel')){pending=null;render();}
   if(button.hasAttribute('data-confirm')&&pending){const action=pending.action.startsWith('clear-')?'archive':pending.action;void apply(pending.items.map(item=>{const key=reviewKey(item),before=effectiveReview(item,records[key]),after=reviewTransition(before,action);return {key,item,before,payload:{project:item.project,kind:item.kind,id:item.id,source_revision:item.revision,expected_etag:records[key]?.etag??null,operation_id:crypto.randomUUID(),...after}};}));}
   if(button.hasAttribute('data-undo'))void apply(undo.map(entry=>({key:entry.key,item:entry.item,before:effectiveReview(entry.item,entry.after),payload:{project:entry.item.project,kind:entry.item.kind,id:entry.item.id,source_revision:entry.item.revision,expected_etag:entry.after.etag,operation_id:crypto.randomUUID(),...entry.before}})),true);
   if(button.dataset.open)onOpen?.(items.find(item=>reviewKey(item)===button.dataset.open));
diff --git a/scripts/retain-web-preview.mjs b/scripts/retain-web-preview.mjs
index 70dc43f..e2b5fa8 100644
--- a/scripts/retain-web-preview.mjs
+++ b/scripts/retain-web-preview.mjs
@@ -22,15 +22,16 @@ const browser=await chromium.launch(),captures=[];
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}])for(const entry of ['app','inspector']){
   const page=await browser.newPage({viewport,colorScheme:'dark',reducedMotion:'reduce'});
-  const hash=entry==='app'?'#/today':'#review',url=origin+manifest.url+'?entry='+entry+hash;
+  const hash=entry==='app'?'#/':'',url=origin+manifest.url+'?entry='+entry+hash;
   await page.route(origin+'/**',route=>route.continue({headers:{...route.request().headers(),...headers}}));
   const response=await page.goto(url);assert.ok(response.ok());assert.match(response.headers()['content-security-policy'],/sandbox allow-scripts;/);assert.doesNotMatch(response.headers()['content-security-policy'],/allow-same-origin/);
-  if(entry==='app')await page.locator('.work-viewer[data-summary-state=ready]').waitFor();else await page.locator('#review-list[data-summary-state=ready]').waitFor();
+  if(entry==='app'){await page.getByRole('heading',{name:'relay',exact:true,level:1}).waitFor();await page.locator('.live-telemetry[data-loading=false]').waitFor();assert.equal(await page.getByRole('button',{name:'Open files',exact:true}).isDisabled(),true);}else await page.getByRole('heading',{name:'Inspector is in CTRL',exact:true}).waitFor();
+  assert.equal(await page.locator('.operator-nav,.work-viewer,#review-list').count(),0,'new previews never expose retired full panels');
   const isolation=await page.evaluate(()=>({origin:window.origin,fixture:window.__retainedFixture?.data_mode,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(isolation.origin,'null');assert.equal(isolation.fixture,'synthetic');assert.equal(isolation.overflow,false);
-  await page.locator('.presentation-menu > summary').click();await page.locator('[name=preset]').selectOption(viewport.width<900?'bottom':'rich');await page.keyboard.press('Escape');
+  if(entry==='app'){await page.getByRole('button',{name:'connect your AI'}).click();await page.getByRole('heading',{name:'Connect your AI'}).waitFor();await page.getByLabel('Add Relay to AI').getByRole('button',{name:'Close',exact:true}).click();}
   const screenshot=await page.screenshot(),surface='retained-'+entry+'-'+viewport.width;
   await writeFile(directory+'/'+surface+'.png',screenshot);
-  const metadata={kind:'retained_interactive_preview',target_url:origin+(entry==='inspector'?'/inspector':'/'),context:{project:'relay',environment:'preview',surface,commit_sha:expected},viewport,engine:'github-chromium',engine_reason:'retained_exact_build_verification',step_label:surface+' · exact retained build · sample data',title:'Retained '+expected.slice(0,7)+' · '+entry+' · sample data',dom:{fixture:true,data_mode:'synthetic',retained_preview:{id,entry,hash,sha256},build:webBuildId,qa_helper:{title:'Retained interactive build',purpose:'Try this exact build using sample data. Preview changes cannot affect real projects.',artifact:{repository:'lrnolivia/relay',head_sha:expected,environment:'preview',retained_build:id},questions:['Do navigation, spacing and controls feel right at this width?','Can you move between views without losing your place?'],checklist:['Try Settings, filters and the List/Visual switch.','Preview changes reset; approve the build separately only when you are ready.'],overall_verdict:null,known_issues:[],visuals:{evidence_ids:[]}}},assertions:[{id:'opaque-origin',status:'pass',detail:'Browser window origin is null under HTTP sandbox.'},{id:'exact-bundle',status:'pass',detail:'Content-addressed manifest readback matches exact build.'},{id:'synthetic-data',status:'pass',detail:'Fixture adapter is active; no production API transport.'}],trace:[{action:'render_retained_build',url,source_sha:expected,data_mode:'synthetic'}]};
+  const metadata={kind:'retained_interactive_preview',target_url:origin+(entry==='inspector'?'/inspector':'/'),context:{project:'relay',environment:'preview',surface,commit_sha:expected},viewport,engine:'github-chromium',engine_reason:'retained_exact_build_verification',step_label:surface+' · exact retained build · sample data',title:'Retained '+expected.slice(0,7)+' · '+entry+' · sample data',dom:{fixture:true,data_mode:'synthetic',retained_preview:{id,entry,hash,sha256},build:webBuildId,qa_helper:{title:'Retained interactive build',purpose:'Try this exact build using sample data. Preview changes cannot affect real projects.',artifact:{repository:'lrnolivia/relay',head_sha:expected,environment:'preview',retained_build:id},questions:['Does the Relay connection and telemetry landing page remain clear at this width?','Does the compatibility page identify CTRL without showing a duplicate panel?'],checklist:['Inspect the Relay landing page and open/close connection guidance. Files and real connection actions are unavailable in the sample preview.','Preview changes reset; approve the build separately only when you are ready.'],overall_verdict:null,known_issues:[],visuals:{evidence_ids:[]}}},assertions:[{id:'opaque-origin',status:'pass',detail:'Browser window origin is null under HTTP sandbox.'},{id:'exact-bundle',status:'pass',detail:'Content-addressed manifest readback matches exact build.'},{id:'synthetic-data',status:'pass',detail:'Fixture adapter is active; no production API transport.'}],trace:[{action:'render_retained_build',url,source_sha:expected,data_mode:'synthetic'}]};
   const form=new FormData();form.set('metadata',JSON.stringify(metadata));form.set('screenshot',new Blob([screenshot],{type:'image/png'}),surface+'.png');
   const ingested=await fetch(origin+'/evidence/ingest',{method:'POST',headers,body:form,signal:AbortSignal.timeout(45000)});assert.ok(ingested.ok,'retained evidence upload: '+ingested.status);const evidence=await ingested.json();
   const linked=await fetch(origin+'/api/visual/'+evidence.evidence_id+'/live',{headers,signal:AbortSignal.timeout(45000)});assert.ok(linked.ok);assert.equal((await linked.json()).live?.retained?.id,id);
diff --git a/src/index.js b/src/index.js
index 2ecaf54..8be87f3 100644
--- a/src/index.js
+++ b/src/index.js
@@ -382,8 +382,8 @@ async function mcp(request, access, env) {
         {
           uri: RELAY_CONTROL_CENTER_URI,
           name: "relay-control-center",
-          title: "Relay control center",
-          description: "Interactive control surface for relay.CONTROL, relay.RUNNER, relay.SOURCE, relay.CLOUD, and relay.VERIFY.",
+          title: "Open CTRL",
+          description: "Compatibility handoff to CTRL, the canonical workspace interface. Relay supplies backend tools and compact status cards.",
           mimeType: "text/html;profile=mcp-app"
         },
         relayContextCardDescriptor(),
@@ -401,8 +401,8 @@ async function mcp(request, access, env) {
     if (uri === HOST_PROBE_URI) return rpc(id, { contents: [hostProbeResource()] });
     if (uri === ACTION_PROBE_URI) return rpc(id, { contents: [actionProbeResource()] });
     if (isCardVariantUri(uri)) return rpc(id, { contents: [cardVariantResource(uri)] });
-    if (uri === RELAY_CONTROL_CENTER_URI) {
-      return rpc(id, { contents: [relayControlCenterResource()] });
+    if (uri === RELAY_CONTROL_CENTER_URI || uri === "ui://relay/control-center/v4.html") {
+      return rpc(id, { contents: [{...relayControlCenterResource(), uri}] });
     }
     if (uri === RELAY_CONTEXT_CARD_URI || uri === 'ui://relay/context-card/v15.html' || uri === 'ui://relay/context-card/v13.html' || uri === 'ui://relay/context-card/v12.html' || uri === 'ui://relay/context-card/v11.html') {
       return rpc(id, { contents: [{...relayContextCardResource(), uri}] });
@@ -438,8 +438,8 @@ async function mcp(request, access, env) {
 
         {
           name: "relay_ui_control_center",
-          title: "Open Relay control center",
-          description: "Render Relay's interactive control center for inspecting namespaces, Runner state, source/cloud readiness, and verification engines. Use this when a visual Relay overview or control surface would help.",
+          title: "Open CTRL",
+          description: "Show a compatibility link to CTRL, the canonical interface for workspace activity, Runner, Inspector and Night Shift. Relay keeps its backend tools, connection page and compact status cards.",
           inputSchema: { type: "object", properties: {}, additionalProperties: false },
           annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
           _meta: {
diff --git a/src/relay-chat-ui.js b/src/relay-chat-ui.js
index a0a8154..98230a0 100644
--- a/src/relay-chat-ui.js
+++ b/src/relay-chat-ui.js
@@ -206,7 +206,7 @@ function compactCardBrandAssets(html) {
   return html.replace(marker,'const CARD_BRAND_ASSETS={"relay":document.querySelector("#feature-mark img").getAttribute("src")');
 }
 export function relayContextCardResource() {
-  return { uri:RELAY_CONTEXT_CARD_URI, mimeType:'text/html;profile=mcp-app', text:compactCardBrandAssets(styleContextCard(resilientCardHtml(), contextCardBrandAssets)), _meta:{ui:{prefersBorder:false,csp:{connectDomains:['https://relay.loew.fi'],resourceDomains:['https://relay.loew.fi']}},'openai/widgetDescription':'Compact staff-aware Relay context. Can reuse existing Inspector QA screenshots when requested. Open Relay for the full control center.','openai/widgetCSP':{connect_domains:['https://relay.loew.fi'],resource_domains:['https://relay.loew.fi'],redirect_domains:['https://relay.loew.fi','https://ctrl.loew.fi']},'openai/ui':{availableDisplayModes:['inline','fullscreen']}} };
+  return { uri:RELAY_CONTEXT_CARD_URI, mimeType:'text/html;profile=mcp-app', text:compactCardBrandAssets(styleContextCard(resilientCardHtml(), contextCardBrandAssets)), _meta:{ui:{prefersBorder:false,csp:{connectDomains:['https://relay.loew.fi'],resourceDomains:['https://relay.loew.fi']}},'openai/widgetDescription':'Compact staff-aware Relay context. Can reuse existing Inspector QA screenshots when requested. Open Relay for connection status and files; workspace controls are in CTRL.','openai/widgetCSP':{connect_domains:['https://relay.loew.fi'],resource_domains:['https://relay.loew.fi'],redirect_domains:['https://relay.loew.fi','https://ctrl.loew.fi']},'openai/ui':{availableDisplayModes:['inline','fullscreen']}} };
 }
 
 // Fresh cache identities: rotate whenever card HTML, JS, or CSS changes.
diff --git a/src/relay-ui.js b/src/relay-ui.js
index f083c4e..a029544 100644
--- a/src/relay-ui.js
+++ b/src/relay-ui.js
@@ -1,5 +1,5 @@
 import { mcpHtml } from "../apps/web/generated.js";
-export const RELAY_CONTROL_CENTER_URI = "ui://relay/control-center/v4.html";
+export const RELAY_CONTROL_CENTER_URI = "ui://relay/control-center/v5-ctrl-handoff.html";
 export function relayControlCenterResource() {
   return {
     uri: RELAY_CONTROL_CENTER_URI,
diff --git a/src/relay-ui.test.js b/src/relay-ui.test.js
index c098ddc..ccbec0f 100644
--- a/src/relay-ui.test.js
+++ b/src/relay-ui.test.js
@@ -1,22 +1,11 @@
-import test from "node:test";
-import assert from "node:assert/strict";
-import { RELAY_CONTROL_CENTER_URI, relayControlCenterResource } from "./relay-ui.js";
-
-test("Relay control center is an MCP Apps HTML resource", () => {
-  const resource = relayControlCenterResource();
-  assert.equal(RELAY_CONTROL_CENTER_URI, "ui://relay/control-center/v4.html");
-  assert.notEqual(RELAY_CONTROL_CENTER_URI, "ui://relay/control-center/v2.html");
-  assert.equal(resource.uri, RELAY_CONTROL_CENTER_URI);
-  assert.equal(resource.mimeType, "text/html;profile=mcp-app");
-  assert.deepEqual(resource._meta["openai/ui"].availableDisplayModes, ["inline", "fullscreen"]);
-  assert.match(resource.text, /ui\/initialize/);
-  assert.match(resource.text, /ui\/notifications\/initialized/);
-  assert.match(resource.text, /tools\/call/);
-  assert.match(resource.text, /relay_ui_request/);
-  assert.match(resource.text, /<div id="root"><\/div>/);
-  assert.match(resource.text, /relay 2\.0/);
-  assert.match(resource.text, /\/inspector#review/);
-  assert.match(resource.text, /Inter/);
-  assert.match(resource.text, /Momo Trust Display/);
-  assert.doesNotMatch(resource.text, /data-page="projects"/);
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import {RELAY_CONTROL_CENTER_URI,relayControlCenterResource} from './relay-ui.js';
+test('legacy control-center capability is an inert CTRL handoff, not a duplicate application',()=>{
+ const resource=relayControlCenterResource();
+ assert.equal(RELAY_CONTROL_CENTER_URI,'ui://relay/control-center/v5-ctrl-handoff.html');
+ assert.equal(resource.uri,RELAY_CONTROL_CENTER_URI);assert.equal(resource.mimeType,'text/html;profile=mcp-app');
+ assert.match(resource.text,/data-relay-ctrl-handoff/);assert.match(resource.text,/https:\/\/ctrl.loew.fi\/#\/now/);
+ assert.doesNotMatch(resource.text,/<script|<iframe|id="root"|operator-nav|relay_ui_request|tools\/call|data-page="review"/);
+ assert.deepEqual(resource._meta['openai/ui'].availableDisplayModes,['inline','fullscreen']);
 });
```
