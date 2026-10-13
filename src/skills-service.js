import { vendorUpstream } from '../packages/skills/upstream.mjs';
import { githubApiRequest } from './source.js';
import { SKILL_BUNDLES } from './skills-bundles.js';
import { createSkillsRuntime } from './skills-runtime.js';
import { auditSkillManifest } from './skills-audit.js';
import { planUpstreamUpdate } from './skills-upstream.js';
import { validateControlArguments } from './runner-control.js';

export const skillsTool = {
  name: 'relay_skills', title: 'Use portable Relay skills',
  description: 'QUERY / BUNDLE EXPORT — catalog, search, resolve, read, audit or vendor integrity-bound portable skills with dependency, project, capability and context gates. Vendor returns exact files for an admitted source change; it does not install or execute code. Update reports drift for review and never silently upgrades a pinned bundle.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['action'], properties: {
    action: { type: 'string', enum: ['catalog','search','resolve','read','audit','vendor','update'] },
    id: { type: 'string', pattern: '^[a-z][a-z0-9.-]{1,95}$' }, query: { type: 'string', maxLength: 200 },
    project: { type: 'string', pattern: '^[a-z0-9-]{1,80}$' },
    platform: { type: 'string', enum: ['web','macos','windows','android','gnome','generic'] },
    intent_tags: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 80 } },
    capabilities: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 120 } },
    max_context: { type: 'integer', minimum: 256, maximum: 32768 },
    max_skills: { type: 'integer', minimum: 1, maximum: 32 },
    upstream: { type:'object',additionalProperties:false,required:['id','repository','revision','path','license','integrity'],properties:{id:{type:'string',pattern:'^upstream\\.[a-z][a-z0-9.-]{1,80}$'},repository:{type:'string',pattern:'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'},revision:{type:'string',pattern:'^[a-f0-9]{40}$'},path:{type:'string',maxLength:240},license:{type:'string',maxLength:120},integrity:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'}} },
    candidate: { type: 'object', additionalProperties: false, properties: {
      revision: { type: 'string', minLength: 1, maxLength: 200 },
      integrity: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
      license: { type: 'string', minLength: 1, maxLength: 120 }
    } }
  } }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

export async function callSkills(args, bundles = SKILL_BUNDLES, env = {}, apiOverride) {
  validateControlArguments(args, skillsTool.inputSchema);
  if(args.upstream){if(args.action!=='vendor')throw Error('Upstream input is supported only for explicit pinned vendoring');const bundle=await vendorUpstream(args.upstream,apiOverride||((path,options)=>githubApiRequest(env,path,options)));return {ok:true,installed:false,pinned:true,requires_admitted_source_change:true,bundles:[{...bundle,files:[{path:bundle.manifest.id+'/SKILL.md',text:bundle.text,integrity:bundle.manifest.integrity},{path:bundle.manifest.id+'/LICENSE',text:bundle.license_text,integrity:bundle.manifest.license_integrity}]}]};}
  const byId = new Map(bundles.map(bundle => [bundle.manifest.id, bundle]));
  const runtime = createSkillsRuntime({ manifests: bundles.map(x => x.manifest), loader: async manifest => byId.get(manifest.id) });
  const visible = runtime.registry.list().filter(manifest => manifest.origin !== 'project-private' || manifest.project === args.project);
  if (['catalog','search'].includes(args.action)) {
    const query = (args.query || '').toLowerCase();
    return { ok: true, namespace: 'relay.SKILLS', manifests: visible.filter(m => !query || [m.id,m.name,...m.tags].join(' ').toLowerCase().includes(query)), executable: false };
  }
  if (args.action === 'resolve') return { ok: true, namespace: 'relay.SKILLS', ...runtime.resolve(args) };
  if (!args.id) throw Error('Skill id is required');
  const manifest = visible.find(x => x.id === args.id);
  if (!manifest) throw Error('Unknown skill in this project scope');
  if (args.action === 'update') return { ok: true, ...planUpstreamUpdate(manifest, args.candidate), installed: false };
  const ids = new Set(); const collect = id => { const m = runtime.registry.get(id); for(const dependency of [...m.dependencies,...(m.extends?[m.extends]:[])]) if(!ids.has(dependency))collect(dependency); ids.add(id); };
  collect(manifest.id);
  const loaded = await runtime.load([...ids].map(id=>({id})), args);
  if (args.action === 'audit') return { ok: true, audit: loaded.map(x=>({id:x.manifest.id,integrity_verified:true,...auditSkillManifest(x.manifest)})), executable: false };
  if (args.action === 'vendor') return { ok: true, installed: false, requires_admitted_source_change: true, bundles: loaded.map(x=>({ manifest:x.manifest,files:[{path:x.manifest.id+'/SKILL.md',text:x.text,integrity:x.manifest.integrity}]})) };
  return { ok: true, bundles: loaded, executable: false };
}
