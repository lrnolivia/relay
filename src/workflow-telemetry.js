const PHASES=new Set([
  "active-execution","external-wait","recoverable-stall","blocked","human-intervention","verification-deploy"
]);

function ms(value){
  const n=Date.parse(value||"");
  return Number.isFinite(n)?n:null;
}
export function classifyWorkflowPhase(event={}){
  const type=String(event.type||"");
  const text=[type,event.status,event.conclusion,event.reason,event.detail,event.stage].filter(Boolean).join(" ");
  if(/human|review|approval|qa-request/i.test(text)) return "human-intervention";
  if(/auth|permission|credential|schema|client|scope conflict|destructive/i.test(text)) return "blocked";
  if(/deploy|verification|verify|check-completed|check-started|pull-request/i.test(text)) return "verification-deploy";
  if(/external|waiting-on-external|install|queued|in_progress/i.test(text) && !/source-commit/i.test(text)) return "external-wait";
  if(/recover|retry|stale|frozen|no-progress|tool-failure|circular/i.test(text)) return "recoverable-stall";
  return "active-execution";
}

export function deriveWorkflowTimeline(events=[], { end_at=null }={}){
  const normalized=(Array.isArray(events)?events:[])
    .map((event,index)=>({...event,_index:index,_at:ms(event.at||event.created_at||event.updated_at)}))
    .filter(event=>event._at!==null)
    .sort((a,b)=>a._at-b._at||a._index-b._index);
  if(!normalized.length) return [];
  const end=ms(end_at)??normalized[normalized.length-1]._at;
  return normalized.map((event,index)=>{
    const next=normalized[index+1]?._at??Math.max(end,event._at);
    return Object.freeze({
      phase:classifyWorkflowPhase(event),
      started_at:new Date(event._at).toISOString(),
      ended_at:new Date(Math.max(event._at,next)).toISOString(),
      duration_ms:Math.max(0,next-event._at),
      event_type:event.type||null,
      task_class:event.task_class||null,
      capability:event.capability||null,
      skill:event.skill||null,
      tool_family:event.tool_family||null,
      reason:event.reason||null,
      staff_id:event.staff_id||null
    });
  });
}

function keyOf(segment, dimensions){
  return dimensions.map(key=>String(segment[key]??"unknown")).join("|");
}
export function aggregateWorkflowTelemetry(segments=[], { dimensions=["phase"], staff_id=null }={}){
  const safeDimensions=dimensions.filter(key=>["phase","task_class","capability","skill","tool_family","reason"].includes(key)).slice(0,6);
  if(!safeDimensions.length) throw new Error("at least one allowed telemetry dimension is required");
  const groups=new Map();
  for(const segment of segments){
    if(!PHASES.has(segment.phase)) throw new Error("invalid workflow phase");
    if(staff_id&&segment.staff_id!==staff_id) continue;
    const key=keyOf(segment,safeDimensions);
    const current=groups.get(key)||{key,dimensions:Object.fromEntries(safeDimensions.map(name=>[name,segment[name]??null])),duration_ms:0,segments:0};
    current.duration_ms+=Math.max(0,Number(segment.duration_ms)||0);
    current.segments+=1;
    groups.set(key,current);
  }
  return [...groups.values()].sort((a,b)=>b.duration_ms-a.duration_ms||a.key.localeCompare(b.key));
}
export function detectWorkflowBottlenecks(segments=[], { minimum_ms=5*60*1000, minimum_segments=2 }={}){
  return aggregateWorkflowTelemetry(segments,{dimensions:["phase","tool_family","reason"]})
    .filter(item=>item.duration_ms>=minimum_ms||item.segments>=minimum_segments)
    .map(item=>Object.freeze({
      ...item,
      finding_candidate:true,
      recommendation:item.dimensions.phase==="external-wait"?"inspect external wait/caching/concurrency":
        item.dimensions.phase==="recoverable-stall"?"feed validated recovery pattern into planning/recovery learning":
        item.dimensions.phase==="blocked"?"surface explicit authority/client/scope blocker":
        "inspect repeated workflow phase cost",
      staff_productivity_score:null
    }));
}
export function telemetrySummary(segments=[]){
  const byPhase=aggregateWorkflowTelemetry(segments,{dimensions:["phase"]});
  const total_ms=byPhase.reduce((sum,item)=>sum+item.duration_ms,0);
  return Object.freeze({
    total_ms,
    by_phase:byPhase,
    bottlenecks:detectWorkflowBottlenecks(segments),
    staff_productivity_ranking:null
  });
}
