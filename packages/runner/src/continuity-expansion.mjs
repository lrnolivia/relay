import {createHash} from 'node:crypto';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const expansionDigest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const id={type:'string',minLength:1,maxLength:64,pattern:'^[a-z][a-z0-9-]{0,63}$'},text=maxLength=>({type:'string',minLength:1,maxLength});
const array=items=>({type:'array',minItems:1,maxItems:16,uniqueItems:true,items});
export const continuityAdditionSchema={type:'object',additionalProperties:false,properties:{id:{...id,maxLength:56},goal_digest:{type:'string',pattern:'^[a-f0-9]{64}$'},kind:{type:'string',enum:['necessary','strengthens']},reason:text(600),relationship:text(600),supports:array(text(120)),target_stage:id,depends_on:{type:'array',maxItems:16,uniqueItems:true,items:id},acceptance:array(text(500)),profile:id,paths:array(text(500)),description:text(2000)},required:['id','goal_digest','kind','reason','relationship','supports','target_stage','depends_on','acceptance','profile','paths','description']};
const argv=a=>Array.isArray(a)&&a.length>0&&a.length<=32&&a.every(s=>typeof s==='string'&&s.length>0&&s.length<=2000);
const pattern=/^[a-z][a-z0-9-]{0,63}$/,digest=/^[a-f0-9]{64}$/;
const strings=(a,n,max,min=1)=>Array.isArray(a)&&a.length>=min&&a.length<=n&&new Set(a).size===a.length&&a.every(s=>typeof s==='string'&&s.trim()&&s.length<=max);
export const insideExpansionScope=(p,scope)=>scope.some(s=>p===s||(s.endsWith('/')&&p.startsWith(s)));
export function validateContinuityAdditions(items){
 if(!Array.isArray(items)||items.length>8||Buffer.byteLength(JSON.stringify(items))>32768)throw Error('Expansion batch exceeds its bounded data contract');
 for(const p of items){
  if(!p||Object.keys(p).sort().join(',')!==[...continuityAdditionSchema.required].sort().join(',')||(!pattern.test(p.id||'')||p.id.length>56)||!digest.test(p.goal_digest||'')||!['necessary','strengthens'].includes(p.kind)||!pattern.test(p.target_stage||'')||!pattern.test(p.profile||'')||!['reason','relationship','description'].every(k=>typeof p[k]==='string'&&p[k].trim()&&p[k].length<=(k==='description'?2000:600))||!strings(p.supports,16,120)||!strings(p.depends_on,16,64,0)||p.depends_on.some(x=>!pattern.test(x))||!strings(p.acceptance,16,500)||!strings(p.paths,16,500))throw Error('Expansion must declare bounded goal relationship, dependencies and acceptance; executable/authority fields are not worker data');
  if(p.paths.some(x=>x.startsWith('/')||/[\\\x00-\x1f]/.test(x)||x.split('/').some(s=>s==='..'||s==='.')||/^(?:\.aws|\.codex|\.claude|\.git)(?:\/|$)|(?:^|\/)\.env(?:\.|$)/.test(x)))throw Error('Expansion paths cannot escape source or request sensitive stores');
 }
 return items;
}
export function validateExpansionPolicy(plan){
 const p=plan.expansion;if(!p)return null;
 if(p.enabled!==true||typeof p.authorization!=='string'||!p.authorization.trim()||p.authorization.length>2000||typeof p.original_goal!=='string'||!p.original_goal.trim()||p.original_goal.length>12000||!p.profiles||typeof p.profiles!=='object'||Array.isArray(p.profiles)||Object.keys(p.profiles).length<1||Object.keys(p.profiles).length>8)throw Error('Expansion requires scoped authorization, immutable original goal and trusted verifier profiles');
 for(const [name,profile] of Object.entries(p.profiles))if(!pattern.test(name)||!['implementation','test'].includes(profile.kind)||!strings(profile.inputs,64,500)||profile.inputs.some(x=>x.startsWith('/')||x.split('/').includes('..'))||!argv(profile.verify)||profile.command&&!argv(profile.command))throw Error('Supporting stages require existing trusted verification/command profiles');
 for(const [key,max] of [['max_additions',8],['max_depth',3],['max_proposals',32]])if(p[key]!==undefined&&(!Number.isInteger(p[key])||p[key]<1||p[key]>max))throw Error('Expansion budget exceeds hard bounds');
 if(p.allowed_paths!==undefined&&(!strings(p.allowed_paths,64,500)||p.allowed_paths.some(x=>x.startsWith('/')||x.split('/').includes('..'))))throw Error('Expansion envelope must be pre-authorized relative source paths');
 if(p.review!==undefined&&!argv(p.review))throw Error('Coordinator review must use a trusted bounded command');
 return {max_additions:8,max_depth:2,max_proposals:32,...p,goal_digest:expansionDigest(p.original_goal)};
}
export function orderContinuityStages(stages){
 const result=[],seen=new Set(),visiting=new Set(),byId=new Map(stages.map(x=>[x.id,x]));
 if(byId.size!==stages.length)throw Error('Duplicate stage identity');
 const visit=id=>{if(visiting.has(id))throw Object.assign(Error('Expansion dependency cycle'),{cycle:[...visiting,id]});if(seen.has(id))return;const stage=byId.get(id);if(!stage)throw Error('Expansion dependency is unavailable: '+id);visiting.add(id);for(const dep of stage.depends_on)visit(dep);visiting.delete(id);seen.add(id);result.push(stage);};
 for(const stage of stages)visit(stage.id);return result;
}
export function expandedContinuityPlan(base,ledger=[]){
 const plan=structuredClone(base),policy=validateExpansionPolicy(base);if(!ledger.length)return plan;
 for(const entry of ledger){
  if(entry.digest!==expansionDigest(entry.proposal))throw Error('Expansion journal proposal changed; reconcile preserved evidence');
  if(entry.status!=='admitted')continue;
  if(!policy||entry.proposal.goal_digest!==policy.goal_digest||entry.goal_digest!==policy.goal_digest)throw Error('Expansion cannot replace the original goal');
  const p=entry.proposal,profile=policy.profiles[p.profile];if(!profile)throw Error('Trusted expansion profile disappeared');
  const criteria=p.acceptance.map((_,i)=>'addition:'+p.id+':'+i),stage={id:'add-'+p.id,kind:profile.kind,criteria:[...p.supports,...criteria],depends_on:[...p.depends_on],prompt:'Original goal (unchanged): '+policy.original_goal+'\nSupporting '+p.kind+' feature: '+p.description+'\nReason: '+p.reason+'\nRelationship to original acceptance: '+p.relationship+'\nAcceptance: '+JSON.stringify(p.acceptance),inputs:[...new Set([...profile.inputs,...p.paths])],verify:[...profile.verify],...(profile.command?{command:[...profile.command]}:{}),addition:{id:p.id,paths:[...p.paths],reason:p.reason,relationship:p.relationship,acceptance:p.acceptance,goal_digest:p.goal_digest,depth:entry.depth}};
  plan.criteria.push(...criteria);plan.stages.push(stage);
  if(p.kind==='necessary'){const target=plan.stages.find(x=>x.id===p.target_stage);if(!target)throw Error('Supporting target disappeared');target.depends_on=[...new Set([...target.depends_on,stage.id])];}
  for(const gate of plan.stages.filter(x=>['review','ship','runtime'].includes(x.kind)))gate.depends_on=[...new Set([...gate.depends_on,stage.id])];
 }
 if(plan.stages.length>32)throw Error('Expansion exceeds the total finite stage budget');
 plan.stages=orderContinuityStages(plan.stages);return plan;
}

