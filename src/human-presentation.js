// Additive presentation only. Machine outcomes, retry guards and legacy MCP text
// remain authoritative and are never reconstructed from these sentences.
export const HUMAN_CATALOG_VERSION = 1;
export const HUMAN_CATALOG = Object.freeze({
  'data.unknown': ['Status unavailable', "The current status isn't available yet.", 'neutral'],
  'data.unrecognized': ['Update available', "Relay returned an update, but its status isn't recognized yet.", 'neutral'],
  'data.partial': ['Some updates unavailable', "Relay couldn't load all the updates. This view may be incomplete.", 'warning'],
  'work.queued': ['Queued', 'This task is waiting to start.', 'neutral'],
  'work.assigned': ['Assigned', 'A worker is assigned to this task.', 'info'],
  'work.working': ['In progress', 'No additional progress details are available in this update.', 'info'],
  'work.reserved': ['Waiting to start', "The task is assigned, but Relay hasn't seen a source change yet.", 'neutral'],
  'work.held': ['On hold', 'This task is on hold.', 'warning'],
  'work.blocked': ["Can't continue yet", 'This task has a blocker that needs attention.', 'warning'],
  'work.failed': ['Run failed', 'The worker reported that this run failed.', 'error'],
  'work.wait_user': ['Ready for review', 'This task needs a review.', 'info'],
  'work.wait_external': ['Waiting for a check', 'An external check has not finished yet.', 'info'],
  'work.completed': ['Task complete', 'The task is recorded as complete.', 'success'],
  'work.cancelled': ['Cancelled', 'This task was cancelled.', 'neutral'],
  'work.superseded': ['Replaced', 'This work continues in another task.', 'neutral'],
  'progress.possibly_stale': ['Update delayed', "Relay hasn't seen a recent progress update.", 'warning'],
  'progress.stale': ['Out-of-date progress', 'The progress information is out of date.', 'warning'],
  'release.checks_running': ['Checks in progress', 'The reported checks have not all finished.', 'info'],
  'release.check_failed': ['A check failed', 'A reported check found a problem.', 'error'],
  'release.check_cancelled': ['Check cancelled', 'A reported check was cancelled before it finished.', 'warning'],
  'release.check_skipped': ['Check skipped', 'A reported check did not run.', 'neutral'],
  'release.check_neutral': ['Check finished', 'A reported check finished without a pass or fail result.', 'neutral'],
  'release.observed_checks_complete': ['Reported checks finished', 'The recorded checks have finished.', 'neutral'],
  'release.checks_unverified': ['Checks unconfirmed', "Relay hasn't confirmed the checks for this version.", 'warning'],
  'release.draft_open': ['Draft', 'A draft pull request is ready to review.', 'neutral'],
  'release.in_review': ['In review', 'The pull request is open for review.', 'info'],
  'release.merged': ['Merged', 'The source change is merged.', 'success'],
  'error.validation': ['Request needs a correction', "Relay couldn't use this request. Check its fields before trying again.", 'error'],
  'error.auth': ['Connection unverified', "Relay couldn't verify this connection.", 'error'],
  'error.permission': ['Permission needed', "Relay doesn't have permission to do that.", 'error'],
  'error.not_found': ['Item unavailable', "Relay couldn't find this item with this connection.", 'warning'],
  'error.conflict': ['Changed during the request', 'The item changed before this request finished.', 'warning'],
  'error.capacity': ['Service busy', "The service can't handle this request right now.", 'warning'],
  'error.rate_limit': ['Requests paused', 'The service is limiting requests on this connection. This step is paused.', 'warning'],
  'error.timeout_read': ['Check timed out', "The service didn't respond in time, so Relay couldn't check the latest information.", 'error'],
  'error.uncertain_write': ['Change unconfirmed', "Relay couldn't confirm whether or not the change was saved.", 'warning'],
  'error.provider_read': ['Could not load updates', "Relay couldn't load the latest information from the service.", 'error'],
  'error.unknown_read': ['Could not load updates', "Relay couldn't load the latest information.", 'error'],
  'error.unknown_write': ['Result unconfirmed', "Relay couldn't confirm the result of this change.", 'warning'],
  'verify.browser_capacity': ['Check not run', "The browser service is busy, so this check hasn't run yet.", 'warning'],
  'file.upload_unknown': ['Upload unconfirmed', "The upload didn't finish. Check its status before starting again.", 'warning']
});
for(const message of Object.values(HUMAN_CATALOG))Object.freeze(message);
const PRESENTATION_STATES = Object.freeze({
  queued:'work.queued',active:'work.assigned',working:'work.working',
  'reserved-but-idle':'work.reserved',held:'work.held',blocked:'work.blocked',
  'waiting-for-human':'work.wait_user','waiting-on-external-system':'work.wait_external',
  completed:'work.completed',complete:'work.completed',cancelled:'work.cancelled',
  superseded:'work.superseded','possibly-stale':'progress.possibly_stale',
  'officially-stale':'progress.stale'
});
const QUERY_TOOLS = new Set([
  'relay_runner_projects','relay_runner_project','relay_runner_assignments','relay_runner_progress',
  'relay_runner_resume','relay_runner_updates','relay_runner_preflight','relay_runner_feedback_status',
  'relay_runner_feedback_peek','relay_source_status','relay_source_repo','relay_source_file',
  'relay_source_inventory','relay_source_pull_request','relay_source_checks','relay_cloud_status',
  'relay_cloud_scripts','relay_cloud_worker','relay_cloud_builds','relay_cloud_project',
  'relay_staff_directory','relay_render_context_card','relay_show_legacy_bridge_card',
  'relay_control_status','relay_ui_control_center','relay_verify_evidence_plan',
  'relay_verify_evidence_engines','relay_verify_browser_recipes','relay_verify_recipe_list',
  'relay_transfer_read'
]);
const COMMAND_TOOLS = new Set([
  'relay_runner_coordinate','relay_runner_cleanup','relay_runner_feedback_ack','relay_runner_feedback_submit',
  'relay_source_create_branch','relay_source_update_file','relay_source_commit_files',
  'relay_source_edit_text','relay_source_append_text','relay_source_open_pull_request',
  'relay_source_pull_request_action','relay_source_sync_branch','relay_cloud_upload_version',
  'relay_cloud_deploy_version','relay_cloud_deploy_project_version','relay_transfer_write'
]);
const MIXED_READ_ACTIONS = Object.freeze({
  relay_execution:['status','source_read'],relay_context:['read'],relay_night_shift:['read'],
  relay_skills:['catalog','search','resolve','read','audit','vendor','update']
});
export function presentationOperation(name, args = {}) {
  const operation = {name:typeof name==='string'?name:'unknown',kind:'unknown'};
  if(QUERY_TOOLS.has(name))operation.kind='query';
  else if(COMMAND_TOOLS.has(name))operation.kind='command';
  else if(MIXED_READ_ACTIONS[name])operation.kind=MIXED_READ_ACTIONS[name].includes(args.action)?'query':'command';
  // This gateway mixes actions; an absent/unknown method must stay conservative.
  else if(name==='relay_ui_request')operation.kind=args.method==='GET'?'query':'command';
  return operation;
}

