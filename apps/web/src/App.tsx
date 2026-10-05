import {bindFileManager} from '../../../packages/shared-ui/file-manager.js';
import '../../../packages/shared-ui/file-manager.css';
import { RelayPage } from './pages/RelayPage';
import { bindMotion } from "../../../packages/shared-ui/motion.js";
import { useEffect } from "react";
import { presentationMenu, bindPresentation } from "../../../packages/shared-ui/presentation.js";
import { bindTheme } from "../public/theme.js";
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { projectHref } from "../../../packages/shared-ui/project-context.js";
import { LiveRelayProvider, useLiveRelay } from "./live";
import { TodayPage } from "./pages/TodayPage";
import { RunnerPage } from "./pages/RunnerPage";
import { RunnerWorkPage } from "./pages/RunnerWorkPage";
import { NightShiftPage } from "./pages/NightShiftPage";
import { NotificationCenter } from './components/NotificationCenter';

const navItems = [
  { to: "/today", label: "today", detail: "focus", feature: "today", icon: "/brand/today.png" },
  { to: "/runner", label: "runner", detail: "coordinate", feature: "runner", icon: "/brand/runner.png" },
  { to: "/night-shift", label: "night shift", detail: "monitor", feature: "night-shift", icon: "/brand/night-shift.png" }
];

function Shell() {
  useEffect(()=>bindFileManager(),[]);
  useEffect(() => { const presentation = bindPresentation(); const theme = bindTheme(); const motion = bindMotion(); return () => { presentation(); theme?.(); motion(); }; }, []);
  const { state, project } = useLiveRelay();
  const location = useLocation();
  useEffect(()=>{if(window.location.hostname==='relay.loew.fi'&&['/','/index.html'].includes(window.location.pathname)&&location.pathname!=='/')window.location.replace('https://ctrl.loew.fi/#'+(location.pathname==='/today'?'/now':location.pathname)+location.search);},[location.pathname,location.search]);
  const pageLabel = location.pathname.startsWith("/runner") ? "runner" : location.pathname.startsWith("/night-shift") ? "night shift" : "today";
  const tone = state === "live" ? "good" : state === "offline" ? "bad" : "quiet";

  if(location.pathname === "/")return <RelayPage />;

  return (
    <>
      <div className="terra-accent" aria-hidden="true"><span/><span/><span/><span/><span/></div>
      <header className="operator-topbar react-operator-topbar">
        <a className="operator-brand react-brand" href={projectHref("#/today", project)}>
          <img src="/brand/relay.png" alt="" width="52" height="52" />
          <strong>relay</strong>
          <span>project control</span>
        </a>
        <div className="nav-label">work</div>
        <nav className="operator-nav react-operator-nav" aria-label="Relay">
          {navItems.slice(0, 2).map(item => (
            <NavLink key={item.to} to={projectHref(item.to, project)} data-feature={item.feature} className={({ isActive }) => isActive ? "active" : ""}>
              <span className="glyph-chip"><img className="tool-mark" src={item.icon} alt="" /></span>
              <span className="nav-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
              <span className="nav-chevron" aria-hidden="true">›</span>
            </NavLink>
          ))}
          <a href={projectHref("/inspector#review", project)} data-feature="inspector">
            <span className="glyph-chip"><img className="tool-mark" src="/brand/inspector.png" alt="" /></span>
            <span className="nav-copy"><strong>inspector</strong><small>review</small></span>
            <span className="nav-chevron" aria-hidden="true">›</span>
          </a>
          {navItems.slice(2).map(item => (
            <NavLink key={item.to} to={projectHref(item.to, project)} data-feature={item.feature} className={({ isActive }) => isActive ? "active" : ""}>
              <span className="glyph-chip"><img className="tool-mark" src={item.icon} alt="" /></span>
              <span className="nav-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
              <span className="nav-chevron" aria-hidden="true">›</span>
            </NavLink>
          ))}
        </nav>
        <div className="operator-utility" dangerouslySetInnerHTML={{ __html: presentationMenu() }} />
      </header>

      <main className="operator-shell react-operator-shell">
        <div className="workspace-context">
          <div className="workspace-left"><span>your workspace <span aria-hidden="true">/</span> {pageLabel}</span></div>
          <div className="connection-tools"><NotificationCenter /><div className="operator-connection" data-tone={tone}>{state}</div></div>
        </div>
        <Routes>
          <Route path="/today" element={<TodayPage />} />
          <Route path="/runner" element={<RunnerPage />} />
          <Route path="/runner/:project/:assignment" element={<RunnerWorkPage />} />
          <Route path="/night-shift" element={<NightShiftPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return <HashRouter><LiveRelayProvider><Shell /></LiveRelayProvider></HashRouter>;
}
