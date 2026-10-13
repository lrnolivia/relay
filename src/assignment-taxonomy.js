import { normalizeAssignmentStaff } from "./staff-registry.js";
const CATEGORIES=new Set(["architecture","design","implementation","research","qa-verification","maintenance","release","coordination"]);
const ROLE=/^[a-z][a-z0-9-]{0,63}$/;
const TAG=/^[a-z0-9][a-z0-9._-]{0,63}$/;
const LABEL_KEY=/^[a-z][a-z0-9.-]{0,63}$/;

function uniq(values,label,max){
  if(!Array.isArray(values)||values.length>max) throw new Error("invalid "+label);
  if(new Set(values).size!==values.length) throw new Error("duplicate "+label);
  return [...values];
}
export function normalizeAssignmentTaxonomy(input={}){
  if(!CATEGORIES.has(input.category)) throw new Error("invalid assignment category");
  const tags=uniq(input.tags||[],"tags",32).map(x=>String(x).toLowerCase());
  if(tags.some(x=>!TAG.test(x))) throw new Error("invalid assignment tag");
  const labels=Array.isArray(input.labels)?input.labels:[];
  if(labels.length>32) throw new Error("too many assignment labels");
  const seen=new Set();
  const normalizedLabels=labels.map(label=>{
    if(!label||typeof label!=="object"||!LABEL_KEY.test(label.key||"")||typeof label.value!=="string"||!label.value.trim()||label.value.length>120) throw new Error("invalid assignment label");
    const key=label.key+"="+label.value;
    if(seen.has(key)) throw new Error("duplicate assignment label");
    seen.add(key); return Object.freeze({key:label.key,value:label.value});
  });
  const primary=input.primary_role??null;
  if(primary!==null&&!ROLE.test(primary)) throw new Error("invalid primary role");
  const supporting=uniq(input.supporting_roles||[],"supporting roles",8);
  if(supporting.some(x=>!ROLE.test(x))) throw new Error("invalid supporting role");
  if(primary&&supporting.includes(primary)) throw new Error("primary role cannot also be supporting");
  return Object.freeze({...normalizeAssignmentStaff(input),category:input.category,labels:Object.freeze(normalizedLabels),tags:Object.freeze(tags),primary_role:primary,supporting_roles:Object.freeze(supporting)});
}
export function mergeAssignmentTaxonomy(current,patch={}){
  return normalizeAssignmentTaxonomy({...current,...patch});
}
export function taxonomySkillContext(taxonomy){
  const t=normalizeAssignmentTaxonomy(taxonomy);
  return Object.freeze({
    task_class:t.category,
    intent_tags:[t.category,...t.tags,...t.labels.map(x=>x.key+"."+String(x.value).toLowerCase().replace(/[^a-z0-9._-]+/g,"-")),...(t.primary_role?["role."+t.primary_role]:[]),...t.supporting_roles.map(role=>"role."+role)],
    primary_staff:t.primary_staff,
    supporting_staff:t.supporting_staff,
    primary_role:t.primary_role,
    supporting_roles:t.supporting_roles
  });
}
