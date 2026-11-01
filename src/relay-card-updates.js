import {sha256} from '@noble/hashes/sha2.js';
// Public, bounded receipt history. This is an observation projection, not an
// execution or authorization mechanism; routing alone never creates an update.
export const CARD_UPDATES_SCHEMA='relay-card-updates/v1';
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^sha256:[a-f0-9]{64}$/;
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===keys.sort().join(',');
const copy=(x,n)=>typeof x==='string'&&x.trim()&&x.length<=n&&!/[\x00-\x1f<>]/.test(x);
export const publicCardUpdateSchema={type:'object',additionalProperties:false,required:['text','artifacts'],properties:{text:{type:'string',minLength:1,maxLength:800},artifacts:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['evidence_id','source_sha','caption','kind'],properties:{evidence_id:{type:'string',pattern:'^vis_[a-zA-Z0-9-]{8,128}$'},source_sha:{type:'string',pattern:SHA.source},caption:{type:'string',minLength:1,maxLength:120},kind:{enum:['design','rendered-feature','verification']}}}}}};
publicCardUpdateSchema.properties.preview={type:'object',additionalProperties:false,required:['state'],properties:{state:{enum:['pending','attached','unavailable']},reason:{type:'string',minLength:1,maxLength:240}}};
export function validPublicCardUpdate(update,receipt){
 if(!exact(update,['text','artifacts',...(object(update)&&Object.hasOwn(update,'preview')?['preview']:[])])||!copy(update.text,800)||!Array.isArray(update.artifacts)||update.artifacts.length>3||new Set(update.artifacts.map(a=>a?.evidence_id)).size!==update.artifacts.length||!update.artifacts.every(a=>exact(a,['evidence_id','source_sha','caption','kind'])&&/^vis_[a-zA-Z0-9-]{8,128}$/.test(a.evidence_id)&&a.source_sha===receipt.source_sha&&SHA.test(a.source_sha)&&copy(a.caption,120)&&['design','rendered-feature','verification'].includes(a.kind)))return false;
 if(!Object.hasOwn(update,'preview'))return true; // Historical publications remain valid.
 const p=update.preview,design=update.artifacts.some(a=>a.kind==='design');
 return p?.state==='unavailable'?exact(p,['state','reason'])&&copy(p.reason,240)&&!design
  :exact(p,['state'])&&(p.state==='attached'?design:p.state==='pending'&&!design);
}
export const designSubmissionSchema={type:'object',additionalProperties:false,required:['schema','kind'],properties:{schema:{const:1},kind:{const:'design'}}};
export const isDesignSubmission=value=>exact(value,['schema','kind'])&&value.schema===1&&value.kind==='design';
export function requireDesignSubmission(update,receipt){
 if(!validPublicCardUpdate(update,receipt)||!['attached','unavailable'].includes(update.preview?.state)||update.preview.state==='unavailable'&&(update.preview.reason.trim().length<12||/^(?:not available|unavailable|no preview|none|n\/?a)[.! ]*$/i.test(update.preview.reason.trim())))throw Error('Design submission requires a bound preview or a meaningful unavailable reason');
 return update;
}
const STATE_COPY={running:'Work started.',passed:'This step is verified.',failed:'This step needs attention.',blocked:'This step is blocked.',cancelled:'This step was cancelled.',skipped:'This step was skipped.',stale:'Waiting for a work update.'};
const fingerprint=(step,receipt)=>[receipt.id,receipt.input_digest,step.state,receipt.phase||''].join(':');
// A fresh coordinator may observe the same verified proof again. Its fetch/
// observation clock is not a new authored event; retain the first event time.
const stable=value=>Array.isArray(value)?value.map(stable):object(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export const receiptSnapshot=(step,{observed_at,...receipt})=>JSON.stringify(stable({label:step.label,state:step.state,receipt}));
const snapshot=receiptSnapshot;
const bodyDigest=body=>Array.from(sha256(new TextEncoder().encode(body)),b=>b.toString(16).padStart(2,'0')).join('');
export function appendCardUpdates(record,publication,now=new Date()){
 const previous=record.card_updates;
 const same=previous?.schema===CARD_UPDATES_SCHEMA&&previous.assignment===record.id&&previous.revision===publication.revision;
 const items=same&&Array.isArray(previous.items)?[...previous.items]:[];
 const identities=Object.assign(Object.create(null),same?previous.identities||{}:{});
 if(Object.keys(identities).length>256||Object.entries(identities).some(([id,d])=>!ID.test(id)||!/^[a-f0-9]{64}$/.test(d)))throw Error('Invalid receipt identity index');
 for(const item of items)if(!Object.hasOwn(identities,item.id))identities[item.id]=bodyDigest(item.receipt_snapshot);
 for(const step of publication.steps){
  const receipt=step.receipt;
  if(!receipt||!STATE_COPY[step.state])continue;
  const key=fingerprint(step,receipt),body=snapshot(step,receipt),digest=bodyDigest(body);
  if(Object.hasOwn(identities,receipt.id)){if(identities[receipt.id]!==digest)throw Error('Recorded receipt identity is immutable; publish a new receipt');continue;}
  if(Object.keys(identities).length>=256)throw Error('Receipt identity capacity reached; preserve this objective and use an authorized continuation');
  identities[receipt.id]=digest;
  const retained=items.find(x=>x.id===receipt.id);
  if(retained){if(retained.receipt_snapshot!==body)throw Error('Recorded receipt identity is immutable; publish a new receipt');continue;}
  // Existing verified receipts are not re-authored merely because a publisher
  // sends the complete plan again. A changed actual receipt is a new event.
  const old=record.card_steps?.steps?.find(x=>x.id===step.id);
  if(old?.receipt?.id===receipt.id){if(snapshot(old,old.receipt)!==body)throw Error('Recorded receipt identity is immutable; publish a new receipt');continue;}
  const supplied=receipt.update&&validPublicCardUpdate(receipt.update,receipt)?receipt.update:null;
  items.push({key,receipt_snapshot:body,id:receipt.id,assignment:record.id,step_id:step.id,revision:publication.revision,
   label:step.label,state:step.state,phase:receipt.phase||null,source_sha:receipt.source_sha,
   observed_at:receipt.observed_at,recorded_at:now.toISOString(),receipt_digest:receipt.evidence,
   owner:receipt.owner?{...receipt.owner}:null,text:supplied?.text||(receipt.phase==='awaiting-verification'?'The work is ready for verification.':STATE_COPY[step.state]),
   text_kind:supplied?'owner-published':'recorded-state',artifacts:supplied?.artifacts||[],...(supplied?.preview?{preview:structuredClone(supplied.preview)}:{})});
 }
 let truncated=previous?.truncated===true;
 while(items.length>24||JSON.stringify(items).length>65536){items.shift();truncated=true;}
 return {schema:CARD_UPDATES_SCHEMA,assignment:record.id,revision:publication.revision,sequence:publication.sequence,truncated,identities:{...identities},items};
}
export function assignmentCardUpdates(record={}){
 const h=record.card_updates,assignment=record.id||record.assignment;
 if(!object(h)||h.schema!==CARD_UPDATES_SCHEMA||h.assignment!==assignment||!ID.test(assignment||'')||!Array.isArray(h.items)||h.items.length>24||JSON.stringify(h.items).length>65536||h.revision!==record.card_steps?.revision)return [];
 const seen=new Set();
 return h.items.filter(x=>{
  if(!object(x)||typeof x.key!=='string'||x.key.length>350||x.assignment!==assignment||x.revision!==h.revision||!ID.test(x.id||'')||!ID.test(x.step_id||'')||!copy(x.label,160)||!STATE_COPY[x.state]||!SHA.test(x.source_sha||'')||!DIGEST.test(x.receipt_digest||'')||!Number.isFinite(Date.parse(x.observed_at))||!Number.isFinite(Date.parse(x.recorded_at))||(x.phase!==null&&(x.phase!=='awaiting-verification'||x.state!=='blocked'))||!copy(x.text,800)||!['owner-published','recorded-state'].includes(x.text_kind)||seen.has(x.id))return false;
  if(x.owner!==null&&(!exact(x.owner,['staff','team'])||!ID.test(x.owner.team||'')||(x.owner.staff!==null&&!ID.test(x.owner.staff||''))))return false;
  if(!validPublicCardUpdate({text:x.text,artifacts:x.artifacts,...(Object.hasOwn(x,'preview')?{preview:x.preview}:{})},x))return false;
  if(x.receipt_snapshot!==undefined){try{const original=JSON.parse(x.receipt_snapshot),r=original.receipt;const supplied=r.update;
   if(JSON.stringify(stable(supplied?.preview??null))!==JSON.stringify(stable(x.preview??null))||original.label!==x.label||original.state!==x.state||r.id!==x.id||r.assignment!==assignment||r.step_id!==x.step_id||r.plan_revision!==x.revision||r.source_sha!==x.source_sha||r.evidence!==x.receipt_digest||JSON.stringify(stable(r.owner||null))!==JSON.stringify(stable(x.owner))||(r.phase||null)!==x.phase||fingerprint(original,r)!==x.key||x.text!==(supplied?.text||(r.phase==='awaiting-verification'?'The work is ready for verification.':STATE_COPY[x.state]))||x.text_kind!==(supplied?'owner-published':'recorded-state')||JSON.stringify(stable(supplied?.artifacts||[]))!==JSON.stringify(stable(x.artifacts))||h.identities?.[x.id]!==bodyDigest(x.receipt_snapshot))return false;
  }catch{return false;}}
  seen.add(x.id);return true;
 }).map(x=>Object.fromEntries(['key','id','assignment','step_id','revision','label','state','phase','source_sha','observed_at','recorded_at','receipt_digest','owner','text','text_kind','artifacts',...(x.preview?['preview']:[])].map(k=>[k,k==='owner'?(x.owner?{...x.owner}:null):k==='artifacts'?x.artifacts.map(a=>({...a})):k==='preview'?{...x.preview}:x[k]])));
}

export function cardUpdatesAudit(value){return value?{schema:value.schema,revision:value.revision,sequence:value.sequence,retained_count:value.items?.length||0,identity_count:Object.keys(value.identities||{}).length,truncated:value.truncated===true,sha256:bodyDigest(JSON.stringify(stable(value)))}:null;}
