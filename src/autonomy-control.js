// Safety atoms share the existing durable binding, separate from event replay.
const SCOPE=/^(?:global|[a-z0-9-]{1,80})$/,SHA=/^[a-f0-9]{40}$/;
const VERSION=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const actions=new Set(['status','hold','resume','healthy','approve','prepare_rollback','finish_rollback','prepare_restore_upload','finish_restore_upload']);
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status,code:'safety_control'});};
const text=(v,max=1000)=>typeof v==='string'&&v.trim()&&v.length<=max;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function validState(state,scope){
 return state?.schema===1&&state.scope===scope&&Number.isSafeInteger(state.revision)&&state.revision>=0&&typeof state.held==='boolean'&&Array.isArray(state.operations);
}
export function autonomyState(scope){
 if(!SCOPE.test(scope||''))fail('Invalid safety scope',400);
 return {schema:1,scope,revision:0,held:false,reason:null,last_healthy:null,last_user_approved:null,rollback:null,operations:[]};
}
export function validateAutonomyInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid safety request',400);
 const allowed=new Set(['action','scope','expected_revision','operation_id','reason','authorization','target','approval','kind','expected_current_version','result']);
 if(Object.keys(input).some(k=>!allowed.has(k))||!actions.has(input.action)||!SCOPE.test(input.scope||''))fail('Invalid safety action or scope',400);
 if(input.action==='status'){
  if(Object.keys(input).some(k=>!['action','scope'].includes(k)))fail('Status accepts only action and scope',400);
  return input;
 }
 if(!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||!/^[-\w]{8,120}$/.test(input.operation_id||''))fail('Safety mutation requires revision and operation identity',400);
 if(!text(input.reason))fail('Safety mutation requires a bounded reason',400);
 const fields={hold:[],resume:['authorization'],healthy:['target'],approve:['target','approval'],prepare_rollback:['kind','expected_current_version'],finish_rollback:['result'],prepare_restore_upload:['result'],finish_restore_upload:['result']}[input.action];
 if(Object.keys(input).some(k=>!['action','scope','expected_revision','operation_id','reason',...fields].includes(k)))fail('Unexpected fields for safety action',400);
 if(input.action==='resume'&&!text(input.authorization))fail('Resume requires explicit user authorization evidence',400);
 if(['healthy','approve'].includes(input.action)){
  const t=input.target;
  if(input.scope==='global'||!t||Object.keys(t).some(k=>!['worker','version_id','source_sha','compatibility_id','evidence','recovery'].includes(k))||!/^[a-zA-Z0-9_-]{1,128}$/.test(t.worker||'')||!VERSION.test(t.version_id||'')||!SHA.test(t.source_sha||'')||!text(t.compatibility_id,200)||!text(t.evidence))fail('Release target requires exact worker/version/source, compatibility and evidence',400);
  if('recovery' in t){const r=t.recovery;if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==5||Object.keys(r).some(k=>!['archive_sha256','manifest_sha256','restore_sha256','artifact_id','ci_run'].includes(k))||!['archive_sha256','manifest_sha256','restore_sha256'].every(k=>/^[a-f0-9]{64}$/.test(r[k]||''))||!['artifact_id','ci_run'].every(k=>Number.isSafeInteger(r[k])&&r[k]>0))fail('Recovery pointer requires exact archive/manifest/restore digests and CI/artifact identities',400);}
  if(input.action==='approve'&&(!input.approval||Object.keys(input.approval).some(k=>!['text','source'].includes(k))||!text(input.approval.text)||!text(input.approval.source)))fail('User approval requires its explicit text and source',400);
 }
 if(input.action==='prepare_rollback'&&(input.scope==='global'||!['healthy','user-approved'].includes(input.kind)||!VERSION.test(input.expected_current_version||'')))fail('Rollback requires project, target kind and current version',400);
 if(input.action==='finish_rollback'&&(!input.result||Object.keys(input.result).some(k=>!['state','version_id','evidence'].includes(k))||!['verified','failed'].includes(input.result.state)||!VERSION.test(input.result.version_id||'')||!text(input.result.evidence)))fail('Rollback completion requires a verified or failed receipt',400);
 if(['prepare_restore_upload','finish_restore_upload'].includes(input.action)){
  const r=input.result,keys=input.action==='prepare_restore_upload'?['module_sha256','configuration_sha256']:['module_sha256','configuration_sha256','version_id'];
  if(input.scope!=='relay'||!r||Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))||!['module_sha256','configuration_sha256'].every(k=>/^[a-f0-9]{64}$/.test(r[k]||''))||(input.action==='finish_restore_upload'&&!VERSION.test(r.version_id||'')))fail('Compiled restoration requires exact hashes and version identity',400);
 }
 return input;
}
export function transitionAutonomy(stored,input,now=new Date().toISOString()){
 validateAutonomyInput(input);const state=structuredClone(stored||autonomyState(input.scope));
 if(!validState(state,input.scope))fail('Safety state is invalid; writes remain stopped');
 if(input.action==='status')return {state,changed:false};
 const intent=JSON.stringify(canonical(input)),previous=state.operations.find(x=>x.id===input.operation_id);
 if(previous){if(previous.intent!==intent)fail('Safety operation identity was reused with a different intent');return {state,changed:false,duplicate:true};}
 if(state.revision!==input.expected_revision)fail('Safety revision changed; refresh before retrying');
 if(state.rollback?.state==='pending'&&['healthy','approve'].includes(input.action))fail('Release targets cannot change during an uncertain rollback');
 if(state.operations.length>=256)fail('Safety receipt capacity reached; preserve and account for history');
 if(input.action==='hold'){state.held=true;state.reason=input.reason;}
 if(input.action==='resume'){if(state.rollback?.state==='pending')fail('An uncertain rollback must be reconciled before resuming');state.held=false;state.reason=null;}
 if(input.action==='healthy')state.last_healthy={...input.target,recorded_at:now};
 if(input.action==='approve'){
  const previous=state.last_user_approved,same=previous&&['worker','version_id','source_sha','compatibility_id'].every(key=>previous[key]===input.target[key]);
  if(same&&previous.recovery&&JSON.stringify(canonical(previous.recovery))!==JSON.stringify(canonical(input.target.recovery)))fail('Recorded approved recovery evidence is immutable');
  const approval=same&&previous.approval?.text===input.approval.text&&previous.approval?.source===input.approval.source?previous.approval:{...input.approval,recorded_at:now,provenance:'attributed-explicit-user-instruction'};
  state.last_user_approved={...input.target,approval};
 }
 if(input.action==='prepare_rollback'){
  const target=input.kind==='healthy'?state.last_healthy:state.last_user_approved;
  if(!target)fail('The requested rollback target is not recorded; no substitute is allowed');
  if(state.rollback?.state==='pending')fail('A rollback is already pending; reconcile its existing operation');
  state.held=true;state.reason=input.reason;
  state.rollback={state:'pending',kind:input.kind,target:structuredClone(target),expected_current_version:input.expected_current_version,operation_id:input.operation_id,created_at:now};
 }
 if(input.action==='finish_rollback'){
  if(state.rollback?.state!=='pending'||input.result.version_id!==state.rollback.target.version_id)fail('Rollback receipt does not match the pending exact target');
  state.rollback={...state.rollback,...input.result,completed_at:now};
 }
 if(input.action==='prepare_restore_upload'){
  if(!state.held||state.rollback?.state!=='pending'||state.rollback.restoration||!state.rollback.target.recovery?.restore_sha256||input.operation_id!==state.rollback.operation_id+'-upload')fail('Compiled restoration requires one exact pending rollback');
  state.rollback.restoration={state:'upload_pending',...input.result,created_at:now};
 }
 if(input.action==='finish_restore_upload'){
  const pending=state.rollback,r=pending?.restoration;
  if(!state.held||pending?.state!=='pending'||r?.state!=='upload_pending'||input.operation_id!==pending.operation_id+'-record'||r.module_sha256!==input.result.module_sha256||r.configuration_sha256!==input.result.configuration_sha256||[pending.target.version_id,pending.expected_current_version].includes(input.result.version_id))fail('Compiled upload receipt does not match its pending intent');
  pending.original_target=structuredClone(pending.target);
  pending.target={...pending.target,version_id:input.result.version_id};
  pending.restoration={...r,...input.result,state:'uploaded',recorded_at:now};
 }
 state.revision++;state.operations.push({id:input.operation_id,intent,at:now,revision:state.revision});return {state,changed:true};
}
export async function durableAutonomy(storage,input){
 validateAutonomyInput(input);
 return storage.transaction(async tx=>{const next=transitionAutonomy(await tx.get('autonomy'),input);if(next.changed)await tx.put('autonomy',next.state);return {ok:true,state:next.state,duplicate:Boolean(next.duplicate)};});
}
export async function autonomyRequest(env,input){
 validateAutonomyInput(input);if(!env.RELAY_EVENTS)fail('Durable safety control is unavailable; writes remain stopped',503);
 const response=await env.RELAY_EVENTS.get(env.RELAY_EVENTS.idFromName('autonomy:'+input.scope)).fetch('https://relay-events/autonomy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(5000)});
 const result=await response.json();
 if(!response.ok||result.ok!==true||!validState(result.state,input.scope))fail(result.error||'Safety response is invalid; writes remain stopped',response.status>=400?response.status:503);
 return result;
}
export async function guardAutonomy(env,scopes=[]){
 if(env.RELAY_AUTONOMY_GUARD!=='enforced')return {enforced:false};
 const states=await Promise.all([...new Set(['global',...scopes])].map(scope=>autonomyRequest(env,{action:'status',scope})));
 const stopped=states.find(r=>r.state.held);if(stopped)fail('Autonomous work is held for '+stopped.state.scope+': '+stopped.state.reason);
 return {enforced:true,revisions:states.map(({state})=>({scope:state.scope,revision:state.revision}))};
}
export async function guardRepository(env,repository){
 const scope=String(repository).split('/').at(-1).toLowerCase().replaceAll('_','-'),aliases={gwfamily:'grnwht','grnwht-family-app':'grnwht'};
 return guardAutonomy(env,[...new Set([scope,aliases[scope]].filter(Boolean))]);
}
export async function publicAutonomyStatus(env,scope='global'){
 const {state}=await autonomyRequest(env,{action:'status',scope});return {schema:1,scope:state.scope,revision:state.revision,held:state.held,enforced:env.RELAY_AUTONOMY_GUARD==='enforced'};
}

export const autonomyTool={
 name:'relay_autonomy',title:'Stop or resume autonomous work',
 description:'QUERY / COMMAND — read, hold or resume autonomous work; record verified healthy or explicitly user-approved exact releases; restore a recorded healthy or user-approved target. A direct user instruction is sufficient authority: refresh status and use its revision and a unique operation identity. Approval requires the actual user message and source. Rollback checks retained provider identity and registered compatibility, stays held after recovery, and never substitutes another target. Holds block new execution and Relay publication; executors stop at their next checkpoint. configure_build_guard is Relay-only setup through the existing authenticated CI service headers: requires resume authorization, temporarily holds publication, copies only existing identity into secret build variables, and verifies the canonical guarded command before resuming. Never send credentials as arguments. Uncertain setup stays held; retry the same operation after readback. Configuration proof is separate from actual build execution. Other external builds and unconnected processes require their own integration.',
 inputSchema:{type:'object',additionalProperties:false,properties:{
  action:{type:'string',enum:['status','hold','resume','healthy','approve','rollback','configure_build_guard']},scope:{type:'string',pattern:'^(global|[a-z0-9-]{1,80})$'},
  expected_revision:{type:'integer',minimum:0},operation_id:{type:'string',pattern:'^[-\\w]{8,110}$'},
  reason:{type:'string',minLength:1,maxLength:1000},authorization:{type:'string',minLength:1,maxLength:1000},
  target:{type:'object',additionalProperties:false,properties:{worker:{type:'string'},version_id:{type:'string'},source_sha:{type:'string'},compatibility_id:{type:'string'},evidence:{type:'string',maxLength:1000},recovery:{type:'object',additionalProperties:false,properties:{archive_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},manifest_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},restore_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},artifact_id:{type:'integer',minimum:1},ci_run:{type:'integer',minimum:1}},required:['archive_sha256','manifest_sha256','restore_sha256','artifact_id','ci_run']}},required:['worker','version_id','source_sha','compatibility_id','evidence']},
  approval:{type:'object',additionalProperties:false,properties:{text:{type:'string',maxLength:1000},source:{type:'string',maxLength:1000}},required:['text','source']},
  kind:{type:'string',enum:['healthy','user-approved']},expected_current_version:{type:'string'}
 },required:['action','scope']},
 annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}
};
