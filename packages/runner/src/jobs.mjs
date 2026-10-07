import { createHash, randomUUID } from 'node:crypto';
import { serializeSourceBundle, validateSourceBundle } from './source-checkpoints.mjs';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const terminal = new Set(['succeeded','failed','cancelled']);
const key = (project,assignment) => `execution/v1/${project}/${assignment}.json`;
const fail = message => { const error=Error(message);error.code='conflict';throw error; };
const iso = now => new Date(now).toISOString();
const live = (until, now) => Number.isFinite(Date.parse(until)) && Date.parse(until)>now;
const samePaths = (a,b) => Array.isArray(a)&&Array.isArray(b)&&JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const checkpointFields = ['session_id','head_sha','summary','changed_paths','evidence'];
function sourceProof(stored) {
  if(!stored)return {state:'local_only'};
  return {...stored.metadata,state:stored.restore?'restore_verified':'remote_verified',verified_at:stored.verified_at,verified_revision:stored.verified_revision,
    byte_evidence_source:'private-object-readback',capture_evidence_source:'authenticated-executor-selected-scope',host_execution_verified:false,
    ...(stored.restore?{...stored.restore,restore_evidence_source:'authenticated-executor-restoration-receipt'}:{})};
}
function checkpointView(job) {
  if(!job.checkpoint)return undefined;
  const checkpoint=Object.fromEntries(checkpointFields.filter(name=>job.checkpoint[name]!==undefined).map(name=>[name,job.checkpoint[name]]));
  const current=job._source_checkpoint&&job.checkpoint.source_capture_digest===job._source_checkpoint.metadata.digest;
  return {...checkpoint,source:current?sourceProof(job._source_checkpoint):{state:'local_only'},
    ...(!current&&job._source_checkpoint?{last_verified_source:sourceProof(job._source_checkpoint)}:{})};
}
export function jobView(job, now=Date.now()) {
  if(!job)return null;
  const {lease_token,operations,_source_checkpoint,checkpoint,...publicJob}=job;
  return {...publicJob,...(checkpoint?{checkpoint:checkpointView(job)}:{}),observed_state:['leased','running','cancel_requested'].includes(job.state)&&!live(job.lease_until,now)?'recovery_required':job.state,
    objective_completed:false,process_verified:false,execution_evidence_source:'authenticated-executor-receipts'};
}
function sourceIdentity(job,target,{historical=false}={}) {
  if(job.repository!==target.repository||job.branch!==target.branch||(!historical&&target.head_sha!==job.initial_head_sha))fail('Source checkpoint requires the admitted repository, branch and unchanged initial head');
  if(!samePaths(job.objective.paths,target.paths))fail('Source checkpoint scope changed; reconcile the admitted objective');
  return {repository:job.repository,branch:job.branch,head_sha:job.initial_head_sha,scope:job.objective.paths};
}
function sourceKey(job,hash) {
  if(!/^job_[a-f0-9]{64}$/.test(job.id)||!/^[a-f0-9]{64}$/.test(hash||''))fail('Invalid private source checkpoint identity');
  return `execution-source/v1/${job.id}/${hash}.json`;
}
async function readSource(bucket,job,target,stored=job._source_checkpoint,{historical=false}={}) {
  if(!stored?.metadata)fail('No remotely verified source checkpoint exists');
  const object=await bucket.get(sourceKey(job,stored.metadata.digest));
  if(!object)fail('Private source checkpoint readback is missing; preserve the previous receipt');
  let bundle;
  try{bundle=await object.json();}catch{fail('Private source checkpoint readback is corrupt; preserve the previous receipt');}
  const metadata=validateSourceBundle(bundle,sourceIdentity(job,target,{historical}));
  if(JSON.stringify(metadata)!==JSON.stringify(stored.metadata))fail('Private source checkpoint readback does not match the stored receipt');
  return bundle;
}
async function saveSource(bucket,job,target,bundle,now) {
  const metadata=validateSourceBundle(bundle,sourceIdentity(job,target));
  const storageKey=sourceKey(job,metadata.digest);
  if(!await bucket.get(storageKey)) {
    // An immutable duplicate is safe only after readback. Null is a conditional
    // race, never permission to overwrite another value at the same key.
    await bucket.put(storageKey,serializeSourceBundle(bundle),{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});
  }
  const stored={metadata,verified_at:iso(now),verified_revision:job.revision+1,
    ...(job._source_checkpoint?.metadata.digest===metadata.digest&&job._source_checkpoint.restore?{restore:job._source_checkpoint.restore}:{})};
  await readSource(bucket,job,target,stored);
  return stored;
}
async function applyCheckpoint(bucket,job,target,input,now,{recover=false}={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Checkpoint evidence is required');
  if(Object.keys(input).some(name=>![...checkpointFields,'source_bundle','source_restore'].includes(name)))fail('Checkpoint contains unsupported fields; proof state is server-derived');
  if(typeof input.summary!=='string'||!input.summary||input.summary.length>2000)fail('Checkpoint summary is required');
  if(input.source_bundle&&input.source_restore)fail('Capture and restore acknowledgment are separate checkpoint operations');
  if(recover&&(input.source_bundle||input.source_restore))fail('Recover the lease before source storage or restoration');
  const checkpoint=Object.fromEntries(checkpointFields.filter(name=>input[name]!==undefined).map(name=>[name,input[name]]));
  if(input.source_bundle) {
    if(input.head_sha!==job.initial_head_sha||input.source_bundle.head_sha!==input.head_sha)fail('Source checkpoint head must equal its admitted initial head and checkpoint head');
    const stored=await saveSource(bucket,job,target,input.source_bundle,now);
    job._source_checkpoint=stored;checkpoint.source_capture_digest=stored.metadata.digest;
  } else if(input.source_restore) {
    const receipt=input.source_restore;
    if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||Object.keys(receipt).sort().join(',')!=='digest,restored_digest,restored_file_count')fail('Restoration receipt has unsupported or missing fields');
    if(input.head_sha!==job.initial_head_sha)fail('Restoration head must equal the admitted initial head');
    await readSource(bucket,job,target);
    const expected=job._source_checkpoint.metadata;
    if(receipt.digest!==expected.digest||receipt.restored_digest!==expected.digest||!Number.isSafeInteger(receipt.restored_file_count)||receipt.restored_file_count!==expected.file_count)fail('Restoration digest or restored file count does not match the current source checkpoint');
    job._source_checkpoint={...job._source_checkpoint,restore:{restored_digest:receipt.restored_digest,restored_file_count:receipt.restored_file_count,restored_at:iso(now),restored_revision:job.revision+1}};
    checkpoint.source_capture_digest=expected.digest;
  }
  // Metadata-only heartbeats and recovery retain the private last-known-good
  // bytes, but cannot label a possibly changed checkout as remotely saved.
  job.checkpoint=checkpoint;
}
export async function operateJob(bucket,args,target,{now=Date.now(),uuid=randomUUID}={}) {
  if(!bucket?.get||!bucket?.put)throw Error('Durable execution storage unavailable');
  const storageKey=key(args.project,args.assignment);
  const object=await bucket.get(storageKey),document=object?await object.json():{schema:1,jobs:[]};
  if(document.schema!==1||!Array.isArray(document.jobs))throw Error('Invalid execution storage');
  let job=args.job_id?document.jobs.find(j=>j.id===args.job_id):document.jobs.at(-1);
  if(args.action==='status')return {ok:true,job:jobView(job,now),revision:job?.revision||0};
  const owned=()=>{if(!target||target.state!=='active'||target.owner!==args.expected_owner||target.branch!==args.expected_branch||!live(target.lease_until,now))fail('Current active assignment ownership is required');};
  const sourceAccess=({allowExpired=false,historical=false}={})=>{
    owned();
    if(!args.job_id||!job||(!historical&&job!==document.jobs.at(-1))||job.id!==args.job_id)fail('Source access requires the exact current execution job');
    if(job.owner!==target.owner||job.branch!==target.branch)fail('Execution cannot cross an assignment handoff');
    if(!args.executor_id||!args.lease_token||args.executor_id!==job.executor_id||args.lease_token!==job.lease_token)fail('Executor lease does not match');
    if(!allowExpired&&!live(job.lease_until,now))fail('Execution lease expired; recover before reading source');
    sourceIdentity(job,target,{historical});
  };
  if(args.action==='source_read') {
    sourceAccess({allowExpired:true,historical:true});
    if(args.expected_revision!==job.revision)fail('Execution revision changed; read status before retrying');
    // Read-only recovery remains possible after expiry, terminal completion or
    // a newer job, using the original token plus current assignment ownership.
    const source_bundle=await readSource(bucket,job,target,job._source_checkpoint,{historical:true});
    const current=await bucket.get(storageKey);
    if(!current||current.etag!==object.etag)fail('Execution changed during source read; refresh before reading bytes');
    return {ok:true,job:jobView(job,now),revision:job.revision,source:sourceProof(job._source_checkpoint),source_bundle};
  }
  const intent=digest(args),operation=args.operation_id;
  if(!operation)throw Error('Execution mutation requires operation_id');
  const previous=document.jobs.flatMap(j=>(j.operations||[]).map(op=>({job:j,op}))).find(x=>x.op.id===operation);
  if(previous){
    if(previous.op.intent!==intent)fail('Operation ID was already used for different execution intent');
    if(['checkpoint','recover'].includes(args.action)) {
      sourceAccess({allowExpired:args.action==='recover'});
      if(previous.job!==job||job.revision!==previous.op.revision||args.expected_revision!==previous.op.revision-1)fail('Execution revision changed after the acknowledged operation');
    }
    return {ok:true,replayed:true,job:jobView(previous.job,now),...(args.action==='lease'?{lease_token:previous.job.lease_token}:{})};
  }
  if(args.action==='submit') {
    owned();
    if(document.jobs.some(j=>!terminal.has(j.state)))fail('An execution already occupies this assignment; inspect its receipt');
    if(args.expected_head_sha!==target.head_sha)fail('Assignment head changed before execution request');
    const snapshot={goal:target.goal,acceptance:target.acceptance,paths:target.paths,ledger_refs:target.ledger_refs||[]};
    if(!snapshot.goal||!snapshot.acceptance||!snapshot.paths?.length)fail('Assignment objective, acceptance and scope must be explicit');
    job={id:'job_'+digest({project:args.project,assignment:args.assignment,operation}),project:args.project,assignment:args.assignment,owner:target.owner,branch:target.branch,repository:target.repository,
      initial_head_sha:target.head_sha,objective:snapshot,objective_digest:digest(snapshot),request:args.prompt,required_capabilities:args.required_capabilities||['codex-cli'],
      ...(args.origin?{origin:args.origin}:{}),state:'queued',revision:0,created_at:iso(now),attempt:0,events:[],operations:[]};
    document.jobs.push(job);
    if(document.jobs.length>20)fail('Execution history capacity reached; archive accounted receipts before creating more jobs');
  } else {
    if(!job)fail('Execution job not found');
    if(args.expected_revision!==job.revision)fail('Execution revision changed; read status before retrying');
    if(job.operations.length>=2048)fail('Execution checkpoint capacity reached; preserve the receipt and recover explicitly');
    if(args.action==='cancel') {
      if(job.owner!==args.expected_owner||job.branch!==args.expected_branch)fail('Execution owner or branch changed');
      if(terminal.has(job.state))fail('Execution already ended');
      job.state=job.state==='queued'?'cancelled':'cancel_requested';
    } else {
      owned();
      if(job.owner!==target.owner||job.branch!==target.branch)fail('Execution cannot cross an assignment handoff');
      if(args.action==='lease') {
        if(job.state!=='queued')fail('Execution is not queued; an expired lease requires explicit recovery');
        if(job.required_capabilities.some(c=>!args.capabilities?.includes(c)))fail('Executor lacks required capabilities');
        if(args.expected_head_sha!==target.head_sha||target.head_sha!==job.initial_head_sha)fail('Source changed before execution lease');
        job.executor_id=args.executor_id;job.executor_capabilities=[...args.capabilities];job.lease_token=uuid();job.state='leased';job.attempt++;job.lease_until=iso(now+300000);
      } else {
        if(!args.executor_id||!args.lease_token||args.executor_id!==job.executor_id||args.lease_token!==job.lease_token)fail('Executor lease does not match');
        if(args.action!=='recover'&&!live(job.lease_until,now))fail('Execution lease expired; verify the old process stopped before recovery');
        if(args.action==='start') {
          if(job.state!=='leased'||!args.process?.pid||!args.process?.host||!args.process?.version)fail('Start requires a leased job and concrete process receipt');
          if(job.required_capabilities.includes('source-byte-checkpoints-v1')&&checkpointView(job)?.source.state!=='restore_verified')fail('Required source checkpoint must be restored before starting work');
          job.state='running';job.process=args.process;job.started_at=iso(now);job.started_revision=job.revision+1;
        } else if(args.action==='checkpoint') {
          if(!['running','cancel_requested'].includes(job.state)&&!(job.state==='leased'&&(args.checkpoint?.source_restore||args.checkpoint?.source_bundle)))fail('Checkpoint requires a running execution or leased source restoration');
          if(args.checkpoint?.source_bundle||args.checkpoint?.source_restore)sourceAccess();
          await applyCheckpoint(bucket,job,target,args.checkpoint,now);job.lease_until=iso(now+300000);
        } else if(args.action==='finish') {
          if(!['running','cancel_requested','leased'].includes(job.state)||!args.result)fail('Finish requires an open execution and exit receipt');
          if(args.result.state==='succeeded' && (args.result.exit_code!==0||!args.result.session_id||!args.result.head_sha))fail('Successful execution requires zero exit, session and source evidence');
          if(job.state==='cancel_requested'&&args.result.state!=='cancelled')fail('Cancellation must be acknowledged after process exit');
          if(args.result.state==='succeeded'&&job.required_capabilities.includes('source-byte-checkpoints-v1')){
            const proof=checkpointView(job)?.source;
            if(job.state!=='running'||proof?.state!=='restore_verified'||!Number.isSafeInteger(job.started_revision)||proof.restored_revision<=job.started_revision||args.result.head_sha!==proof.head_sha)fail('Required final source checkpoint must be restored after start and match the reported head');
          }
          job.result=args.result;job.state=args.result.state;job.finished_at=iso(now);
        } else if(args.action==='recover') {
          if(!args.previous_process_stopped||!args.checkpoint)fail('Recovery requires a confirmed stopped process and preserved checkpoint');
          if(job.state==='succeeded'||(!terminal.has(job.state)&&live(job.lease_until,now)))fail('A live or successful execution cannot be reclaimed');
          await applyCheckpoint(bucket,job,target,args.checkpoint,now,{recover:true});job.state='leased';delete job.started_revision;job.attempt++;job.lease_until=iso(now+300000);
        } else throw Error('Unsupported execution action');
      }
    }
  }
  job.revision++;job.updated_at=iso(now);
  job.operations.push({id:operation,intent,revision:job.revision});
  job.events.push({operation_id:operation,action:args.action,state:job.state,at:iso(now),revision:job.revision,executor_id:job.executor_id||null});
  const result=await bucket.put(storageKey,JSON.stringify(document),{onlyIf:object?{etagMatches:object.etag}:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});
  if(!result)fail('Execution storage changed; refresh instead of replaying stale writes');
  return {ok:true,replayed:false,job:jobView(job,now),...(args.action==='lease'?{lease_token:job.lease_token}:{})};
}