export function safePresentationText(value, max = 700) {
  if(typeof value!=='string')return '';
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,'[redacted]')
    .replace(/\b(?:Bearer|Basic)\s+[^\s,;]+/gi,'[redacted]')
    .replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*:\s*[^\r\n]*/gi,'[redacted]')
    .replace(/\b(?:token|password|secret|api[_-]?key|access[_-]?token)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,'[redacted]')
    .replace(/https?:\/\/[^\s<>"']+/gi,'[link omitted]')
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,max);
}
const plainObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const isoTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const codeText=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:/-]{1,100}$/.test(value)?value:null;
function technicalDetails(data, error, operation) {
  const checkpoint=data.latest||data.checkpoints?.[0]||{};
  const identities=data.identities||checkpoint.identities||{};
  const out={operation:codeText(operation.name),operation_kind:operation.kind};
  for(const key of ['class','code'])if(codeText(error[key]))out[key]=error[key];
  for(const key of ['status','status_code'])if(Number.isInteger(error[key])&&error[key]>=100&&error[key]<=599)out[key]=error[key];
  for(const key of ['head_sha','pr_head_sha','merge_commit_sha'])if(/^[a-f0-9]{40}$/.test(identities[key]||''))out[key]=identities[key];
  for(const key of ['request_id','operation_id','record_sha','version_id'])if(codeText(data[key]))out[key]=data[key];
  if(['github','cloudflare'].includes(error.upstream?.provider))out.service=error.upstream.provider;
  return Object.fromEntries(Object.entries(out).filter(([,value])=>value!==null));
}

