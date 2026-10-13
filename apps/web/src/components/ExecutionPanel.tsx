import { useEffect, useState } from 'react';
import { useLiveRelay } from '../live';
import { projectLabel } from '../api';
type Job={id:string;revision:number;state:string;observed_state:string;executor_id?:string;executor_capabilities?:string[];started_at?:string;finished_at?:string;process?:{host:string;pid:number;version:string};result?:{summary:string};checkpoint?:{summary:string};};
type Row={assignment:string;owner:string;branch:string;goal:string;state:string;lease_until:string;job:Job|null};
export function ExecutionPanel(){
 const {allSnapshot,project}=useLiveRelay();
 const [selected,setSelected]=useState(project||'relay'),[rows,setRows]=useState<Row[]>([]),[cursor,setCursor]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState(''),[assignment,setAssignment]=useState(''),[prompt,setPrompt]=useState(''),[platform,setPlatform]=useState('macos');
 async function request(path:string,body?:unknown){const response=await fetch(path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});const value=await response.json();if(!response.ok||value.ok===false)throw Error(value.error?.message||value.error||'Execution request failed');return value;}
 async function load(append=false){setBusy(true);setError('');try{const value=await request('/api/execution/jobs?project='+encodeURIComponent(selected)+(append&&cursor!==null?'&cursor='+cursor:''));setRows(old=>append?[...old,...value.rows]:value.rows);setCursor(value.next_cursor);}catch(cause){setError(cause instanceof Error?cause.message:'Execution status unavailable');}finally{setBusy(false);}}
 useEffect(()=>{setRows([]);setAssignment('');setNote('');void load();},[selected]);
 const eligible=rows.filter(row=>row.state==='active'&&Date.parse(row.lease_until)>Date.now()&&(!row.job||['succeeded','failed','cancelled'].includes(row.job.state)));
 async function write(args:Record<string,unknown>,key:string){
  // Preserve exact operation intent before sending. An uncertain request is retried verbatim.
  let intent;const previous=sessionStorage.getItem(key);
  if(previous)intent=JSON.parse(previous);else{intent={...args,operation_id:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(intent));}
  const value=await request('/api/execution/request',intent);sessionStorage.removeItem(key);return value;
 }
 async function submit(){const row=eligible.find(row=>row.assignment===assignment);if(!row||!prompt.trim())return;setBusy(true);setError('');
  try{const source=await request('/api/progress/'+encodeURIComponent(selected)+'?assignment='+encodeURIComponent(row.assignment));const head=source.progress?.find((item:{assignment:string})=>item.assignment===row.assignment)?.identities?.head_sha;if(!head)throw Error('Current source head is unavailable; restore source evidence before requesting execution.');
   await write({action:'submit',project:selected,assignment:row.assignment,expected_owner:row.owner,expected_branch:row.branch,expected_head_sha:head,prompt,required_capabilities:['codex-cli',platform]},'relay.execution.submit:'+selected+':'+row.assignment);
   setNote('Shift request saved. A compatible executor must lease it before coding starts.');setPrompt('');await load();
  }catch(cause){setError(cause instanceof Error?cause.message:'Request not confirmed');}finally{setBusy(false);}
 }
 async function cancel(row:Row){if(!row.job)return;setBusy(true);setError('');try{await write({action:'cancel',project:selected,assignment:row.assignment,job_id:row.job.id,expected_owner:row.owner,expected_branch:row.branch,expected_revision:row.job.revision},'relay.execution.cancel:'+row.job.id);setNote('Cancellation saved. A running process must report its exit before cancellation is complete.');await load();}catch(cause){setError(cause instanceof Error?cause.message:'Cancellation not confirmed');}finally{setBusy(false);}}
 return <section className="operator-section execution-panel" aria-label="Coding execution">
  <div className="section-heading"><h2>coding while you’re away</h2><button type="button" disabled={busy} onClick={()=>void load()}>Refresh execution</button></div>
  <p>Shift preserves an admitted assignment and requests a durable coding job. Execution is shown only when a process receipt arrives. Automatic checks below remain separate.</p>
  <label>Project <select value={selected} disabled={busy} onChange={event=>setSelected(event.target.value)}>{(allSnapshot?.projects||[{id:'relay'}]).filter(item=>item.managed!==false).map(item=><option key={item.id} value={item.id}>{projectLabel(item)}</option>)}</select></label>
  {error&&<p role="alert">{error} The saved request is retained for an exact retry.</p>}{note&&<p role="status">{note}</p>}
  <div className="execution-list">{rows.filter(row=>row.job).map(row=><article className="execution-receipt" key={row.assignment}><h3>{row.goal}</h3><strong>{row.job!.observed_state.replaceAll('_',' ')}</strong><p>{row.job!.result?.summary||row.job!.checkpoint?.summary||'Request saved; no coding result reported.'}</p>{row.job!.process&&<p>Executor {row.job!.executor_id} · {row.job!.process.host} · process {row.job!.process.pid} · {row.job!.process.version}</p>}<p>{row.job!.finished_at?'Process ended '+new Date(row.job!.finished_at).toLocaleString():row.job!.started_at?'Process started '+new Date(row.job!.started_at).toLocaleString():'No process start receipt.'} Assignment completion requires separate review.</p>{!['succeeded','failed','cancelled','cancel_requested'].includes(row.job!.state)&&<button type="button" disabled={busy} onClick={()=>void cancel(row)}>Cancel execution</button>}</article>)}</div>
  {!rows.some(row=>row.job)&&<p>No coding execution is recorded in this loaded page.</p>}
  {cursor!==null&&<button type="button" disabled={busy} onClick={()=>void load(true)}>Load more assignments</button>}
  <form onSubmit={event=>{event.preventDefault();void submit();}}><h3>Shift an assignment</h3><label>Admitted work <select required value={assignment} onChange={event=>setAssignment(event.target.value)} disabled={busy}><option value="">Choose an active assignment</option>{eligible.map(row=><option key={row.assignment} value={row.assignment}>{row.goal}</option>)}</select></label><label>Executor capability <select value={platform} onChange={event=>setPlatform(event.target.value)} disabled={busy}><option value="macos">macOS</option><option value="linux">Linux</option></select></label><label>Next bounded action <textarea required maxLength={12000} value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder="Describe the next action within the existing objective and scope." disabled={busy}/></label><button type="submit" disabled={busy||!assignment||!prompt.trim()}>Shift</button></form>
  <p>Executor availability is not established by this page. No oversight worker is assigned automatically.</p>
 </section>;
}
