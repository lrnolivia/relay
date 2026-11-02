import {sha256} from '@noble/hashes/sha2.js';
import {assignmentCardContext} from './relay-card-steps.js';
import {safePresentationText} from './human-presentation.js';

const iso=value=>Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const terminal=new Set(['completed','complete','finished','cancelled','superseded','retired']);
const digest=body=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(body))),b=>b.toString(16).padStart(2,'0')).join('');
export function validProgressSnapshot(snapshot){
  return snapshot?.schema==='relay-progress-snapshot/v1'&&iso(snapshot.as_of)===snapshot.as_of&&snapshot.payload?.checked_at===snapshot.as_of&&JSON.stringify(snapshot.payload).length<=1024*1024&&snapshot.id==='snapshot_'+digest(snapshot.payload);
}
export function progressDueHint(record={},now=Date.now()) {
  // A read is not a delivery. Anchor to recorded work, never the query clock.
  const anchor=iso(record.card_steps?.steps?.map(s=>s.receipt?.observed_at).filter(iso).sort().at(-1))||iso(record.last_meaningful_progress_at)||iso(record.created_at);
  const active=!terminal.has(record.state)&&record.state!=='held';
  const due=active&&anchor?Date.parse(anchor)+300000:null,overdue=due===null?null:due+120000;
  return {anchor_at:anchor,due_at:due===null?null:new Date(due).toISOString(),overdue_at:overdue===null?null:new Date(overdue).toISOString(),state:!active?'stopped':due===null?'unknown':now>=overdue?'overdue':now>=due?'due':'scheduled',delivery:'unknown',automatic_delivery:'unverified'};
}

function publicRecord(record){
  const out=assignmentCardContext(record),identities={};
  for(const key of ['head_sha','pr_head_sha','merge_commit_sha'])if(/^[a-f0-9]{40}$/.test(record.identities?.[key]||''))identities[key]=record.identities[key];
  if(Object.keys(identities).length)out.identities=identities;
  return out;
}
export function progressSnapshot(data={},now=new Date()) {
  const candidates=[data.claim,typeof data.assignment==='object'?data.assignment:null,...(Array.isArray(data.progress)?data.progress:[]),...(Array.isArray(data.claims)?data.claims:[]),...(Array.isArray(data.queue)?data.queue:[])].filter(x=>x&&typeof x==='object');
  const rows=[...new Map(candidates.map((x,i)=>[x.id||x.assignment||'partial-'+i,x])).values()];
  const as_of=iso(data.generated_at)||iso(data.checked_at)||now.toISOString();
  const payload={ok:data.ok,project:data.project,record_sha:data.record_sha,checked_at:as_of,claim:rows.length===1?publicRecord(rows[0]):undefined,claims:rows.length===1?undefined:rows.slice(0,3).map(publicRecord),project_icon:data.project_icon,presentation_view:data.presentation_view,presentation_update_id:data.presentation_update_id,work_card:data.work_card,ci:data.ci,...(/^vis_[a-zA-Z0-9-]{8,128}$/.test(data.evidence_id||'')?{evidence_id:data.evidence_id}:{}),...(data.error?{error:{message:safePresentationText(data.error.message||'Relay could not read this update.',12000)}}:{})};
  // Only the card's allowlisted public projection is retained in widget state.
  const body=JSON.parse(JSON.stringify(payload));
  return {schema:'relay-progress-snapshot/v1',id:'snapshot_'+digest(body),as_of,payload:body,due:progressDueHint(rows[0],Date.parse(as_of))};
}
