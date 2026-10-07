import {fileManagerIcon} from '../../../../packages/shared-ui/file-manager.js';
import { LiveTelemetry } from '../components/LiveTelemetry';
import { useState, useEffect, useRef } from 'react';
import { useLiveRelay } from '../live';
import { projectLabel } from '../api';
import { StatusLight } from '../components/Telemetry';
import { RELAY_PLUGIN_SETTINGS } from '../../public/relay-connection.js';

type Check = { ok: boolean; checked_at: string; elapsed_ms: number; server?: { version: string }; tools?: { count: number; schema_sha256: string }; error?: string; refresh?: { message: string } };
const endpoint = 'https://relay.loew.fi/mcp';
export function RelayPage() {
  const preview=Boolean((window as Window & {__retainedFixture?:{data_mode?:string}}).__retainedFixture?.data_mode==='synthetic');
  const { allSnapshot: snapshot, refresh } = useLiveRelay();
  const [check,setCheck]=useState<Check|null>(null),[busy,setBusy]=useState('check'),[message,setMessage]=useState(''),[showConnect,setShowConnect]=useState(false),[showRefresh,setShowRefresh]=useState(false);
  const items=Object.entries(snapshot?.progress||{}).flatMap(([project,payload])=>(payload.progress||[]).map(item=>({...item,project})));
  const ready=Boolean(snapshot)&&!snapshot?.loadingProgress?.length&&!snapshot?.failedProgress?.length;
  const reviews=items.filter(item=>item.state==='waiting-for-human'&&/review|qa|preview/i.test(item.waiting_reason||item.next_action||''));
  const decisions=items.filter(item=>item.state==='waiting-for-human'&&!reviews.includes(item));
  const moving=items.filter(item=>item.state==='working');
  const recent=[...items].sort((a,b)=>Date.parse(b.last_meaningful_progress_at||'0')-Date.parse(a.last_meaningful_progress_at||'0'));
  const focus=reviews[0]||decisions[0]||moving[0]||recent[0];
  const checkInFlight=useRef(false);
  useEffect(()=>{void checkConnection('check',false);},[]);
  async function checkConnection(action='check',refreshWorkspace=true) {
    if(preview){setBusy('');setMessage('This preview uses sample data. Connection checks and tool refreshes are unavailable here.');return;}
    if(checkInFlight.current)return;checkInFlight.current=true;setBusy(action);setMessage('');if(action==='refresh')setShowRefresh(true);
    const start=performance.now();
    try{const response=await fetch('/api/relay/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Connection check failed');setCheck(data);if(action==='refresh')setMessage(data.refresh.message);else if(refreshWorkspace)void refresh();}
    catch(error){setCheck({ok:false,checked_at:new Date().toISOString(),elapsed_ms:Math.round(performance.now()-start),error:error instanceof Error?error.message:'Connection unavailable'});}
    finally{checkInFlight.current=false;setBusy('');}
  }
  async function copy(value:string){try{await navigator.clipboard.writeText(value);setMessage('Copied. Complete the connection in your AI client.');}catch{setMessage('Copy the displayed address manually; clipboard access is unavailable.');}}
  return <main className="relay-home" data-feature="relay">
    <div className="relay-home-top"><span>loew.fi / relay</span><a href="https://ctrl.loew.fi">open ctrl <span aria-hidden="true">↗</span></a></div>
    <section className="relay-main-panel" aria-labelledby="relay-title">
      <header className="relay-identity">
        <div className="relay-wordmark"><img src="/brand/relay.png" alt="" width="144" height="144"/><div><h1 id="relay-title">relay</h1><p>your tools, connected.</p></div></div>
        <StatusLight tone={preview?'quiet':busy?'wait':check?.ok?'good':check?'bad':'quiet'} label={preview?'sample preview':busy?'checking connection':check?.ok?'MCP connected':check?'connection unavailable':'connection not checked'}/>
      </header>
      <div className="relay-connection-panel" aria-busy={Boolean(busy)}>
        <div className="relay-connection-copy"><span className="relay-eyebrow">connection</span><strong>{preview?'Preview only':busy?'Checking the connection…':check?.ok?'Relay is responding.':check?'Let’s reconnect.':'Ready when you are.'}</strong><p role="status">{preview?'Sample data is shown below. This preview cannot check or change your real connection.':check ? `${check.ok?'Authenticated MCP handshake':check.error} · ${check.elapsed_ms} ms · ${new Date(check.checked_at).toLocaleTimeString()}` : 'Check the live MCP service, then use your connected tools in your AI client.'}</p></div>
        <div className="relay-connection-actions">
          <div className="relay-service-actions" role="group" aria-label="Connection actions">
            <button type="button" className="relay-primary-action" disabled={Boolean(busy)} onClick={()=>void checkConnection()}><span className={busy?'relay-check-pulse':''} aria-hidden="true">●</span> Check connection</button>
            <button type="button" className="relay-refresh-action" disabled={Boolean(busy)} onClick={()=>void checkConnection('refresh')} aria-label="refresh tools"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M19 11a7 7 0 0 0-12-5L4 9m16 6-3 3A7 7 0 0 1 5 13"/></svg>Refresh tools</button>
          </div>
          <div className="relay-utility-actions" role="group" aria-label="Setup and files">
            <button type="button" className="relay-connect-action" onClick={()=>setShowConnect(value=>!value)} aria-expanded={showConnect}>connect your AI <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
            <button type="button" data-file-manager aria-label="Open files" title={preview?'Files are unavailable in this sample preview':'Files'} disabled={preview}><span aria-hidden="true" dangerouslySetInnerHTML={{__html:fileManagerIcon}}/>Files</button>
          </div>
        </div>
      </div>
      {showRefresh&&<section className="relay-inline-panel" aria-label="Refresh tools result"><h2>Refresh tools</h2><p>{message||'Checking the current server tool list and refresh capabilities…'}</p>{check?.tools&&<p>{check.tools.count} server tools discovered. Your AI client’s loaded schema is not verified by this check.</p>}<a href={RELAY_PLUGIN_SETTINGS} target="_blank" rel="noreferrer">Open existing Relay plugin settings ↗</a><button type="button" onClick={()=>setShowRefresh(false)}>Close</button></section>}
      {showConnect&&<section className="relay-inline-panel" aria-label="Add Relay to AI"><h2>Connect your AI</h2><p>Use the existing Relay plugin in ChatGPT, or add this MCP address in a client that supports authenticated remote MCP servers.</p><code>{endpoint}</code><div><button type="button" onClick={()=>void copy(endpoint)}>Copy MCP address</button><a href={RELAY_PLUGIN_SETTINGS} target="_blank" rel="noreferrer">Open ChatGPT connection ↗</a></div><p>Authentication is completed by your client. Copying an address does not install or connect Relay.</p><button type="button" onClick={()=>setShowConnect(false)}>Close</button></section>}
      {!showRefresh&&message&&<p role="status">{message}</p>}
      <LiveTelemetry focus={focus?{project:focus.project,assignment:focus.assignment}:undefined}/>

      <footer className="relay-panel-footer"><span>{check?.tools?`${check.tools.count} available server tools`:'source · cloud · verification · skills · execution'}</span><details><summary>Connection details</summary><code>{endpoint}</code><p>{check?.server?.version?`Server ${check.server.version}`:'Server version not checked'}</p>{check?.tools&&<code>schema sha256: {check.tools.schema_sha256}</code>}<p>Connection, client rendering, execution, and deployment are verified separately.</p></details></footer>
    </section>
  </main>;
}
function ProjectMark({project}:{project:string}){
  const [url,setUrl]=useState<string|null>(null);
  // Project logos are loaded by the existing authenticated discovery endpoint.
  useEffect(()=>{let active=true;void fetch('/api/projects/'+encodeURIComponent(project)+'/icon').then(r=>r.ok?r.json():null).then(data=>{if(active)setUrl(data?.icon?.data_url||null);}).catch(()=>{});return()=>{active=false;};},[project]);
  return url?<img src={url} alt="" width="24" height="24"/>:<span aria-hidden="true" className="relay-project-placeholder">{project.slice(0,1)}</span>;
}
