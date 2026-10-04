import { createHash, randomUUID } from 'node:crypto';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const terminal = new Set(['succeeded','failed','cancelled']);
const key = (project,assignment) => `execution/v1/${project}/${assignment}.json`;
const fail = message => { const error=Error(message);error.code='conflict';throw error; };
const iso = now => new Date(now).toISOString();
export function jobView(job, now=Date.now()) {
  if(!job)return null;
  const {lease_token,operations,...publicJob}=job;
  return {...publicJob,observed_state:['leased','running','cancel_requested'].includes(job.state)&&Date.parse(job.lease_until)<=now?'recovery_required':job.state,
    objective_completed:false,process_verified:false,execution_evidence_source:'authenticated-executor-receipts'};
}
export async function operateJob(bucket,args,target,{now=Date.now(),uuid=randomUUID}={}) {
  if(!bucket?.get||!bucket?.put)throw Error('Durable execution storage unavailable');
  const storageKey=key(args.project,args.assignment);
  const object=await bucket.get(storageKey),document=object?await object.json():{schema:1,jobs:[]};
  if(document.schema!==1||!Array.isArray(document.jobs))throw Error('Invalid execution storage');
  let job=args.job_id?document.jobs.find(j=>j.id===args.job_id):document.jobs.at(-1);
  if(args.action==='status')return {ok:true,job:jobView(job,now),revision:job?.revision||0};
  const intent=digest(args),operation=args.operation_id;
  if(!operation)throw Error('Execution mutation requires operation_id');
  const previous=document.jobs.flatMap(j=>(j.operations||[]).map(op=>({job:j,op}))).find(x=>x.op.id===operation);
  if(previous){if(previous.op.intent!==intent)fail('Operation ID was already used for different execution intent');return {ok:true,replayed:true,job:jobView(previous.job,now),...(args.action==='lease'?{lease_token:previous.job.lease_token}:{})};}
  const owned=()=>{if(!target||target.state!=='active'||target.owner!==args.expected_owner||target.branch!==args.expected_branch||Date.parse(target.lease_until)<=now)fail('Current active assignment ownership is required');};
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
        if(args.executor_id!==job.executor_id||args.lease_token!==job.lease_token)fail('Executor lease does not match');
        if(args.action!=='recover'&&Date.parse(job.lease_until)<=now)fail('Execution lease expired; verify the old process stopped before recovery');
        if(args.action==='start') {
          if(job.state!=='leased'||!args.process?.pid||!args.process?.host||!args.process?.version)fail('Start requires a leased job and concrete process receipt');
          job.state='running';job.process=args.process;job.started_at=iso(now);
        } else if(args.action==='checkpoint') {
          if(!['running','cancel_requested'].includes(job.state))fail('Checkpoint requires a running execution');
          if(!args.checkpoint)fail('Checkpoint evidence is required');
          job.checkpoint=args.checkpoint;job.lease_until=iso(now+300000);
        } else if(args.action==='finish') {
          if(!['running','cancel_requested','leased'].includes(job.state)||!args.result)fail('Finish requires an open execution and exit receipt');
          if(args.result.state==='succeeded' && (args.result.exit_code!==0||!args.result.session_id||!args.result.head_sha))fail('Successful execution requires zero exit, session and source evidence');
          if(job.state==='cancel_requested'&&args.result.state!=='cancelled')fail('Cancellation must be acknowledged after process exit');
          job.result=args.result;job.state=args.result.state;job.finished_at=iso(now);
        } else if(args.action==='recover') {
          if(!args.previous_process_stopped||!args.checkpoint)fail('Recovery requires a confirmed stopped process and preserved checkpoint');
          if(job.state==='succeeded'||(!terminal.has(job.state)&&Date.parse(job.lease_until)>now))fail('A live or successful execution cannot be reclaimed');
          job.checkpoint=args.checkpoint;job.state='leased';job.attempt++;job.lease_until=iso(now+300000);
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
