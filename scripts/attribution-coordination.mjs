import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {callRunnerControlCore} from '../src/runner-control-core.js';
import {assertExistingGitHubIdentity, PROJECT_AUTHOR} from '../src/commit-attribution.js';

// The existing native handler retains owner, engine, policy and blob CAS gates.
// gh uses the existing authorized credential store; no credential is created.
export async function attributedCoordination(args, api) {
  if (args?.project !== 'relay' || !['rescope','heartbeat','hold'].includes(args?.action)) throw Error('Only bounded Relay rescope/heartbeat/hold control transactions are allowed');
  const profile = await api('/user');
  const witness = await api(`/repos/${PROJECT_AUTHOR.witness_repo}/commits/${PROJECT_AUTHOR.witness_sha}`);
  assertExistingGitHubIdentity(profile, witness);
  const guarded = async (path, options = {}) => {
    const method = options.method || 'GET';
    if (method !== 'GET' && (method !== 'PUT' || path !== '/repos/lrnolivia/relay/contents/coordination/relay.json')) throw Error('Attribution bootstrap cannot publish source or change credentials');
    return api(path, options);
  };
  const current = await callRunnerControlCore('relay_runner_assignments', {project:'relay'}, {}, guarded);
  if (current.claims.some(c => c.state === 'active' && c.owner !== args.request?.owner)) throw Error('Another active owner appeared; refresh before the serial transfer');
  return callRunnerControlCore('relay_runner_coordinate', args, {}, guarded);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input] = process.argv.slice(2);
  if (!input || process.argv.length !== 3) throw Error('Usage: node scripts/attribution-coordination.mjs request.json');
  const api = async (path, options = {}) => {
    const args = ['api', path.replace(/^\//,''), '--method', options.method || 'GET'];
    if (options.body) args.push('--input','-');
    try {
      const raw = execFileSync('gh', args, {input:options.body ? JSON.stringify(options.body) : undefined, encoding:'utf8', maxBuffer:16*1024*1024, stdio:['pipe','pipe','pipe']});
      return raw.trim() ? JSON.parse(raw) : null;
    } catch (error) {
      const status = /HTTP (\d{3})/.exec(error.stderr?.toString() || '');
      throw Object.assign(Error('GitHub control transport failed'+(status ? ' HTTP '+status[1] : '')), {status:status ? Number(status[1]) : undefined});
    }
  };
  console.log(JSON.stringify(await attributedCoordination(JSON.parse(fs.readFileSync(input,'utf8')), api), null, 2));
}