const digestSchema={type:'string',pattern:'^[a-f0-9]{64}$'};
export const canonicalAdditionSchema={type:'object',additionalProperties:false,properties:{schema:{type:'integer',enum:[1]},base_objective_digest:digestSchema,goal_digest:digestSchema,profile_digest:digestSchema,proposal:continuityAdditionSchema,review:{type:'object',additionalProperties:false,properties:{verdict:{type:'string',enum:['admit']},preserves_goal:{type:'boolean',enum:[true]},goal_digest:digestSchema,within_authority:{type:'boolean',enum:[true]},sensitive_permissions:{type:'boolean',enum:[false]},paid_services:{type:'boolean',enum:[false]},canonical_key:{type:'string',minLength:1,maxLength:64,pattern:'^[-a-z0-9]+$'},reason:text(1000)},required:['verdict','preserves_goal','goal_digest','within_authority','sensitive_permissions','paid_services','canonical_key','reason']}},required:['schema','base_objective_digest','goal_digest','profile_digest','proposal','review']};
export const continuityObjectiveDigest=(goal,acceptance)=>createHash('sha256').update(JSON.stringify({goal,acceptance})).digest('hex');
export function appendCanonicalAdditions(previous=[],next,goal,objectiveDigest){
 if(!Array.isArray(next)||next.length<previous.length||next.length>8||Buffer.byteLength(JSON.stringify(next))>262144)throw Error('Canonical acceptance additions are bounded and append-only');
 for(let i=0;i<previous.length;i++)if(expansionDigest(previous[i])!==expansionDigest(next[i]))throw Error('Accepted supporting work cannot disappear or be rewritten');
 const ids=new Set(),keys=new Set();
 for(const entry of next){
  if(!entry||Object.keys(entry).sort().join(',')!==[...canonicalAdditionSchema.required].sort().join(',')||entry.schema!==1||!digest.test(entry.base_objective_digest||'')||!digest.test(entry.profile_digest||'')||entry.goal_digest!==expansionDigest(goal))throw Error('Canonical addition must preserve the original goal and exact plan/profile identities');
  if(objectiveDigest && !previous.some(x=>expansionDigest(x)===expansionDigest(entry)) && entry.base_objective_digest!==objectiveDigest)throw Error('New supporting acceptance must bind the current original acceptance');
  validateContinuityAdditions([entry.proposal]);const r=entry.review;
  if(entry.proposal.goal_digest!==entry.goal_digest||!r||Object.keys(r).sort().join(',')!==[...canonicalAdditionSchema.properties.review.required].sort().join(',')||r.verdict!=='admit'||r.preserves_goal!==true||r.goal_digest!==entry.goal_digest||r.within_authority!==true||r.sensitive_permissions!==false||r.paid_services!==false||!/^[-a-z0-9]{1,64}$/.test(r.canonical_key||'')||typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>1000)throw Error('Canonical addition requires an admitted in-authority goal-preservation review');
  if(ids.has(entry.proposal.id)||keys.has(r.canonical_key))throw Error('Duplicate canonical supporting feature');ids.add(entry.proposal.id);keys.add(r.canonical_key);
 }
 return structuredClone(next);
}
