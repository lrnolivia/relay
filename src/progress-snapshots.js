import {sha256} from '@noble/hashes/sha2.js';
import {assignmentCardContext} from './relay-card-steps.js';
import {safePresentationText} from './human-presentation.js';

const iso=value=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const terminal=new Set(['completed','complete','finished','cancelled','superseded','retired']);
const digest=body=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(body))),b=>b.toString(16).padStart(2,'0')).join('');
export function validProgressSnapshot(snapshot){
  // Unkeyed content integrity, never independent server attestation or authority.
  try{
    const p=snapshot?.payload;
    if(snapshot?.schema!=='relay-progress-snapshot/v1'||iso(snapshot.as_of)!==snapshot.as_of||p?.checked_at!==snapshot.as_of||JSON.stringify(p).length>1024*1024)return false;
    if(Object.keys(p).some(k=>!['ok','state','project','record_sha','checked_at','claim','claims','project_icon','presentation_view','presentation_update_id','work_card','ci','error'].includes(k)))return false;
    for(const [key,project] of [['work_card',publicWorkCard],['ci',publicCi],['project_icon',publicIcon]])if(p[key]&&JSON.stringify(p[key])!==JSON.stringify(project(p[key])))return false;
    return snapshot.id==='snapshot_'+digest(p)&&JSON.stringify(snapshot.due)===JSON.stringify(progressDueHint(p.claim||{},Date.parse(snapshot.as_of)));
  }catch{return false;}
}
const clean=value=>JSON.parse(JSON.stringify(value));
function fields(value,keys){const out={};for(const key of keys)if(['string','number','boolean'].includes(typeof value?.[key]))out[key]=typeof value[key]==='string'?safePresentationText(value[key],12000):value[key];return out;}
function publicWorkCard(value){return clean({...fields(value,['schema','tool','live','assignment','project']),...(value?.milestone?{milestone:fields(value.milestone,['kind','label','at'])}:{})});}
function publicIcon(value){const out=fields(value,['project','name','status']);if(value?.icon){out.icon=fields(value.icon,['path','repository','blob_sha','sha256','bytes','manifest','source_url']);const url=value.icon.data_url;if(typeof url==='string'&&url.length<=350000&&/^data:image\/(?:png|svg\+xml|x-icon|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(url))out.icon.data_url=url;}return out;}
function publicCi(value){
  const out=fields(value,['schema','status','conclusion','head_sha','observed_at','telemetry_updated_at','telemetry','live','stale','suites_total','suites_done','elapsed_ms']);
  for(const key of ['tests','jobs'])if(value?.[key])out[key]=fields(value[key],['passed','failed','skipped','reported','total','totals_known','completed','running','queued']);
  if(value?.run)out.run=fields(value.run,['id','url','attempt']);
  for(const [key,keys]of [['suites',['id','key','label','status','started_at','completed_at','elapsed_ms']],['failures',['suite','name','message']]])if(Array.isArray(value?.[key]))out[key]=value[key].slice(0,32).map(v=>fields(v,keys));
  if(Array.isArray(value?.failed_jobs))out.failed_jobs=value.failed_jobs.slice(0,20).map(v=>({...fields(v,['name','url']),annotations:(Array.isArray(v.annotations)?v.annotations:[]).slice(0,20).map(a=>fields(a,['message']))}));
  return out;
}
export function progressDueHint(record={},now=Date.now()) {
  // A read is not a delivery. Anchor to recorded work, never the query clock.
  const steps=Array.isArray(record.card_steps?.steps)?record.card_steps.steps:[];
  const anchor=iso(steps.map(s=>s.receipt?.observed_at).filter(iso).sort().at(-1))||iso(record.last_meaningful_progress_at)||iso(record.created_at);
  const active=!terminal.has(record.state)&&record.state!=='held';
  const due=active&&anchor?Date.parse(anchor)+300000:null,overdue=due===null?null:due+120000;
  return {anchor_at:anchor,due_at:due===null?null:new Date(due).toISOString(),overdue_at:overdue===null?null:new Date(overdue).toISOString(),state:!active?'stopped':due===null?'unknown':now>=overdue?'overdue':now>=due?'due':'scheduled',delivery:'unknown',automatic_delivery:'unverified'};
}

function publicRecord(record){
  const out=assignmentCardContext(record),identities={};
  for(const key of ['head_sha','pr_head_sha','merge_commit_sha'])if(/^[a-f0-9]{40}$/.test(record.identities?.[key]||''))identities[key]=record.identities[key];
  if(Object.keys(identities).length)out.identities=identities;
  const sources=[...new Set([...Object.values(identities),...(out.card_steps?.steps||[]).map(s=>s.receipt?.source_sha)].filter(s=>/^[a-f0-9]{40}$/.test(s||'')))];
  out.source_as_of={status:sources.length?'recorded':'unavailable',source_shas:sources,...(/^[a-f0-9]{40}$/.test(record.base_sha||'')?{base_sha:record.base_sha}:{}),note:'Recorded source references; snapshot integrity is not independent source verification.'};
  return out;
}
export function progressSnapshot(data={},now=new Date()) {
  const candidates=[data.claim,typeof data.assignment==='object'?data.assignment:null,...(Array.isArray(data.progress)?data.progress:[]),...(Array.isArray(data.claims)?data.claims:[]),...(Array.isArray(data.queue)?data.queue:[])].filter(x=>x&&typeof x==='object');
  const unique=new Map();candidates.forEach((x,i)=>{const id=x.id||x.assignment||'partial-'+i;if(!unique.has(id))unique.set(id,x)});const rows=[...unique.values()];
  const as_of=iso(data.generated_at)||iso(data.checked_at)||now.toISOString();
  const payload={ok:data.ok,...(typeof data.state==='string'?{state:safePresentationText(data.state,100)}:{}),project:data.project,record_sha:data.record_sha,checked_at:as_of,claim:rows.length===1?publicRecord(rows[0]):undefined,claims:rows.length===1?undefined:rows.slice(0,3).map(publicRecord),project_icon:data.project_icon?publicIcon(data.project_icon):undefined,presentation_view:data.presentation_view,presentation_update_id:data.presentation_update_id,work_card:data.work_card?publicWorkCard(data.work_card):undefined,ci:data.ci?publicCi(data.ci):undefined,...(data.error?{error:{message:safePresentationText(data.error.message||'Relay could not read this update.',12000)}}:{})};
  // Only the card's allowlisted public projection is retained in widget state.
  const body=JSON.parse(JSON.stringify(payload));
  return {schema:'relay-progress-snapshot/v1',id:'snapshot_'+digest(body),as_of,payload:body,due:progressDueHint(body.claim||{},Date.parse(as_of))};
}
