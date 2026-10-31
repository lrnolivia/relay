import { STAFF } from './staff-registry.js';

export const CARD_TEAMS = Object.freeze({
  runner:'Engineering', inspector:'Design & QA', 'night-shift':'Planning & Research',
  source:'Integrations', cloud:'Reliability', release:'Release', skills:'Knowledge'
});
export function cardStaff(id) {
  const person = STAFF.find(p=>p.id===id && p.status!=='retired');
  return person ? {id:person.id,name:person.display_name,role:person.role.title.replace(/^The /,''),status:person.status,team:person.home_team} : null;
}
export function cardIdentity(record = {}, plan = {}, fallbackTeam = 'relay') {
  const lead = cardStaff(record.primary_staff || record.staff_attribution?.primary?.id);
  const current = plan.steps?.find(s=>s.id===plan.current && s.receipt);
  const owner = current?.owner;
  const currentOwner = cardStaff(owner?.staff);
  // Routing identifies the assigned lead, not the performer. An explicit
  // team-only current receipt must not be relabeled as that person's work.
  const speaker = currentOwner || (current ? null : lead);
  const stepTeam = Object.hasOwn(CARD_TEAMS,owner?.team) ? owner.team : null;
  const assignmentTeam = Object.hasOwn(CARD_TEAMS,record.primary_team) ? record.primary_team : null;
  // A person's emblem and accent describe their canonical identity. A receipt
  // may place their current work in another team; expose that separately.
  const team = speaker?.team || stepTeam || assignmentTeam || fallbackTeam;
  const support = (Array.isArray(record.supporting_staff)?record.supporting_staff:[]).map(cardStaff).filter(p=>p&&p.id!==lead?.id);
  // A lead may introduce a status card, but its label must never say they did
  // the work unless the current step's own receipt names them.
  return {speaker,lead,current_owner:currentOwner,team,team_label:CARD_TEAMS[team]||'Relay',
    step_team:stepTeam,step_team_label:CARD_TEAMS[stepTeam]||null,
    assignment_team:assignmentTeam,assignment_team_label:CARD_TEAMS[assignmentTeam]||null,
    relationship:currentOwner?'Current step owner':speaker?'Assignment lead':'Team update',
    supporting:support,supporting_teams:(Array.isArray(record.supporting_teams)?record.supporting_teams:[]).filter(t=>Object.hasOwn(CARD_TEAMS,t)),
    participation:owner?'step-receipt':'routing',fictional:true};
}
