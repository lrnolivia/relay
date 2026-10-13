// Snapshot-derived telemetry. No invented completion estimates or synthetic events.
export function telemetryModel(snapshot, now=Date.now()) {
 const items=Object.entries(snapshot?.progress||{}).flatMap(([project,payload])=>(payload.progress||[]).map(item=>({...item,project})));
 const day=new Date(now);day.setHours(0,0,0,0);
 const work=Object.values(snapshot?.workload||{}).flat();
 const open=work.filter(x=>['active','held'].includes(x.state));
 const completed=work.filter(x=>x.state==='completed'&&Date.parse(x.completed_at)>=day.getTime()&&Date.parse(x.completed_at)<=now);
 const total=open.length+completed.length;
 const moving=items.filter(x=>x.state==='working'),waiting=items.filter(x=>['waiting-for-human','blocked','waiting-on-external-system','failed','possibly-stale','officially-stale','reserved-but-idle','external-wait','stalled'].includes(x.state));
 const needs=items.filter(x=>x.state==='waiting-for-human');
 const bins=Array(12).fill(0),seen=new Set();
 for(const item of items)for(const event of item.events||[]) {
  if(['runner-heartbeat','claim-created'].includes(event.type))continue;
  const time=Date.parse(event.at);if(!Number.isFinite(time)||time<=now-21600000||time>now)continue;
  const key=item.project+':'+(event.id||JSON.stringify([event.type,event.at,event.head_sha,event.pr,event.check,event.deployment_id]));
  if(seen.has(key))continue;seen.add(key);bins[Math.min(11,Math.floor((time-now+21600000)/1800000))]++;
 }
 const projects=[...new Set(moving.map(x=>x.project))].map(project=>({project,count:moving.filter(x=>x.project===project).length})).sort((a,b)=>b.count-a.count||a.project.localeCompare(b.project));
 return {items,open:open.length,completed:completed.length,total,percent:total?Math.round(completed.length/total*100):null,moving,waiting,needs,projects,bins,events:seen.size};
}
