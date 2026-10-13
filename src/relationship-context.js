import { getStaff } from "./staff-registry.js";

const TOPICS=new Set(["communication","collaboration","humor","presentation","workflow"]);
const SOURCES=new Set(["explicit-feedback","repeated-collaboration"]);
const FORBIDDEN=/\b(health|medical|diagnosis|race|ethnicity|religion|politic|sexual|sex life|criminal|disability|mental state|intelligence)\b/i;

function text(value,label,max){
  if(typeof value!=="string"||!value.trim()||value.length>max) throw new Error(label+" is required");
  if(FORBIDDEN.test(value)) throw new Error("relationship context cannot encode sensitive inferred traits");
  return value.trim();
}
export function createInteractionSignal(input={}){
  const staff=getStaff(input.staff_id);
  if(!staff||staff.status==="retired") throw new Error("interaction signal requires active or reserve staff");
  if(!TOPICS.has(input.topic)) throw new Error("invalid relationship-context topic");
  if(!SOURCES.has(input.source)) throw new Error("invalid relationship-context source");
  return Object.freeze({
    staff_id:staff.id,
    topic:input.topic,
    source:input.source,
    observation:text(input.observation,"observation",400),
    explicit:Boolean(input.explicit),
    evidence_refs:Array.isArray(input.evidence_refs)?[...new Set(input.evidence_refs.filter(x=>typeof x==="string"&&x).slice(0,12))]:[],
    durable:false
  });
}
export function curateRelationshipNote(signal,{curator_staff_id="julian",note=null}={}){
  const curator=getStaff(curator_staff_id);
  if(!curator||curator.id!=="julian"||curator.status!=="active") throw new Error("durable relationship notes are curated by Julian");
  if(!signal||signal.durable!==false) throw new Error("curation requires a bounded interaction signal");
  if(signal.source==="repeated-collaboration"&&!signal.explicit&&signal.evidence_refs.length<2) throw new Error("repeated collaboration requires at least two evidence references");
  const summary=text(note||signal.observation,"relationship note",500);
  return Object.freeze({
    staff_id:signal.staff_id,
    topic:signal.topic,
    source:signal.source,
    note:summary,
    curator_staff_id:"julian",
    evidence_refs:signal.evidence_refs,
    durable:true,
    affinity_score:null,
    inferred_sensitive_traits:null,
    canned_jokes:null
  });
}
export function relationshipContextForStaff(staff_id,notes=[]){
  const staff=getStaff(staff_id);
  if(!staff||staff.status==="retired") return Object.freeze({staff_id,notes:[]});
  const filtered=(Array.isArray(notes)?notes:[])
    .filter(note=>note?.durable===true&&note.staff_id===staff.id)
    .slice(-12)
    .map(note=>Object.freeze({topic:note.topic,note:note.note,source:note.source,evidence_refs:note.evidence_refs||[]}));
  return Object.freeze({staff_id:staff.id,display_name:staff.display_name,notes:Object.freeze(filtered)});
}
