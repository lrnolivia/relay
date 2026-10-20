import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const terminal=new Set(['succeeded','failed','cancelled']);

export function validateContinuityPlan(plan){
 if(plan?.schema!==1||typeof plan.authorization!=='string'||!plan.authorization.trim()||!Array.isArray(plan.criteria)||!plan.criteria.length||!Array.isArray(plan.stages)||!plan.stages.length||plan.stages.length>32)throw Error('Continuity requires explicit authorization and complete finite acceptance');
 if(!/^[a-f0-9]{64}$/.test(plan.objective_digest||'')||new Set(plan.criteria).size!==plan.criteria.length)throw Error('Bind the full objective and unique acceptance criteria');
 const ids=new Set(),covered=new Set();
 if(!plan.environment||typeof plan.environment!=='object')throw Error('Record the verifier environment identity');
 for(const stage of plan.stages){
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(stage.id||'')||ids.has(stage.id)||!['implementation','test','review','ship','runtime'].includes(stage.kind)||typeof stage.prompt!=='string'||!stage.prompt.trim()||!Array.isArray(stage.criteria)||!stage.criteria.length||stage.criteria.some(id=>!plan.criteria.includes(id))||!Array.isArray(stage.depends_on)||stage.depends_on.some(id=>!ids.has(id)))throw Error('Stages must cover authorized acceptance with ordered dependencies');
  if(!Array.isArray(stage.verify)||!stage.verify.length||stage.verify.some(x=>typeof x!=='string'||!x)||!Array.isArray(stage.inputs)||!stage.inputs.length||stage.inputs.some(x=>!x||x.startsWith('/')||x.split('/').includes('..')))throw Error('Declare each verifier and all its relevant source/config inputs');
  if(stage.command&&(!Array.isArray(stage.command)||!stage.command.length||stage.command.some(x=>typeof x!=='string'||!x)))throw Error('Publication actions require an explicit trusted command');
  ids.add(stage.id);stage.criteria.forEach(id=>covered.add(id));
 }
 if(plan.criteria.some(id=>!covered.has(id)))throw Error('Continuity plan drops acceptance criteria');
 return plan;
}

// Coordinator owns advancement. Neither a process exit nor model prose is an
// acceptance receipt. Every mutation intent is persisted before dispatch.
export async function reconcileContinuity({plan,journal,persist,readControl,inputs,verify,execute,reconcile,maxActions=16}){
 validateContinuityPlan(plan);
 const state=journal||{schema:1,plan_digest:hash(plan),stages:{},objective_completed:false};
 if(state.schema!==1||state.plan_digest!==hash(plan))throw Error('Acceptance or plan changed; explicitly reconcile the saved checkpoint');
 state.objective_completed=false;let actions=0;
 const gate=async()=>{
  const control=await readControl();
  if(control.held||control.global_held||control.security_stop||control.assignment_active!==true||control.objective_digest!==plan.objective_digest)throw Error('Current authority stops continuity; preserve checkpoints');
  return control;
 };
 const identity=async stage=>hash({inputs:await inputs(stage),verifier:stage.verify,environment:plan.environment,objective:plan.objective_digest,dependencies:stage.depends_on.map(id=>state.stages[id]?.receipt?.input_digest)});
 for(let pass=0;pass<3;pass++){
 for(const stage of plan.stages){
  if(stage.depends_on.some(id=>state.stages[id]?.state!=='passed'))continue;
  let control=await gate(),row=state.stages[stage.id] ||= {state:'ready',attempts:0};
  // An uncertain launch is always read back using its original identity. Never
  // turn a lost response into a second request or another executor.
  if(row.pending){
   const result=await reconcile(row.pending);
   if(result?.state==='queued'){
    const fresh=await gate();if(fresh.revision!==row.pending.control_revision||fresh.global_revision!==row.pending.global_revision)throw Error('Control revision changed before queued continuation');
    try{const started=await execute(row.pending,stage);if(!terminal.has(started?.state))throw Error('Uncertain queued execution');row.last_job=started;row.pending=null;await persist(state);}catch{row.state='reconciliation-required';await persist(state);continue;}
   }else{
    if(!result||!terminal.has(result.state)){row.state='reconciliation-required';await persist(state);continue;}
    row.last_job=result;row.pending=null;await persist(state);
   }
  }
  let input=await identity(stage);
  if(row.receipt?.input_digest===input&&row.state==='passed'&&['implementation','test'].includes(stage.kind))continue;
  while(true){
   control=await gate();
   const proof=await verify(stage);
   const after=await identity(stage);
   if(proof?.passed===true&&typeof proof.evidence==='string'&&proof.evidence&&after===input){
    row.state='passed';row.receipt={input_digest:after,evidence:proof.evidence,source_sha:control.source_sha};await persist(state);break;
   }
   row.state='repair-required';row.receipt=null;
   // Identical failures have a bounded budget; material source/config changes
   // reset it. Promotion remains dependent on a fresh passing verifier.
   const fingerprint=hash({input:after,diagnostic:proof?.fingerprint||'verification-failed'});
   if(row.failure!==fingerprint){row.failure=fingerprint;row.attempts=0;}
   if(row.attempts>=2||actions>=maxActions){row.state='parked';await persist(state);break;}
   const fresh=await gate();
   if(fresh.revision!==control.revision||fresh.global_revision!==control.global_revision)throw Error('Control revision changed before continuation; refresh without launching');
   row.pending={operation_id:'continuity-'+hash({plan:state.plan_digest,stage:stage.id,input:after,attempt:row.attempts}),stage:stage.id,prompt:stage.prompt,control_revision:fresh.revision,global_revision:fresh.global_revision};
   row.attempts++;actions++;row.state='dispatching';await persist(state);
   let result;
   try{result=await execute(row.pending,stage);}catch{row.state='reconciliation-required';await persist(state);break;}
   if(!result||!terminal.has(result.state)){row.state='reconciliation-required';await persist(state);break;}
   row.last_job=result;row.pending=null;await persist(state);input=await identity(stage);
   await gate();
  }
 }
 let invalid=false;
 for(const stage of plan.stages){const row=state.stages[stage.id];if(row?.state==='passed'&&row.receipt?.input_digest!==await identity(stage)){row.state='ready';invalid=true;}}
 if(!invalid)break;
 }
 state.objective_completed=plan.stages.every(stage=>state.stages[stage.id]?.state==='passed');
 await gate();await persist(state);return state;
}

