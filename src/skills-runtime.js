import { canIngestUpstream } from './skills-upstream.js';
import { createSkillRegistry } from './skills-registry.js';
import { auditSkillManifest, sha256 } from './skills-audit.js';
import { resolveSkills } from './skills-resolver.js';

export function createSkillsRuntime({ manifests = [], loader } = {}) {
  if (typeof loader !== 'function') throw Error('skills runtime requires a loader');
  const registry = createSkillRegistry(manifests);
  return Object.freeze({
    registry,
    resolve: context => resolveSkills(registry, context),
    async load(selection, { capabilities = [], project = null, max_context = 8192 } = {}) {
      if (!Array.isArray(selection) || selection.length > 32 || !Number.isInteger(max_context) || max_context < 256 || max_context > 32768) throw Error('Invalid skills load limits');
      const selected = new Set(selection.map(item => item.id));
      if (selected.size !== selection.length) throw Error('Duplicate skill selection');
      const available = new Set(capabilities), out = []; let budget = 0;
      for (const item of selection) {
        const manifest = registry.get(item.id);
        if (!manifest || (item.version && item.version !== manifest.version)) throw Error(`unknown skill version: ${item.id}`);
        if (!auditSkillManifest(manifest).ok || !canIngestUpstream(manifest).ok || manifest.executable) throw Error(`skill audit blocked: ${item.id}`);
        if (manifest.origin === 'project-private' && manifest.project !== project) throw Error(`skill project gate failed: ${item.id}`);
        if (manifest.required_capabilities.some(x => !available.has(x))) throw Error(`skill capability gate failed: ${item.id}`);
        if ([...manifest.dependencies, ...(manifest.extends ? [manifest.extends] : [])].some(id => !selected.has(id))) throw Error(`skill dependency gate failed: ${item.id}`);
        budget += manifest.context_budget;
        if (budget > max_context) throw Error('Skill selection exceeds aggregate context budget');
        const bundle = await loader(manifest);
        if (!bundle || typeof bundle.text !== 'string') throw Error(`invalid skill bundle: ${item.id}`);
        const bytes = Buffer.from(bundle.text, 'utf8');
        if (bytes.length > manifest.context_budget * 4) throw Error(`skill bundle exceeds bounded load budget: ${item.id}`);
        if ('sha256:' + sha256(bytes) !== manifest.integrity) throw Error(`skill integrity mismatch: ${item.id}`);
        if(manifest.origin==='upstream' && (typeof bundle.license_text!=='string'||'sha256:'+sha256(Buffer.from(bundle.license_text,'utf8'))!==manifest.license_integrity))throw Error('Upstream license integrity mismatch');
        out.push(Object.freeze({ manifest, text: bundle.text, ...(bundle.license_text?{license_text:bundle.license_text}:{}) }));
      }
      return out;
    }
  });
}
