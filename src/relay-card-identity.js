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
  const speaker = cardStaff(owner?.staff);
  const team = Object.hasOwn(CARD_TEAMS,owner?.team) ? owner.team : speaker?.team || (Object.hasOwn(CARD_TEAMS,record.primary_team)?record.primary_team:fallbackTeam);
  const support = (Array.isArray(record.supporting_staff)?record.supporting_staff:[]).map(cardStaff).filter(p=>p&&p.id!==lead?.id);
  // A lead may introduce a status card, but its label must never say they did
  // the work unless the current step's own receipt names them.
  return {speaker:speaker||lead,lead,current_owner:speaker,team,team_label:CARD_TEAMS[team]||'Relay',
    relationship:speaker?'Current step owner':lead?'Assignment lead':'Team update',
    supporting:support,supporting_teams:(Array.isArray(record.supporting_teams)?record.supporting_teams:[]).filter(t=>Object.hasOwn(CARD_TEAMS,t)),
    participation:owner?'step-receipt':'routing',fictional:true};
}