// Normalization is deliberately bounded to this migration's typed producers.
// Unknown successful shapes never become a universal health/success assertion.
export function normalizeCommunicationResult(data = {}, {operation, now = null} = {}) {
  if(!plainObject(data))data={};
  const op=plainObject(operation)?operation:plainObject(data.presentation_operation)?data.presentation_operation:{kind:'unknown',name:'unknown'};
  const normalizedOp={kind:['query','command','discovery','recipe'].includes(op.kind)?op.kind:'unknown',name:codeText(op.name)||'unknown'};
  const readOnly=['query','discovery'].includes(normalizedOp.kind);
  const error=plainObject(data.error)?data.error:{};
  const checkpoint=plainObject(data.latest)?data.latest:(Array.isArray(data.checkpoints)?data.checkpoints.find(plainObject):null)||{};
  const claims=Array.isArray(data.claims)?data.claims.filter(plainObject):[];
  const first=(plainObject(data.claim)?data.claim:null)||(plainObject(data.assignment)?data.assignment:null)||claims.find(item=>!['completed','cancelled','superseded'].includes(item.state))||claims[0]||(Array.isArray(data.progress)?data.progress.find(plainObject):null)||(Array.isArray(data.queue)?data.queue.find(plainObject):null)||checkpoint.assignment||{};
  const state=checkpoint.state||data.state||first.state;
  const failure=data.ok===false||data.isError===true||Boolean(data.error);
  const observed=isoTime(data.checked_at||data.observed_at||data.generated_at||checkpoint.generated_at);
  const coverage=data.coverage?.complete===false||data.coverage?.status==='partial'||data.partial===true||data.truncated===true?'partial':'unknown';
  let id=Object.hasOwn(PRESENTATION_STATES,state)?PRESENTATION_STATES[state]:'data.unrecognized';
  let mutation=readOnly?'not_applicable':'unknown';
  let outcome='observed';
  let next=null;
  let retry={policy:'none',not_before:null,scheduled_at:null};
  const pr=plainObject(data.pull_request)?data.pull_request:(data.number&&plainObject(data.head)?data:null);
  const checks=Array.isArray(data.checks?.check_runs)?data.checks.check_runs.filter(plainObject):Array.isArray(data.check_runs)?data.check_runs.filter(plainObject):null;
  if(pr)id=pr.merged===true?'release.merged':pr.draft===true?'release.draft_open':'release.in_review';
  if(checks){
    id=checks.some(item=>item.status==='completed'&&['failure','timed_out','action_required','startup_failure','stale'].includes(item.conclusion))?'release.check_failed':
      checks.some(item=>item.status==='completed'&&item.conclusion==='cancelled')?'release.check_cancelled':
      checks.some(item=>item.status!=='completed')?'release.checks_running':
      checks.some(item=>item.conclusion==='skipped')?'release.check_skipped':
      checks.some(item=>item.conclusion==='neutral')?'release.check_neutral':
      checks.length&&checks.every(item=>item.conclusion==='success')?'release.observed_checks_complete':'release.checks_unverified';
    // A source milestone may lead only if no outstanding or failed check masks it.
    if(pr?.merged===true&&id==='release.observed_checks_complete')id='release.merged';
  }
  if(coverage==='partial')id='data.partial';
  if(['possibly-stale','officially-stale'].includes(state))id=PRESENTATION_STATES[state];
  if(state==='failed')id=checkpoint.stage==='checks'?'release.check_failed':'work.failed';
  if(state==='blocked')id='work.blocked';
  if(failure){
    const classes={validation:'error.validation',auth:'error.auth',permission:'error.permission',not_found:'error.not_found',conflict:'error.conflict',capacity:'error.capacity',rate_limit:'error.rate_limit',uncertain_write:'error.uncertain_write'};
    id=(Object.hasOwn(classes,error.class||error.code)?classes[error.class||error.code]:null)||((error.class==='timeout'||error.code==='timeout')?(readOnly?'error.timeout_read':'error.uncertain_write'):(error.class==='provider'?(readOnly?'error.provider_read':'error.unknown_write'):(readOnly?'error.unknown_read':'error.unknown_write')));
    outcome='failed';
    if(['error.uncertain_write','error.unknown_write'].includes(id))outcome='unknown';
    if(['error.conflict','error.uncertain_write','error.unknown_write'].includes(id)){
      retry.policy='read_first';next={code:'check_status',actor:'relay',availability:'unavailable'};
    }else if(readOnly&&['error.timeout_read','error.provider_read','error.unknown_read'].includes(id))retry.policy='bounded_read';
    if(id==='error.rate_limit'){
      let deadline=isoTime(error.retry_at||error.upstream?.retry_at);
      if(!deadline&&Number.isSafeInteger(error.upstream?.rate_limit_reset)&&error.upstream.rate_limit_reset>0){
        const timestamp=error.upstream.rate_limit_reset*1000;
        if(Number.isFinite(new Date(timestamp).valueOf()))deadline=new Date(timestamp).toISOString();
      }
      // Expired/malformed provider timestamps cannot promise a future retry.
      if(deadline&&isoTime(now)&&Date.parse(deadline)<=Date.parse(now))deadline=null;
      retry={policy:'after_provider_window',not_before:deadline,scheduled_at:null};
    }
  }
  if(data.status==='deferred'&&data.reason==='browser_capacity'){
    id='verify.browser_capacity';outcome='deferred';mutation='not_attempted';
  }
  // Only explicit producer metadata can establish that a command did not write.
  if(['not_attempted','confirmed_applied','confirmed_not_applied','unknown','not_applicable'].includes(data.mutation))mutation=data.mutation;
  if(normalizedOp.name==='relay_transfer_write'&&failure&&!data.transfer_id&&!data.manifest&&id==='error.unknown_write')id='file.upload_unknown';
  const typedNext=data.next_action;
  if(!failure&&plainObject(typedNext)&&['check_status','verify_release','review_details'].includes(typedNext.code)&&['relay','user','external','none'].includes(typedNext.actor)&&['available','scheduled','unavailable'].includes(typedNext.availability))next={code:typedNext.code,actor:typedNext.actor,availability:typedNext.availability};
  const candidateEvent=data.latest_event||checkpoint.latest_event||first.latest_event;
  const eventTypes=['source-commit','pull-request-opened','pull-request-updated','check-started','check-completed','cloud-deployment'];
  const latestEvent=plainObject(candidateEvent)&&eventTypes.includes(candidateEvent.type)?{type:candidateEvent.type,at:isoTime(candidateEvent.at),conclusion:codeText(candidateEvent.conclusion)}:null;
  const recordedNext=typeof first.next_action==='string'&&Boolean(first.next_action.trim())||typeof checkpoint.next_action==='string'&&Boolean(checkpoint.next_action.trim());
  return {version:1,message_id:id,params:{},operation:normalizedOp,outcome,mutation,
    next_action:next,evidence:{observed_at:observed,source:'typed_result',coverage,latest_event:latestEvent,has_recorded_next_step:recordedNext},retry,
    technical:technicalDetails(data,error,normalizedOp)};
}

