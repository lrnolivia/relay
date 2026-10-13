import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createSkillRegistry } from '../src/skills-registry.js';

const defaultRoot = new URL('../', import.meta.url);
const hash = text => createHash('sha256').update(text).digest('hex');
// Intent vocabulary belongs to authored packs, not fuzzy inference in the resolver.
const intentTags = {
  'coordination.executive-status': ['status', 'progress'],
  'coordination.relationship-context': ['context', 'preferences'],
  'coordination.worker-communication': ['communication', 'handoff'],
  'creative.art-direction': ['design', 'aesthetic'],
  'creative.design-systems': ['design-system', 'tokens', 'components'],
  'creative.flow-ia': ['navigation', 'interaction', 'flow'],
  'creative.motion': ['animation', 'microinteraction'],
  'creative.team-routing': ['composition'],
  'creative.visual-qa': ['visual', 'verification'],
  'creative.visual-reference': ['reference', 'screenshot'],
  'performance.performance-budgets': ['profiling', 'assets', 'fonts', 'hydration', 'network', 'cache'],
  'performance.visual-performance': ['rendering', 'compositor', 'animation'],
  'planning.caught-up-recovery': ['resume', 'amendment'],
  'planning.planning-routing': ['resume', 'findings', 'dependencies', 'multitasking'],
  'planning.workflow-telemetry': ['timing', 'bottlenecks'],
  'platforms.android-material': ['compose', 'tv'],
  'platforms.figma': ['handoff'],
  'platforms.gnome-libadwaita': ['linux', 'gtk'],
  'platforms.macos-swiftui': ['desktop'],
  'platforms.web': ['browser', 'responsive'],
  'platforms.windows-winui': ['desktop', 'xaml'],
  'supporting.accessibility': ['keyboard', 'contrast', 'assistive-technology'],
  'supporting.cloudflare': ['workers', 'r2', 'cdn', 'bindings'],
  'supporting.documentation': ['handoff', 'writing', 'specification'],
  'supporting.engineering': ['implementation', 'build', 'debugging', 'frontend'],
  'supporting.github': ['source', 'branch', 'pull-request', 'checks', 'repository'],
  'supporting.qa': ['testing', 'regression', 'verification'],
  'supporting.regression-protection': ['regression-protection', 'baseline', 'mcp', 'client', 'approved-design'],
  'supporting.release': ['deployment', 'rollback', 'publication'],
  'supporting.research': ['sources', 'compatibility'],
  'supporting.security': ['trust-boundary', 'validation']
};
const newPacks = new Set(['creative.design-systems', 'creative.visual-reference', 'supporting.regression-protection']);

export async function buildSkills({ root = defaultRoot, write = true } = {}) {
  const files = [];
  async function walk(directory) {
    for (const entry of (await fs.readdir(new URL(directory, root), { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
      const relative = path.posix.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('Skill sources cannot be symlinks');
      if (entry.isDirectory()) await walk(relative + '/');
      else if (entry.name.endsWith('.md')) {
        // Supporting resources need a separate integrity/containment contract;
        // never accidentally turn references into independent installable packs.
        if (!/^skills\/(?:supporting\/[a-z-]+\/SKILL\.md|[a-z-]+\/[A-Z_]+\.md)$/.test(relative)) {
          throw Error(`Unsupported skill resource layout: ${relative}`);
        }
        files.push(relative);
      }
    }
  }
  await walk('skills/');
  const bundles = [];
  for (const file of files) {
    const text = await fs.readFile(new URL(file, root), 'utf8');
    const frontmatter = /^---\nname: ([a-z0-9-]+)\ndescription: ([^\n]+)\n---\n/.exec(text);
    if (!frontmatter || frontmatter[1].length > 64 || !frontmatter[2].trim()) throw Error(`Invalid skill frontmatter: ${file}`);
    const name = file.replace(/^skills\//,'').replace(/\/SKILL\.md$/,'').replace(/\.md$/,'').replaceAll('/','.').replaceAll('_','-').toLowerCase();
    const id = 'relay.' + name;
    const platform = ['macos','windows','android','gnome','web'].find(x=>name.includes(x));
    const title = text.split('\n').find(line=>line.startsWith('# '))?.slice(2);
    const manifest = { id, name: title || name.replaceAll('.',' '), version: name === 'planning.planning-routing' ? '1.2.0' : newPacks.has(name) ? '1.0.0' : '1.1.0', origin: 'relay', license: 'LicenseRef-Relay-Private',
      provenance: { source: 'https://github.com/lrnolivia/relay/' + file, revision: 'sha256:' + hash(text) },
      integrity: 'sha256:' + hash(text), entrypoint: 'SKILL.md', context_budget: Math.max(256, Math.ceil(Buffer.byteLength(text)/4)),
      tags: [...new Set([...name.split(/[.-]/), ...(intentTags[name] || [])])], dependencies: name === 'supporting.regression-protection' ? ['relay.supporting.qa', 'relay.supporting.release'] : [], required_capabilities: name.includes('figma') ? ['figma'] : [],
      optional_capabilities: [], platforms: platform ? [platform] : ['generic'], staff_affinities: [], update_policy: 'pinned', executable: false };
    bundles.push({ manifest, text });
  }
  createSkillRegistry(bundles.map(x=>x.manifest));
  const output = '// Generated by scripts/build-skills.mjs from canonical skill sources.\nexport const SKILL_BUNDLES = '+JSON.stringify(bundles,null,2)+';\n';
  if (write) await fs.writeFile(new URL('src/skills-bundles.js',root), output);
  return { bundles, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { bundles } = await buildSkills();
  console.log(`Built ${bundles.length} portable, integrity-bound skill bundles`);
}
