import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length && args[0] !== '--local')) throw new Error('Usage: node scripts/sync-coordination-engine.mjs [--local]');
const local = args[0] === '--local';
const remote = local ? null : JSON.parse(execFileSync('gh', ['api', 'repos/lrnolivia/relay/contents/src/coordination.mjs?ref=main'], { encoding: 'utf8' }));
if (remote && (remote.type !== 'file' || remote.encoding !== 'base64' || remote.truncated)) throw new Error('Incomplete canonical engine response');
const engine = local ? await readFile(new URL('../src/coordination.mjs', import.meta.url)) : Buffer.from(remote.content, 'base64');
const sha = createHash('sha1').update(`blob ${engine.length}\0`).update(engine).digest('hex');
if (remote && sha !== remote.sha) throw new Error('Canonical engine blob identity mismatch');
const target = new URL('../src/runner-control-core.js', import.meta.url);
const adapter = await readFile(target, 'utf8');
const marker = /export const RUNNER_ENGINE_SHA = '[a-f0-9]{40}';/g;
if ((adapter.match(marker) || []).length !== 1) throw new Error('Engine provenance marker missing or ambiguous');
await writeFile(new URL('../src/coordination-engine.js', import.meta.url), engine);
await writeFile(target, adapter.replace(marker, `export const RUNNER_ENGINE_SHA = '${sha}';`));
console.log(`Synced ${local ? 'local candidate' : 'canonical'} Runner engine ${sha}; inspect and test before publication. Runtime canonical-main drift guard remains enforced.`);
