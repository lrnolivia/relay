import { workspaceLink } from './workspace-links.js';
import {projectInGroup} from "./project-groups.js";
import { activityTime, workRevision } from './work-activity.js';
export const reviewStates = ['pending', 'completed', 'stale'];
export const reviewFilters = ['pending', 'completed', 'stale', 'archived', 'all'];
export const reviewKey = item => [item.project, item.kind, item.id].map(encodeURIComponent).join('/');
export async function sourceRevision(source) {
  const bytes = new TextEncoder().encode(workRevision(source));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function effectiveReview(item, record) {
  if (!record || record.source_revision !== item.revision) return { status:'pending', archived:false };
  return { status:reviewStates.includes(record.status)?record.status:'pending', archived:record.archived===true };
}
export function priorityValue(value) {
  // Provider-specific P0/P1 values have no universal meaning.
  return ({critical:4,high:3,normal:2,low:1})[String(value || '').toLowerCase()] ?? null;
}
export function selectWork(items, {project='',filter='pending',search='',sort='time',direction='desc',extensions={}}={}, records={}, predicates={}) {
  const query=search.trim().toLocaleLowerCase();
  const selected=items.filter(item=>{
    if(!projectInGroup(item.project,project)) return false;
    const review=effectiveReview(item,records[reviewKey(item)]);
    if(filter==='archived' ? !review.archived : filter!=='all' && (review.archived || review.status!==filter)) return false;
    if(query && ![item.title,item.detail,item.next,item.project].join(' ').toLocaleLowerCase().includes(query)) return false;
    return Object.entries(extensions).every(([key,value])=>!value || !predicates[key] || predicates[key](item,value));
  });
  const compareValue=(a,b,dir)=>a==null?(b==null?0:1):b==null?-1:(a-b)*(dir==='asc'?1:-1);
  return selected.sort((a,b)=>{
    const order=sort==='importance'?compareValue(priorityValue(a.priority),priorityValue(b.priority),direction):compareValue(a.time,b.time,direction);
    return order || compareValue(a.time,b.time,'desc') || reviewKey(a).localeCompare(reviewKey(b));
  });
}
export function bulkTargets(items, visible, selection, scope) {
  const keys=new Set(scope==='selected'?selection:visible.map(reviewKey));
  // Scope expansion is explicit in the query; never silently bypass its other filters.
  return items.filter(item=>keys.has(reviewKey(item)));
}
export function reviewTransition(previous, action) {
  const old={status:reviewStates.includes(previous?.status)?previous.status:'pending',archived:previous?.archived===true};
  if(action==='archive') return {...old,archived:true};
  if(action==='restore') return {...old,archived:false};
  if(reviewStates.includes(action)) return {...old,status:action,archived:false};
  throw new Error('Unknown review action.');
}
export async function assignmentItem(project, source) {
  return {project,kind:'assignment',id:source.assignment,title:source.goal || source.assignment.replace(/[-_]+/g,' '),
    detail:source.waiting_reason || source.recovery_action || '',next:source.next_action || 'Open details to assess',sourceState:source.state || 'not reported',
    time:activityTime(source),priority:source.priority || null,revision:await sourceRevision(source),
    href:workspaceLink('/#/runner/'+encodeURIComponent(project)+'/'+encodeURIComponent(source.assignment)+'?project='+encodeURIComponent(project)),source};
}
export async function evidenceItem(source) {
  return {project:source.context?.project || 'review',kind:'evidence',id:source.evidence_id,title:source.step_label || source.context?.surface || 'Screen review',
    detail:source.context?.environment || 'capture',next:'Review this capture',sourceState:'captured',time:activityTime(source),priority:source.priority || null,
    revision:await sourceRevision(source),screenshot:source.screenshot_url,source};
}

export function workerSource(worker) {
 return {assignment:worker.id,goal:worker.name || worker.id,state:worker.runtime?.status,
   next_action:worker.runtime?.last_summary,waiting_reason:worker.runtime?.last_error,
   latest_event:{at:worker.runtime?.last_run_at},last_meaningful_progress_at:worker.runtime?.last_run_at};
}
export async function checkItem(worker) {
 const item=await assignmentItem(worker.id,workerSource(worker));
 return {...item,kind:'check',next:worker.runtime?.last_error?'Review the reported check problem':'Review the latest automatic result',href:workspaceLink('/#/night-shift?project='+encodeURIComponent(worker.id)+'&item='+encodeURIComponent(worker.id))};
}
