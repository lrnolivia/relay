// Navigation grouping only. Canonical repository/assignment identities never change.
const parents = Object.freeze({'loew-shell':'bazzite-custom','rtxforge-mfg':'rtxforge'});
export const projectGroup = id => parents[id] || id;
export const projectInGroup = (id, selected) => !selected || id === selected || projectGroup(id) === selected;
export function groupedProjects(projects) {
  const byId=new Map(projects.map(project=>[project.id,project]));
  return projects.filter(project=>!parents[project.id] || !byId.has(parents[project.id])).map(project=>({...project,children:projects.filter(child=>parents[child.id]===project.id)}));
}
export function groupedActivity(activity) {
  const result={...activity};
  for(const [id,time] of Object.entries(activity)) result[projectGroup(id)]=Math.max(result[projectGroup(id)]||0,time);
  return result;
}

export const projectMembers = id => id ? [id,...Object.keys(parents).filter(child=>parents[child]===id)] : [];