export async function runContinuityExecution({config,workspace,stateDir,rpc,runExecution}){
 workspace=await fs.realpath(workspace);
 const plan=validateContinuityPlan(config.continuity),directory=path.resolve(stateDir);
 if(directory===workspace||directory.startsWith(workspace+path.sep))throw Error('Continuity receipts must live outside the checkout');
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 const lock=path.join(directory,'continuity.lock');await fs.mkdir(lock,{mode:0o700});
 const filename=path.join(directory,'continuity.json');let journal;
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
 const persist=async value=>{await fs.writeFile(filename+'.tmp',JSON.stringify(value)+'\n',{mode:0o600});await fs.rename(filename+'.tmp',filename);};
 const assignment=async()=>{
  const result=await rpc('relay_runner_resume',{project:config.project,assignment:config.assignment});
  const a=result.latest?.assignment;if(!a||a.id!==config.assignment||a.owner!==config.owner||a.branch!==config.branch)throw Error('Current assignment identity unavailable');return a;
 };
 const readControl=async()=>{
  const global=await rpc('relay_autonomy',{action:'status',scope:'global'}),project=await rpc('relay_autonomy',{action:'status',scope:config.project}),a=await assignment();
  if(global.ok!==true||project.ok!==true||!Number.isSafeInteger(global.state?.revision)||!Number.isSafeInteger(project.state?.revision))throw Error('Authoritative control unavailable');
  return {global_held:global.state.held,held:project.state.held,revision:project.state.revision,global_revision:global.state.revision,assignment_active:a.state==='active',objective_digest:hash({goal:a.goal,acceptance:a.acceptance}),source_sha:git(['rev-parse','HEAD'])};
 };
 const jobStatus=async job_id=>(await rpc('relay_execution',{action:'status',project:config.project,assignment:config.assignment,...(job_id?{job_id}:{})})).job;
 const reconcile=async pending=>{
  const stage=plan.stages.find(s=>s.id===pending.stage);
  if(stage.command){const proof=await verify(stage);return proof.passed?{state:'succeeded',evidence:proof.evidence}:null;}
  const job=await jobStatus(pending.job_id||'job_'+hash({project:config.project,assignment:config.assignment,operation:pending.operation_id}));
  if(!job||job.request!==pending.prompt)return null;
  return {state:job.state,job_id:job.id,head_sha:job.result?.head_sha};
 };
 const verify=async stage=>{
  const r=spawnSync(stage.verify[0],stage.verify.slice(1),{cwd:workspace,env:process.env,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
  return {passed:r.status===0,evidence:'sha256:'+hash({command:stage.verify,stdout:r.stdout,stderr:r.stderr,status:r.status}),fingerprint:hash({status:r.status,signal:r.signal})};
 };
 try{
  try{journal=JSON.parse(await fs.readFile(filename,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  return await reconcileContinuity({plan,journal,persist,readControl,
   inputs:async stage=>{
    const files=git(['ls-files','--cached','--others','--exclude-standard','-z','--',...stage.inputs]).split('\0').filter(Boolean).sort();
    const environment={node:process.version,platform:process.platform,arch:process.arch,variables:Object.fromEntries(['PATH','NODE_OPTIONS','TZ','LANG','PLAYWRIGHT_BROWSERS_PATH'].map(key=>[key,process.env[key]||null])),toolchain:[]};
    for(const file of ['package.json','package-lock.json','.node-version','node_modules/.package-lock.json']){try{environment.toolchain.push([file,hash(await fs.readFile(path.join(workspace,file)))]);}catch(e){if(e.code!=='ENOENT')throw e;environment.toolchain.push([file,'absent']);}}
    const bytes=[];for(const file of files){const full=path.resolve(workspace,file);if(!full.startsWith(path.resolve(workspace)+path.sep))throw Error('Input escapes workspace');let st;try{st=await fs.lstat(full);}catch(e){if(e.code==='ENOENT'){bytes.push([file,'deleted']);continue;}throw e;}if(!st.isFile()||st.isSymbolicLink()||st.size>16*1024*1024)throw Error('Input is not bounded source');bytes.push([file,hash(await fs.readFile(full))]);}return {bytes,environment};
   },
   verify,reconcile,
   execute:async (pending,stage)=>{
    const c=await readControl();if(c.held||c.global_held||!c.assignment_active||c.revision!==pending.control_revision||c.global_revision!==pending.global_revision)throw Error('Stop/revision changed before submit');
    if(stage.command){
     const result=spawnSync(stage.command[0],stage.command.slice(1),{cwd:workspace,env:process.env,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
     if(result.error||result.signal)return {state:'unknown'};
     return {state:result.status===0?'succeeded':'failed',exit_code:result.status,evidence:'sha256:'+hash({command:stage.command,stdout:result.stdout,stderr:result.stderr,status:result.status})};
    }
    let job=await jobStatus();
    const expectedJob='job_'+hash({project:config.project,assignment:config.assignment,operation:pending.operation_id});
    if(job?.id!==expectedJob){
     if(job&&!terminal.has(job.state))throw Error('An unreconciled execution occupies the assignment');
     const result=await rpc('relay_execution',{action:'submit',project:config.project,assignment:config.assignment,expected_owner:config.owner,expected_branch:config.branch,expected_head_sha:c.source_sha,operation_id:pending.operation_id,prompt:pending.prompt,required_capabilities:['codex-cli',...(config.source_checkpoints?['source-byte-checkpoints-v1']:[])]});job=result.job;
    }
    pending.job_id=job.id;
    // Persist binding before starting a process; a crash can reconcile this job.
    const saved=JSON.parse(await fs.readFile(filename,'utf8'));saved.stages[pending.stage].pending=pending;await persist(saved);
    const result=await runExecution({config:{...config,job_id:job.id,continuity:undefined,resume:false},workspace,stateDir:path.join(directory,job.id),rpc,admittedContinuation:await sourceFingerprint(workspace)});
    return {...result,job_id:job.id};
   }
  });
 }finally{await fs.rm(lock,{recursive:true});}
}
export async function sourceFingerprint(workspace){
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
 const files=git(['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean).sort(),extra=[];
 for(const file of files){const full=path.join(workspace,file),st=await fs.lstat(full);if(!st.isFile()||st.isSymbolicLink()||st.size>16*1024*1024)throw Error('Unbounded or redirected continuation source');extra.push([file,hash(await fs.readFile(full))]);}
 return hash({head:git(['rev-parse','HEAD']).trim(),diff:git(['diff','--binary','HEAD']),extra});
}
