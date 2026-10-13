// Preserved f19f48d4 renderer for the explicit presentation-only rollback switch.
export function legacyContextCardModel(data = {}, directory = {}) {
  const states = { active:'Active', working:'Working', queued:'Up next', held:'On hold', completed:'Finished', complete:'Finished', blocked:'Blocked', failed:'Failed', 'waiting-for-human':'Needs your review', 'waiting-on-external-system':'Waiting on system', 'reserved-but-idle':'Reserved', 'possibly-stale':'May be stale' };
  const checkpoints = data.checkpoints || [];
  const first = data.claim || (typeof data.assignment === 'object' ? data.assignment : null) || data.claims?.find(x=>x.state!=='completed') || data.claims?.[0] || data.queue?.[0] || data.progress?.[0] || data.latest?.assignment || checkpoints[0]?.assignment || data.coordination?.claims?.find(x=>x.state!=='completed') || {};
  const checkpoint = data.latest || checkpoints[0] || {};
  const technicalNote = text => /[a-f0-9]{24,40}|relay_[a-z_]+|version_id|commit_sha|Worker version|PR #\d+/.test(String(text || ''));
  const human = data.human || {};
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
  const supporting = human.supporting_staff?.map(x=>x.display_name) || (first.supporting_staff || data.supporting_staff || []).map(name);
  const team = (first.primary_team ? first.primary_team+" · " : "") + primary + (supporting.length ? ' with ' + supporting.join(', ') : '');
  const status = data.ok === false || data.isError ? 'blocked' : first.state || data.state || checkpoint.state || (human.health === 'blocked' ? 'blocked' : 'recorded');
  const error = typeof data.error === 'string' ? data.error : data.error?.message;
  const checks = Array.isArray(data.checks?.check_runs) ? data.checks.check_runs : Array.isArray(data.check_runs) ? data.check_runs : null;
  const pr = data.pull_request || (data.number && data.head ? data : null);
  const fullTitle = human.outcome || first.goal || data.project || data.script || 'Relay update';
  let title = String(fullTitle).length > 90 ? jobTitle(first) : fullTitle;
  let summary = human.what_changed || error || first.waiting_reason || data.message || first.next_action || checkpoint.next_action || 'Exact Relay result recorded.';
  if (technicalNote(summary) && !error && !first.waiting_reason) summary = checkpoint.identities?.merge_commit_sha ? 'The source change is merged. The next verification gate is ready.' : 'Canonical work state is available. Exact source and runtime details are recorded below.';
  const fullSummary = summary;
  summary = compactText(summary,150);
  let label = states[status] || status;
  let tone = ['blocked','failed','officially-stale'].includes(status) ? 'bad' : status.includes('wait') || status === 'held' ? 'wait' : ['active','working'].includes(status) ? 'info' : ['completed','complete'].includes(status) ? 'good' : 'quiet';
  const jobs = (data.progress || data.claims || data.queue || []).filter(x=>!['completed','complete','cancelled','retired','superseded'].includes(x.state));
  const activeJobs = jobs.filter(x=>['active','working'].includes(x.state));
  let rows = (activeJobs.length ? activeJobs : jobs).slice(0,3).map(x=>({label:jobTitle(x), text:states[x.state] || x.state || 'Recorded'}));
  if (checks) {
    const failed = checks.find(x=>x.status==='completed' && !['success','neutral','skipped'].includes(x.conclusion));
    const running = checks.find(x=>x.status!=='completed');
    title = 'Verification'; label = failed ? 'Failed' : running ? 'Running' : checks.length ? 'Checks complete' : 'No checks recorded'; tone=failed?'bad':running?'info':checks.length?'good':'quiet';
    summary = failed ? failed.name+' failed.' : running ? running.name+' is running.' : checks.length ? 'Recorded checks are complete.' : 'Verification is unconfirmed.';
    rows = checks.slice(0,3).map(x=>({label:x.name,text:x.conclusion||x.status}));
  }
  if (pr) { title=pr.title||'Source change'; label=pr.merged?'Merged':pr.draft?'Draft':'In review'; tone=pr.merged?'good':pr.draft?'quiet':'info'; summary=pr.merged?'The source change is merged.':'The source change is awaiting its next gate.'; }
  const blocker = human.blocker || error || (status==='blocked' ? first.waiting_reason || 'The next gate needs attention.' : null);
  const qa = human.qa || checkpoint.qa_context || data.qa || null;
  const handoff = data.action === 'handoff' ? 'Ownership handed to '+(data.claim?.owner || 'the recorded successor')+'.' : data.handoff?.summary || null;
  const identities = first.identities || checkpoint.identities || data.identities || {};
  const evidence = { assignment:first.id || first.assignment || (typeof data.assignment==='string'?data.assignment:null), owner:first.owner, branch:first.branch || identities.branch, head_sha:identities.head_sha || identities.pr_head_sha || pr?.head?.sha, pr:pr?.number || identities.pr, merge_commit_sha:pr?.merge_commit_sha || identities.merge_commit_sha, version_id:data.version_id, deployment_id:data.deployment?.id, evidence_id:data.evidence_id || data.evidence?.evidence_id, record_sha:data.record_sha, goal:first.goal || fullTitle, summary:fullSummary, next_action:first.next_action || checkpoint.next_action || null };
  const normalize = value => String(value || '').trim().replace(/\s+/g,' ').toLowerCase();
  const rawNext = human.next_step || first.next_action || checkpoint.next_action || null;
  const terminal = ['completed','complete','finished'].includes(String(status).toLowerCase()) || Boolean(pr?.merged);
  let nextStep = terminal ? null : technicalNote(rawNext) ? 'Verify the refreshed chat connection before continuing.' : compactText(rawNext,120);
  if (nextStep && (normalize(rawNext) === normalize(fullSummary) || normalize(nextStep) === normalize(summary) || normalize(summary).includes(normalize(nextStep)))) nextStep = null;
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
  return { title, feature, primary_staff:primary, team, label, tone, signal, summary, rows, blocker, qa, handoff, next_step:nextStep, metric, metric_label, percent, evidence:Object.fromEntries(Object.entries(evidence).filter(([,v])=>v!=null)), refresh:Boolean(data.project) };
}