// Public recovery discovery contains identities and proof summaries, never bytes
// or bearer material. Actual source reads still require the original token.
export async function readSourceRecoveryHints(bucket, project, assignment) {
  if(!bucket?.get)return {available:false,state:'unavailable',reason:'storage-unavailable'};
  try {
    const object=await bucket.get(key(project,assignment.id));
    if(!object)return {available:true,state:'local_only',snapshots:[]};
    const record=await object.json();
    if(record.schema!==1||!Array.isArray(record.jobs)||record.jobs.length>20)throw Error('invalid record');
    const snapshots=record.jobs.filter(job=>job.owner===assignment.owner&&job.branch===assignment.branch).map(job=>{
      const view=jobView(job);return {job_id:job.id,revision:job.revision,job_state:job.state,repository:job.repository,branch:job.branch,head_sha:job.initial_head_sha,
        source:view.checkpoint?.source||{state:'local_only'},...(view.checkpoint?.last_verified_source?{last_verified_source:view.checkpoint.last_verified_source}:{})};
    });
    return {available:true,state:snapshots.at(-1)?.source.state||'local_only',snapshots,
      recovery:'Use source_read for the exact job with current assignment ownership and its original executor receipt; restore only into a fresh directory. Snapshot proof does not establish current checkout protection.'};
  } catch {return {available:false,state:'checkpoint_blocked',reason:'checkpoint-metadata-unavailable'};}
}
