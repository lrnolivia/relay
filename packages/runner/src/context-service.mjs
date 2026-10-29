import {createInteractionSignal,curateRelationshipNote,relationshipContextForStaff} from '../../../src/relationship-context.js';
import { createHash } from 'node:crypto';
import {openContext,CONTEXT_ROLLOVER_ENABLED} from './context-storage.mjs';
import { callRunnerControlCore } from '../../../src/runner-control-core.js';
import { validateControlArguments } from '../../../src/runner-control.js';
import { githubApiRequest } from '../../../src/source.js';
const text=(maxLength,pattern)=>({type:'string',minLength:1,maxLength,...(pattern?{pattern}:{})});
const id=text(100,'^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$');
export const contextTool={name:'relay_context',title:'Preserve project context and worker messages',description:'QUERY / COMMAND — Read durable project context or pending assignment inboxes. Reads never acknowledge or resolve. view inbox includes only unresolved received messages; history includes all received messages; audit with entry_id pages retained lifecycle receipts. Writes require current assignment owner/branch, expected_revision and operation_id. resolve requires reason and verified commit_sha evidence; archive requires prior explicit resolution; reopen preserves audit history. compact physically indexes history without removing pending work and is disabled until a compatible rollback baseline is verified. Use next_page_token for bounded stable pages; restart when context revision or ownership changes.',inputSchema:{type:'object',additionalProperties:false,required:['action','project','assignment'],properties:{
 action:{type:'string',enum:['read','record','ack','retract','curate','resolve','archive','reopen','compact']},project:text(80,'^[a-z0-9-]+$'),assignment:id,expected_owner:id,expected_branch:text(240),expected_revision:{type:'integer',minimum:0},operation_id:id,
 view:{enum:['context','inbox','history','audit']},page_token:text(1500),reason:text(1000),
 relationship:{type:'object',additionalProperties:false,required:['staff_id','topic','source','explicit','evidence_refs'],properties:{staff_id:id,topic:{enum:['communication','collaboration','humor','presentation','workflow']},source:{enum:['explicit-feedback','repeated-collaboration']},explicit:{type:'boolean'},evidence_refs:{type:'array',minItems:1,maxItems:12,items:text(400)}}},
 kind:{type:'string',enum:['decision','lesson','message','relationship-signal']},content:text(2000),recipient_assignment:id,entry_id:text(68,'^ctx_[a-f0-9]{64}$'),commit_sha:text(40,'^[a-f0-9]{40}$'),cursor:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:20}
}},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Configuration is an explicit security binding, not a staff routing label.
// Only the ingress may supply a cryptographically verified Access principal.
export function assertRelationshipCurator(binding,principal,claim,project){
 if(!binding||!principal||binding.project!==project||binding.assignment!==claim.id||binding.owner!==claim.owner||binding.branch!==claim.branch||binding.issuer!==principal.iss||!binding.subject||binding.subject!==principal.sub)throw Error('Relationship curation requires a configured verified lead principal and assignment binding');
}
const lifecycle=entry=>entry.lifecycle?.state||(entry.acknowledgements?.length?'acknowledged':'new');
const recipientOwns=(entry,claim)=>entry.kind==='message'&&entry.recipient_assignment===claim.id&&entry.recipient_owner===claim.owner&&entry.recipient_branch===claim.branch;
const visibleTo=(entry,assignment)=>entry.kind!=='message'||entry.assignment===assignment||entry.recipient_assignment===assignment;
const currentClaim=claim=>claim?.state==='active'&&Date.parse(claim.lease_until)>Date.now();
function decodeToken(token,binding,revision){
 try{const value=JSON.parse(Buffer.from(token,'base64url').toString());if(value.v!==1||value.binding!==binding||value.revision!==revision||typeof value.after!=='string'||!/^([a-f0-9]{64}|[0-9]+)$/.test(value.after))throw Error();return value.after;}catch{throw Error('Context page changed; restart without page_token');}
}
const encodeToken=(after,binding,revision)=>Buffer.from(JSON.stringify({v:1,after,binding,revision})).toString('base64url');
export async function callContext(args,env,apiOverride,{verifiedPrincipal=null}={}){
 validateControlArguments(args,contextTool.inputSchema);
 const api=apiOverride||((path,options)=>githubApiRequest(env,path,options));
 const project=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api);
 const claim=project.coordination.claims.find(c=>c.id===args.assignment);if(!claim)throw Error('Project context requires an explicit assignment');
 const bucket=env.EVIDENCE;if(!bucket?.get||!bucket?.put)throw Error('Durable context storage unavailable');
 const storage=await openContext(bucket,args.project),{record,tree}=storage;
 if(args.action==='read'){
  const view=args.view||'context',limit=args.limit||20;
  const binding=hash({project:args.project,assignment:claim.id,owner:claim.owner,branch:claim.branch,view,entry_id:args.entry_id||null});
  if(args.cursor&&args.page_token)throw Error('Use either cursor or page_token');
  if(record.schema===2&&args.cursor)throw Error('Context migrated; restart without cursor and use next_page_token');
  const after=args.page_token?decodeToken(args.page_token,binding,record.revision):null;
  let auditEntry;
  if(view==='audit'){auditEntry=await storage.entry(args.entry_id);if(!auditEntry||!visibleTo(auditEntry,claim.id))throw Error('Context audit entry unavailable');}
  const include=entry=>view==='audit'?entry.entry_id===auditEntry.id:
   view==='inbox'?entry.kind==='message'&&entry.recipient_assignment===claim.id&&!entry.retracted_at&&['new','acknowledged'].includes(lifecycle(entry)):
   view==='history'?entry.kind==='message'&&entry.recipient_assignment===claim.id:visibleTo(entry,claim.id)&&!entry.retracted_at&&!(entry.kind==='message'&&lifecycle(entry)==='archived');
  let entries=[],next=null,nextCursor=null;
  if(record.schema===1){
   const values=view==='audit'?record.operations:record.entries;
   // Numeric legacy pages retain their original visible-offset behavior.
   if(!args.page_token&&view==='context'){const visible=values.filter(include),start=args.cursor||0;entries=visible.slice(start,start+limit);nextCursor=start+limit<visible.length?start+limit:null;const last=entries.at(-1);next=nextCursor===null?null:String(values.indexOf(last)+1);}
   else{const start=after===null?0:Number(after);if(!Number.isSafeInteger(start)||start<0)throw Error('Context page changed; restart without page_token');let i=start,scanned=0;for(;i<values.length&&scanned<64&&entries.length<limit;i++,scanned++)if(include(values[i]))entries.push(values[i]);next=i<values.length?String(i):null;}
  }else{
   if(after!==null&&!/^[a-f0-9]{64}$/.test(after))throw Error('Context page changed; restart without page_token');
   const page=await tree.page(view==='audit'?record.operations_root:record.entries_root,after||'',64);
   for(let i=0;i<page.items.length;i++){const [key,value]=page.items[i];if(include(value))entries.push(value);if(entries.length===limit){next=i<page.items.length-1||page.next?key:null;break;}if(i===page.items.length-1)next=page.next;}
  }
  const relationshipEntries=record.schema===1?record.entries:record.relationships;
  const notes=relationshipEntries.filter(x=>x.kind==='relationship-note'&&!x.retracted_at&&x.relationship&&relationshipEntries.some(source=>source.id===x.source_entry_id&&!source.retracted_at)).map(x=>({...x.relationship,entry_id:x.id}));
  return {ok:true,revision:record.revision,inbox_lifecycle:true,storage_schema:record.schema,rollover_enabled:CONTEXT_ROLLOVER_ENABLED,view,staff_relationship:relationshipContextForStaff(claim.primary_staff,notes),entries:entries.map(x=>view==='audit'?x:{...x,...(x.kind==='message'?{inbox_state:lifecycle(x),reconciliation_required:x.recipient_assignment===claim.id&&!recipientOwns(x,claim)}:{})}),next_cursor:nextCursor,next_page_token:next===null?null:encodeToken(next,binding,record.revision),native_delivery_verified:false};
 }
 if(args.action==='curate'){let binding;try{binding=JSON.parse(env.RELATIONSHIP_CURATOR_BINDING||'null');}catch{throw Error('Relationship curator binding unavailable');}assertRelationshipCurator(binding,verifiedPrincipal,claim,args.project);}
 if(args.relationship&&(args.action!=='record'||args.kind!=='relationship-signal'))throw Error('Relationship proposals require the relationship-signal record kind');
 if(!args.operation_id)throw Error('Context write requires operation_id');
 // Authority precedes replay, including old receipts after a handoff.
 if(!currentClaim(claim)||claim.owner!==args.expected_owner||claim.branch!==args.expected_branch)throw Error('Context write requires current admitted assignment ownership');
 const prior=await storage.operation(args.operation_id);
 if(prior){if(prior.intent!==hash(args))throw Error('Operation ID has different context intent');return {ok:true,replayed:true,revision:record.revision,entry:prior.entry_id?await storage.entry(prior.entry_id):undefined,native_delivery_verified:false};}
 if(record.revision!==args.expected_revision)throw Error('Context revision changed; refresh before writing');
 if(record.schema===1&&(args.action==='compact'||record.operations.length>=600||(['record','curate'].includes(args.action)&&record.entries.length>=200)))await storage.migrate();
 let entry,event;
 const now=new Date().toISOString();
 if(args.action==='compact'){
  // Indexing is physical only; it neither archives nor resolves any entry.
  await storage.migrate();
 }else if(args.action==='curate'){
  const source=await storage.entry(args.entry_id);
  if(!source||source.kind!=='relationship-signal'||source.retracted_at||!source.relationship)throw Error('Curation requires a current attributed relationship proposal');
  const relationships=record.schema===1?record.entries:record.relationships;
  if(relationships.some(x=>x.kind==='relationship-note'&&x.source_entry_id===source.id&&!x.retracted_at))throw Error('Proposal already has a current curated note; retract it before re-curating');
  if(record.schema===2&&relationships.length>=200)throw Error('Relationship evidence capacity reached; preserve attributed history');
  const relationship=curateRelationshipNote(createInteractionSignal(source.relationship),{curator_staff_id:'julian',note:args.content});
  entry={id:'ctx_'+hash({project:args.project,operation:args.operation_id}),kind:'relationship-note',project:args.project,assignment:args.assignment,owner:claim.owner,branch:claim.branch,content:relationship.note,relationship,source_entry_id:source.id,repository:source.repository,commit_sha:source.commit_sha,source_exists:source.source_exists,conclusion_verified:false,created_at:now,acknowledgements:[]};
 }else if(args.action==='record'){
  if(!args.kind||!args.content||!args.commit_sha)throw Error('Context record requires kind, content and exact source artifact');
  const commit=await api(`/repos/${project.registration.repository}/commits/${args.commit_sha}`);if(commit.sha!==args.commit_sha)throw Error('Context source artifact could not be verified');
  let recipient=null;if(args.kind==='message'){recipient=project.coordination.claims.find(c=>c.id===args.recipient_assignment);if(!recipient||!['active','held'].includes(recipient.state))throw Error('Message requires an explicit current recipient assignment');}else if(args.recipient_assignment)throw Error('Only a message can name a recipient');
  entry={id:'ctx_'+hash({project:args.project,operation:args.operation_id}),kind:args.kind,project:args.project,assignment:args.assignment,owner:claim.owner,branch:claim.branch,content:args.content,repository:project.registration.repository,commit_sha:args.commit_sha,source_exists:true,conclusion_verified:false,created_at:now,...(recipient?{recipient_assignment:recipient.id,recipient_owner:recipient.owner,recipient_branch:recipient.branch}:{}),acknowledgements:[]};
  if(args.kind==='relationship-signal'){if(record.schema===2&&record.relationships.length>=200)throw Error('Relationship evidence capacity reached; preserve attributed history');if(!args.relationship)throw Error('Relationship proposal requires structured evidence');entry.relationship=createInteractionSignal({...args.relationship,observation:args.content});if(!entry.relationship.evidence_refs.length||(entry.relationship.source==='explicit-feedback'&&!entry.relationship.explicit))throw Error('Relationship proposal requires attributable evidence and explicit feedback');}
 }else{
  entry=await storage.entry(args.entry_id);if(!entry)throw Error('Context entry not found');
  if(args.action==='retract'){if(entry.assignment!==claim.id||entry.owner!==claim.owner||entry.branch!==claim.branch)throw Error('Only the originating assignment owner can retract its note');entry.retracted_at=now;}
  else{
   if(!recipientOwns(entry,claim))throw Error('Message recipient changed; preserve the message for reconciliation');
   if(entry.retracted_at)throw Error('Retracted messages retain audit history but cannot change inbox state');
   const state=lifecycle(entry);
   if(args.action==='ack'){
    if(state==='new'){if(!entry.acknowledgements.length)entry.acknowledgements.push({at:now,owner:claim.owner,operation_id:args.operation_id,kind:'explicit-caller-acknowledgement'});event={from:state,to:'acknowledged'};}
   }else{
    if(!args.reason)throw Error('Inbox lifecycle change requires reason');
    if(args.action==='resolve'){if(!['new','acknowledged'].includes(state))throw Error('Only pending messages can be resolved');if(!args.commit_sha)throw Error('Resolution requires exact source evidence');const commit=await api(`/repos/${project.registration.repository}/commits/${args.commit_sha}`);if(commit.sha!==args.commit_sha)throw Error('Resolution source artifact could not be verified');event={from:state,to:'resolved',reason:args.reason,commit_sha:args.commit_sha};}
    else if(args.action==='archive'){if(state!=='resolved')throw Error('Only explicitly resolved messages can be archived');event={from:state,to:'archived',reason:args.reason};}
    else if(args.action==='reopen'){if(!['resolved','archived'].includes(state))throw Error('Only resolved or archived messages can be reopened');event={from:state,to:'new',reason:args.reason};}
   }
   if(event)entry.lifecycle={state:event.to,at:now,operation_id:args.operation_id,owner:claim.owner,branch:claim.branch};
  }
 }
 if(entry)await storage.putEntry(entry);
 const operation={id:args.operation_id,intent:hash(args),...(entry?{entry_id:entry.id}:{}),action:args.action,at:now,assignment:claim.id,owner:claim.owner,branch:claim.branch,...(event?{event}:{})};
 await storage.putOperation(operation);record.revision++;
 // Recheck caller AND message recipient before the commit. Postcommit changes
 // remain explicit reconciliation rather than claiming delivery or resolution.
 const latest=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api),actual=latest.coordination.claims.find(c=>c.id===claim.id);
 if(!currentClaim(actual)||actual.owner!==claim.owner||actual.branch!==claim.branch)throw Error('Assignment changed before context commit; live history retained');
 if(entry?.kind==='message'){const recipient=latest.coordination.claims.find(c=>c.id===entry.recipient_assignment);if(!recipient||recipient.owner!==entry.recipient_owner||recipient.branch!==entry.recipient_branch||(args.action==='record'&&!['active','held'].includes(recipient.state)))throw Error('Message recipient changed before context commit; live history retained');}
 await storage.commit();
 const current=await callRunnerControlCore('relay_runner_project',{project:args.project},env,api),finalClaim=current.coordination.claims.find(c=>c.id===claim.id);
 const finalRecipient=entry?.kind==='message'?current.coordination.claims.find(c=>c.id===entry.recipient_assignment):null;
 const stable=currentClaim(finalClaim)&&finalClaim.owner===claim.owner&&finalClaim.branch===claim.branch&&(!entry||entry.kind!=='message'||(finalRecipient?.owner===entry.recipient_owner&&finalRecipient?.branch===entry.recipient_branch));
 return {ok:Boolean(stable),replayed:false,revision:record.revision,storage_schema:record.schema,entry,native_delivery_verified:false,executor_started:false,...(!stable?{reconcile_required:true,error:{message:'Context receipt retained; assignment changed during the write. Reconcile before acting on it.'}}:{})};
}
