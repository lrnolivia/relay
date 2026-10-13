// Historical Relay v2 card probe recovered from commit de5d8d6e8b6b1a3026e4f52feefe5121958a6ac7.
// Only divergence: metadata is isolated to relay_runner_progress so current card paths remain controls.
import { STAFF } from './staff-registry.js';
export const RELAY_V2_PROBE_URI = 'ui://relay/context-card/v2.html';
const CONTROL_URI = 'ui://relay/control-center/v2.html';
const DIRECTORY = Object.fromEntries(STAFF.map(p => [p.id, p.display_name]));
const CONTEXTUAL_TOOLS = new Set(['relay_runner_progress']);
export function relayV2ProbeDescriptor() {
  return { uri: RELAY_V2_PROBE_URI, name: 'relay-context-card', title: 'Relay contextual status card', description: 'Compact staff, progress, handoff, blocker and QA context.', mimeType: 'text/html;profile=mcp-app' };
}
export function contextualizeRelayV2ProbeTool(tool) {
  if (!tool || !CONTEXTUAL_TOOLS.has(tool.name)) return tool;
  const meta = tool._meta || {};
  return { ...tool, _meta: { ...meta,
    ui: { ...(meta.ui || {}), resourceUri: RELAY_V2_PROBE_URI, visibility: meta.ui?.visibility || ['model','app'] },
    'openai/outputTemplate': RELAY_V2_PROBE_URI, 'openai/widgetAccessible': true,
    'openai/toolInvocation/invoking': meta['openai/toolInvocation/invoking'] || 'Checking Relay…',
    'openai/toolInvocation/invoked': meta['openai/toolInvocation/invoked'] || 'Relay updated.'
  }};
}
// Pure model shared by the real iframe and deterministic consumer tests.
export function relayV2ProbeModel(data = {}, directory = DIRECTORY) {
  const states = { active:'Active', working:'Working', queued:'Up next', held:'On hold', completed:'Finished', complete:'Finished', blocked:'Blocked', failed:'Failed', 'waiting-for-human':'Needs your review', 'waiting-on-external-system':'Waiting on system', 'reserved-but-idle':'Reserved', 'possibly-stale':'May be stale' };
  const checkpoints = data.checkpoints || [];
  const first = data.claim || (typeof data.assignment === 'object' ? data.assignment : null) || data.claims?.find(x=>x.state!=='completed') || data.claims?.[0] || data.queue?.[0] || data.progress?.[0] || data.latest?.assignment || checkpoints[0]?.assignment || data.coordination?.claims?.find(x=>x.state!=='completed') || {};
  const checkpoint = data.latest || checkpoints[0] || {};
  const human = data.human || {};
  const name = id => directory[id] || 'Unassigned staff';
  const primary = human.responsible_staff?.display_name || (first.primary_staff ? name(first.primary_staff) : data.primary_staff ? name(data.primary_staff) : 'Relay');
  const supporting = human.supporting_staff?.map(x=>x.display_name) || (first.supporting_staff || data.supporting_staff || []).map(name);
  const team = primary + (supporting.length ? ' with ' + supporting.join(', ') : '');
  const status = data.ok === false || data.isError ? 'blocked' : first.state || data.state || checkpoint.state || (human.health === 'blocked' ? 'blocked' : 'recorded');
  const error = typeof data.error === 'string' ? data.error : data.error?.message;
  const checks = data.checks?.check_runs || data.check_runs;
  const pr = data.pull_request || (data.number && data.head ? data : null);
  let title = human.outcome || first.goal || data.project || data.script || 'Relay update';
  let summary = human.what_changed || error || first.waiting_reason || data.message || first.next_action || checkpoint.next_action || 'Exact Relay result recorded.';
  let label = states[status] || status;
  let tone = ['blocked','failed','officially-stale'].includes(status) ? 'bad' : status.includes('wait') || status === 'held' ? 'wait' : 'quiet';
  let rows = (data.progress || data.claims || data.queue || []).slice(0,3).map(x=>({label:x.primary_staff ? name(x.primary_staff) : 'Relay', text:states[x.state] || x.state || 'Recorded'}));
  if (checks) {
    const failed = checks.find(x=>x.status==='completed' && !['success','neutral','skipped'].includes(x.conclusion));
    const running = checks.find(x=>x.status!=='completed');
    title = 'Verification'; label = failed ? 'Failed' : running ? 'Running' : checks.length ? 'Checks complete' : 'No checks recorded'; tone=failed?'bad':running?'wait':'quiet';
    summary = failed ? failed.name+' failed.' : running ? running.name+' is running.' : checks.length ? 'Recorded checks are complete.' : 'Verification is unconfirmed.';
    rows = checks.slice(0,3).map(x=>({label:x.name,text:x.conclusion||x.status}));
  }
  if (pr) { title=pr.title||'Source change'; label=pr.merged?'Merged':pr.draft?'Draft':'In review'; summary=pr.merged?'The source change is merged.':'The source change is awaiting its next gate.'; }
  const blocker = human.blocker || error || (status==='blocked' ? first.waiting_reason || 'The next gate needs attention.' : null);
  const qa = human.qa || checkpoint.qa_context || data.qa || null;
  const handoff = data.action === 'handoff' ? 'Ownership handed to '+(data.claim?.owner || 'the recorded successor')+'.' : data.handoff?.summary || null;
  const identities = first.identities || checkpoint.identities || data.identities || {};
  const evidence = { assignment:first.id || first.assignment || (typeof data.assignment==='string'?data.assignment:null), owner:first.owner, branch:first.branch || identities.branch, head_sha:identities.head_sha || identities.pr_head_sha || pr?.head?.sha, pr:pr?.number || identities.pr, merge_commit_sha:pr?.merge_commit_sha || identities.merge_commit_sha, version_id:data.version_id, deployment_id:data.deployment?.id, evidence_id:data.evidence_id || data.evidence?.evidence_id, record_sha:data.record_sha };
  return { title, team, label, tone, summary, rows, blocker, qa, handoff, next_step:human.next_step || first.next_action || checkpoint.next_action || null, evidence:Object.fromEntries(Object.entries(evidence).filter(([,v])=>v!=null)), refresh:Boolean(data.project) };
}
export function contextualPresentation(data) {
  const m=relayV2ProbeModel(data);
  return { ...data, human: data.human || { outcome:m.title, health:m.blocker?'blocked':m.tone==='wait'?'waiting':'healthy', staff:m.team, what_changed:m.summary, next_step:m.next_step, blocker:m.blocker, qa:m.qa } };
}
function cardHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{color-scheme:light dark;--panel:#f6f5f3;--ink:#292928;--muted:#737371;--line:#d8d8d5;--row:#eaeae7;--bad:#a3423d;--wait:#91682d}@media(prefers-color-scheme:dark){:root{--panel:#252524;--ink:#f2f2ef;--muted:#b5b5b0;--line:#464644;--row:#30302e;--bad:#e9a39c;--wait:#e0bd83}}*{box-sizing:border-box}body{margin:0;padding:10px;background:transparent;color:var(--ink);font:13px/1.45 system-ui,sans-serif}.card{border:1px solid var(--line);border-radius:16px;padding:16px;background:var(--panel)}header{display:flex;justify-content:space-between;gap:12px}h1{font-size:17px;line-height:1.3;margin:4px 0;overflow-wrap:anywhere}.brand{font-weight:650;color:var(--muted)}.state{border:1px solid var(--line);border-radius:999px;padding:4px 8px;white-space:nowrap;align-self:start}.state[data-tone=bad],.blocker{color:var(--bad)}.state[data-tone=wait]{color:var(--wait)}p{margin:10px 0;color:var(--muted)}.team{font-weight:600;color:var(--ink)}.row{display:flex;justify-content:space-between;gap:12px;padding:7px 9px;background:var(--row);border-radius:8px;margin-top:5px}.row span{color:var(--muted)}details{margin-top:12px;color:var(--muted)}pre{font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}button{font:inherit;font-weight:600;min-height:36px;border:1px solid var(--line);border-radius:9px;background:var(--row);color:var(--ink);padding:6px 12px;cursor:pointer}button:focus-visible{outline:2px solid currentColor;outline-offset:2px}[hidden]{display:none!important}
</style></head><body><main class="card"><header><div><div class="brand">relay</div><h1 id="title">Relay update</h1></div><span id="state" class="state">Connecting</span></header><p class="team" id="team">Relay</p><p id="summary">Waiting for the Relay result…</p><div id="rows"></div><p class="blocker" id="blocker" hidden></p><p id="handoff" hidden></p><p id="qa" hidden></p><p id="next" hidden></p><details id="details" hidden><summary>Technical evidence</summary><pre id="evidence"></pre></details><div class="actions"><button id="refresh" hidden>Refresh</button><button id="open-relay">Open Relay</button></div></main><script>
const DIRECTORY=${JSON.stringify(DIRECTORY)};
const model=${relayV2ProbeModel.toString()};
const ids=['title','state','team','summary','rows','blocker','handoff','qa','next','details','evidence','refresh','open-relay'];
const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
let toolInput=window.openai?.toolInput||{};let lastData=null;let seq=0;const pending=new Map();
function unwrap(result){if(result?.structuredContent)return result.structuredContent;for(const item of result?.content||[]){if(item.type==='text'){try{return JSON.parse(item.text)}catch{}}}return result||{}}
function render(result){const data=unwrap(result);lastData=data;const m=model(data,DIRECTORY);el.title.textContent=m.title;el.team.textContent=m.team;el.state.textContent=m.label;el.state.dataset.tone=m.tone;el.summary.textContent=m.summary;el.rows.replaceChildren();for(const r of m.rows){const div=document.createElement('div');div.className='row';const strong=document.createElement('strong');strong.textContent=r.label;const span=document.createElement('span');span.textContent=r.text;div.append(strong,span);el.rows.append(div)}for(const key of ['blocker','handoff']){el[key].hidden=!m[key];el[key].textContent=m[key]||''}el.qa.hidden=!m.qa;el.qa.textContent=m.qa?(m.qa.intended_result||m.qa.reason||'QA evidence is available.')+(m.qa.checks?' Check: '+m.qa.checks.join('; '):''):'';el.next.hidden=!m.next_step;el.next.textContent=m.next_step?'Next: '+m.next_step:'';el.details.hidden=!Object.keys(m.evidence).length;el.evidence.textContent=JSON.stringify(m.evidence,null,2);el.refresh.hidden=!m.refresh}
function rpc(method,params){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Relay host timed out'))},15000);pending.set(id,{resolve,reject,timer});window.parent.postMessage({jsonrpc:'2.0',id,method,params},'*')})}
window.addEventListener('message',event=>{if(event.source!==window.parent||event.data?.jsonrpc!=='2.0')return;const msg=event.data;const waiter=pending.get(msg.id);if(waiter){pending.delete(msg.id);clearTimeout(waiter.timer);msg.error?waiter.reject(new Error(msg.error.message)):waiter.resolve(msg.result);return}if(msg.method==='ui/notifications/tool-input')toolInput=msg.params?.arguments||{};if(msg.method==='ui/notifications/tool-result')render(msg.params);if(msg.method==='ui/resource-teardown'&&msg.id)window.parent.postMessage({jsonrpc:'2.0',id:msg.id,result:{}},'*')});
async function callTool(name,args){if(window.openai?.callTool)return window.openai.callTool(name,args);await ready;return rpc('tools/call',{name,arguments:args})}
el.refresh.addEventListener('click',async()=>{el.refresh.disabled=true;try{const project=toolInput.project||lastData?.project;if(project)render(await callTool('relay_runner_progress',{project,...(toolInput.assignment?{assignment:toolInput.assignment}:{})}))}catch(error){el.blocker.hidden=false;el.blocker.textContent=error.message}finally{el.refresh.disabled=false}});
el['open-relay'].addEventListener('click',async()=>{try{if(window.openai?.requestModal){await window.openai.requestModal({template:${JSON.stringify(CONTROL_URI)}});return}if(window.openai?.callTool){await window.openai.callTool('relay_ui_control_center',{});return}await ready;await rpc('ui/open-link',{url:'https://relay.loew.fi/'})}catch(error){el.blocker.hidden=false;el.blocker.textContent=error.message}});
window.addEventListener('openai:set_globals',event=>{const globals=event.detail?.globals;if(globals?.toolInput)toolInput=globals.toolInput;if(globals?.toolOutput)render(globals.toolOutput)});
const ready=window.openai?Promise.resolve():rpc('ui/initialize',{appInfo:{name:'relay-context-card',version:'1.9.6.2'},appCapabilities:{},protocolVersion:'2026-01-26'}).then(()=>window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}},'*'));
ready.catch(error=>{if(!lastData){el.summary.textContent='Relay is waiting for the chat connection.';el.state.textContent='Connection pending'}});
if(window.openai?.toolOutput)render(window.openai.toolOutput);
</script></body></html>`;
}
export function relayV2ProbeResource() {
  return { uri:RELAY_V2_PROBE_URI, mimeType:'text/html;profile=mcp-app', text:cardHtml(), _meta:{ui:{prefersBorder:false},'openai/widgetDescription':'Compact staff-aware Relay context. Open Relay for the full control center.','openai/ui':{availableDisplayModes:['inline']}} };
}
