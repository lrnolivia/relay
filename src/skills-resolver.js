function asSet(value){return new Set(Array.isArray(value)?value:[]);}
function rank(manifest,{intent_tags,platform,staff_id,project}){
  let score=0; const reasons=[];
  const tags=asSet(manifest.tags);
  for(const tag of intent_tags) if(tags.has(tag)){score+=4;reasons.push(`tag:${tag}`);}
  if(platform&&manifest.platforms.includes(platform)){score+=3;reasons.push(`platform:${platform}`);}
  if(staff_id&&manifest.staff_affinities.includes(staff_id)){score+=2;reasons.push(`staff:${staff_id}`);}
  if(project&&manifest.origin==="project-private"&&manifest.project===project){score+=5;reasons.push(`project:${project}`);}
  return {score,reasons};
}

export function resolveSkills(registry,{intent_tags=[],platform=null,staff_id=null,project=null,capabilities=[],max_context=8192,max_skills=8}={}){
  if(!Number.isInteger(max_context)||max_context<256||max_context>32768||!Number.isInteger(max_skills)||max_skills<1||max_skills>32) throw Error('Invalid skills context limits');
  const available=asSet(capabilities);
  const accepted=[]; const rejected=[];
  for(const manifest of registry.list()){
    if(manifest.origin==="project-private"&&manifest.project!==project){
      rejected.push({id:manifest.id,reason:"project-mismatch"}); continue;
    }
    const missing=manifest.required_capabilities.filter(x=>!available.has(x));
    if(missing.length){rejected.push({id:manifest.id,reason:"missing-capability",missing});continue;}
    if(platform&&!manifest.platforms.includes("generic")&&!manifest.platforms.includes(platform)){
      rejected.push({id:manifest.id,reason:"platform-mismatch"});continue;
    }
    const ranked=rank(manifest,{intent_tags,platform,staff_id,project});
    if(ranked.score===0){rejected.push({id:manifest.id,reason:"no-intent-match"});continue;}
    accepted.push({manifest,score:ranked.score,reasons:ranked.reasons});
  }
  accepted.sort((a,b)=>b.score-a.score||a.manifest.id.localeCompare(b.manifest.id));
  const selected=[],chosen=new Set(); let used=0;
  const eligible=manifest=>!(manifest.origin==='project-private'&&manifest.project!==project)&&
    manifest.required_capabilities.every(x=>available.has(x))&&
    (!platform||manifest.platforms.includes('generic')||manifest.platforms.includes(platform));
  for(const item of accepted){
    const closure=[],seen=new Set();
    const collect=manifest=>{
      if(seen.has(manifest.id))return;
      seen.add(manifest.id);
      for(const id of [...manifest.dependencies,...(manifest.extends?[manifest.extends]:[])])collect(registry.get(id));
      closure.push(manifest);
    };
    collect(item.manifest);
    if(closure.some(manifest=>!eligible(manifest))){rejected.push({id:item.manifest.id,reason:'dependency-gate'});continue;}
    const additions=closure.filter(manifest=>!chosen.has(manifest.id));
    const cost=additions.reduce((sum,manifest)=>sum+manifest.context_budget,0);
    if(selected.length+additions.length>max_skills||used+cost>max_context){rejected.push({id:item.manifest.id,reason:'context-budget'});continue;}
    for(const manifest of additions){
      chosen.add(manifest.id);used+=manifest.context_budget;
      selected.push({id:manifest.id,version:manifest.version,score:item.score,
        reasons:manifest.id===item.manifest.id?item.reasons:[`dependency:${item.manifest.id}`],
        context_budget:manifest.context_budget,extends:manifest.extends||null});
    }
  }
  return Object.freeze({selected,rejected,context_used:used,context_limit:max_context});
}
