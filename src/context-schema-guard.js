// A rollback must retain both the data reader and these publication guards.
export const CONTEXT_SCHEMA_GUARD_VERSION = 1;
const SHA=/^[a-f0-9]{40}$/;
const REGISTRATION='/repos/lrnolivia/relay/contents/projects/relay.json?ref=main';
const capabilityPaths=['packages/runner/src/context-storage.mjs','src/context-schema-guard.js'];
export function contextSchemaFloor(rollback){
 if(!rollback||!Object.hasOwn(rollback,'minimum_context_schema'))return null;
 if(rollback.minimum_context_schema!==2)throw Error('Unsupported minimum context schema');
 return 2;
}
async function reader(env,github){return github||((path)=>import('./source.js').then(({githubApiRequest})=>githubApiRequest(env,path)));}
function sourceText(file){if(file?.type!=='file'||file.encoding!=='base64'||file.truncated||typeof file.content!=='string'||file.content.length>262144)throw Error('Context schema proof unavailable');return Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8');}
export async function readContextSchemaFloor(env,github){
 const api=await reader(env,github),value=JSON.parse(sourceText(await api(REGISTRATION)));
 if(value.id!=='relay'||value.managed!==true||value.repository!=='lrnolivia/relay'||value.cloud?.worker!=='relay')throw Error('Context schema registration identity changed');
 return contextSchemaFloor(value.cloud.rollback);
}
export async function assertContextSource(env,source,floor,github){
 if(floor===null||floor===undefined)return;
 if(floor!==2||!SHA.test(source||''))throw Error('Exact compatible context source required');
 const api=await reader(env,github);
 const [storage,guard]=await Promise.all(capabilityPaths.map(path=>api(`/repos/lrnolivia/relay/contents/${path}?ref=${source}`).then(sourceText)));
 if(!/^export const CONTEXT_STORAGE_SCHEMA_CAPABILITY = 2;$/m.test(storage)||!/^export const CONTEXT_SCHEMA_GUARD_VERSION = 1;$/m.test(guard))throw Error('Release cannot preserve context schema and publication floor');
}
export async function assertContextTarget(env,worker,target,{floor,github}={}){
 if(worker!=='relay')return;
 if(floor===undefined)floor=await readContextSchemaFloor(env,github);
 if(floor===null)return;
 if(target?.worker!==worker||!target?.version_id)throw Error('Retained context source/version proof required');
 await assertContextSource(env,target.source_sha,floor,github);
}
export async function assertContextVersion(env,worker,version,state,{floor,github}={}){
 if(worker!=='relay')return;
 if(floor===undefined)floor=await readContextSchemaFloor(env,github);
 if(floor===null)return;
 const candidates=[state?.last_healthy,state?.last_user_approved,state?.rollback?.state==='pending'?state.rollback.target:null].filter(x=>x?.worker===worker&&x.version_id===version);
 if(!candidates.length||new Set(candidates.map(x=>x.source_sha)).size!==1)throw Error('Retained context source/version proof required');
 await assertContextTarget(env,worker,candidates[0],{floor,github});
}
