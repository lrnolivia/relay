import { normalizeCommunicationResult, formatRelay, safePresentationText } from './human-presentation.js';
import { legacyContextCardModel } from './relay-context-card-legacy-model.js';
import { assignmentCardSteps } from './relay-card-steps.js';
import {assignmentCardUpdates} from './relay-card-updates.js';
import { cardStaff } from './relay-card-identity.js';
import { cardIdentity } from './relay-card-identity.js';
import {validProgressSnapshot} from './progress-snapshots.js';

export function contextCardModel(data = {}, directory = {}, options = {}) {
  if(data.snapshot&&!validProgressSnapshot(data.snapshot))data={...data,snapshot:null};
  if(data?.presentation_mode==='legacy')return legacyContextCardModel(data,directory);
  if(!data||typeof data!=='object'||Array.isArray(data))data={};
  data={...data};
  if(data.presentation_view==='explorer')data={...data,primary_staff:null,primary_team:null,supporting_staff:[],supporting_teams:[],staff_attribution:null,human:{}};
  const records=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)):[];
  for(const key of ['claims','queue','progress','checkpoints'])data[key]=records(data[key]);
  const normalized=normalizeCommunicationResult(data,{operation:data.presentation_operation||{name:'relay_render_context_card',kind:'query'},now:data.checked_at||null});
  const presentation=formatRelay(normalized,options);
  const states = { active:'Active', working:'Working', queued:'Up next', held:'On hold', completed:'Finished', complete:'Finished', blocked:'Blocked', failed:'Failed', 'waiting-for-human':'Needs your review', 'waiting-on-external-system':'Waiting on system', 'reserved-but-idle':'Reserved', 'possibly-stale':'May be stale' };
  const checkpoints = data.checkpoints || [];
  // Terminal claims never represent current work; live work outranks held or queued work.
  const TERMINAL = ['completed','complete','finished','cancelled','superseded','retired'];
  const LIVE_RANK = ['waiting-for-human','blocked','active','working','waiting-on-external-system','held','reserved-but-idle','possibly-stale','queued'];
  const current = list => list.filter(x=>!TERMINAL.includes(String(x.state||'').toLowerCase())).map((x,i)=>({x,i,r:LIVE_RANK.includes(x.state)?LIVE_RANK.indexOf(x.state):LIVE_RANK.length})).sort((a,b)=>Number(Boolean(a.x.lease_expired))-Number(Boolean(b.x.lease_expired))||a.r-b.r||a.i-b.i).map(e=>e.x)[0];
  const first = data.presentation_view==='explorer' ? {} : data.claim || (typeof data.assignment === 'object' ? data.assignment : null) || current(data.claims) || current(data.queue) || current(data.progress) || data.latest?.assignment || checkpoints[0]?.assignment || current(records(data.coordination?.claims)) || data.claims[0] || data.queue[0] || data.progress[0] || {};
  const checkpoint = data.latest || checkpoints[0] || {};
  const technicalNote = text => /[a-f0-9]{24,40}|relay_[a-z_]+|version_id|commit_sha|Worker version|PR #\d+/.test(String(text || ''));
  const human = data.human && typeof data.human==='object' ? data.human : {};
  const compactText = (value, limit=140) => { const text=String(value || '').replace(/\s+/g,' ').trim(); return text.length<=limit?text:text.slice(0,limit-1).replace(/\s+\S*$/,'')+'…'; };
  const jobTitle = item => {
    const explicit=item.title || item.display_name;
    const goal=String(item.goal || '').trim();
    if(explicit)return compactText(explicit,72);
    if(goal && goal.length<=90 && !technicalNote(goal))return goal;
    const id=String(item.id || item.assignment || '').replace(/-20\d{6}(?:-.*)?$/,'').replace(/[-_]+/g,' ').trim();
    return compactText(id || goal || 'untitled job',72);
  };
  const name = id => directory[id] || 'Unassigned staff';
  const attribution = first.staff_attribution && typeof first.staff_attribution==='object' ? first.staff_attribution : data.staff_attribution && typeof data.staff_attribution==='object' ? data.staff_attribution : null;
  const isAssignment = Boolean(first.id || first.assignment) && Boolean(first.owner || first.goal || first.state);
  const unresolvedStaff = attribution ? attribution.status==='unresolved' : isAssignment && !first.primary_staff && !human.responsible_staff;
  const primary = human.responsible_staff?.display_name || attribution?.primary?.display_name || (first.primary_staff ? name(first.primary_staff) : data.primary_staff ? name(data.primary_staff) : unresolvedStaff ? 'Unassigned staff' : 'Relay');
  const roleRef = first.primary_staff || data.primary_staff;
  const primaryRole = human.responsible_staff?.role || attribution?.primary?.role || (typeof roleRef==='string' && options.roles?.[roleRef]) || null;
  const staffNote = unresolvedStaff ? (attribution?.explanation || 'No staff is recorded for this assignment.') : null;
  const supporting = Array.isArray(human.supporting_staff)?human.supporting_staff.map(x=>x?.display_name).filter(Boolean):(Array.isArray(first.supporting_staff)?first.supporting_staff:Array.isArray(data.supporting_staff)?data.supporting_staff:[]).map(name);
  const team = (first.primary_team ? first.primary_team+" · " : "") + primary + (supporting.length ? ' with ' + supporting.join(', ') : '');
  const status = data.ok === false || data.isError ? 'blocked' : first.state || data.state || checkpoint.state || (human.health === 'blocked' ? 'blocked' : 'recorded');
  const error = data.error || data.ok===false || data.isError ? presentation.summary : null;
  const checks = Array.isArray(data.checks?.check_runs) ? records(data.checks.check_runs) : Array.isArray(data.check_runs) ? records(data.check_runs) : null;
  const pr = data.pull_request || (data.number && data.head ? data : null);
  const fullTitle = safePresentationText(first.goal || human.outcome || data.project || data.script || 'Relay update');
  let title = String(fullTitle).length > 90 ? jobTitle(first) : fullTitle;
  let summary = presentation.summary;
  const fullSummary = summary;
  summary = compactText(summary,150);
  let label = presentation.label;
  let tone = presentation.severity==='error'?'bad':presentation.severity==='warning'?'wait':presentation.severity==='success'?'good':presentation.severity==='info'?'info':'quiet';
  const jobs = (data.progress.length?data.progress:data.claims.length?data.claims:data.queue).filter(x=>x&&typeof x==='object'&&!['completed','complete','cancelled','retired','superseded'].includes(x.state));
  const activeJobs = jobs.filter(x=>['active','working'].includes(x.state));
  let rows = (activeJobs.length ? activeJobs : jobs).slice(0,3).map(x=>({label:jobTitle(x), text:formatRelay(normalizeCommunicationResult({claim:x})).label}));
  if (checks) {
    title = 'Verification';
    const checkLabels={success:'Passed',failure:'Failed',timed_out:'Timed out',cancelled:'Cancelled',skipped:'Skipped',neutral:'No pass or fail',action_required:'Action needed',queued:'Queued',in_progress:'Running',completed:'Finished'};
    rows = checks.slice(0,3).map(x=>({label:x.name,text:checkLabels[x.conclusion||x.status]||'Unconfirmed'}));
  }
  // Live CI: test counts come only from reported telemetry and stay separate from job counts;
  // an unreported or partial total is shown as unknown, never estimated.
  const ci = data.ci && typeof data.ci === 'object' && data.ci.schema === 'relay-ci-card/v1' ? data.ci : null;
  let ciView = null;
  if (ci) {
    const n = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    const tests = ci.tests || {}, jobs = ci.jobs || {};
    const elapsed = Number.isFinite(ci.elapsed_ms) ? (ci.elapsed_ms >= 60000 ? Math.floor(ci.elapsed_ms/60000)+'m '+Math.round(ci.elapsed_ms%60000/1000)+'s' : Math.round(ci.elapsed_ms/1000)+'s') : null;
    const state = ci.stale ? 'stale' : ci.status === 'completed' ? (ci.conclusion || 'completed') : ci.status;
    const stateLabel = { queued:'Queued', pending:'Pending', running:'Running', success:'Passed', passed:'Passed', failure:'Failed', failed:'Failed', skipped:'Skipped', blocked:'Blocked', cancelled:'Cancelled', completed:'Finished', stale:'Updates stalled' }[state] || 'Unconfirmed';
    const reported = ci.telemetry === 'reported';
    const testLine = reported ? n(tests.passed)+' passed · '+n(tests.failed)+' failed · '+n(tests.skipped)+' skipped'+(n(tests.todo)?' · '+n(tests.todo)+' todo':'')+(n(tests.cancelled)?' · '+n(tests.cancelled)+' cancelled':'') : 'Not reported by this run';
    const jobLine = n(jobs.passed)+n(jobs.failed)+n(jobs.cancelled)+' of '+n(jobs.total)+' finished'+(n(jobs.failed)?' · '+n(jobs.failed)+' failed':'')+(Array.isArray(jobs.current)&&jobs.current.length?' · now: '+jobs.current.slice(0,2).join(', '):'');
    const ciRows = [{label:'Tests',text:testLine},{label:'Jobs',text:jobLine}];
    if (reported && n(ci.suites_total)) ciRows.push({label:'Suites',text:n(ci.suites_done)+' of '+n(ci.suites_total)+' finished'+(tests.totals_known?'':' · total tests unknown until all finish')});
    if (ci.run?.id) ciRows.push({label:'Run',text:'#'+String(ci.run.id).slice(0,20)+(Number.isSafeInteger(ci.run.attempt)?' · attempt '+ci.run.attempt:'')});
    if (elapsed) ciRows.push({label:'Elapsed',text:elapsed});
    const failures = Array.isArray(ci.failures) ? ci.failures : [];
    for (const failure of failures.slice(0,2)) ciRows.push({label:'Failed test',text:(failure.suite?failure.suite+': ':'')+(failure.name||'unnamed')+(failure.message?' — '+failure.message:'')});
    const failedJob = Array.isArray(ci.failed_jobs) ? ci.failed_jobs[0] : null;
    if (!failures.length && failedJob) ciRows.push({label:'Failed job',text:failedJob.name+(failedJob.annotations?.[0]?.message?' — '+failedJob.annotations[0].message:'')});
    const metric = reported ? (tests.totals_known ? n(tests.passed)+'/'+n(tests.total) : String(n(tests.reported))) : n(jobs.passed)+n(jobs.failed)+n(jobs.cancelled)+'/'+n(jobs.total);
    const metricLabel = reported ? (tests.totals_known ? 'tests passed' : 'tests reported so far') : 'jobs finished';
    const percentDone = reported && Number.isSafeInteger(ci.suites_total) && ci.suites_total>0 && Number.isSafeInteger(ci.suites_done) && ci.suites_done>=0 && ci.suites_done<=ci.suites_total ? Math.round(ci.suites_done/ci.suites_total*100) : null;
    const summaryText = [stateLabel, reported ? testLine : 'test counts not reported', elapsed].filter(Boolean).join(' · ')+(ci.stale?'. The last telemetry update is more than two minutes old.':'');
    ciView = { title:'CI'+(ci.head_sha?' · '+ci.head_sha.slice(0,7):''), label:stateLabel, tone: state==='failure'?'bad':state==='stale'||state==='cancelled'?'wait':state==='success'?'good':'info', rows:ciRows, metric, metric_label:metricLabel, percent:percentDone, summary:summaryText,
      blocker: state==='failure' ? (n(tests.failed) ? n(tests.failed)+' test'+(n(tests.failed)===1?'':'s')+' failed.' : 'A CI job failed.') : null,
      next_step: state==='failure' && (ci.run?.url || failedJob?.url) ? 'Open the failing run for full logs.' : null };
  }
  if (pr) { title=safePresentationText(pr.title)||'Source change'; }
  const blocker = error ? null : (first.waiting_reason ? safePresentationText(first.waiting_reason,12000) : null);
  const rawQa = human.qa || checkpoint.qa_context || data.qa || null;
  const qa = rawQa&&typeof rawQa==='object'?{intended_result:safePresentationText(rawQa.intended_result),reason:safePresentationText(rawQa.reason),...(Array.isArray(rawQa.checks)?{checks:rawQa.checks.slice(0,5).map(x=>safePresentationText(x))}:{})}:null;
  const handoff = data.action === 'handoff' ? 'The assignment was transferred.' : safePresentationText(data.handoff?.summary)||null;
  const identities = first.identities || checkpoint.identities || data.identities || {};
  const evidence = { assignment:first.id || first.assignment || (typeof data.assignment==='string'?data.assignment:null), owner:first.owner, branch:first.branch || identities.branch, head_sha:identities.head_sha || identities.pr_head_sha || pr?.head?.sha, pr:pr?.number || identities.pr, merge_commit_sha:pr?.merged===true?pr.merge_commit_sha:identities.merge_commit_sha, version_id:data.version_id, deployment_id:data.deployment?.id, evidence_id:data.evidence_id || data.evidence?.evidence_id, record_sha:data.record_sha, goal:first.goal || fullTitle, summary:fullSummary, next_action:first.next_action || checkpoint.next_action || human.next_step || null, blocker:first.waiting_reason || null, presentation:normalized.message_id, error_class:data.error?.class, ...(normalized.message_id==='error.admission'?{admission_findings:normalized.technical.admission_findings}:{}), retry_not_before:normalized.retry.not_before };
  const normalize = value => String(value || '').trim().replace(/\s+/g,' ').toLowerCase();
  const rawNext = human.next_step || first.next_action || checkpoint.next_action || null;
  const terminal = ['completed','complete','finished','cancelled','superseded'].includes(String(status).toLowerCase());
  const safeNext=safePresentationText(typeof rawNext==='string'?rawNext:'',2000);
  const opaqueIdentity=/\b[a-f0-9]{24,40}\b|\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b/i.test(safeNext);
  let nextStep = presentation.next_step || (terminal || error ? null : safeNext ? (safeNext.length<=140&&!opaqueIdentity&&!technicalNote(safeNext)?safeNext:'Read the next step below.') : null);
  if (nextStep && !presentation.next_step && (normalize(rawNext)===normalize(first.goal) || normalize(rawNext) === normalize(first.next_action||checkpoint.next_action)&&normalize(rawNext)===normalize(human.what_changed) || normalize(rawNext) === normalize(fullSummary) || normalize(nextStep) === normalize(summary) || normalize(summary).includes(normalize(nextStep)))) nextStep = null;
  if (rows.length === 1 && rows[0].label === primary && normalize(rows[0].text) === normalize(label)) rows = [];
  const primaryTeam = first.primary_team || data.primary_team || (checks ? 'inspector' : pr ? 'source' : 'relay');
  const feature = ['relay','runner','inspector','night-shift','source','cloud','release','skills'].includes(primaryTeam) ? primaryTeam : 'relay';
  const signal = tone === 'bad' ? 'danger' : tone === 'wait' ? 'external' : tone === 'info' ? 'working' : tone === 'good' ? 'steady' : 'quiet';
  const plan = assignmentCardSteps(first);
  const identity = cardIdentity({...first,staff_attribution:attribution},plan,ci?'inspector':feature);
  // Only an explicit complete plan has a denominator. A routing assignment or
  // arbitrary progress_percent is not evidence of completed work.
  const allVerified=plan.total>0&&plan.passed===plan.total;
  const objectiveVerified=allVerified&&['completed','complete','finished'].includes(status);
  const percent = plan.total && (!allVerified||objectiveVerified) ? Math.floor(plan.passed/plan.total*100) : null;
  let metric = percent != null ? percent+'%' : label;
  let metric_label = percent != null ? 'completion' : 'current state';

  if (checks) { const done=checks.filter(x=>x.status==='completed').length; metric=checks.length ? done+'/'+checks.length : label; metric_label=checks.length ? 'checks reported' : 'verification'; }
  if (pr?.number) { metric='#'+pr.number; metric_label=pr.merged?'merged pull request':pr.draft?'draft pull request':'pull request'; }
  // Keep uncertainty/deadlines intact instead of clipping the only explanation.
  summary=presentation.summary;
  const has_metric=percent!==null||Boolean(checks?.length)||Boolean(pr?.number);
  const card = { snapshot:data.snapshot||null,card_mode:data.card_mode||'current',objective_verified:objectiveVerified,title:safePresentationText(title), feature, primary_staff:safePresentationText(primary), primary_role:primaryRole?safePresentationText(primaryRole,60):null, staff_unresolved:unresolvedStaff, staff_note:staffNote?safePresentationText(staffNote,200):null, team:safePresentationText(team), label, tone, signal, summary, rows:rows.map(row=>({label:safePresentationText(row.label,100),text:safePresentationText(row.text,100)})), blocker, qa, handoff, next_step:nextStep, metric, metric_label, has_metric, percent, evidence:Object.fromEntries(Object.entries(evidence).filter(([,v])=>['string','number','boolean'].includes(typeof v)).map(([key,value])=>[key,typeof value==='string'?safePresentationText(value,12000):value])), refresh:Boolean(data.project), human_v1:presentation };
  if(data.snapshot){card.evidence.snapshot_id=data.snapshot.id;card.evidence.snapshot_as_of=data.snapshot.as_of;card.evidence.plan_revision=plan.revision;card.evidence.snapshot_record_sha=data.snapshot.payload.record_sha||'unavailable';card.evidence.next_snapshot_due=data.snapshot.due?.due_at||'unknown';card.evidence.snapshot_delivery='unknown';}
  const milestone = data.work_card?.milestone && typeof data.work_card.milestone === 'object' ? data.work_card.milestone : null;
  const updates=assignmentCardUpdates(first).map(update=>({...update,person:cardStaff(update.owner?.staff)}));
  const operation=String(data.work_card?.tool||data.presentation_operation?.name||'');
  // An update count is history, not the identity of the card. Only an explicitly
  // selected, assignment-bound message may use the individual presentation.
  const individual=data.presentation_view==='individual'&&typeof data.presentation_update_id==='string'
    ? updates.find(update=>update.id===data.presentation_update_id) : null;
  const assignmentContext=isAssignment||Boolean(identity.lead)||Boolean(first.goal);
  Object.assign(card,{updates,updates_truncated:first.card_updates?.truncated===true,product:ci||checks?'inspector':operation==='relay_night_shift'?'night-shift':operation.startsWith('relay_runner_')||operation==='relay_execution'?'runner':operation.startsWith('relay_verify_')?'inspector':'relay',plan,identity,project:typeof data.project==='string'?safePresentationText(data.project,80):null,project_icon:cardProjectIcon(data.project_icon,data.project),project_label:safePresentationText(data.project_icon?.project===data.project?data.project_icon?.name:null,80)||data.project});
  card.family=data.presentation_view==='explorer'?'explorer':individual?'single':assignmentContext?'assignment':'product';
  if(individual)card.updates=[individual];
  if(identity.speaker){card.primary_staff=identity.speaker.name;card.primary_role=identity.speaker.role;card.staff_unresolved=false;card.staff_note=null;}
  if(identity.team!=='relay')card.feature=identity.team;
  if(plan.steps.length){card.metric=plan.passed+'/'+(plan.total??'?');card.metric_label='steps verified';card.has_metric=plan.total!==null;card.rows=[];}
  if (ciView) {
    const ciSignal = ciView.tone==='bad'?'danger':ciView.tone==='wait'?'external':ciView.tone==='good'?'steady':'working';
    Object.assign(card, { title:safePresentationText(ciView.title), feature:'inspector', label:ciView.label, tone:ciView.tone, signal:ciSignal, summary:safePresentationText(ciView.summary,400), rows:ciView.rows.slice(0,6).map(row=>({label:safePresentationText(row.label,100),text:safePresentationText(row.text,160)})), blocker:ciView.blocker, next_step:ciView.next_step, metric:ciView.metric, metric_label:ciView.metric_label, percent:ciView.percent, has_metric:true, ci:{status:ci.status, conclusion:ci.conclusion, stale:Boolean(ci.stale), live:Boolean(ci.live), telemetry:ci.telemetry} });
    for (const [key,value] of [['ci_run_id',ci.run?.id],['ci_run_url',ci.run?.url],['ci_attempt',ci.run?.attempt],['head_sha',ci.head_sha],['ci_observed_at',ci.observed_at],['ci_telemetry_updated_at',ci.telemetry_updated_at]]) if (['string','number'].includes(typeof value)) card.evidence[key]=typeof value==='string'?safePresentationText(value,300):value;
    const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
    const states={not_run:'pending',running:'running',passed:'passed',failed:'failed',cancelled:'cancelled',timed_out:'failed',blocked:'blocked',start_failed:'failed',signalled:'failed',skipped:'skipped'};
    card.ci.tests={passed:count(ci.tests?.passed),failed:count(ci.tests?.failed),skipped:count(ci.tests?.skipped),reported:count(ci.tests?.reported),total:ci.tests?.totals_known?count(ci.tests?.total):null,totals_known:ci.tests?.totals_known===true};
    card.ci.suites_done=count(ci.suites_done);card.ci.suites_total=count(ci.suites_total);
    card.ci.suites=records(ci.suites).slice(0,12).map(s=>({id:s.key||s.id,label:s.id,state:states[s.status]||'unknown',status:s.status}));
    card.ci.elapsed=Number.isFinite(ci.elapsed_ms)?Math.max(0,ci.elapsed_ms):null;
    card.ci.failures=records(ci.failures).slice(0,20).map(f=>({suite:safePresentationText(f.suite,200),name:safePresentationText(f.name,2000),message:safePresentationText(f.message,12000)}));
    card.ci.failed_jobs=records(ci.failed_jobs).slice(0,20).map(j=>({name:safePresentationText(j.name,2000),messages:records(j.annotations).map(a=>safePresentationText(a.message,12000))}));
    card.metric=card.ci.suites_total!==null?(card.ci.suites_done===null?'—':String(card.ci.suites_done)):ciView.metric;
    card.metric_label=card.ci.suites_total!==null?'of '+card.ci.suites_total+' suites finished':ciView.metric_label;
    card.title=ci.conclusion==='success'?'The checks passed':ci.conclusion==='failure'?'A check needs attention':ci.conclusion==='cancelled'?'The run was cancelled':ci.status==='queued'?'Checks are queued':'Checking the build';
    card.summary=ci.stale?'The last update is more than two minutes old.':ci.conclusion==='failure'?'A check needs attention. The reported results are below.':ci.conclusion==='success'?'The reported checks passed.':ci.conclusion==='cancelled'?'This run was cancelled. Reported results are preserved.':ci.status==='queued'?'Waiting for the run to start.':'Checks are running. Results update as suites report.';
    card.rows=[];
  } else if (!checks && !pr) {
    const currentStep=plan.steps.find(step=>step.id===plan.current&&step.receipt);
    if(currentStep){
      card.evidence.assignment_state=status;
      card.evidence.current_step=currentStep.id;
      card.evidence.current_step_state=currentStep.state;
      // Observed step state outranks routing status, never terminal/held authority
      // or an error reading the current assignment. Unknown stays unknown.
      const stepStatus=currentStep.receipt.phase==='awaiting-verification'?['Awaiting verification','wait','external','The specialist finished this step. Its result still needs verification.']:{running:['Running','info','working','This step is running.'],failed:['Step failed','bad','danger','This step failed. The recorded evidence is below.'],blocked:['Step blocked','wait','external','This step is blocked. The recorded evidence is below.'],stale:['Update needed','wait','external','This step needs a fresh update. Showing the last recorded evidence.']}[currentStep.state];
      if(stepStatus&&!terminal&&status!=='held'&&!error){const [label,tone,signal,summary]=stepStatus;Object.assign(card,{label,tone,signal,summary});}
    }
    // Ordinary outcomes have one state and cause, never a numeric jobs hero.
    card.rows=[];
    card.ordinary=isAssignment&&!plan.steps.length;
    if(card.ordinary&&card.blocker)card.summary=null;
    if(!plan.steps.length){card.has_metric=false;card.metric=null;card.metric_label=null;}
  }
  if(!ci && isAssignment && ['officially-stale','possibly-stale'].includes(status) && !plan.current){
    card.label='Waiting for a work update';
    const at=Number.isFinite(Date.parse(first.last_meaningful_progress_at))?first.last_meaningful_progress_at:null;
    card.summary=(first.worker?.freshness==='fresh'?'Worker connected. ':'')+(at?'Last recorded progress: '+new Date(at).toISOString().slice(11,16)+' UTC.':'No progress evidence recorded yet.');
    card.evidence.progress_clock='Commit, pull-request, check and deployment activity. Worker check-ins show liveness, not verified progress.';
  }
  for(const [key,value] of Object.entries({checked_at:data.generated_at||data.checked_at,progress_observed_at:first.last_meaningful_progress_at,worker_heartbeat_at:first.worker?.heartbeat_at,progress_freshness:first.progress_freshness}))if(typeof value==='string')card.evidence[key]=safePresentationText(value,100);
  const link = ci && [ci.run?.url, ci.failed_jobs?.[0]?.url].find(url => typeof url === 'string' && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+[\w/.-]*$/.test(url));
  if (link) card.ci_link = link;
  if (milestone?.kind) card.milestone = { kind:safePresentationText(milestone.kind,40), label:safePresentationText(milestone.label,100) };
  return card;
}

// Only bounded inline bytes from a matching server projection can enter an img.
export function cardProjectIcon(value,project){
 const i=value?.icon;
 if(!value||value.project!==project||value.status!=='found'||!i||!Number.isInteger(i.bytes)||i.bytes<1||i.bytes>262144||!/^[a-f0-9]{64}$/.test(i.sha256||'')||!/^[a-f0-9]{40}$/.test(i.blob_sha||'')||typeof i.data_url!=='string'||i.data_url.length>350000||!/^data:image\/(?:png|svg\+xml|x-icon|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(i.data_url))return null;
 return {data_url:i.data_url,sha256:i.sha256,path:i.path,repository:i.repository};
}
