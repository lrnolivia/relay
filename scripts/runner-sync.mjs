import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readRunnerJsonFile, runnerControlBase } from '../src/runner-control-core.js';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const terminal = new Set(['completed','cancelled','superseded']);
export async function synchronizeProject(project, registration, record, api) {
  const repository = registration.repository;
  if (!/^[a-z0-9-]+$/.test(project) || !/^lrnolivia\/[A-Za-z0-9_.-]+$/.test(repository)) throw Error('Invalid registered project');
  const candidates = (record.claims || []).filter(claim => !terminal.has(claim.state) || (record.queue || []).some(item=>item.id===claim.id && item.state==='claimed'));
  const observations=[], recommendations=[];
  for (let offset=0;offset<Math.min(candidates.length,100);offset+=4) {
    const batch=await Promise.all(candidates.slice(offset,offset+4).map(async claim=>{
      const result={assignment:claim.id,owner:claim.owner,branch:claim.branch,record_state:claim.state,execution:'unobserved'};
      try {
        const pulls=claim.pr ? [await api(`/repos/${repository}/pulls/${claim.pr}`)] : await api(`/repos/${repository}/pulls?state=all&head=${encodeURIComponent(repository.split('/')[0]+':'+claim.branch)}&per_page=10`);
        if(!Array.isArray(pulls))throw Error('Invalid PR response');
        const matches=pr=>pr.head?.ref===claim.branch && pr.head?.repo?.full_name===repository && pr.base?.ref===registration.default_branch && pr.base?.repo?.full_name===repository;
        let pr=pulls.find(matches);
        if(!pr){result.source='no_matching_pr';return result;}
        // List responses omit `merged`; a closed PR or preview merge SHA is
        // not merge proof. Resolve only the selected PR, checking for a race.
        if(typeof pr.merged!=='boolean' && !claim.pr){
          if(!Number.isSafeInteger(pr.number)||pr.number<1)throw Error('Invalid listed PR identity');
          const detail=await api(`/repos/${repository}/pulls/${pr.number}`);
          if(!detail || !matches(detail) || detail.number!==pr.number || detail.head.sha!==pr.head.sha)throw Error('PR changed while resolving merge evidence');
          pr=detail;
        }
        if(typeof pr.merged!=='boolean' || !/^[a-f0-9]{40}$/.test(pr.head.sha||'') || (pr.merged&&!/^[a-f0-9]{40}$/.test(pr.merge_commit_sha||'')))throw Error('PR verification identity is incomplete');
        result.pr=pr.number;result.head_sha=pr.head.sha;result.pr_state=pr.merged?'merged':pr.state;
        result.merge_sha=pr.merged?pr.merge_commit_sha:null;
        const [checks,deployments]=await Promise.all([
          api(`/repos/${repository}/commits/${pr.head.sha}/check-runs?per_page=100`),
          api(`/repos/${repository}/deployments?sha=${pr.merged?pr.merge_commit_sha:pr.head.sha}&per_page=10`)
        ]);
        if(!Array.isArray(checks.check_runs)||!Array.isArray(deployments))throw Error('Invalid verification response');
        result.checks={complete:checks.total_count<=100,items:checks.check_runs.map(x=>({name:x.name,status:x.status,conclusion:x.conclusion,head_sha:x.head_sha,url:x.html_url}))};
        result.deployments=await Promise.all(deployments.map(async deployment=>{
          const statuses=await api(`/repos/${repository}/deployments/${deployment.id}/statuses?per_page=1`);
          if(!Array.isArray(statuses))throw Error('Invalid deployment status');
          return {id:deployment.id,sha:deployment.sha,environment:deployment.environment,state:statuses[0]?.state||'unknown',url:statuses[0]?.environment_url||null,runtime_verified:false};
        }));
        result.source='observed';
        const queued=(record.queue||[]).find(item=>item.id===claim.id);
        const exactCompleted=claim.state==='completed' && claim.work_accounted && claim.merged_head_sha===pr.head.sha && claim.merge_commit_sha===pr.merge_commit_sha;
        if(pr.merged && queued?.state==='claimed') {
          const proposal={project,assignment:claim.id,owner:claim.owner,queue_owner:queued.owner,pr:pr.number,head_sha:pr.head.sha,merge_sha:pr.merge_commit_sha,
            action:exactCompleted && queued.owner===claim.owner?'reconcile-completed-queue':'inspect-merged-ownership',non_owning:true};
          result.recommendation={id:'sync_'+digest(proposal),...proposal};
        }
        // Paused, held and cancelled records are never reopened by synchronization.
        return result;
      } catch { return {...result,source:'unavailable',error:'Provider evidence incomplete; preserve coordination and retry on the next sync.'}; }
    }));
    for(const observation of batch){if(observation.recommendation){recommendations.push(observation.recommendation);delete observation.recommendation;}observations.push(observation);}
  }
  return {project,repository,observations,recommendations,truncated:candidates.length>100,model_calls:0,coordination_writes:0,worker_execution:false};
}

export async function synchronizeRegistry(api) {
  const control=runnerControlBase();
  const read=path=>readRunnerJsonFile(api,control,path,'main');
  const files=await api(control+'/contents/projects?ref=main');
  if(!Array.isArray(files)||files.length>=1000)throw Error('Project inventory is incomplete');
  const projects=[];
  for(const file of files.filter(x=>x.type==='file'&&/^[a-z0-9-]+\.json$/.test(x.name))) {
    const project=file.name.slice(0,-5);
    try {
      const registration=(await read('projects/'+file.name)).value;
      if(registration.alias_of || !registration.managed || registration.coordination?.status!=='enabled')continue;
      if(registration.id!==project || registration.coordination.record!==`coordination/${project}.json`)throw Error('Project registration identity mismatch');
      const record=await read(registration.coordination.record);
      if(record.value.project!==project || !Array.isArray(record.value.claims) || !Array.isArray(record.value.queue))throw Error('Coordination record is incomplete');
      projects.push({record_sha:record.sha,...await synchronizeProject(project,registration,record.value,api)});
    } catch { projects.push({project,source:'unavailable',recommendations:[],coordination_writes:0}); }
  }
  return {schema:1,checked_at:new Date().toISOString(),kind:'model-free-provider-sync',model_calls:0,projects};
}

async function main() {
  const args=process.argv.slice(2);if(args.length && (args.length!==2||args[0]!=='--out'))throw Error('Usage: node scripts/runner-sync.mjs [--out path]');
  const api=async path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']}));
  const report=await synchronizeRegistry(api);
  const text=JSON.stringify(report,null,2)+'\n';
  if(args[0])await writeFile(args[1],text);else process.stdout.write(text);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
