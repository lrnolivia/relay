import {createHash} from 'node:crypto';
import {jobsTool,callJobs} from '../packages/runner/src/job-control.mjs';
import {validateControlArguments} from './runner-control.js';

export const NATIVE_OVERSIGHT_PREFIX='relay-native-oversight/v1:';
export const nativeCompatibleJobsTool={...jobsTool,description:jobsTool.description+' Native oversight clients with a cached schema may send checkpoint.evidence as relay-native-oversight/v1: followed by JSON with command=start or observe, thread_id, host, version, state=active and observed_at. This explicit native-only command uses the same current owner, private lease, revision and host-observation checks. Start saves the observation before reporting the exact native thread running; it never supplies a PID or starts coding.'};

// Compatibility for an existing authorized client whose cached input schema
// predates native_thread. This translates an explicit native-only request into
// the current broker operations; every write still goes through callJobs.
export async function callCompatibleJobs(args,env,{call=callJobs}={}){
 validateControlArguments(args,jobsTool.inputSchema);
 const evidence=args.checkpoint?.evidence;
 if(args.action!=='checkpoint'||typeof evidence!=='string'||!evidence.startsWith(NATIVE_OVERSIGHT_PREFIX))return call(args,env);
 let envelope;
 try{envelope=JSON.parse(evidence.slice(NATIVE_OVERSIGHT_PREFIX.length));}catch{throw Error('Invalid native oversight envelope');}
 const keys=['command','host','observed_at','state','thread_id','version'];
 if(!envelope||Array.isArray(envelope)||Object.keys(envelope).sort().join(',')!==keys.join(',')||!['start','observe'].includes(envelope.command)||envelope.state!=='active')throw Error('Invalid native oversight envelope');
 if(Object.keys(args.checkpoint).some(k=>!['summary','session_id','head_sha','evidence','changed_paths'].includes(k)))throw Error('Native compatibility cannot mix source or native checkpoint formats');
 const common=Object.fromEntries(['project','assignment','job_id','expected_owner','expected_branch','executor_id','lease_token'].map(k=>[k,args[k]]));
 const process={adapter:'codex-desktop-oversight',thread_id:envelope.thread_id,host:envelope.host,version:envelope.version};
 const observation={thread_id:envelope.thread_id,host:envelope.host,state:envelope.state,observed_at:envelope.observed_at};
 const key=createHash('sha256').update(args.operation_id||'').digest('hex');
 const checkpoint={...args,...common,operation_id:'native-observe-'+key,checkpoint:{...args.checkpoint,native_thread:observation}};
 const start={...common,action:'start',operation_id:'native-start-'+key,expected_revision:args.expected_revision+1,process};
 // Reuse the canonical schema for the projected shapes, including limits.
 validateControlArguments(checkpoint,jobsTool.inputSchema);
 validateControlArguments(start,jobsTool.inputSchema);
 const status=await call({action:'status',project:args.project,assignment:args.assignment,job_id:args.job_id},env),job=status.job;
 if(status.ok!==true||!job||job.id!==args.job_id||job.owner!==args.expected_owner||job.owner!==envelope.thread_id||job.branch!==args.expected_branch||job.executor_id!==args.executor_id||job.required_capabilities?.length!==1||job.required_capabilities[0]!=='native-thread-oversight-v1')throw Error('Native compatibility requires the exact native-only oversight job and owner');
 if(envelope.command==='observe'){
  if(job.state!=='running'||job.process?.adapter!=='codex-desktop-oversight')throw Error('Native observation requires an already running native oversight job');
  return call(checkpoint,env);
 }
 if(job.state==='running'){
  // Reconcile only this exact original start operation. The broker compares
  // its immutable intent (including lease/identity); status alone is no proof.
  return call(start,env);
 }
 if(job.state!=='leased')throw Error('Native start requires a current lease');
 const saved=await call(checkpoint,env);
 if(saved.ok!==true)return saved;
 return call(start,env);
}
