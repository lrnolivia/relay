const ID=/^[a-z][a-z0-9.-]{1,95}$/;
const SEMVER=/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/;
const INTEGRITY=/^sha256:[a-f0-9]{64}$/;
const ORIGINS=new Set(["relay","upstream","project-private"]);
const PLATFORMS=new Set(["web","macos","windows","android","gnome","generic"]);
const UPDATE_POLICIES=new Set(["pinned","manual","tracked"]);

function uniqueStrings(value,label,max=32){
  if(!Array.isArray(value)||value.length>max||value.some(x=>typeof x!=="string"||!x)) throw new Error(`invalid ${label}`);
  if(new Set(value).size!==value.length) throw new Error(`duplicate ${label}`);
  return [...value];
}
export function validateSkillManifest(manifest){
  if(!manifest||typeof manifest!=="object"||Array.isArray(manifest)) throw new Error("skill manifest must be an object");
  if(!ID.test(manifest.id||"")) throw new Error("invalid skill id");
  if(!SEMVER.test(manifest.version||"")) throw new Error("invalid skill version");
  if(!ORIGINS.has(manifest.origin)) throw new Error("invalid skill origin");
  if(typeof manifest.license!=="string"||!manifest.license.trim()) throw new Error("license is required");
  if(!manifest.provenance||typeof manifest.provenance.source!=="string"||typeof manifest.provenance.revision!=="string") throw new Error("provenance source/revision required");
  if(!INTEGRITY.test(manifest.integrity||"")) throw new Error("invalid skill integrity");
  if(typeof manifest.entrypoint!=="string"||!manifest.entrypoint||(manifest.entrypoint.startsWith("/")||manifest.entrypoint.includes("\\")||manifest.entrypoint.includes(":"))||manifest.entrypoint.split("/").some(p=>!p||p==="."||p==="..")) throw new Error("invalid skill entrypoint");
  if(!Number.isInteger(manifest.context_budget)||manifest.context_budget<256||manifest.context_budget>32768) throw new Error("invalid context budget");
  if(!UPDATE_POLICIES.has(manifest.update_policy)) throw new Error("invalid update policy");
  const required=uniqueStrings(manifest.required_capabilities,"required capabilities");
  const optional=uniqueStrings(manifest.optional_capabilities,"optional capabilities");
  const dependencies=uniqueStrings(manifest.dependencies||[],"dependencies");
  const tags=uniqueStrings(manifest.tags||[],"tags");
  const staff=uniqueStrings(manifest.staff_affinities||[],"staff affinities",16);
  const platforms=uniqueStrings(manifest.platforms,"platforms",16);
  if(platforms.some(x=>!PLATFORMS.has(x))) throw new Error("invalid platform");
  if(required.some(x=>optional.includes(x))) throw new Error("capability cannot be both required and optional");
  if(dependencies.includes(manifest.id)) throw new Error("skill cannot depend on itself");
  if(manifest.extends&&(!ID.test(manifest.extends)||manifest.extends===manifest.id)) throw new Error("invalid skill extension");
  if(manifest.origin==="project-private"&&!manifest.project) throw new Error("project-private skill requires project");
  return Object.freeze({...manifest,required_capabilities:required,optional_capabilities:optional,dependencies,tags,staff_affinities:staff,platforms});
}
export function createSkillRegistry(manifests=[]){
  const byId=new Map();
  for(const raw of manifests){
    const manifest=validateSkillManifest(raw);
    if(byId.has(manifest.id)) throw new Error(`duplicate skill id: ${manifest.id}`);
    byId.set(manifest.id,manifest);
  }
  for(const manifest of byId.values()) if(manifest.extends&&!byId.has(manifest.extends)) throw new Error(`missing extended skill: ${manifest.extends}`);
  const visiting=new Set(),visited=new Set();
  const visit=id=>{
    if(visiting.has(id)) throw new Error(`cyclic skill dependency: ${id}`);
    if(visited.has(id)) return;
    const manifest=byId.get(id);if(!manifest) throw new Error(`missing skill dependency: ${id}`);
    visiting.add(id);
    for(const dependency of [...manifest.dependencies,...(manifest.extends?[manifest.extends]:[])]) visit(dependency);
    visiting.delete(id);visited.add(id);
  };
  for(const id of byId.keys()) visit(id);
  return Object.freeze({
    size:byId.size,
    list:()=>[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id)),
    get:id=>byId.get(id)||null,
    has:id=>byId.has(id),
    overlaysFor:(baseId,project)=>[...byId.values()].filter(x=>x.extends===baseId&&x.project===project).sort((a,b)=>a.id.localeCompare(b.id))
  });
}
