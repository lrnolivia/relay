// Organizational context only. Machine owner, scope and project authority stay in Runner.
export const TEAMS = Object.freeze([
  ['inspector','visual direction, interaction, motion and verification'],
  ['runner','engineering, implementation and execution'],
  ['night-shift','planning, coordination, research and continuity'],
  ['source','source integration and transport'],
  ['cloud','runtime reliability and cloud operations'],
  ['release','publication and deployment gates'],
  ['skills','knowledge, skill discovery and expertise']
].map(([id,purpose])=>Object.freeze({id,label:id,purpose,identity_is_authority:false})));
export const HOME_TEAMS = Object.freeze({valentina:'inspector',vivienne:'inspector',margot:'inspector',sabine:'inspector',roman:'inspector',ellis:'runner',nico:'runner',adrian:'runner',julian:'night-shift',naomi:'night-shift',rafael:'source',gabriel:'cloud',luca:'release',imani:'skills',mateo:'source',bianca:'inspector',dominique:'night-shift'});
const CROSS_TEAMS = Object.freeze({julian:['runner','release'],roman:['runner','source','cloud','release','skills','night-shift'],imani:['night-shift','runner'],rafael:['runner','release'],gabriel:['release','runner'],luca:['source','cloud'],nico:['inspector'],ellis:['source','cloud','skills'],naomi:['inspector','skills']});
const ROLE_TEAMS = Object.freeze({'art-director':'inspector','product-lead':'inspector','design-editor':'inspector','motion-director':'inspector',verifier:'inspector','qa-verification':'inspector',design:'inspector',architect:'runner','systems-architect':'runner',architecture:'runner',builder:'runner',implementation:'runner',caretaker:'runner',maintenance:'runner',coordinator:'night-shift',coordination:'night-shift',researcher:'night-shift',research:'night-shift',integrator:'source',source:'source','reliability-lead':'cloud',cloud:'cloud','release-captain':'release',release:'release','knowledge-planner':'skills',skills:'skills'});
export function staffTeamMetadata(id) {
  const home_team=HOME_TEAMS[id]||null;
  return {home_team,team_memberships:Object.freeze(home_team?[home_team,...(CROSS_TEAMS[id]||[])]:[])};
}
export function getTeam(ref) {return TEAMS.find(team=>team.id===ref)||null;}
function validTeam(ref) {if(!getTeam(ref))throw new Error(`Unknown assignment team: ${ref}`);return ref;}
export function normalizeAssignmentTeams(input={}) {
  const roleTeam=ROLE_TEAMS[input.primary_role];
  const signals=[...(input.tags||[]),...(input.resources||[]),...(input.labels||[]).map(x=>x.value)];
  const signalTeam=TEAMS.find(team=>signals.some(value=>new RegExp(`(^|[^a-z])${team.id}([^a-z]|$)`).test(String(value).toLowerCase())))?.id;
  const primary_team=input.primary_team===undefined?roleTeam||signalTeam||ROLE_TEAMS[input.category]||'night-shift':input.primary_team===null?null:validTeam(input.primary_team);
  const inferred=(input.supporting_roles||[]).map(role=>ROLE_TEAMS[role]).filter(Boolean);
  const supporting_teams=input.supporting_teams===undefined?[...new Set(inferred)].filter(id=>id!==primary_team):input.supporting_teams;
  if(!Array.isArray(supporting_teams)||supporting_teams.length>6)throw new Error('Supporting teams must be a bounded array.');
  supporting_teams.forEach(validTeam);
  if(new Set(supporting_teams).size!==supporting_teams.length||supporting_teams.includes(primary_team))throw new Error('Duplicate assignment team.');
  return {primary_team,supporting_teams:[...supporting_teams]};
}