export function formatRelay(input, {locale='en', timeZone='UTC'} = {}) {
  const valid=plainObject(input)&&input.version===1&&Object.hasOwn(HUMAN_CATALOG,input.message_id)&&plainObject(input.params)&&Object.keys(input.params).length===0&&
    plainObject(input.operation)&&['query','command','discovery','recipe','unknown'].includes(input.operation.kind)&&
    ['observed','accepted','succeeded','failed','deferred','unknown'].includes(input.outcome)&&
    ['not_attempted','confirmed_applied','confirmed_not_applied','unknown','not_applicable'].includes(input.mutation);
  const normalized=valid?input:normalizeCommunicationResult();
  const [label,baseSummary,severity]=HUMAN_CATALOG[normalized.message_id];
  const service=normalized.technical?.service==='github'?'GitHub':normalized.technical?.service==='cloudflare'?'Cloudflare':null;
  let summary=service?baseSummary.replaceAll('The service',service).replaceAll('the service',service):baseSummary,nextStep=null;
  if(normalized.message_id==='work.working'){
    const event=normalized.evidence?.latest_event;
    const updates={'source-commit':'A source change was recorded.','pull-request-opened':'A pull request was opened.','pull-request-updated':'The pull request was updated.','check-started':'A check started.','cloud-deployment':'A deployment was recorded.'};
    const checks={success:'The latest reported check passed.',failure:'The latest reported check failed.',cancelled:'The latest check was cancelled.',skipped:'The latest check did not run.',neutral:'The latest check finished without a pass or fail result.'};
    summary=(Object.hasOwn(updates,event?.type)?updates[event.type]:null)||(event?.type==='check-completed'?(Object.hasOwn(checks,event.conclusion)?checks[event.conclusion]:'A check finished; its result is unconfirmed.'):null)||(normalized.evidence?.has_recorded_next_step?'':baseSummary);
  }
  if(normalized.message_id==='error.rate_limit'){
    const deadline=isoTime(normalized.retry?.not_before);
    if(deadline){
      let date;
      try{date=new Intl.DateTimeFormat('en',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short',timeZone}).format(new Date(deadline));}
      catch{date=deadline;}
      summary+=' '+(service||'The service')+' says requests can resume after '+date+'.';
    }else summary+=' '+(service||'The service')+" hasn't provided a current retry time.";
  }
  if(['error.uncertain_write','error.unknown_write','error.conflict'].includes(normalized.message_id))nextStep='Check the latest status before trying again.';
  else if(normalized.next_action?.code==='verify_release')nextStep='Deployment and live checks are still pending.';
  else if(normalized.next_action?.code==='check_status')nextStep='Check the latest status.';
  else if(normalized.next_action?.code==='review_details')nextStep='Review the task details.';
  const details=technicalDetails({identities:normalized.technical||{}},normalized.technical||{},normalized.operation||{});
  for(const key of ['request_id','operation_id','record_sha','version_id','service'])if(codeText(normalized.technical?.[key]))details[key]=normalized.technical[key];
  const deadline=isoTime(normalized.retry?.not_before);if(deadline)details.retry_not_before=deadline;
  return {version:1,catalog_version:HUMAN_CATALOG_VERSION,message_id:normalized.message_id,locale:'en',
    label,summary,severity,next_step:nextStep,
    ...(isoTime(normalized.evidence?.observed_at)?{timestamp:{observed_at:isoTime(normalized.evidence.observed_at)}}:{}),
    details:{label:'Technical details',items:Object.entries(details).map(([key,value])=>({key,value}))}};
}

export function withHumanPresentation(result, options = {}) {
  if(!plainObject(result))return result;
  if(options.mode==='legacy')return {...result,presentation_mode:'legacy'};
  const input=normalizeCommunicationResult(result,options);
  return {...result,presentation_mode:'human_v1',human_v1:formatRelay(input,options)};
}
