import { normalizeCommunicationResult, formatRelay, safePresentationText } from './human-presentation.js';
import { legacyContextCardModel } from './relay-context-card-legacy-model.js';

export function contextCardModel(data = {}, directory = {}, options = {}) {
  if(data?.presentation_mode==='legacy')return legacyContextCardModel(data,directory);
  if(!data||typeof data!=='object'||Array.isArray(data))data={};
  data={...data};
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
  const first = data.claim || (typeof data.assignment === 'object' ? data.assignment : null) || current(data.claims) || current(data.queue) || current(data.progress) || data.latest?.assignment || checkpoints[0]?.assignment || current(records(data.coordination?.claims)) || data.claims[0] || data.queue[0] || data.progress[0] || {};
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
    const stateLabel = { queued:'Queued', running:'Running', success:'Passed', failure:'Failed', cancelled:'Cancelled', completed:'Finished', stale:'Updates stalled' }[state] || 'Unconfirmed';
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
    const percentDone = reported && n(ci.suites_total) ? Math.round(n(ci.suites_done)/n(ci.suites_total)*100) : null;
    const summaryText = [stateLabel, reported ? testLine : 'test counts not reported', elapsed].filter(Boolean).join(' · ')+(ci.stale?'. The last telemetry update is more than two minutes old.':'');
    ciView = { title:'CI'+(ci.head_sha?' · '+ci.head_sha.slice(0,7):''), label:stateLabel, tone: state==='failure'?'bad':state==='stale'||state==='cancelled'?'wait':state==='success'?'good':'info', rows:ciRows, metric, metric_label:metricLabel, percent:percentDone, summary:summaryText,
      blocker: state==='failure' ? (n(tests.failed) ? n(tests.failed)+' test'+(n(tests.failed)===1?'':'s')+' failed.' : 'A CI job failed.') : null,
      next_step: state==='failure' && (ci.run?.url || failedJob?.url) ? 'Open the failing run for full logs.' : null };
  }
  if (pr) { title=safePresentationText(pr.title)||'Source change'; }
  const blocker = error ? null : (status==='blocked' ? safePresentationText(first.waiting_reason) || null : null);
  const rawQa = human.qa || checkpoint.qa_context || data.qa || null;
  const qa = rawQa&&typeof rawQa==='object'?{intended_result:safePresentationText(rawQa.intended_result),reason:safePresentationText(rawQa.reason),...(Array.isArray(rawQa.checks)?{checks:rawQa.checks.slice(0,5).map(x=>safePresentationText(x))}:{})}:null;
  const handoff = data.action === 'handoff' ? 'The assignment was transferred.' : safePresentationText(data.handoff?.summary)||null;
  const identities = first.identities || checkpoint.identities || data.identities || {};
  const evidence = { assignment:first.id || first.assignment || (typeof data.assignment==='string'?data.assignment:null), owner:first.owner, branch:first.branch || identities.branch, head_sha:identities.head_sha || identities.pr_head_sha || pr?.head?.sha, pr:pr?.number || identities.pr, merge_commit_sha:pr?.merged===true?pr.merge_commit_sha:identities.merge_commit_sha, version_id:data.version_id, deployment_id:data.deployment?.id, evidence_id:data.evidence_id || data.evidence?.evidence_id, record_sha:data.record_sha, goal:first.goal || fullTitle, summary:fullSummary, next_action:first.next_action || checkpoint.next_action || null, presentation:normalized.message_id, error_class:data.error?.class, ...(normalized.message_id==='error.admission'?{admission_findings:normalized.technical.admission_findings}:{}), retry_not_before:normalized.retry.not_before };
  const normalize = value => String(value || '').trim().replace(/\s+/g,' ').toLowerCase();
  const rawNext = human.next_step || first.next_action || checkpoint.next_action || null;
  const terminal = ['completed','complete','finished','cancelled','superseded'].includes(String(status).toLowerCase());
  const safeNext=safePresentationText(typeof rawNext==='string'?rawNext:'',2000);
  const opaqueIdentity=/\b[a-f0-9]{24,40}\b|\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b/i.test(safeNext);
  let nextStep = presentation.next_step || (terminal || error ? null : safeNext ? (safeNext.length<=240&&!opaqueIdentity?safeNext:'The full next step is in Technical details.') : null);
  if (nextStep && !presentation.next_step && (normalize(rawNext)===normalize(first.goal) || normalize(rawNext) === normalize(first.next_action||checkpoint.next_action)&&normalize(rawNext)===normalize(human.what_changed) || normalize(rawNext) === normalize(fullSummary) || normalize(nextStep) === normalize(summary) || normalize(summary).includes(normalize(nextStep)))) nextStep = null;
  if (rows.length === 1 && rows[0].label === primary && normalize(rows[0].text) === normalize(label)) rows = [];
  const primaryTeam = first.primary_team || data.primary_team || (checks ? 'inspector' : pr ? 'source' : 'relay');
  const feature = ['relay','runner','inspector','night-shift','source','cloud','release','skills'].includes(primaryTeam) ? primaryTeam : 'relay';
  const signal = tone === 'bad' ? 'danger' : tone === 'wait' ? 'external' : tone === 'info' ? 'working' : tone === 'good' ? 'steady' : 'quiet';
  const rawPercent = first.progress_percent ?? first.percent ?? first.completion?.percent ?? data.progress_percent ?? null;
  const hasPercent = typeof rawPercent === 'number' || typeof rawPercent === 'string' && rawPercent.trim() !== '';
  const percent = hasPercent && Number.isFinite(Number(rawPercent)) && Number(rawPercent) >= 0 && Number(rawPercent) <= 100 ? Math.round(Number(rawPercent)) : null;
  let metric = percent != null ? percent+'%' : label;
  let metric_label = percent != null ? 'completion' : 'current state';
  if (!checks && !pr && jobs.length && percent == null) { metric=String(data.coverage?.active ?? activeJobs.length); metric_label='active jobs'; }
  if (checks) { const done=checks.filter(x=>x.status==='completed').length; metric=checks.length ? done+'/'+checks.length : label; metric_label=checks.length ? 'checks reported' : 'verification'; }
  if (pr?.number) { metric='#'+pr.number; metric_label=pr.merged?'merged pull request':pr.draft?'draft pull request':'pull request'; }
  // Keep uncertainty/deadlines intact instead of clipping the only explanation.
  summary=presentation.summary;
  const has_metric=percent!==null||Boolean(checks?.length)||Boolean(pr?.number)||(!checks&&!pr&&jobs.length>0);
  const card = { title:safePresentationText(title), feature, primary_staff:safePresentationText(primary), primary_role:primaryRole?safePresentationText(primaryRole,60):null, staff_unresolved:unresolvedStaff, staff_note:staffNote?safePresentationText(staffNote,200):null, team:safePresentationText(team), label, tone, signal, summary, rows:rows.map(row=>({label:safePresentationText(row.label,100),text:safePresentationText(row.text,100)})), blocker, qa, handoff, next_step:nextStep, metric, metric_label, has_metric, percent, evidence:Object.fromEntries(Object.entries(evidence).filter(([,v])=>['string','number','boolean'].includes(typeof v)).map(([key,value])=>[key,typeof value==='string'?safePresentationText(value,2000):value])), refresh:Boolean(data.project), human_v1:presentation };
  const milestone = data.work_card?.milestone && typeof data.work_card.milestone === 'object' ? data.work_card.milestone : null;
  if (ciView) {
    const ciSignal = ciView.tone==='bad'?'danger':ciView.tone==='wait'?'external':ciView.tone==='good'?'steady':'working';
    Object.assign(card, { title:safePresentationText(ciView.title), feature:'inspector', label:ciView.label, tone:ciView.tone, signal:ciSignal, summary:safePresentationText(ciView.summary,400), rows:ciView.rows.slice(0,6).map(row=>({label:safePresentationText(row.label,100),text:safePresentationText(row.text,160)})), blocker:ciView.blocker, next_step:ciView.next_step, metric:ciView.metric, metric_label:ciView.metric_label, percent:ciView.percent, has_metric:true, ci:{status:ci.status, conclusion:ci.conclusion, stale:Boolean(ci.stale), live:Boolean(ci.live), telemetry:ci.telemetry} });
    for (const [key,value] of [['ci_run_id',ci.run?.id],['ci_run_url',ci.run?.url],['ci_attempt',ci.run?.attempt],['head_sha',ci.head_sha],['ci_observed_at',ci.observed_at],['ci_telemetry_updated_at',ci.telemetry_updated_at]]) if (['string','number'].includes(typeof value)) card.evidence[key]=typeof value==='string'?safePresentationText(value,300):value;
  } else if (milestone?.label) {
    card.rows = [{label:'This step',text:safePresentationText(milestone.label,100)}, ...card.rows].slice(0,4);
  }
  const link = ci && [ci.run?.url, ci.failed_jobs?.[0]?.url].find(url => typeof url === 'string' && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+[\w/.-]*$/.test(url));
  if (link) card.ci_link = link;
  if (milestone?.kind) card.milestone = { kind:safePresentationText(milestone.kind,40), label:safePresentationText(milestone.label,100) };
  return card;
}
