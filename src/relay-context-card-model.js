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
  const first = data.claim || (typeof data.assignment === 'object' ? data.assignment : null) || data.claims.find(x=>x.state!=='completed') || data.claims[0] || data.queue[0] || data.progress[0] || data.latest?.assignment || checkpoints[0]?.assignment || records(data.coordination?.claims).find(x=>x.state!=='completed') || {};
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
  const primary = human.responsible_staff?.display_name || (first.primary_staff ? name(first.primary_staff) : data.primary_staff ? name(data.primary_staff) : 'Relay');
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
  if (pr) { title=safePresentationText(pr.title)||'Source change'; }
  const blocker = error || (status==='blocked' ? safePresentationText(first.waiting_reason) || presentation.summary : null);
  const rawQa = human.qa || checkpoint.qa_context || data.qa || null;
  const qa = rawQa&&typeof rawQa==='object'?{intended_result:safePresentationText(rawQa.intended_result),reason:safePresentationText(rawQa.reason),...(Array.isArray(rawQa.checks)?{checks:rawQa.checks.slice(0,5).map(x=>safePresentationText(x))}:{})}:null;
  const handoff = data.action === 'handoff' ? 'The assignment was transferred.' : safePresentationText(data.handoff?.summary)||null;
  const identities = first.identities || checkpoint.identities || data.identities || {};
  const evidence = { assignment:first.id || first.assignment || (typeof data.assignment==='string'?data.assignment:null), owner:first.owner, branch:first.branch || identities.branch, head_sha:identities.head_sha || identities.pr_head_sha || pr?.head?.sha, pr:pr?.number || identities.pr, merge_commit_sha:pr?.merged===true?pr.merge_commit_sha:identities.merge_commit_sha, version_id:data.version_id, deployment_id:data.deployment?.id, evidence_id:data.evidence_id || data.evidence?.evidence_id, record_sha:data.record_sha, goal:first.goal || fullTitle, summary:fullSummary, next_action:first.next_action || checkpoint.next_action || null, presentation:normalized.message_id, error_class:data.error?.class, retry_not_before:normalized.retry.not_before };
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
  return { title:safePresentationText(title), feature, primary_staff:safePresentationText(primary), team:safePresentationText(team), label, tone, signal, summary, rows:rows.map(row=>({label:safePresentationText(row.label,100),text:safePresentationText(row.text,100)})), blocker, qa, handoff, next_step:nextStep, metric, metric_label, percent, evidence:Object.fromEntries(Object.entries(evidence).filter(([,v])=>['string','number','boolean'].includes(typeof v)).map(([key,value])=>[key,typeof value==='string'?safePresentationText(value,2000):value])), refresh:Boolean(data.project), human_v1:presentation };
}
